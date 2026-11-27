import { clamp, roundEven } from "./color.ss.ts";
import { BAD_INPUT, SHORT_OUTPUT, ceilInt, integer, mod, word } from "./types.ss.ts";

export function quantizeShape(value: number, lod: number): number {
  const max = lod === 0 ? 31 : lod === 1 ? 63 : 127;
  return roundEven(roundEven(clamp(value, 0, 65535) * max / 65535) * 65535 / max);
}

function residualStep(lod: number): number { return lod === 0 ? 8 : lod === 1 ? 4 : 2; }

// Input tiles include one east/south halo pixel. RGB values are encoded 10-bit.
export function encodeResidual(
  master: readonly number[], predictor: readonly number[], width: number, height: number, lod: number, bytes: number[],
): number {
  if (!integer(width, 1, 1920) || !integer(height, 1, 1080) || !integer(lod, 0, 2)) return BAD_INPUT();
  const length = (width + 1) * (height + 1) * 3;
  if (master.length !== length || predictor.length !== length) return BAD_INPUT();
  if (bytes.length < 251) return SHORT_OUTPUT();
  bytes[0] = 83; bytes[1] = 87; bytes[2] = 82; bytes[3] = 81;
  const step = residualStep(lod);
  bytes[4] = 1; bytes[5] = lod === 0 ? 32 : lod === 1 ? 64 : 128; bytes[6] = step; bytes[7] = 3;
  for (let y = 0; y < 9; y++) {
    const row = roundEven(y * height / 8) * (width + 1);
    for (let x = 0; x < 9; x++) {
      const index = (row + roundEven(x * width / 8)) * 3;
      for (let c = 0; c < 3; c++) {
        const q = clamp(roundEven((word(master, index + c) - word(predictor, index + c)) / step), -127, 127);
        bytes[8 + (y * 9 + x) * 3 + c] = mod(q, 256);
      }
    }
  }
  return 251;
}

export function validResidual(bytes: readonly number[], lod: number): boolean {
  if (!integer(lod, 0, 2) || bytes.length !== 251 || word(bytes, 0) !== 83 || word(bytes, 1) !== 87
    || word(bytes, 2) !== 82 || word(bytes, 3) !== 81 || word(bytes, 4) !== 1
    || word(bytes, 5) !== (lod === 0 ? 32 : lod === 1 ? 64 : 128)
    || word(bytes, 6) !== residualStep(lod) || word(bytes, 7) !== 3) return false;
  for (let i = 8; i < 251; i++) if (!integer(word(bytes, i), 0, 255) || word(bytes, i) === 128) return false;
  return true;
}

function signedNode(bytes: readonly number[], i: number): number {
  const node = word(bytes, i);
  return node > 127 ? node - 256 : node;
}

export function reconstructResidual(
  bytes: readonly number[], predictor: number, x: number, y: number, width: number, height: number, channel: number,
): number {
  const gx = x * 8 / width, gy = y * 8 / height;
  const ix = Math.floor(gx), iy = Math.floor(gy);
  const at = 8 + (iy * 9 + ix) * 3 + channel;
  const step = word(bytes, 6);
  const xa = signedNode(bytes, at) * step, xb = signedNode(bytes, at + 3) * step;
  const ya = signedNode(bytes, at + 27) * step, yb = signedNode(bytes, at + 30) * step;
  const a = xa + roundEven((xb - xa) * (gx - ix));
  const b = ya + roundEven((yb - ya) * (gx - ix));
  return clamp(predictor + a + roundEven((b - a) * (gy - iy)), 0, 1023);
}

export function deltaR8(target: number, anchor: number): number {
  return 128 + clamp(roundEven((target - anchor) / 2), -127, 127);
}

export function reconstructR8(delta: number, anchor: number): number {
  return clamp(anchor + 2 * (delta - 128), 0, 255);
}

export function temporalPhase(elapsedUs: number): number {
  return Math.floor(mod(elapsedUs, 6000000) * 65536 / 6000000);
}

export function temporalKnot(phase: number): number {
  return Math.floor(phase * 6 / 65536) * 15;
}

function lerpInt(a: number, b: number, fraction: number, divisor: number): number {
  return a + roundEven((b - a) * fraction / divisor);
}

function maskValue(left: readonly number[], right: readonly number[], index: number, t: number): number {
  return lerpInt(word(left, index), word(right, index), t, 65535);
}

export function sampleTemporalMask(
  left: readonly number[], right: readonly number[], phase: number, x: number, y: number, width: number, height: number,
): number {
  if (!integer(phase, 0, 65535) || !integer(width, 1, 1920) || !integer(height, 1, 1080)
    || !integer(x, 0, width - 1) || !integer(y, 0, height - 1)) return BAD_INPUT();
  const mw = ceilInt(width / 4), mh = ceilInt(height / 4);
  if (left.length !== mw * mh || right.length !== mw * mh) return BAD_INPUT();
  const t = roundEven(mod(phase * 6, 65536) * 65535 / 65536);
  const dx = roundEven((2 * (65535 - Math.abs(2 * phase - 65535)) - 65535) * 512 / 65535);
  const u = clamp(roundEven((2 * x + 1) * mw * 128 / width) - 128 + dx, 0, (mw - 1) * 256);
  const v = clamp(roundEven((2 * y + 1) * mh * 128 / height) - 128, 0, (mh - 1) * 256);
  const ix = Math.floor(u / 256), iy = Math.floor(v / 256);
  const nx = Math.min(ix + 1, mw - 1), ny = Math.min(iy + 1, mh - 1);
  const a = lerpInt(maskValue(left, right, iy * mw + ix, t), maskValue(left, right, iy * mw + nx, t), mod(u, 256), 256);
  const b = lerpInt(maskValue(left, right, ny * mw + ix, t), maskValue(left, right, ny * mw + nx, t), mod(u, 256), 256);
  return lerpInt(a, b, mod(v, 256), 256);
}

export function vp8Rgb(y: number, cb: number, cr: number, channel: number): number {
  const luma = 298 * (y - 16), u = cb - 128, v = cr - 128;
  const n = channel === 0 ? luma + 409 * v : channel === 1 ? luma - 100 * u - 208 * v : luma + 516 * u;
  return clamp(roundEven(n / 256), 0, 255);
}

export function packRgb10(r: number, g: number, b: number): number {
  return r + 1024 * g + 1048576 * b + 3221225472;
}
