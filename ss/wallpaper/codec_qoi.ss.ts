import { readBE, writeBE } from "./recipe.ss.ts";
import { BAD_INPUT, SHORT_OUTPUT, integer, mod, word } from "./types.ss.ts";

export function pixelCount(width: number, height: number): number {
  if (!integer(width, 1, 16384) || !integer(height, 1, 16384) || width * height > 1048576) return 0;
  return width * height;
}

function pixel(r: number, g: number, b: number, a: number): number {
  return ((r * 256 + g) * 256 + b) * 256 + a;
}

function component(value: number, channel: number): number {
  if (channel === 0) return Math.floor(value / 16777216);
  if (channel === 1) return mod(Math.floor(value / 65536), 256);
  if (channel === 2) return mod(Math.floor(value / 256), 256);
  return mod(value, 256);
}

function hash(value: number): number {
  return mod(3 * component(value, 0) + 5 * component(value, 1) + 7 * component(value, 2) + 11 * component(value, 3), 64);
}

function delta(a: number, b: number): number { return mod(a - b + 128, 256) - 128; }

function encodeOps(
  rgba: readonly number[], count: number, out: number[], cache: number[], write: boolean,
): number {
  for (let i = 0; i < 64; i++) cache[i] = 0;
  let previous = 255;
  let run = 0;
  let cursor = 14;
  for (let block = 0; block < 1024; block++) {
    if (block * 1024 >= count) break;
    for (let step = 0; step < 1024; step++) {
      const i = block * 1024 + step;
      if (i >= count) break;
      const at = i * 4;
      const r = word(rgba, at), g = word(rgba, at + 1), b = word(rgba, at + 2), a = word(rgba, at + 3);
      if (!integer(r, 0, 255) || !integer(g, 0, 255) || !integer(b, 0, 255) || !integer(a, 0, 255)) return BAD_INPUT();
      const next = pixel(r, g, b, a);
      if (next === previous) {
        run++;
        if (run === 62 || i === count - 1) {
          if (write) out[cursor] = 191 + run;
          cursor++;
          run = 0;
        }
        continue;
      }
      if (run > 0) {
        if (write) out[cursor] = 191 + run;
        cursor++;
        run = 0;
      }
      const index = hash(next);
      if (word(cache, index) === next) {
        if (write) out[cursor] = index;
        cursor++;
      } else {
        cache[index] = next;
        if (a === component(previous, 3)) {
          const dr = delta(r, component(previous, 0));
          const dg = delta(g, component(previous, 1));
          const db = delta(b, component(previous, 2));
          const rg = dr - dg, bg = db - dg;
          if (dr >= -2 && dr <= 1 && dg >= -2 && dg <= 1 && db >= -2 && db <= 1) {
            if (write) out[cursor] = 64 + (dr + 2) * 16 + (dg + 2) * 4 + db + 2;
            cursor++;
          } else if (dg >= -32 && dg <= 31 && rg >= -8 && rg <= 7 && bg >= -8 && bg <= 7) {
            if (write) {
              out[cursor] = 160 + dg;
              out[cursor + 1] = (rg + 8) * 16 + bg + 8;
            }
            cursor += 2;
          } else {
            if (write) {
              out[cursor] = 254;
              out[cursor + 1] = r; out[cursor + 2] = g; out[cursor + 3] = b;
            }
            cursor += 4;
          }
        } else {
          if (write) {
            out[cursor] = 255;
            out[cursor + 1] = r; out[cursor + 2] = g; out[cursor + 3] = b; out[cursor + 4] = a;
          }
          cursor += 5;
        }
      }
      previous = next;
    }
  }
  return cursor;
}

export function qoiEncode(rgba: readonly number[], width: number, height: number, out: number[], cache: number[]): number {
  const count = pixelCount(width, height);
  if (count === 0 || rgba.length !== count * 4 || cache.length < 64) return BAD_INPUT();
  const size = encodeOps(rgba, count, out, cache, false);
  if (size < 0) return size;
  if (out.length < size + 8) return SHORT_OUTPUT();
  writeBE(out, 0, 1903126886);
  writeBE(out, 4, width);
  writeBE(out, 8, height);
  out[12] = 4;
  out[13] = 0;
  encodeOps(rgba, count, out, cache, true);
  for (let i = 0; i < 8; i++) out[size + i] = i === 7 ? 1 : 0;
  return size + 8;
}

function decodeOps(bytes: readonly number[], count: number, out: number[], cache: number[], write: boolean): boolean {
  for (let i = 0; i < 64; i++) cache[i] = 0;
  let cursor = 14;
  const stop = bytes.length - 8;
  let previous = 255;
  let run = 0;
  for (let block = 0; block < 1024; block++) {
    if (block * 1024 >= count) break;
    for (let step = 0; step < 1024; step++) {
      const i = block * 1024 + step;
      if (i >= count) break;
      if (run > 0) run--;
      else {
        if (cursor >= stop) return false;
        const op = word(bytes, cursor);
        if (!integer(op, 0, 255)) return false;
        cursor++;
        let r = component(previous, 0), g = component(previous, 1);
        let b = component(previous, 2), a = component(previous, 3);
        if (op >= 254) {
          if (cursor + op - 251 > stop) return false;
          r = word(bytes, cursor); g = word(bytes, cursor + 1); b = word(bytes, cursor + 2);
          cursor += 3;
          if (op === 255) {
            a = word(bytes, cursor);
            cursor++;
          }
          if (!integer(r, 0, 255) || !integer(g, 0, 255) || !integer(b, 0, 255) || !integer(a, 0, 255)) return false;
          previous = pixel(r, g, b, a);
        } else if (op >= 192) {
          run = op - 192;
          if (run >= count - i) return false;
        } else if (op >= 128) {
          if (cursor >= stop) return false;
          const extra = word(bytes, cursor);
          if (!integer(extra, 0, 255)) return false;
          cursor++;
          const dg = op - 160;
          r = mod(r + dg + Math.floor(extra / 16) - 8, 256);
          g = mod(g + dg, 256);
          b = mod(b + dg + mod(extra, 16) - 8, 256);
          previous = pixel(r, g, b, a);
        } else if (op >= 64) {
          r = mod(r + mod(Math.floor(op / 16), 4) - 2, 256);
          g = mod(g + mod(Math.floor(op / 4), 4) - 2, 256);
          b = mod(b + mod(op, 4) - 2, 256);
          previous = pixel(r, g, b, a);
        } else previous = word(cache, op);
        cache[hash(previous)] = previous;
      }
      if (write) writeBE(out, i * 4, previous);
    }
  }
  return cursor === stop;
}

export function qoiDecode(bytes: readonly number[], out: number[], cache: number[]): number {
  if (bytes.length < 23 || readBE(bytes, 0) !== 1903126886 || word(bytes, 12) !== 4
    || word(bytes, 13) !== 0 || cache.length < 64) return BAD_INPUT();
  const count = pixelCount(readBE(bytes, 4), readBE(bytes, 8));
  if (count === 0 || bytes.length > 22 + count * 5) return BAD_INPUT();
  for (let i = 0; i < 8; i++) if (word(bytes, bytes.length - 8 + i) !== (i === 7 ? 1 : 0)) return BAD_INPUT();
  if (out.length < count * 4) return SHORT_OUTPUT();
  if (!decodeOps(bytes, count, out, cache, false)) return BAD_INPUT();
  decodeOps(bytes, count, out, cache, true);
  return count * 4;
}
