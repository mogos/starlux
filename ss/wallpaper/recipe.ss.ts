import { BAD_ARGUMENT, BAD_INPUT, RECIPE, SHORT_OUTPUT, UNSUPPORTED_SCHEMA, WORKSPACE_WORDS, integer, mod, word } from "./types.ss.ts";

export function readLE(bytes: readonly number[], offset: number, count: number): number {
  let value = 0;
  for (let i = 0; i < 4; i++) {
    if (i >= count) break;
    const index = offset + count - i - 1;
    value = value * 256 + word(bytes, index);
  }
  return value;
}

export function writeLE(bytes: number[], offset: number, count: number, value: number): void {
  let next = value;
  for (let i = 0; i < 4; i++) {
    if (i >= count) break;
    bytes[offset + i] = mod(next, 256);
    next = Math.floor(next / 256);
  }
}

export function readBE(bytes: readonly number[], offset: number): number {
  return ((word(bytes, offset) * 256 + word(bytes, offset + 1)) * 256 + word(bytes, offset + 2)) * 256 + word(bytes, offset + 3);
}

export function writeBE(bytes: number[], offset: number, value: number): void {
  let next = value;
  for (let i = 0; i < 4; i++) {
    bytes[offset + 3 - i] = mod(next, 256);
    next = Math.floor(next / 256);
  }
}

export function crcByte(crc: number, byte: number): number {
  let next = (crc ^ byte) >>> 0;
  for (let i = 0; i < 8; i++) {
    if (mod(next, 2) === 1) next = ((next >>> 1) ^ 3988292384) >>> 0;
    else next = next >>> 1;
  }
  return next;
}

export function crc32(bytes: readonly number[], start: number, count: number): number {
  let crc = 4294967295;
  for (let block = 0; block < 1024; block++) {
    if (block * 1024 >= count) break;
    for (let i = 0; i < 1024; i++) {
      const at = block * 1024 + i;
      if (at >= count) break;
      crc = crcByte(crc, word(bytes, start + at));
    }
  }
  return 4294967295 - crc;
}

export function recipeWord(workspace: readonly number[], wireWord: number): number {
  return word(workspace, RECIPE() + wireWord - 4);
}

export function setRecipeWord(workspace: number[], wireWord: number, value: number): void {
  workspace[RECIPE() + wireWord - 4] = value;
}

function recordWord(source: readonly number[], index: number, wire: boolean): number {
  if (wire) return readLE(source, index * 4, 4);
  return recipeWord(source, index);
}

export function validRecipe(source: readonly number[], wire: boolean): boolean {
  if (!integer(recordWord(source, 4, wire), 0, 200)
    || !integer(recordWord(source, 5, wire), 0, 9)
    || !integer(recordWord(source, 7, wire), 0, 3)
    || !integer(recordWord(source, 8, wire), 0, 6)
    || !integer(recordWord(source, 9, wire), 1, 63)
    || !integer(recordWord(source, 13, wire), 0, 19)
    || !integer(recordWord(source, 123, wire), 0, 1572863)) return false;
  const binding = recordWord(source, 123, wire);
  const accent = mod(Math.floor(binding / 4096), 128);
  const slot = Math.floor(binding / 524288);
  if (mod(Math.floor(binding / 1024), 4) === 3 || accent > 120 || (slot === 0) !== (accent === 0)) return false;
  for (let i = 4; i < 124; i++) {
    const value = recordWord(source, i, wire);
    if (!integer(value, 0, 4294967295)) return false;
    if (i >= 10 && i <= 15 && i !== 13 && value > 65535) return false;
  }
  const mask = recordWord(source, 9, wire);
  let bit = 1;
  for (let layer = 0; layer < 6; layer++) {
    const start = 16 + 12 * layer;
    const enabled = mod(Math.floor(mask / bit), 2);
    if (recordWord(source, start + 1, wire) !== enabled) return false;
    for (let j = 0; j < 12; j++) {
      const v = recordWord(source, start + j, wire);
      if (enabled === 0 && v !== 0) return false;
      if (enabled === 1 && v > 65535) return false;
    }
    if (enabled === 1 && (recordWord(source, start, wire) !== layer
      || recordWord(source, start + 2, wire) > 3 || recordWord(source, start + 9, wire) > 7
      || recordWord(source, start + 10, wire) > 7)) return false;
    bit *= 2;
  }
  return mod(mask, 2) === 1;
}

export function encodeRecipe(workspace: readonly number[], bytes: number[]): number {
  if (workspace.length !== WORKSPACE_WORDS()) return BAD_ARGUMENT();
  if (bytes.length < 512) return SHORT_OUTPUT();
  if (!validRecipe(workspace, false)) return BAD_INPUT();
  writeLE(bytes, 0, 4, 1347898451);
  writeLE(bytes, 4, 4, 65536);
  writeLE(bytes, 8, 4, 5);
  writeLE(bytes, 12, 4, 512);
  for (let i = 4; i < 124; i++) writeLE(bytes, i * 4, 4, recipeWord(workspace, i));
  for (let i = 124; i < 127; i++) writeLE(bytes, i * 4, 4, 0);
  writeLE(bytes, 508, 4, crc32(bytes, 0, 508));
  return 512;
}

export function decodeRecipe(bytes: readonly number[], workspace: number[]): number {
  if (workspace.length !== WORKSPACE_WORDS()) return BAD_ARGUMENT();
  if (bytes.length !== 512) return BAD_INPUT();
  for (let i = 0; i < 512; i++) if (!integer(word(bytes, i), 0, 255) || bytes[i] === undefined) return BAD_INPUT();
  if (readLE(bytes, 0, 4) !== 1347898451 || readLE(bytes, 8, 4) !== 5 || readLE(bytes, 12, 4) !== 512) return BAD_INPUT();
  if (readLE(bytes, 4, 4) !== 65536) return UNSUPPORTED_SCHEMA();
  if (readLE(bytes, 508, 4) !== crc32(bytes, 0, 508)) return BAD_INPUT();
  for (let i = 124; i < 127; i++) if (readLE(bytes, i * 4, 4) !== 0) return BAD_INPUT();
  if (!validRecipe(bytes, true)) return BAD_INPUT();
  for (let i = 4; i < 124; i++) setRecipeWord(workspace, i, readLE(bytes, i * 4, 4));
  return 0;
}

export function paletteChannel(workspace: readonly number[], face: number, anchor: number, channel: number): number {
  const index = face * 9 + anchor * 3 + channel;
  const packed = recipeWord(workspace, 112 + Math.floor(index / 2));
  if (mod(index, 2) === 0) return mod(packed, 65536) / 65535;
  return Math.floor(packed / 65536) / 65535;
}

export function recipePolarity(workspace: readonly number[]): number {
  return mod(Math.floor(recipeWord(workspace, 123) / 1024), 4);
}

export function recipeAccentSlot(workspace: readonly number[]): number {
  return Math.floor(recipeWord(workspace, 123) / 524288);
}
