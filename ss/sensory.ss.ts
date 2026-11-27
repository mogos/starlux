import { clamp01, exp64, frameUs } from "./physics/math.ss.ts";
import type { LuxEvent } from "./lux/events.ss.ts";

export type LuxSound = { readonly gain: number; readonly frequencyHz: number; readonly durationUs: number };
export type LuxHaptics = { readonly intensity: number; readonly sharpness: number; readonly durationUs: number };
export type VoiceEnvelopePort = { readonly level: number };
export type SensoryEnvelope = { readonly sound: LuxSound; readonly haptics: LuxHaptics };

export function idleVoice(): VoiceEnvelopePort { return { level: 0 }; }

export function smoothVoice(
  state: VoiceEnvelopePort, sample: number, dtUs: number, reducedMotion: boolean,
): VoiceEnvelopePort {
  if (reducedMotion) return idleVoice();
  const level = clamp01(state.level);
  const input = clamp01(sample);
  let tau = 115000;
  if (input > level) tau = 24000;
  const smooth = input + (level - input) * exp64(-frameUs(dtUs) / tau);
  if (smooth < 0.0001 && input === 0) return idleVoice();
  return { level: clamp01(smooth) };
}

function silence(): SensoryEnvelope {
  return { sound: { gain: 0, frequencyHz: 0, durationUs: 0 }, haptics: { intensity: 0, sharpness: 0, durationUs: 0 } };
}

export function synthesizeSensory(event: LuxEvent, resting: boolean, reducedMotion: boolean): SensoryEnvelope {
  if (resting || reducedMotion) return silence();
  const strength = clamp01(event.intensity);
  if (strength === 0) return silence();
  let frequency = 0;
  let sharpness = 0;
  let duration = 0;
  if (event.kind === "IMPULSE") {
    frequency = 246;
    sharpness = 0.43;
    duration = 26000;
  } else if (event.kind === "SNAP_ENGAGE") {
    frequency = 392;
    sharpness = 0.72;
    duration = 18000;
  } else if (event.kind === "SNAP_RELEASE") {
    frequency = 294;
    sharpness = 0.32;
    duration = 13000;
  } else if (event.kind === "BOUNDARY_HIT") {
    frequency = 160;
    sharpness = 0.26;
    duration = 33000;
  } else {
    return silence();
  }
  return {
    sound: { gain: strength * 0.14, frequencyHz: frequency, durationUs: duration },
    haptics: { intensity: strength * 0.7, sharpness: sharpness, durationUs: duration },
  };
}
