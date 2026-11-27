import { clamp, exp64, finiteBound, frameUs, ln64 } from "./math.ss.ts";
import type { SpatialPhysicsConfig } from "../lux/knobs.ss.ts";

export type GestureState = {
  readonly active: boolean;
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
};

export type Flick = { readonly x: number; readonly y: number; readonly vx: number; readonly vy: number };

export function idleGesture(): GestureState {
  return { active: false, pointerId: 0, x: 0, y: 0, vx: 0, vy: 0 };
}

export function beginGesture(state: GestureState, pointerId: number, x: number, y: number): GestureState {
  if (state.active) return state;
  return {
    active: true, pointerId: finiteBound(pointerId, 2147483647),
    x: finiteBound(x, 10000000), y: finiteBound(y, 10000000), vx: 0, vy: 0,
  };
}

export function sampleGesture(
  state: GestureState, pointerId: number, x: number, y: number, dtUs: number, knobs: SpatialPhysicsConfig,
): GestureState {
  if (!state.active || pointerId !== state.pointerId) return state;
  const dt = frameUs(dtUs);
  if (dt === 0) return state;
  const px = finiteBound(x, 10000000);
  const py = finiteBound(y, 10000000);
  const weight = 1 - exp64(-dt / 24000);
  const limit = knobs.flickVelocityClampPxPerS;
  const vx = finiteBound((px - state.x) * 1000000 / dt, limit);
  const vy = finiteBound((py - state.y) * 1000000 / dt, limit);
  return {
    active: true, pointerId: pointerId, x: px, y: py,
    vx: state.vx + weight * (vx - state.vx), vy: state.vy + weight * (vy - state.vy),
  };
}

export function releaseGesture(state: GestureState): GestureState {
  if (!state.active) return state;
  return { active: false, pointerId: 0, x: state.x, y: state.y, vx: 0, vy: 0 };
}

export function predictFlick(state: GestureState, knobs: SpatialPhysicsConfig): Flick {
  const limit = knobs.flickVelocityClampPxPerS;
  let vx = finiteBound(state.vx, limit);
  let vy = finiteBound(state.vy, limit);
  const speed = Math.sqrt(vx * vx + vy * vy);
  if (speed > limit) {
    vx *= limit / speed;
    vy *= limit / speed;
  }
  const decay = -1000 * ln64(clamp(knobs.flickDecelerationRate, 0.985, 0.9995));
  const stopTime = 1 / decay;
  return {
    x: finiteBound(state.x + vx * stopTime, 10000000), y: finiteBound(state.y + vy * stopTime, 10000000),
    vx: vx, vy: vy,
  };
}
