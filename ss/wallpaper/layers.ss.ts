import { amberSurface, clamp, contrastRatio, gamutChannel, linearSrgb8, luminance, mix, q16, smooth, srgbLinear16 } from "./color.ss.ts";
import { paletteChannel, recipeWord } from "./recipe.ss.ts";
import { daylight } from "./solar.ss.ts";
import { BAD_INPUT, CONFIG, FRAME, INPUT, LAYERS, SHORT_OUTPUT, STATE, WORKSPACE_WORDS, integer, mod, word } from "./types.ss.ts";

export function baseColor(w: readonly number[], face: number, bucket: number, y: number, channel: number): number {
  const position = clamp(y, 0, 1) * 2;
  const first = position < 1 ? 0 : 1;
  const a = paletteChannel(w, face, first, channel);
  const b = paletteChannel(w, face, first + 1, channel);
  const exposure = face === 1 ? .97 + .03 * daylight(bucket) : .76 + .24 * daylight(bucket);
  return mix(a, b, smooth(position - first)) * exposure;
}

export function layerEnvelope(w: readonly number[], layer: number): number {
  return recipeWord(w, 19 + 12 * layer) / 65535;
}

export function baseLuminanceBound(w: readonly number[], face: number, bucket: number, row: number): number {
  const samples = row * .125;
  const last = (row + 1) * .125;
  const a = luminance(baseColor(w, face, bucket, samples, 0), baseColor(w, face, bucket, samples, 1), baseColor(w, face, bucket, samples, 2));
  const b = luminance(baseColor(w, face, bucket, last, 0), baseColor(w, face, bucket, last, 1), baseColor(w, face, bucket, last, 2));
  return face === 1 ? Math.min(a, b) : Math.max(a, b);
}

function blend(base: number, color: number, alpha: number, kind: number): number {
  if (kind === 1) return clamp(base + color * alpha, 0, 1);
  if (kind === 2) return base * mix(1, color, alpha);
  if (kind === 3) return 1 - (1 - base) * (1 - color * alpha);
  return mix(base, color, alpha);
}

function periodic(phase: number): number {
  return smooth(1 - Math.abs(2 * mod(phase, 1) - 1));
}

function colorAt(w: readonly number[], face: number, bucket: number, x: number, y: number, channel: number): number {
  const at = FRAME();
  const horizon = recipeWord(w, 12) / 65535;
  const transition = word(w, at + 14) / 65535;
  const yHorizon = y - word(w, at + 29) / (256 * word(w, CONFIG() + 33));
  let value = baseColor(w, face, bucket, y, channel);
  if (transition < 1) value = mix(baseColor(w, face, word(w, STATE() + 7), y, channel), value, transition);
  const glow = clamp(1 - (yHorizon - horizon) * (yHorizon - horizon) * 26, 0, 1);
  const tint = paletteChannel(w, face, 2, channel);
  const bias = face === 1 ? .46 : 1;
  const mode = word(w, at + 12);
  for (let layer = 1; layer < 5; layer++) {
    const opacity = word(w, at + 34 + layer) / 65535;
    if (opacity === 0) continue;
    let amount = 0;
    if (layer === 1) amount = glow * glow * .48;
    if (layer === 2) amount = glow * glow * word(w, at + 25) / 65535;
    if (layer === 3) {
      const xMid = x - word(w, at + 30) / (256 * word(w, CONFIG() + 32));
      const yMid = y - word(w, at + 31) / (256 * word(w, CONFIG() + 33));
      const stripes = periodic(xMid * (2 + mod(recipeWord(w, 13), 5)) + yMid * (3 + mod(recipeWord(w, 5), 4)));
      amount = stripes * stripes * .22;
    }
    if (layer === 4) {
      const xVeil = x - word(w, at + 32) / (256 * word(w, CONFIG() + 32));
      const yVeil = y - word(w, at + 33) / (256 * word(w, CONFIG() + 33));
      amount = periodic(xVeil * 4 + yVeil * 7 + word(w, at + 17) / 65535) * .12;
    }
    value = blend(value, tint, opacity * amount * bias * (mode === 2 ? .12 : 1), recipeWord(w, 18 + layer * 12));
  }
  // Pool descriptors originate at the sensor. Stage A never calls this path.
  if (word(w, STATE() + 33) !== 0) return value;
  const px = x * word(w, CONFIG() + 32), py = y * word(w, CONFIG() + 33);
  const pointer = word(w, INPUT() + 26) === 1 && word(w, INPUT() + 27) === 1
    && (word(w, INPUT() + 28) !== 0 || word(w, INPUT() + 29) !== 0 || word(w, STATE() + 25) === 1);
  if (pointer && mod(word(w, CONFIG() + 41), 2) === 1) {
    const dx = px - word(w, INPUT() + 28), dy = py - word(w, INPUT() + 29);
    value = blend(value, tint, .06 * word(w, INPUT() + 30) / (1 + (dx * dx + dy * dy) / 6400), 1);
  }
  if (word(w, INPUT() + 31) === 1 && word(w, CONFIG() + 41) >= 2) {
    const dx = px - word(w, INPUT() + 32), dy = py - word(w, INPUT() + 33);
    value = blend(value, word(w, INPUT() + 35 + channel), .04 * word(w, INPUT() + 34) / (1 + (dx * dx + dy * dy) / 8100), 1);
  }
  return value;
}

function protectedInk(w: readonly number[], x: number, y: number): number {
  const px = x * word(w, CONFIG() + 32), py = y * word(w, CONFIG() + 33);
  const count = word(w, INPUT() + 39);
  for (let i = 0; i < 8; i++) {
    if (i >= count) break;
    const p = LAYERS() + 8 * i;
    const left = word(w, p), top = word(w, p + 1);
    if (px >= left && py >= top && px < left + word(w, p + 2) && py < top + word(w, p + 3)) return word(w, p + 4);
  }
  return -1;
}

function scrimLuminance(dark: boolean): number {
  if (dark) return luminance(srgbLinear16(28), srgbLinear16(22), srgbLinear16(19)) / 65535;
  return luminance(srgbLinear16(255), srgbLinear16(253), srgbLinear16(249)) / 65535;
}

function darkBacking(ink: number): boolean {
  return ink >= .5 || (scrimLuminance(false) + .05) / (ink + .05) < 4.5;
}

function scrimTarget(ink: number, ratio: number, dark: boolean): number {
  const limit = dark ? (ink + .05) / .05 : 1.05 / (ink + .05);
  return Math.min(ratio, limit);
}

function scrimBackingY(ink: number, ratio: number, dark: boolean): number {
  const preferred = scrimLuminance(dark);
  if (dark && (ink + .05) / (preferred + .05) < ratio) return 0;
  if (!dark && (preferred + .05) / (ink + .05) < ratio) return 1;
  return preferred;
}

export function scrimOpacity(ink: number, r: number, g: number, b: number, ratio: number): number {
  const foreground = clamp(ink, 0, 1);
  const background = luminance(r, g, b);
  const dark = darkBacking(foreground);
  const target = scrimTarget(foreground, ratio, dark);
  const backing = scrimBackingY(foreground, target, dark);
  let opacity = 0;
  if (dark) {
    const ceiling = (foreground + .05) / target - .05;
    if (background > ceiling) opacity = clamp((background - ceiling) / Math.max(1e-9, background - backing), 0, 1);
  } else {
    const floor = target * (foreground + .05) - .05;
    if (background < floor) opacity = clamp((floor - background) / Math.max(1e-9, backing - background), 0, 1);
  }
  if (foreground < .5) {
    if (amberSurface(linearSrgb8(r * 65535) / 255, linearSrgb8(g * 65535) / 255, linearSrgb8(b * 65535) / 255)) opacity = 1;
  }
  return opacity;
}

export function wallpaperPixel(
  w: readonly number[], x: number, y: number, channel: number, protect: boolean,
): number {
  const at = FRAME();
  const face = word(w, at + 46), bucket = word(w, at + 15);
  let sx = x, sy = y;
  if (word(w, CONFIG() + 27) === 1) {
    sx = (word(w, CONFIG() + 28) + x * word(w, CONFIG() + 32)) / word(w, CONFIG() + 30);
    sy = (word(w, CONFIG() + 29) + y * word(w, CONFIG() + 33)) / word(w, CONFIG() + 31);
  } else if (word(w, CONFIG() + 27) === 2) {
    sx = mod(x * word(w, CONFIG() + 32) / word(w, CONFIG() + 30), 1);
    sy = mod(y * word(w, CONFIG() + 33) / word(w, CONFIG() + 31), 1);
  }
  let r = colorAt(w, face, bucket, sx, sy, 0);
  let g = colorAt(w, face, bucket, sx, sy, 1);
  let b = colorAt(w, face, bucket, sx, sy, 2);
  if (channel === 3) {
    const luma = luminance(r, g, b);
    const threshold = word(w, at + 24) / 65535;
    if (luma < word(w, at + 27) / 65535 || luma <= threshold) return 0;
    return roundMask(luma, threshold);
  }
  if (protect) {
    const ink = protectedInk(w, x, y);
    if (ink >= 0) {
      const ratio = Math.max(4.5, word(w, CONFIG() + 14));
      const opacity = scrimOpacity(ink, r, g, b, ratio);
      const dark = darkBacking(ink), backing = scrimBackingY(ink, scrimTarget(ink, ratio, dark), dark);
      // Round up partially transparent scrims to account for RGB8 rounding.
      let safe = opacity > word(w, CONFIG() + 15) ? 1 : clamp(opacity + (opacity > 0 ? .012 : 0), 0, 1);
      if (word(w, CONFIG() + 13) === 2) safe = Math.max(.28, safe);
      let br = backing, bg = backing, bb = backing;
      if (backing !== 0 && backing !== 1) {
        br = srgbLinear16(dark ? 28 : 255) / 65535;
        bg = srgbLinear16(dark ? 22 : 253) / 65535;
        bb = srgbLinear16(dark ? 19 : 249) / 65535;
      }
      r = mix(r, br, safe); g = mix(g, bg, safe); b = mix(b, bb, safe);
      const qr = linearSrgb8(q16(r)), qg = linearSrgb8(q16(g)), qb = linearSrgb8(q16(b));
      const outputY = luminance(srgbLinear16(qr), srgbLinear16(qg), srgbLinear16(qb)) / 65535;
      // Test the quantized output and widen the backing if an RGB8 step
      // crosses the contrast floor.
      if (contrastRatio(ink, outputY) < 4.5) { r = br; g = bg; b = bb; }
    }
  }
  return linearSrgb8(q16(gamutChannel(r, g, b, channel, word(w, at + 47))));
}

function roundMask(luma: number, threshold: number): number {
  return Math.floor(clamp((luma - threshold) / (1 - threshold), 0, 1) * 255 + .5);
}

export function renderWallpaperRows(
  w: readonly number[], y0: number, rows: number, width: number, height: number, rgba: number[],
): number {
  if (w.length !== WORKSPACE_WORDS() || !integer(width, 1, 32768) || !integer(height, 1, 32768)
    || !integer(y0, 0, height - 1) || !integer(rows, 1, height - y0)
    || rows * width > 1048576 || word(w, FRAME()) !== 1) return BAD_INPUT();
  const count = width * rows;
  if (rgba.length < count * 4) return SHORT_OUTPUT();
  for (let block = 0; block < 1024; block++) {
    if (block * 1024 >= count) break;
    for (let i = 0; i < 1024; i++) {
      const at = block * 1024 + i;
      if (at >= count) break;
      const x = (mod(at, width) + .5) / width;
      const y = (Math.floor(at / width) + y0 + .5) / height;
      for (let c = 0; c < 4; c++) rgba[at * 4 + c] = wallpaperPixel(w, x, y, c, true);
    }
  }
  return count * 4;
}

export function renderWallpaperSpan(
  w: readonly number[], x: number, y: number, count: number, width: number, height: number, rgba: number[],
): number {
  if (w.length !== WORKSPACE_WORDS() || !integer(width, 1, 32768) || !integer(height, 1, 32768)
    || !integer(y, 0, height - 1) || !integer(x, 0, width - 1)
    || !integer(count, 1, Math.min(width - x, 1024)) || word(w, FRAME()) !== 1) return BAD_INPUT();
  if (rgba.length < count * 4) return SHORT_OUTPUT();
  for (let i = 0; i < 1024; i++) {
    if (i >= count) break;
    for (let c = 0; c < 4; c++) rgba[i * 4 + c] = wallpaperPixel(w, (x + i + .5) / width, (y + .5) / height, c, true);
  }
  return count * 4;
}
