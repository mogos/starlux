import type { LightGlyphSink, LightSurfaceSink } from "./runtime.ts";
import type { SurfaceFrame } from "./inputs.ts";

export const lightLaneNames = ["pool", "bevel", "fresnel", "red", "green", "blue", "caustic"] as const;
export type LightLaneName = (typeof lightLaneNames)[number];

function srgb(value: number): number {
  const linear = value / 65535;
  return 255 * (linear <= .0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - .055);
}

function laneColor(packet: readonly number[], start: number, alpha = 1): string {
  return `rgba(${srgb(packet[start + 10]!)},${srgb(packet[start + 11]!)},${srgb(packet[start + 12]!)},${alpha})`;
}

function cssBlend(tag: number): string { return tag === 2 ? "multiply" : tag === 1 ? "plus-lighter" : "normal"; }
function canvasBlend(tag: number): GlobalCompositeOperation {
  return tag === 2 ? "multiply" : tag === 1 ? "lighter" : "source-over";
}

type CanvasContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export type CanvasLightClips = (clip: number, path: number, lane: LightLaneName | "ambient") => Path2D | undefined;

function roundedClip(ctx: CanvasContext, frame: SurfaceFrame, kind: LightLaneName | "ambient"): void {
  const { width, height } = frame;
  const radius = Math.max(0, Math.min(frame.radius ?? 0, width / 2, height / 2));
  ctx.beginPath();
  ctx.roundRect(0, 0, width, height, radius);
  if (kind !== "pool" && kind !== "ambient") {
    const pad = kind === "bevel" ? 12 : kind === "caustic" ? 8 : 2;
    if (width > 2 * pad && height > 2 * pad) {
      ctx.roundRect(pad, pad, width - 2 * pad, height - 2 * pad, Math.max(0, radius - pad));
    }
  }
  ctx.clip("evenodd");
}

const edgeBand = { pool: 0, bevel: 12, fresnel: 2, red: 2, green: 2, blue: 2, caustic: 8 } as const;

function profile(kind: LightLaneName): readonly [number, number, number] {
  if (kind === "bevel") return [.50, .16, .50];
  if (kind === "caustic") return [.90, .30, .45];
  if (kind === "pool") return [1, .34, .42];
  return [1, .55, .38];
}

// Draw into the host's physical pass. The host supplies its own clear/damage pass and content order.
export function paintLightCanvas(
  ctx: CanvasContext, packet: readonly number[], frame: SurfaceFrame, clips?: CanvasLightClips,
): void {
  if (packet[1] !== 5408 || frame.width <= 0 || frame.height <= 0) return;
  ctx.save();
  try {
    const [a, b, c, d] = frame.transform ?? [1, 0, 0, 1];
    ctx.transform(a, b, c, d, frame.x, frame.y);
    if (packet[4] || packet[5] || packet[6]) {
      ctx.save();
      const clip = clips?.(packet[7]!, 0, "ambient");
      if (clip) ctx.clip(clip);
      else roundedClip(ctx, frame, "ambient");
      const gain = Math.max(packet[4]!, packet[5]!, packet[6]!);
      ctx.globalAlpha = gain / 65535;
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = `rgb(${srgb(packet[4]! / gain * 65535)},${srgb(packet[5]! / gain * 65535)},${srgb(packet[6]! / gain * 65535)})`;
      ctx.fillRect(0, 0, frame.width, frame.height);
      ctx.restore();
    }
    for (let i = 0; i < 84; i++) {
      const start = 8 + i * 16;
      if (packet[start] !== 1) continue;
      const kind = lightLaneNames[i % 7]!;
      const major = packet[start + 6]! / 256;
      const minor = packet[start + 7]! / 256;
      if (major <= 0 || minor <= 0) continue;
      const tx = packet[start + 4]! / 32767;
      const ty = packet[start + 5]! / 32767;
      const [peak, falloff, shoulder] = profile(kind);
      ctx.save();
      const clip = clips?.(packet[start + 1]!, packet[start + 13]!, kind);
      if (clip) ctx.clip(clip);
      else roundedClip(ctx, frame, kind);
      ctx.globalAlpha = packet[start + 9]! / 65535;
      ctx.globalCompositeOperation = canvasBlend(packet[start + 14]!);
      const blur = packet[start + 8]! / 256;
      if (blur > 0) ctx.filter = `blur(${blur}px)`;
      ctx.transform(tx * major, ty * major, -ty * minor, tx * minor, packet[start + 2]! / 256, packet[start + 3]! / 256);
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      gradient.addColorStop(0, laneColor(packet, start, peak));
      gradient.addColorStop(shoulder, laneColor(packet, start, falloff));
      gradient.addColorStop(1, laneColor(packet, start, 0));
      ctx.fillStyle = gradient;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    }
  } finally {
    ctx.restore();
  }
}

// This context is the final transparent overlay, independent of the physical canvas.
export function createCanvasLightGlyph(ctx: CanvasContext, deviceScale = 1): LightGlyphSink {
  let previous: { x: number; y: number; radius: number } | undefined;
  return (glyph) => {
    ctx.save();
    ctx.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
    if (previous) {
      const pad = previous.radius + 2;
      ctx.clearRect(previous.x - pad, previous.y - pad, pad * 2, pad * 2);
    }
    previous = undefined;
    if (glyph[0] === 1) {
      const x = glyph[1]! / 256;
      const y = glyph[2]! / 256;
      const radius = glyph[3]! / 256;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
      glow.addColorStop(0, "rgba(255,247,223,1)");
      glow.addColorStop(.3, "rgba(255,205,125,.85)");
      glow.addColorStop(1, "rgba(255,178,77,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      previous = { x, y, radius };
    }
    ctx.restore();
  };
}

export type CssLightClips = (clip: number, path: number, lane: LightLaneName | "ambient") => string | undefined;

export function createCssLightSurface(
  element: HTMLElement, clips?: CssLightClips,
): { paint: LightSurfaceSink; dispose(): void } {
  const host = element.ownerDocument.createElement("span");
  host.setAttribute("aria-hidden", "true");
  host.dataset.starluxSurface = "";
  host.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden;border-radius:inherit";
  const originalPosition = element.style.position;
  const positioned = element.ownerDocument.defaultView?.getComputedStyle(element).position === "static";
  if (positioned) element.style.position = "relative";
  const lanes = new Map<number, { shell: HTMLElement; filter: HTMLElement; lobe: HTMLElement; words: number[] }>();
  const ambient = host.cloneNode(false) as HTMLElement;
  delete ambient.dataset.starluxSurface;
  host.append(ambient);
  element.prepend(host);

  function mountLane(index: number, kind: LightLaneName) {
    const shell = element.ownerDocument.createElement("span");
    const filter = element.ownerDocument.createElement("span");
    const lobe = element.ownerDocument.createElement("span");
    const band = edgeBand[kind];
    shell.dataset.luxLane = kind;
    shell.style.cssText = "position:absolute;inset:0;border-radius:inherit;overflow:hidden";
    if (band > 0) {
      shell.style.padding = band + "px";
      shell.style.maskImage = "linear-gradient(white 0 0),linear-gradient(white 0 0)";
      shell.style.maskClip = "content-box,border-box";
      shell.style.maskComposite = "exclude";
    }
    lobe.style.cssText = "position:absolute;left:0;top:0;width:2px;height:2px;transform-origin:0 0;"
      + "background:radial-gradient(ellipse,var(--lux-peak) 0%,var(--lux-shoulder) var(--lux-stop),transparent 70.711%);"
      + "transform:var(--lux-matrix);opacity:var(--lux-gain);";
    filter.style.cssText = "position:absolute;inset:0;filter:blur(var(--lux-blur));";
    filter.append(lobe);
    shell.append(filter);
    let after: HTMLElement | undefined;
    for (let next = index + 1; next < 84 && !after; next++) after = lanes.get(next)?.shell;
    host.insertBefore(shell, after ?? null);
    const entry = { shell, filter, lobe, words: new Array<number>(16).fill(-1) };
    lanes.set(index, entry);
    return entry;
  }

  function variable(style: CSSStyleDeclaration, name: string, value: string): void {
    if (style.getPropertyValue(name) !== value) style.setProperty(name, value);
  }

  return {
    paint(packet, scene) {
      let currentBlur = 0;
      const ambientGain = Math.max(packet[4]!, packet[5]!, packet[6]!);
      ambient.style.backgroundColor = ambientGain === 0 ? "transparent"
        : `rgba(${srgb(packet[4]! / ambientGain * 65535)},${srgb(packet[5]! / ambientGain * 65535)},${srgb(packet[6]! / ambientGain * 65535)},${ambientGain / 65535})`;
      ambient.style.mixBlendMode = "plus-lighter";
      ambient.style.clipPath = clips?.(packet[7]!, 0, "ambient") ?? "";
      variable(element.style, "--lux-shadow-x", scene[4]! / 256 + "px");
      variable(element.style, "--lux-shadow-y", scene[5]! / 256 + "px");
      variable(element.style, "--lux-edge-luminance", String(scene[6]! / 65535));
      for (let i = 0; i < 84; i++) {
        const start = 8 + i * 16;
        if (packet[start] !== 1) {
          lanes.get(i)?.shell.remove();
          lanes.delete(i);
          continue;
        }
        currentBlur = Math.max(currentBlur, packet[start + 8]! / 256);
        const kind = lightLaneNames[i % 7]!;
        const entry = lanes.get(i) ?? mountLane(i, kind);
        if (entry.words.every((word, j) => word === packet[start + j])) continue;
        for (let j = 0; j < 16; j++) entry.words[j] = packet[start + j]!;
        const { shell, filter, lobe } = entry;
        const clip = clips?.(packet[start + 1]!, packet[start + 13]!, kind);
        shell.style.clipPath = clip ?? "";
        if (kind !== "pool") shell.style.maskComposite = clip ? "add" : "exclude";
        if (clip) shell.style.maskImage = "none";
        else if (kind !== "pool") shell.style.maskImage = "linear-gradient(white 0 0),linear-gradient(white 0 0)";
        shell.style.mixBlendMode = cssBlend(packet[start + 14]!);
        const tx = packet[start + 4]! / 32767;
        const ty = packet[start + 5]! / 32767;
        const major = packet[start + 6]! / 256;
        const minor = packet[start + 7]! / 256;
        const [peak, falloff, shoulder] = profile(kind);
        variable(lobe.style, "--lux-matrix",
          `matrix(${tx * major},${ty * major},${-ty * minor},${tx * minor},${packet[start + 2]! / 256 - tx * major + ty * minor},${packet[start + 3]! / 256 - ty * major - tx * minor})`);
        variable(lobe.style, "--lux-gain", String(packet[start + 9]! / 65535));
        // Blur works in the shell's px, because the lobe itself is scaled from a 2 px sprite.
        variable(filter.style, "--lux-blur", packet[start + 8]! / 256 + "px");
        variable(lobe.style, "--lux-peak", laneColor(packet, start, peak));
        variable(lobe.style, "--lux-shoulder", laneColor(packet, start, falloff));
        variable(lobe.style, "--lux-stop", shoulder * 70.711 + "%");
      }
      variable(element.style, "--lux-backdrop-blur", currentBlur + "px");
    },
    dispose() {
      host.remove();
      if (positioned && element.style.position === "relative") element.style.position = originalPosition;
      for (const name of ["--lux-shadow-x", "--lux-shadow-y", "--lux-edge-luminance", "--lux-backdrop-blur"]) {
        element.style.removeProperty(name);
      }
    },
  };
}

export function createCssLightGlyph(mount: HTMLElement): { paint: LightGlyphSink; dispose(): void } {
  const glyph = mount.ownerDocument.createElement("span");
  glyph.setAttribute("aria-hidden", "true");
  glyph.dataset.starluxSource = "";
  glyph.style.cssText = "position:fixed;left:0;top:0;pointer-events:none;z-index:2147483647;"
    + "background:radial-gradient(circle,#fff7df 0%,rgba(255,205,125,.85) 30%,transparent 70%);display:none";
  mount.append(glyph);
  return {
    paint(words) {
      if (words[0] !== 1) {
        glyph.style.display = "none";
        return;
      }
      const r = words[3]! / 256;
      glyph.style.width = glyph.style.height = 2 * r + "px";
      glyph.style.transform = `translate(${words[1]! / 256 - r}px,${words[2]! / 256 - r}px)`;
      glyph.style.display = "block";
    },
    dispose() { glyph.remove(); },
  };
}

// Install this on a retained room layer behind all receiving surfaces.
export function paintLightRoomCanvas(ctx: CanvasContext, scene: readonly number[]): void {
  const gain = scene[3]! / 65535;
  const radius = scene[2]! / 256;
  if (gain <= 0 || radius <= 0) return;
  const x = scene[0]! / 256;
  const y = scene[1]! / 256;
  ctx.save();
  const pool = ctx.createRadialGradient(x, y, 0, x, y, radius);
  pool.addColorStop(0, `rgba(255,222,177,${gain})`);
  pool.addColorStop(.42, `rgba(255,222,177,${gain * .34})`);
  pool.addColorStop(1, "rgba(255,222,177,0)");
  ctx.fillStyle = pool;
  ctx.globalCompositeOperation = "lighter";
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}
