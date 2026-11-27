import { expect, test } from "bun:test";
import {
  auditSettledInvariants, createMagneticWindow, magneticAudit, magneticEdgeFields, magneticEdgeZone,
  magneticFrameFlat, magneticIntersection, magneticMonitorHandoff, magneticPickup, magneticPose, magneticRect,
  magneticSnapAnomaly, magneticSpringCount, magneticVisibility, magneticZoneRect, MagneticTiling, mountMagneticTiling,
  planMagneticNeighbors, retargetMagneticWindow, stepMagneticWindow,
} from "../src/index.ts";
import type { MagneticEvent, MagneticPreset, MagneticWindowState } from "../src/index.ts";
import { fakeMagneticDom } from "./fixtures.ts";

const screen = { x: 0, y: 0, w: 1200, h: 860 };
const rect = { x: 80, y: 80, w: 420, h: 350 };
const dock = { x: 600, y: 860, z: 60, size: 44 };
const initial = () => createMagneticWindow(rect, false);

export function scene(reduce = false) {
  return new MagneticTiling({ reduce, monitors: [{ id: "one", viewport: screen }],
    windows: [
      { id: "a", rect, dock },
      { id: "b", rect: { x: 300, y: 270, w: 350, h: 350 }, dock: { ...dock, x: 650 } },
      { id: "c", rect: { x: 650, y: 80, w: 410, h: 350 }, dock: { ...dock, x: 700 } },
    ] });
}

test("R29 empty glass clears content at mid-flight", () => {
  const at = (u: number) => {
    const start = initial();
    return magneticPose({ ...start, m: { ...start.m, position: u, target: 1 } }, dock);
  };
  expect(at(0.06).content).toBe(1);
  expect(at(0.27).content).toBeCloseTo(0.5, 12);
  expect(at(0.48).content).toBe(0);
  for (const u of [0.5, 0.6, 0.7, 0.84]) {
    const p = at(u);
    expect(p.content).toBe(0);
    expect(p.glass).toBe(1);
    expect(p.sx).toBeCloseTo(p.sy, 12);
    expect(p.sx).toBeLessThan(1);
    expect(p.sx).toBeGreaterThan(dock.size / rect.h);
    expect(p.sheen).toBeGreaterThan(0);
    expect(p.sheenAt).toBe(u);
  }
  expect(at(0.90).glass).toBeLessThan(1);
  const end = at(1);
  expect(end.sx).toBeCloseTo(dock.size / rect.h, 12);
  expect(end.glass).toBe(0);
  expect(end.hidden).toBe(true);
});

test("absorb crossing delivers exactly one momentum dip and release", () => {
  const engine = scene();
  const events: MagneticEvent[] = [];
  engine.onEvent((event) => events.push(event));
  engine.minimize("a");
  let positive = false;
  let rebound = false;
  let crossings = 0;
  let previous = 0;
  for (let i = 0; i < 144; i++) {
    engine.runMs(8.333);
    const w = engine.window("a");
    if (previous < 0.88 && w.state.m.position >= 0.88) {
      crossings++;
      expect(events.filter((e) => e.kind === "absorb")).toHaveLength(crossings);
      expect(w.state.pulse.velocity).toBeGreaterThan(0);
    }
    previous = w.state.m.position;
    positive ||= w.pose.pulse > 0.02;
    rebound ||= positive && w.pose.pulse < -0.02;
  }
  expect(crossings).toBe(1);
  expect(positive && rebound).toBe(true);
  expect(events.filter((e) => e.kind === "absorb")).toHaveLength(1);
  expect(events.find((e) => e.kind === "absorb")?.sensory?.haptics.intensity).toBeGreaterThan(0);
  expect(events.filter((e) => e.kind === "handoff")).toHaveLength(1);
  engine.restore("a");
  engine.runMs(2000);
  expect(events.filter((e) => e.kind === "release")).toHaveLength(1);
  expect(engine.metrics().activeSprings).toBe(0);
});

test("interrupted flights and morphs settle to hidden or opaque states", () => {
  const engine = scene();
  expect(engine.minimize("a")).toBe(true);
  expect(engine.minimize("a")).toBe(false);
  engine.runMs(1300);
  expect(engine.window("a").pose.hidden).toBe(true);
  expect(engine.window("a").pose.glass).toBe(0);
  engine.restore("a");
  expect(engine.window("a").pose.hidden).toBe(false);
  for (const [index, layout] of (["focus", "thirds", "bento", "split", "cascade", "free"] as const).entries()) {
    engine.setLayout(layout);
    engine.runMs(49 + index * 13);
    if (index % 2) engine.restore("b");
    else engine.minimize("b");
  }
  engine.runMs(2200);
  expect(engine.window("a").pose.content).toBeGreaterThanOrEqual(0.999);
  expect(engine.window("a").pose.glass).toBeGreaterThanOrEqual(0.999);
  for (const win of engine.windows) expect(auditSettledInvariants(win)).toEqual({ passed: true, issues: [], snapAnomalies: 0 });
});

test("analytic snap audit flags displacement beyond three times endpoint velocity", () => {
  const pose = magneticPose(initial(), dock);
  expect(magneticSnapAnomaly(pose, { ...pose, cx: pose.cx + 3 }, 8000)).toBe(false);
  expect(magneticSnapAnomaly(pose, { ...pose, cx: pose.cx + 3.01 }, 8000)).toBe(true);
  expect(magneticAudit(initial(), pose, 1)).toBe(1);
});

test("neighbor overshoot is bounded even after an interrupted high-velocity drag", () => {
  const engine = scene();
  engine.beginDrag("b", 340, 310);
  engine.moveDrag(570, 320, 20);
  engine.runMs(14);
  engine.endDrag(false, 21);
  engine.snap("a", "right");
  const moved = engine.window("b");
  expect(moved.state.goal.x).toBeLessThan(600);
  expect(moved.state.x.damping).toBe(1);
  for (const id of ["b", "c"]) {
    const { state } = engine.window(id);
    const start = [state.x, state.y, state.w, state.h].map((axis) => axis.position);
    const goals = [state.x, state.y, state.w, state.h].map((axis) => axis.target);
    let previous = start;
    let current: MagneticWindowState = state;
    for (let frame = 0; frame < 180; frame++) {
      current = stepMagneticWindow(current, 8333).state;
      const axes = [current.x, current.y, current.w, current.h].map((axis) => axis.position);
      axes.forEach((v, index) => {
        expect(v).toBeGreaterThanOrEqual(Math.min(previous[index]!, goals[index]!) - 1e-9);
        expect(v).toBeLessThanOrEqual(Math.max(previous[index]!, goals[index]!) + 1e-9);
      });
      previous = axes;
    }
    expect(previous).toEqual(goals);
  }
  engine.runMs(1600);
  const destinations = engine.windows.map((w) => magneticRect(w.state));
  destinations.forEach((a, i) => destinations.slice(i + 1).forEach((b) => expect(magneticIntersection(a, b)).toBe(0)));
});

test("every snap zone fits its workspace and advanced edge modes are reachable", () => {
  for (let z = 1; z <= 15; z++) {
    const r = magneticZoneRect(screen, z);
    expect(r.w).toBeGreaterThan(0);
    expect(r.h).toBeGreaterThan(0);
    expect(magneticIntersection(r, screen)).toBeCloseTo(r.w * r.h, 8);
  }
  expect(magneticEdgeZone(screen, 2, 180, 0, 0)).toBe(1);
  expect(magneticEdgeZone(screen, 65, 410, 1, 0)).toBe(1);
  expect(magneticEdgeZone(screen, 65, 410, 0, 0)).toBe(0);
  expect(magneticEdgeZone(screen, 500, 1, 0, 0)).toBe(15);
  expect(magneticEdgeZone(screen, 260, 1, 0, 0)).toBe(3);
  expect(magneticEdgeZone(screen, 500, 859, 0, 0)).toBe(4);
  expect(magneticEdgeZone(screen, 340, 859, 0, 1)).toBe(9);
  expect(magneticEdgeZone(screen, 600, 859, 0, 1)).toBe(10);
  expect(magneticEdgeZone(screen, 850, 859, 0, 1)).toBe(11);
  expect(magneticEdgeZone(screen, 1199, 520, 0, 2)).toBe(13);
  expect(magneticEdgeZone(screen, 600, 3, 0, 3)).toBe(14);
  expect(magneticEdgeFields(screen, 20, 410).left).toBeGreaterThan(magneticEdgeFields(screen, 100, 410).left);
  const push = planMagneticNeighbors(screen, 10, [
    { id: 1, rect: { x: 400, y: 100, w: 400, h: 320 } },
    { id: 2, rect: { x: 430, y: 250, w: 340, h: 500 } },
    { id: 3, rect: { x: 810, y: 120, w: 300, h: 550 } },
  ]);
  expect(push.length).toBeGreaterThanOrEqual(2);
  for (const p of push) expect(magneticIntersection(p.rect, magneticZoneRect(screen, 10))).toBe(0);
});

test("monitor handoff requires the pointer to cross the barrier and preview follows it", () => {
  const right = { ...screen, x: screen.w };
  expect(magneticMonitorHandoff(screen, right, 1208, 400, 24)).toBe(false);
  expect(magneticMonitorHandoff(screen, right, 1228, 400, 24)).toBe(true);
  const engine = scene();
  engine.setMonitors([{ id: "one", viewport: screen }, { id: "two", viewport: right }]);
  engine.beginDrag("a", 180, 130);
  engine.moveDrag(1208, 400, 20);
  engine.runMs(35);
  expect(engine.preview?.zone).toBe("right");
  engine.moveDrag(1228, 410, 60);
  engine.runMs(35);
  expect(engine.preview?.zone).toBe("left");
  expect(engine.preview?.target.x).toBe(1200);
  engine.endDrag();
  engine.runMs(1800);
  expect(engine.window("a").monitorId).toBe("two");
  expect(engine.window("a").state.goal.x).toBe(1200);
  expect(auditSettledInvariants(engine.window("a")).passed).toBe(true);
});

test("dwell latches window swaps and cancellation returns to the original slot", () => {
  const engine = scene();
  engine.beginDrag("a", 120, 120, 0);
  engine.moveDrag(840, 220, 20);
  expect(engine.preview).toBeUndefined();
  engine.runMs(200);
  expect(engine.preview?.kind).toBe("swap");
  expect(engine.preview?.neighbors).toHaveLength(1);
  engine.cancelDrag();
  engine.runMs(1600);
  expect(engine.window("a").state.goal).toEqual(rect);
  expect(engine.preview).toBeUndefined();
  engine.beginDrag("a", 120, 120, 2000);
  engine.moveDrag(840, 220, 2020);
  engine.runMs(200);
  engine.endDrag();
  engine.runMs(1600);
  expect(engine.window("c").state.goal).toEqual(rect);
  expect(engine.window("a").state.goal.x).toBe(650);
});

test("layout morph dips content before its destination box swap", () => {
  const target = { x: 200, y: 230, w: 720, h: 440 };
  let state = retargetMagneticWindow(initial(), target, 0.52, 1, false, false);
  expect(state.box).toEqual(rect);
  state = stepMagneticWindow(state, 16667).state;
  expect(state.box).toEqual(rect);
  expect(magneticPose(state, dock).content).toBeLessThan(1);
  for (let i = 0; i < 12; i++) state = stepMagneticWindow(state, 8333).state;
  expect(state.box).toEqual(target);
  for (let i = 0; i < 160; i++) state = stepMagneticWindow(state, 8333).state;
  expect(magneticPose(state, dock).content).toBe(1);
  expect(magneticSpringCount(state)).toBe(0);
  const lift = stepMagneticWindow(magneticPickup(state, true, 1), 60000).state;
  expect(lift.lift.position).toBeGreaterThan(0);
  expect(lift.mag.position).toBeGreaterThan(0);
});

test("gather and return stagger by dock position and permit reversal", () => {
  const engine = scene();
  const events: MagneticEvent[] = [];
  engine.onEvent((e) => events.push(e));
  for (const preset of ["focus", "split", "thirds", "bento", "cascade"] as MagneticPreset[]) engine.setLayout(preset);
  engine.setLayout("gather");
  engine.runMs(44);
  expect(engine.window("a").state.m.target).toBe(1);
  expect(engine.window("b").state.m.target).toBe(0);
  engine.runMs(46);
  expect(events.filter((e) => e.kind === "minimize").map((e) => [e.id, e.timeUs]))
    .toEqual([["a", 0], ["b", 45000], ["c", 90000]]);
  engine.returnAll();
  engine.runMs(2000);
  expect(engine.windows.every((w) => !w.pose.hidden && w.pose.content === 1)).toBe(true);
  expect(engine.metrics().heldTokens).toBe(0);
  engine.gatherAll();
  engine.runMs(20);
  engine.returnAll();
  engine.runMs(2000);
  expect(engine.windows.every((w) => !w.pose.hidden)).toBe(true);
});

test("reduced motion uses the 150 ms crossfade and batches the wave", () => {
  const engine = scene(true);
  engine.gatherAll();
  expect(engine.windows.every((w) => w.state.m.target === 1)).toBe(true);
  engine.runMs(75);
  const p = engine.window("a").pose;
  expect(p.glass).toBeCloseTo(0.5, 10);
  expect(p.content).toBeCloseTo(0.5, 10);
  expect(p.z).toBe(0);
  expect(p.cx).toBe(rect.x + rect.w / 2);
  expect(p.sx).toBe(1);
  engine.runMs(75);
  expect(engine.window("a").pose.hidden).toBe(true);
  engine.returnAll();
  expect(engine.window("a").pose.hidden).toBe(false);
  engine.runMs(150);
  expect(engine.window("a").pose.content).toBe(1);
  expect(engine.metrics().heldTokens).toBe(0);
});

test("IdleFalsifier sees zero scheduled callbacks and ticks across browser idle", () => {
  const fake = fakeMagneticDom();
  const mount = mountMagneticTiling(fake.root, { host: fake.host, windows: fake.windows, onion: fake.onion, onionEnabled: true });
  try {
    expect(fake.scheduled.size).toBe(0);
    mount.engine.minimize("a");
    expect(fake.scheduled.size).toBe(1);
    fake.advance(2000);
    expect(fake.pane.getAttribute("inert")).toBe("");
    expect(fake.glass.style.getPropertyValue("opacity")).toBe("0.000");
    mount.engine.restore("a");
    expect(fake.pane.getAttribute("inert")).toBeNull();
    fake.advance(2000);
    expect(fake.content.style.getPropertyValue("opacity")).toBe("");
    expect(fake.pane.style.getPropertyValue("transform")).toBe("");
    const before = mount.metrics();
    expect(before.activeSprings).toBe(0);
    expect(before.heldTokens).toBe(0);
    expect(fake.scheduled.size).toBe(0);
    fake.advance(10000);
    expect(mount.falsifyIdle(before, 10000000).passed).toBe(true);
  } finally {
    mount.unmount();
  }
  expect(fake.scheduled.size).toBe(0);
  expect(fake.pane.getAttribute("aria-hidden")).toBeNull();
  expect(fake.onionNodes.size).toBe(0);
});

test("flat ABI round trips state and emits numeric poses and events", () => {
  const input = Array<number>(76).fill(0);
  input.splice(2, 4, rect.x, rect.y, rect.w, rect.h);
  input.splice(10, 4, dock.x, dock.y, dock.z, dock.size);
  let frame = magneticFrameFlat(input);
  expect(frame).toHaveLength(93);
  expect(frame[62]).toBe(rect.x + rect.w / 2);
  const issue = (op: number, flag = 0) => {
    input[0] = op;
    input[8] = flag;
    input.splice(14, 62, ...frame.slice(0, 62));
    frame = magneticFrameFlat(input);
  };
  issue(3, 1);
  input[1] = 8333;
  let events = 0;
  for (let i = 0; i < 180; i++) {
    issue(1);
    events |= frame[91]!;
  }
  expect(events).toBe(5);
  expect(frame[90]).toBe(1);
  expect(frame[92]).toBe(0);
  expect(magneticFrameFlat([])).toEqual([]);
  expect(magneticVisibility(initial(), true).m.target).toBe(1);
});
