import type { SpatialPhysicsConfig } from "../lux/knobs.ss.ts";
import { clamp, finiteBound, frameUs } from "./math.ss.ts";
import { atRest, springFrequency, springKick } from "./spring.ss.ts";
import { directedNeighborPush, magnetForce } from "./magnet.ss.ts";
import type { SnapField } from "./magnet.ss.ts";
import { normalizedBounds, outside, rubberForce } from "./rubber.ss.ts";
import type { Bounds } from "./rubber.ss.ts";

export type BodyState = {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly neighborX: number;
  readonly neighborY: number;
  readonly neighborVx: number;
  readonly neighborVy: number;
  readonly accumUs: number;
  readonly torque: number;
  readonly snapped: boolean;
  readonly boundaryHit: boolean;
  readonly snapEngaged: boolean;
  readonly snapReleased: boolean;
  readonly resting: boolean;
  readonly substeps: number;
};

export type PhysicsInput = {
  readonly targetX: number;
  readonly targetY: number;
  readonly neighborHomeX: number;
  readonly neighborHomeY: number;
  readonly pushActive: boolean;
  readonly field: SnapField;
  readonly bounds: Bounds;
};

export function initialBody(x: number, y: number, neighborX: number, neighborY: number): BodyState {
  return {
    x: finiteBound(x, 10000000), y: finiteBound(y, 10000000), vx: 0, vy: 0,
    neighborX: finiteBound(neighborX, 10000000), neighborY: finiteBound(neighborY, 10000000),
    neighborVx: 0, neighborVy: 0, accumUs: 0, torque: 0, snapped: false,
    boundaryHit: false, snapEngaged: false, snapReleased: false, resting: false, substeps: 0,
  };
}

export function launchBody(state: BodyState, x: number, y: number, vx: number, vy: number): BodyState {
  return {
    x: finiteBound(x, 10000000), y: finiteBound(y, 10000000),
    vx: finiteBound(vx, 12000), vy: finiteBound(vy, 12000),
    neighborX: state.neighborX, neighborY: state.neighborY, neighborVx: state.neighborVx,
    neighborVy: state.neighborVy, accumUs: 0, torque: 0, snapped: state.snapped,
    boundaryHit: false, snapEngaged: false, snapReleased: false, resting: false, substeps: 0,
  };
}

export function stepPhysics(
  state: BodyState, input: PhysicsInput, dtUs: number, knobs: SpatialPhysicsConfig,
): BodyState {
  const elapsed = frameUs(dtUs);
  let x = finiteBound(state.x, 10000000);
  let y = finiteBound(state.y, 10000000);
  let vx = finiteBound(state.vx, 12000);
  let vy = finiteBound(state.vy, 12000);
  let nx = finiteBound(state.neighborX, 10000000);
  let ny = finiteBound(state.neighborY, 10000000);
  let nvx = finiteBound(state.neighborVx, 12000);
  let nvy = finiteBound(state.neighborVy, 12000);
  let snapped = state.snapped && knobs.enableMagnetism && input.field.enabled;
  let snapEngaged = false;
  let snapReleased = state.snapped && !snapped;
  let boundaryHit = false;
  let torque = 0;
  let forceX = 0;
  let forceY = 0;
  let accumUs = frameUs(state.accumUs);
  let substeps = 0;

  const rubber = knobs.enableRubberBand && input.bounds.enabled;
  let bounds = input.bounds;
  if (rubber) bounds = normalizedBounds(bounds);
  const magnet = knobs.enableMagnetism && input.field.enabled;
  const push = knobs.enableCoupledNeighbors && input.pushActive;
  let goalX = finiteBound(input.targetX, 10000000);
  let goalY = finiteBound(input.targetY, 10000000);
  const homeX = finiteBound(input.neighborHomeX, 10000000);
  const homeY = finiteBound(input.neighborHomeY, 10000000);
  let anchorX = finiteBound(input.field.x, 10000000);
  let anchorY = finiteBound(input.field.y, 10000000);
  let omega = 0;
  let stiffness = 0;
  let damping = 0;
  if (knobs.enableSprings) {
    omega = springFrequency(knobs.springResponseMs, knobs.windowMass);
    stiffness = omega * omega;
    damping = 2 * knobs.springDampingRatio * omega;
  }
  if (rubber) {
    goalX = clamp(goalX, bounds.minX, bounds.maxX);
    goalY = clamp(goalY, bounds.minY, bounds.maxY);
    anchorX = clamp(anchorX, bounds.minX, bounds.maxX);
    anchorY = clamp(anchorY, bounds.minY, bounds.maxY);
  }
  const field: SnapField = {
    x: anchorX, y: anchorY, edge: input.field.edge, corner: input.field.corner, enabled: magnet,
  };
  if (elapsed > 0) {
    if (!rubber && !magnet) {
      // Exact solution for an unforced spring, including fractional fixed steps.
      if (knobs.enableSprings) {
        const ax = springKick(x, vx, goalX, elapsed, omega, knobs.springDampingRatio);
        const ay = springKick(y, vy, goalY, elapsed, omega, knobs.springDampingRatio);
        x = ax.position;
        y = ay.position;
        vx = ax.velocity;
        vy = ay.velocity;
      } else {
        x = goalX;
        y = goalY;
        vx = 0;
        vy = 0;
      }
    }
    if (rubber || magnet || push || (knobs.enableCoupledNeighbors && (nvx !== 0 || nvy !== 0 || nx !== homeX || ny !== homeY))) {
      accumUs = frameUs(accumUs + elapsed);
      for (let i = 0; i < 16; i++) {
        if (accumUs < 4000) break;
        accumUs -= 4000;
        substeps++;
        if (rubber || magnet) {
          let mx = 0;
          let my = 0;
          if (magnet) {
            const magnetic = magnetForce(x, y, vx, vy, field, snapped, knobs);
            if (magnetic.snapped && !snapped) snapEngaged = true;
            if (!magnetic.snapped && snapped) snapReleased = true;
            snapped = magnetic.snapped;
            mx = magnetic.x;
            my = magnetic.y;
          }
          let targetX = goalX;
          let targetY = goalY;
          if (snapped) {
            targetX = anchorX;
            targetY = anchorY;
          }
          let rx = 0;
          let ry = 0;
          let outsideBounds = false;
          if (rubber) {
            const rebound = rubberForce(x, y, vx, vy, bounds, knobs);
            outsideBounds = rebound.hit;
            if (outsideBounds) boundaryHit = true;
            torque = rebound.torque;
            rx = rebound.x;
            ry = rebound.y;
          }
          forceX = stiffness * (targetX - x) + mx + rx;
          forceY = stiffness * (targetY - y) + my + ry;
          if (!outsideBounds && mx === 0 && my === 0) {
            if (knobs.enableSprings) {
              const ax = springKick(x, vx, targetX, 4000, omega, knobs.springDampingRatio);
              const ay = springKick(y, vy, targetY, 4000, omega, knobs.springDampingRatio);
              x = ax.position;
              y = ay.position;
              vx = ax.velocity;
              vy = ay.velocity;
            } else {
              x = targetX;
              y = targetY;
              vx = 0;
              vy = 0;
            }
          } else {
            // Split linear damping implicitly so even the extreme knob values are stable.
            const brake = 1 + 0.004 * (damping + 8);
            vx = finiteBound((vx + 0.004 * forceX) / brake, 12000);
            vy = finiteBound((vy + 0.004 * forceY) / brake, 12000);
            x = finiteBound(x + 0.004 * vx, 10000000);
            y = finiteBound(y + 0.004 * vy, 10000000);
          }
        }
        if (knobs.enableCoupledNeighbors) {
          // Only the passive body receives this force. It cannot enqueue another push.
          let px = 0;
          let py = 0;
          if (push) {
            const passive = directedNeighborPush(x, y, nx, ny, true, knobs);
            px = passive.x;
            py = passive.y;
          }
          nvx = finiteBound((nvx + 0.004 * (px + 100 * (homeX - nx))) / 1.08, 12000);
          nvy = finiteBound((nvy + 0.004 * (py + 100 * (homeY - ny))) / 1.08, 12000);
          nx = finiteBound(nx + 0.004 * nvx, 10000000);
          ny = finiteBound(ny + 0.004 * nvy, 10000000);
        }
      }
    } else {
      accumUs = 0;
    }
  }
  let restX = goalX;
  let restY = goalY;
  if (snapped) {
    restX = anchorX;
    restY = anchorY;
  }
  if (!knobs.enableSprings) {
    restX = x;
    restY = y;
    if (rubber) {
      restX = x - outside(x, bounds.minX, bounds.maxX);
      restY = y - outside(y, bounds.minY, bounds.maxY);
    }
  }
  const atTarget = atRest(x - restX, vx, knobs) && atRest(y - restY, vy, knobs);
  let resting = atTarget;
  if (substeps > 0 && (rubber || magnet)) {
    // A nonlinear field can balance a spring away from its unforced target.
    const tolerance = (1 + stiffness) * knobs.settlePositionEps;
    resting = Math.abs(forceX) <= tolerance && Math.abs(forceY) <= tolerance &&
      atRest(0, vx, knobs) && atRest(0, vy, knobs);
  }
  if (knobs.enableCoupledNeighbors) {
    const neighborRest = atRest(nx - homeX, nvx, knobs) && atRest(ny - homeY, nvy, knobs);
    if (neighborRest && !push && elapsed > 0) {
      nx = homeX;
      ny = homeY;
      nvx = 0;
      nvy = 0;
    }
    resting = resting && neighborRest;
  }
  if (resting && elapsed > 0) {
    if (atTarget) {
      x = restX;
      y = restY;
    }
    vx = 0;
    vy = 0;
  }
  return {
    x: x, y: y, vx: vx, vy: vy, neighborX: nx, neighborY: ny, neighborVx: nvx, neighborVy: nvy,
    accumUs: accumUs, torque: torque, snapped: snapped, boundaryHit: boundaryHit, snapEngaged: snapEngaged,
    snapReleased: snapReleased, resting: resting, substeps: substeps,
  };
}
