// Starlux Audio Format & Fixed-Point Constants (4-target Starscript: TS, Rust, WASM, C17)
// Canonical rate: 48,000 stereo frames/s, Q15 signed sample arithmetic, zero host dependencies.

export function audioSampleRate(): number { return 48000; }
export function audioMaxVoices(): number { return 6; }
export function audioMaxModes(): number { return 4; }
export function audioMaxPending(): number { return 64; }
export function audioMaxHits(): number { return 4; }
export function audioMaxBlockFrames(): number { return 256; }
export function audioStealFadeFrames(): number { return 96; }
export function audioAttackMaxFrames(): number { return 72; }
export function audioReleaseMaxFrames(): number { return 96; }
export function audioCeilingS16(): number { return 23197; }          // -3 dBFS exact ceiling
export function audioMasterTrimQ15(): number { return 19661; }       // 0.6 * 32768
export function audioCompThresholdQ15(): number { return 4125; }     // -18 dBFS * 32768
export function audioLingerUs(): number { return 1600000; }          // 1.6 s warm-context linger
export function audioMaterialCount(): number { return 6; }
export function audioCatalogCount(): number { return 250; }
export function audioFamilyCount(): number { return 10; }

// Material ordinals: G, A, T, V, P, C = 0..5
export function matGlass(): number { return 0; }
export function matAlabaster(): number { return 1; }
export function matTitanium(): number { return 2; }
export function matVellum(): number { return 3; }
export function matPlasma(): number { return 4; }
export function matCeramic(): number { return 5; }

// Articulation ordinals: p, k, b, u, d, w, s, t, X = 0..8
export function artPitched(): number { return 0; }
export function artStrike(): number { return 1; }
export function artBody(): number { return 2; }
export function artUpGlide(): number { return 3; }
export function artDownGlide(): number { return 4; }
export function artBrush(): number { return 5; }
export function artSoft(): number { return 6; }
export function artDetent(): number { return 7; }
export function artExact(): number { return 8; }

// Cooldown class ordinals
export function classNone(): number { return 0; }
export function classHover(): number { return 1; }       // 70 ms across subjects
export function classDetent(): number { return 2; }      // 60 ms across subjects
export function classContact(): number { return 3; }     // 24 ms across subjects
export function classAlert(): number { return 4; }       // 250 ms across subjects

// Command operation ordinals
export function opPlay(): number { return 0; }
export function opCancel(): number { return 1; }
export function opMute(): number { return 2; }

// Noise exciter kinds
export function noiseLcg(): number { return 0; }
export function noiseXorshift(): number { return 1; }

export type AudioHit = {
  readonly startFrames: number;     // frame offset at 1x rate
  readonly frames: number;          // duration in frames at 1x rate
  readonly hz10: number;            // tenths of a hertz (e.g. 4400 = 440.0 Hz)
  readonly endRatioQ16: number;     // 65536 = 1.0 (no glide)
  readonly gainQ15: number;         // 0..32768
  readonly brightQ15: number;       // 0..32768
  readonly noiseQ15: number;        // 0..32768
  readonly material: number;        // 0..5
  readonly noiseKind: number;       // 0 LCG, 1 xorshift32
  readonly attackFrames: number;    // 0 = default min(72, floor(N/4))
  readonly noiseDecayFrames: number;// 0 = default 576 (12 ms)
  readonly noiseStopFrames: number; // 0 = default 1920 (40 ms)
  readonly decayFactorQ15: number;  // 32768 = 1.0x material decay slope
  readonly exactDetune: boolean;    // true for M3 X-scores (.9991 / 1.0013)
};

export type AudioCue = {
  readonly id: number;              // 1..250
  readonly slug: string;
  readonly family: number;          // 0..9
  readonly description: string;
  readonly recipe: string;
  readonly durationMs: number;
  readonly peakDbfs: number;
  readonly peakQ15: number;         // floor(32768 * 10^(peakDbfs/20))
  readonly cooldownMs: number;
  readonly cooldownFrames: number;
  readonly classId: number;         // 0..4
  readonly triggerKind: string;     // LuxEventKind
  readonly triggerTransition: string;
  readonly isKinetic: boolean;
  readonly hits: readonly AudioHit[];
};

export type AudioCommand = {
  readonly atFrame: number;         // canonical 48 kHz frame
  readonly seq: number;             // monotone publication order
  readonly hitIndex: number;        // child hit index within cue (0..3)
  readonly subject: number;         // UI subject ID
  readonly epoch: number;           // cancellation generation
  readonly seed: number;            // initial PRNG seed
  readonly cueId: number;           // 1..250
  readonly gainQ15: number;         // 0..32768 multiplier
  readonly pan: number;             // -32767..32767
  readonly rate100: number;         // 10..400 (0.10x..4.00x)
  readonly materialOverride: number;// -1 = use hit material, 0..5 = override
  readonly pitchCents: number;      // -1200..1200 velocity pitch shift
  readonly op: number;              // 0=play, 1=cancel, 2=mute
};

export type ModeState = {
  readonly active: boolean;
  readonly phase: number;           // 0..4294967295 (unsigned 32-bit turn)
  readonly startInc: number;        // starting phase increment
  readonly endInc: number;          // ending phase increment (glide)
  readonly glideFrames: number;     // glide span in frames
  readonly weightQ15: number;       // mode amplitude weight
  readonly envQ15: number;          // current exponential decay (Q24 scaled as integer 0..16777216)
  readonly decayMulQ24: number;     // per-sample exponential decay multiplier (0..16777216)
  readonly totalFrames: number;     // mode lifetime
};

export type VoiceSlot = {
  readonly state: number;           // 0=free, 1=sounding, 2=steal-fade
  readonly admitOrder: number;      // monotone order for oldest-steal
  readonly age: number;             // samples rendered since start
  readonly totalFrames: number;     // total hit frames (scaled)
  readonly attackFrames: number;    // raised-cosine attack length
  readonly releaseFrames: number;   // raised-cosine release length
  readonly gainQ15: number;         // hit gain
  readonly panLQ15: number;         // left equal-power gain 0..32768
  readonly panRQ15: number;         // right equal-power gain 0..32768
  readonly noiseKind: number;       // 0=LCG, 1=xorshift32
  readonly noiseSeed: number;       // PRNG state
  readonly noiseEnvQ24: number;     // noise exponential envelope (0..16777216)
  readonly noiseMulQ24: number;     // noise decay multiplier per sample
  readonly noiseStopFrames: number; // stop noise after this frame
  readonly b0Q29: number;           // bandpass b0 (b2 = -b0)
  readonly a1Q29: number;           // bandpass a1
  readonly a2Q29: number;           // bandpass a2
  readonly x1: number;              // DF-I x[n-1]
  readonly x2: number;              // DF-I x[n-2]
  readonly y1: number;              // DF-I y[n-1]
  readonly y2: number;              // DF-I y[n-2]
  readonly fadeIndex: number;       // 0..96 during steal/cancel fade
  readonly subject: number;
  readonly epoch: number;
  readonly cueId: number;
  readonly modes: readonly ModeState[];
  readonly hasReplacement: boolean;
  readonly replacement: AudioCommand;
};

export type RenderState = {
  readonly frame: number;
  readonly serial: number;
  readonly cancelGeneration: number;
  readonly muted: boolean;
  readonly compGainQ15: number;     // smoothed compressor gain 0..32768
  readonly dcX1L: number;
  readonly dcY1L: number;
  readonly dcX1R: number;
  readonly dcY1R: number;
  readonly peakHoldS16: number;
  readonly droppedCount: number;
  readonly stealCount: number;
  readonly maxSimultaneous: number;
  readonly quantaRendered: number;
  readonly voices: readonly VoiceSlot[];
  readonly pending: readonly AudioCommand[];
};

export type RenderBlockResult = {
  readonly state: RenderState;
  readonly pcmS16: readonly number[]; // interleaved L,R s16 integers
  readonly renderedFrames: number;
  readonly activeVoices: number;
};

export function clampInt(value: number, low: number, high: number): number {
  const v = Math.floor(value);
  if (v < low) return low;
  if (v > high) return high;
  return v;
}

export function clampRate100(rate100: number): number {
  return clampInt(rate100, 10, 400);
}

export function clampS16(value: number): number {
  return clampInt(value, -32767, 32767);
}

export function roundHalfToEven(value: number): number {
  const f = Math.floor(value);
  const diff = value - f;
  if (diff > 0.5) return f + 1;
  if (diff < 0.5) return f;
  const half = Math.floor(f / 2);
  if (f === half * 2) return f;
  return f + 1;
}

export function usToFrames(deltaUs: number): number {
  if (deltaUs <= 0) return 0;
  const secs = Math.floor(deltaUs / 1000000);
  const remUs = deltaUs - secs * 1000000;
  return secs * 48000 + Math.floor((remUs * 48 + 500) / 1000);
}

export function msToFrames(ms: number): number {
  if (ms <= 0) return 0;
  return Math.floor(ms * 48 + 0.5);
}

export function s16ToF32Exact(sampleS16: number): number {
  const s = clampInt(sampleS16, -32768, 32767);
  if (s === 0) return 0;
  return s / 32768;
}

export function f32ToS16Exact(sampleF32: number): number {
  if (!(sampleF32 >= -1 && sampleF32 <= 1)) {
    if (sampleF32 > 1) return 32767;
    if (sampleF32 < -1) return -32768;
    return 0;
  }
  const scaled = sampleF32 * 32768;
  const r = roundHalfToEven(scaled);
  return clampInt(r, -32768, 32767);
}

export function classCooldownMs(classId: number): number {
  if (classId === 1) return 70;   // hover
  if (classId === 2) return 60;   // continuous detent
  if (classId === 3) return 24;   // button contact
  if (classId === 4) return 250;  // alert
  return 0;
}

export function emptyCommand(): AudioCommand {
  return {
    atFrame: 0,
    seq: 0,
    hitIndex: 0,
    subject: 0,
    epoch: 0,
    seed: 7,
    cueId: 0,
    gainQ15: 0,
    pan: 0,
    rate100: 100,
    materialOverride: -1,
    pitchCents: 0,
    op: 0,
  };
}

export function wrapU32(value: number): number {
  const m = value - Math.floor(value / 4294967296) * 4294967296;
  if (m < 0) return m + 4294967296;
  return m;
}

export function frameDiff(target: number, current: number): number {
  const diff = wrapU32(target - current);
  if (diff >= 2147483648) return diff - 4294967296;
  return diff;
}
