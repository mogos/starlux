import { clamp, finiteBound } from "./math.ss.ts";
import type { SpatialPhysicsConfig } from "../lux/knobs.ss.ts";

export type Bounds = {
  readonly enabled: boolean;
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
};

export type RubberForce = {
  readonly x: number;
  readonly y: number;
  readonly torque: number;
  readonly hit: boolean;
};

export function overdrag(delta: number, constant: number, maxPx: number): number {
  const d = finiteBound(delta, 20000000);
  const c = clamp(constant, 1, 500);
  const a = Math.abs(d);
  const amount = clamp(a * c / (a + c), 0, clamp(maxPx, 0, 500));
  if (d < 0) return -amount;
  return amount;
}

export function outside(value: number, min: number, max: number): number {
  return value - clamp(value, min, max);
}

export function normalizedBounds(bounds: Bounds): Bounds {
  const minX = finiteBound(bounds.minX, 10000000);
  const minY = finiteBound(bounds.minY, 10000000);
  return {
    enabled: bounds.enabled, minX: minX, minY: minY,
    maxX: clamp(bounds.maxX, minX, 10000000), maxY: clamp(bounds.maxY, minY, 10000000),
  };
}

export function rubberForce(
  x: number, y: number, vx: number, vy: number, bounds: Bounds, knobs: SpatialPhysicsConfig,
): RubberForce {
  if (!knobs.enableRubberBand || !bounds.enabled) return { x: 0, y: 0, torque: 0, hit: false };
  const dx = outside(finiteBound(x, 10000000), bounds.minX, bounds.maxX);
  const dy = outside(finiteBound(y, 10000000), bounds.minY, bounds.maxY);
  const speedX = finiteBound(vx, 12000);
  const speedY = finiteBound(vy, 12000);
  let fx = 0;
  let fy = 0;
  let torque = 0;
  const k = knobs.rubberReboundStiffness;
  const drag = knobs.rubberReboundDamping + knobs.rubberEdgeResistance;
  if (dx !== 0) fx = -k * overdrag(dx, knobs.rubberConstant, knobs.rubberMaxOverdragPx) - drag * speedX;
  if (dy !== 0) fy = -k * overdrag(dy, knobs.rubberConstant, knobs.rubberMaxOverdragPx) - drag * speedY;
  if (dx !== 0 && dy !== 0) {
    // Cross the overshoot vector with velocity to determine corner torque.
    torque = finiteBound((dx * speedY - dy * speedX) * knobs.rubberCornerTorque / ((1 + Math.abs(dx) + Math.abs(dy)) * 100), 90);
  }
  return { x: fx, y: fy, torque: torque, hit: dx !== 0 || dy !== 0 };
}
