import { expect, test } from "bun:test";
import {
  acquireWake, beginEventDrain, checkLuxBudget, clampSpatialKnobs, createEventQueue, createLuxClock,
  createLuxEventBus, createLuxTrace, defaultLuxBudget, defaultSpatialKnobs, dispatchClock, enqueueEvent,
  falsifyIdle, governFrames, heldWakeTokens, nextEvent, parseKnobsJson, recordTrace, releaseWake, sampleRest,
  serializeKnobsJson, spatialPreset, summarizeTrace,
} from "../src/lux.ts";
import type { LuxEvent, SpatialPreset } from "../src/lux.ts";
import {
  atan2_64, cos64, exp64, initialBody, launchBody, ln64, magnetForce, overdrag, predictFlick, rubberForce, sin64,
  stepPhysics, stepSpring, windowPose,
} from "../src/physics.ts";
import { solveLivingUniforms } from "../ss/living-state.ss.ts";
import { idleVoice, smoothVoice, synthesizeSensory } from "../ss/sensory.ss.ts";
import { mount } from "../src/dom/controller.ts";
import { fakeDom, input } from "./fixtures.ts";
import { main as trajectory } from "./trajectory.ss.ts";

const defaults = defaultSpatialKnobs();
const numericKeys = Object.keys(defaults).filter((name) => typeof defaults[name as keyof typeof defaults] === "number");
const state = launchBody(initialBody(-11, -8, 28, 23), -11, -8, 30, -15);

function allFinite(record: object) {
  for (const value of Object.values(record)) {
    if (typeof value === "number") expect(Number.isFinite(value)).toBe(true);
  }
}

test("54 fields, six presets, type-safe JSON and per-knob clamping", () => {
  expect(numericKeys).toHaveLength(44);
  expect(Object.keys(defaults)).toHaveLength(54);
  for (const name of ["spatial-os", "crisp-pro", "organic-her", "tactile-game", "reduced-motion", "off"] as const satisfies readonly SpatialPreset[]) {
    const preset = spatialPreset(name);
    expect(parseKnobsJson(serializeKnobsJson(preset))).toEqual(preset);
  }
  expect(parseKnobsJson('{"enableSprings":false,"settleHoldFrames":99,"other":0}')).toEqual({
    ...defaults, enableSprings: false, settleHoldFrames: 8,
  });
  expect(() => parseKnobsJson('{"enableSprings":1}')).toThrow(TypeError);
  expect(() => parseKnobsJson('{"windowMass":"1"}')).toThrow(TypeError);
  expect(() => parseKnobsJson("[]")).toThrow(TypeError);
  expect(Object.values(spatialPreset("off")).filter((value) => typeof value === "boolean")).toEqual(Array(10).fill(false));
  for (const key of numericKeys) {
    const low = clampSpatialKnobs({ ...defaults, [key]: -Infinity });
    const high = clampSpatialKnobs({ ...defaults, [key]: Infinity });
    const invalid = clampSpatialKnobs({ ...defaults, [key]: NaN });
    expect(invalid).toEqual(defaults);
    expect(low[key as keyof typeof defaults]).toBeLessThan(high[key as keyof typeof defaults] as number);
    allFinite(low);
    allFinite(high);
  }
});

test("polynomial accuracy and finite saturation on adversarial math input", () => {
  for (const x of [-1e9, -301, -12, -Math.PI, -1, -0.3, 0, 0.3, 1, Math.PI, 32, 1e9]) {
    expect(Math.abs(sin64(x) - Math.sin(x))).toBeLessThan(5e-15);
    expect(Math.abs(cos64(x) - Math.cos(x))).toBeLessThan(5e-15);
    for (const y of [-3, -1, 0, 1, 30]) expect(Math.abs(atan2_64(y, x) - Math.atan2(y, x))).toBeLessThan(5e-15);
  }
  for (const x of [-740, -12, -0.2, 0, 0.8, 12, 700]) {
    expect(Math.abs(exp64(x) / Math.exp(x) - 1)).toBeLessThan(5e-14);
  }
  for (const x of [Number.MIN_VALUE, 1e-30, 0.012, 1, 3.14, 1e12, Number.MAX_VALUE]) {
    expect(Math.abs(ln64(x) - Math.log(x))).toBeLessThan(2e-13);
  }
  for (const x of [NaN, Infinity, -Infinity]) {
    for (const result of [sin64(x), cos64(x), exp64(x), ln64(x), atan2_64(x, x)]) expect(Number.isFinite(result)).toBe(true);
  }
});

test("500-step trajectory exercises both snap edges, rubber torque and passive displacement", () => {
  const trace = trajectory(4000);
  expect(trace).toHaveLength(5500);
  expect(trace.every(Number.isFinite)).toBe(true);
  let events = 0;
  let pushed = false;
  let torque = false;
  for (let i = 0; i < 500; i++) {
    const frame = i * 11;
    events |= trace[frame + 10]!;
    pushed ||= trace[frame + 4] !== input.neighborHomeX;
    torque ||= trace[frame + 8] !== 0;
    expect(trace[frame + 9]).toBe(0);
  }
  expect(events).toBe(31);
  expect(torque && pushed).toBe(true);
  expect(trace.slice(-11)).toEqual([8, 9, 0, 0, 28, 23, 0, 0, 0, 0, 17]);
});

test("zero dt, capped catch-up, pathological velocity and adversarial configs settle", () => {
  expect(stepPhysics(state, input, 0, defaults)).toMatchObject({ x: state.x, y: state.y, vx: state.vx, vy: state.vy, substeps: 0 });
  const over = stepPhysics(state, input, 10000000, defaults);
  expect(over).toEqual(stepPhysics(state, input, 64000, defaults));
  expect(over.substeps).toBe(16);
  const free = { ...input, field: { ...input.field, enabled: false }, bounds: { ...input.bounds, enabled: false } };
  const first = stepPhysics(state, free, 2000, defaults);
  const second = stepPhysics(first, free, 2000, defaults);
  expect(first.substeps).toBe(0);
  expect(second.substeps).toBe(1);

  for (const value of [NaN, Infinity, -Infinity, -1e9, 1e9]) {
    const knobs = clampSpatialKnobs({ ...defaults, ...Object.fromEntries(numericKeys.map((key) => [key, value])) });
    const poisoned = launchBody({ ...state, neighborX: value, neighborY: value, neighborVx: value, neighborVy: -value },
      -200, -100, value, -value);
    const badInput = {
      ...input, targetX: value, targetY: value, neighborHomeX: value,
      bounds: { ...input.bounds, minY: value, maxY: -value }, field: { ...input.field, x: value },
    };
    for (const dt of [0, value, 10000000]) {
      allFinite(stepPhysics(poisoned, badInput, dt, knobs));
      allFinite(stepSpring({ position: value, velocity: -value }, -value, dt, knobs, 1));
      allFinite(predictFlick({ active: true, pointerId: 9, x: value, y: -value, vx: value, vy: -value }, knobs));
      allFinite(rubberForce(value, -value, value, value, input.bounds, knobs));
    }
    let moving = launchBody(state, -120, -80, 1e9, -1e9);
    const settleInput = { ...input, pushActive: false };
    for (let frame = 0; frame < 450; frame++) {
      moving = stepPhysics(moving, settleInput, 64000, knobs);
      allFinite(moving);
      if (moving.resting) break;
    }
    expect(moving.resting).toBe(true);
  }
});

test("magnet hysteresis, asymptotic rubber and glass pose safety", () => {
  expect(magnetForce(22, 9, 0, 0, input.field, false, defaults).snapped).toBe(false);
  expect(magnetForce(22, 9, 0, 0, input.field, true, defaults).snapped).toBe(true);
  expect(magnetForce(22, 9, 2000, 0, input.field, true, defaults).snapped).toBe(false);
  expect(overdrag(100, 100, 200)).toBe(50);
  expect(overdrag(-100, 100, 200)).toBe(-50);
  expect(overdrag(1000000, 100, 200)).toBeLessThan(100);
  const pane = {
    vx: 400, vy: -200, cornerTorque: 2, dragging: true, frostedGlass: true, allow3dTiltOnGlass: false,
    focused: true, minimizeU: 0.22, dockDx: 400, dockDy: 200,
  };
  const config = clampSpatialKnobs({ ...defaults, minimizeContentClearEnd: 1 });
  expect(windowPose(pane, config)).toMatchObject({ tiltX: 0, tiltY: 0, translateZ: 0, contentOpacity: 0, glassOpacity: 1 });
  expect(windowPose({ ...pane, allow3dTiltOnGlass: true }, config).tiltX).toBeGreaterThan(0);
  expect(windowPose({ ...pane, minimizeU: 1 }, config)).toMatchObject({ glassOpacity: 0, dockImpulse: defaults.dockImpulseScale });
});

test("clock capacity, rest reset and stale callback leave ownership intact", () => {
  let clock = createLuxClock();
  const initialEpoch = clock.generation;
  for (let i = 0; i < 32; i++) clock = acquireWake(clock, "plain").clock;
  expect(heldWakeTokens(clock)).toBe(32);
  expect(acquireWake(clock, "body").token).toBe(0);
  expect(dispatchClock(clock, initialEpoch)).toMatchObject({ accepted: false, clock: { idleWakeupCount: 1, clockTicks: 0 } });
  expect(dispatchClock(clock, clock.generation).accepted).toBe(true);

  const body = acquireWake(createLuxClock(), "body");
  clock = sampleRest(body.clock, body.token, true, 2);
  clock = sampleRest(clock, body.token, false, 2);
  clock = sampleRest(clock, body.token, true, 2);
  expect(heldWakeTokens(clock)).toBe(1);
  clock = sampleRest(clock, body.token, true, 2);
  expect(heldWakeTokens(clock)).toBe(0);
  const next = acquireWake(clock, "gesture");
  expect(releaseWake(next.clock, body.token)).toBe(next.clock);
  expect(dispatchClock(next.clock, body.clock.generation).accepted).toBe(false);
});

test("FIFO including nested publishes, capacity and deterministic tracing", () => {
  const bus = createLuxEventBus();
  const seen: string[] = [];
  const impulse: LuxEvent = { kind: "IMPULSE", subject: 0, timeUs: 0, intensity: 1 };
  bus.subscribe((event) => {
    seen.push(event.kind + " 1");
    if (event.kind === "IMPULSE") bus.publish({ ...event, kind: "SNAP_ENGAGE" });
  });
  bus.subscribe((event) => { seen.push(event.kind + " 2"); });
  bus.publish(impulse);
  expect(seen).toEqual(["IMPULSE 1", "IMPULSE 2", "SNAP_ENGAGE 1", "SNAP_ENGAGE 2"]);
  let queue = createEventQueue();
  for (let i = 0; i < 17; i++) queue = enqueueEvent(queue, { ...impulse, subject: i });
  expect(queue.pending).toHaveLength(16);
  expect(queue.dropped).toBe(1);
  expect(nextEvent(beginEventDrain(queue)).event.subject).toBe(0);

  let trace = createLuxTrace();
  for (const ms of [5, 1, 7, 3, 9, 2, 6, 4, 8, 10]) {
    trace = recordTrace(trace, { frameUs: ms * 1000, elapsedUs: 10000, expectedUs: 8000 }, 0);
  }
  const summary = summarizeTrace(trace);
  expect(summary).toEqual({ count: 10, p50: 5, p90: 9, p99: 10, hitchMillisecondsPerSecond: 30, idleWakeups: 0 });
  expect(checkLuxBudget(summary, defaultLuxBudget())).toBe(false);
  expect(checkLuxBudget({ ...summary, p99: 7, hitchMillisecondsPerSecond: 3 }, defaultLuxBudget())).toBe(true);
});

test("governor tiers, six living states and sensory silence", () => {
  for (const [thermalTier, hz] of [["nominal", 120], ["fair", 60], ["serious", 30], ["critical", 15]] as const) {
    expect(governFrames({
      thermalTier, heldTokens: 1, motionEnergy: 1, displayHz: 200, motionPolicy: "full", hidden: false,
    }, defaults)).toMatchObject({ hz, allowSvgDisplacement: false, allowBoxReflect: false });
  }
  expect(governFrames({
    thermalTier: "nominal", heldTokens: 0, motionEnergy: 1, displayHz: 120, motionPolicy: "full", hidden: false,
  }, defaults).hz).toBe(0);
  const energies = new Set<number>();
  for (const state of ["calm", "listening", "thinking", "focus", "alert", "circadian"] as const) {
    energies.add(solveLivingUniforms({ state, timeOfDay: 7, voiceLevel: 0.75, thermalTier: "nominal" }, defaults).energy);
  }
  expect(energies.size).toBe(6);
  const event: LuxEvent = { kind: "IMPULSE", subject: 1, timeUs: 0, intensity: 1 };
  expect(synthesizeSensory(event, false, false).sound.gain).toBeGreaterThan(0);
  expect(synthesizeSensory(event, true, false).sound.gain).toBe(0);
  expect(synthesizeSensory(event, false, true).haptics.intensity).toBe(0);
  expect(smoothVoice(idleVoice(), 1, 4000, false).level).toBeGreaterThan(0);
  expect(smoothVoice({ level: 0.9 }, 1, 4000, true)).toEqual(idleVoice());
});

test("10-second IdleFalsifier after real DOM host settle and mid-drag unmount", () => {
  const fake = fakeDom();
  const seen: string[] = [];
  const controller = mount(fake.element, { host: fake.host, module: { onEvent: (event) => seen.push(event.kind) } });
  expect(fake.scheduled.size).toBe(0);
  fake.pointer("pointerdown", 15, 10);
  fake.advance(35);
  fake.pointer("pointermove", 50, 30);
  fake.advance(35);
  fake.pointer("pointerup", 50, 30);
  fake.advance(5000);
  expect(seen).toContain("SETTLE");
  const settled = controller.metrics();
  expect(settled.clockTicks).toBeGreaterThan(0);
  fake.advance(10000);
  expect(falsifyIdle(settled, controller.metrics(), 10000000)).toMatchObject({
    passed: true, clockTicks: 0, hostRafCount: 0, heldTokens: 0,
  });

  fake.pointer("pointerdown", 50, 30);
  fake.advance(30);
  expect(controller.metrics().heldTokens).toBe(1);
  expect(fake.scheduled.size).toBe(1);
  controller.unmount();
  controller.unmount();
  expect(fake.pane.capture).toBeUndefined();
  expect(fake.listenerCount()).toBe(0);
  expect(fake.scheduled.size).toBe(0);
  const unmounted = controller.metrics();
  fake.pointer("pointerdown", 50, 30);
  fake.advance(10000);
  expect(falsifyIdle(unmounted, controller.metrics(), 10000000).passed).toBe(true);
});

test("pointercancel, blur, hidden, lost capture, and stale queued callbacks", () => {
  for (const reason of ["pointercancel", "blur", "hidden", "lostpointercapture"]) {
    const fake = fakeDom();
    const controller = mount(fake.element, { host: fake.host });
    fake.pointer("pointerdown", 5, 6);
    if (reason === "pointercancel") fake.pointer(reason, 5, 6);
    if (reason === "blur") fake.window.dispatchEvent(new Event(reason));
    if (reason === "hidden") {
      fake.document.hidden = true;
      fake.document.dispatchEvent(new Event("visibilitychange"));
      fake.document.hidden = false;
    }
    if (reason === "lostpointercapture") {
      const event = new Event(reason);
      Object.defineProperty(event, "pointerId", { value: 7 });
      fake.pane.dispatchEvent(event);
    }
    expect(controller.metrics().heldTokens).toBe(0);
    expect(fake.scheduled.size).toBe(0);
    fake.pointer("pointerdown", 2, 2);
    fake.cancelled.at(-1)?.(12);
    expect(controller.metrics()).toMatchObject({ clockTicks: 0, idleWakeups: 1, heldTokens: 1 });
    expect(fake.scheduled.size).toBe(1);
    controller.unmount();
    expect(fake.listenerCount()).toBe(0);
  }
});

test("an unsnapped magnet and spring settle at their shared equilibrium", () => {
  const conflict = {
    ...input, targetX: 80, targetY: 70, pushActive: false,
    field: { ...input.field, x: 50, y: 50 },
  };
  let moving = initialBody(95, 60, conflict.neighborHomeX, conflict.neighborHomeY);
  for (let frame = 0; frame < 450 && !moving.resting; frame++) {
    moving = stepPhysics(moving, conflict, 4000, defaults);
  }
  expect(moving.resting).toBe(true);
  expect(moving.snapped).toBe(false);
  expect(moving.x).toBeLessThan(79);
  expect(moving.vx).toBe(0);
});
