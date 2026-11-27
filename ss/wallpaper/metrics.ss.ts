import { luminance, srgbLinear16 } from "./color.ss.ts";
import { integer, word } from "./types.ss.ts";

function log10(value: number): number {
  let x = value, exponent = 0;
  for (let i = 0; i < 64; i++) {
    if (x < 2) break;
    x *= .5;
    exponent++;
  }
  const z = (x - 1) / (x + 1);
  const square = z * z;
  let term = z, sum = z;
  for (let i = 1; i < 18; i++) {
    term *= square;
    sum += term / (2 * i + 1);
  }
  return (2 * sum + exponent * .6931471805599453) * .4342944819032518;
}

export function linearPsnr(reference: readonly number[], decoded: readonly number[]): number {
  if (reference.length !== decoded.length || reference.length === 0 || reference.length > 33177600
    || reference.length !== Math.floor(reference.length / 4) * 4) return -1;
  const pixels = reference.length / 4;
  let error = 0;
  for (let page = 0; page < 8; page++) {
    if (page * 1048576 >= pixels) break;
    for (let block = 0; block < 1024; block++) {
      if (page * 1048576 + block * 1024 >= pixels) break;
      for (let i = 0; i < 1024; i++) {
        const pixel = page * 1048576 + block * 1024 + i;
        if (pixel >= pixels) break;
        for (let lane = 0; lane < 3; lane++) {
          const at = pixel * 4 + lane;
          const delta = (srgbLinear16(word(reference, at)) - srgbLinear16(word(decoded, at))) / 65535;
          error += delta * delta;
        }
      }
    }
  }
  if (error === 0) return 1 / 0;
  return 10 * log10(pixels * 3 / error);
}

export function maxAbsoluteError(reference: readonly number[], decoded: readonly number[]): number {
  if (reference.length !== decoded.length || reference.length > 33177600) return -1;
  let max = 0;
  for (let page = 0; page < 8; page++) {
    if (page * 4194304 >= reference.length) break;
    for (let block = 0; block < 1024; block++) {
      if (page * 4194304 + block * 4096 >= reference.length) break;
      for (let i = 0; i < 1024; i++) {
        const at = page * 4194304 + block * 4096 + i * 4;
        for (let j = 0; j < 4; j++) {
          if (at + j >= reference.length) break;
          max = Math.max(max, Math.abs(word(reference, at + j) - word(decoded, at + j)));
        }
      }
    }
  }
  return max;
}

function gaussian(distance: number): number {
  const d = Math.abs(distance);
  if (d === 0) return .26601172486179436;
  if (d === 1) return .21300553771125366;
  if (d === 2) return .10936068950970002;
  if (d === 3) return .03600077212843082;
  if (d === 4) return .007598758135239185;
  return .00102838008447911;
}

function reflected(i: number, n: number): number {
  if (n === 1) return 0;
  const cycle = 2 * (n - 1);
  const folded = i - Math.floor(i / cycle) * cycle;
  return folded < n ? folded : cycle - folded;
}

function yLinear(rgba: readonly number[], at: number): number {
  return luminance(srgbLinear16(word(rgba, at)), srgbLinear16(word(rgba, at + 1)), srgbLinear16(word(rgba, at + 2))) / 65535;
}

export function linearSsim(reference: readonly number[], decoded: readonly number[], width: number, height: number): number {
  if (!integer(width, 1, 3840) || !integer(height, 1, 3840) || width * height > 8294400) return -1;
  const count = width * height;
  if (reference.length !== count * 4 || decoded.length !== count * 4) return -1;
  if (maxAbsoluteError(reference, decoded) === 0) return 1;
  let total = 0;
  for (let page = 0; page < 8; page++) {
    if (page * 1048576 >= count) break;
    for (let block = 0; block < 1024; block++) {
      if (page * 1048576 + block * 1024 >= count) break;
      for (let i = 0; i < 1024; i++) {
        const at = page * 1048576 + block * 1024 + i;
        if (at >= count) break;
        const cy = Math.floor(at / width), cx = at - cy * width;
        let a = 0, b = 0, aa = 0, bb = 0, ab = 0;
        for (let dy = 0; dy < 11; dy++) {
          const row = reflected(cy + dy - 5, height) * width;
          const gy = gaussian(dy - 5);
          for (let dx = 0; dx < 11; dx++) {
            const weight = gy * gaussian(dx - 5);
            const pixel = (row + reflected(cx + dx - 5, width)) * 4;
            const x = yLinear(reference, pixel), y = yLinear(decoded, pixel);
            a += weight * x; b += weight * y;
            aa += weight * x * x; bb += weight * y * y; ab += weight * x * y;
          }
        }
        total += (2 * a * b + .0001) * (2 * (ab - a * b) + .0009)
          / ((a * a + b * b + .0001) * (aa - a * a + bb - b * b + .0009));
      }
    }
  }
  return total / count;
}
