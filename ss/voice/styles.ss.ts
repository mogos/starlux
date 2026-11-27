// Pure 4-target Starscript Voice Animation Style Evaluators (28 styles across 5 families).
// Every style writes into a flat numeric primitive buffer of stride 8:
//   [x, y, radius, width, height, alpha, warmth, phase]
// Normalized coordinates: x in [-1, 1], y in [-1, 1], radius/width/height/alpha/warmth/phase in [0, 1].
// Zero runtime deps, zero libm transcendentals: TS, Rust, WASM, C17 byte-identical.

import { clamp, clamp01, cos64, exp64, sin64 } from "../physics/math.ss.ts";
import { type VoiceSignalState, signalBandAt } from "./signal.ss.ts";
import {
  PRIM_KIND_BAR,
  PRIM_KIND_DOT,
  PRIM_KIND_FIELD,
  PRIM_KIND_RADIAL,
  PRIM_KIND_RIBBON,
} from "./catalog.ss.ts";
import { VOICE_CONFIRM, VOICE_ERROR, VOICE_REST, VOICE_SPEAK } from "./state.ss.ts";

export const VOICE_PRIM_STRIDE = 8;

export type VoicePrimitiveFrame = {
  readonly styleId: number;
  readonly kind: number;
  readonly count: number;
  readonly primitives: readonly number[];
};

function stateWarmthBias(stateId: number): number {
  if (stateId === VOICE_REST) return 0.35;
  if (stateId === VOICE_ERROR) return 1.0;
  if (stateId === VOICE_CONFIRM) return 0.92;
  if (stateId === VOICE_SPEAK) return 0.85;
  return 0.68;
}

function interpBand(sig: VoiceSignalState, u: number): number {
  const scaled = clamp(u, 0, 1) * 7.0;
  const lo = Math.floor(scaled);
  const hi = lo < 7 ? lo + 1 : 7;
  const frac = scaled - lo;
  return signalBandAt(sig, lo) * (1.0 - frac) + signalBandAt(sig, hi) * frac;
}

function wrap01(v: number): number {
  const f = v - Math.floor(v);
  return clamp01(f);
}

// Family A: Cadence & Dots (0..5)
function evalFamilyA(
  styleId: number,
  stateId: number,
  energy: number,
  presence: number,
  phase: number,
  sig: VoiceSignalState,
  reducedMotion: boolean,
): VoicePrimitiveFrame {
  const ph = reducedMotion ? 0 : phase;
  const warmBase = stateWarmthBias(stateId);
  const act = presence * (0.20 + 0.80 * energy);

  // PLANT:voice_family_a
  if (styleId === 0) {
    const buf: number[] = [];
    // 0: amber-bead-cadence (canonical 12 warm glowing amber beads)
    for (let i = 0; i < 12; i++) {
      const u = i / 11.0;
      const x = -0.88 + 1.76 * u;
      const centerDist = (u - 0.5) * 2.0;
      const arch = exp64(-1.6 * centerDist * centerDist);
      const band = interpBand(sig, u);
      const wave = 0.5 + 0.5 * sin64(ph * 1.45 - i * 0.58);
      const amp = act * arch * (0.35 + 0.65 * band) * (0.55 + 0.45 * wave);
      const y = (sin64(ph * 1.15 + i * 0.62) * 0.22) * act * arch;
      const rad = 0.14 + 0.34 * amp + 0.10 * sig.onsetPulse * arch;
      const alpha = 0.24 + 0.76 * clamp01(0.25 * presence + 0.95 * amp);
      const warmth = clamp01(warmBase * 0.75 + 0.25 * amp + 0.15 * sig.onsetPulse);
      buf.push(clamp(x, -1, 1));
      buf.push(clamp(y, -1, 1));
      buf.push(clamp01(rad));
      buf.push(clamp01(rad * 2.0));
      buf.push(clamp01(rad * 2.0));
      buf.push(clamp01(alpha));
      buf.push(clamp01(warmth));
      buf.push(clamp01(wrap01(u + ph * 0.1)));
    }
    return { styleId: 0, kind: PRIM_KIND_DOT, count: 12, primitives: buf };
  }

  if (styleId === 1) {
    const buf: number[] = [];
    // 1: sol-dot-constellation (16 golden-angle Fibonacci constellation dots)
    for (let i = 0; i < 16; i++) {
      const u = (i + 0.5) / 16.0;
      const angle = i * 2.399963229728653 + ph * 0.35;
      const band = interpBand(sig, u);
      const radial = (0.14 + 0.62 * Math.sqrt(u)) * (0.72 + 0.38 * act * (0.4 + 0.6 * band));
      const x = cos64(angle) * radial;
      const y = sin64(angle) * radial;
      const rad = 0.08 + 0.22 * band * act + 0.06 * presence;
      buf.push(clamp(x, -1, 1));
      buf.push(clamp(y, -1, 1));
      buf.push(clamp01(rad));
      buf.push(clamp01(rad * 2.0));
      buf.push(clamp01(rad * 2.0));
      buf.push(clamp01(0.22 + 0.78 * clamp01(presence * 0.4 + band * act)));
      buf.push(clamp01(clamp01(warmBase + 0.2 * band)));
      buf.push(clamp01(wrap01(angle / 6.283185307179586)));
    }
    return { styleId: 1, kind: PRIM_KIND_DOT, count: 16, primitives: buf };
  }

  if (styleId === 2) {
    const buf: number[] = [];
    // 2: braille-cadence-matrix (3x8 = 24 tactile cadence dots)
    for (let i = 0; i < 24; i++) {
      const col = i % 8;
      const row = Math.floor(i / 8);
      const x = -0.84 + col * 0.24;
      const y = -0.44 + row * 0.44;
      const band = signalBandAt(sig, col);
      const tierThresh = (2 - row) * 0.28;
      const lit = clamp01((band * (0.4 + 0.9 * act) - tierThresh) * 2.6 + 0.12 * presence);
      const pulse = 0.85 + 0.15 * sin64(ph * 1.6 + col * 0.7 + row * 0.9);
      const rad = 0.07 + 0.15 * lit * pulse;
      buf.push(clamp(x, -1, 1));
      buf.push(clamp(y, -1, 1));
      buf.push(clamp01(rad));
      buf.push(clamp01(rad * 2.0));
      buf.push(clamp01(rad * 2.0));
      buf.push(clamp01(0.16 + 0.84 * lit));
      buf.push(clamp01(clamp01(warmBase * 0.8 + 0.25 * lit)));
      buf.push(clamp01(wrap01((col + row) / 10.0)));
    }
    return { styleId: 2, kind: PRIM_KIND_DOT, count: 24, primitives: buf };
  }

  if (styleId === 3) {
    const buf: number[] = [];
    // 3: pendulum-pearls (10 phase-coupled pendulum pearls)
    for (let i = 0; i < 10; i++) {
      const u = i / 9.0;
      const x = -0.82 + 1.64 * u;
      const band = interpBand(sig, u);
      const swing = sin64(ph * 1.35 - i * 0.42);
      const y = swing * (0.14 + 0.62 * act * (0.4 + 0.6 * band));
      const rad = 0.12 + 0.20 * act * (0.5 + 0.5 * Math.abs(swing));
      buf.push(clamp(x, -1, 1));
      buf.push(clamp(y, -1, 1));
      buf.push(clamp01(rad));
      buf.push(clamp01(rad * 2.0));
      buf.push(clamp01(rad * 2.0));
      buf.push(clamp01(0.28 + 0.72 * clamp01(0.3 * presence + 0.7 * act)));
      buf.push(clamp01(clamp01(warmBase + 0.15 * Math.abs(swing))));
      buf.push(clamp01(wrap01(0.5 + 0.5 * swing)));
    }
    return { styleId: 3, kind: PRIM_KIND_DOT, count: 10, primitives: buf };
  }

  if (styleId === 4) {
    const buf: number[] = [];
    // 4: horizon-spark-ticks (16 horizon spark ticks flaring on syllable onsets)
    for (let i = 0; i < 16; i++) {
      const u = i / 15.0;
      const x = -0.90 + 1.80 * u;
      const band = interpBand(sig, u);
      const flare = clamp01(band * act + sig.onsetPulse * (0.5 + 0.5 * sin64(ph * 2.1 + i * 1.1)));
      const y = -0.10 + 0.62 * flare;
      const rad = 0.05 + 0.14 * flare;
      buf.push(clamp(x, -1, 1));
      buf.push(clamp(y, -1, 1));
      buf.push(clamp01(rad));
      buf.push(clamp01(0.04));
      buf.push(clamp01(0.10 + 0.45 * flare));
      buf.push(clamp01(0.20 + 0.80 * flare));
      buf.push(clamp01(clamp01(warmBase + 0.25 * sig.onsetPulse)));
      buf.push(clamp01(wrap01(u + ph * 0.2)));
    }
    return { styleId: 4, kind: PRIM_KIND_DOT, count: 16, primitives: buf };
  }

  // 5: morse-ember-pulse (12 horizontal dot-dash capsules modulated by ZCR)
  const buf: number[] = [];
  for (let i = 0; i < 12; i++) {
    const u = i / 11.0;
    const x = -0.86 + 1.72 * u;
    const band = interpBand(sig, u);
    const dashGate = sin64(ph * 1.8 + i * 1.35 + sig.zcr * 4.0) > 0 ? 1.0 : 0.0;
    const w = 0.05 + (0.04 + 0.12 * dashGate) * (0.4 + 0.6 * act);
    const h = 0.08 + 0.22 * band * act;
    const alpha = 0.22 + 0.78 * clamp01(presence * 0.35 + (band + 0.35 * dashGate) * act);
    buf.push(clamp(x, -1, 1));
    buf.push(clamp(0, -1, 1));
    buf.push(clamp01(h * 0.5));
    buf.push(clamp01(w));
    buf.push(clamp01(h));
    buf.push(clamp01(alpha));
    buf.push(clamp01(clamp01(warmBase + 0.20 * dashGate)));
    buf.push(clamp01(wrap01(u + 0.3 * dashGate)));
  }
  return { styleId: 5, kind: PRIM_KIND_DOT, count: 12, primitives: buf };
}

// Family B: Harmonic Bars & Acoustic EQ (6..11)
function evalFamilyB(
  styleId: number,
  stateId: number,
  energy: number,
  presence: number,
  phase: number,
  sig: VoiceSignalState,
  reducedMotion: boolean,
): VoicePrimitiveFrame {
  const ph = reducedMotion ? 0 : phase;
  const warmBase = stateWarmthBias(stateId);
  const act = presence * (0.18 + 0.82 * energy);

  // PLANT:voice_family_b
  if (styleId === 6) {
    const buf: number[] = [];
    // 6: sunlit-eq-bars (16 warm harmonic EQ bars)
    for (let i = 0; i < 16; i++) {
      const u = i / 15.0;
      const x = -0.88 + 1.76 * u;
      const band = interpBand(sig, u);
      const shimmer = 0.85 + 0.15 * sin64(ph * 1.4 + i * 0.5);
      const h = clamp01(0.08 + 0.88 * act * (0.25 + 0.75 * band) * shimmer);
      buf.push(clamp(x, -1, 1));
      buf.push(clamp(0, -1, 1));
      buf.push(clamp01(0.04));
      buf.push(clamp01(0.075));
      buf.push(clamp01(h));
      buf.push(clamp01(0.25 + 0.75 * clamp01(0.3 * presence + h)));
      buf.push(clamp01(clamp01(warmBase * 0.7 + 0.3 * h)));
      buf.push(clamp01(wrap01(u)));
    }
    return { styleId: 6, kind: PRIM_KIND_BAR, count: 16, primitives: buf };
  }

  if (styleId === 7) {
    const buf: number[] = [];
    // 7: glass-prism-columns (12 optical starlight-glass columns)
    for (let i = 0; i < 12; i++) {
      const u = i / 11.0;
      const x = -0.84 + 1.68 * u;
      const arch = 1.0 - 0.45 * Math.abs(u - 0.5) * 2.0;
      const band = interpBand(sig, u);
      const h = clamp01(0.14 + 0.82 * act * arch * (0.35 + 0.65 * band));
      buf.push(clamp(x, -1, 1));
      buf.push(clamp(0, -1, 1));
      buf.push(clamp01(0.06));
      buf.push(clamp01(0.10));
      buf.push(clamp01(h));
      buf.push(clamp01(0.30 + 0.70 * clamp01(0.35 * presence + h * 0.7)));
      buf.push(clamp01(clamp01(warmBase * 0.6 + 0.4 * arch)));
      buf.push(clamp01(wrap01(u + ph * 0.08)));
    }
    return { styleId: 7, kind: PRIM_KIND_BAR, count: 12, primitives: buf };
  }

  if (styleId === 8) {
    const buf: number[] = [];
    // 8: mirror-horizon-eq (16 symmetric bars mirrored above/below y=0)
    for (let i = 0; i < 16; i++) {
      const col = i % 8;
      const top = i < 8 ? 1 : -1;
      const u = col / 7.0;
      const x = -0.82 + 1.64 * u;
      const band = signalBandAt(sig, col);
      const h = clamp01(0.06 + 0.44 * act * (0.3 + 0.7 * band));
      const y = top * (0.06 + h * 0.5);
      buf.push(clamp(x, -1, 1));
      buf.push(clamp(y, -1, 1));
      buf.push(clamp01(0.03));
      buf.push(clamp01(0.08));
      buf.push(clamp01(h));
      buf.push(clamp01(0.22 + 0.78 * clamp01(0.25 * presence + band * act)));
      buf.push(clamp01(clamp01(warmBase + (top > 0 ? 0.12 : -0.10))));
      buf.push(clamp01(wrap01(u)));
    }
    return { styleId: 8, kind: PRIM_KIND_BAR, count: 16, primitives: buf };
  }

  if (styleId === 9) {
    const buf: number[] = [];
    // 9: kinetic-spring-pillars (10 broad kinetic pillars with onset impulse)
    for (let i = 0; i < 10; i++) {
      const u = i / 9.0;
      const x = -0.84 + 1.68 * u;
      const band = interpBand(sig, u);
      const bounce = 0.5 + 0.5 * cos64(ph * 1.9 - i * 0.65);
      const h = clamp01(0.12 + 0.76 * act * (0.35 + 0.65 * band) + 0.22 * sig.onsetPulse * bounce);
      buf.push(clamp(x, -1, 1));
      buf.push(clamp(-0.35 + h * 0.45, -1, 1));
      buf.push(clamp01(0.05));
      buf.push(clamp01(0.12));
      buf.push(clamp01(h));
      buf.push(clamp01(0.26 + 0.74 * h));
      buf.push(clamp01(clamp01(warmBase + 0.22 * sig.onsetPulse)));
      buf.push(clamp01(wrap01(bounce)));
    }
    return { styleId: 9, kind: PRIM_KIND_BAR, count: 10, primitives: buf };
  }

  if (styleId === 10) {
    const buf: number[] = [];
    // 10: stepped-telemetry-vu (24 stepped VU blocks: 8 cols x 3 tiers)
    for (let i = 0; i < 24; i++) {
      const col = i % 8;
      const tier = Math.floor(i / 8);
      const x = -0.84 + col * 0.24;
      const y = -0.42 + tier * 0.42;
      const band = signalBandAt(sig, col) * (0.35 + 0.85 * act);
      const threshold = tier * 0.30;
      const active = band >= threshold ? clamp01((band - threshold) * 3.0) : 0.0;
      const alpha = 0.12 + 0.88 * clamp01(active + 0.12 * presence);
      buf.push(clamp(x, -1, 1));
      buf.push(clamp(y, -1, 1));
      buf.push(clamp01(0.02));
      buf.push(clamp01(0.16));
      buf.push(clamp01(0.24));
      buf.push(clamp01(alpha));
      buf.push(clamp01(clamp01(0.45 + 0.22 * tier + 0.20 * active)));
      buf.push(clamp01(wrap01((col + tier) / 10.0)));
    }
    return { styleId: 10, kind: PRIM_KIND_BAR, count: 24, primitives: buf };
  }

  // 11: slit-aperture-bars (14 narrow precision optical slits)
  const buf: number[] = [];
  for (let i = 0; i < 14; i++) {
    const u = i / 13.0;
    const dist = Math.abs(u - 0.5) * 2.0;
    const x = -0.86 + 1.72 * u;
    const band = interpBand(sig, dist);
    const h = clamp01(0.06 + 0.90 * act * (1.0 - 0.4 * dist) * (0.3 + 0.7 * band));
    buf.push(clamp(x, -1, 1));
    buf.push(clamp(0, -1, 1));
    buf.push(clamp01(0.015));
    buf.push(clamp01(0.032));
    buf.push(clamp01(h));
    buf.push(clamp01(0.24 + 0.76 * h));
    buf.push(clamp01(clamp01(warmBase + 0.25 * (1.0 - dist))));
    buf.push(clamp01(wrap01(dist + ph * 0.1)));
  }
  return { styleId: 11, kind: PRIM_KIND_BAR, count: 14, primitives: buf };
}

// Family C: Organic Waves & Ribbons (12..17)
function evalFamilyC(
  styleId: number,
  stateId: number,
  energy: number,
  presence: number,
  phase: number,
  sig: VoiceSignalState,
  reducedMotion: boolean,
): VoicePrimitiveFrame {
  const ph = reducedMotion ? 0 : phase;
  const warmBase = stateWarmthBias(stateId);
  const act = presence * (0.20 + 0.80 * energy);

  // PLANT:voice_family_c
  if (styleId === 12) {
    const buf: number[] = [];
    // 12: solar-filament-ribbon (24 smooth plasma ribbon nodes)
    for (let i = 0; i < 24; i++) {
      const u = i / 23.0;
      const x = -0.94 + 1.88 * u;
      const env = sin64(u * 3.141592653589793);
      const band = interpBand(sig, u);
      const y = env * act * (0.48 * sin64(u * 9.42477796 + ph * 1.4) + 0.28 * cos64(u * 18.8495559 - ph * 2.1) * band);
      const w = 0.05 + 0.14 * env * (0.3 + 0.7 * band);
      buf.push(clamp(x, -1, 1));
      buf.push(clamp(y, -1, 1));
      buf.push(clamp01(w * 0.5));
      buf.push(clamp01(0.08));
      buf.push(clamp01(w));
      buf.push(clamp01(0.25 + 0.75 * env * clamp01(0.35 * presence + act)));
      buf.push(clamp01(clamp01(warmBase + 0.22 * band)));
      buf.push(clamp01(wrap01(u + ph * 0.12)));
    }
    return { styleId: 12, kind: PRIM_KIND_RIBBON, count: 24, primitives: buf };
  }

  if (styleId === 13) {
    const buf: number[] = [];
    // 13: liquid-mercury-wave (24 dense standing fluid wave nodes)
    for (let i = 0; i < 24; i++) {
      const u = i / 23.0;
      const x = -0.92 + 1.84 * u;
      const env = sin64(u * 3.141592653589793);
      const low = (sig.b0 + sig.b1) * 0.5;
      const high = (sig.b5 + sig.b6 + sig.b7) * 0.3333333;
      const y = env * act * (0.55 * sin64(u * 6.2831853 + ph * 1.1) * (0.4 + 0.6 * low) + 0.24 * sin64(u * 25.13274 + ph * 2.8) * high);
      buf.push(clamp(x, -1, 1));
      buf.push(clamp(y, -1, 1));
      buf.push(clamp01(0.05 + 0.10 * env));
      buf.push(clamp01(0.08));
      buf.push(clamp01(0.08 + 0.16 * Math.abs(y)));
      buf.push(clamp01(0.28 + 0.72 * env));
      buf.push(clamp01(clamp01(0.55 + 0.45 * high)));
      buf.push(clamp01(wrap01(u)));
    }
    return { styleId: 13, kind: PRIM_KIND_RIBBON, count: 24, primitives: buf };
  }

  if (styleId === 14) {
    const buf: number[] = [];
    // 14: calligraphic-twin-wave (24 nodes: 12 primary + 12 counter-phase echo)
    for (let i = 0; i < 24; i++) {
      const isEcho = i >= 12;
      const idx = isEcho ? i - 12 : i;
      const u = idx / 11.0;
      const x = -0.90 + 1.80 * u;
      const env = sin64(u * 3.141592653589793);
      const band = interpBand(sig, u);
      const sign = isEcho ? -0.68 : 1.0;
      const y = sign * env * act * (0.58 * sin64(u * 8.2 + ph * (isEcho ? -1.2 : 1.5)) * (0.35 + 0.65 * band));
      const stroke = 0.04 + 0.16 * env * (isEcho ? 0.6 : 1.0) * (0.3 + 0.7 * act);
      buf.push(clamp(x, -1, 1));
      buf.push(clamp(y, -1, 1));
      buf.push(clamp01(stroke * 0.5));
      buf.push(clamp01(0.12));
      buf.push(clamp01(stroke));
      buf.push(clamp01((isEcho ? 0.52 : 0.92) * clamp01(0.25 + env)));
      buf.push(clamp01(clamp01(warmBase + (isEcho ? -0.15 : 0.15))));
      buf.push(clamp01(wrap01(u)));
    }
    return { styleId: 14, kind: PRIM_KIND_RIBBON, count: 24, primitives: buf };
  }

  if (styleId === 15) {
    const buf: number[] = [];
    // 15: whisper-dunes (20 gentle low-frequency sculpted dunes)
    for (let i = 0; i < 20; i++) {
      const u = i / 19.0;
      const x = -0.92 + 1.84 * u;
      const env = sin64(u * 3.141592653589793);
      const y = -0.22 + env * (0.12 + 0.48 * act * (0.5 + 0.5 * sin64(u * 5.2 + ph * 0.65)));
      buf.push(clamp(x, -1, 1));
      buf.push(clamp(y, -1, 1));
      buf.push(clamp01(0.06));
      buf.push(clamp01(0.10));
      buf.push(clamp01(0.14 + 0.28 * clamp01(y + 0.4)));
      buf.push(clamp01(0.22 + 0.72 * env));
      buf.push(clamp01(clamp01(warmBase * 0.85)));
      buf.push(clamp01(wrap01(u)));
    }
    return { styleId: 15, kind: PRIM_KIND_RIBBON, count: 20, primitives: buf };
  }

  if (styleId === 16) {
    const buf: number[] = [];
    // 16: dual-helix-lissajous (24 braided double-helix Lissajous nodes in 3:2 ratio)
    for (let i = 0; i < 24; i++) {
      const strand = i >= 12 ? 1 : 0;
      const idx = strand === 1 ? i - 12 : i;
      const u = idx / 11.0;
      const theta = u * 6.283185307179586 + ph * 0.95 + strand * 3.141592653589793;
      const x = -0.84 + 1.68 * u;
      const y = sin64(theta * 1.5) * (0.14 + 0.56 * act * (0.4 + 0.6 * interpBand(sig, u)));
      const depth = 0.5 + 0.5 * cos64(theta);
      buf.push(clamp(x, -1, 1));
      buf.push(clamp(y, -1, 1));
      buf.push(clamp01(0.05 + 0.10 * depth));
      buf.push(clamp01(0.08));
      buf.push(clamp01(0.08 + 0.12 * depth));
      buf.push(clamp01(0.24 + 0.76 * depth));
      buf.push(clamp01(clamp01(warmBase * 0.7 + 0.3 * depth)));
      buf.push(clamp01(wrap01(theta / 6.283185307179586)));
    }
    return { styleId: 16, kind: PRIM_KIND_RIBBON, count: 24, primitives: buf };
  }

  // 17: horizon-breath-line (20 taut horizon string nodes bowing gently)
  const buf: number[] = [];
  for (let i = 0; i < 20; i++) {
    const u = i / 19.0;
    const x = -0.94 + 1.88 * u;
    const bow = sin64(u * 3.141592653589793);
    const y = bow * act * 0.42 * sin64(ph * 0.9 + u * 3.141592653589793);
    buf.push(clamp(x, -1, 1));
    buf.push(clamp(y, -1, 1));
    buf.push(clamp01(0.03));
    buf.push(clamp01(0.09));
    buf.push(clamp01(0.04 + 0.08 * bow * act));
    buf.push(clamp01(0.30 + 0.70 * clamp01(0.3 * presence + bow * act)));
    buf.push(clamp01(warmBase));
    buf.push(clamp01(wrap01(u)));
  }
  return { styleId: 17, kind: PRIM_KIND_RIBBON, count: 20, primitives: buf };
}

// Family D: Radial, Corona & Orbital (18..22)
function evalFamilyD(
  styleId: number,
  stateId: number,
  energy: number,
  presence: number,
  phase: number,
  sig: VoiceSignalState,
  reducedMotion: boolean,
): VoicePrimitiveFrame {
  const ph = reducedMotion ? 0 : phase;
  const warmBase = stateWarmthBias(stateId);
  const act = presence * (0.20 + 0.80 * energy);

  // PLANT:voice_family_d
  if (styleId === 18) {
    const buf: number[] = [];
    // 18: sun-corona-ring (24 radial solar corona perimeter flares)
    for (let i = 0; i < 24; i++) {
      const u = i / 24.0;
      const angle = u * 6.283185307179586 + ph * 0.28;
      const band = interpBand(sig, (i % 8) / 7.0);
      const r = 0.42 + 0.34 * act * (0.35 + 0.65 * band) * (0.7 + 0.3 * sin64(angle * 3.0 - ph * 1.4));
      const x = cos64(angle) * r;
      const y = sin64(angle) * r;
      buf.push(clamp(x, -1, 1));
      buf.push(clamp(y, -1, 1));
      buf.push(clamp01(0.06 + 0.14 * band * act));
      buf.push(clamp01(0.08));
      buf.push(clamp01(0.14 + 0.32 * band * act));
      buf.push(clamp01(0.28 + 0.72 * clamp01(0.3 * presence + band * act)));
      buf.push(clamp01(clamp01(warmBase + 0.2 * band)));
      buf.push(clamp01(u));
    }
    return { styleId: 18, kind: PRIM_KIND_RADIAL, count: 24, primitives: buf };
  }

  if (styleId === 19) {
    const buf: number[] = [];
    // 19: concentric-acoustic-ripples (12 expanding concentric pressure rings)
    for (let i = 0; i < 12; i++) {
      const u = wrap01(i / 12.0 + ph * 0.08);
      const band = interpBand(sig, u);
      const r = 0.12 + 0.84 * u;
      const fade = (1.0 - u) * clamp01(0.25 * presence + act * (0.5 + 0.5 * band) + 0.3 * sig.onsetPulse);
      buf.push(clamp(0, -1, 1));
      buf.push(clamp(0, -1, 1));
      buf.push(clamp01(r));
      buf.push(clamp01(r * 2.0));
      buf.push(clamp01(r * 2.0));
      buf.push(clamp01(fade));
      buf.push(clamp01(clamp01(warmBase * (1.0 - 0.3 * u))));
      buf.push(clamp01(u));
    }
    return { styleId: 19, kind: PRIM_KIND_RADIAL, count: 12, primitives: buf };
  }

  if (styleId === 20) {
    const buf: number[] = [];
    // 20: sunburst-spokes (16 radial sunburst spokes extending per spectral band)
    for (let i = 0; i < 16; i++) {
      const u = i / 16.0;
      const angle = u * 6.283185307179586 + ph * 0.18;
      const band = signalBandAt(sig, i % 8);
      const len = 0.16 + 0.68 * act * (0.3 + 0.7 * band);
      const x = cos64(angle) * (0.22 + len * 0.5);
      const y = sin64(angle) * (0.22 + len * 0.5);
      buf.push(clamp(x, -1, 1));
      buf.push(clamp(y, -1, 1));
      buf.push(clamp01(0.04));
      buf.push(clamp01(0.045));
      buf.push(clamp01(len));
      buf.push(clamp01(0.25 + 0.75 * clamp01(0.25 * presence + band * act)));
      buf.push(clamp01(clamp01(warmBase + 0.2 * band)));
      buf.push(clamp01(u));
    }
    return { styleId: 20, kind: PRIM_KIND_RADIAL, count: 16, primitives: buf };
  }

  if (styleId === 21) {
    const buf: number[] = [];
    // 21: orbital-eclipse-arcs (12 curved orbital eclipse arcs)
    for (let i = 0; i < 12; i++) {
      const ring = i % 3;
      const seg = Math.floor(i / 3);
      const dir = ring === 1 ? -1.0 : 1.0;
      const angle = seg * 1.5707963267948966 + dir * ph * (0.35 + 0.18 * ring);
      const r = 0.28 + ring * 0.24 + 0.08 * act * signalBandAt(sig, (i % 8));
      const x = cos64(angle) * r;
      const y = sin64(angle) * r;
      buf.push(clamp(x, -1, 1));
      buf.push(clamp(y, -1, 1));
      buf.push(clamp01(r));
      buf.push(clamp01(0.22 + 0.18 * act));
      buf.push(clamp01(0.05 + 0.04 * act));
      buf.push(clamp01(0.26 + 0.74 * clamp01(0.35 * presence + act * 0.7)));
      buf.push(clamp01(clamp01(warmBase - 0.1 * ring + 0.2 * act)));
      buf.push(clamp01(wrap01(angle / 6.283185307179586)));
    }
    return { styleId: 21, kind: PRIM_KIND_RADIAL, count: 12, primitives: buf };
  }

  // 22: chladni-resonance-ring (24 standing-wave Chladni nodal ring points)
  const buf: number[] = [];
  const modeM = 3.0 + Math.floor(sig.zcr * 4.0);
  for (let i = 0; i < 24; i++) {
    const u = i / 24.0;
    const angle = u * 6.283185307179586;
    const nodal = cos64(modeM * angle + ph * 0.85);
    const r = 0.48 + 0.34 * act * nodal * (0.4 + 0.6 * interpBand(sig, u));
    const x = cos64(angle) * r;
    const y = sin64(angle) * r;
    buf.push(clamp(x, -1, 1));
    buf.push(clamp(y, -1, 1));
    buf.push(clamp01(0.05 + 0.11 * Math.abs(nodal) * act));
    buf.push(clamp01(0.08));
    buf.push(clamp01(0.08));
    buf.push(clamp01(0.24 + 0.76 * Math.abs(nodal)));
    buf.push(clamp01(clamp01(warmBase + 0.25 * nodal)));
    buf.push(clamp01(u));
  }
  return { styleId: 22, kind: PRIM_KIND_RADIAL, count: 24, primitives: buf };
}

// Family E: Volumetric, Optical & Material Fields (23..27)
function evalFamilyE(
  styleId: number,
  stateId: number,
  energy: number,
  presence: number,
  phase: number,
  sig: VoiceSignalState,
  reducedMotion: boolean,
): VoicePrimitiveFrame {
  const ph = reducedMotion ? 0 : phase;
  const warmBase = stateWarmthBias(stateId);
  const act = presence * (0.20 + 0.80 * energy);

  // PLANT:voice_family_e
  if (styleId === 23) {
    const buf: number[] = [];
    // 23: ferrofluid-amber-blob (20 magnetic ferrofluid contour lobes)
    for (let i = 0; i < 20; i++) {
      const u = i / 20.0;
      const angle = u * 6.283185307179586;
      const band = interpBand(sig, (i % 8) / 7.0);
      const spike = 0.5 + 0.5 * sin64(angle * 5.0 + ph * 1.45);
      const r = 0.32 + 0.48 * act * spike * (0.35 + 0.65 * band);
      const x = cos64(angle) * r;
      const y = sin64(angle) * r;
      buf.push(clamp(x, -1, 1));
      buf.push(clamp(y, -1, 1));
      buf.push(clamp01(0.10 + 0.18 * spike * act));
      buf.push(clamp01(0.14));
      buf.push(clamp01(0.14));
      buf.push(clamp01(0.32 + 0.68 * clamp01(0.35 * presence + band * act)));
      buf.push(clamp01(clamp01(warmBase + 0.2 * spike)));
      buf.push(clamp01(u));
    }
    return { styleId: 23, kind: PRIM_KIND_FIELD, count: 20, primitives: buf };
  }

  if (styleId === 24) {
    const buf: number[] = [];
    // 24: caustic-light-band (18 refracted optical caustic focal nodes)
    for (let i = 0; i < 18; i++) {
      const u = i / 17.0;
      const x = -0.90 + 1.80 * u + 0.06 * sin64(ph * 1.2 + i * 0.9) * act;
      const band = interpBand(sig, u);
      const focus = 0.5 + 0.5 * cos64(u * 12.56637 + ph * 1.6);
      const y = 0.24 * sin64(u * 9.0 - ph * 0.9) * act;
      const w = 0.06 + 0.18 * focus * (0.3 + 0.7 * act);
      const h = 0.12 + 0.42 * band * act;
      buf.push(clamp(x, -1, 1));
      buf.push(clamp(y, -1, 1));
      buf.push(clamp01(0.08 + 0.12 * focus));
      buf.push(clamp01(w));
      buf.push(clamp01(h));
      buf.push(clamp01(0.20 + 0.80 * focus * clamp01(0.3 * presence + band * act)));
      buf.push(clamp01(clamp01(warmBase + 0.25 * focus)));
      buf.push(clamp01(wrap01(u + ph * 0.1)));
    }
    return { styleId: 24, kind: PRIM_KIND_FIELD, count: 18, primitives: buf };
  }

  if (styleId === 25) {
    const buf: number[] = [];
    // 25: ember-spark-swarm (20 buoyant rising ember sparks)
    for (let i = 0; i < 20; i++) {
      const seed = (i * 0.6180339887498949) - Math.floor(i * 0.6180339887498949);
      const life = wrap01(seed + ph * (0.12 + 0.16 * act));
      const band = signalBandAt(sig, i % 8);
      const x = -0.84 + 1.68 * seed + 0.12 * sin64(ph * 1.7 + i * 1.3) * act;
      const y = -0.72 + life * (1.28 + 0.28 * sig.onsetPulse);
      const alpha = sin64(life * 3.141592653589793) * clamp01(0.25 * presence + act * (0.5 + 0.5 * band));
      const rad = 0.04 + 0.11 * (1.0 - life * 0.5) * (0.4 + 0.6 * band);
      buf.push(clamp(x, -1, 1));
      buf.push(clamp(y, -1, 1));
      buf.push(clamp01(rad));
      buf.push(clamp01(rad * 2.0));
      buf.push(clamp01(rad * 2.0));
      buf.push(clamp01(alpha));
      buf.push(clamp01(clamp01(warmBase + 0.25 * (1.0 - life))));
      buf.push(clamp01(life));
    }
    return { styleId: 25, kind: PRIM_KIND_FIELD, count: 20, primitives: buf };
  }

  if (styleId === 26) {
    const buf: number[] = [];
    // 26: waterfall-spectrogram (24 rolling 8-band x 3-depth spectrogram tiles)
    for (let i = 0; i < 24; i++) {
      const col = i % 8;
      const depth = Math.floor(i / 8);
      const x = -0.84 + col * 0.24;
      const y = 0.42 - depth * 0.42;
      const rawBand = signalBandAt(sig, col);
      const decayed = clamp01(rawBand * exp64(-0.45 * depth) * (0.45 + 0.75 * act) * (0.85 + 0.15 * sin64(ph * 1.1 - depth * 1.1 + col * 0.4)));
      buf.push(clamp(x, -1, 1));
      buf.push(clamp(y, -1, 1));
      buf.push(clamp01(0.04));
      buf.push(clamp01(0.18));
      buf.push(clamp01(0.26));
      buf.push(clamp01(0.14 + 0.86 * decayed));
      buf.push(clamp01(clamp01(warmBase - 0.15 * depth + 0.30 * decayed)));
      buf.push(clamp01(wrap01((col + depth) / 10.0)));
    }
    return { styleId: 26, kind: PRIM_KIND_FIELD, count: 24, primitives: buf };
  }

  // 27: crystalline-chime-petals (16 symmetric 8-fold crystalline petals)
  const buf: number[] = [];
  for (let i = 0; i < 16; i++) {
    const layer = i >= 8 ? 1 : 0;
    const idx = layer === 1 ? i - 8 : i;
    const angle = idx * 0.7853981633974483 + layer * 0.39269908169872414 + ph * (layer === 0 ? 0.22 : -0.16);
    const band = signalBandAt(sig, idx);
    const bloom = (layer === 0 ? 0.34 : 0.56) * (0.45 + 0.55 * act * (0.4 + 0.6 * band));
    const x = cos64(angle) * bloom;
    const y = sin64(angle) * bloom;
    buf.push(clamp(x, -1, 1));
    buf.push(clamp(y, -1, 1));
    buf.push(clamp01(0.08 + 0.14 * bloom));
    buf.push(clamp01(0.12 + 0.16 * band * act));
    buf.push(clamp01(0.22 + 0.30 * bloom));
    buf.push(clamp01(0.26 + 0.74 * clamp01(0.35 * presence + band * act)));
    buf.push(clamp01(clamp01(warmBase + (layer === 0 ? 0.15 : -0.10))));
    buf.push(clamp01(wrap01(angle / 6.283185307179586)));
  }
  return { styleId: 27, kind: PRIM_KIND_FIELD, count: 16, primitives: buf };
}

export function evalVoiceStyle(
  styleIdRaw: number,
  stateId: number,
  energy: number,
  presence: number,
  phase: number,
  sig: VoiceSignalState,
  reducedMotion: boolean,
): VoicePrimitiveFrame {
  const id = Math.floor(clamp(styleIdRaw, 0, 27));
  if (id <= 5) return evalFamilyA(id, stateId, energy, presence, phase, sig, reducedMotion);
  if (id <= 11) return evalFamilyB(id, stateId, energy, presence, phase, sig, reducedMotion);
  if (id <= 17) return evalFamilyC(id, stateId, energy, presence, phase, sig, reducedMotion);
  if (id <= 22) return evalFamilyD(id, stateId, energy, presence, phase, sig, reducedMotion);
  return evalFamilyE(id, stateId, energy, presence, phase, sig, reducedMotion);
}
