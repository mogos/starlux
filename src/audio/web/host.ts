// Gesture-gated, WakeToken-governed Web Audio Host for @mogos/starlux/audio.
// Guarantees:
//   - Muted by default; zero AudioContext creation before a trusted user gesture (event.isTrusted === true).
//   - Acquires ONE @mogos/starlux WakeToken on admitted audio work; releases immediately when drained.
//   - Arms ONE generation-tagged 1600 ms warm-context linger timer, then suspends AudioContext cleanly.
//   - Serializes resume/suspend with generation guards so stale promises cannot suspend fresh audio.
//   - Connects AudioWorkletNode -> context.destination and listens for { type: "drained" } in browser contexts.
//   - At settled rest: 0 held WakeTokens, 0 DSP calls, 0 timers, suspended AudioContext.

import {
  type AdmissionState,
  type AudioCommand,
  type AudioLease,
  type EffectContext,
  type PlanArena,
  type PlanEvalResult,
  armAdmissionFromGesture,
  audioLingerUs,
  clampRate100,
  createAdmissionState,
  createAudioLease,
  evaluatePlan,
  frameDiff,
  getAudioCue,
  leaseForceSuspend,
  leaseMaySuspend,
  leaseOnAdmit,
  leaseOnDrained,
  leaseSuspend,
  scaleOffsetByRate,
  setAdmissionMuted,
  usToFrames,
  wrapU32,
} from "../../../ss/audio/index.ss.ts";
import { falsifyIdle, type IdleFalsifier, type IdleSample } from "../../../ss/lux/idle.ss.ts";
import { heldWakeTokens } from "../../../ss/lux/wake.ss.ts";
import { StarluxAudioWorkletCore, type WorkletMessage } from "./worklet.ts";

export interface AudioWorkletNodeLike {
  readonly port: {
    onmessage: ((ev: { readonly data: unknown }) => void) | null;
    postMessage(data: unknown): void;
  };
  connect(destination: unknown): unknown;
  disconnect?(): void;
}

export interface AudioContextLike {
  readonly state: "suspended" | "running" | "closed";
  readonly sampleRate: number;
  readonly destination?: unknown;
  readonly audioWorklet?: {
    addModule(moduleUrl: string): Promise<void>;
  };
  resume(): Promise<void>;
  suspend(): Promise<void>;
  close(): Promise<void>;
}

export type RemoteDrainHandler = (quantaRendered?: number, hostGen?: number) => void;

export interface AudioHostScheduler {
  nowUs(): number;
  setTimer(delayMs: number, cb: () => void): number;
  clearTimer(id: number): void;
  createContext?(sampleRate: number): AudioContextLike;
  connectWorklet?(
    context: AudioContextLike,
    onDrained: RemoteDrainHandler,
  ): Promise<AudioWorkletNodeLike | null> | AudioWorkletNodeLike | null;
}

export interface TrustedGestureLike {
  readonly isTrusted: boolean;
}

export interface AudioHostMetrics {
  readonly armed: boolean;
  readonly muted: boolean;
  readonly contextCreated: boolean;
  readonly contextState: "absent" | "suspended" | "running" | "closed";
  readonly heldTokens: number;
  readonly leaseGeneration: number;
  readonly suspended: boolean;
  readonly quantaRendered: number;
  readonly pendingTimer: boolean;
  readonly activeVoices: number;
  readonly peakHoldS16: number;
}

export class StarluxAudioHost {
  private readonly scheduler: AudioHostScheduler;
  private readonly worklet: StarluxAudioWorkletCore;
  private readonly lingerUs: number;
  private admission: AdmissionState;
  private lease: AudioLease;
  private context: AudioContextLike | null = null;
  private workletNode: AudioWorkletNodeLike | null = null;
  private workletConnecting = false;
  private readonly pendingWorkletMessages: WorkletMessage[] = [];
  private suspendTimer: number | null = null;
  private hidden = false;
  private lifecycleChain: Promise<void> = Promise.resolve();
  private originFrame = 0;

  constructor(options?: {
    readonly scheduler?: AudioHostScheduler;
    readonly lingerUs?: number;
  }) {
    this.scheduler = options?.scheduler ?? defaultBrowserScheduler();
    this.lingerUs = options?.lingerUs ?? audioLingerUs();
    this.admission = createAdmissionState();
    this.lease = createAudioLease();
    this.worklet = new StarluxAudioWorkletCore(() => {
      if (this.lease.token > 0) {
        this.handleDrained(this.scheduler.nowUs());
      }
    });
  }

  // Only a trusted user activation (event.isTrusted === true) may arm & open AudioContext.
  enableFromTrustedGesture(gesture: TrustedGestureLike, optIn = true): boolean {
    if (!gesture.isTrusted) return false;
    this.admission = armAdmissionFromGesture(this.admission, true, optIn);
    if (!optIn) {
      this.postToWorklet({ type: "mute", hostGen: this.lease.generation });
      return true;
    }
    this.postToWorklet({ type: "unmute", hostGen: this.lease.generation });
    if (this.context === null) {
      this.context = this.scheduler.createContext
        ? this.scheduler.createContext(48000)
        : createFallbackContext();
      this.attachWorkletIfSupported(this.context);
    }
    return true;
  }

  mute(): void {
    this.admission = setAdmissionMuted(this.admission, true);
    this.clearPendingTimer();
    this.lease = leaseForceSuspend(this.lease);
    const gen = this.lease.generation;
    this.postToWorklet({ type: "mute", hostGen: gen });
    this.enqueueLifecycle(async () => {
      if (this.context !== null && this.lease.generation === gen && this.context.state === "running") {
        await this.context.suspend();
      }
    });
  }

  unmute(): boolean {
    if (!this.admission.armed) return false;
    this.admission = setAdmissionMuted(this.admission, false);
    this.postToWorklet({ type: "unmute", hostGen: this.lease.generation });
    return true;
  }

  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    if (hidden) {
      this.clearPendingTimer();
      this.lease = leaseForceSuspend(this.lease);
      const gen = this.lease.generation;
      this.postToWorklet({ type: "cancel", subject: 0, epoch: 0, hostGen: gen });
      this.enqueueLifecycle(async () => {
        if (this.context !== null && this.lease.generation === gen && this.context.state === "running") {
          await this.context.suspend();
        }
      });
    }
  }

  cancel(subject: number, epoch: number): void {
    this.postToWorklet({ type: "cancel", subject, epoch, hostGen: this.lease.generation });
    if (!this.worklet.isActive() && this.lease.token > 0) {
      this.handleDrained(this.scheduler.nowUs());
    }
  }

  dispatchPlan(arena: PlanArena, rootFx: number, ctx: EffectContext): PlanEvalResult {
    const evalCtx: EffectContext = {
      ...ctx,
      audioOptIn: ctx.audioOptIn && !this.admission.muted && !this.hidden,
      sessionActivated: ctx.sessionActivated && this.admission.armed,
      muted: ctx.muted || this.admission.muted || this.hidden,
      originFrame: this.worklet.snapshot().frame,
    };
    const res = evaluatePlan(arena, rootFx, evalCtx, this.admission);
    this.admission = res.admission;
    if (res.accepted && res.audio.length > 0 && !this.hidden && !this.admission.muted && this.admission.armed) {
      this.admitCommands(res.audio);
    }
    return res;
  }

  // Direct cue submission helper (still gated by trusted gesture + mute + WakeToken).
  submitCue(
    cueId: number,
    options?: {
      readonly subject?: number;
      readonly epoch?: number;
      readonly pan?: number;
      readonly rate100?: number;
      readonly gainQ15?: number;
      readonly materialOverride?: number;
      readonly pitchCents?: number;
      readonly delayUs?: number;
      readonly seed?: number;
    },
  ): boolean {
    if (this.hidden || this.admission.muted || !this.admission.armed) return false;
    const cue = getAudioCue(cueId);
    const rate = clampRate100(options?.rate100 ?? 100);
    const baseFrame = wrapU32(this.worklet.snapshot().frame + usToFrames(options?.delayUs ?? 0));
    const cmds: AudioCommand[] = [];
    for (let i = 0; i < cue.hits.length; i++) {
      const hit = cue.hits[i];
      if (hit === undefined) break;
      cmds.push({
        atFrame: wrapU32(baseFrame + scaleOffsetByRate(hit.startFrames, rate)),
        seq: this.originFrame + 1,
        hitIndex: i,
        subject: options?.subject ?? 1,
        epoch: options?.epoch ?? 1,
        seed: options?.seed ?? 7,
        cueId: cue.id,
        gainQ15: options?.gainQ15 ?? 32768,
        pan: options?.pan ?? 0,
        rate100: rate,
        materialOverride: options?.materialOverride ?? -1,
        pitchCents: options?.pitchCents ?? 0,
        op: 0,
      });
    }
    this.originFrame += 1;
    this.admitCommands(cmds);
    return true;
  }

  // Pump one 128-frame audio quantum (used by AudioWorklet or deterministic headless tests).
  // Refuses to invoke owned DSP when AudioContext is absent or suspended (zero idle DSP law).
  pumpQuantum(outLeft: Float32Array, outRight: Float32Array, frames = 128): number {
    if (this.context === null || this.lease.suspended || this.context.state !== "running") {
      outLeft.fill(0, 0, Math.min(frames, outLeft.length));
      outRight.fill(0, 0, Math.min(frames, outRight.length));
      return 0;
    }
    const active = this.worklet.processQuantum(outLeft, outRight, frames);
    if (!this.worklet.isActive() && this.lease.token > 0) {
      this.handleDrained(this.scheduler.nowUs());
    }
    return active;
  }

  flushLifecycle(): Promise<void> {
    return this.lifecycleChain;
  }

  idleSample(): IdleSample {
    const snap = this.worklet.snapshot();
    return {
      clockTicks: snap.quantaRendered,
      hostRafCount: snap.quantaRendered,
      heldTokens: heldWakeTokens(this.lease.clock),
    };
  }

  falsifyIdle(before: IdleSample, elapsedUs: number): IdleFalsifier {
    return falsifyIdle(before, this.idleSample(), elapsedUs);
  }

  metrics(): AudioHostMetrics {
    const snap = this.worklet.snapshot();
    let activeVoices = 0;
    for (const v of snap.voices) {
      if (v.state !== 0) activeVoices += 1;
    }
    return {
      armed: this.admission.armed,
      muted: this.admission.muted,
      contextCreated: this.context !== null,
      contextState: this.context === null ? "absent" : this.context.state,
      heldTokens: heldWakeTokens(this.lease.clock),
      leaseGeneration: this.lease.generation,
      suspended: this.lease.suspended,
      quantaRendered: snap.quantaRendered,
      pendingTimer: this.suspendTimer !== null,
      activeVoices,
      peakHoldS16: snap.peakHoldS16,
    };
  }

  dispose(): void {
    this.clearPendingTimer();
    this.lease = leaseForceSuspend(this.lease);
    this.pendingWorkletMessages.length = 0;
    const node = this.workletNode;
    this.workletNode = null;
    this.workletConnecting = false;
    if (node !== null) {
      node.port.onmessage = null;
      node.disconnect?.();
    }
    const ctx = this.context;
    this.context = null;
    if (ctx !== null && ctx.state !== "closed") {
      void ctx.close();
    }
  }

  private admitCommands(commands: readonly AudioCommand[]): void {
    if (commands.length === 0) return;
    const nextGen = this.lease.generation + 1;
    const origin = this.worklet.snapshot().frame;
    for (const cmd of commands) {
      const rel = Math.max(0, frameDiff(cmd.atFrame, origin));
      this.postToWorklet({ type: "cmd", command: cmd, relativeFrames: rel, hostGen: nextGen });
    }
    // If every submitted command was rejected/dropped and nothing is active, do not leak WakeToken or AudioContext!
    if (!this.worklet.isActive()) {
      if (this.lease.token > 0) {
        this.handleDrained(this.scheduler.nowUs());
      }
      return;
    }
    this.clearPendingTimer();
    this.lease = leaseOnAdmit(this.lease);
    const gen = this.lease.generation;
    this.enqueueLifecycle(async () => {
      if (this.context !== null && this.lease.generation === gen && !this.lease.suspended && this.context.state === "suspended") {
        await this.context.resume();
      }
    });
  }

  private postToWorklet(msg: WorkletMessage): void {
    this.worklet.postMessage(msg);
    if (this.workletNode !== null) {
      this.workletNode.port.postMessage(msg);
    } else if (this.workletConnecting) {
      this.pendingWorkletMessages.push(msg);
    }
  }

  private attachWorkletIfSupported(ctx: AudioContextLike): void {
    if (this.scheduler.connectWorklet === undefined) return;
    if (ctx.audioWorklet === undefined && ctx.destination === undefined) return;
    this.workletConnecting = true;
    const connectFn = this.scheduler.connectWorklet;
    this.enqueueLifecycle(async () => {
      try {
        const node = await connectFn(ctx, (quanta, hostGen) => {
          this.handleRemoteDrained(quanta, hostGen);
        });
        if (node !== null && this.context === ctx) {
          this.workletNode = node;
          for (const msg of this.pendingWorkletMessages) {
            node.port.postMessage(msg);
          }
        }
      } finally {
        this.workletConnecting = false;
        this.pendingWorkletMessages.length = 0;
      }
    });
  }

  private handleRemoteDrained(quantaRendered?: number, hostGen?: number): void {
    if (hostGen !== undefined && hostGen !== this.lease.generation) {
      return;
    }
    this.worklet.syncRemoteDrain(quantaRendered ?? 0);
    if (this.lease.token > 0) {
      this.handleDrained(this.scheduler.nowUs());
    }
  }

  private handleDrained(nowUs: number): void {
    this.lease = leaseOnDrained(this.lease, nowUs, this.lingerUs);
    const gen = this.lease.generation;
    this.clearPendingTimer();
    const delayMs = Math.max(0, Math.round(this.lingerUs / 1000));
    this.suspendTimer = this.scheduler.setTimer(delayMs, () => {
      this.suspendTimer = null;
      if (!leaseMaySuspend(this.lease, this.scheduler.nowUs())) return;
      if (this.lease.generation !== gen) return;
      this.lease = leaseSuspend(this.lease, gen);
      this.enqueueLifecycle(async () => {
        if (this.context !== null && this.lease.generation === gen && this.lease.suspended && this.context.state === "running") {
          await this.context.suspend();
        }
      });
    });
  }

  private clearPendingTimer(): void {
    if (this.suspendTimer !== null) {
      this.scheduler.clearTimer(this.suspendTimer);
      this.suspendTimer = null;
    }
  }

  private enqueueLifecycle(step: () => Promise<void>): void {
    this.lifecycleChain = this.lifecycleChain.then(step, step);
  }
}

export function defaultBrowserScheduler(): AudioHostScheduler {
  return {
    nowUs: () => Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) * 1000),
    setTimer: (delayMs, cb) => Number(setTimeout(cb, delayMs)),
    clearTimer: (id) => { clearTimeout(id); },
    createContext: (sampleRate) => {
      const Ctor = (globalThis as unknown as {
        AudioContext?: new (opts: { sampleRate: number; latencyHint: string }) => AudioContextLike;
      }).AudioContext;
      if (typeof Ctor === "function") {
        return new Ctor({ sampleRate, latencyHint: "interactive" });
      }
      return createFallbackContext();
    },
    connectWorklet: async (ctx, onDrained) => {
      const NodeCtor = (globalThis as unknown as {
        AudioWorkletNode?: new (
          context: AudioContextLike,
          name: string,
          options?: {
            readonly numberOfInputs?: number;
            readonly numberOfOutputs?: number;
            readonly outputChannelCount?: readonly number[];
          },
        ) => AudioWorkletNodeLike;
      }).AudioWorkletNode;
      if (
        ctx.audioWorklet === undefined ||
        ctx.destination === undefined ||
        typeof NodeCtor !== "function"
      ) {
        return null;
      }
      const moduleRel = import.meta.url.endsWith(".ts")
        ? "./processor-entry.ts"
        : "./processor-entry.js";
      await ctx.audioWorklet.addModule(new URL(moduleRel, import.meta.url).href);
      const node = new NodeCtor(ctx, "starlux-audio-processor", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });
      node.port.onmessage = (ev) => {
        const payload = ev?.data as {
          readonly type?: string;
          readonly quanta?: number;
          readonly hostGen?: number;
        } | null | undefined;
        if (payload !== null && payload !== undefined && payload.type === "drained") {
          onDrained(payload.quanta, payload.hostGen);
        }
      };
      node.connect(ctx.destination);
      return node;
    },
  };
}

function createFallbackContext(): AudioContextLike {
  let state: "suspended" | "running" | "closed" = "suspended";
  return {
    get state() { return state; },
    sampleRate: 48000,
    async resume() { if (state === "suspended") state = "running"; },
    async suspend() { if (state === "running") state = "suspended"; },
    async close() { state = "closed"; },
  };
}
