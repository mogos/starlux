// Flat workspace. Offsets are in binary64 words.
export function STARLUX_WALLPAPER_V1_SCHEMA(): number { return 1; }
export function CONFIG(): number { return 0; }
export function STATE(): number { return 48; }
export function INPUT(): number { return 88; }
export function LAYERS(): number { return 152; }
export function LIGHT_BRIDGE(): number { return 344; }
export function FRAME(): number { return 408; }
export function RECIPE(): number { return 504; }
export function SCRATCH(): number { return 624; }
export function WORKSPACE_WORDS(): number { return 688; }
export function FRAME_BYTES(): number { return 384; }
export function RECIPE_BYTES(): number { return 512; }
export function NO_DEADLINE(): number { return 4294967295; }

export function OK(): number { return 0; }
export function BAD_ARGUMENT(): number { return -1; }
export function UNSUPPORTED_SCHEMA(): number { return -2; }
export function BAD_INPUT(): number { return -3; }
export function SHORT_OUTPUT(): number { return -4; }
export function RUNTIME_ERROR(): number { return -5; }

export type WallpaperMode = "calm" | "solar" | "focus" | "listening" | "thinking" | "speaking" | "alert";
export type WallpaperPolarity = "obsidian-dark" | "sunlit-alabaster-light" | "adaptive";
export type WallpaperTier = "L0" | "L1" | "M1" | "M2";
export type WallpaperFamily = "solar" | "ember" | "obsidian" | "alabaster" | "horizon" | "tide" | "mineral" | "grove" | "night" | "presence";

export function word(words: readonly number[], index: number): number {
  return words[index] ?? 0;
}

export function inRange(value: number, low: number, high: number): boolean {
  return value >= low && value <= high;
}

export function integer(value: number, low: number, high: number): boolean {
  return inRange(value, low, high) && value === Math.floor(value);
}

export function ceilInt(value: number): number { return -Math.floor(-value); }

export function mod(value: number, modulus: number): number {
  return value - Math.floor(value / modulus) * modulus;
}

export function zeroWords(words: number[], start: number, end: number): void {
  for (let i = 0; i < 688; i++) {
    if (start + i >= end) break;
    words[start + i] = 0;
  }
}

export function defaultWallpaperWords(words: number[]): number {
  if (words.length !== WORKSPACE_WORDS()) return BAD_ARGUMENT();
  zeroWords(words, 0, WORKSPACE_WORDS());
  words[CONFIG()] = 1;
  words[CONFIG() + 2] = 2;
  words[CONFIG() + 4] = 1.25;
  words[CONFIG() + 5] = 15;
  words[CONFIG() + 6] = .48;
  words[CONFIG() + 7] = .35;
  words[CONFIG() + 8] = .06;
  words[CONFIG() + 9] = 1.35;
  words[CONFIG() + 10] = 12;
  words[CONFIG() + 11] = 420;
  words[CONFIG() + 12] = 1;
  words[CONFIG() + 13] = 1;
  words[CONFIG() + 14] = 4.5;
  words[CONFIG() + 15] = .56;
  words[CONFIG() + 17] = .7;
  words[CONFIG() + 18] = 16;
  words[CONFIG() + 23] = 8;
  words[CONFIG() + 24] = 2400;
  words[CONFIG() + 26] = 1;
  words[CONFIG() + 30] = 1920;
  words[CONFIG() + 31] = 1080;
  words[CONFIG() + 32] = 1920;
  words[CONFIG() + 33] = 1080;
  words[CONFIG() + 34] = 60;
  words[CONFIG() + 35] = 1;
  words[CONFIG() + 37] = 15;
  words[CONFIG() + 38] = 1;
  words[CONFIG() + 39] = 1;
  words[CONFIG() + 40] = 1;
  words[CONFIG() + 41] = 3;
  words[CONFIG() + 42] = 3;
  words[CONFIG() + 43] = 48;
  words[CONFIG() + 45] = .25;
  words[CONFIG() + 46] = 1;
  words[STATE()] = 1;
  words[STATE() + 24] = 1;
  words[INPUT() + 38] = 1;
  return OK();
}
