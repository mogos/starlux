import { clamp, clamp01 } from "./physics/math.ss.ts";
import { magneticLength, magneticLift, magneticMix, magneticPerspective } from "./magnetic_tiling.ss.ts";
import type { MagneticRect } from "./magnetic_tiling.ss.ts";

export function magneticGap(): number { return 12; }

export function magneticContains(r: MagneticRect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function magneticIntersection(a: MagneticRect, b: MagneticRect): number {
  return Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
}

function cell(s: MagneticRect, x: number, y: number, w: number, h: number): MagneticRect {
  return { x: s.x + x, y: s.y + y, w: Math.max(1, w), h: Math.max(1, h) };
}

export function magneticZoneRect(s: MagneticRect, zone: number): MagneticRect {
  const gap = Math.min(magneticGap(), Math.min(s.w, s.h) / 12);
  const hw = (s.w - gap) / 2, hh = (s.h - gap) / 2;
  const tw = (s.w - 2 * gap) / 3;
  if (zone === 1) return cell(s, 0, 0, hw, s.h);
  if (zone === 2) return cell(s, hw + gap, 0, hw, s.h);
  if (zone === 3) return cell(s, 0, 0, s.w, hh);
  if (zone === 4) return cell(s, 0, hh + gap, s.w, hh);
  if (zone === 5) return cell(s, 0, 0, hw, hh);
  if (zone === 6) return cell(s, hw + gap, 0, hw, hh);
  if (zone === 7) return cell(s, 0, hh + gap, hw, hh);
  if (zone === 8) return cell(s, hw + gap, hh + gap, hw, hh);
  if (zone >= 9 && zone <= 11) return cell(s, (zone - 9) * (tw + gap), 0, tw, s.h);
  if (zone === 12) return cell(s, 0, 0, s.w - tw - gap, s.h);
  if (zone === 13) return cell(s, tw + gap, 0, s.w - tw - gap, s.h);
  if (zone === 14) return cell(s, s.w * 0.10, s.h * 0.10, s.w * 0.80, s.h * 0.80);
  return s;
}

export type MagneticFields = {
  readonly left: number; readonly right: number; readonly top: number; readonly bottom: number;
};
export function magneticEdgeFields(s: MagneticRect, px: number, py: number): MagneticFields {
  return { left: clamp01(1 - (px - s.x) / 170), right: clamp01(1 - (s.x + s.w - px) / 170),
    top: clamp01(1 - (py - s.y) / 150), bottom: clamp01(1 - (s.y + s.h - py) / 150) };
}

// Mode 0 keeps the study's top-edge maximize, 1 adds thirds, 2 adds primary/rail, 3 uses a centered focus pane.
export function magneticEdgeZone(s: MagneticRect, px: number, py: number, latched: number, mode: number): number {
  const x = (px - s.x) / Math.max(1, s.w), y = (py - s.y) / Math.max(1, s.h);
  const band = latched > 0 ? 2 : 1;
  const corner = latched > 0 ? 0.30 : 0.20;
  const nearX = Math.min(38 * band, s.w * 0.12);
  const nearY = Math.min(52 * band, s.h * 0.12);
  const left = px - s.x <= nearX, right = s.x + s.w - px <= nearX;
  if (left || right) {
    if (y < corner) return left ? 5 : 6;
    if (y > 1 - corner) return left ? 7 : 8;
    if (mode === 2) return left ? 12 : 13;
    return left ? 1 : 2;
  }
  if (py - s.y <= nearY) {
    const cornerX = latched > 0 ? 0.20 : 0.14;
    if (x < cornerX) return 5;
    if (x > 1 - cornerX) return 6;
    if (mode === 1) return 9 + Math.floor(clamp(x, 0, 0.999999) * 3);
    if (mode === 3) return 14;
    if (x < 0.38 || x > 0.62) return 3;
    return 15;
  }
  if (s.y + s.h - py <= nearY) {
    if (mode === 1) return 9 + Math.floor(clamp(x, 0, 0.999999) * 3);
    return 4;
  }
  return 0;
}

export function magneticMonitorHandoff(
  current: MagneticRect, candidate: MagneticRect, px: number, py: number, barrier: number,
): boolean {
  if (!magneticContains(candidate, px, py)) return false;
  if (candidate.x >= current.x + current.w && px < candidate.x + barrier) return false;
  if (candidate.x + candidate.w <= current.x && px > candidate.x + candidate.w - barrier) return false;
  if (candidate.y >= current.y + current.h && py < candidate.y + barrier) return false;
  if (candidate.y + candidate.h <= current.y && py > candidate.y + candidate.h - barrier) return false;
  return !magneticContains(current, px, py);
}

export function magneticProject(x: number, y: number, z: number, ox: number, oy: number): MagneticRect {
  const perspective = magneticPerspective();
  const k = perspective / clamp(perspective - z, 1, 2 * perspective);
  return { x: ox + (x - ox) * k, y: oy + (y - oy) * k, w: 0, h: 0 };
}

export function magneticDragRect(
  space: MagneticRect, r: MagneticRect, px: number, py: number, gx: number, gy: number, lift: number,
  pull: MagneticRect, latch: number, ox: number, oy: number,
): MagneticRect {
  const perspective = magneticPerspective();
  const scale = (perspective - magneticLift() * clamp(lift, 0, 1.2)) / perspective;
  const x = ox + (px - ox) * scale - gx;
  const y = oy + (py - oy) * scale - gy;
  const cx = clamp(x, space.x - r.w * 0.55, space.x + space.w - r.w * 0.45);
  const cy = clamp(y, space.y - 6, Math.max(space.y, space.y + space.h - 70));
  const k = 0.55 * clamp01(latch);
  return { x: magneticMix(cx + (x - cx) * 0.35, pull.x, k), y: magneticMix(cy + (y - cy) * 0.35, pull.y, k),
    w: magneticMix(r.w, pull.w, k), h: magneticMix(r.h, pull.h, k) };
}

export function magneticThrow(space: MagneticRect, r: MagneticRect, vx: number, vy: number): MagneticRect {
  const grip = Math.min(150, space.w / 2, r.w);
  return { x: Math.floor(clamp(r.x + vx * 0.16, space.x - r.w + grip, space.x + space.w - grip) + 0.5),
    y: Math.floor(clamp(r.y + vy * 0.16, space.y, Math.max(space.y, space.y + space.h - 60)) + 0.5),
    w: r.w, h: r.h };
}

export function magneticWindowRegion(r: MagneticRect, x: number, y: number, latch: boolean): number {
  const band = latch ? 0.32 : 0.26;
  const fx = (x - r.x) / r.w, fy = (y - r.y) / r.h;
  let best = band;
  let region = 0;
  if (fx < best) { best = fx; region = 1; }
  if (1 - fx < best) { best = 1 - fx; region = 2; }
  if (fy < best) { best = fy; region = 3; }
  if (1 - fy < best) region = 4;
  return region;
}

export type MagneticWindowPlan = {
  readonly primary: MagneticRect; readonly neighbor: MagneticRect; readonly kind: number;
};
export function magneticWindowPlan(
  s: MagneticRect, a: MagneticRect, b: MagneticRect, region: number, minW: number, minH: number,
): MagneticWindowPlan {
  if (region === 0) return { primary: b, neighbor: a, kind: 1 };
  const first = magneticZoneRect(b, region);
  if (first.w >= minW && first.h >= minH) {
    const opposite = region % 2 === 0 ? region - 1 : region + 1;
    return { primary: first, neighbor: magneticZoneRect(b, opposite), kind: 2 };
  }
  const gap = magneticGap();
  let x = b.x;
  let y = b.y;
  let w = b.w;
  let h = b.h;
  if (region === 1) { w = Math.min(a.w, b.x - gap - s.x); x = b.x - gap - w; }
  if (region === 2) { x = b.x + b.w + gap; w = Math.min(a.w, s.x + s.w - x); }
  if (region === 3) { h = Math.min(a.h, b.y - gap - s.y); y = b.y - gap - h; }
  if (region === 4) { y = b.y + b.h + gap; h = Math.min(a.h, s.y + s.h - y); }
  return { primary: { x: x, y: y, w: w, h: h }, neighbor: b, kind: w >= minW && h >= minH ? 3 : 0 };
}

export function magneticStrip(s: MagneticRect, index: number, count: number, horizontal: boolean): MagneticRect {
  const length = horizontal ? s.w : s.h;
  const gap = Math.min(magneticGap(), length / Math.max(2, 2 * count));
  const size = (length - gap * (count - 1)) / count;
  const at = index * (size + gap);
  if (horizontal) return cell(s, at, 0, size, s.h);
  return cell(s, 0, at, s.w, size);
}

// Presets 1..5 are focus, split, thirds, bento and cascade. 6..8 are the study's original layouts.
export function magneticPresetSlot(s: MagneticRect, preset: number, index: number, count: number): MagneticRect {
  if (count <= 1) return s;
  const left = magneticZoneRect(s, 1), right = magneticZoneRect(s, 2);
  if (preset === 1 || preset === 6) {
    const fraction = preset === 6 ? 0.60 : 2 / 3;
    const gap = Math.min(magneticGap(), s.w / 12);
    const master = (s.w - gap) * fraction;
    if (index === 0) return cell(s, 0, 0, master, s.h);
    return magneticStrip(cell(s, master + gap, 0, s.w - master - gap, s.h), index - 1, count - 1, false);
  }
  if (preset === 2) {
    const n = Math.ceil(count / 2);
    if (index < n) return magneticStrip(left, index, n, false);
    return magneticStrip(right, index - n, count - n, false);
  }
  if (preset === 3) {
    const n = Math.floor(count / 3);
    const col = index % 3;
    const r = magneticZoneRect(s, 9 + col);
    return magneticStrip(r, Math.floor(index / 3), n + (col < count % 3 ? 1 : 0), false);
  }
  if (preset === 5) {
    const offset = Math.min(42, Math.min(s.w, s.h) * 0.37 / (count - 1));
    return cell(s, index * offset, index * offset, s.w - offset * (count - 1), s.h - offset * (count - 1));
  }
  if (preset === 7) {
    const wing = count === 2 ? 0.38 : 0.25;
    const gap = Math.min(magneticGap(), s.w / 12);
    const w = s.w * wing;
    if (index === 1) return cell(s, 0, 0, w - gap / 2, s.h);
    if (index === 0) return cell(s, w + gap / 2, 0, s.w - w - (count === 2 ? gap / 2 : w + gap), s.h);
    return magneticStrip(cell(s, s.w - w + gap / 2, 0, w - gap / 2, s.h), index - 2, count - 2, false);
  }
  if (count === 2) return magneticZoneRect(s, 1 + index);
  if (count === 3) return magneticZoneRect(s, index === 2 ? 4 : 5 + index);
  const tile = index % 4;
  return magneticStrip(magneticZoneRect(s, 5 + tile), Math.floor(index / 4),
    Math.floor(count / 4) + (tile < count % 4 ? 1 : 0), count > 4 && s.w > s.h);
}

export function magneticRectDistance(a: MagneticRect, b: MagneticRect): number {
  return magneticLength(a.x + a.w / 2 - b.x - b.w / 2, a.y + a.h / 2 - b.y - b.h / 2);
}

export function magneticCascadeDelay(index: number, reduced: boolean): number {
  return reduced ? 0 : index * 45000;
}
