import { unitLight } from "./optics.ss.ts";
import type { LightPreset, LightSlot } from "./types.ss.ts";

export type LightPlanStep = {
  readonly preset: LightPreset;
  readonly slot: LightSlot;
  readonly gain: number;
  readonly startUs: number;
  readonly durationUs: number;
  readonly polarity: number;
};

export type LightEffectPlan = {
  readonly steps: readonly LightPlanStep[];
  readonly durationUs: number;
};

// Finite children own [start, end). An event-only child holds its resolved state.
export function lightStepGain(
  gain: number, startUs: number, durationUs: number, elapsedUs: number,
  intensity: number, pinned: boolean, staticEffect: boolean,
): number {
  if (pinned) {
    if (startUs !== 0 || !staticEffect) return 0;
  } else if (elapsedUs < startUs) return 0;
  if (durationUs === 0) return gain * unitLight(intensity);
  const t = (elapsedUs - startUs) / durationUs;
  if (t >= 1) return 0;
  const envelope = t < .2 ? t / .2 : (1 - t) / .8;
  return unitLight(envelope) * gain * unitLight(intensity);
}

export function lightStepProgress(startUs: number, durationUs: number, elapsedUs: number): number {
  if (durationUs === 0) return 1;
  return unitLight((elapsedUs - startUs) / durationUs);
}
