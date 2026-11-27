// Starlux Modal Bank, Deterministic Noise Exciters (Schrage LCG + Xorshift32),
// Constant-Peak Bandpass Biquad, and Anti-Click Raised-Cosine Envelopes.
// 100% deterministic integer/Q15 math across TS, Rust, WASM, and C17.

import {
  cos64,
  sin64,
} from "../physics/math.ss.ts";
import {
  type AudioCommand,
  type AudioHit,
  type ModeState,
  type VoiceSlot,
  audioAttackMaxFrames,
  audioMaxModes,
  audioReleaseMaxFrames,
  audioStealFadeFrames,
  clampInt,
  emptyCommand,
  roundHalfToEven,
  wrapU32,
} from "./format.ss.ts";
import {
  centsMultiplierQ15,
  decayMultiplierQ24,
  hzToPhaseInc,
  materialBrightnessQ15,
  materialDecaySlopeQ15,
  materialModeRatio,
  modeWeightPowerQ15,
  panGainLQ15,
  panGainRQ15,
  raisedCosineDownQ15,
  raisedCosineUpQ15,
  ratePitchQ15,
  scaleDurationByRate,
  sinQ15,
} from "./tables.ss.ts";

const TWO_PI = 6.283185307179586;

// Park-Miller LCG via Schrage's method (no 32-bit overflow):
// s' = 16807 * s mod 2147483647 (q = 127773, r = 2836)
// Seed 7 -> 117649 -> 1977326743 (Floor P01 exact)
export function lcgNext(seed: number): number {
  let s = Math.floor(seed);
  if (s <= 0 || s >= 2147483647) s = 7;
  const hi = Math.floor(s / 127773);
  const lo = s - hi * 127773;
  let next = 16807 * lo - 2836 * hi;
  if (next <= 0) next += 2147483647;
  return next;
}

export function lcgSampleQ15(seed: number): number {
  // x = 2 * s / 2147483647 - 1 in Q15 [-32767, 32767]
  const v = (2 * seed) / 2147483647 - 1;
  return clampInt(roundHalfToEven(v * 32767), -32767, 32767);
}

// Unsigned 32-bit XOR helper using 16-bit limbs (100% identical across TS/Rust/WASM/C17)
function xorU32(a: number, b: number): number {
  const ua = wrapU32(Math.floor(a));
  const ub = wrapU32(Math.floor(b));
  let result = 0;
  let bit = 1;
  let x = ua;
  let y = ub;
  for (let i = 0; i < 32; i++) {
    const xb = x - Math.floor(x / 2) * 2;
    const yb = y - Math.floor(y / 2) * 2;
    if (xb !== yb) result += bit;
    x = Math.floor(x / 2);
    y = Math.floor(y / 2);
    bit *= 2;
  }
  return result;
}

// Unsigned xorshift32 (13L, 17R, 5L): seed 1 -> 270369 (Floor P02 exact)
export function xorshift32Next(state: number): number {
  let x = wrapU32(Math.floor(state));
  if (x === 0) x = 7;
  x = xorU32(x, wrapU32(x * 8192));             // << 13
  x = xorU32(x, Math.floor(x / 131072));        // >>> 17
  x = xorU32(x, wrapU32(x * 32));               // << 5
  if (x === 0) return 7;
  return x;
}

export function xorshiftSampleQ15(state: number): number {
  const v = (2 * wrapU32(state)) / 4294967295 - 1;
  return clampInt(roundHalfToEven(v * 32767), -32767, 32767);
}

// Constant-peak bandpass biquad coefficients in Q2.29 (scale = 536870912)
// fc = min(12000, 3 * f0), Q = 1.4
export type BiquadCoeffs = {
  readonly b0Q29: number;
  readonly a1Q29: number;
  readonly a2Q29: number;
};

export function bandpassCoeffs(baseHz: number): BiquadCoeffs {
  let fc = Math.floor(baseHz * 3 + 0.5);
  if (fc < 60) fc = 60;
  if (fc > 12000) fc = 12000;
  const w = (TWO_PI * fc) / 48000;
  const alpha = sin64(w) / (2 * 1.4);
  const inv = 1 / (1 + alpha);
  const b0 = alpha * inv;
  const a1 = (-2 * cos64(w)) * inv;
  const a2 = (1 - alpha) * inv;
  const scale = 536870912; // 2^29
  return {
    b0Q29: roundHalfToEven(b0 * scale),
    a1Q29: roundHalfToEven(a1 * scale),
    a2Q29: roundHalfToEven(a2 * scale),
  };
}

export type BiquadStepResult = {
  readonly y: number;
  readonly x1: number;
  readonly x2: number;
  readonly y1: number;
  readonly y2: number;
};

// Direct Form I constant-peak bandpass (b1 = 0, b2 = -b0), single rounding per output,
// state bounded to +/-131071 Q15 units.
export function stepBandpass(
  x: number,
  b0Q29: number,
  a1Q29: number,
  a2Q29: number,
  x1: number,
  x2: number,
  y1: number,
  y2: number,
): BiquadStepResult {
  const num = b0Q29 * (x - x2) - a1Q29 * y1 - a2Q29 * y2;
  const y = clampInt(roundHalfToEven(num / 536870912), -131071, 131071);
  return {
    y,
    x1: clampInt(x, -131071, 131071),
    x2: x1,
    y1: y,
    y2: y1,
  };
}

export function emptyMode(): ModeState {
  return {
    active: false,
    phase: 0,
    startInc: 0,
    endInc: 0,
    glideFrames: 0,
    weightQ15: 0,
    envQ15: 0,
    decayMulQ24: 0,
    totalFrames: 0,
  };
}

export function emptyVoiceSlot(): VoiceSlot {
  const modes: ModeState[] = [emptyMode(), emptyMode(), emptyMode(), emptyMode()];
  return {
    state: 0,
    admitOrder: 0,
    age: 0,
    totalFrames: 0,
    attackFrames: 0,
    releaseFrames: 0,
    gainQ15: 0,
    panLQ15: 23170,
    panRQ15: 23170,
    noiseKind: 0,
    noiseSeed: 7,
    noiseEnvQ24: 0,
    noiseMulQ24: 0,
    noiseStopFrames: 0,
    b0Q29: 0,
    a1Q29: 0,
    a2Q29: 0,
    x1: 0,
    x2: 0,
    y1: 0,
    y2: 0,
    fadeIndex: 0,
    subject: 0,
    epoch: 0,
    cueId: 0,
    modes,
    hasReplacement: false,
    replacement: emptyCommand(),
  };
}

export function initVoiceFromHit(
  hit: AudioHit,
  cmd: AudioCommand,
  admitOrder: number,
  hasReplacement: boolean,
  replacement: AudioCommand,
): VoiceSlot {
  const mat = cmd.materialOverride >= 0 && cmd.materialOverride <= 5 ? cmd.materialOverride : hit.material;
  const scaledFrames = scaleDurationByRate(hit.frames, cmd.rate100);
  if (scaledFrames < 4 || cmd.gainQ15 <= 0 || hit.gainQ15 <= 0) {
    return emptyVoiceSlot();
  }

  const pitchRateQ15 = ratePitchQ15(cmd.rate100);
  const velPitchQ15 = centsMultiplierQ15(cmd.pitchCents);
  const baseHz = (hit.hz10 / 10) * (pitchRateQ15 / 32768) * (velPitchQ15 / 32768);
  const endRatio = hit.endRatioQ16 / 65536;
  const unscaledGlide = hit.frames < 5760 ? hit.frames : 5760; // min(D, 120 ms)
  const glideFrames = endRatio === 1 ? 0 : scaleDurationByRate(unscaledGlide, cmd.rate100);

  const matBright = hit.brightQ15 > 0 ? hit.brightQ15 : materialBrightnessQ15(mat);
  const matSlope = (materialDecaySlopeQ15(mat) / 32768) * (hit.decayFactorQ15 / 32768);

  const modes: ModeState[] = [];
  for (let i = 0; i < 4; i++) {
    const ratio = materialModeRatio(mat, i);
    const detune = hit.exactDetune ? (i === 0 || i === 2 ? 0.9991 : 1.0013) : 1;
    const fStart = baseHz * ratio * detune;
    const fEnd = baseHz * ratio * endRatio;
    const fMax = fStart > fEnd ? fStart : fEnd;
    if (fMax > 15000 || fStart <= 0) {
      modes.push(emptyMode());
    } else {
      const weight = i === 0
        ? 32768
        : roundHalfToEven((matBright * modeWeightPowerQ15(i)) / 32768);
      const modeDur = Math.max(4, roundHalfToEven(scaledFrames / (1 + matSlope * i)));
      modes.push({
        active: true,
        phase: 0,
        startInc: hzToPhaseInc(fStart),
        endInc: hzToPhaseInc(fEnd),
        glideFrames,
        weightQ15: clampInt(weight, 0, 32768),
        envQ15: 16777216,
        decayMulQ24: decayMultiplierQ24(modeDur),
        totalFrames: modeDur,
      });
    }
  }

  const quarter = Math.floor(scaledFrames / 4);
  const defaultAttack = quarter < audioAttackMaxFrames() ? quarter : audioAttackMaxFrames();
  const attackFrames = hit.attackFrames > 0
    ? (hit.attackFrames < quarter ? hit.attackFrames : quarter)
    : defaultAttack;
  const releaseFrames = quarter < audioReleaseMaxFrames() ? quarter : audioReleaseMaxFrames();
  const safeAttack = attackFrames < 2 ? 2 : attackFrames;
  const safeRelease = releaseFrames < 2 ? 2 : releaseFrames;

  const hitGain = roundHalfToEven((hit.gainQ15 * cmd.gainQ15) / 32768);
  const bp = bandpassCoeffs(baseHz);

  const noiseDecay = scaleDurationByRate(hit.noiseDecayFrames > 0 ? hit.noiseDecayFrames : 576, cmd.rate100);
  const noiseStopRaw = scaleDurationByRate(hit.noiseStopFrames > 0 ? hit.noiseStopFrames : 1920, cmd.rate100);
  const noiseStop = noiseStopRaw < scaledFrames ? noiseStopRaw : scaledFrames;

  // Reference LCG resets to 7 per hit; xorshift32 uses nonzero seed xor (hitIndex + 1)
  let seed = 7;
  if (hit.noiseKind !== 0 && cmd.seed > 0) {
    seed = wrapU32(cmd.seed + cmd.hitIndex + 1);
    if (seed === 0) seed = 7;
  }
  let noiseEnvQ24 = 0;
  let noiseMulQ24 = 0;
  let noiseStopFrames = 0;
  if (hit.noiseQ15 > 0) {
    noiseEnvQ24 = Math.floor(hit.noiseQ15 * 512);
    noiseMulQ24 = decayMultiplierQ24(Math.max(4, noiseDecay));
    noiseStopFrames = noiseStop;
  }

  return {
    state: 1,
    admitOrder,
    age: 0,
    totalFrames: scaledFrames,
    attackFrames: safeAttack,
    releaseFrames: safeRelease,
    gainQ15: clampInt(hitGain, 0, 32768),
    panLQ15: panGainLQ15(cmd.pan),
    panRQ15: panGainRQ15(cmd.pan),
    noiseKind: hit.noiseKind,
    noiseSeed: seed,
    noiseEnvQ24,
    noiseMulQ24,
    noiseStopFrames,
    b0Q29: bp.b0Q29,
    a1Q29: bp.a1Q29,
    a2Q29: bp.a2Q29,
    x1: 0,
    x2: 0,
    y1: 0,
    y2: 0,
    fadeIndex: 0,
    subject: cmd.subject,
    epoch: cmd.epoch,
    cueId: cmd.cueId,
    modes,
    hasReplacement,
    replacement,
  };
}

export type VoiceStepResult = {
  readonly slot: VoiceSlot;
  readonly sampleQ15: number;
  readonly promoteReplacement: boolean;
};

// Advance one voice slot by one canonical 48 kHz sample.
// First sample (age = 0) and terminal sample (age = totalFrames - 1) are strictly 0.
export function stepVoiceSample(slot: VoiceSlot): VoiceStepResult {
  if (slot.state === 0) {
    return { slot, sampleQ15: 0, promoteReplacement: false };
  }

  const age = slot.age;
  const total = slot.totalFrames;
  let sumQ15 = 0;

  const nextModes: ModeState[] = [];
  for (let i = 0; i < 4; i++) {
    const m = slot.modes[i];
    if (m === undefined) {
      nextModes.push(emptyMode());
    } else if (!m.active || age >= m.totalFrames) {
      nextModes.push({
        active: false,
        phase: m.phase,
        startInc: m.startInc,
        endInc: m.endInc,
        glideFrames: m.glideFrames,
        weightQ15: m.weightQ15,
        envQ15: 0,
        decayMulQ24: m.decayMulQ24,
        totalFrames: m.totalFrames,
      });
    } else {
      const sVal = sinQ15(m.phase);
      const weighted = Math.floor((sVal * m.weightQ15) / 32768);
      const decayed = Math.floor((weighted * m.envQ15) / 16777216);
      sumQ15 += decayed;

      let inc = m.startInc;
      if (m.glideFrames > 1 && m.endInc !== m.startInc) {
        const gIdx = age < m.glideFrames - 1 ? age : m.glideFrames - 1;
        inc = m.startInc + roundHalfToEven(((m.endInc - m.startInc) * gIdx) / (m.glideFrames - 1));
      }
      const nextPhase = wrapU32(m.phase + inc);
      const nextEnv = Math.floor((m.envQ15 * m.decayMulQ24) / 16777216);
      nextModes.push({
        active: true,
        phase: nextPhase,
        startInc: m.startInc,
        endInc: m.endInc,
        glideFrames: m.glideFrames,
        weightQ15: m.weightQ15,
        envQ15: nextEnv,
        decayMulQ24: m.decayMulQ24,
        totalFrames: m.totalFrames,
      });
    }
  }

  let nextSeed = slot.noiseSeed;
  let nextNoiseEnv = slot.noiseEnvQ24;
  let nx1 = slot.x1;
  let nx2 = slot.x2;
  let ny1 = slot.y1;
  let ny2 = slot.y2;

  if (age < slot.noiseStopFrames && slot.noiseEnvQ24 > 0) {
    let rawNoise = 0;
    if (slot.noiseKind === 0) {
      nextSeed = lcgNext(slot.noiseSeed);
      rawNoise = lcgSampleQ15(nextSeed);
    } else {
      nextSeed = xorshift32Next(slot.noiseSeed);
      rawNoise = xorshiftSampleQ15(nextSeed);
    }
    const shaped = Math.floor((rawNoise * slot.noiseEnvQ24) / 16777216);
    const bp = stepBandpass(shaped, slot.b0Q29, slot.a1Q29, slot.a2Q29, nx1, nx2, ny1, ny2);
    nx1 = bp.x1;
    nx2 = bp.x2;
    ny1 = bp.y1;
    ny2 = bp.y2;
    sumQ15 += bp.y;
    nextNoiseEnv = Math.floor((slot.noiseEnvQ24 * slot.noiseMulQ24) / 16777216);
  }

  // Apply raised-cosine attack and release endpoints (strictly 0 at first and last sample)
  let envQ15 = 32768;
  if (age < slot.attackFrames) {
    envQ15 = Math.floor((envQ15 * raisedCosineUpQ15(age, slot.attackFrames)) / 32768);
  }
  const remFromEnd = total - 1 - age;
  if (remFromEnd < slot.releaseFrames) {
    const relIdx = slot.releaseFrames - 1 - remFromEnd;
    envQ15 = Math.floor((envQ15 * raisedCosineDownQ15(relIdx, slot.releaseFrames)) / 32768);
  }

  let nextState = slot.state;
  let nextFadeIndex = slot.fadeIndex;
  let promote = false;

  if (slot.state === 2) {
    // 96-sample steal/cancel fade including both endpoints (0 -> 32768, 95 -> 0)
    const fadeLen = audioStealFadeFrames();
    const fadeGain = raisedCosineDownQ15(slot.fadeIndex, fadeLen);
    envQ15 = Math.floor((envQ15 * fadeGain) / 32768);
    nextFadeIndex = slot.fadeIndex + 1;
    if (nextFadeIndex >= fadeLen) {
      nextState = 0;
      promote = slot.hasReplacement;
    }
  } else if (age + 1 >= total) {
    nextState = 0;
  }

  const outQ15 = Math.floor((Math.floor((sumQ15 * envQ15) / 32768) * slot.gainQ15) / 32768);

  if (nextState === 0 && !promote) {
    return { slot: emptyVoiceSlot(), sampleQ15: outQ15, promoteReplacement: false };
  }

  return {
    slot: {
      state: nextState,
      admitOrder: slot.admitOrder,
      age: age + 1,
      totalFrames: slot.totalFrames,
      attackFrames: slot.attackFrames,
      releaseFrames: slot.releaseFrames,
      gainQ15: slot.gainQ15,
      panLQ15: slot.panLQ15,
      panRQ15: slot.panRQ15,
      noiseKind: slot.noiseKind,
      noiseSeed: nextSeed,
      noiseEnvQ24: nextNoiseEnv,
      noiseMulQ24: slot.noiseMulQ24,
      noiseStopFrames: slot.noiseStopFrames,
      b0Q29: slot.b0Q29,
      a1Q29: slot.a1Q29,
      a2Q29: slot.a2Q29,
      x1: nx1,
      x2: nx2,
      y1: ny1,
      y2: ny2,
      fadeIndex: nextFadeIndex,
      subject: slot.subject,
      epoch: slot.epoch,
      cueId: slot.cueId,
      modes: nextModes,
      hasReplacement: slot.hasReplacement,
      replacement: slot.replacement,
    },
    sampleQ15: outQ15,
    promoteReplacement: promote,
  };
}
