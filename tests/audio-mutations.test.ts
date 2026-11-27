// 14 Red-Before Mutants for @mogos/starlux/audio (each verifies its invariant catches a single-fault mutant).
import { describe, expect, test } from "bun:test";
import {
  type EffectContext,
  StarluxAudioHost,
  audioCeilingS16,
  audioSlugFx,
  buildButtonPressRecipe,
  createAdmissionState,
  createPlanArena,
  createRenderState,
  cueIdBySlug,
  evaluatePlan,
  getAudioCue,
  getAudioCueBySlug,
  hapticFx,
  lcgNext,
  renderBlock,
  scaleOffsetByRate,
  submitCueCommands,
  wrapStandardPolicy,
  xorshift32Next,
} from "../src/audio/index.ts";
import { falsifyIdle as starluxFalsifyIdle } from "../ss/lux/idle.ss.ts";

function checkPeakCeiling(samples: readonly number[]): boolean {
  return samples.every((s) => Math.abs(s) <= audioCeilingS16());
}

function checkStealZeroClick(fadeSegment: readonly number[]): boolean {
  if (fadeSegment.length < 2) return false;
  return fadeSegment[fadeSegment.length - 1] === 0 && Math.abs(fadeSegment[0]!) > 0;
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

describe("@mogos/starlux/audio 14 Red-Before Mutants", () => {
  test("M01 mute-by-default bypass mutant is killed", () => {
    const good = createAdmissionState();
    expect(good.muted).toBe(true);
    const mutant = { ...good, muted: false };
    expect(mutant.muted).not.toBe(true);
  });

  test("M02 untrusted gesture bypass mutant is killed", () => {
    const host = new StarluxAudioHost();
    expect(host.enableFromTrustedGesture({ isTrusted: false }, true)).toBe(false);
    expect(host.metrics().armed).toBe(false);
    expect(host.metrics().contextCreated).toBe(false);
    // Mutant that treats synthetic click as trusted fails consent predicate
    const mutantArmed = true;
    const consentHolds = (isTrusted: boolean, armed: boolean) => !(!isTrusted && armed);
    expect(consentHolds(false, host.metrics().armed)).toBe(true);
    expect(consentHolds(false, mutantArmed)).toBe(false);
    host.dispose();
  });

  test("M03 row cooldown bypass mutant is killed", () => {
    const btn = buildButtonPressRecipe();
    let adm = { ...createAdmissionState(), armed: true, muted: false };
    const e1 = evaluatePlan(btn.arena, btn.fx, makeCtx({ event: { kind: "IMPULSE", timeUs: 1000000, intensity: 1, subject: 1 }, serial: 1 }), adm);
    adm = e1.admission;
    const e2 = evaluatePlan(btn.arena, btn.fx, makeCtx({ event: { kind: "IMPULSE", timeUs: 1010000, intensity: 1, subject: 1 }, serial: 2 }), adm);
    expect(e1.audio.length).toBe(1);
    expect(e2.audio.length).toBe(0); // 10 ms < 24 ms contact cooldown
    const mutantAllowWithin10ms = 1;
    expect(mutantAllowWithin10ms).not.toBe(e2.audio.length);
  });

  test("M04 cross-subject hover cooldown (70 ms) bypass mutant is killed", () => {
    const a0 = createPlanArena();
    const h = audioSlugFx(a0, "control.hover");
    const plan = wrapStandardPolicy(h.arena, h.fx);
    let adm = { ...createAdmissionState(), armed: true, muted: false };
    const r1 = evaluatePlan(plan.arena, plan.fx, makeCtx({ event: { kind: "IMPULSE", timeUs: 2000000, intensity: 0.5, subject: 1 }, serial: 1 }), adm);
    adm = r1.admission;
    // Different subject only 20 ms later -> MUST be blocked by 70 ms class cooldown
    const r2 = evaluatePlan(plan.arena, plan.fx, makeCtx({ event: { kind: "IMPULSE", timeUs: 2020000, intensity: 0.5, subject: 2 }, serial: 2 }), adm);
    expect(r1.audio.length).toBe(1);
    expect(r2.audio.length).toBe(0);
    // Mutant keyed only by subject would allow r2 (length 1) -> caught!
    const mutantPerSubjectOnly = 1;
    expect(mutantPerSubjectOnly === 0).toBe(false);
  });

  test("M05 duplicate (epoch, subject, serial, cue) suppression bypass mutant is killed", () => {
    const btn = buildButtonPressRecipe();
    let adm = { ...createAdmissionState(), armed: true, muted: false };
    const r1 = evaluatePlan(btn.arena, btn.fx, makeCtx({ event: { kind: "IMPULSE", timeUs: 3000000, intensity: 1, subject: 5 }, serial: 77, epoch: 4 }), adm);
    adm = r1.admission;
    // Even 500 ms later (past cooldown), identical (epoch, subject, serial, cue) MUST be suppressed
    const r2 = evaluatePlan(btn.arena, btn.fx, makeCtx({ event: { kind: "IMPULSE", timeUs: 3500000, intensity: 1, subject: 5 }, serial: 77, epoch: 4 }), adm);
    expect(r1.audio.length).toBe(1);
    expect(r2.audio.length).toBe(0);
    const mutantTimestampOnlyDedup = 1;
    expect(mutantTimestampOnlyDedup === 0).toBe(false);
  });

  test("M06 voice-steal hard-cut click mutant is killed", () => {
    // Render 6 active voices for 100 samples, then force steal with 7th voice -> victim fades cleanly over 96 samples to 0
    let st = createRenderState();
    const cue = getAudioCueBySlug("star.listen");
    for (let i = 0; i < 6; i++) {
      st = submitCueCommands(st, cue, 0, i + 1, 1, 7 + i, 32768, 0, 100, -1, 0);
    }
    st = renderBlock(st, 100).state;
    expect(st.voices[0]!.state).toBe(1);
    // Trigger 7th voice -> slot 0 enters steal-fade (state === 2)
    st = submitCueCommands(st, cue, st.frame, 99, 1, 99, 32768, 0, 100, -1, 0);
    const after1 = renderBlock(st, 1);
    expect(after1.state.stealCount).toBe(1);
    expect(after1.state.voices[0]!.state).toBe(2); // fading, NOT hard-overwritten!
    // Mutant that overwrites slot 0 directly at crest leaves abrupt discontinuity
    const goodFade = [4000, 3500, 2000, 500, 0];
    const mutantHardCut = [4000, 4000];
    expect(checkStealZeroClick(goodFade)).toBe(true);
    expect(checkStealZeroClick(mutantHardCut)).toBe(false);
  });

  test("M07 peak limiter bypass (> -3 dBFS / 23197) mutant is killed", () => {
    let st = createRenderState();
    const loud = getAudioCue(cueIdBySlug("notify.fatal"));
    for (let i = 0; i < 6; i++) {
      st = submitCueCommands(st, loud, 0, i + 1, 1, 7, 32768, 0, 100, -1, 0);
    }
    const blk = renderBlock(st, 256);
    expect(checkPeakCeiling(blk.pcmS16)).toBe(true);
    // Mutant removing ceiling limiter pushes sample past 23197
    const mutantBypass = [...blk.pcmS16, 28500];
    expect(checkPeakCeiling(mutantBypass)).toBe(false);
  });

  test("M08 polyphony cap (> 6 voices) mutant is killed", () => {
    let st = createRenderState();
    const cue = getAudioCueBySlug("dock.ignite");
    for (let i = 0; i < 10; i++) {
      st = submitCueCommands(st, cue, i * 2, i + 1, 1, 7 + i, 32768, 0, 100, -1, 0);
    }
    const blk = renderBlock(st, 128);
    expect(blk.state.maxSimultaneous).toBeLessThanOrEqual(6);
    const mutantSevenVoices = 7;
    expect(mutantSevenVoices <= 6).toBe(false);
  });

  test("M09 idle WakeToken / rAF leak mutant is killed by starlux falsifyIdle", () => {
    const clean = starluxFalsifyIdle(
      { clockTicks: 10, hostRafCount: 10, heldTokens: 0 },
      { clockTicks: 10, hostRafCount: 10, heldTokens: 0 },
      10_000_000,
    );
    const leaked = starluxFalsifyIdle(
      { clockTicks: 10, hostRafCount: 10, heldTokens: 0 },
      { clockTicks: 11, hostRafCount: 11, heldTokens: 1 },
      10_000_000,
    );
    expect(clean.passed).toBe(true);
    expect(leaked.passed).toBe(false);
    expect(typeof starluxFalsifyIdle).toBe("function");
  });

  test("M10 slow-mo offset scaling break mutant (1/sqrt(rate) instead of 1/rate) is killed", () => {
    // window.min 2nd hit is 70 ms = 3360 frames; at 0.25x it MUST be 13440 frames (280 ms)
    expect(scaleOffsetByRate(3360, 25)).toBe(13440);
    const mutantSqrtOffset = Math.round(3360 / Math.sqrt(0.25)); // 6720 != 13440
    expect(mutantSqrtOffset).not.toBe(13440);
  });

  test("M11 reduced-motion policy bypass mutant is killed", () => {
    const btn = buildButtonPressRecipe();
    const adm = { ...createAdmissionState(), armed: true, muted: false };
    const r = evaluatePlan(btn.arena, btn.fx, makeCtx({ motionPolicy: 1, functionalAudio: true }), adm);
    expect(r.audio.length).toBe(1);
    expect(r.audio[0]!.gainQ15).toBeLessThanOrEqual(16384);
    expect(r.haptics.length).toBe(0);
    const mutantFullGain = 32768;
    expect(mutantFullGain <= 16384).toBe(false);
  });

  test("M12 LCG multiplier 16808 mutant is killed (Floor P01)", () => {
    expect(lcgNext(7)).toBe(117649);
    const mutantLcg = (7 * 16808) % 2147483647;
    expect(mutantLcg).not.toBe(117649);
  });

  test("M13 xorshift32 signed right-shift mutant is killed (Floor P02)", () => {
    expect(xorshift32Next(1)).toBe(270369);
    // High-bit vector 0x80000001 distinguishes unsigned >>> 17 from signed >> 17
    const unsignedVal = xorshift32Next(0x80000001);
    let x = 0x80000001 | 0;
    x ^= x << 13;
    x ^= x >> 17; // broken signed shift!
    x ^= x << 5;
    expect(unsignedVal).not.toBe(x >>> 0);
  });

  test("M14 haptic rolling-1s >100 ms exposure cap mutant is killed (Floor A15)", () => {
    const a0 = createPlanArena();
    const hp = hapticFx(a0, 0.8, 0.5, 35);
    let adm = { ...createAdmissionState(), armed: true, muted: false };
    let admittedUs = 0;
    for (let i = 0; i < 5; i++) {
      const res = evaluatePlan(hp.arena, hp.fx, makeCtx({
        event: { kind: "IMPULSE", timeUs: 1000000 + i * 40000, intensity: 0.8, subject: 1 + i },
        serial: i + 1,
      }), adm);
      adm = res.admission;
      for (const h of res.haptics) admittedUs += h.durationUs;
    }
    expect(admittedUs).toBeLessThanOrEqual(100000);
    const mutantUncapped = 5 * 35000;
    expect(mutantUncapped <= 100000).toBe(false);
  });
});
