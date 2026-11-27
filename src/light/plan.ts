import { findLightPresetIndex, lightPresets, lightSlotIndex, lightStepGain, lightStepProgress } from "../../ss/light/index.ss.ts";
import type { LightEffectPlan, LightPlanStep, LightPolarity, LightSlot } from "../../ss/light/index.ss.ts";
import type { LuxEvent } from "../lux.ts";
import { presetEmitter } from "./inputs.ts";
import type { LightEmitter, LightPoint, LightPolicy } from "./inputs.ts";

export const emptyLightEffectPlan: LightEffectPlan = { steps: [], durationUs: 0 };
export const maxLightEffectSteps = 32;

export function findLightPreset(id: string) { return lightPresets[findLightPresetIndex(id)]; }

export function lightEffect(id: string, slot?: LightSlot): LightEffectPlan {
  const preset = findLightPreset(id);
  if (!preset) throw new RangeError("Unknown light preset: " + id);
  const role = slot ?? (id.startsWith("presence.") ? "star" : id.startsWith("ambient.") ? "zenith" : "pointer");
  if (lightSlotIndex(role) < 0) throw new RangeError("LightCapacity");
  return { steps: [{ preset, slot: role, gain: 1, startUs: 0, durationUs: preset.durationUs, polarity: -1 }],
    durationUs: preset.durationUs };
}

function assertCapacity(size: number): void {
  if (size > maxLightEffectSteps) throw new RangeError("LightEffectPlan capacity exceeded");
}

function compareSteps(a: LightPlanStep, b: LightPlanStep): number {
  if (a.startUs !== b.startUs) return a.startUs - b.startUs;
  const slots = lightSlotIndex(a.slot) - lightSlotIndex(b.slot);
  if (slots !== 0) return slots;
  if (a.preset.id !== b.preset.id) return a.preset.id < b.preset.id ? -1 : 1;
  return a.polarity - b.polarity;
}

function conflicts(a: LightPlanStep, b: LightPlanStep): boolean {
  if (a.slot !== b.slot || (a.polarity >= 0 && b.polarity >= 0 && a.polarity !== b.polarity)) return false;
  const aEnd = a.durationUs === 0 ? Infinity : a.startUs + a.durationUs;
  const bEnd = b.durationUs === 0 ? Infinity : b.startUs + b.durationUs;
  if (a.preset.event !== b.preset.event || a.preset.binding !== b.preset.binding) return false;
  const aFace = a.preset.polarity;
  const bFace = b.preset.polarity;
  return a.startUs < bEnd && b.startUs < aEnd
    && !(aFace !== "adaptive" && bFace !== "adaptive" && aFace !== bFace);
}

export function layer(...plans: readonly LightEffectPlan[]): LightEffectPlan {
  const children = plans.flatMap(({ steps }) => steps).sort(compareSteps);
  assertCapacity(children.length);
  const steps: LightPlanStep[] = [];
  for (const child of children) {
    const last = steps.at(-1);
    if (last && compareSteps(last, child) === 0 && last.durationUs === child.durationUs) {
      steps[steps.length - 1] = { ...last, gain: last.gain + child.gain };
      continue;
    }
    if (steps.some((previous) => conflicts(previous, child))) {
      throw new RangeError("Ambiguous light slot writer: " + child.slot);
    }
    steps.push(child);
  }
  return { steps, durationUs: plans.reduce((end, plan) => Math.max(end, plan.durationUs), 0) };
}

export function sequence(...plans: readonly LightEffectPlan[]): LightEffectPlan {
  const steps: LightPlanStep[] = [];
  let durationUs = 0;
  for (const plan of plans) {
    assertCapacity(steps.length + plan.steps.length);
    for (const step of plan.steps) steps.push({ ...step, startUs: durationUs + step.startUs });
    durationUs += plan.durationUs;
  }
  if (!Number.isSafeInteger(durationUs)) throw new RangeError("LightEffectPlan duration exceeds integer microseconds");
  return { steps: steps.sort(compareSteps), durationUs };
}

export function attenuate(plan: LightEffectPlan, gain: number): LightEffectPlan {
  if (!Number.isFinite(gain) || gain < 0 || gain > 1) throw new RangeError("Invalid light attenuation");
  return { ...plan, steps: plan.steps.map((step) => ({ ...step, gain: step.gain * gain })) };
}

export function polarityBind(plan: LightEffectPlan, polarity: LightPolarity): LightEffectPlan {
  const binding = polarity === "sunlit-alabaster-light" ? 1 : 0;
  return { ...plan, steps: plan.steps.filter(({ polarity }) => polarity < 0 || polarity === binding)
    .map((step) => ({ ...step, polarity: binding })) };
}

export type LightEventSnapshot = {
  readonly binding: string;
  readonly subject: number;
  readonly surfaceId?: number;
  readonly pose: LightPoint;
  readonly target?: LightPoint;
  // A path is an already resolved physics or layout path, in logical pixels.
  readonly path?: readonly LightPoint[];
};

export type ActiveLightEffect = {
  readonly plan: LightEffectPlan;
  readonly event: LuxEvent;
  readonly snapshot: LightEventSnapshot;
};

export type LightEffectSample = {
  readonly slot: LightSlot;
  readonly emitter: LightEmitter;
  readonly showLightSourceDefault: boolean;
  readonly subject: number;
};

function validPoint(point: LightPoint): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y) && Math.abs(point.x) <= 32767 && Math.abs(point.y) <= 32767;
}

export function resolveLightEffect(plan: LightEffectPlan, event: LuxEvent, snapshot: LightEventSnapshot): ActiveLightEffect {
  if (!Number.isSafeInteger(event.timeUs) || event.timeUs < 0 || !Number.isFinite(event.intensity)) {
    throw new RangeError("Invalid LuxEvent time or intensity");
  }
  const steps = event.subject === snapshot.subject
    ? plan.steps.filter(({ preset }) => preset.event === event.kind && preset.binding === snapshot.binding) : [];
  if (steps.length > 0 && (!validPoint(snapshot.pose) || (snapshot.target && !validPoint(snapshot.target))
    || snapshot.path?.some((point) => !validPoint(point)))) {
    throw new RangeError("Invalid light effect path");
  }
  return { plan: { ...plan, steps }, event: { ...event },
    snapshot: { ...snapshot, pose: { ...snapshot.pose }, ...(snapshot.target && { target: { ...snapshot.target } }),
      ...(snapshot.path && { path: snapshot.path.map((point) => ({ ...point })) }) } };
}

function pathPoint(snapshot: LightEventSnapshot, progress: number): LightPoint {
  const path = snapshot.path;
  if (path && path.length > 1) {
    const phase = progress * (path.length - 1);
    const start = Math.min(path.length - 2, Math.floor(phase));
    return interpolate(path[start]!, path[start + 1]!, phase - start);
  }
  if (path?.[0]) return path[0];
  return interpolate(snapshot.pose, snapshot.target ?? snapshot.pose, progress);
}

function interpolate(a: LightPoint, b: LightPoint, t: number): LightPoint {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function sampleLightEffect(active: ActiveLightEffect, timeUs: number, policy: LightPolicy): LightEffectSample[] {
  const { plan, event, snapshot } = active;
  const elapsed = timeUs - event.timeUs;
  const polarity = policy.polarity === "sunlit-alabaster-light" ? 1 : 0;
  const pinned = policy.motion !== "full" || policy.thermal === "critical";
  const result = new Map<LightSlot, LightEffectSample>();
  if (elapsed < 0) return [];
  for (const step of plan.steps) {
    if (step.polarity >= 0 && step.polarity !== polarity) continue;
    const gain = lightStepGain(step.gain, step.startUs, step.durationUs, elapsed, event.intensity, pinned, step.preset.cost === "E");
    if (gain <= 0) continue;
    const pose = pinned && step.slot !== "focus" ? policy.staticKey : pathPoint(snapshot, lightStepProgress(step.startUs, step.durationUs, elapsed));
    const { preset } = step;
    const energy = Math.min(1, gain);
    const emitter = preset.polarity === "adaptive" || preset.polarity === policy.polarity
      ? presetEmitter(preset, pose, energy) : { ...pose, gain: energy };
    if (preset.id === "polarity.high-contrast") continue;
    result.set(step.slot, { slot: step.slot, subject: event.subject, emitter,
      showLightSourceDefault: preset.showLightSourceDefault });
  }
  return [...result.values()].sort((a, b) => lightSlotIndex(a.slot) - lightSlotIndex(b.slot));
}
