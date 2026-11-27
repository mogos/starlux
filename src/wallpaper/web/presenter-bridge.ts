import { bindWallpaperZenith } from "../../../ss/wallpaper/light_bridge.ss.ts";
import { CONFIG } from "../../../ss/wallpaper/types.ss.ts";
import { WallpaperHost } from "../host.ts";
import type { WallpaperPresenter, WallpaperScheduler, WallpaperWakePort } from "../host.ts";
import type { WallpaperOptions, WallpaperRuntime } from "../runtime.ts";

export interface WallpaperBrowserBinding {
  readonly host: WallpaperHost;
  dispose(): void;
}

export function mountWallpaper(
  element: HTMLElement,
  presenter: WallpaperPresenter,
  options: WallpaperOptions = {},
  wake?: WallpaperWakePort,
): WallpaperBrowserBinding {
  const doc = element.ownerDocument, win = doc.defaultView;
  if (!win) throw new Error("Wallpaper element requires a browsing context");
  const media = win.matchMedia("(prefers-reduced-motion: reduce)");
  const scheduler: WallpaperScheduler = {
    nowUs: () => Math.round(win.performance.now() * 1000),
    unixSeconds: () => Math.floor(Date.now() / 1000),
    requestFrame: (callback) => win.requestAnimationFrame(callback),
    cancelFrame: (id) => win.cancelAnimationFrame(id),
    setTimer: (delay, callback) => win.setTimeout(callback, delay),
    clearTimer: (id) => win.clearTimeout(id),
  };
  const host = new WallpaperHost(scheduler, presenter, {
    ...options, solar: options.solar ?? { source: "civil", utcOffsetMinutes: -new Date().getTimezoneOffset() },
  }, wake);
  const policy = () => host.update({ hidden: doc.hidden, reducedMotion: media.matches });
  const resize = () => {
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) host.runtime.resize(rect.width, rect.height, win.devicePixelRatio);
    policy();
  };
  const pointer = (event: PointerEvent) => {
    if (!event.isTrusted || !event.pointerType) return;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    host.pointer((event.clientX - rect.left) * (host.runtime.words[CONFIG() + 32] ?? 0) / rect.width,
      (event.clientY - rect.top) * (host.runtime.words[CONFIG() + 33] ?? 0) / rect.height, true, true);
  };
  const leave = (event: PointerEvent) => host.pointer(0, 0, false, event.isTrusted && event.pointerType !== "");
  const observer = new ResizeObserver(resize);
  observer.observe(element);
  doc.addEventListener("visibilitychange", policy);
  media.addEventListener("change", policy);
  element.addEventListener("pointermove", pointer);
  element.addEventListener("pointerleave", leave);
  resize();
  return {
    host,
    dispose() {
      observer.disconnect();
      doc.removeEventListener("visibilitychange", policy);
      media.removeEventListener("change", policy);
      element.removeEventListener("pointermove", pointer);
      element.removeEventListener("pointerleave", leave);
      host.dispose();
    },
  };
}

export function writeWallpaperLight(runtime: WallpaperRuntime, lightInput: number[]): boolean {
  return bindWallpaperZenith(runtime.words, lightInput) === 0;
}
