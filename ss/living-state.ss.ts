import { clamp, clamp01, cos64 } from "./physics/math.ss.ts";
import { thermalLevel } from "./lux/governor.ss.ts";
import type { ThermalTier } from "./lux/governor.ss.ts";
import type { SpatialPhysicsConfig } from "./lux/knobs.ss.ts";

export type LivingState = "calm" | "listening" | "thinking" | "focus" | "alert" | "circadian";
export type LivingInput = {
  readonly state: LivingState;
  readonly voiceLevel: number;
  readonly timeOfDay: number;
  readonly thermalTier: ThermalTier;
};
export type LivingUniforms = {
  readonly energy: number;
  readonly voice: number;
  readonly hueShift: number;
  readonly turbulence: number;
  readonly rim: number;
  readonly ambientHz: number;
  readonly blurPx: number;
};

export function solveLivingUniforms(input: LivingInput, knobs: SpatialPhysicsConfig): LivingUniforms {
  if (!knobs.enableLivingBackdrop) {
    return { energy: 0, voice: 0, hueShift: 0, turbulence: 0, rim: 0, ambientHz: 0, blurPx: 0 };
  }
  const thermal = thermalLevel(input.thermalTier);
  let motion = clamp01(1 - thermal * knobs.thermalLodScale / 3);
  let energy = 0.16;
  let hue = 0;
  let turbulence = 0.08;
  let voice = 0;
  if (input.state === "listening") {
    voice = clamp01(input.voiceLevel);
    energy = 0.24 + 0.6 * voice;
    hue = 0.08;
    turbulence = 0.12 + 0.3 * voice;
  } else if (input.state === "thinking") {
    energy = 0.53;
    hue = 0.22;
    turbulence = 0.35;
  } else if (input.state === "focus") {
    energy = 0.12;
    hue = -0.08;
    turbulence = 0.04;
  } else if (input.state === "alert") {
    energy = 0.9;
    hue = -0.23;
    turbulence = 0.58;
  } else if (input.state === "circadian") {
    const hour = clamp(input.timeOfDay, 0, 24);
    const daylight = 0.5 + 0.5 * cos64((hour - 12) * 0.2617993877991494);
    energy = 0.06 + 0.14 * daylight;
    hue = -0.15 + 0.29 * daylight;
  }
  let rim = 0;
  if (knobs.enableSpecularRim) rim = 0.15 + 0.55 * energy;
  const blur = clamp(knobs.maxBackdropBlurPx * motion, 0, 16);
  if (thermal === 3) motion = 0;
  return {
    energy: energy * motion, voice: voice * motion, hueShift: hue, turbulence: turbulence * motion,
    rim: rim, ambientHz: clamp(knobs.ambientBackdropFpsCap, 0, 15) * motion, blurPx: blur,
  };
}
