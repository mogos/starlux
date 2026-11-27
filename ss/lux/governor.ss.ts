import { clamp, clamp01 } from "../physics/math.ss.ts";
import type { SpatialPhysicsConfig } from "./knobs.ss.ts";

export type ThermalTier = "nominal" | "fair" | "serious" | "critical";
export type ReducedMotionPolicy = "full" | "reduce" | "off";
export type GovernorInput = {
  readonly heldTokens: number;
  readonly motionEnergy: number;
  readonly displayHz: number;
  readonly thermalTier: ThermalTier;
  readonly motionPolicy: ReducedMotionPolicy;
  readonly hidden: boolean;
};
export type FrameGovernor = {
  readonly hz: number;
  readonly lod: number;
  readonly particleScale: number;
  readonly ambientHz: number;
  readonly maxBackdropBlurPx: number;
  readonly allowSvgDisplacement: boolean;
  readonly allowBoxReflect: boolean;
};

export function thermalLevel(tier: ThermalTier): number {
  if (tier === "critical") return 3;
  if (tier === "serious") return 2;
  if (tier === "fair") return 1;
  return 0;
}

export function governFrames(input: GovernorInput, knobs: SpatialPhysicsConfig): FrameGovernor {
  const lod = thermalLevel(input.thermalTier);
  let cap = clamp(input.displayHz, 0, 120);
  if (lod === 1 && cap > 60) cap = 60;
  if (lod === 2 && cap > 30) cap = 30;
  if (lod === 3 && cap > 15) cap = 15;
  if (input.motionPolicy === "reduce" && cap > 30) cap = 30;
  if (input.motionPolicy === "off" || input.hidden || !(input.heldTokens > 0)) cap = 0;
  const energy = clamp01(input.motionEnergy);
  let hz = 0;
  if (cap >= 120 && energy >= 0.5) hz = 120;
  else if (cap >= 60 && energy >= 0.05) hz = 60;
  else if (cap >= 30) hz = 30;
  else if (cap >= 15) hz = 15;

  let particles = clamp01(1 - lod * knobs.thermalLodScale / 3);
  if (input.motionPolicy !== "full" || lod === 3 || hz === 0) particles = 0;
  let ambient = 0;
  let blur = 0;
  if (knobs.enableLivingBackdrop) {
    blur = clamp(knobs.maxBackdropBlurPx * clamp01(1 - lod * knobs.thermalLodScale / 3), 0, 16);
    if (particles > 0) ambient = clamp(knobs.ambientBackdropFpsCap, 0, 15) * particles;
  }
  return {
    hz: hz, lod: lod, particleScale: particles, ambientHz: ambient, maxBackdropBlurPx: blur,
    allowSvgDisplacement: false, allowBoxReflect: false,
  };
}
