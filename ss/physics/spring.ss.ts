import { clamp, exp64, finiteBound, cos64, frameUs, sin64 } from "./math.ss.ts";
import type { SpatialPhysicsConfig } from "../lux/knobs.ss.ts";

export type AxisState = { readonly position: number; readonly velocity: number };

export function springFrequency(responseMs: number, mass: number): number {
  return 6283.185307179586 / (clamp(responseMs, 40, 2000) * Math.sqrt(clamp(mass, 0.1, 20)));
}

export function atRest(displacement: number, velocity: number, knobs: SpatialPhysicsConfig): boolean {
  return Math.abs(displacement) <= knobs.settlePositionEps && Math.abs(velocity) <= knobs.settleVelocityEps;
}

export function springKick(
  position: number, velocity: number, target: number, dtUs: number,
  angularFrequency: number, dampingRatio: number,
): AxisState {
  const dt = frameUs(dtUs) / 1000000;
  const p = finiteBound(position, 10000000);
  const v = finiteBound(velocity, 12000);
  const center = finiteBound(target, 10000000);
  if (dt === 0) return { position: p, velocity: v };

  const x = p - center;
  const omega = clamp(angularFrequency, 0.7, 500);
  const damping = clamp(dampingRatio, 0.25, 4);
  const rate = omega * damping;
  const discriminant = damping * damping - 1;
  let next = 0;
  let speed = 0;
  if (discriminant < -0.00000001) {
    const phase = omega * Math.sqrt(-discriminant);
    const sine = sin64(phase * dt);
    const cosine = cos64(phase * dt);
    const decay = exp64(-rate * dt);
    const b = (v + rate * x) / phase;
    next = decay * (x * cosine + b * sine);
    speed = decay * (v * cosine - (rate * b + phase * x) * sine);
  } else if (discriminant > 0.00000001) {
    const root = Math.sqrt(discriminant);
    const slow = -omega / (damping + root);
    const fast = -omega * (damping + root);
    const slowPart = ((v - fast * x) / (slow - fast)) * exp64(slow * dt);
    const fastPart = x * exp64(fast * dt) - ((v - fast * x) / (slow - fast)) * exp64(fast * dt);
    next = slowPart + fastPart;
    speed = slow * slowPart + fast * fastPart;
  } else {
    const b = v + omega * x;
    const decay = exp64(-omega * dt);
    next = decay * (x + b * dt);
    speed = decay * (v - omega * b * dt);
  }
  return { position: finiteBound(center + next, 10000000), velocity: finiteBound(speed, 12000) };
}

export function stepSpring(
  state: AxisState, target: number, dtUs: number, knobs: SpatialPhysicsConfig, mode: number,
): AxisState {
  if (!knobs.enableSprings) return { position: finiteBound(target, 10000000), velocity: 0 };
  let response = knobs.springResponseMs;
  let damping = knobs.springDampingRatio;
  if (mode === 1) {
    response = knobs.minimizeResponseMs;
    damping = knobs.minimizeDamping;
  } else if (mode === 2) {
    response = knobs.maximizeResponseMs;
  }
  return springKick(state.position, state.velocity, target, dtUs, springFrequency(response, knobs.windowMass),
    clamp(damping, 0.25, 4));
}
