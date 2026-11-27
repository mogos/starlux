// Deterministic Material Ratios, Q15 Trig, Pan, Rate Coupling, and Dynamics Curves
// Zero libm dependencies: uses Starscript polynomial sin64/cos64/exp64/ln64 only.

import { clamp, cos64, exp64, ln64, sin64 } from "../physics/math.ss.ts";
import { clampInt, clampRate100, roundHalfToEven, wrapU32 } from "./format.ss.ts";

const PI = 3.141592653589793;
const TWO_PI = 6.283185307179586;

// 6 physical materials: G=0, A=1, T=2, V=3, P=4, C=5
export function materialName(material: number): string {
  if (material === 0) return "obsidian-glass";
  if (material === 1) return "sunlit-alabaster";
  if (material === 2) return "brushed-titanium";
  if (material === 3) return "matte-vellum";
  if (material === 4) return "amber-plasma";
  return "tactile-ceramic";
}

export function materialCode(material: number): string {
  if (material === 0) return "G";
  if (material === 1) return "A";
  if (material === 2) return "T";
  if (material === 3) return "V";
  if (material === 4) return "P";
  return "C";
}

export function materialFromCode(code: string): number {
  if (code === "G") return 0;
  if (code === "A") return 1;
  if (code === "T") return 2;
  if (code === "V") return 3;
  if (code === "P") return 4;
  return 5;
}

// Exact modal frequency multipliers (4 modes per bank)
export function materialModeRatio(material: number, modeIdx: number): number {
  if (modeIdx <= 0) return 1;
  if (material === 0) {
    // obsidian-glass: free-free slender bar (M3 exact stored series)
    if (modeIdx === 1) return 2.756;
    if (modeIdx === 2) return 5.404;
    return 8.933;
  }
  if (material === 1) {
    // sunlit-alabaster: simply supported square plate (1,1),(1,2),(2,2),(1,3)
    if (modeIdx === 1) return 2.5;
    if (modeIdx === 2) return 4;
    return 5;
  }
  if (material === 2) {
    // brushed-titanium: simply supported 3:2 rectangular plate 1, 25/13, 40/13, 45/13
    if (modeIdx === 1) return 25 / 13;
    if (modeIdx === 2) return 40 / 13;
    return 45 / 13;
  }
  if (material === 3) {
    // matte-vellum: clamped circular membrane j_mn / j_01
    if (modeIdx === 1) return 1.59334051;
    if (modeIdx === 2) return 2.13554879;
    return 2.29541727;
  }
  if (material === 4) {
    // amber-plasma: ideal fixed string harmonic core 1, 2, 3, 4
    if (modeIdx === 1) return 2;
    if (modeIdx === 2) return 3;
    return 4;
  }
  // tactile-ceramic: pinned bending bar 1, 4, 9, 16
  if (modeIdx === 1) return 4;
  if (modeIdx === 2) return 9;
  return 16;
}

// Brightness b in Q15 (0..32768)
export function materialBrightnessQ15(material: number): number {
  if (material === 0) return 16384; // 0.50
  if (material === 1) return 10486; // 0.32
  if (material === 2) return 19661; // 0.60
  if (material === 3) return 4915;  // 0.15
  if (material === 4) return 11796; // 0.36
  return 9175;                      // 0.28
}

// Decay slope k in Q15 (32768 = 1.0)
export function materialDecaySlopeQ15(material: number): number {
  if (material === 0) return 29491; // 0.90
  if (material === 1) return 34406; // 1.05
  if (material === 2) return 19005; // 0.58
  if (material === 3) return 52429; // 1.60
  if (material === 4) return 22938; // 0.70
  return 42598;                     // 1.30
}

// Pre-baked (i + 1)^(-1.15) in Q15 for i = 0..3
export function modeWeightPowerQ15(modeIdx: number): number {
  if (modeIdx <= 0) return 32768; // 1.0
  if (modeIdx === 1) return 14767; // 2^(-1.15) * 32768
  if (modeIdx === 2) return 9261;  // 3^(-1.15) * 32768
  return 6653;                     // 4^(-1.15) * 32768
}

// Q15 sine via quantized 4096-segment linear interpolation over 32-bit phase.
// Identical integer outputs on TS, Rust, WASM, and C17.
function sineGridQ15(index: number): number {
  const idx = index - Math.floor(index / 4096) * 4096;
  if (idx === 0 || idx === 2048) return 0;
  if (idx === 1024) return 32767;
  if (idx === 3072) return -32767;
  const angle = (idx * TWO_PI) / 4096;
  const s = sin64(angle) * 32767;
  return clampInt(roundHalfToEven(s), -32767, 32767);
}

export function sinQ15(phaseU32: number): number {
  const p = wrapU32(phaseU32);
  const idx = Math.floor(p / 1048576); // top 12 bits (0..4095)
  const frac = p - idx * 1048576;      // low 20 bits
  const y0 = sineGridQ15(idx);
  const y1 = sineGridQ15(idx + 1);
  const interp = y0 + Math.floor(((y1 - y0) * frac) / 1048576);
  return clampInt(interp, -32767, 32767);
}

// Raised-cosine ramp up: j=0 -> 0, j=len-1 -> 32768
export function raisedCosineUpQ15(j: number, len: number): number {
  if (len <= 1) return 0;
  if (j <= 0) return 0;
  if (j >= len - 1) return 32768;
  const angle = (PI * j) / (len - 1);
  const v = (1 - cos64(angle)) * 16384;
  return clampInt(roundHalfToEven(v), 0, 32768);
}

// Reversed raised-cosine ramp down: j=0 -> 32768, j=len-1 -> 0
export function raisedCosineDownQ15(j: number, len: number): number {
  if (len <= 1) return 0;
  if (j <= 0) return 32768;
  if (j >= len - 1) return 0;
  const angle = (PI * j) / (len - 1);
  const v = (1 + cos64(angle)) * 16384;
  return clampInt(roundHalfToEven(v), 0, 32768);
}

// Equal-power stereo pan in Q15 (0..32768), exact endpoints
export function panGainLQ15(pan: number): number {
  const p = clampInt(pan, -32767, 32767);
  if (p <= -32767) return 32768;
  if (p >= 32767) return 0;
  if (p === 0) return 23170;
  const norm = p / 32767;
  const v = cos64(((norm + 1) * PI) / 4) * 32768;
  return clampInt(roundHalfToEven(v), 0, 32768);
}

export function panGainRQ15(pan: number): number {
  const p = clampInt(pan, -32767, 32767);
  if (p <= -32767) return 0;
  if (p >= 32767) return 32768;
  if (p === 0) return 23170;
  const norm = p / 32767;
  const v = sin64(((norm + 1) * PI) / 4) * 32768;
  return clampInt(roundHalfToEven(v), 0, 32768);
}

// Slow-motion tape coupling: rate100 in [10, 400] (0.10x..4.00x)
// Pitch scales by rate^0.35, duration scales by 1/sqrt(rate), offsets scale by 1/rate
export function ratePitchQ15(rate100: number): number {
  const r100 = clampRate100(rate100);
  if (r100 === 100) return 32768;
  const r = r100 / 100;
  const factor = exp64(0.35 * ln64(r));
  return clampInt(roundHalfToEven(factor * 32768), 1, 131072);
}

export function rateDurationQ15(rate100: number): number {
  const r100 = clampRate100(rate100);
  if (r100 === 100) return 32768;
  const r = r100 / 100;
  const factor = 1 / Math.sqrt(r);
  return clampInt(roundHalfToEven(factor * 32768), 1, 262144);
}

export function scaleOffsetByRate(offsetFrames: number, rate100: number): number {
  if (offsetFrames <= 0) return 0;
  const r100 = clampRate100(rate100);
  if (r100 === 100) return offsetFrames;
  return roundHalfToEven((offsetFrames * 100) / r100);
}

export function scaleDurationByRate(durFrames: number, rate100: number): number {
  if (durFrames <= 0) return 0;
  const r100 = clampRate100(rate100);
  if (r100 === 100) return durFrames;
  const q15 = rateDurationQ15(r100);
  return Math.max(1, roundHalfToEven((durFrames * q15) / 32768));
}

// Cents multiplier in Q15: 2^(cents / 1200)
export function centsMultiplierQ15(cents: number): number {
  const c = clampInt(cents, -1200, 1200);
  if (c === 0) return 32768;
  const factor = exp64((c / 1200) * 0.6931471805599453);
  return clampInt(roundHalfToEven(factor * 32768), 16384, 65536);
}

// dBFS to Q15 amplitude: floor(32768 * 10^(dbfs / 20))
export function dbfsToQ15(dbfs: number): number {
  const d = clamp(dbfs, -96, 0);
  const linear = exp64((d / 20) * 2.302585092994046);
  return clampInt(Math.floor(32768 * linear), 0, 32768);
}

// Exponential decay multiplier per sample in Q24 so amplitude reaches 0.0001 at N frames
export function decayMultiplierQ24(frames: number): number {
  if (frames <= 1) return 0;
  // ln(0.0001) = -9.210340371976182
  const r = exp64(-9.210340371976182 / frames);
  return clampInt(roundHalfToEven(r * 16777216), 0, 16777215);
}

// Phase increment per 48 kHz sample for frequency in Hz: round(f * 2^32 / 48000)
export function hzToPhaseInc(hz: number): number {
  if (hz <= 0) return 0;
  return roundHalfToEven((hz * 4294967296) / 48000);
}

// Compressor 4:1 target gain in Q15 above threshold T = 4125 (-18 dBFS): (x/T)^(-3/4)
export function compressorTargetGainQ15(peakAbsQ15: number): number {
  const threshold = 4125;
  if (peakAbsQ15 <= threshold) return 32768;
  const ratio = threshold / peakAbsQ15;
  const s1 = Math.sqrt(ratio);
  const s2 = Math.sqrt(s1);
  return clampInt(roundHalfToEven(s1 * s2 * 32768), 1, 32768);
}

// Compressor attack/release smoothing coefficients in Q15
// tau_attack = 3 ms -> exp(-1/144) = 0.9930796 -> 32541
// tau_release = 80 ms -> exp(-1/3840) = 0.9997396 -> 32759
export function compAttackCoeffQ15(): number { return 32541; }
export function compReleaseCoeffQ15(): number { return 32759; }
