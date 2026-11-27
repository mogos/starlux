import type { SpatialPhysicsConfig } from "./knobs.ss.ts";

export type WakeKind = "plain" | "body" | "gesture";
export type WakeSlot = {
  readonly token: number;
  readonly kind: WakeKind;
  readonly consecutiveRestFrames: number;
};

export type WakeRegistry = { readonly slots: readonly WakeSlot[] };
export type LuxClock = {
  readonly registry: WakeRegistry;
  readonly generation: number;
  readonly nextToken: number;
  readonly clockTicks: number;
  readonly idleWakeupCount: number;
};
export type WakeAcquisition = { readonly clock: LuxClock; readonly token: number };
export type ClockDispatch = { readonly clock: LuxClock; readonly accepted: boolean };

export function maxWakeSlots(): number { return 32; }

export function createLuxClock(): LuxClock {
  return { registry: { slots: [] }, generation: 0, nextToken: 1, clockTicks: 0, idleWakeupCount: 0 };
}

export function heldWakeTokens(clock: LuxClock): number {
  return clock.registry.slots.length;
}

function replaceRegistry(clock: LuxClock, slots: readonly WakeSlot[], nextToken: number): LuxClock {
  let generation = clock.generation;
  if ((clock.registry.slots.length === 0) !== (slots.length === 0)) generation += 1;
  return {
    registry: { slots: slots }, generation: generation, nextToken: nextToken,
    clockTicks: clock.clockTicks, idleWakeupCount: clock.idleWakeupCount,
  };
}

export function acquireWake(clock: LuxClock, kind: WakeKind): WakeAcquisition {
  const previous = clock.registry.slots;
  if (previous.length >= maxWakeSlots() || clock.nextToken >= 4503599627370495) {
    return { clock: clock, token: 0 };
  }
  const next: WakeSlot[] = [];
  for (let i = 0; i < 32; i++) {
    if (i >= previous.length) break;
    const slot = previous[i];
    if (slot !== undefined) next.push(slot);
  }
  next.push({ token: clock.nextToken, kind: kind, consecutiveRestFrames: 0 });
  return { clock: replaceRegistry(clock, next, clock.nextToken + 1), token: clock.nextToken };
}

export function releaseWake(clock: LuxClock, token: number): LuxClock {
  const previous = clock.registry.slots;
  if (token <= 0 || previous.length === 0) return clock;
  const next: WakeSlot[] = [];
  for (let i = 0; i < 32; i++) {
    if (i >= previous.length) break;
    const slot = previous[i];
    if (slot !== undefined) {
      if (slot.token !== token) next.push(slot);
    }
  }
  if (next.length === previous.length) return clock;
  return replaceRegistry(clock, next, clock.nextToken);
}

export function shutdownClock(clock: LuxClock): LuxClock {
  if (heldWakeTokens(clock) === 0) return clock;
  return replaceRegistry(clock, [], clock.nextToken);
}

export function sampleRest(clock: LuxClock, token: number, resting: boolean, settleHoldFrames: number): LuxClock {
  const previous = clock.registry.slots;
  if (token <= 0 || previous.length === 0) return clock;
  let hold = 3;
  if (settleHoldFrames >= 1 && settleHoldFrames <= 8) hold = Math.floor(settleHoldFrames);
  const next: WakeSlot[] = [];
  for (let i = 0; i < 32; i++) {
    if (i >= previous.length) break;
    const slot = previous[i];
    if (slot !== undefined) {
      if (slot.token === token && slot.kind === "body") {
        let frames = 0;
        if (resting) frames = slot.consecutiveRestFrames + 1;
        if (frames < hold) next.push({ token: slot.token, kind: "body", consecutiveRestFrames: frames });
      } else {
        next.push(slot);
      }
    }
  }
  return replaceRegistry(clock, next, clock.nextToken);
}

export function sampleBodyRest(
  clock: LuxClock, token: number, resting: boolean, knobs: SpatialPhysicsConfig,
): LuxClock {
  return sampleRest(clock, token, resting, knobs.settleHoldFrames);
}

export function dispatchClock(clock: LuxClock, epoch: number): ClockDispatch {
  const accepted = epoch === clock.generation && heldWakeTokens(clock) > 0;
  let ticks = clock.clockTicks;
  let idle = clock.idleWakeupCount;
  if (accepted) ticks += 1;
  else idle += 1;
  return {
    accepted: accepted,
    clock: {
      registry: clock.registry, generation: clock.generation, nextToken: clock.nextToken,
      clockTicks: ticks, idleWakeupCount: idle,
    },
  };
}
