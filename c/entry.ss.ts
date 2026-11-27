import { clampSpatialKnobs, defaultSpatialKnobs } from "../ss/lux/knobs.ss.ts";
import type { SpatialPhysicsConfig } from "../ss/lux/knobs.ss.ts";
import { stepPhysics } from "../ss/physics/simulator.ss.ts";
import type { BodyState, PhysicsInput } from "../ss/physics/simulator.ss.ts";
import { stepSpring } from "../ss/physics/spring.ss.ts";
import type { AxisState } from "../ss/physics/spring.ss.ts";

export function starluxDefaultKnobs(): SpatialPhysicsConfig {
  return defaultSpatialKnobs();
}

export function starluxStepSpring(
  axis: AxisState, target: number, dtUs: number, knobs: SpatialPhysicsConfig, mode: number,
): AxisState {
  return stepSpring(axis, target, dtUs, clampSpatialKnobs(knobs), mode);
}

export function starluxStepPhysics(
  state: BodyState, input: PhysicsInput, dtUs: number, knobs: SpatialPhysicsConfig,
): BodyState {
  return stepPhysics(state, input, dtUs, clampSpatialKnobs(knobs));
}
