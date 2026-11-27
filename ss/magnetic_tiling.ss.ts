import { atan2_64, clamp, clamp01, exp64, ln64, sin64 } from "./physics/math.ss.ts";
import { springKick } from "./physics/spring.ss.ts";

export type MagneticRect = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
export type MagneticDock = { readonly x: number; readonly y: number; readonly z: number; readonly size: number };
export type MagneticSpring = {
  readonly position: number; readonly velocity: number; readonly target: number;
  readonly response: number; readonly damping: number;
};

export function magneticPerspective(): number { return 1600; }
export function magneticLift(): number { return 74; }

export function magneticSpring(at: number, response: number, damping: number): MagneticSpring {
  return { position: at, velocity: 0, target: at, response: response, damping: damping };
}

export function magneticTarget(
  axis: MagneticSpring, goal: number, response: number, damping: number, jump: boolean, monotone: boolean,
): MagneticSpring {
  if (jump) return magneticSpring(goal, response, damping);
  if (goal === axis.target && response === axis.response && damping === axis.damping) return axis;
  const delta = goal - axis.position;
  let velocity = axis.velocity;
  // A critically damped axis can cross its target if an incoming velocity is too large.
  if (monotone) velocity = Math.sign(delta) * clamp(velocity * Math.sign(delta), 0, Math.abs(delta) * 6.283185307179586 / response);
  return { position: axis.position, velocity: velocity, target: goal, response: response, damping: damping };
}

export function magneticMoving(axis: MagneticSpring): boolean {
  return axis.position !== axis.target || axis.velocity !== 0;
}

export function stepMagneticSpring(axis: MagneticSpring, dtUs: number, pixel: boolean): MagneticSpring {
  if (!magneticMoving(axis) || dtUs <= 0) return axis;
  const next = springKick(axis.position, axis.velocity, axis.target, dtUs, 6.283185307179586 / axis.response, axis.damping);
  const epsilon = pixel ? 0.05 : 0.0002;
  const speed = pixel ? 1.5 : 0.004;
  if (Math.abs(next.position - axis.target) < epsilon && Math.abs(next.velocity) < speed) {
    return magneticSpring(axis.target, axis.response, axis.damping);
  }
  return { position: next.position, velocity: next.velocity, target: axis.target, response: axis.response, damping: axis.damping };
}

export function magneticSmooth(a: number, b: number, value: number): number {
  const t = clamp01((value - a) / (b - a));
  return t * t * (3 - 2 * t);
}
export function magneticMix(a: number, b: number, t: number): number { return a + (b - a) * t; }
export function magneticLength(x: number, y: number): number { return Math.sqrt(x * x + y * y); }

export type MagneticWindowState = {
  readonly x: MagneticSpring; readonly y: MagneticSpring; readonly w: MagneticSpring; readonly h: MagneticSpring;
  readonly m: MagneticSpring; readonly lift: MagneticSpring; readonly mag: MagneticSpring;
  readonly cd: MagneticSpring; readonly pulse: MagneticSpring; readonly glow: MagneticSpring;
  readonly vis: number; readonly reduce: boolean; readonly box: MagneticRect;
  readonly goal: MagneticRect; readonly dipPeak: number; readonly dipPending: boolean;
};
export type MagneticPose = {
  readonly cx: number; readonly cy: number; readonly z: number; readonly w: number; readonly h: number;
  readonly sx: number; readonly sy: number; readonly fx: number; readonly fy: number;
  readonly rz: number; readonly tiltX: number; readonly tiltY: number;
  readonly squash: number; readonly phi: number; readonly vx: number; readonly vy: number;
  readonly u: number; readonly glass: number; readonly content: number; readonly shadow: number;
  readonly frost: number; readonly sheen: number; readonly sheenAt: number; readonly sheenAngle: number;
  readonly tile: number; readonly lift: number; readonly pulse: number; readonly glow: number; readonly hidden: boolean;
};

export function createMagneticWindow(rect: MagneticRect, reduce: boolean): MagneticWindowState {
  return {
    x: magneticSpring(rect.x, 0.46, 1), y: magneticSpring(rect.y, 0.46, 1),
    // The width and height axes carry the right and bottom edges for a symmetric FLIP.
    w: magneticSpring(rect.x + rect.w, 0.46, 1), h: magneticSpring(rect.y + rect.h, 0.46, 1),
    m: magneticSpring(0, 0.42, 0.86), lift: magneticSpring(0, 0.28, 0.78),
    mag: magneticSpring(0, 0.22, 0.90), cd: magneticSpring(0, 0.36, 1),
    pulse: magneticSpring(0, 0.30, 0.42), glow: magneticSpring(0, 0.50, 1),
    vis: 1, reduce: reduce, box: rect, goal: rect, dipPeak: 0, dipPending: false,
  };
}

export function magneticRect(state: MagneticWindowState): MagneticRect {
  return { x: state.x.position, y: state.y.position,
    w: state.w.position - state.x.position, h: state.h.position - state.y.position };
}

export function magneticVisibility(state: MagneticWindowState, minimize: boolean): MagneticWindowState {
  const goal = minimize ? 1 : 0;
  return { ...state, m: magneticTarget(state.m, goal, minimize ? 0.42 : 0.50, 0.86, state.reduce, false) };
}

export function magneticReducedMotion(state: MagneticWindowState, reduce: boolean): MagneticWindowState {
  if (state.reduce === reduce) return state;
  const next = retargetMagneticWindow(state, state.goal, 0.46, 1, true, false);
  return { ...next, reduce: reduce, vis: 1 - state.m.target,
    m: magneticSpring(state.m.target, state.m.response, state.m.damping),
    lift: magneticSpring(state.lift.target, 0.28, 0.78), mag: magneticSpring(state.mag.target, 0.22, 0.90),
    pulse: magneticSpring(0, 0.30, 0.42), glow: magneticSpring(0, 0.50, 1) };
}

export function magneticPickup(state: MagneticWindowState, picked: boolean, latch: number): MagneticWindowState {
  return { ...state, box: picked && state.dipPending ? state.goal : state.box,
    dipPending: picked ? false : state.dipPending,
    lift: magneticTarget(state.lift, picked ? 1 : 0, 0.28, 0.78, state.reduce, false),
    mag: magneticTarget(state.mag, latch, 0.22, 0.90, state.reduce, false) };
}

export function retargetMagneticWindow(
  state: MagneticWindowState, rect: MagneticRect, response: number, damping: number, jump: boolean, held: boolean,
): MagneticWindowState {
  const immediate = jump || state.reduce;
  const cur = magneticRect(state);
  const ds = Math.max(Math.abs(rect.w - cur.w) / Math.max(1, rect.w, cur.w),
    Math.abs(rect.h - cur.h) / Math.max(1, rect.h, cur.h));
  let peak = state.dipPeak;
  let pending = state.dipPending;
  let box = state.box;
  let cd = state.cd;
  if (immediate && !held) {
    box = rect;
    cd = magneticSpring(0, 0.36, 1);
    peak = 0;
    pending = false;
  } else if (!held) {
    if (ds > 0.02 && (Math.abs(rect.w - box.w) > 0.5 || Math.abs(rect.h - box.h) > 0.5)) {
      peak = Math.max(cd.position, Math.min(0.92, ds * 2.4));
      cd = magneticTarget(cd, peak, 0.09, 1, false, false);
      pending = true;
    } else {
      pending = false;
      box = rect;
    }
  }
  let goal = state.goal;
  if (!held) goal = rect;
  return { ...state, goal: goal, box: box, cd: cd, dipPeak: peak, dipPending: pending,
    x: magneticTarget(state.x, rect.x, response, damping, immediate, damping === 1),
    y: magneticTarget(state.y, rect.y, response, damping, immediate, damping === 1),
    w: magneticTarget(state.w, rect.x + rect.w, response, damping, immediate, damping === 1),
    h: magneticTarget(state.h, rect.y + rect.h, response, damping, immediate, damping === 1) };
}

export function magneticSpringCount(state: MagneticWindowState): number {
  return (magneticMoving(state.x) ? 1 : 0) + (magneticMoving(state.y) ? 1 : 0) +
    (magneticMoving(state.w) ? 1 : 0) + (magneticMoving(state.h) ? 1 : 0) + (magneticMoving(state.m) ? 1 : 0) +
    (magneticMoving(state.lift) ? 1 : 0) + (magneticMoving(state.mag) ? 1 : 0) + (magneticMoving(state.cd) ? 1 : 0) +
    (magneticMoving(state.pulse) ? 1 : 0) + (magneticMoving(state.glow) ? 1 : 0) +
    (state.reduce && state.vis !== 1 - state.m.target ? 1 : 0);
}

export type MagneticStep = {
  readonly state: MagneticWindowState; readonly absorb: boolean;
  readonly release: boolean; readonly handoff: boolean;
};

export function stepMagneticWindow(state: MagneticWindowState, dtUs: number): MagneticStep {
  const m = stepMagneticSpring(state.m, dtUs, false);
  const absorb = state.m.position < 0.88 && m.position >= 0.88;
  const release = state.m.position > 0.97 && m.position <= 0.97;
  const handoff = state.m.position < 0.55 && m.position >= 0.55;
  let cd = stepMagneticSpring(state.cd, dtUs, false);
  const swapBox = state.dipPending && (cd.position >= state.dipPeak * 0.8 || !magneticMoving(cd));
  if (cd.target !== 0 && cd.position >= state.dipPeak * 0.92) cd = magneticTarget(cd, 0, 0.36, 1, false, false);
  let vis = state.vis;
  if (state.reduce) {
    const delta = 1 - m.target - vis;
    const step = clamp(dtUs, 0, 64000) / 150000;
    if (Math.abs(delta) <= step + 1e-9) vis = 1 - m.target;
    else vis += Math.sign(delta) * step;
  }
  let pulse = stepMagneticSpring(state.pulse, dtUs, false);
  let glow = stepMagneticSpring(state.glow, dtUs, false);
  if (absorb || release) {
    let momentum = -clamp(10 + 1.2 * Math.abs(m.velocity), 10, 18);
    if (absorb) momentum = clamp(14 + 1.6 * Math.abs(m.velocity), 14, 26);
    pulse = { ...pulse, velocity: pulse.velocity + momentum };
    glow = { ...glow, velocity: glow.velocity + (absorb ? 30 : 18) };
  }
  return { absorb: absorb, release: release, handoff: handoff, state: { ...state,
    x: stepMagneticSpring(state.x, dtUs, true), y: stepMagneticSpring(state.y, dtUs, true),
    w: stepMagneticSpring(state.w, dtUs, true), h: stepMagneticSpring(state.h, dtUs, true),
    lift: stepMagneticSpring(state.lift, dtUs, false), mag: stepMagneticSpring(state.mag, dtUs, false),
    m: m, cd: cd, pulse: pulse, glow: glow, vis: vis,
    box: swapBox ? state.goal : state.box, dipPending: state.dipPending && !swapBox } };
}

export function magneticPose(state: MagneticWindowState, dock: MagneticDock): MagneticPose {
  const w = Math.max(24, state.w.position - state.x.position);
  const h = Math.max(24, state.h.position - state.y.position);
  const cx = (state.x.position + state.w.position) / 2;
  const cy = (state.y.position + state.h.position) / 2;
  const vx = (state.x.velocity + state.w.velocity) / 2;
  const vy = (state.y.velocity + state.h.velocity) / 2;
  const lift = clamp(state.lift.position, -0.3, 1.3);
  const speed = magneticLength(vx, vy);
  const fx = w / Math.max(1, state.box.w), fy = h / Math.max(1, state.box.h);
  const visible = state.reduce ? state.vis : 1;
  let squash = 0;
  if (!state.reduce && speed > 60) squash = Math.min(0.035, speed / 60000);
  const pose: MagneticPose = {
    cx: cx, cy: cy, w: w, h: h, z: magneticLift() * lift, vx: vx, vy: vy,
    rz: state.reduce ? 0 : clamp(vx * 0.0021, -3, 3), sx: fx, sy: fy, fx: fx, fy: fy,
    tiltX: state.reduce ? 0 : clamp(-vy * 0.0021, -3, 3),
    tiltY: state.reduce ? 0 : clamp(vx * 0.0021, -3, 3),
    squash: squash, phi: atan2_64(vy, vx),
    glass: visible, content: visible * (1 - 0.92 * clamp01(state.cd.position)),
    shadow: visible * (0.78 + 0.22 * clamp01(lift)), lift: lift,
    frost: 0, sheen: 0, sheenAt: 0, sheenAngle: 25, u: 0,
    tile: state.reduce ? (state.m.target === 1 ? 1 - visible : 0) : magneticSmooth(0.86, 1, state.m.position),
    pulse: clamp(state.pulse.position, -1.2, 1.2), glow: clamp01(state.glow.position),
    hidden: state.reduce ? (visible === 0 && state.m.target === 1) : !magneticMoving(state.m) && state.m.position >= 1,
  };
  if (state.reduce) return { ...pose, z: 0, lift: 0 };
  if (Math.abs(state.m.position) <= 0.000001) return pose;

  const u = clamp(state.m.position, -0.25, 1.1), uc = clamp01(u), a = 1 - uc;
  const c1y = cy - 40;
  const drop = (dock.y - cy) * 0.55;
  const c2y = dock.y - Math.max(80, drop);
  const c2Rate = drop > 80 ? 0.55 : 0;
  const dx = 6 * a * uc * (dock.x - cx);
  const dy = 3 * a * a * (c1y - cy) + 6 * a * uc * (c2y - c1y) + 3 * uc * uc * (dock.y - c2y);
  const x = magneticMix(cx, dock.x, uc * uc * (3 - 2 * uc));
  const y = a * a * a * cy + 3 * a * a * uc * c1y + 3 * a * uc * uc * c2y + uc * uc * uc * dock.y + dy * (u - uc);
  const arcVx = dx * state.m.velocity, arcVy = dy * state.m.velocity;
  const arcSpeed = magneticLength(arcVx, arcVy);
  const baseVy = vy * (a * a * a + 3 * a * a * uc + 3 * a * uc * uc * c2Rate -
    3 * c2Rate * Math.max(0, u - 1));
  const scale = exp64(ln64(Math.max(1, dock.size) / Math.min(w, h)) * (0.7 * u + (u < 0 ? 0 : 0.3 * u * u)));
  let arcSquash = pose.squash;
  if (arcSpeed > 1) arcSquash = Math.max(pose.squash, Math.min(0.07, arcSpeed / 60000));
  return { ...pose, u: u, cx: x, cy: y, sx: fx * scale, sy: fy * scale,
    z: magneticMix(pose.z, dock.z, 1 - a * a) + 56 * sin64(3.141592653589793 * uc),
    rz: pose.rz + clamp(arcVx * 0.0012, -4, 4),
    vx: vx * (1 - uc * uc * (3 - 2 * uc)) + arcVx,
    vy: baseVy + arcVy,
    squash: arcSquash,
    phi: arcSpeed > 1 ? atan2_64(arcVy, arcVx) : pose.phi,
    content: pose.content * (1 - magneticSmooth(0.06, 0.48, u)),
    glass: 1 - magneticSmooth(0.84, 1, u), shadow: pose.shadow * (1 - magneticSmooth(0.50, 0.92, u)),
    frost: magneticSmooth(0.08, 0.40, u) * (1 - magneticSmooth(0.74, 0.96, u)),
    sheen: magneticSmooth(0.10, 0.36, u) * (1 - magneticSmooth(0.70, 0.94, u)), sheenAt: uc };
}

export function magneticSnapAnomaly(previous: MagneticPose, next: MagneticPose, dtUs: number): boolean {
  if (dtUs <= 0 || dtUs > 34000) return false;
  const speed = Math.max(magneticLength(previous.vx, previous.vy), magneticLength(next.vx, next.vy));
  return magneticLength(next.cx - previous.cx, next.cy - previous.cy) > 3 * (speed * dtUs / 1000000 + 1);
}

export function magneticAudit(state: MagneticWindowState, pose: MagneticPose, snapAnomalies: number): number {
  let issues = snapAnomalies === 0 ? 0 : 1;
  if (magneticSpringCount(state) !== 0) return issues;
  if (state.m.target === 1 && (!pose.hidden || pose.glass !== 0)) issues += 2;
  if (state.m.target === 0 && (pose.hidden || pose.glass < 0.999 || pose.content < 0.999)) issues += 4;
  return issues;
}
