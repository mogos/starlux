import { zenithOptics } from "./catalog.ss.ts";
import { baseColor, baseLuminanceBound } from "./layers.ss.ts";
import { recipeWord } from "./recipe.ss.ts";
import { daylight } from "./solar.ss.ts";
import { BAD_INPUT, CONFIG, LIGHT_BRIDGE, mod, word, zeroWords } from "./types.ss.ts";

// Stage A: recipe, face, dimensions and solar bucket are the entire input.
export function exportZenith(w: number[], face: number, bucket: number, generation: number): void {
  const at = LIGHT_BRIDGE();
  zeroWords(w, at, at + 64);
  w[at] = 1;
  w[at + 2] = bucket;
  w[at + 3] = generation;
  if (word(w, CONFIG() + 40) === 0) return;
  w[at + 1] = 1;
  const emitter = at + 4;
  const index = mod(recipeWord(w, 123), 128);
  const rg = recipeWord(w, 121), ba = recipeWord(w, 122);
  const light = daylight(bucket);
  w[emitter] = 1;
  w[emitter + 1] = word(w, CONFIG() + 32) * (.15 + .70 * bucket / 15);
  w[emitter + 2] = word(w, CONFIG() + 33) * (.25 - .20 * light);
  w[emitter + 3] = 180;
  w[emitter + 4] = zenithOptics(index, 2);
  w[emitter + 5] = (.4 + .6 * light) * recipeWord(w, 10) / 65535;
  w[emitter + 6] = zenithOptics(index, 0);
  w[emitter + 7] = zenithOptics(index, 1);
  w[emitter + 8] = zenithOptics(index, 3);
  w[emitter + 9] = mod(rg, 65536) / 65535;
  w[emitter + 10] = Math.floor(rg / 65536) / 65535;
  w[emitter + 11] = mod(ba, 65536) / 65535;
  w[emitter + 12] = .14;
  w[emitter + 13] = 1;
  w[emitter + 14] = 1;
  w[emitter + 15] = 1;
  w[emitter + 18] = 1;
  w[emitter + 19] = Math.floor(ba / 65536) / 65535;
  // The flat record stores four RGB stops and eight row bounds. The bounds
  // expand losslessly to an 8x8 grid because stage A has no x-dependent terms.
  for (let stop = 0; stop < 4; stop++) {
    for (let c = 0; c < 3; c++) w[at + 24 + 3 * stop + c] = baseColor(w, face, bucket, stop / 3, c);
  }
  for (let row = 0; row < 8; row++) w[at + 36 + row] = baseLuminanceBound(w, face, bucket, row);
}

export function bindWallpaperZenith(w: readonly number[], light: number[]): number {
  if (light.length !== 106 || word(w, LIGHT_BRIDGE()) !== 1) return BAD_INPUT();
  const enabled = word(w, LIGHT_BRIDGE() + 1) === 1;
  for (let i = 0; i < 20; i++) light[46 + i] = enabled ? word(w, LIGHT_BRIDGE() + 4 + i) : 0;
  return 0;
}

export function writeWallpaperLuminanceGrid(w: readonly number[], grid: number[]): number {
  if (grid.length < 64 || word(w, LIGHT_BRIDGE()) !== 1) return BAD_INPUT();
  for (let i = 0; i < 64; i++) grid[i] = word(w, LIGHT_BRIDGE() + 36 + Math.floor(i / 8));
  return 0;
}
