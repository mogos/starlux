import assert from "node:assert/strict";
import { clampSpatialKnobs, defaultSpatialKnobs } from "../ss/lux/knobs.ss.ts";
import type { FeatureFlags, SpatialPhysicsConfig } from "../ss/lux/knobs.ss.ts";
import { acquireWake, createLuxClock, heldWakeTokens, sampleBodyRest } from "../ss/lux/wake.ss.ts";
import { governFrames } from "../ss/lux/governor.ss.ts";
import { predictFlick } from "../ss/physics/gesture.ss.ts";
import { directedNeighborPush, magnetForce } from "../ss/physics/magnet.ss.ts";
import { windowPose } from "../ss/physics/organic.ss.ts";
import { rubberForce } from "../ss/physics/rubber.ss.ts";
import { atRest, stepSpring } from "../ss/physics/spring.ss.ts";
import { solveLivingUniforms } from "../ss/living-state.ss.ts";

const field = { x: 10, y: 20, edge: true, corner: true, enabled: true };
const bounds = { enabled: true, minX: 0, minY: 0, maxX: 100, maxY: 100 };
const pose = {
  vx: 330, vy: -280, cornerTorque: 1, dragging: true, focused: false, frostedGlass: false,
  allow3dTiltOnGlass: false, minimizeU: 0.67, dockDx: 640, dockDy: 400,
};
const state = { state: "circadian", voiceLevel: 0.8, timeOfDay: 14, thermalTier: "serious" } as const;
const defaults = defaultSpatialKnobs();
const axis = { position: 18, velocity: 40 };
const features = {
  enableSprings: (k) => stepSpring(axis, 23, 44000, k, 0).position,
  enableMagnetism: (k) => magnetForce(11, 19, 2, 3, field, false, k).x,
  enableRubberBand: (k) => rubberForce(144, -120, -20, 45, bounds, k).x,
  enableOrganicTilt: (k) => windowPose(pose, k).tiltX,
  enableInertialSquash: (k) => windowPose({ ...pose, vx: 2100, minimizeU: 0 }, k).scaleX,
  enableEmptyGlassMinimize: (k) => windowPose(pose, k).glassOpacity,
  enableDockImpulse: (k) => windowPose({ ...pose, minimizeU: 1 }, k).dockImpulse,
  enableCoupledNeighbors: (k) => directedNeighborPush(10, 15, 17, 20, true, k).x,
  enableSpecularRim: (k) => windowPose(pose, k).rimScaleCompensation,
  enableLivingBackdrop: (k) => solveLivingUniforms(state, k).energy,
} satisfies Record<keyof FeatureFlags, (knobs: SpatialPhysicsConfig) => number>;
const neutral: Record<keyof FeatureFlags, number> = {
  enableSprings: 23, enableMagnetism: 0, enableRubberBand: 0, enableOrganicTilt: 0, enableInertialSquash: 1,
  enableEmptyGlassMinimize: 1, enableDockImpulse: 0, enableCoupledNeighbors: 0, enableSpecularRim: 1, enableLivingBackdrop: 0,
};

type ScalarKnob = Exclude<keyof SpatialPhysicsConfig, keyof FeatureFlags>;

function fingerprint(k: SpatialPhysicsConfig) {
  const lease = acquireWake(createLuxClock(), "body");
  let clock = lease.clock;
  const wake: number[] = [];
  for (let i = 0; i < 8; i++) {
    clock = sampleBodyRest(clock, lease.token, true, k);
    wake.push(heldWakeTokens(clock));
  }
  return {
    spring: [0, 1, 2].map((mode) => stepSpring(axis, 23, 44000, k, mode)),
    rest: [atRest(0.25, 0.15, k), atRest(0.01, 1, k)],
    magnetic: [
      magnetForce(11, 19, 2, 3, field, false, k),
      magnetForce(24, 20, 0, 0, field, true, k),
      magnetForce(21, 20, 900, 0, field, false, k),
      magnetForce(100, 20, 0, 0, field, false, k),
    ],
    neighbor: directedNeighborPush(10, 15, 17, 20, true, k),
    rubber: rubberForce(280, -180, -20, 45, bounds, k),
    poses: [
      windowPose(pose, k),
      windowPose({ ...pose, minimizeU: 0.1, vx: 2500, vy: -4500 }, k),
      windowPose({ ...pose, minimizeU: 1, dragging: false }, k),
      windowPose({ ...pose, vx: 1200, vy: -200, minimizeU: 0, dragging: false }, k),
    ],
    governor: governFrames({
      motionEnergy: 1, heldTokens: 1, displayHz: 120, thermalTier: "serious", motionPolicy: "full", hidden: false,
    }, k),
    living: solveLivingUniforms(state, k),
    wake,
    flick: predictFlick({ active: true, pointerId: 1, x: 44, y: 21, vx: 8000, vy: 4500 }, k),
  };
}

const arg = process.argv[2];
if (arg === "--flags") {
  const work = new Map<string, number>();
  (globalThis as typeof globalThis & { __starluxFeatureWork?: (key: string) => void }).__starluxFeatureWork =
    (key) => { work.set(key, (work.get(key) ?? 0) + 1); };
  for (const flag of Object.keys(features) as (keyof FeatureFlags)[]) {
    const probe = features[flag];
    work.clear();
    assert.notEqual(probe(defaults), neutral[flag], flag);
    assert.equal(work.get(flag), 1, flag + " enabled work");
    work.clear();
    assert.equal(probe({ ...defaults, [flag]: false }), neutral[flag], flag);
    assert.equal(work.get(flag) ?? 0, 0, flag + " disabled work");
  }
  console.log("10/10 feature guards skip the instrumented work path when disabled");
} else {
  const knob = arg as ScalarKnob;
  assert.ok(Object.hasOwn(defaults, knob) && typeof defaults[knob] === "number");
  const baseline = JSON.stringify(fingerprint(defaults));
  const lower = clampSpatialKnobs({ ...defaults, [knob]: -Infinity });
  const upper = clampSpatialKnobs({ ...defaults, [knob]: Infinity });
  if (baseline === JSON.stringify(fingerprint(lower)) && baseline === JSON.stringify(fingerprint(upper))) {
    console.error("no-observable-effect " + knob);
    process.exit(42);
  }
}
