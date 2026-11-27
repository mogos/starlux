// Pure 4-target Starscript Voice Signal Processor (TS, Rust, WASM, C17 byte-identical).
// Fixed-step PCM frame RMS, peak, zero-crossing rate, 8-band Goertzel spectral energies,
// dual-threshold Schmitt VAD hysteresis, syllable onset detector, smooth attack/release
// followers, and deterministic synthetic speech-cadence generator.

import {
  clamp,
  clamp01,
  cos64,
  exp64,
  finiteBound,
  frameUs,
  sin64,
} from "../physics/math.ss.ts";
import { VOICE_REST, VOICE_SPEAK, VOICE_LISTEN, VOICE_THINK, VOICE_ACT, VOICE_CONFIRM, VOICE_ERROR } from "./state.ss.ts";

export type VoiceSignalState = {
  readonly rms: number;
  readonly peak: number;
  readonly zcr: number;
  readonly b0: number;
  readonly b1: number;
  readonly b2: number;
  readonly b3: number;
  readonly b4: number;
  readonly b5: number;
  readonly b6: number;
  readonly b7: number;
  readonly envFast: number;
  readonly envSlow: number;
  readonly vadActive: number;
  readonly vadHangoverFrames: number;
  readonly onsetPulse: number;
  readonly syntheticTimeUs: number;
};

export function createVoiceSignalState(): VoiceSignalState {
  return {
    rms: 0,
    peak: 0,
    zcr: 0,
    b0: 0,
    b1: 0,
    b2: 0,
    b3: 0,
    b4: 0,
    b5: 0,
    b6: 0,
    b7: 0,
    envFast: 0,
    envSlow: 0,
    vadActive: 0,
    vadHangoverFrames: 0,
    onsetPulse: 0,
    syntheticTimeUs: 0,
  };
}

export function signalBandAt(sig: VoiceSignalState, idx: number): number {
  if (idx <= 0) return sig.b0;
  if (idx === 1) return sig.b1;
  if (idx === 2) return sig.b2;
  if (idx === 3) return sig.b3;
  if (idx === 4) return sig.b4;
  if (idx === 5) return sig.b5;
  if (idx === 6) return sig.b6;
  return sig.b7;
}

export function signalBandTotalEnergy(sig: VoiceSignalState): number {
  return sig.b0 + sig.b1 + sig.b2 + sig.b3 + sig.b4 + sig.b5 + sig.b6 + sig.b7;
}

function goertzelBandEnergy(
  samples: readonly number[],
  count: number,
  freqHz: number,
  sampleRateHz: number,
): number {
  if (count <= 0) return 0;
  const omega = 6.283185307179586 * freqHz / sampleRateHz;
  const coeff = 2.0 * cos64(omega);
  let sPrev = 0;
  let sPrev2 = 0;
  for (let i = 0; i < 256; i++) {
    if (i >= count) break;
    const raw = samples[i];
    const x = raw !== undefined ? clamp(raw, -1, 1) : 0;
    const s = x + coeff * sPrev - sPrev2;
    sPrev2 = sPrev;
    sPrev = s;
  }
  const power = sPrev2 * sPrev2 + sPrev * sPrev - coeff * sPrev * sPrev2;
  const safePower = power > 0 ? power : 0;
  const mag = Math.sqrt(safePower) / (count * 0.5);
  return clamp01(mag);
}

function followSmooth(prev: number, target: number, dtSec: number, attackTau: number, releaseTau: number): number {
  const tau = target >= prev ? attackTau : releaseTau;
  const alpha = 1.0 - exp64(-dtSec / clamp(tau, 0.002, 2.0));
  return clamp01(prev + (target - prev) * alpha);
}

export function processPcmFrame(
  prev: VoiceSignalState,
  samples: readonly number[],
  sampleRateHzRaw: number,
  dtUsRaw: number,
): VoiceSignalState {
  const dtUs = frameUs(dtUsRaw);
  const dtSec = dtUs > 0 ? dtUs / 1000000 : 0.016;
  const sr = clamp(sampleRateHzRaw, 8000, 96000);
  const count = samples.length < 256 ? samples.length : 256;

  let sumSq = 0;
  let peak = 0;
  let crossings = 0;
  let prevSign = 0;

  for (let i = 0; i < 256; i++) {
    if (i >= count) break;
    const raw = samples[i];
    const x = raw !== undefined ? clamp(raw, -1, 1) : 0;
    const ax = Math.abs(x);
    if (ax > peak) peak = ax;
    sumSq += x * x;
    const sign = x >= 0 ? 1 : -1;
    if (i > 0 && sign !== prevSign) {
      crossings += 1;
    }
    prevSign = sign;
  }

  let rawRms = 0;
  if (count > 0) {
    rawRms = clamp01(Math.sqrt(sumSq / count));
  }
  let rawZcr = 0;
  if (count > 1) {
    rawZcr = clamp01(crossings / (count - 1));
  }

  // 8 logarithmically spaced vocal bands (140Hz .. 4800Hz)
  let r0 = goertzelBandEnergy(samples, count, 140, sr);
  let r1 = goertzelBandEnergy(samples, count, 260, sr);
  let r2 = goertzelBandEnergy(samples, count, 440, sr);
  let r3 = goertzelBandEnergy(samples, count, 720, sr);
  let r4 = goertzelBandEnergy(samples, count, 1180, sr);
  let r5 = goertzelBandEnergy(samples, count, 1900, sr);
  let r6 = goertzelBandEnergy(samples, count, 3100, sr);
  let r7 = goertzelBandEnergy(samples, count, 4800, sr);

  // Energy conservation cap: band sum never exceeds 8 * peak and stays zero on silence.
  // PLANT:signal_band_conservation
  const bandSum = r0 + r1 + r2 + r3 + r4 + r5 + r6 + r7;
  const maxAllowed = clamp(rawRms * 6.0, 0, 8.0);
  if (bandSum > maxAllowed && bandSum > 0.000001) {
    const s = maxAllowed / bandSum;
    r0 *= s;
    r1 *= s;
    r2 *= s;
    r3 *= s;
    r4 *= s;
    r5 *= s;
    r6 *= s;
    r7 *= s;
  }

  const envFast = followSmooth(prev.envFast, rawRms, dtSec, 0.020, 0.110);
  const envSlow = followSmooth(prev.envSlow, rawRms, dtSec, 0.140, 0.340);

  // Dual-threshold Schmitt trigger VAD with hysteresis hangover
  // PLANT:signal_vad_hysteresis
  let vadActive = prev.vadActive;
  let hangover = prev.vadHangoverFrames;
  if (envFast >= 0.14) {
    vadActive = 1;
    hangover = 6;
  } else if (vadActive === 1) {
    if (envFast <= 0.07) {
      if (hangover > 0) {
        hangover -= 1;
      } else {
        vadActive = 0;
      }
    } else {
      hangover = 4;
    }
  }

  const delta = envFast - envSlow;
  const rawOnset = delta > 0.06 ? clamp01((delta - 0.06) * 4.5) : 0;
  const onsetPulse = followSmooth(prev.onsetPulse, rawOnset, dtSec, 0.012, 0.120);

  return {
    rms: followSmooth(prev.rms, rawRms, dtSec, 0.025, 0.120),
    peak: followSmooth(prev.peak, peak, dtSec, 0.015, 0.160),
    zcr: followSmooth(prev.zcr, rawZcr, dtSec, 0.040, 0.150),
    b0: followSmooth(prev.b0, r0, dtSec, 0.025, 0.120),
    b1: followSmooth(prev.b1, r1, dtSec, 0.025, 0.120),
    b2: followSmooth(prev.b2, r2, dtSec, 0.025, 0.120),
    b3: followSmooth(prev.b3, r3, dtSec, 0.025, 0.120),
    b4: followSmooth(prev.b4, r4, dtSec, 0.025, 0.120),
    b5: followSmooth(prev.b5, r5, dtSec, 0.025, 0.120),
    b6: followSmooth(prev.b6, r6, dtSec, 0.025, 0.120),
    b7: followSmooth(prev.b7, r7, dtSec, 0.025, 0.120),
    envFast: envFast,
    envSlow: envSlow,
    vadActive: vadActive,
    vadHangoverFrames: hangover,
    onsetPulse: onsetPulse,
    syntheticTimeUs: prev.syntheticTimeUs,
  };
}

// Pure 4-target deterministic synthetic speech-cadence generator for demos and tests.
export function synthesizeSpeechCadence(
  prev: VoiceSignalState,
  dtUsRaw: number,
  stateId: number,
  cadenceEnergyRaw: number,
): VoiceSignalState {
  const dtUs = frameUs(dtUsRaw);
  const dtSec = dtUs > 0 ? dtUs / 1000000 : 0.016;
  const gain = clamp01(cadenceEnergyRaw);

  if (stateId === VOICE_REST) {
    return {
      rms: 0,
      peak: 0,
      zcr: 0,
      b0: 0,
      b1: 0,
      b2: 0,
      b3: 0,
      b4: 0,
      b5: 0,
      b6: 0,
      b7: 0,
      envFast: 0,
      envSlow: 0,
      vadActive: 0,
      vadHangoverFrames: 0,
      onsetPulse: 0,
      syntheticTimeUs: prev.syntheticTimeUs,
    };
  }

  let nextTime = prev.syntheticTimeUs + dtUs;
  if (nextTime >= 3600000000) {
    nextTime -= 3600000000;
  }
  const t = nextTime / 1000000;

  // Natural syllabic modulation (3.7Hz syllable, 1.15Hz phrase breath, 0.42Hz prosody)
  const syl = 0.5 + 0.5 * sin64(t * 23.24778563656447 + 0.4 * sin64(t * 7.225663103256524));
  const breath = 0.55 + 0.45 * sin64(t * 2.6389378290154264);
  const pauseGate = sin64(t * 1.41) > -0.68 ? 1.0 : 0.18;

  let baseAmp = gain * (0.28 + 0.72 * syl * breath) * pauseGate;
  if (stateId === VOICE_LISTEN) baseAmp = gain * (0.18 + 0.42 * syl);
  else if (stateId === VOICE_THINK) baseAmp = gain * (0.26 + 0.34 * (0.5 + 0.5 * sin64(t * 8.4)));
  else if (stateId === VOICE_SPEAK) baseAmp = gain * (0.34 + 0.66 * syl * breath) * pauseGate;
  else if (stateId === VOICE_ACT) baseAmp = gain * (0.42 + 0.48 * (0.5 + 0.5 * sin64(t * 15.2)));
  else if (stateId === VOICE_CONFIRM) baseAmp = gain * (0.45 + 0.35 * exp64(-Math.abs(sin64(t * 3.1)) * 1.4));
  else if (stateId === VOICE_ERROR) baseAmp = gain * (0.58 + 0.38 * Math.abs(sin64(t * 19.5)));

  const rms = clamp01(baseAmp);
  const peak = clamp01(rms * 1.28);
  const zcr = clamp01(0.14 + 0.36 * (0.5 + 0.5 * cos64(t * 11.3)));

  // Formant wave sweeping across 8 bands
  const fCenter = 2.6 + 1.8 * sin64(t * 3.1) + 0.9 * cos64(t * 7.4);
  let r0 = rms * exp64(-0.28 * (0 - fCenter) * (0 - fCenter));
  let r1 = rms * exp64(-0.28 * (1 - fCenter) * (1 - fCenter));
  let r2 = rms * exp64(-0.28 * (2 - fCenter) * (2 - fCenter));
  let r3 = rms * exp64(-0.28 * (3 - fCenter) * (3 - fCenter));
  let r4 = rms * exp64(-0.28 * (4 - fCenter) * (4 - fCenter));
  let r5 = rms * exp64(-0.28 * (5 - fCenter) * (5 - fCenter));
  let r6 = rms * exp64(-0.28 * (6 - fCenter) * (6 - fCenter));
  let r7 = rms * exp64(-0.28 * (7 - fCenter) * (7 - fCenter));

  const envFast = followSmooth(prev.envFast, rms, dtSec, 0.020, 0.110);
  const envSlow = followSmooth(prev.envSlow, rms, dtSec, 0.140, 0.340);
  const delta = envFast - envSlow;
  const onset = delta > 0.04 ? clamp01((delta - 0.04) * 5.0) : 0;

  let vadActive = prev.vadActive;
  let hangover = prev.vadHangoverFrames;
  if (envFast >= 0.14) {
    vadActive = 1;
    hangover = 6;
  } else if (vadActive === 1) {
    if (envFast <= 0.07) {
      if (hangover > 0) hangover -= 1;
      else vadActive = 0;
    } else {
      hangover = 4;
    }
  }

  return {
    rms: finiteBound(rms, 1),
    peak: finiteBound(peak, 1),
    zcr: finiteBound(zcr, 1),
    b0: clamp01(r0),
    b1: clamp01(r1),
    b2: clamp01(r2),
    b3: clamp01(r3),
    b4: clamp01(r4),
    b5: clamp01(r5),
    b6: clamp01(r6),
    b7: clamp01(r7),
    envFast: envFast,
    envSlow: envSlow,
    vadActive: vadActive,
    vadHangoverFrames: hangover,
    onsetPulse: followSmooth(prev.onsetPulse, onset, dtSec, 0.015, 0.120),
    syntheticTimeUs: nextTime,
  };
}
