// Gesture-gated, WakeToken-governed Web Audio Host for @mogos/starlux/audio.
// Guarantees:
//   - Muted by default; zero AudioContext creation before a trusted user gesture (event.isTrusted === true).
//   - Acquires ONE @mogos/starlux WakeToken on admitted audio work; releases immediately when drained.
//   - Arms ONE generation-tagged 1600 ms warm-context linger timer, then suspends AudioContext cleanly.
//   - Serializes resume/suspend with generation guards so stale promises cannot suspend fresh audio.
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
  createAdmissionState,
  createAudioLease,
  evaluatePlan,
  getAudioCue,
  leaseForceSuspend,
  leaseMaySuspend,
  leaseOnAdmit,
  leaseOnDrained,
  leaseSuspend,
  setAdmissionMuted,
  usToFrames,
} from "../../../ss/audio/index.ss.ts";
import { falsifyIdle, type IdleFalsifier, type IdleSample } from "../../../ss/lux/idle.ss.ts";
import { heldWakeTokens } from "../../../ss/lux/wake.ss.ts";
import { StarluxAudioWorkletCore } from "./worklet.ts";

export interface AudioContextLike {
  readonly state: "suspended" | "running" | "closed";
  readonly sampleRate: number;
  resume(): Promise<void>;
  suspend(): Promise<void>;
  close(): Promise<void>;
}

export interface AudioHostScheduler {
  nowUs(): number;
  setTimer(delayMs: number, cb: () => void): number;
  clearTimer(id: number): void;
  createContext?(sampleRate: number): AudioContextLike;
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
      this.handleDrained(this.scheduler.nowUs());
    });
  }

  // Only a trusted user activation (event.isTrusted === true) may arm & open AudioContext.
  enableFromTrustedGesture(gesture: TrustedGestureLike, optIn = true): boolean {
    if (!gesture.isTrusted) return false;
    this.admission = armAdmissionFromGesture(this.admission, true, optIn);
    if (!optIn) {
      this.worklet.postMessage({ type: "mute" });
      return true;
    }
    this.worklet.postMessage({ type: "unmute" });
    if (this.context === null) {
      this.context = this.scheduler.createContext
        ? this.scheduler.createContext(48000)
        : createFallbackContext();
    }
    return true;
  }

  mute(): void {
    this.admission = setAdmissionMuted(this.admission, true);
    this.worklet.postMessage({ type: "mute" });
    this.clearPendingTimer();
    this.lease = leaseForceSuspend(this.lease);
    const gen = this.lease.generation;
    this.enqueueLifecycle(async () => {
      if (this.context !== null && this.lease.generation === gen && this.context.state === "running") {
        await this.context.suspend();
      }
    });
  }

  unmute(): boolean {
    if (!this.admission.armed) return false;
    this.admission = setAdmissionMuted(this.admission, false);
    this.worklet.postMessage({ type: "unmute" });
    return true;
  }

  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    if (hidden) {
      this.worklet.postMessage({ type: "cancel", subject: 0, epoch: 0 });
      this.clearPendingTimer();
      this.lease = leaseForceSuspend(this.lease);
      const gen = this.lease.generation;
      this.enqueueLifecycle(async () => {
        if (this.context !== null && this.lease.generation === gen && this.context.state === "running") {
          await this.context.suspend();
        }
      });
    }
  }

  cancel(subject: number, epoch: number): void {
    this.worklet.postMessage({ type: "cancel", subject, epoch });
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
    const baseFrame = this.worklet.snapshot().frame + usToFrames(options?.delayUs ?? 0);
    const cmds: AudioCommand[] = [];
    for (let i = 0; i < cue.hits.length; i++) {
      const hit = cue.hits[i];
      if (hit === undefined) break;
      cmds.push({
        atFrame: baseFrame + hit.startFrames,
        seq: this.originFrame + 1,
        hitIndex: i,
        subject: options?.subject ?? 1,
        epoch: options?.epoch ?? 1,
        seed: options?.seed ?? 7,
        cueId: cue.id,
        gainQ15: options?.gainQ15 ?? 32768,
        pan: options?.pan ?? 0,
        rate100: options?.rate100 ?? 100,
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
    return this.worklet.processQuantum(outLeft, outRight, frames);
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
    const ctx = this.context;
    this.context = null;
    if (ctx !== null && ctx.state !== "closed") {
      void ctx.close();
    }
  }

  private admitCommands(commands: readonly AudioCommand[]): void {
    this.clearPendingTimer();
    this.lease = leaseOnAdmit(this.lease);
    const gen = this.lease.generation;
    for (const cmd of commands) {
      this.worklet.postMessage({ type: "cmd", command: cmd });
    }
    this.enqueueLifecycle(async () => {
      if (this.context !== null && this.lease.generation === gen && !this.lease.suspended && this.context.state === "suspended") {
        await this.context.resume();
      }
    });
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

function defaultBrowserScheduler(): AudioHostScheduler {
  return {
    nowUs: () => Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) * 1000),
    setTimer: (delayMs, cb) => Number(setTimeout(cb, delayMs)),
    clearTimer: (id) => { clearTimeout(id); },
    createContext: (sampleRate) => {
      const Ctor = (globalThis as unknown as { AudioContext?: new (opts: { sampleRate: number; latencyHint: string }) => AudioContextLike }).AudioContext;
      if (typeof Ctor === "function") {
        return new Ctor({ sampleRate, latencyHint: "interactive" });
      }
      return createFallbackContext();
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
