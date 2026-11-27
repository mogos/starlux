import { clamp } from "../ss/physics/math.ss.ts";
import {
  createMagneticWindow, magneticAudit, magneticLength, magneticLift, magneticMoving, magneticPerspective,
  magneticPickup, magneticPose, magneticRect, magneticReducedMotion, magneticSnapAnomaly, magneticSpring,
  magneticSpringCount, magneticTarget, magneticVisibility, retargetMagneticWindow, stepMagneticSpring, stepMagneticWindow,
} from "../ss/magnetic_tiling.ss.ts";
import type { MagneticDock, MagneticPose, MagneticRect, MagneticWindowState } from "../ss/magnetic_tiling.ss.ts";
import {
  magneticCascadeDelay, magneticContains, magneticDragRect, magneticEdgeFields, magneticEdgeZone,
  magneticMonitorHandoff, magneticPresetSlot, magneticThrow, magneticWindowPlan, magneticWindowRegion, magneticZoneRect,
} from "../ss/magnetic_layout.ss.ts";
import type { MagneticFields } from "../ss/magnetic_layout.ss.ts";
import { planMagneticNeighbors } from "../ss/magnetic_neighbors.ss.ts";
import {
  acquireWake, createLuxClock, dispatchClock, heldWakeTokens, releaseWake,
} from "../ss/lux/wake.ss.ts";
import { synthesizeSensory } from "../ss/sensory.ss.ts";
import type { SensoryEnvelope } from "../ss/sensory.ss.ts";

export * from "../ss/magnetic_tiling.ss.ts";
export * from "../ss/magnetic_layout.ss.ts";
export * from "../ss/magnetic_neighbors.ss.ts";

export const magneticZones = [
  "none", "left", "right", "top", "bottom", "top-left", "top-right", "bottom-left", "bottom-right",
  "left-third", "center-third", "right-third", "primary-left", "primary-right", "center-focus", "full",
] as const;
export type MagneticZone = Exclude<(typeof magneticZones)[number], "none">;
const presets = ["free", "focus", "split", "thirds", "bento", "cascade", "master", "cols3", "grid"] as const;
export type MagneticPreset = (typeof presets)[number] | "gather";

export type MagneticMonitor = {
  readonly id: string; readonly viewport: MagneticRect; readonly workspace?: MagneticRect;
};
export type MagneticWindowOptions = {
  readonly id: string; readonly rect: MagneticRect; readonly dock: MagneticDock; readonly monitorId?: string;
};
export type MagneticOptions = {
  readonly monitors: readonly MagneticMonitor[];
  readonly windows?: readonly MagneticWindowOptions[];
  readonly reduce?: boolean;
  readonly edgeMode?: "standard" | "thirds" | "primary" | "focus";
  readonly handoffBarrier?: number;
  readonly minTileWidth?: number;
  readonly minTileHeight?: number;
};
export type MagneticWindow = {
  readonly id: string; readonly monitorId: string; readonly state: MagneticWindowState; readonly pose: MagneticPose;
  readonly dragging: boolean; readonly snapAnomalies: number;
};
export type MagneticEvent = {
  readonly kind: "minimize" | "restore" | "absorb" | "handoff" | "release" | "snap" | "rest" | "pickup";
  readonly id: string; readonly timeUs: number; readonly velocity: number;
  readonly sensory?: SensoryEnvelope;
};
export type MagneticPreview = {
  readonly rect: MagneticRect; readonly target: MagneticRect; readonly opacity: number;
  readonly neighbors: readonly MagneticRect[]; readonly kind: string; readonly zone?: MagneticZone;
};
type WindowEntry = { window: MagneticWindow; dock: MagneticDock; free: MagneticRect; previous?: MagneticRect; zone?: MagneticZone };
type Plan = {
  readonly target: MagneticRect; readonly placements: ReadonlyMap<string, MagneticRect>; readonly kind: string;
  readonly slot?: number; readonly neighbor?: string; readonly region?: number; readonly zone?: MagneticZone;
  readonly order?: readonly string[];
};
type Pointer = { x: number; y: number; at: number };
type Drag = {
  id: string; monitorId: string; start: MagneticRect; goal: MagneticRect; gx: number; gy: number;
  origin: Pointer; history: Pointer[]; pointer: Pointer; active: boolean;
  plan: Plan | undefined; pull: MagneticRect; dwell: number | undefined;
};
type Wave = { id: string; minimize: boolean; at: number };

const noFields: MagneticFields = { left: 0, top: 0, right: 0, bottom: 0 };
const same = (a: MagneticRect, b: MagneticRect) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
const workspace = (monitor: MagneticMonitor) => monitor.workspace ?? monitor.viewport;
export function magneticCamera(monitors: readonly MagneticMonitor[]) {
  if (monitors.length === 0) throw new RangeError("Magnetic tiling requires a monitor");
  const left = Math.min(...monitors.map((m) => m.viewport.x));
  const top = Math.min(...monitors.map((m) => m.viewport.y));
  const right = Math.max(...monitors.map((m) => m.viewport.x + m.viewport.w));
  const bottom = Math.max(...monitors.map((m) => m.viewport.y + m.viewport.h));
  return { x: left + (right - left) / 2, y: top + (bottom - top) * 0.46 };
}
const center = (rect: MagneticRect) => ({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 });
const axes = (r: MagneticRect) => [r.x, r.y, r.x + r.w, r.y + r.h] as const;

function validateRect(r: MagneticRect): void {
  if (![r.x, r.y, r.w, r.h].every(Number.isFinite) || r.w <= 0 || r.h <= 0) {
    throw new RangeError("Magnetic tiling requires finite rectangles with positive dimensions");
  }
}

export function auditSettledInvariants(win: MagneticWindow) {
  const code = magneticAudit(win.state, win.pose, win.snapAnomalies);
  const issues: string[] = [];
  if (code & 1) issues.push("snap anomaly");
  if (code & 2) issues.push("minimized pane is visible");
  if (code & 4) issues.push("open pane is hidden or translucent");
  if (!win.dragging && magneticSpringCount(win.state) === 0) {
    if (!same(magneticRect(win.state), win.state.goal) &&
      axes(magneticRect(win.state)).some((value, index) => Math.abs(value - axes(win.state.goal)[index]!) > 0.01)) {
      issues.push("settled layout missed its target");
    }
    if (!same(win.state.box, win.state.goal)) issues.push("layout box is stale");
  }
  return { passed: issues.length === 0, issues, snapAnomalies: win.snapAnomalies };
}

export class MagneticTiling {
  private readonly entries = new Map<string, WindowEntry>();
  private readonly monitors = new Map<string, MagneticMonitor>();
  private readonly listeners = new Set<() => void>();
  private cameraOrigin = { x: 0, y: 0 };
  private readonly eventListeners = new Set<(event: MagneticEvent) => void>();
  private readonly edgeMode: number;
  private readonly barrier: number;
  private readonly minWidth: number;
  private readonly minHeight: number;
  private clock = createLuxClock();
  private wake = 0;
  private at = 0;
  private events: MagneticEvent[] = [];
  private order: string[] = [];
  private zOrder: string[] = [];
  private wave: Wave[] = [];
  private gathered: string[] = [];
  private gathering = false;
  private focusId: string | undefined;
  private drag: Drag | undefined;
  private preset: MagneticPreset = "free";
  private reduced: boolean;
  private ghostPlan: Plan | undefined;
  private ghostEdges = axes({ x: 0, y: 0, w: 0, h: 0 }).map((value) => magneticSpring(value, 0.20, 1));
  private ghostAlpha = magneticSpring(0, 0.16, 1);

  constructor(options: MagneticOptions) {
    this.reduced = options.reduce ?? false;
    this.edgeMode = ["standard", "thirds", "primary", "focus"].indexOf(options.edgeMode ?? "standard");
    this.barrier = Math.max(0, options.handoffBarrier ?? 24);
    this.minWidth = Math.max(1, options.minTileWidth ?? 300);
    this.minHeight = Math.max(1, options.minTileHeight ?? 220);
    this.setMonitors(options.monitors);
    for (const window of options.windows ?? []) this.addWindow(window);
  }

  get reduce(): boolean { return this.reduced; }
  get camera() { return this.cameraOrigin; }
  get focused(): string | undefined { return this.focusId; }
  get layout(): MagneticPreset { return this.preset; }
  get isGathered(): boolean { return this.gathering; }
  get windows(): readonly MagneticWindow[] { return this.zOrder.map((id) => this.entry(id).window); }
  get nextWorkMs(): number | undefined {
    const next = Math.min(this.wave[0]?.at ?? Infinity, this.drag?.dwell ?? Infinity);
    return Number.isFinite(next) ? Math.max(0, next - this.at) / 1000 : undefined;
  }
  get fields(): MagneticFields {
    const d = this.drag;
    if (!d?.active || this.preset !== "free") return noFields;
    return magneticEdgeFields(this.monitor(d.monitorId).viewport, d.pointer.x, d.pointer.y);
  }
  get preview(): MagneticPreview | undefined {
    const p = this.ghostPlan;
    if (!p || (this.ghostAlpha.position === 0 && this.ghostAlpha.target === 0)) return undefined;
    const [l, t, r, b] = this.ghostEdges;
    const rect = { x: l!.position, y: t!.position, w: r!.position - l!.position, h: b!.position - t!.position };
    return { rect, target: p.target, opacity: this.ghostAlpha.position, kind: p.kind,
      neighbors: [...p.placements].filter(([id]) => id !== this.drag?.id).map(([, rect]) => rect),
      ...(p.zone ? { zone: p.zone } : {}) };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  onEvent(listener: (event: MagneticEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }
  window(id: string): MagneticWindow { return this.entry(id).window; }
  metrics() {
    return { activeSprings: this.springCount(), heldTokens: heldWakeTokens(this.clock),
      clockTicks: this.clock.clockTicks, idleWakeupCount: this.clock.idleWakeupCount, timeUs: this.at };
  }
  setMonitors(monitors: readonly MagneticMonitor[]): void {
    const replacement = new Map<string, MagneticMonitor>();
    for (const monitor of monitors) {
      validateRect(monitor.viewport);
      if (monitor.workspace) validateRect(monitor.workspace);
      if (!monitor.id || replacement.has(monitor.id)) throw new RangeError("Monitor IDs must be unique and nonempty");
      replacement.set(monitor.id, monitor);
    }
    const first = monitors[0];
    if (!first) throw new RangeError("Magnetic tiling requires a monitor");
    this.cancelDrag();
    const previous = new Map(this.monitors);
    this.monitors.clear();
    for (const [id, monitor] of replacement) this.monitors.set(id, monitor);
    this.cameraOrigin = magneticCamera(monitors);
    for (const entry of this.entries.values()) {
      const id = replacement.has(entry.window.monitorId) ? entry.window.monitorId : first.id;
      const old = previous.get(entry.window.monitorId);
      const target = workspace(this.monitor(id));
      entry.window = { ...entry.window, monitorId: id };
      if (old && !same(workspace(old), target)) {
        const source = workspace(old);
        const scale = (r: MagneticRect) => ({
          x: target.x + (r.x - source.x) * target.w / source.w, y: target.y + (r.y - source.y) * target.h / source.h,
          w: r.w * target.w / source.w, h: r.h * target.h / source.h,
        });
        entry.free = scale(entry.free);
        if (entry.previous) entry.previous = scale(entry.previous);
      }
      if (entry.zone) entry.free = magneticZoneRect(target, magneticZones.indexOf(entry.zone));
    }
    this.relayout();
    this.publish();
  }
  addWindow(options: MagneticWindowOptions): void {
    validateRect(options.rect);
    this.validateDock(options.dock);
    if (!options.id || this.entries.has(options.id)) throw new RangeError("Window IDs must be unique and nonempty");
    if (this.entries.size >= 128) throw new RangeError("Magnetic tiling supports 128 windows per compositor");
    const mid = options.monitorId ?? this.monitorAt(center(options.rect).x, center(options.rect).y)?.id ??
      this.monitors.keys().next().value!;
    this.monitor(mid);
    const state = createMagneticWindow(options.rect, this.reduce);
    this.entries.set(options.id, { dock: options.dock, free: options.rect,
      window: { id: options.id, monitorId: mid, state, pose: magneticPose(state, options.dock), dragging: false, snapAnomalies: 0 } });
    this.order.push(options.id);
    this.zOrder.unshift(options.id);
    this.focusId ??= options.id;
    this.relayout();
    this.publish();
  }
  removeWindow(id: string): void {
    if (!this.entries.has(id)) return;
    if (this.drag?.id === id) this.cancelDrag();
    this.entries.delete(id);
    this.order = this.order.filter((value) => value !== id);
    this.zOrder = this.zOrder.filter((value) => value !== id);
    this.gathered = this.gathered.filter((value) => value !== id);
    this.wave = this.wave.filter((job) => job.id !== id);
    if (this.focusId === id) this.refocus(id);
    this.relayout();
    this.publish();
  }
  setDock(id: string, dock: MagneticDock): void {
    this.validateDock(dock);
    const entry = this.entry(id);
    entry.dock = dock;
    this.update(entry, entry.window.state);
    this.publish();
  }
  setReducedMotion(reduce: boolean): void {
    if (this.reduce === reduce) return;
    this.reduced = reduce;
    for (const entry of this.entries.values()) this.update(entry, magneticReducedMotion(entry.window.state, reduce));
    this.ghostAlpha = magneticTarget(this.ghostAlpha, this.ghostAlpha.target, 0.16, 1, true, false);
    this.ghostEdges = this.ghostEdges.map((edge) => magneticTarget(edge, edge.target, 0.20, 1, true, false));
    if (reduce) this.wave = this.wave.map((job) => ({ ...job, at: this.at }));
    this.runDue();
    this.publish();
  }
  setLayout(preset: MagneticPreset): void {
    if (preset === "gather") {
      this.gatherAll();
      return;
    }
    this.cancelDrag();
    this.preset = preset;
    this.relayout();
    this.publish();
  }
  focus(id: string): void {
    if (!this.open(id)) return;
    this.raise(id);
    this.publish();
  }
  zoom(id: string): void {
    const entry = this.entry(id);
    if (!this.open(id)) return;
    if (this.preset === "free") {
      if (entry.zone === "full") this.unsnap(id);
      else this.snap(id, "full");
      return;
    }
    this.order = [id, ...this.order.filter((value) => value !== id)];
    this.raise(id);
    this.relayout();
    this.publish();
  }
  dock(id: string): void {
    const w = this.entry(id).window;
    if (!this.open(id)) this.restore(id);
    else if (this.focusId !== id && !magneticMoving(w.state.m)) this.focus(id);
    else this.minimize(id);
  }
  minimize(id: string): boolean { return this.toggle(id, true); }
  restore(id: string): boolean { return this.toggle(id, false); }
  gatherAll(): void {
    const open = this.order.filter((id) => this.open(id));
    if (open.length === 0) return;
    this.gathering = true;
    this.gathered = [...new Set([...this.gathered, ...open])].sort((a, b) => this.entry(a).dock.x - this.entry(b).dock.x);
    this.cascade(this.gathered, true);
  }
  returnAll(): void {
    if (!this.gathering) return;
    this.gathering = false;
    this.cascade(this.gathered.filter((id) => !this.open(id)), false);
    this.gathered = [];
  }

  snap(id: string, zone: MagneticZone, monitorId = this.entry(id).window.monitorId): void {
    if (!this.open(id)) return;
    this.cancelDrag();
    this.commit(id, monitorId, this.edgePlan(id, monitorId, magneticZones.indexOf(zone)));
    this.publish();
  }
  unsnap(id: string): void {
    const entry = this.entry(id);
    if (!entry.previous) return;
    entry.free = entry.previous;
    delete entry.previous;
    delete entry.zone;
    this.target(entry, entry.free, 0.46);
    this.publish();
  }

  beginDrag(id: string, x: number, y: number, timestampMs = this.at / 1000): boolean {
    if (this.drag || !this.open(id)) return false;
    const w = this.entry(id).window;
    const start = magneticRect(w.state);
    const origin = { x, y, at: timestampMs };
    const camera = this.camera;
    const scale = (magneticPerspective() - magneticLift() * clamp(w.state.lift.position, 0, 1.2)) / magneticPerspective();
    this.drag = { id, monitorId: w.monitorId, start, goal: w.state.goal,
      gx: camera.x + (x - camera.x) * scale - start.x, gy: camera.y + (y - camera.y) * scale - start.y,
      origin, history: [origin], pointer: origin, active: false, plan: undefined, pull: start, dwell: undefined };
    return true;
  }
  moveDrag(x: number, y: number, timestampMs = this.at / 1000): void {
    const d = this.drag;
    if (!d) return;
    const entry = this.entry(d.id);
    d.pointer = { x, y, at: timestampMs };
    d.history.push(d.pointer);
    if (d.history.length > 10) d.history.shift();
    if (!d.active && magneticLength(x - d.origin.x, y - d.origin.y) <= 4) return;
    if (!d.active) {
      d.active = true;
      entry.window = { ...entry.window, dragging: true };
      this.raise(d.id);
      this.emit("pickup", d.id);
    }
    const candidate = this.monitorAt(x, y);
    const monitor = this.monitor(d.monitorId);
    if (candidate && candidate.id !== monitor.id &&
      magneticMonitorHandoff(monitor.viewport, candidate.viewport, x, y, this.barrier)) {
      d.monitorId = candidate.id;
      d.plan = undefined;
    }
    d.dwell = this.at + 150000;
    this.updateDrag(d, timestampMs);
    this.publish();
  }
  endDrag(cancel = false, timestampMs = this.at / 1000): void {
    const d = this.drag;
    if (!d) return;
    this.drag = undefined;
    if (!d.active) return;
    const entry = this.entry(d.id);
    const velocity = this.pointerVelocity(d, timestampMs);
    entry.window = { ...entry.window, dragging: false };
    this.update(entry, magneticPickup(entry.window.state, false, 0));
    this.showGhost(undefined);
    if (cancel) this.target(entry, d.goal, 0.46);
    else if (d.plan) this.commit(d.id, d.monitorId, d.plan);
    else if (this.preset === "free") {
      entry.window = { ...entry.window, monitorId: d.monitorId };
      entry.free = magneticThrow(workspace(this.monitor(d.monitorId)), magneticRect(entry.window.state), velocity.x, velocity.y);
      delete entry.zone;
      delete entry.previous;
      this.target(entry, entry.free, 0.60, 0.92);
    } else this.relayout(0.46);
    this.publish();
  }
  cancelDrag(): void { this.endDrag(true); }

  // Advance on the same clock as the browser adapter, with a deterministic 120 Hz step limit.
  runMs(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) throw new RangeError("Elapsed time must be finite and nonnegative");
    const until = this.at + Math.round(ms * 1000);
    while (this.at < until) {
      const active = this.springCount() > 0;
      const due = this.nextWorkMs;
      const available = until - this.at;
      const dt = Math.min(available, active ? 8333 : available, due && due > 0 ? Math.round(due * 1000) : available);
      this.advanceFrame(dt / 1000);
    }
  }
  advanceFrame(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) throw new RangeError("Elapsed time must be finite and nonnegative");
    const dt = Math.round(ms * 1000);
    this.at += dt;
    const active = this.wake !== 0;
    if (active && dt > 0) {
      const dispatched = dispatchClock(this.clock, this.clock.generation);
      this.clock = dispatched.clock;
      if (dispatched.accepted) this.step(Math.min(dt, 64000));
    }
    const due = this.runDue();
    if (active || due) this.publish();
  }

  private monitor(id: string): MagneticMonitor {
    const monitor = this.monitors.get(id);
    if (!monitor) throw new RangeError("Unknown monitor " + id);
    return monitor;
  }
  private monitorAt(x: number, y: number): MagneticMonitor | undefined {
    for (const monitor of this.monitors.values()) if (magneticContains(monitor.viewport, x, y)) return monitor;
    return undefined;
  }
  private entry(id: string): WindowEntry {
    const entry = this.entries.get(id);
    if (!entry) throw new RangeError("Unknown magnetic window " + id);
    return entry;
  }
  private validateDock(dock: MagneticDock): void {
    if (![dock.x, dock.y, dock.z, dock.size].every(Number.isFinite) || dock.size <= 0) throw new RangeError("Invalid dock target");
  }
  private open(id: string): boolean { return this.entry(id).window.state.m.target === 0; }
  private raise(id: string): void {
    this.focusId = id;
    this.zOrder = [id, ...this.zOrder.filter((value) => value !== id)];
  }
  private refocus(excluded: string): void {
    this.focusId = this.zOrder.find((id) => id !== excluded && this.open(id));
  }
  private update(entry: WindowEntry, state: MagneticWindowState): void {
    entry.window = { ...entry.window, state, pose: magneticPose(state, entry.dock) };
  }
  private target(entry: WindowEntry, rect: MagneticRect, response: number, damping = 1, jump = entry.window.pose.hidden): void {
    if (entry.window.dragging) return;
    const s = entry.window.state;
    if (same(rect, s.goal) && (jump ? same(rect, magneticRect(s)) :
      s.x.target === rect.x && s.y.target === rect.y && s.w.target === rect.x + rect.w && s.h.target === rect.y + rect.h &&
      (s.x.damping === damping || ![s.x, s.y, s.w, s.h].some(magneticMoving)))) return;
    this.update(entry, retargetMagneticWindow(entry.window.state, rect, response, damping, jump, false));
  }
  private slots(monitorId: string, order: readonly string[]): Map<string, MagneticRect> {
    const s = workspace(this.monitor(monitorId));
    const preset = presets.indexOf(this.preset as (typeof presets)[number]);
    return new Map(order.map((id, i) => [id, magneticPresetSlot(s, preset, i, order.length)]));
  }
  private visible(monitorId: string): string[] {
    return this.order.filter((id) => this.open(id) && this.entry(id).window.monitorId === monitorId);
  }
  private relayout(response = 0.52, jumpId?: string): void {
    if (this.preset === "free") {
      for (const entry of this.entries.values()) this.target(entry, entry.free, response);
      return;
    }
    for (const monitor of this.monitors.values()) {
      for (const [id, rect] of this.slots(monitor.id, this.visible(monitor.id))) {
        const entry = this.entry(id);
        this.target(entry, rect, response, 1, id === jumpId || entry.window.pose.hidden);
      }
    }
  }
  private toggle(id: string, minimize: boolean, fromWave = false): boolean {
    const entry = this.entry(id);
    if (!fromWave) this.wave = this.wave.filter((job) => job.id !== id);
    if (this.open(id) !== minimize) {
      if (!fromWave) this.publish();
      return false;
    }
    if (this.drag?.id === id) this.cancelDrag();
    const wasHidden = entry.window.pose.hidden;
    this.update(entry, magneticVisibility(entry.window.state, minimize));
    if (!minimize) this.raise(id);
    else if (this.reduce && this.focusId === id) this.refocus(id);
    this.relayout(0.52, !minimize && wasHidden ? id : undefined);
    this.emit(minimize ? "minimize" : "restore", id);
    if (!fromWave) this.publish();
    return true;
  }
  private cascade(ids: readonly string[], minimize: boolean): void {
    this.wave = ids.map((id, index) => ({ id, minimize, at: this.at + magneticCascadeDelay(index, this.reduce) }));
    this.runDue();
    this.publish();
  }
  private runDue(): boolean {
    let changed = false;
    while (this.wave[0] && this.wave[0].at <= this.at) {
      const job = this.wave.shift()!;
      changed = this.toggle(job.id, job.minimize, true) || changed;
    }
    if (this.drag?.dwell !== undefined && this.drag.dwell <= this.at) {
      const d = this.drag;
      d.dwell = undefined;
      this.updateDrag(d, d.pointer.at + 150);
      changed = true;
    }
    return changed;
  }
  private springCount(): number {
    let springs = Number(magneticMoving(this.ghostAlpha));
    for (const edge of this.ghostEdges) springs += Number(magneticMoving(edge));
    for (const entry of this.entries.values()) springs += magneticSpringCount(entry.window.state);
    return springs;
  }
  private publish(): void {
    const active = this.springCount() > 0;
    if (active && this.wake === 0) {
      const acquired = acquireWake(this.clock, "body");
      this.clock = acquired.clock;
      this.wake = acquired.token;
    } else if (!active && this.wake !== 0) {
      this.clock = releaseWake(this.clock, this.wake);
      this.wake = 0;
    }
    const events = this.events;
    this.events = [];
    for (const event of events) for (const listener of this.eventListeners) listener(event);
    for (const listener of this.listeners) listener();
  }
  private emit(kind: MagneticEvent["kind"], id: string, velocity = 0): void {
    const intensity = clamp(0.5 + Math.abs(velocity) / 20, 0, 1);
    const event = { kind, id, velocity, timeUs: this.at };
    if (kind === "absorb" || kind === "release" || kind === "snap" || kind === "pickup") {
      this.events.push({ ...event, sensory: synthesizeSensory({
        kind: kind === "absorb" || kind === "pickup" ? "IMPULSE" : kind === "release" ? "SNAP_RELEASE" : "SNAP_ENGAGE",
        intensity, timeUs: this.at, subject: this.order.indexOf(id),
      }, false, this.reduce) });
    } else this.events.push(event);
  }
  private step(dtUs: number): void {
    for (const [id, entry] of this.entries) {
      const before = entry.window;
      if (magneticSpringCount(before.state) === 0) continue;
      let state = before.state;
      if (this.drag?.id === id && this.drag.active) state = this.follow(state, this.drag);
      const step = stepMagneticWindow(state, dtUs);
      this.update(entry, step.state);
      if (!this.reduce && magneticSnapAnomaly(before.pose, entry.window.pose, dtUs)) {
        entry.window = { ...entry.window, snapAnomalies: before.snapAnomalies + 1 };
      }
      if (step.handoff) {
        if (this.focusId === id) this.refocus(id);
        this.emit("handoff", id);
      }
      if (step.absorb) this.emit("absorb", id, step.state.m.velocity);
      if (step.release) this.emit("release", id, step.state.m.velocity);
      if (magneticSpringCount(step.state) === 0) this.emit("rest", id);
    }
    this.ghostAlpha = stepMagneticSpring(this.ghostAlpha, dtUs, false);
    this.ghostEdges = this.ghostEdges.map((edge) => stepMagneticSpring(edge, dtUs, true));
    if (this.ghostAlpha.position === 0 && this.ghostAlpha.target === 0) this.ghostPlan = undefined;
  }
  private pointerVelocity(d: Drag, at: number) {
    const first = d.history.find((sample) => at - sample.at < 110);
    const dt = first ? (d.pointer.at - first.at) / 1000 : 0;
    return first && dt >= 0.012 ? { x: (d.pointer.x - first.x) / dt, y: (d.pointer.y - first.y) / dt } : { x: 0, y: 0 };
  }
  private follow(state: MagneticWindowState, d: Drag): MagneticWindowState {
    const monitor = this.monitor(d.monitorId);
    const ox = this.camera;
    const r = magneticDragRect(workspace(monitor), d.start, d.pointer.x, d.pointer.y, d.gx, d.gy,
      state.lift.position, d.pull, state.mag.position, ox.x, ox.y);
    return retargetMagneticWindow(state, r, 0.09, 0.95, false, true);
  }
  private updateDrag(d: Drag, at: number): void {
    d.plan = this.preset === "free" ? this.freePlan(d, at) : this.slotPlan(d);
    if (d.plan) d.pull = d.plan.target;
    const entry = this.entry(d.id);
    this.update(entry, this.follow(magneticPickup(entry.window.state, true, d.plan ? 1 : 0), d));
    this.showGhost(d.plan);
  }
  private freePlan(d: Drag, at: number): Plan | undefined {
    const { x, y } = d.pointer;
    const monitor = this.monitor(d.monitorId);
    const latched = d.plan?.zone ? magneticZones.indexOf(d.plan.zone) : 0;
    const z = magneticEdgeZone(monitor.viewport, x, y, latched, this.edgeMode);
    if (z > 0) return this.edgePlan(d.id, monitor.id, z);
    const id = this.zOrder.find((id) => {
      const w = this.entry(id).window;
      return id !== d.id && w.monitorId === d.monitorId && this.open(id) && !magneticMoving(w.state.m) &&
        magneticContains(w.state.goal, x, y);
    });
    if (!id) return undefined;
    const target = this.entry(id).window.state.goal;
    const region = magneticWindowRegion(target, x, y, d.plan?.neighbor === id);
    const velocity = this.pointerVelocity(d, at);
    if ((d.plan?.neighbor !== id || d.plan.region !== region) && magneticLength(velocity.x, velocity.y) >= (region ? 380 : 140)) return undefined;
    const plan = magneticWindowPlan(workspace(monitor), d.goal, target, region, this.minWidth, this.minHeight);
    if (plan.kind === 0) return undefined;
    const placements = new Map([[d.id, plan.primary]]);
    if (plan.kind !== 3) placements.set(id, plan.neighbor);
    return { kind: ["", "swap", "split", "dock"][plan.kind]!, target: plan.primary, placements, neighbor: id, region };
  }
  private edgePlan(id: string, monitorId: string, zone: number): Plan {
    const s = workspace(this.monitor(monitorId));
    const target = magneticZoneRect(s, zone);
    const ids = this.visible(monitorId).filter((value) => value !== id);
    const push = planMagneticNeighbors(s, zone, ids.map((id, i) => ({ id: i, rect: this.entry(id).window.state.goal })));
    const placements = new Map([[id, target]]);
    for (const n of push) placements.set(ids[n.id]!, n.rect);
    return { target, placements, kind: "edge", zone: magneticZones[zone] as MagneticZone };
  }
  private slotPlan(d: Drag): Plan | undefined {
    const order = this.visible(d.monitorId);
    if (!order.includes(d.id)) order.push(d.id);
    const slots = this.slots(d.monitorId, order);
    const { x, y } = d.pointer;
    let slot = order.findIndex((id) => magneticContains(slots.get(id)!, x, y));
    if (slot < 0) return undefined;
    if (d.plan?.slot !== undefined && d.plan.slot !== slot) {
      const r = slots.get(order[slot]!)!;
      if (!magneticContains({ x: r.x + r.w * 0.16, y: r.y + r.h * 0.16, w: r.w * 0.68, h: r.h * 0.68 }, x, y)) slot = d.plan.slot;
    }
    const next = order.filter((id) => id !== d.id);
    next.splice(slot, 0, d.id);
    const placements = this.slots(d.monitorId, next);
    const target = placements.get(d.id)!;
    for (const [id, rect] of placements) {
      if (id !== d.id && same(this.entry(id).window.state.goal, rect)) placements.delete(id);
    }
    return { target, placements, kind: "reorder", slot, order: next };
  }
  private showGhost(plan: Plan | undefined): void {
    const fresh = this.ghostAlpha.target === 0 && this.ghostAlpha.position < 0.02;
    this.ghostAlpha = magneticTarget(this.ghostAlpha, plan ? 1 : 0, 0.16, 1, this.reduce, true);
    if (plan) {
      this.ghostPlan = plan;
      this.ghostEdges = axes(plan.target).map((goal, i) =>
        magneticTarget(this.ghostEdges[i]!, goal, 0.20, 1, fresh || this.reduce, true));
    }
  }
  private commit(id: string, monitorId: string, plan: Plan): void {
    const entry = this.entry(id);
    const oldMonitor = entry.window.monitorId;
    entry.window = { ...entry.window, monitorId };
    if (plan.order) {
      const included = new Set(plan.order);
      let next = 0;
      this.order = this.order.map((id) => included.has(id) ? plan.order![next++]! : id);
    } else {
      if (plan.zone && !entry.zone) entry.previous = entry.free;
      for (const [targetId, rect] of plan.placements) {
        const neighbor = this.entry(targetId);
        neighbor.free = rect;
        delete neighbor.zone;
        if (targetId !== id || !plan.zone) delete neighbor.previous;
      }
      if (plan.zone) entry.zone = plan.zone;
    }
    for (const [targetId, rect] of plan.placements) this.target(this.entry(targetId), rect, 0.46);
    if (oldMonitor !== monitorId && this.preset !== "free") this.relayout(0.46);
    this.raise(id);
    this.emit("snap", id);
  }
}
export * from "../ss/magnetic_abi.ss.ts";
