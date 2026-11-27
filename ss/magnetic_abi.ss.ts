import {
  createMagneticWindow, magneticPickup, magneticPose, magneticReducedMotion, magneticSpringCount,
  magneticVisibility, retargetMagneticWindow, stepMagneticWindow,
} from "./magnetic_tiling.ss.ts";
import type { MagneticPose, MagneticRect, MagneticSpring, MagneticWindowState } from "./magnetic_tiling.ss.ts";

function at(values: readonly number[], i: number): number { return values[i] ?? 0; }

function readRect(values: readonly number[], i: number): MagneticRect {
  return { x: at(values, i), y: at(values, i + 1), w: at(values, i + 2), h: at(values, i + 3) };
}

function readSpring(values: readonly number[], i: number): MagneticSpring {
  return { position: at(values, i), velocity: at(values, i + 1), target: at(values, i + 2),
    response: at(values, i + 3), damping: at(values, i + 4) };
}

function readState(values: readonly number[]): MagneticWindowState {
  return {
    x: readSpring(values, 14), y: readSpring(values, 19), w: readSpring(values, 24), h: readSpring(values, 29),
    m: readSpring(values, 34), lift: readSpring(values, 39), mag: readSpring(values, 44), cd: readSpring(values, 49),
    pulse: readSpring(values, 54), glow: readSpring(values, 59), vis: at(values, 64), reduce: at(values, 65) !== 0,
    box: readRect(values, 66), goal: readRect(values, 70), dipPeak: at(values, 74), dipPending: at(values, 75) !== 0,
  };
}

function writeSpring(out: number[], axis: MagneticSpring): void {
  out.push(axis.position);
  out.push(axis.velocity);
  out.push(axis.target);
  out.push(axis.response);
  out.push(axis.damping);
}

export function flatMagneticPose(p: MagneticPose): readonly number[] {
  return [p.cx, p.cy, p.z, p.w, p.h, p.sx, p.sy, p.fx, p.fy, p.rz, p.tiltX, p.tiltY, p.squash, p.phi, p.vx, p.vy,
    p.u, p.glass, p.content, p.shadow, p.frost, p.sheen, p.sheenAt, p.sheenAngle, p.tile, p.lift, p.pulse, p.glow,
    p.hidden ? 1 : 0];
}

// ABI v1. See c/starlux.h and c/README.md for field positions and command values.
export function magneticFrameFlat(input: readonly number[]): readonly number[] {
  if (input.length !== 76) return [];
  for (let i = 0; i < 76; i++) {
    if (!(Math.abs(at(input, i)) <= 1.7976931348623157e308)) return [];
  }
  const cmd = at(input, 0);
  const flag = at(input, 8) !== 0;
  const rect = readRect(input, 2);
  if (cmd < 0 || cmd > 6 || Math.floor(cmd) !== cmd) return [];
  if ((cmd === 0 || cmd === 2) && (rect.w <= 0 || rect.h <= 0)) return [];
  if (cmd === 2 && (at(input, 6) < 0.04 || at(input, 6) > 2 || at(input, 7) < 0.25 || at(input, 7) > 4)) return [];
  if (cmd === 1 && (at(input, 1) < 0 || at(input, 1) > 64000)) return [];
  if (at(input, 13) <= 0) return [];
  let state = readState(input);
  let events = 0;
  if (cmd === 0) state = createMagneticWindow(rect, flag);
  else if (cmd === 1) {
    const frame = stepMagneticWindow(state, at(input, 1));
    state = frame.state;
    if (frame.absorb) events += 1;
    if (frame.release) events += 2;
    if (frame.handoff) events += 4;
  } else if (cmd === 2) state = retargetMagneticWindow(state, rect, at(input, 6), at(input, 7), flag, at(input, 9) !== 0);
  else if (cmd === 3) state = magneticVisibility(state, flag);
  else if (cmd === 4) state = magneticPickup(state, flag, at(input, 6));
  else if (cmd === 5) state = magneticReducedMotion(state, flag);
  const pose = magneticPose(state, { x: at(input, 10), y: at(input, 11), z: at(input, 12), size: at(input, 13) });
  const out: number[] = [];
  writeSpring(out, state.x);
  writeSpring(out, state.y);
  writeSpring(out, state.w);
  writeSpring(out, state.h);
  writeSpring(out, state.m);
  writeSpring(out, state.lift);
  writeSpring(out, state.mag);
  writeSpring(out, state.cd);
  writeSpring(out, state.pulse);
  writeSpring(out, state.glow);
  out.push(state.vis);
  out.push(state.reduce ? 1 : 0);
  out.push(state.box.x);
  out.push(state.box.y);
  out.push(state.box.w);
  out.push(state.box.h);
  out.push(state.goal.x);
  out.push(state.goal.y);
  out.push(state.goal.w);
  out.push(state.goal.h);
  out.push(state.dipPeak);
  out.push(state.dipPending ? 1 : 0);
  const flat = flatMagneticPose(pose);
  for (let i = 0; i < 29; i++) out.push(at(flat, i));
  out.push(events);
  out.push(magneticSpringCount(state));
  return out;
}
