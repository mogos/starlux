import { clamp01, finiteBound } from "./math.ss.ts";
import type { SpatialPhysicsConfig } from "../lux/knobs.ss.ts";

export type SnapField = {
  readonly x: number;
  readonly y: number;
  readonly edge: boolean;
  readonly corner: boolean;
  readonly enabled: boolean;
};

export type MagneticForce = {
  readonly x: number;
  readonly y: number;
  readonly snapped: boolean;
};

export function magnetForce(
  x: number, y: number, vx: number, vy: number, field: SnapField, snapped: boolean, knobs: SpatialPhysicsConfig,
): MagneticForce {
  if (!knobs.enableMagnetism || !field.enabled) return { x: 0, y: 0, snapped: false };
  const dx = finiteBound(field.x, 10000000) - finiteBound(x, 10000000);
  const dy = finiteBound(field.y, 10000000) - finiteBound(y, 10000000);
  const distance = Math.sqrt(dx * dx + dy * dy);
  const speed = Math.sqrt(vx * vx + vy * vy);
  let threshold = knobs.magnetSnapThresholdPx;
  if (snapped) threshold *= knobs.snapHysteresisRatio;
  const engaged = distance <= threshold && speed < knobs.magnetBreakawayVel;
  if (distance === 0 || distance >= knobs.magnetRadiusPx) return { x: 0, y: 0, snapped: engaged };
  const lead = knobs.magnetGhostLeadMs / 1000;
  const gx = dx - vx * lead;
  const gy = dy - vy * lead;
  const falloff = clamp01(1 - distance / knobs.magnetRadiusPx);
  let strength = knobs.magnetStrength;
  if (field.edge) strength += knobs.magnetEdgeStrength;
  if (field.corner) strength *= knobs.magnetCornerBoost;
  const gain = strength * falloff * falloff;
  return { x: finiteBound(gx * gain, 100000), y: finiteBound(gy * gain, 100000), snapped: engaged };
}

export type DirectedPush = { readonly x: number; readonly y: number };

export function directedNeighborPush(
  x: number, y: number, neighborX: number, neighborY: number, active: boolean, knobs: SpatialPhysicsConfig,
): DirectedPush {
  if (!knobs.enableCoupledNeighbors || !active) return { x: 0, y: 0 };
  const dx = finiteBound(neighborX, 10000000) - finiteBound(x, 10000000);
  const dy = finiteBound(neighborY, 10000000) - finiteBound(y, 10000000);
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance >= knobs.magnetRadiusPx) return { x: 0, y: 0 };
  const pressure = (knobs.magnetRadiusPx - distance) * knobs.magnetNeighborPush * 12;
  if (distance === 0) return { x: pressure, y: 0 };
  return { x: dx / distance * pressure, y: dy / distance * pressure };
}
