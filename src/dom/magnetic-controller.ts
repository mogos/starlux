import {
  MagneticTiling, magneticCamera, magneticMoving, magneticPerspective, magneticProject, magneticSpringCount,
} from "../magnetic-tiling.ts";
import type {
  MagneticEvent, MagneticMonitor, MagneticOptions, MagneticRect, MagneticWindow,
} from "../magnetic-tiling.ts";
import { browserHost } from "./controller.ts";
import type { DomHost } from "./controller.ts";
import { defaultSpatialKnobs } from "../../ss/lux/knobs.ss.ts";
import { governFrames } from "../../ss/lux/governor.ss.ts";
import type { ThermalTier } from "../../ss/lux/governor.ss.ts";
import { falsifyIdle } from "../../ss/lux/idle.ss.ts";
import type { IdleSample } from "../../ss/lux/idle.ss.ts";

export type MagneticDomWindow = {
  readonly id: string; readonly pane: HTMLElement; readonly handle?: HTMLElement;
  readonly glass?: HTMLElement; readonly content?: HTMLElement; readonly shadow?: HTMLElement;
  readonly frost?: HTMLElement; readonly sheen?: HTMLElement; readonly dock?: HTMLElement;
  readonly dockGlyph?: HTMLElement; readonly dockGlow?: HTMLElement; readonly dockTile?: HTMLElement;
  readonly minimize?: HTMLElement; readonly zoom?: HTMLElement;
};
export type MagneticDomOptions = Omit<MagneticOptions, "monitors" | "windows"> & {
  readonly engine?: MagneticTiling;
  readonly monitors?: readonly MagneticMonitor[];
  readonly windows?: readonly MagneticDomWindow[];
  readonly host?: DomHost;
  readonly ghost?: HTMLElement;
  readonly neighbors?: HTMLElement;
  readonly onion?: HTMLElement;
  readonly fields?: Partial<Record<"left" | "right" | "top" | "bottom", HTMLElement>>;
  readonly orb?: HTMLElement;
  readonly onionEnabled?: boolean;
  readonly displayHz?: number;
  readonly thermalTier?: ThermalTier;
  readonly onEvent?: (event: MagneticEvent) => void;
  readonly onFrame?: (windows: readonly MagneticWindow[]) => void;
};

const knobs = defaultSpatialKnobs();
const px = (v: number) => (Math.round(v * 1000) / 1000) + "px";
const opacity = (v: number) => v >= 0.999 ? "" : Math.max(0, Math.min(1, v)).toFixed(3);

function transformOf(w: MagneticWindow): string {
  const p = w.pose, b = w.state.box;
  const x = p.cx - (b.x + b.w / 2), y = p.cy - (b.y + b.h / 2);
  if (Math.abs(x) < 0.0005 && Math.abs(y) < 0.0005 && p.z === 0 && p.rz === 0 &&
    p.sx === 1 && p.sy === 1 && p.squash === 0) return "";
  // Keep glass on a shared perspective plane. Browsers can drop backdrop-filter on rotateX/Y.
  const stretch = p.squash > 0.0001 ?
    ` rotate(${p.phi}rad) scale(${1 + p.squash}, ${1 / (1 + p.squash)}) rotate(${-p.phi}rad)` : "";
  return `translate3d(${px(x)}, ${px(y)}, ${px(p.z)}) rotate(${p.rz}deg)${stretch} scale(${p.sx}, ${p.sy})`;
}

function discover(root: HTMLElement): MagneticDomWindow[] {
  const docks = new Map(Array.from(root.querySelectorAll<HTMLElement>("[data-magnetic-dock]"),
    (dock) => [dock.dataset.magneticDock, dock]));
  return Array.from(root.querySelectorAll<HTMLElement>("[data-magnetic-window]"), (pane) => {
    const id = pane.dataset.magneticWindow ?? "";
    const dock = docks.get(id);
    const options: Record<string, HTMLElement> = {};
    for (const key of ["handle", "glass", "content", "shadow", "frost", "sheen", "minimize", "zoom"]) {
      const element = pane.querySelector<HTMLElement>("[data-magnetic-" + key + "]");
      if (element) options[key] = element;
    }
    for (const key of ["glyph", "glow", "tile"]) {
      const element = dock?.querySelector<HTMLElement>("[data-magnetic-dock-" + key + "]");
      if (element) options["dock" + key[0]!.toUpperCase() + key.slice(1)] = element;
    }
    return { ...options, id, pane, ...(dock ? { dock } : {}) };
  });
}

export function mountMagneticTiling(root: HTMLElement, options: MagneticDomOptions = {}) {
  const host = options.host ?? browserHost(root);
  const windows = options.windows ?? discover(root);
  const teardown: (() => void)[] = [];
  const styles = new Map<HTMLElement, Map<string, { value: string; priority: string }>>();
  const attrs = new Map<HTMLElement, Map<string, string | null>>();
  const doc = root.ownerDocument;
  const orb = options.orb ?? root.querySelector<HTMLElement>("[data-magnetic-orb]") ?? undefined;
  const ghost = options.ghost ?? root.querySelector<HTMLElement>("[data-magnetic-ghost]") ?? undefined;
  const neighborParent = options.neighbors ?? root.querySelector<HTMLElement>("[data-magnetic-neighbors]") ?? undefined;
  const onionParent = options.onion ?? root.querySelector<HTMLElement>("[data-magnetic-onion]") ?? undefined;
  const origin = () => root.getBoundingClientRect();
  const viewport = (): MagneticMonitor[] => [{
    id: "primary", viewport: { x: 0, y: 0, w: Math.max(1, root.clientWidth), h: Math.max(1, root.clientHeight) },
  }];
  const relativeRect = (element: HTMLElement): MagneticRect => {
    const r = element.getBoundingClientRect(), base = origin();
    return { x: r.left - base.left, y: r.top - base.top, w: Math.max(1, r.width), h: Math.max(1, r.height) };
  };
  const dockTarget = (dock?: HTMLElement) => {
    const base = viewport()[0]!.viewport;
    const camera = options.engine?.camera ?? magneticCamera(options.monitors ?? viewport());
    if (!dock) return { x: camera.x, y: base.y + base.h - 22, z: 60, size: 44 };
    const r = relativeRect(dock);
    const scale = magneticPerspective() / (magneticPerspective() - 60);
    return { x: camera.x + (r.x + r.w / 2 - camera.x) / scale,
      y: camera.y + (r.y + r.h / 2 - camera.y) / scale,
      z: 60, size: Math.min(r.w, r.h) / scale };
  };
  const engine = options.engine ?? new MagneticTiling({
    ...options, monitors: options.monitors ?? viewport(), reduce: options.reduce ?? host.reducedMotion?.matches ?? false,
    windows: windows.map((entry) => ({ id: entry.id, rect: relativeRect(entry.pane), dock: dockTarget(entry.dock) })),
  });
  const byId = new Map(windows.map((entry) => [entry.id, entry]));
  const ghostNodes: HTMLElement[] = [];
  type OnionSample = {
    outline: HTMLElement; tick: HTMLElement; segment: HTMLElement;
    x: number; y: number; scale: number;
  };
  const trails = new Map<string, OnionSample[]>();
  let onionEnabled = options.onionEnabled ?? false;
  let lastOnion = -Infinity;
  let thermalTier = options.thermalTier ?? "nominal";
  let raf: number | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timerDeadline: number | undefined;
  let onionTimer: ReturnType<typeof setTimeout> | undefined;
  let previousFrame: number | undefined;
  let pointer: { id: number; target: HTMLElement } | undefined;
  let mounted = true;
  let manual = false;
  let hostRafCount = 0;
  let wasMoving = false;

  function style(el: HTMLElement | undefined, property: string, value: string): void {
    if (!el || el.style.getPropertyValue(property) === value) return;
    let original = styles.get(el);
    if (!original) { original = new Map(); styles.set(el, original); }
    if (!original.has(property)) original.set(property, {
      value: el.style.getPropertyValue(property), priority: el.style.getPropertyPriority(property),
    });
    if (value) el.style.setProperty(property, value);
    else el.style.removeProperty(property);
  }
  function attr(el: HTMLElement | undefined, property: string, value: string | null): void {
    if (!el || el.getAttribute(property) === value) return;
    let original = attrs.get(el);
    if (!original) { original = new Map(); attrs.set(el, original); }
    if (!original.has(property)) original.set(property, el.getAttribute(property));
    if (value === null) el.removeAttribute(property);
    else el.setAttribute(property, value);
  }
  function box(el: HTMLElement, r: MagneticRect, set = style): void {
    set(el, "left", px(r.x));
    set(el, "top", px(r.y));
    set(el, "width", px(r.w));
    set(el, "height", px(r.h));
  }
  function listen(target: EventTarget, key: string, listener: EventListener): void {
    target.addEventListener(key, listener);
    teardown.push(() => target.removeEventListener(key, listener));
  }
  function renderWindow(entry: MagneticDomWindow, w: MagneticWindow, z: number): void {
    const { pane, content, glass, frost, sheen, shadow, dock, dockGlyph, dockGlow, dockTile } = entry;
    const p = w.pose;
    box(pane, w.state.box);
    style(pane, "z-index", String(z));
    style(pane, "transform", transformOf(w));
    style(pane, "will-change", w.dragging || magneticSpringCount(w.state) > 0 ? "transform" : "");
    style(pane, "visibility", p.hidden ? "hidden" : "");
    attr(pane, "inert", p.hidden ? "" : null);
    attr(pane, "aria-hidden", String(p.hidden));
    attr(pane, "data-magnetic-focused", engine.focused === w.id ? "" : null);
    attr(pane, "data-magnetic-latched", w.dragging && w.state.mag.target > 0 ? "" : null);
    style(glass, "opacity", opacity(p.glass));
    style(content, "opacity", opacity(p.content));
    if (!glass && !content) style(pane, "opacity", opacity(p.glass));
    style(content, "transform", Math.abs(p.fx - 1) < 1e-5 && Math.abs(p.fy - 1) < 1e-5 ?
      "" : `scale(${(1 / p.fx).toFixed(5)}, ${(1 / p.fy).toFixed(5)})`);
    style(shadow, "opacity", opacity(p.shadow * p.glass));
    style(shadow, "transform", p.lift > 0.001 ? `translate3d(0, ${px(p.lift * 12)}, 0) scale(${1 + 0.03 * p.lift})` : "");
    style(frost, "opacity", (p.frost * p.glass).toFixed(3));
    style(sheen, "opacity", (p.sheen * p.glass).toFixed(3));
    style(sheen, "--magnetic-sheen-angle", p.sheenAngle + "deg");
    const distance = (p.sheenAt - 0.5) * 1.24 * Math.hypot(w.state.box.w, w.state.box.h);
    const rad = p.sheenAngle * Math.PI / 180;
    style(sheen, "transform", p.sheen > 0 ?
      `translate3d(${px(distance * Math.cos(rad))}, ${px(distance * Math.sin(rad))}, 0)` : "");
    style(dockGlyph, "transform", Math.abs(p.pulse) < 0.0001 ? "" :
      `translateY(${px(p.pulse * 4)}) scale(${1 + p.pulse * 0.07}, ${1 - p.pulse * 0.09})`);
    style(dockGlow, "opacity", p.glow.toFixed(3));
    style(dockTile, "opacity", p.tile.toFixed(3));
    attr(dock, "data-magnetic-state", w.state.m.target === 1 ? "minimized" : "open");
    attr(dock, "aria-pressed", String(engine.focused === w.id));
  }
  function clearTrails(): void {
    for (const samples of trails.values()) for (const sample of samples) removeOnion(sample);
    trails.clear();
    lastOnion = -Infinity;
  }
  function removeOnion(sample: OnionSample): void {
    sample.outline.remove();
    sample.tick.remove();
    sample.segment.remove();
  }
  function onionNode(className: string): HTMLElement {
    const node = doc.createElement("div");
    node.className = className;
    node.setAttribute("aria-hidden", "true");
    node.style.position = "absolute";
    node.style.pointerEvents = "none";
    return node;
  }
  function sampleOnion(windows: readonly MagneticWindow[], now: number): void {
    if (!onionEnabled || !onionParent || now - lastOnion < 33000) return;
    lastOnion = now;
    const camera = engine.camera;
    for (const w of windows) {
      if ((!w.dragging && magneticSpringCount(w.state) === 0) || w.pose.hidden) continue;
      const { cx, cy, z, sx } = w.pose;
      const point = magneticProject(cx, cy, z, camera.x, camera.y);
      const samples = trails.get(w.id) ?? [];
      const previous = samples.at(-1);
      if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 3 && Math.abs(sx - previous.scale) < 0.004) continue;
      const outline = onionNode("magnetic-onion-sample");
      outline.style.border = "1px solid currentColor";
      outline.style.borderRadius = "26px";
      outline.style.transform = transformOf(w);
      box(outline, w.state.box, (el, property, value) => el?.style.setProperty(property, value));

      const tick = onionNode("magnetic-onion-tick");
      tick.style.left = px(point.x);
      tick.style.top = px(point.y);
      tick.style.width = tick.style.height = "4px";
      tick.style.transform = "translate(-50%, -50%)";
      tick.style.borderRadius = "50%";
      tick.style.backgroundColor = "currentColor";

      const segment = onionNode("magnetic-onion-path");
      if (previous) {
        const dx = point.x - previous.x, dy = point.y - previous.y;
        segment.style.left = px(previous.x);
        segment.style.top = px(previous.y);
        segment.style.width = px(Math.hypot(dx, dy));
        segment.style.borderTop = "1px dashed currentColor";
        segment.style.transformOrigin = "0 0";
        segment.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
      }
      samples.push({ outline, tick, segment, x: point.x, y: point.y, scale: sx });
      if (samples.length > 14) {
        removeOnion(samples.shift()!);
        samples[0]?.segment.remove();
      }
      samples.forEach(({ outline }, index) => { outline.style.opacity = String(0.14 + 0.56 * index / samples.length); });
      trails.set(w.id, samples);
      onionParent.append(outline, segment, tick);
    }
  }
  function draw(): void {
    if (!mounted) return;
    style(root, "perspective-origin", px(engine.camera.x) + " " + px(engine.camera.y));
    const all = engine.windows;
    const sorted = [...all].reverse().sort((a, b) => Number(a.dragging) - Number(b.dragging) ||
      Number(magneticMoving(a.state.m)) - Number(magneticMoving(b.state.m)));
    sorted.forEach((w, index) => {
      const entry = byId.get(w.id);
      if (entry) renderWindow(entry, w, index + 1);
    });
    const p = engine.preview;
    if (ghost) {
      if (p) box(ghost, p.rect);
      style(ghost, "opacity", p ? String(p.opacity) : "0");
      attr(ghost, "data-magnetic-zone", p?.zone ?? p?.kind ?? null);
    }
    if (neighborParent) {
      const count = p?.neighbors.length ?? 0;
      while (ghostNodes.length > count) ghostNodes.pop()?.remove();
      while (ghostNodes.length < count) {
        const node = doc.createElement("div");
        node.className = "magnetic-neighbor-preview";
        node.setAttribute("aria-hidden", "true");
        node.style.position = "absolute";
        node.style.pointerEvents = "none";
        node.style.border = "1px dashed currentColor";
        neighborParent.append(node);
        ghostNodes.push(node);
      }
      p?.neighbors.forEach((r, index) => {
        const el = ghostNodes[index]!;
        box(el, r, (node, property, value) => node?.style.setProperty(property, value));
        el.style.opacity = String(p.opacity);
      });
    }
    for (const key of ["left", "right", "top", "bottom"] as const) {
      style(options.fields?.[key], "opacity", String(engine.fields[key]));
    }
    attr(orb, "aria-pressed", String(engine.isGathered));
    const metrics = engine.metrics();
    const moving = metrics.heldTokens > 0;
    if (moving) {
      if (onionTimer !== undefined) clearTimeout(onionTimer);
      onionTimer = undefined;
      style(onionParent, "opacity", "");
      sampleOnion(all, metrics.timeUs);
    } else if (wasMoving && onionEnabled && onionParent && trails.size > 0) {
      onionTimer = setTimeout(() => {
        style(onionParent, "opacity", "0");
        onionTimer = setTimeout(clearTrails, 700);
      }, 900);
    }
    wasMoving = moving;
    options.onFrame?.(all);
  }
  function governor() {
    return governFrames({ heldTokens: engine.metrics().heldTokens, motionEnergy: 1,
      displayHz: options.displayHz ?? 60, thermalTier, motionPolicy: engine.reduce ? "reduce" : "full",
      hidden: host.document.hidden }, knobs);
  }
  function cancelRaf(): void {
    if (raf !== undefined) host.cancelFrame(raf);
    raf = undefined;
    previousFrame = undefined;
  }
  function cancelTimer(): void {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    timerDeadline = undefined;
  }
  function schedule(): void {
    const hz = governor().hz;
    if (!mounted || manual || hz === 0) cancelRaf();
    if (!mounted || manual || host.document.hidden) { cancelTimer(); return; }
    if (hz > 0) {
      cancelTimer();
      if (raf !== undefined) return;
      const handle = host.requestFrame((now) => {
        hostRafCount += 1;
        if (!mounted || raf !== handle) return;
        raf = undefined;
        const rate = governor().hz;
        if (rate > 0) {
          const interval = 1000 / rate;
          const elapsed = previousFrame === undefined ? interval : now - previousFrame;
          if (elapsed + 0.25 >= interval) {
            previousFrame = now;
            engine.advanceFrame(elapsed);
          }
        }
        schedule();
      });
      raf = handle;
    } else {
      const next = engine.nextWorkMs;
      if (next === undefined) { cancelTimer(); return; }
      const deadline = engine.metrics().timeUs + next * 1000;
      if (timerDeadline === deadline) return;
      cancelTimer();
      timerDeadline = deadline;
      timer = setTimeout(() => {
        timer = undefined;
        timerDeadline = undefined;
        if (mounted) engine.advanceFrame(next);
        schedule();
      }, next);
    }
  }
  function releasePointer(cancel: boolean, at?: number): void {
    if (!pointer) return;
    const { id, target } = pointer;
    pointer = undefined;
    if (target.hasPointerCapture?.(id)) target.releasePointerCapture(id);
    engine.endDrag(cancel, at);
  }
  function toggleOrb(): void {
    if (engine.isGathered) engine.returnAll();
    else engine.gatherAll();
  }

  style(root, "perspective", px(magneticPerspective()));
  if (onionParent) style(onionParent, "transition", "opacity 700ms ease");
  for (const entry of windows) {
    const handle = entry.handle ?? entry.pane;
    style(entry.pane, "position", "absolute");
    style(handle, "touch-action", "none");
    listen(entry.pane, "focusin", () => engine.focus(entry.id));
    listen(handle, "pointerdown", (event) => {
      const e = event as PointerEvent;
      const target = e.target as Element | null;
      if (e.button !== 0 || pointer || target?.closest?.("button, input, select, textarea, a, [contenteditable]")) return;
      const r = origin();
      engine.focus(entry.id);
      if (!engine.beginDrag(entry.id, e.clientX - r.left, e.clientY - r.top, host.now())) return;
      pointer = { id: e.pointerId, target: handle };
      handle.setPointerCapture?.(e.pointerId);
    });
    listen(handle, "lostpointercapture", (event) => {
      if ((event as PointerEvent).pointerId === pointer?.id) releasePointer(true);
    });
    if (entry.minimize) listen(entry.minimize, "click", () => { engine.minimize(entry.id); });
    if (entry.zoom) listen(entry.zoom, "click", () => engine.zoom(entry.id));
    if (entry.dock) listen(entry.dock, "click", () => engine.dock(entry.id));
  }
  listen(host.window, "pointermove", (event) => {
    const e = event as PointerEvent;
    if (e.pointerId !== pointer?.id) return;
    const r = origin();
    engine.moveDrag(e.clientX - r.left, e.clientY - r.top, host.now());
  });
  listen(host.window, "pointerup", (event) => {
    if ((event as PointerEvent).pointerId === pointer?.id) releasePointer(false, host.now());
  });
  listen(host.window, "pointercancel", (event) => {
    if ((event as PointerEvent).pointerId === pointer?.id) releasePointer(true);
  });
  listen(host.window, "blur", () => releasePointer(true));
  listen(host.document, "visibilitychange", schedule);
  const refreshGeometry = () => {
    releasePointer(true);
    if (!options.monitors && !options.engine) engine.setMonitors(viewport());
    for (const entry of windows) if (entry.dock || !options.engine) engine.setDock(entry.id, dockTarget(entry.dock));
  };
  listen(host.window, "resize", refreshGeometry);
  listen(root, "keydown", (event) => {
    const e = event as KeyboardEvent;
    const target = e.target as Element | null;
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey ||
      target?.closest?.("input, textarea, select, [contenteditable]")) return;
    const focused = engine.focused;
    if (e.key === "Escape") releasePointer(true);
    else if (e.key.toLowerCase() === "m" && focused) engine.minimize(focused);
    else if (e.key.toLowerCase() === "r") {
      const restore = engine.windows.find((w) => w.state.m.target === 1);
      if (restore) engine.restore(restore.id);
    } else if (e.key === " " && !target?.closest?.("button")) { e.preventDefault(); toggleOrb(); }
    else if (e.shiftKey && focused && engine.layout === "free") {
      if (e.key === "ArrowLeft") engine.snap(focused, "left");
      else if (e.key === "ArrowRight") engine.snap(focused, "right");
      else if (e.key === "ArrowUp") engine.snap(focused, "full");
      else if (e.key === "ArrowDown") engine.unsnap(focused);
      else return;
      e.preventDefault();
    }
  });
  if (orb) listen(orb, "click", toggleOrb);
  if (host.reducedMotion && options.reduce === undefined) {
    const media = host.reducedMotion;
    const motion = () => engine.setReducedMotion(media.matches);
    media.addEventListener("change", motion);
    teardown.push(() => media.removeEventListener("change", motion));
  }
  teardown.push(engine.subscribe(() => { draw(); schedule(); }));
  if (options.onEvent) teardown.push(engine.onEvent(options.onEvent));
  draw();
  schedule();

  const metrics = () => ({ ...engine.metrics(), hostRafCount });
  return {
    engine, metrics, refreshGeometry,
    setThermalTier(tier: ThermalTier) { thermalTier = tier; schedule(); },
    setOnion(enabled: boolean) { onionEnabled = enabled; if (!enabled) clearTrails(); draw(); },
    runMs(ms: number) {
      manual = true;
      cancelRaf();
      cancelTimer();
      try { engine.runMs(ms); }
      finally { manual = false; schedule(); }
    },
    falsifyIdle(before: IdleSample, elapsedUs: number) { return falsifyIdle(before, metrics(), elapsedUs); },
    unmount() {
      if (!mounted) return;
      mounted = false;
      releasePointer(true);
      cancelRaf();
      cancelTimer();
      if (onionTimer !== undefined) clearTimeout(onionTimer);
      for (const remove of teardown.reverse()) remove();
      clearTrails();
      for (const node of ghostNodes) node.remove();
      for (const [el, originals] of styles) for (const [key, original] of originals) {
        if (original.value) el.style.setProperty(key, original.value, original.priority);
        else el.style.removeProperty(key);
      }
      for (const [el, originals] of attrs) for (const [key, original] of originals) {
        if (original === null) el.removeAttribute(key);
        else el.setAttribute(key, original);
      }
    },
  };
}
