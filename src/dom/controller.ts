import { clampSpatialKnobs, defaultSpatialKnobs, spatialPreset } from "../../ss/lux/knobs.ss.ts";
import type { SpatialPhysicsConfig, SpatialPreset } from "../../ss/lux/knobs.ss.ts";
import {
  acquireWake, createLuxClock, dispatchClock, heldWakeTokens, releaseWake, sampleBodyRest, shutdownClock,
} from "../../ss/lux/wake.ss.ts";
import { governFrames } from "../../ss/lux/governor.ss.ts";
import type { FrameGovernor, ReducedMotionPolicy, ThermalTier } from "../../ss/lux/governor.ss.ts";
import { createLuxTrace, recordTrace, summarizeTrace } from "../../ss/lux/trace.ss.ts";
import { frameUs } from "../../ss/physics/math.ss.ts";
import { beginGesture, idleGesture, predictFlick, releaseGesture, sampleGesture } from "../../ss/physics/gesture.ss.ts";
import { initialBody, launchBody, stepPhysics } from "../../ss/physics/simulator.ss.ts";
import type { BodyState, PhysicsInput } from "../../ss/physics/simulator.ss.ts";
import { windowPose } from "../../ss/physics/organic.ss.ts";
import type { WindowPose } from "../../ss/physics/organic.ss.ts";
import { synthesizeSensory } from "../../ss/sensory.ss.ts";
import type { SensoryEnvelope } from "../../ss/sensory.ss.ts";
import type { LuxEvent, LuxEventKind } from "../../ss/lux/events.ss.ts";
import { createLuxEventBus } from "../events.ts";

export type DomHost = {
  readonly window: EventTarget;
  readonly document: EventTarget & { readonly hidden: boolean };
  readonly requestFrame: (callback: FrameRequestCallback) => number;
  readonly cancelFrame: (handle: number) => void;
  readonly now: () => number;
  readonly reducedMotion?: Pick<MediaQueryList, "matches" | "addEventListener" | "removeEventListener">;
};

export type DomFrame = {
  readonly state: BodyState;
  readonly pose: WindowPose;
  readonly governor: FrameGovernor;
  readonly dragging: boolean;
};

export type DomModule = {
  readonly physics?: Omit<PhysicsInput, "targetX" | "targetY" | "pushActive">;
  readonly frostedGlass?: boolean;
  readonly allow3dTiltOnGlass?: boolean;
  readonly focused?: boolean;
  readonly minimize?: { readonly progress: number; readonly dockDx: number; readonly dockDy: number };
  readonly onFrame?: (frame: DomFrame) => void;
  readonly onEvent?: (event: LuxEvent, envelope: SensoryEnvelope) => void;
};

export type DomOptions = {
  readonly host?: DomHost;
  readonly knobs?: SpatialPhysicsConfig;
  readonly preset?: SpatialPreset;
  readonly module?: DomModule;
  readonly initialX?: number;
  readonly initialY?: number;
  readonly displayHz?: number;
};

const freeSpace: NonNullable<DomModule["physics"]> = {
  neighborHomeX: 0, neighborHomeY: 0,
  field: { enabled: false, x: 0, y: 0, edge: false, corner: false },
  bounds: { enabled: false, minX: 0, maxX: 0, minY: 0, maxY: 0 },
};

function browserHost(element: HTMLElement): DomHost {
  const view = element.ownerDocument.defaultView;
  if (view === null) throw new Error("Starlux requires a window or an injected host");
  return {
    window: view, document: element.ownerDocument,
    requestFrame: (callback) => view.requestAnimationFrame(callback),
    cancelFrame: (handle) => view.cancelAnimationFrame(handle), now: () => view.performance.now(),
    reducedMotion: view.matchMedia("(prefers-reduced-motion: reduce)"),
  };
}

export function mount(element: HTMLElement, options: DomOptions = {}) {
  const host = options.host ?? browserHost(element);
  let module = options.module ?? {};
  let knobs = clampSpatialKnobs(options.knobs ?? (options.preset ? spatialPreset(options.preset) : defaultSpatialKnobs()));
  const reducedPreset = spatialPreset("reduced-motion");
  let reducedKnobs = reduceKnobs(knobs);
  let clock = createLuxClock();
  let trace = createLuxTrace();
  const bus = createLuxEventBus();
  let gesture = idleGesture();
  let body = initialBody(options.initialX ?? 0, options.initialY ?? 0,
    module.physics?.neighborHomeX ?? 0, module.physics?.neighborHomeY ?? 0);
  let targetX = body.x;
  let targetY = body.y;
  let offsetX = 0;
  let offsetY = 0;
  let pointerAt = 0;
  let bodyToken = 0;
  let gestureToken = 0;
  let raf: number | undefined;
  let frameAt: number | undefined;
  let hostRafCount = 0;
  let thermalTier: ThermalTier = "nominal";
  let requestedPolicy: ReducedMotionPolicy = "full";
  let mounted = true;

  function policy(): ReducedMotionPolicy {
    if (requestedPolicy === "off") return "off";
    if (host.reducedMotion?.matches) return "reduce";
    return requestedPolicy;
  }

  function reduceKnobs(value: SpatialPhysicsConfig): SpatialPhysicsConfig {
    return {
      ...value, springResponseMs: reducedPreset.springResponseMs, springDampingRatio: reducedPreset.springDampingRatio,
      enableMagnetism: false, enableRubberBand: false, enableOrganicTilt: false, enableInertialSquash: false,
      enableEmptyGlassMinimize: false, enableDockImpulse: false, enableCoupledNeighbors: false,
      enableSpecularRim: false, enableLivingBackdrop: false,
    };
  }

  function activeKnobs(): SpatialPhysicsConfig {
    return policy() === "reduce" ? reducedKnobs : knobs;
  }

  function animates(config: SpatialPhysicsConfig): boolean {
    return policy() !== "off" && (options.displayHz ?? 60) >= 15 && (config.enableSprings ||
      config.enableMagnetism || config.enableRubberBand || config.enableCoupledNeighbors);
  }

  function governor(config: SpatialPhysicsConfig): FrameGovernor {
    return governFrames({
      heldTokens: heldWakeTokens(clock), motionEnergy: gesture.active ? 1 : (Math.abs(body.vx) + Math.abs(body.vy)) / 1500,
      displayHz: options.displayHz ?? 60, thermalTier, motionPolicy: policy(), hidden: host.document.hidden,
    }, config);
  }

  function emit(kind: LuxEventKind, timeUs: number, intensity: number): void {
    if (!mounted) return;
    const event = { kind, timeUs, intensity, subject: 0 };
    bus.publish(event);
  }

  function draw(config: SpatialPhysicsConfig, decision: FrameGovernor): void {
    const minimize = module.minimize;
    module.onFrame?.({
      state: body, governor: decision, dragging: gesture.active,
      pose: windowPose({
        vx: body.vx, vy: body.vy, cornerTorque: body.torque, dragging: gesture.active,
        frostedGlass: module.frostedGlass ?? false, allow3dTiltOnGlass: module.allow3dTiltOnGlass ?? false,
        focused: module.focused ?? true,
        minimizeU: minimize?.progress ?? 0, dockDx: minimize?.dockDx ?? 0, dockDy: minimize?.dockDy ?? 0,
      }, config),
    });
  }

  function cancelFrame(): void {
    const handle = raf;
    raf = undefined;
    if (handle !== undefined) host.cancelFrame(handle);
    frameAt = undefined;
  }

  function schedule(): void {
    if (!mounted || raf !== undefined || heldWakeTokens(clock) === 0 || governor(activeKnobs()).hz === 0) return;
    const epoch = clock.generation;
    const handle = host.requestFrame((now) => {
      hostRafCount += 1;
      if (!mounted || raf !== handle || epoch !== clock.generation) {
        if (epoch !== clock.generation || heldWakeTokens(clock) === 0) {
          clock = dispatchClock(clock, epoch).clock;
        }
        return;
      }
      raf = undefined;
      frame(now, epoch);
    });
    raf = handle;
  }

  function frame(now: number, epoch: number): void {
    const config = activeKnobs();
    const decision = governor(config);
    if (decision.hz === 0) return;
    const interval = 1000 / decision.hz;
    const elapsed = frameAt === undefined ? interval : now - frameAt;
    try {
      if (elapsed + 0.25 < interval) return;
      const accepted = dispatchClock(clock, epoch);
      clock = accepted.clock;
      if (!accepted.accepted) return;
      frameAt = now;
      const begin = host.now();
      const wasBoundary = body.boundaryHit;
      const physics = module.physics ?? freeSpace;
      body = stepPhysics(body, { ...physics, targetX, targetY, pushActive: gesture.active }, frameUs(elapsed * 1000), config);
      const beforeSample = heldWakeTokens(clock);
      if (bodyToken > 0) clock = sampleBodyRest(clock, bodyToken, body.resting, config);
      const settled = heldWakeTokens(clock) < beforeSample;
      if (settled) bodyToken = 0;
      const timeUs = Math.floor(now * 1000);
      draw(config, decision);
      if (epoch === clock.generation || (settled && heldWakeTokens(clock) === 0)) {
        if (body.snapEngaged) emit("SNAP_ENGAGE", timeUs, 0.7);
        if (body.snapReleased) emit("SNAP_RELEASE", timeUs, 0.35);
        if (body.boundaryHit && !wasBoundary) emit("BOUNDARY_HIT", timeUs, 0.55);
        if (settled) emit("SETTLE", timeUs, 0);
      }
      trace = recordTrace(trace, {
        frameUs: Math.max(0, (host.now() - begin) * 1000),
        expectedUs: interval * 1000, elapsedUs: elapsed * 1000,
      }, clock.idleWakeupCount);
    } finally {
      if (heldWakeTokens(clock) === 0) cancelFrame();
      else schedule();
    }
  }

  function relinquishPointer(): void {
    const pointer = gesture.pointerId;
    const hadPointer = gesture.active;
    gesture = releaseGesture(gesture);
    clock = releaseWake(clock, gestureToken);
    gestureToken = 0;
    try {
      if (hadPointer && element.hasPointerCapture?.(pointer)) element.releasePointerCapture(pointer);
    } catch {
      // A pointer can disappear before capture is released.
    }
  }

  function cancel(): void {
    relinquishPointer();
    clock = shutdownClock(clock);
    bodyToken = 0;
    cancelFrame();
    targetX = body.x;
    targetY = body.y;
    body = launchBody(body, body.x, body.y, 0, 0);
  }

  function pointerDown(event: PointerEvent): void {
    if (!mounted || host.document.hidden || gesture.active || event.button !== 0 || event.isPrimary === false) return;
    const config = activeKnobs();
    gesture = beginGesture(gesture, event.pointerId, event.clientX, event.clientY);
    if (bodyToken > 0) {
      clock = releaseWake(clock, bodyToken);
      bodyToken = 0;
      if (heldWakeTokens(clock) === 0) cancelFrame();
    }
    offsetX = body.x - gesture.x;
    offsetY = body.y - gesture.y;
    pointerAt = event.timeStamp;
    if (animates(config)) {
      const next = acquireWake(clock, "gesture");
      clock = next.clock;
      gestureToken = next.token;
    }
    try {
      element.setPointerCapture?.(event.pointerId);
    } catch {
      // A host can lose the pointer before capture. Window listeners still receive cancellation.
    }
    schedule();
  }

  function pointerMove(event: PointerEvent): void {
    if (!gesture.active || event.pointerId !== gesture.pointerId) return;
    const config = activeKnobs();
    const dtUs = Math.max(1, Math.floor((event.timeStamp - pointerAt) * 1000));
    gesture = sampleGesture(gesture, event.pointerId, event.clientX, event.clientY, dtUs, config);
    pointerAt = event.timeStamp;
    targetX = gesture.x + offsetX;
    targetY = gesture.y + offsetY;
    if (gestureToken === 0) {
      body = launchBody(body, targetX, targetY, 0, 0);
      draw(config, governor(config));
    } else {
      schedule();
    }
  }

  function pointerUp(event: PointerEvent): void {
    if (!gesture.active || event.pointerId !== gesture.pointerId) return;
    if (event.clientX !== gesture.x || event.clientY !== gesture.y) pointerMove(event);
    if (!mounted || !gesture.active) return;
    const config = activeKnobs();
    let impulse = 0;
    if (gestureToken > 0) {
      const flick = predictFlick(gesture, config);
      impulse = Math.hypot(flick.vx, flick.vy) / 4500;
      const lease = acquireWake(clock, "body");
      clock = lease.clock;
      bodyToken = lease.token;
      const full = policy() === "full";
      targetX = (full ? flick.x : gesture.x) + offsetX;
      targetY = (full ? flick.y : gesture.y) + offsetY;
      body = launchBody(body, body.x, body.y, full ? flick.vx : 0, full ? flick.vy : 0);
    }
    relinquishPointer();
    try {
      if (bodyToken > 0) emit("IMPULSE", Math.floor(event.timeStamp * 1000), impulse);
    } finally {
      schedule();
    }
  }

  function pointerCancel(event: PointerEvent): void {
    if (gesture.active && event.pointerId === gesture.pointerId) cancel();
  }

  function visibility(): void {
    if (host.document.hidden) cancel();
  }

  function updatePolicy(): void {
    if (!animates(activeKnobs()) || host.document.hidden) cancel();
    schedule();
  }

  function setKnobs(value: SpatialPhysicsConfig): void {
    if (!mounted) return;
    knobs = clampSpatialKnobs(value);
    reducedKnobs = reduceKnobs(knobs);
    updatePolicy();
  }

  bus.subscribe((event) => {
    if (!mounted) return;
    module.onEvent?.(event, synthesizeSensory(event, body.resting, policy() !== "full"));
  });

  const listeners: readonly [EventTarget, string, EventListener][] = [
    [element, "pointerdown", pointerDown as EventListener],
    [element, "lostpointercapture", pointerCancel as EventListener],
    [host.window, "pointermove", pointerMove as EventListener],
    [host.window, "pointerup", pointerUp as EventListener],
    [host.window, "pointercancel", pointerCancel as EventListener],
    [host.window, "blur", cancel],
    [host.document, "visibilitychange", visibility],
  ];
  for (const [target, type, listener] of listeners) target.addEventListener(type, listener);
  host.reducedMotion?.addEventListener("change", updatePolicy);

  return {
    setKnobs,
    setPreset(preset: SpatialPreset): void {
      setKnobs(spatialPreset(preset));
    },
    setModule(value: DomModule): void {
      if (mounted) module = value;
    },
    setEnvironment(tier: ThermalTier, motionPolicy: ReducedMotionPolicy): void {
      if (!mounted) return;
      thermalTier = tier;
      requestedPolicy = motionPolicy;
      updatePolicy();
    },
    subscribe(listener: (event: LuxEvent) => void): () => void {
      return mounted ? bus.subscribe((event) => { if (mounted) listener(event); }) : () => {};
    },
    metrics() {
      return {
        clockTicks: clock.clockTicks, hostRafCount, heldTokens: heldWakeTokens(clock),
        idleWakeups: clock.idleWakeupCount,
        trace: summarizeTrace({ samples: trace.samples, idleWakeups: clock.idleWakeupCount }),
      };
    },
    unmount(): void {
      if (!mounted) return;
      mounted = false;
      cancel();
      for (const [target, type, listener] of listeners) target.removeEventListener(type, listener);
      host.reducedMotion?.removeEventListener("change", updatePolicy);
      bus.clear();
      module = {};
    },
  };
}
