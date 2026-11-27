import { pixelCount } from "./codec_qoi.ss.ts";
import { crc32, readBE, readLE, writeBE, writeLE } from "./recipe.ss.ts";
import { BAD_INPUT, SHORT_OUTPUT, ceilInt, integer, mod, word } from "./types.ss.ts";

// SLPNG1 uses exactly IHDR, IDAT and IEND, Sub filters and 65535-byte stored blocks.
function rawSize(width: number, height: number): number {
  const size = (4 * width + 1) * height;
  if (pixelCount(width, height) === 0 || size > 1048000) return 0;
  return size;
}

export function pngCapacity(width: number, height: number): number {
  const raw = rawSize(width, height);
  if (raw === 0) return 0;
  return 63 + raw + 5 * ceilInt(raw / 65535);
}

function endChunk(out: number[], start: number, count: number): void {
  writeBE(out, start + 8 + count, crc32(out, start + 4, count + 4));
}

export function pngEncode(rgba: readonly number[], width: number, height: number, out: number[]): number {
  const size = pngCapacity(width, height);
  if (size === 0 || rgba.length !== width * height * 4) return BAD_INPUT();
  if (out.length < size) return SHORT_OUTPUT();
  for (let chunk = 0; chunk < 1024; chunk++) {
    if (chunk * 1024 >= rgba.length) break;
    for (let i = 0; i < 1024; i++) {
      const index = chunk * 1024 + i;
      if (index >= rgba.length) break;
      if (!integer(word(rgba, index), 0, 255)) return BAD_INPUT();
    }
  }
  writeBE(out, 0, 2303741511); writeBE(out, 4, 218765834);
  writeBE(out, 8, 13); writeBE(out, 12, 1229472850);
  writeBE(out, 16, width); writeBE(out, 20, height);
  out[24] = 8; out[25] = 6; out[26] = 0; out[27] = 0; out[28] = 0;
  endChunk(out, 8, 13);
  const dataLength = size - 57;
  writeBE(out, 33, dataLength); writeBE(out, 37, 1229209940);
  out[41] = 120; out[42] = 1;
  const raw = rawSize(width, height);
  const stride = 4 * width + 1;
  let s1 = 1, s2 = 0, cursor = 43;
  for (let chunk = 0; chunk < 1024; chunk++) {
    if (chunk * 1024 >= raw) break;
    for (let i = 0; i < 1024; i++) {
      const index = chunk * 1024 + i;
      if (index >= raw) break;
      if (mod(index, 65535) === 0) {
        const count = Math.min(65535, raw - index);
        out[cursor] = index + count === raw ? 1 : 0;
        writeLE(out, cursor + 1, 2, count);
        writeLE(out, cursor + 3, 2, 65535 - count);
        cursor += 5;
      }
      const x = mod(index, stride);
      const src = index - Math.floor(index / stride) - 1;
      let value = 1;
      if (x > 0) value = mod(word(rgba, src) - (x > 4 ? word(rgba, src - 4) : 0), 256);
      out[cursor] = value;
      cursor++;
      s1 = mod(s1 + value, 65521);
      s2 = mod(s2 + s1, 65521);
    }
  }
  writeBE(out, cursor, s2 * 65536 + s1);
  endChunk(out, 33, dataLength);
  writeBE(out, size - 12, 0); writeBE(out, size - 8, 1229278788);
  endChunk(out, size - 12, 0);
  return size;
}

function pngRows(bytes: readonly number[], out: number[], raw: number, stride: number, write: boolean): boolean {
  let cursor = 43, s1 = 1, s2 = 0;
  for (let chunk = 0; chunk < 1024; chunk++) {
    if (chunk * 1024 >= raw) break;
    for (let i = 0; i < 1024; i++) {
      const index = chunk * 1024 + i;
      if (index >= raw) break;
      if (mod(index, 65535) === 0) {
        const count = Math.min(65535, raw - index);
        if (word(bytes, cursor) !== (index + count === raw ? 1 : 0)
          || readLE(bytes, cursor + 1, 2) !== count || readLE(bytes, cursor + 3, 2) !== 65535 - count) return false;
        cursor += 5;
      }
      const x = mod(index, stride);
      const value = word(bytes, cursor);
      cursor++;
      if (x === 0 && value !== 1) return false;
      if (!integer(value, 0, 255)) return false;
      if (write && x > 0) {
        const dst = index - Math.floor(index / stride) - 1;
        out[dst] = mod(value + (x > 4 ? word(out, dst - 4) : 0), 256);
      }
      s1 = mod(s1 + value, 65521);
      s2 = mod(s2 + s1, 65521);
    }
  }
  return readBE(bytes, cursor) === s2 * 65536 + s1;
}

export function pngDecode(bytes: readonly number[], out: number[]): number {
  if (bytes.length < 73 || readBE(bytes, 0) !== 2303741511 || readBE(bytes, 4) !== 218765834) return BAD_INPUT();
  const w = readBE(bytes, 16), h = readBE(bytes, 20);
  const size = pngCapacity(w, h);
  if (size === 0 || bytes.length !== size || readBE(bytes, 8) !== 13 || readBE(bytes, 12) !== 1229472850
    || word(bytes, 24) !== 8 || word(bytes, 25) !== 6 || readLE(bytes, 26, 3) !== 0
    || readBE(bytes, 29) !== crc32(bytes, 12, 17)
    || readBE(bytes, 33) !== size - 57 || readBE(bytes, 37) !== 1229209940
    || word(bytes, 41) !== 120 || word(bytes, 42) !== 1
    || readBE(bytes, size - 16) !== crc32(bytes, 37, size - 53)
    || readBE(bytes, size - 12) !== 0 || readBE(bytes, size - 8) !== 1229278788
    || readBE(bytes, size - 4) !== 2923585666) return BAD_INPUT();
  const stride = 4 * w + 1;
  if (out.length < w * h * 4) return SHORT_OUTPUT();
  if (!pngRows(bytes, out, stride * h, stride, false)) return BAD_INPUT();
  pngRows(bytes, out, stride * h, stride, true);
  return w * h * 4;
}
