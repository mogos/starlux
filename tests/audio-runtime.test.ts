import { describe, expect, test } from "bun:test";
import {
  type AudioContextLike,
  type AudioHostScheduler,
  type AudioWorkletNodeLike,
  type EffectContext,
  StarluxAudioHost,
  audioCeilingS16,
  buildButtonPressRecipe,
  buildButtonReleaseRecipe,
  buildComboboxSelectRecipe,
  buildMagneticSnapRecipe,
  buildMinimizeDockRecipe,
  buildStarDoneRecipe,
  computeFresnelLamp,
  createAdmissionState,
  createPlanArena,
  createRenderState,
  createStarluxAudioWorkletProcessor,
  cueIdBySlug,
  defaultBrowserScheduler,
  evaluatePlan,
  getAudioCue,
  hapticFx,
  layer,
  audioSlugFx,
  panFromRect,
  renderBlock,
  scaleOffsetByRate,
  sequence,
  stagger,
  submitCueCommands,
  wrapStandardPolicy,
} from "../src/audio/index.ts";

function createFakeScheduler() {
  let now = 0;
  let nextTimerId = 1;
  const timers = new Map<number, { atUs: number; cb: () => void }>();
  let contextsCreated = 0;
  let ctxState: "suspended" | "running" | "closed" = "suspended";
  let resumeCalls = 0;
  let suspendCalls = 0;

  const scheduler: AudioHostScheduler = {
    nowUs: () => now,
    setTimer(delayMs, cb) {
      const id = nextTimerId++;
      timers.set(id, { atUs: now + delayMs * 1000, cb });
      return id;
    },
    clearTimer(id) {
      timers.delete(id);
    },
    createContext(sampleRate): AudioContextLike {
      expect(sampleRate).toBe(48000);
      contextsCreated += 1;
      ctxState = "suspended";
      return {
        get state() { return ctxState; },
        sampleRate,
        async resume() { resumeCalls += 1; if (ctxState === "suspended") ctxState = "running"; },
        async suspend() { suspendCalls += 1; if (ctxState === "running") ctxState = "suspended"; },
        async close() { ctxState = "closed"; },
      };
    },
  };

  function advanceMs(ms: number) {
    now += ms * 1000;
    for (const [id, t] of [...timers.entries()]) {
      if (t.atUs <= now) {
        timers.delete(id);
        t.cb();
      }
    }
  }

  return {
    scheduler,
    advanceMs,
    get contextsCreated() { return contextsCreated; },
    get resumeCalls() { return resumeCalls; },
    get suspendCalls() { return suspendCalls; },
    get timerCount() { return timers.size; },
  };
}

function makeCtx(overrides?: Partial<EffectContext>): EffectContext {
  return {
    event: { kind: "IMPULSE", timeUs: 1000000, intensity: 0.8, subject: 10 },
    transition: "down",
    serial: 1,
    epoch: 1,
    rect: { x: 100, y: 100, w: 120, h: 48 },
    viewport: { x: 0, y: 0, w: 1440, h: 900 },
    vxPxS: 600,
    vyPxS: 0,
    material: 0,
    rate100: 100,
    thermalTier: 0,
    motionPolicy: 0,
    audioOptIn: true,
    sessionActivated: true,
    muted: false,
    hapticOptIn: true,
    hapticAvailable: true,
    functionalAudio: true,
    originFrame: 0,
    seed: 7,
    ...overrides,
  };
}

describe("@mogos/starlux/audio Web Host, WakeToken 0-idle, and Composable Algebra", () => {
  test("Floor A07 & A08: muted by default, trusted gesture gated, 1.6s auto-suspend, 10s 0-idle falsifier", async () => {
    const fake = createFakeScheduler();
    const host = new StarluxAudioHost({ scheduler: fake.scheduler, lingerUs: 1600000 });

    // Before gesture: muted, unarmed, 0 contexts, untrusted click rejected
    expect(host.metrics().muted).toBe(true);
    expect(host.metrics().armed).toBe(false);
    expect(host.metrics().contextCreated).toBe(false);
    expect(host.enableFromTrustedGesture({ isTrusted: false }, true)).toBe(false);
    expect(fake.contextsCreated).toBe(0);
    expect(host.submitCue(cueIdBySlug("control.press"))).toBe(false);
    expect(host.metrics().heldTokens).toBe(0);

    // Trusted activation creates 48 kHz context & arms admission
    expect(host.enableFromTrustedGesture({ isTrusted: true }, true)).toBe(true);
    expect(fake.contextsCreated).toBe(1);
    expect(host.metrics().armed).toBe(true);
    expect(host.metrics().muted).toBe(false);

    // Admit cue -> acquires 1 WakeToken, resumes context
    expect(host.submitCue(cueIdBySlug("control.hover"))).toBe(true);
    await host.flushLifecycle();
    expect(host.metrics().heldTokens).toBe(1);
    expect(host.metrics().contextState).toBe("running");

    // Pump until drained (control.hover is 50 ms = 2400 frames ~ 19 quanta)
    const l = new Float32Array(128);
    const r = new Float32Array(128);
    let sawSound = false;
    for (let q = 0; q < 40; q++) {
      host.pumpQuantum(l, r, 128);
      for (let i = 0; i < 128; i++) {
        if (l[i] !== 0 || r[i] !== 0) sawSound = true;
      }
      if (host.metrics().heldTokens === 0) break;
    }
    expect(sawSound).toBe(true);
    expect(host.metrics().heldTokens).toBe(0);
    expect(host.metrics().pendingTimer).toBe(true);

    // Before 1600 ms linger expires, context stays warm
    fake.advanceMs(1500);
    await host.flushLifecycle();
    expect(host.metrics().contextState).toBe("running");

    // At 1600 ms, context suspends cleanly
    fake.advanceMs(100);
    await host.flushLifecycle();
    expect(host.metrics().contextState).toBe("suspended");
    expect(host.metrics().suspended).toBe(true);
    expect(fake.timerCount).toBe(0);

    // Genuine 10-second idle observation via @mogos/starlux falsifyIdle
    const beforeIdle = host.idleSample();
    fake.advanceMs(10000);
    // Calling pumpQuantum while suspended performs ZERO owned DSP quanta!
    host.pumpQuantum(l, r, 128);
    const verdict = host.falsifyIdle(beforeIdle, 10_000_000);
    expect(verdict.passed).toBe(true);
    expect(verdict.clockTicks).toBe(0);
    expect(verdict.hostRafCount).toBe(0);
    expect(verdict.heldTokens).toBe(0);
    host.dispose();
  });

  test("Floor A18: new admission during 1.6s linger cancels suspend and stale generation cannot suspend it", async () => {
    const fake = createFakeScheduler();
    const host = new StarluxAudioHost({ scheduler: fake.scheduler, lingerUs: 1600000 });
    host.enableFromTrustedGesture({ isTrusted: true }, true);

    host.submitCue(cueIdBySlug("control.hover"));
    await host.flushLifecycle();
    const l = new Float32Array(128);
    const r = new Float32Array(128);
    for (let q = 0; q < 30 && host.metrics().heldTokens > 0; q++) host.pumpQuantum(l, r, 128);
    expect(host.metrics().pendingTimer).toBe(true);

    // 1000 ms later, new cue arrives -> cancels linger timer and keeps context running!
    fake.advanceMs(1000);
    host.submitCue(cueIdBySlug("control.press"));
    await host.flushLifecycle();
    expect(host.metrics().pendingTimer).toBe(false);
    expect(host.metrics().heldTokens).toBe(1);
    fake.advanceMs(800);
    await host.flushLifecycle();
    expect(host.metrics().contextState).toBe("running");
    host.dispose();
  });

  test("Floor A09, P14, A14, A15, A16, M01: cooldowns, dedupe, haptics cap, reduced motion, Fresnel lamp", () => {
    // M01 Fresnel lamp exact math
    const f0 = computeFresnelLamp(0);
    expect(Math.abs(f0.fresnelR - 0.04)).toBeLessThan(0.0001);
    const f430 = computeFresnelLamp(430);
    expect(Math.abs(f430.attenuation - 0.5)).toBeLessThan(0.0001);

    // Cross-subject hover cooldown (70 ms across 40 neighboring subjects)
    const a0 = createPlanArena();
    const hFx = audioSlugFx(a0, "control.hover");
    const plan = wrapStandardPolicy(hFx.arena, hFx.fx);
    const fake = createFakeScheduler();
    const host = new StarluxAudioHost({ scheduler: fake.scheduler });
    host.enableFromTrustedGesture({ isTrusted: true }, true);

    const acceptedTimesMs: number[] = [];
    for (let i = 0; i < 40; i++) {
      const tUs = i * 5000; // every 5 ms across distinct subjects
      const res = host.dispatchPlan(plan.arena, plan.fx, makeCtx({
        event: { kind: "IMPULSE", timeUs: tUs, intensity: 0.5, subject: 100 + i },
        serial: i + 1,
      }));
      if (res.audio.length > 0) acceptedTimesMs.push(tUs / 1000);
    }
    expect(acceptedTimesMs.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < acceptedTimesMs.length; i++) {
      expect(acceptedTimesMs[i]! - acceptedTimesMs[i - 1]!).toBeGreaterThanOrEqual(70);
    }

    // Duplicate serial suppression (Floor P14)
    const btn = buildButtonPressRecipe();
    const first = host.dispatchPlan(btn.arena, btn.fx, makeCtx({
      event: { kind: "IMPULSE", timeUs: 5000000, intensity: 0.8, subject: 500 },
      serial: 99,
      epoch: 3,
    }));
    expect(first.audio.length).toBe(1);
    const dup = host.dispatchPlan(btn.arena, btn.fx, makeCtx({
      event: { kind: "IMPULSE", timeUs: 5200000, intensity: 0.8, subject: 500 },
      serial: 99,
      epoch: 3,
    }));
    expect(dup.audio.length).toBe(0);

    // Reduced motion attenuates functional audio <= 0.5 and suppresses haptics & kinetic cues
    const reducedBtn = host.dispatchPlan(btn.arena, btn.fx, makeCtx({
      event: { kind: "IMPULSE", timeUs: 6000000, intensity: 0.8, subject: 501 },
      serial: 100,
      motionPolicy: 1,
      functionalAudio: true,
    }));
    expect(reducedBtn.haptics.length).toBe(0);
    expect(reducedBtn.audio.length).toBe(1);
    expect(reducedBtn.audio[0]!.gainQ15).toBeLessThanOrEqual(16384);

    // Kinetic hover is strictly silent under reduced motion
    const reducedHover = host.dispatchPlan(plan.arena, plan.fx, makeCtx({
      event: { kind: "IMPULSE", timeUs: 7000000, intensity: 0.5, subject: 502 },
      serial: 101,
      motionPolicy: 1,
      functionalAudio: true,
    }));
    expect(reducedHover.audio.length).toBe(0);

    // Haptic 100 ms per rolling second exposure cap (Floor A15)
    let hapArena = createPlanArena();
    const hPulse = hapticFx(hapArena, 0.7, 0.5, 35); // 35 ms max per pulse
    hapArena = hPulse.arena;
    let totalHapticUs = 0;
    for (let i = 0; i < 6; i++) {
      const r = host.dispatchPlan(hapArena, hPulse.fx, makeCtx({
        event: { kind: "IMPULSE", timeUs: 9000000 + i * 50000, intensity: 0.8, subject: 600 + i },
        serial: 200 + i,
      }));
      for (const h of r.haptics) {
        expect(h.durationUs).toBeLessThanOrEqual(35000);
        totalHapticUs += h.durationUs;
      }
    }
    expect(totalHapticUs).toBeLessThanOrEqual(100000);

    // All 5 canonical composed recipes evaluate cleanly
    const recipes = [
      buildButtonPressRecipe(),
      buildButtonReleaseRecipe(),
      buildMagneticSnapRecipe(),
      buildMinimizeDockRecipe(),
      buildComboboxSelectRecipe(),
      buildStarDoneRecipe(),
    ];
    for (let i = 0; i < recipes.length; i++) {
      const rec = recipes[i]!;
      expect(rec.arena.valid).toBe(true);
      const out = host.dispatchPlan(rec.arena, rec.fx, makeCtx({
        event: { kind: "OS_STATE_CHANGE", timeUs: 20000000 + i * 1000000, intensity: 0.8, subject: 700 + i },
        serial: 300 + i,
      }));
      expect(out.accepted).toBe(true);
      expect(out.motion.length).toBeGreaterThanOrEqual(1);
      expect(out.light.length).toBeGreaterThanOrEqual(1);
      expect(out.audio.length).toBeGreaterThanOrEqual(1);
    }

    // Stagger and sequence exact timing (Floors P16, P17)
    let sa = createPlanArena();
    const a1 = audioSlugFx(sa, "control.press");
    const a2 = audioSlugFx(a1.arena, "control.release");
    const stag = stagger(a2.arena, [a1.fx, a2.fx], 45000); // 45 ms = 2160 frames
    expect(stag.arena.valid).toBe(true);
    const sRes = evaluatePlan(stag.arena, stag.fx, makeCtx({
      event: { kind: "OS_STATE_CHANGE", timeUs: 40000000, intensity: 1, subject: 800 },
      serial: 400,
    }), { ...createAdmissionState(), armed: true, muted: false });
    expect(sRes.audio.length).toBe(2);
    expect(sRes.audio[1]!.atFrame - sRes.audio[0]!.atFrame).toBe(2160);

    // 6-voice pool stress overload: peak <= 23197, maxSimultaneous <= 6, oldest-steal engages
    let st = createRenderState();
    const loudCue = getAudioCue(cueIdBySlug("notify.fatal"));
    for (let i = 0; i < 12; i++) {
      st = submitCueCommands(st, loudCue, i * 4, i + 1, 1, 7 + i, 32768, 0, 100, -1, 0);
    }
    for (let b = 0; b < 4; b++) {
      const blk = renderBlock(st, 256);
      st = blk.state;
      expect(blk.activeVoices).toBeLessThanOrEqual(6);
    }
    expect(st.maxSimultaneous).toBeLessThanOrEqual(6);
    expect(st.stealCount).toBeGreaterThan(0);
    expect(st.peakHoldS16).toBeLessThanOrEqual(audioCeilingS16());
    host.dispose();
  });

  test("Associativity of layer and sequence + plan depth limit rejection (Floors P15, P18)", () => {
    const base = createPlanArena();
    const c1 = audioSlugFx(base, "nav.forward");
    const c2 = audioSlugFx(c1.arena, "nav.back");
    const c3 = audioSlugFx(c2.arena, "nav.up");
    const left1 = layer(c3.arena, c1.fx, c2.fx);
    const left2 = layer(left1.arena, left1.fx, c3.fx);
    const right1 = layer(c3.arena, c2.fx, c3.fx);
    const right2 = layer(right1.arena, c1.fx, right1.fx);
    const adm = { ...createAdmissionState(), armed: true, muted: false };
    const ctx = makeCtx({ event: { kind: "OS_STATE_CHANGE", timeUs: 1000000, intensity: 1, subject: 900 }, serial: 900 });
    const eL = evaluatePlan(left2.arena, left2.fx, ctx, adm);
    const eR = evaluatePlan(right2.arena, right2.fx, ctx, adm);
    expect(eL.audio.map((x) => x.cueId)).toEqual(eR.audio.map((x) => x.cueId));

    // Exceeding depth limit (depth > 12) fails cleanly with zero leaves scheduled (Floor P18)
    let deepArena = createPlanArena();
    let cur = audioSlugFx(deepArena, "control.press");
    deepArena = cur.arena;
    for (let d = 0; d < 14; d++) {
      cur = panFromRect(deepArena, cur.fx);
      deepArena = cur.arena;
    }
    const dRes = evaluatePlan(deepArena, cur.fx, ctx, adm);
    expect(dRes.accepted).toBe(false);
    expect(dRes.audio.length).toBe(0);
    expect(dRes.reason).toBe("PLAN_LIMIT_EXCEEDED");

    // Sequence timing (Floor P16)
    const sq1 = createPlanArena();
    const sA = audioSlugFx(sq1, "control.hover");   // 50 ms
    const sB = audioSlugFx(sA.arena, "control.press"); // 70 ms
    const seq = sequence(sB.arena, sA.fx, sB.fx);
    const seqOut = evaluatePlan(seq.arena, seq.fx, ctx, adm);
    expect(seqOut.audio.length).toBe(2);
    expect(seqOut.audio[1]!.atFrame - seqOut.audio[0]!.atFrame).toBe(2400); // 50 ms = 2400 frames
  });

  test("P0-SL3a: pre-quantum cancel() and sub-quantum drain release WakeToken and suspend AudioContext with zero leak", async () => {
    const fake = createFakeScheduler();
    const host = new StarluxAudioHost({ scheduler: fake.scheduler, lingerUs: 1600000 });
    expect(host.enableFromTrustedGesture({ isTrusted: true }, true)).toBe(true);

    // 1. Admit delayed cue, then cancel BEFORE any pumpQuantum runs
    expect(host.submitCue(cueIdBySlug("control.press"), { subject: 42, epoch: 7, delayUs: 50000 })).toBe(true);
    await host.flushLifecycle();
    expect(host.metrics().heldTokens).toBe(1);
    expect(host.metrics().contextState).toBe("running");

    host.cancel(42, 7);
    expect(host.metrics().heldTokens).toBe(0);
    expect(host.metrics().pendingTimer).toBe(true);

    fake.advanceMs(1600);
    await host.flushLifecycle();
    expect(host.metrics().contextState).toBe("suspended");
    expect(host.metrics().suspended).toBe(true);
    expect(fake.timerCount).toBe(0);

    // 2. Sub-quantum immediate drain (gainQ15: 0 finishes inside first quantum) also releases WakeToken
    expect(host.submitCue(cueIdBySlug("control.hover"), { subject: 43, epoch: 1, gainQ15: 0 })).toBe(true);
    await host.flushLifecycle();
    expect(host.metrics().heldTokens).toBe(1);
    const l = new Float32Array(128);
    const r = new Float32Array(128);
    expect(host.pumpQuantum(l, r, 128)).toBe(0);
    expect(host.metrics().heldTokens).toBe(0);
    expect(host.metrics().pendingTimer).toBe(true);
    fake.advanceMs(1600);
    await host.flushLifecycle();
    expect(host.metrics().contextState).toBe("suspended");
    host.dispose();
  });

  test("P0-SL3b: submitCue scales multi-hit startFrames by rate100 identically to submitCueCommands", async () => {
    let multiCue = getAudioCue(1);
    for (let id = 1; id <= 250; id++) {
      const c = getAudioCue(id);
      if (c.hits.length >= 2 && (c.hits[1]?.startFrames ?? 0) > 256) {
        multiCue = c;
        break;
      }
    }
    expect(multiCue.hits.length).toBeGreaterThanOrEqual(2);
    const rawOffset = multiCue.hits[1]!.startFrames;
    expect(scaleOffsetByRate(rawOffset, 200)).toBeLessThan(rawOffset);

    const fake = createFakeScheduler();
    const host = new StarluxAudioHost({ scheduler: fake.scheduler });
    host.enableFromTrustedGesture({ isTrusted: true }, true);
    expect(host.submitCue(multiCue.id, { rate100: 200, seed: 7, subject: 1, epoch: 1 })).toBe(true);
    await host.flushLifecycle();

    let refState = submitCueCommands(createRenderState(), multiCue, 0, 1, 1, 7, 32768, 0, 200, -1, 0);
    const l = new Float32Array(128);
    const r = new Float32Array(128);
    for (let q = 0; q < 48; q++) {
      host.pumpQuantum(l, r, 128);
      const blk = renderBlock(refState, 128);
      refState = blk.state;
      for (let i = 0; i < 128; i++) {
        const expL = blk.pcmS16[2 * i]! === 0 ? 0 : blk.pcmS16[2 * i]! / 32768;
        const expR = blk.pcmS16[2 * i + 1]! === 0 ? 0 : blk.pcmS16[2 * i + 1]! / 32768;
        expect(l[i]).toBe(expL);
        expect(r[i]).toBe(expR);
      }
    }
    host.dispose();
  });

  test("P0-SL3c: defaultBrowserScheduler wires AudioWorkletNode -> destination and handles { type: 'drained' } with stale-gen guard", async () => {
    const g = globalThis as unknown as Record<string, unknown>;
    const prevAudioCtx = g.AudioContext;
    const prevWorkletNode = g.AudioWorkletNode;

    let now = 0;
    let nextTimerId = 1;
    const timers = new Map<number, { atUs: number; cb: () => void }>();
    let addedModuleUrl = "";
    let connectedDest: unknown = null;
    const destinationSentinel = { kind: "hardware-speakers" };

    class FakePort {
      onmessage: ((ev: { readonly data: unknown }) => void) | null = null;
      peer: FakePort | null = null;
      postMessage(data: unknown): void {
        const target = this.peer;
        if (target !== null && target.onmessage !== null) {
          target.onmessage({ data });
        }
      }
    }

    class FakeProcessorBase {
      readonly port = new FakePort();
    }
    const ProcessorCtor = createStarluxAudioWorkletProcessor(FakeProcessorBase as unknown as new () => { port: { onmessage: ((ev: { readonly data: never }) => void) | null; postMessage(d: unknown): void } });
    let liveProcessor: InstanceType<typeof ProcessorCtor> | null = null;
    let mainPortRef: FakePort | null = null;

    class MockAudioContext implements AudioContextLike {
      state: "suspended" | "running" | "closed" = "suspended";
      readonly sampleRate: number;
      readonly destination = destinationSentinel;
      readonly audioWorklet = {
        async addModule(url: string): Promise<void> {
          addedModuleUrl = url;
        },
      };
      constructor(opts: { sampleRate: number }) {
        this.sampleRate = opts.sampleRate;
      }
      async resume(): Promise<void> { if (this.state === "suspended") this.state = "running"; }
      async suspend(): Promise<void> { if (this.state === "running") this.state = "suspended"; }
      async close(): Promise<void> { this.state = "closed"; }
    }

    class MockAudioWorkletNode implements AudioWorkletNodeLike {
      readonly port = new FakePort();
      constructor(_ctx: AudioContextLike, name: string) {
        expect(name).toBe("starlux-audio-processor");
        const proc = new ProcessorCtor();
        const procPort = proc.port as unknown as FakePort;
        this.port.peer = procPort;
        procPort.peer = this.port;
        liveProcessor = proc;
        mainPortRef = procPort;
      }
      connect(dest: unknown): unknown {
        connectedDest = dest;
        return dest;
      }
      disconnect(): void {
        connectedDest = null;
      }
    }

    g.AudioContext = MockAudioContext;
    g.AudioWorkletNode = MockAudioWorkletNode;
    try {
      const browserSched = defaultBrowserScheduler();
      const scheduler: AudioHostScheduler = {
        ...browserSched,
        nowUs: () => now,
        setTimer(delayMs, cb) {
          const id = nextTimerId++;
          timers.set(id, { atUs: now + delayMs * 1000, cb });
          return id;
        },
        clearTimer(id) { timers.delete(id); },
      };
      const host = new StarluxAudioHost({ scheduler, lingerUs: 1600000 });
      expect(host.enableFromTrustedGesture({ isTrusted: true }, true)).toBe(true);
      expect(host.submitCue(cueIdBySlug("control.hover"))).toBe(true);
      await host.flushLifecycle();

      expect(addedModuleUrl.includes("processor-entry.")).toBe(true);
      expect(connectedDest).toBe(destinationSentinel);
      expect(liveProcessor).not.toBeNull();
      expect(host.metrics().heldTokens).toBe(1);
      expect(host.metrics().contextState).toBe("running");

      // Drive the AudioWorkletProcessor audio thread directly (never calling host.pumpQuantum!)
      const left = new Float32Array(128);
      const right = new Float32Array(128);
      let sawAudio = false;
      for (let q = 0; q < 40 && host.metrics().heldTokens > 0; q++) {
        liveProcessor!.process([], [[left, right]]);
        for (let i = 0; i < 128; i++) {
          if (left[i] !== 0 || right[i] !== 0) sawAudio = true;
        }
      }
      expect(sawAudio).toBe(true);
      expect(host.metrics().heldTokens).toBe(0);
      expect(host.metrics().pendingTimer).toBe(true);

      // Admit a second cue (generation 2), then inject a stale generation-1 drained message: must NOT release!
      expect(host.submitCue(cueIdBySlug("control.press"))).toBe(true);
      await host.flushLifecycle();
      expect(host.metrics().heldTokens).toBe(1);
      const gen2 = host.metrics().leaseGeneration;
      mainPortRef!.postMessage({ type: "drained", active: 0, quanta: 20, hostGen: gen2 - 1 });
      expect(host.metrics().heldTokens).toBe(1);

      // Drain generation 2 cleanly and verify 1.6s auto-suspend
      for (let q = 0; q < 40 && host.metrics().heldTokens > 0; q++) {
        liveProcessor!.process([], [[left, right]]);
      }
      expect(host.metrics().heldTokens).toBe(0);
      now += 1600000;
      for (const [id, t] of [...timers.entries()]) {
        if (t.atUs <= now) {
          timers.delete(id);
          t.cb();
        }
      }
      await host.flushLifecycle();
      expect(host.metrics().contextState).toBe("suspended");
      host.dispose();
    } finally {
      if (prevAudioCtx === undefined) delete g.AudioContext;
      else g.AudioContext = prevAudioCtx;
      if (prevWorkletNode === undefined) delete g.AudioWorkletNode;
      else g.AudioWorkletNode = prevWorkletNode;
    }
  });
});
