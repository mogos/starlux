import { acquireWake, createLuxClock, dispatchClock, heldWakeTokens, releaseWake, sampleBodyRest, shutdownClock } from "../ss/lux/wake.ss.ts";
import { beginEventDrain, createEventQueue, enqueueEvent, nextEvent, stopEventDrain } from "../ss/lux/events.ss.ts";
import { createLuxTrace, recordTrace, summarizeTrace, checkLuxBudget, defaultLuxBudget } from "../ss/lux/trace.ss.ts";
import { clampSpatialKnobs, defaultSpatialKnobs, spatialPreset } from "../ss/lux/knobs.ss.ts";
import { governFrames } from "../ss/lux/governor.ss.ts";
import { falsifyIdle } from "../ss/lux/idle.ss.ts";
import { idleVoice, smoothVoice, synthesizeSensory } from "../ss/sensory.ss.ts";
import { solveLivingUniforms } from "../ss/living-state.ss.ts";
import { beginGesture, idleGesture, predictFlick, releaseGesture, sampleGesture } from "../ss/physics/gesture.ss.ts";
import { windowPose } from "../ss/physics/organic.ss.ts";
import { stepSpring } from "../ss/physics/spring.ss.ts";

export function main(dt: number): number {
  const knobs = defaultSpatialKnobs();
  const first = acquireWake(createLuxClock(), "body");
  const gesture = acquireWake(first.clock, "gesture");
  const kicked = dispatchClock(gesture.clock, gesture.clock.generation);
  const held = sampleBodyRest(sampleBodyRest(kicked.clock, first.token, true, knobs), first.token, true, knobs);
  const released = sampleBodyRest(held, first.token, true, knobs);
  const shutdown = shutdownClock(releaseWake(released, gesture.token));
  const stale = dispatchClock(shutdown, gesture.clock.generation);
  const idle = falsifyIdle({ clockTicks: 1, hostRafCount: 1, heldTokens: 0 },
    { clockTicks: stale.clock.clockTicks, hostRafCount: 1, heldTokens: heldWakeTokens(stale.clock) }, 10000000);

  let queue = createEventQueue();
  queue = enqueueEvent(queue, { kind: "IMPULSE", timeUs: 0, intensity: 0.5, subject: 0 });
  queue = enqueueEvent(queue, { kind: "SNAP_ENGAGE", timeUs: 1, intensity: 1, subject: 0 });
  const read = nextEvent(beginEventDrain(queue));
  const tail = nextEvent(read.queue);
  const drained = stopEventDrain(tail.queue);
  const sensation = synthesizeSensory(read.event, false, false);
  const voice = smoothVoice(idleVoice(), 0.8, dt, false);
  const uniforms = solveLivingUniforms({ state: "listening", voiceLevel: voice.level, timeOfDay: 12, thermalTier: "fair" }, knobs);
  const governor = governFrames({
    hidden: false, heldTokens: 1, motionEnergy: 0.7, displayHz: 120, thermalTier: "fair", motionPolicy: "full",
  }, knobs);
  const trace = recordTrace(recordTrace(createLuxTrace(), { frameUs: 8000, expectedUs: 8333, elapsedUs: 8333 }, 0),
    { frameUs: 6000, expectedUs: 8333, elapsedUs: 8333 }, 0);
  const summary = summarizeTrace(trace);
  const start = beginGesture(idleGesture(), 3, 0, 0);
  const sample = sampleGesture(start, 3, 1, 5, dt, knobs);
  const flick = predictFlick(sample, knobs);
  const stopped = releaseGesture(sample);
  const pose = windowPose({
    vx: flick.vx, vy: flick.vy, cornerTorque: 8, dragging: true, frostedGlass: true,
    allow3dTiltOnGlass: false, focused: true, minimizeU: 0.3, dockDx: 100, dockDy: 200,
  }, knobs);
  const axis = stepSpring({ position: 5, velocity: 3 }, 1, dt, knobs, 1);
  const crisp = clampSpatialKnobs(spatialPreset("crisp-pro"));
  const zero = dt - dt;
  const corrupt = stepSpring({ position: zero / zero, velocity: 1 / zero }, -1 / zero, 10000000, crisp, 0);
  if (!(Math.abs(corrupt.position) <= 10000000 && Math.abs(corrupt.velocity) <= 12000)) return -2;

  if (!idle.passed || !read.ready || !tail.ready || drained.draining || stopped.active || !checkLuxBudget(summary, defaultLuxBudget())) return -1;
  return stale.clock.idleWakeupCount + summary.p99 + governor.hz + uniforms.energy + sensation.sound.gain + pose.scaleX + axis.position;
}
