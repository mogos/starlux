import { clampLight, lightAt, sqrtLight } from "./optics.ss.ts";

// Writes near point, its opposite, tangent, scene-space footprint distance and local lamp.
export function projectLight(input: readonly number[], x: number, y: number, out: number[]): number {
  const w = lightAt(input, 3);
  const h = lightAt(input, 4);
  const r = clampLight(lightAt(input, 5), 0, w < h ? w / 2 : h / 2);
  const a = lightAt(input, 6);
  const b = lightAt(input, 7);
  const c = lightAt(input, 8);
  const d = lightAt(input, 9);
  const determinant = a * d - b * c;
  const dx = x - lightAt(input, 1);
  const dy = y - lightAt(input, 2);
  const px = (d * dx - c * dy) / determinant;
  const py = (a * dy - b * dx) / determinant;
  const qx = clampLight(px, r, w - r);
  const qy = clampLight(py, r, h - r);
  const ox = px - qx;
  const oy = py - qy;
  const distance = sqrtLight(ox * ox + oy * oy);
  let nx = 0;
  let ny = -1;
  let rx = px;
  let ry = 0;
  if (distance > 0) {
    nx = ox / distance;
    ny = oy / distance;
    rx = qx + nx * r;
    ry = qy + ny * r;
  } else {
    let gap = py;
    if (w - px < gap) {
      gap = w - px;
      rx = w; ry = py; nx = 1; ny = 0;
    }
    if (h - py < gap) {
      gap = h - py;
      rx = px; ry = h; nx = 0; ny = 1;
    }
    if (px < gap) {
      rx = 0; ry = py; nx = -1; ny = 0;
    }
  }
  let sceneDistance = 0;
  if (distance > r) {
    const sx = a * (px - rx) + c * (py - ry);
    const sy = b * (px - rx) + d * (py - ry);
    sceneDistance = sqrtLight(sx * sx + sy * sy);
  }
  out[0] = rx; out[1] = ry;
  out[2] = w - rx; out[3] = h - ry;
  out[4] = -ny; out[5] = nx;
  out[6] = sceneDistance; out[7] = px; out[8] = py;
  return 0;
}

export function innerBevelRadius(outer: number, padding: number): number {
  return outer > padding ? outer - padding : 0;
}
