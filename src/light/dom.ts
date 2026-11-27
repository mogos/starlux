import type { LuxEvent } from "../lux.ts";
import { defaultLightPolicy } from "./inputs.ts";
import type { LightPoint, LightPolicy, SurfaceFrame } from "./inputs.ts";
import { createCssLightGlyph, createCssLightSurface } from "./paint.ts";
import type { CssLightClips } from "./paint.ts";
import { resolveLightEffect } from "./plan.ts";
import type { LightEventSnapshot } from "./plan.ts";
import type { LightEffectPlan, SourceView } from "../../ss/light/index.ss.ts";
import { LightField } from "./runtime.ts";
import type { LightClockPort } from "./runtime.ts";

type DomLightSurface = {
  readonly element: HTMLElement;
  readonly frame: SurfaceFrame | (() => SurfaceFrame);
  readonly clips?: CssLightClips;
};

export function bindLightEffects(
  field: LightField, bus: { subscribe(listener: (event: LuxEvent) => void): () => void },
  plan: LightEffectPlan, snapshot: (event: LuxEvent) => LightEventSnapshot | undefined,
): () => void {
  return bus.subscribe((event) => {
    const bound = snapshot(event);
    if (bound) field.applyEffect(resolveLightEffect(plan, event, bound));
  });
}

export function mountLightDom(root: HTMLElement, options: {
  readonly surfaces: readonly DomLightSurface[];
  readonly policy?: LightPolicy;
  readonly source?: SourceView;
  readonly sourceSwitch?: HTMLInputElement;
  readonly clock?: LightClockPort;
  readonly staticKey?: (root: HTMLElement) => LightPoint;
}) {
  const doc = root.ownerDocument;
  const view = doc.defaultView;
  if (!view) throw new Error("Light requires a document with a window");
  const media = view.matchMedia("(prefers-reduced-motion: reduce)");
  const initialPolicy = options.policy ?? defaultLightPolicy;
  let policy = initialPolicy;
  const makePolicy = (): LightPolicy => {
    const bounds = root.getBoundingClientRect();
    const rtl = view.getComputedStyle(root).direction === "rtl";
    const staticKey = options.staticKey?.(root) ?? options.policy?.staticKey ?? {
      x: bounds.left + bounds.width * (rtl ? .875 : .125),
      y: bounds.top + bounds.height * .165,
    };
    return { ...policy, deviceScale: Math.max(.5, Math.min(8, view.devicePixelRatio)),
      motion: media.matches && policy.motion === "full" ? "reduce" : policy.motion, staticKey };
  };
  const glyph = createCssLightGlyph(doc.body);
  const field = new LightField({ host: { requestFrame: (cb) => view.requestAnimationFrame(cb),
    cancelFrame: (handle) => view.cancelAnimationFrame(handle) }, paintGlyph: glyph.paint, policy: makePolicy(),
    ...(options.source && { source: options.source }), ...(options.clock && { clock: options.clock }) });
  const mounts = options.surfaces.map(({ element, frame, clips }) => {
    const binding = createCssLightSurface(element, clips);
    const read = typeof frame === "function" ? frame : () => frame;
    const detach = element.isConnected ? field.attachSurface(read(), binding.paint) : undefined;
    return { element, binding, read, detach };
  });
  const refresh = () => {
    const frames = mounts.flatMap(({ read, detach }) => detach ? [read()] : []);
    field.updateScene(makePolicy(), frames);
  };
  const onPointer = (event: PointerEvent) => {
    const samples = event.getCoalescedEvents?.();
    const pose = samples?.[samples.length - 1] ?? event;
    field.samplePointer({ x: pose.clientX, y: pose.clientY });
  };
  const onCancel = () => field.cancel();
  const onVisibility = () => {
    const hidden = doc.hidden || !root.isConnected;
    if (hidden) {
      field.setHidden(true);
      return;
    }
    let changed = false;
    for (const mount of mounts) {
      if (!mount.element.isConnected && mount.detach) {
        mount.detach();
        mount.detach = undefined;
        changed = true;
      } else if (mount.element.isConnected && !mount.detach) {
        mount.detach = field.attachSurface(mount.read(), mount.binding.paint);
        changed = true;
      }
    }
    if (changed) refresh();
    field.setHidden(false);
  };
  const toggle = options.sourceSwitch;
  const onToggle = () => field.setSourceVisible(toggle!.checked);
  if (toggle) {
    toggle.checked = options.source?.showLightSource ?? true;
    toggle.addEventListener("change", onToggle);
  }
  const resizeObserver = new ResizeObserver(refresh);
  resizeObserver.observe(root);
  for (const mount of mounts) resizeObserver.observe(mount.element);
  const treeObserver = new MutationObserver(onVisibility);
  treeObserver.observe(doc, { childList: true, subtree: true });
  root.addEventListener("pointermove", onPointer);
  root.addEventListener("lostpointercapture", onCancel);
  root.addEventListener("pointercancel", onCancel);
  view.addEventListener("resize", refresh);
  view.addEventListener("scroll", refresh, true);
  doc.addEventListener("visibilitychange", onVisibility);
  media.addEventListener("change", refresh);
  onVisibility();

  return {
    field, refresh,
    setPolicy(next: LightPolicy) { policy = next; refresh(); },
    dispose() {
      resizeObserver.disconnect();
      treeObserver.disconnect();
      root.removeEventListener("pointermove", onPointer);
      root.removeEventListener("lostpointercapture", onCancel);
      root.removeEventListener("pointercancel", onCancel);
      view.removeEventListener("resize", refresh);
      view.removeEventListener("scroll", refresh, true);
      doc.removeEventListener("visibilitychange", onVisibility);
      media.removeEventListener("change", refresh);
      toggle?.removeEventListener("change", onToggle);
      field.dispose();
      for (const mount of mounts) {
        mount.detach?.();
        mount.binding.dispose();
      }
      glyph.dispose();
    },
  };
}
