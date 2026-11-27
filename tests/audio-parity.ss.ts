// 4-Target Byte-Identical Parity Program for @mogos/starlux/audio (TS == Rust == WASM == C17).
// Exercises all 6 materials (G/A/T/V/P/C), slow-mo rates (0.25x, 1.0x, 4.0x),
// 6-voice pool + oldest-steal fade, pan extremes/center, representative cues across all 10 families,
// block-repartition equivalence (17 vs 128 frames), and Composable Effects Algebra!

import {
  catalogSize,
  getAudioCue,
} from "../ss/audio/catalog.ss.ts";
import {
  createRenderState,
  pcmDigest,
  renderBlock,
  submitCommand,
  submitCueCommands,
} from "../ss/audio/mix.ss.ts";
import {
  lcgNext,
  xorshift32Next,
} from "../ss/audio/modal.ss.ts";
import type { LuxClock } from "../ss/lux/wake.ss.ts";
import type { LuxEvent } from "../ss/lux/events.ss.ts";
import {
  type AudioLease,
  type EffectContext,
  armAdmissionFromGesture,
  buildButtonPressRecipe,
  buildComboboxSelectRecipe,
  buildMagneticSnapRecipe,
  buildMinimizeDockRecipe,
  buildStarDoneRecipe,
  createAdmissionState,
  createAudioLease,
  evaluatePlan,
  leaseMaySuspend,
  leaseOnAdmit,
  leaseOnDrained,
  leaseSuspend,
} from "../ss/audio/plan.ss.ts";

export function main(rate100: number): readonly number[] {
  const trace: number[] = [];

  // 1. PRNG Floor P01 & P02 exact vectors
  const l1 = lcgNext(7);
  const l2 = lcgNext(l1);
  const x1 = xorshift32Next(1);
  trace.push(catalogSize());
  trace.push(l1);
  trace.push(l2);
  trace.push(x1);

  // 2. Render representative cues across ALL 10 families & ALL 6 materials (G/A/T/V/P/C)
  // Family 0..9 representatives: 1(A), 27(G), 55(G), 77(T), 101(G), 129(G), 151(V), 184(C), 201(G), 234(P)
  const familyCues: readonly number[] = [1, 27, 55, 77, 101, 129, 151, 184, 201, 234];
  let st = createRenderState();
  for (let i = 0; i < 10; i++) {
    const cueId = familyCues[i] ?? 1;
    const cue = getAudioCue(cueId);
    const pan = i === 0 ? -32767 : (i === 9 ? 32767 : 0);
    st = submitCueCommands(st, cue, i * 64, i + 1, 1, 7 + i, 32768, pan, rate100, -1, 0);
  }
  let combinedDigest = 0;
  for (let b = 0; b < 8; b++) {
    const res = renderBlock(st, 128);
    st = res.state;
    combinedDigest = combinedDigest + pcmDigest(res.pcmS16);
    trace.push(pcmDigest(res.pcmS16));
    trace.push(res.activeVoices);
  }
  trace.push(st.peakHoldS16);
  trace.push(st.stealCount);
  trace.push(st.maxSimultaneous);

  // 3. Slow-mo rate law parity (0.25x, 1.0x, 4.0x) on window.min (cue 55)
  const rates: readonly number[] = [25, 100, 400];
  for (let r = 0; r < 3; r++) {
    const rt = rates[r] ?? 100;
    let rs = createRenderState();
    rs = submitCueCommands(rs, getAudioCue(55), 0, 10, 1, 7, 32768, 0, rt, -1, 0);
    const blk = renderBlock(rs, 128);
    trace.push(pcmDigest(blk.pcmS16));
    trace.push(blk.state.peakHoldS16);
  }

  // 4. All 6 materials explicit resonance sweep on cue 77 (magnetic.engage)
  for (let mat = 0; mat < 6; mat++) {
    let ms = createRenderState();
    ms = submitCueCommands(ms, getAudioCue(77), 0, 20 + mat, 1, 7, 32768, 0, 100, mat, 0);
    const blk = renderBlock(ms, 128);
    trace.push(pcmDigest(blk.pcmS16));
  }

  // 5. Block-repartition invariance (chunk 128 vs 17+17+17+17+17+17+26 = 128 frames)
  let sA = createRenderState();
  let sB = createRenderState();
  const pressCue = getAudioCue(27);
  sA = submitCueCommands(sA, pressCue, 0, 1, 1, 7, 32768, -16384, 100, -1, 0);
  sB = submitCueCommands(sB, pressCue, 0, 1, 1, 7, 32768, -16384, 100, -1, 0);
  const full128 = renderBlock(sA, 128);
  const chunks: readonly number[] = [17, 17, 17, 17, 17, 17, 26];
  const joined: number[] = [];
  for (let c = 0; c < 7; c++) {
    const chLen = chunks[c] ?? 0;
    const part = renderBlock(sB, chLen);
    sB = part.state;
    for (let k = 0; k < 512; k++) {
      if (k >= part.pcmS16.length) break;
      joined.push(part.pcmS16[k] ?? 0);
    }
  }
  const dA = pcmDigest(full128.pcmS16);
  const dB = pcmDigest(joined);
  trace.push(dA === dB ? 1 : 0);
  trace.push(dA);

  // 6. Composable Effects Algebra + 5 canonical recipes + WakeToken lease lifecycle
  let adm = createAdmissionState();
  adm = armAdmissionFromGesture(adm, true, true);
  const ctx: EffectContext = {
    event: { kind: "IMPULSE", timeUs: 1000000, intensity: 0.8, subject: 42 },
    transition: "down",
    serial: 1,
    epoch: 1,
    rect: { x: 200, y: 120, w: 120, h: 48 },
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
  };
  const r1 = buildButtonPressRecipe();
  const e1 = evaluatePlan(r1.arena, r1.fx, ctx, adm);
  adm = e1.admission;
  trace.push(e1.accepted ? 1 : 0);
  trace.push(e1.motion.length);
  trace.push(e1.light.length);
  trace.push(e1.audio.length);
  trace.push(e1.haptics.length);

  const r2 = buildMagneticSnapRecipe();
  const e2 = evaluatePlan(r2.arena, r2.fx, {
    event: { kind: "SNAP_ENGAGE", timeUs: 1300000, intensity: 0.9, subject: 43 },
    transition: "latch",
    serial: 2,
    epoch: 1,
    rect: ctx.rect,
    viewport: ctx.viewport,
    vxPxS: 900,
    vyPxS: 0,
    material: 2,
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
  }, adm);
  adm = e2.admission;
  trace.push(e2.audio.length);

  const r3 = buildMinimizeDockRecipe();
  const r4 = buildComboboxSelectRecipe();
  const r5 = buildStarDoneRecipe();
  trace.push(r3.arena.valid && r4.arena.valid && r5.arena.valid ? 1 : 0);

  // Feed plan audio commands into render engine
  let ps = createRenderState();
  for (let i = 0; i < 4; i++) {
    if (i >= e1.audio.length) break;
    const cmd = e1.audio[i];
    if (cmd !== undefined) ps = submitCommand(ps, cmd);
  }
  const pBlk = renderBlock(ps, 64);
  trace.push(pcmDigest(pBlk.pcmS16));

  // Audio WakeToken Lease lifecycle
  let lease = createAudioLease();
  lease = leaseOnAdmit(lease);
  const heldAfterAdmit = lease.token > 0 ? 1 : 0;
  lease = leaseOnDrained(lease, 1000000, 1600000);
  const mayBefore = leaseMaySuspend(lease, 2500000) ? 1 : 0;
  const mayAfter = leaseMaySuspend(lease, 2600000) ? 1 : 0;
  lease = leaseSuspend(lease, lease.generation);
  trace.push(heldAfterAdmit);
  trace.push(mayBefore);
  trace.push(mayAfter);
  trace.push(lease.suspended ? 1 : 0);
  trace.push(combinedDigest > 0 ? 1 : 0);

  return trace;
}
