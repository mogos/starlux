import {
  CONFIG, FRAME, INPUT, LAYERS, LIGHT_BRIDGE, STATE, WORKSPACE_WORDS, defaultWallpaperWords,
  decodeRecipe, encodeRecipe, loadWallpaperPreset, recipePolarity, recipeWord, renderWallpaperRows, serializeWallpaperFrame, stepWallpaper,
} from "../../ss/wallpaper/index.ss.ts";
import type { WallpaperMode, WallpaperPolarity } from "../../ss/wallpaper/index.ss.ts";

export type WallpaperThermal = "nominal" | "fair" | "serious" | "critical";
export type WallpaperBaseMode = "calm" | "focus" | "solar" | "circadian";
export type WallpaperSolar =
  | { readonly source: "civil"; readonly utcOffsetMinutes: number }
  | { readonly source: "fixed"; readonly bucket: number }
  | { readonly source: "geo"; readonly latitude: number; readonly longitude: number; readonly consent: true };
export type ProtectedWallpaperRect = {
  readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly inkLuminance: number;
};
export type WallpaperOptions = {
  readonly presetId?: number;
  readonly recipe?: Uint8Array;
  readonly polarity?: WallpaperPolarity;
  readonly gamut?: "srgb" | "display-p3";
  readonly ambientFps?: number;
  readonly voiceReactive?: boolean;
  readonly audioReactive?: boolean;
  readonly audioBandMask?: number;
  readonly thermal?: WallpaperThermal;
  readonly solar?: WallpaperSolar;
  readonly staticPhase?: number;
  readonly dprCeiling?: number;
  readonly width?: number;
  readonly height?: number;
  readonly tierCeiling?: 0 | 1 | 2 | 3;
  readonly memoryCeilingMiB?: number;
};

const modes: readonly WallpaperMode[] = ["calm", "solar", "focus", "listening", "thinking", "speaking", "alert"];
const thermalOrdinals = { nominal: 0, fair: 1, serious: 2, critical: 3 } as const;
const faceOrdinals = { "obsidian-dark": 0, "sunlit-alabaster-light": 1, adaptive: 2 } as const;
const voiceOrdinals = { calm: 0, listening: 1, thinking: 2, speaking: 3, alert: 6 } as const;

export type WallpaperLightSensors = {
  readonly pointerPoolGain?: number;
  readonly star?: { readonly x: number; readonly y: number; readonly gain: number; readonly rgb: readonly [number, number, number] } | null;
};

export type WallpaperSignals = {
  readonly baseMode?: WallpaperBaseMode;
  readonly voiceState?: keyof typeof voiceOrdinals;
  readonly voiceLevel?: number;
  readonly audioLevel?: number;
  readonly audioBands?: readonly number[];
  readonly thermal?: WallpaperThermal;
  readonly hidden?: boolean;
  readonly paused?: boolean;
  readonly reducedMotion?: boolean;
  readonly batterySaver?: boolean;
  readonly alert?: boolean;
  readonly activeFace?: "obsidian-dark" | "sunlit-alabaster-light";
};

function scalar(value: boolean): number { return value ? 1 : 0; }

export class WallpaperRuntime {
  readonly #words: number[] = new Array<number>(WORKSPACE_WORDS()).fill(0);
  readonly #frameBuffer: number[] = new Array<number>(384).fill(0);
  #serial = 0;

  constructor(options: WallpaperOptions = {}) {
    const w = this.#words;
    const c = CONFIG();
    defaultWallpaperWords(w);
    if (options.recipe && options.presetId !== undefined) throw new RangeError("Choose a recipe or preset ID");
    const result = options.recipe
      ? decodeRecipe(Array.from(options.recipe), w) : loadWallpaperPreset(w, options.presetId ?? 181);
    if (result !== 0) throw new RangeError("Invalid wallpaper recipe or preset");
    if (options.recipe) {
      w[c + 1] = recipeWord(w, 4);
      w[c + 2] = recipePolarity(w);
    }
    if (options.polarity !== undefined) w[c + 2] = faceOrdinals[options.polarity];
    if (options.gamut !== undefined) w[c + 3] = scalar(options.gamut === "display-p3");
    if (options.dprCeiling !== undefined) w[c + 4] = options.dprCeiling;
    if (options.ambientFps !== undefined) w[c + 5] = options.ambientFps;
    if (options.voiceReactive !== undefined) w[c + 35] = scalar(options.voiceReactive);
    if (options.audioReactive !== undefined) w[c + 36] = scalar(options.audioReactive);
    if (options.audioBandMask !== undefined) w[c + 37] = options.audioBandMask;
    if (options.tierCeiling !== undefined) w[c + 42] = options.tierCeiling;
    if (options.memoryCeilingMiB !== undefined) w[c + 43] = options.memoryCeilingMiB;
    if (options.staticPhase !== undefined) w[c + 45] = options.staticPhase;
    const sun = options.solar;
    if (sun?.source === "civil") w[c + 22] = sun.utcOffsetMinutes;
    if (sun?.source === "fixed") {
      w[c + 19] = 2;
      w[c + 23] = sun.bucket;
    }
    if (sun?.source === "geo" && sun.consent === true) {
      w[c + 19] = 1;
      w[c + 20] = Math.round(sun.latitude * 10) / 10;
      w[c + 21] = Math.round(sun.longitude * 10) / 10;
    }
    if (options.width !== undefined || options.height !== undefined) {
      this.resize(options.width ?? 1920, options.height ?? 1080, 1);
    }
    const initialMode = recipeWord(w, 8);
    if (initialMode <= 2) w[INPUT() + 7] = initialMode;
    if (initialMode >= 3 && initialMode <= 5) w[INPUT() + 8] = initialMode - 2;
    if (initialMode === 6) w[INPUT() + 9] = 1;
    if (options.thermal !== undefined) w[INPUT() + 6] = thermalOrdinals[options.thermal];
  }

  get words(): readonly number[] { return this.#words; }
  get mode(): WallpaperMode { return modes[this.#words[STATE() + 2] ?? 0] ?? "calm"; }
  get drawCount(): number { return this.#words[STATE() + 26] ?? 0; }
  get active(): boolean { return this.frameWord(6) !== 0; }
  get nextBoundaryUnix(): number { return this.#words[STATE() + 8] ?? -1; }
  get reduced(): boolean { return this.#words[INPUT() + 5] === 1; }
  get bridgeGeneration(): number { return this.#words[LIGHT_BRIDGE() + 3] ?? 0; }
  frameWord(index: number): number { return this.#words[FRAME() + index] ?? 0; }

  setSignals(values: WallpaperSignals): void {
    const i = INPUT(), w = this.#words;
    if (values.hidden !== undefined) w[i + 3] = scalar(values.hidden);
    if (values.paused !== undefined) w[i + 4] = scalar(values.paused);
    if (values.reducedMotion !== undefined) w[i + 5] = scalar(values.reducedMotion);
    if (values.thermal !== undefined) w[i + 6] = thermalOrdinals[values.thermal];
    if (values.baseMode !== undefined) w[i + 7] = values.baseMode === "calm" ? 0 : values.baseMode === "focus" ? 2 : 1;
    if (values.voiceState !== undefined) w[i + 8] = voiceOrdinals[values.voiceState];
    if (values.alert !== undefined) w[i + 9] = scalar(values.alert);
    if (values.batterySaver !== undefined) w[i + 10] = scalar(values.batterySaver);
    if (values.voiceLevel !== undefined) w[i + 12] = values.voiceLevel;
    if (values.audioLevel !== undefined) w[i + 17] = values.audioLevel;
    if (values.audioBands !== undefined) {
      for (let band = 0; band < 8; band++) w[i + 18 + band] = values.audioBands[band] ?? 0;
    }
    if (values.activeFace !== undefined) w[i + 63] = 1 + faceOrdinals[values.activeFace];
  }

  pointer(x: number, y: number, active: boolean, trusted: boolean): boolean {
    const i = INPUT(), w = this.#words;
    if (!trusted || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (active && x === 0 && y === 0 && w[STATE() + 25] === 0) return false;
    if (w[i + 26] === scalar(active) && w[i + 28] === x && w[i + 29] === y) return false;
    w[i + 26] = scalar(active); w[i + 27] = 1;
    w[i + 28] = Math.max(-32767, Math.min(32767, x));
    w[i + 29] = Math.max(-32767, Math.min(32767, y));
    return true;
  }

  setLightSensors(sensors: WallpaperLightSensors): void {
    const w = this.#words, i = INPUT();
    if (sensors.pointerPoolGain !== undefined && w[i + 30] !== sensors.pointerPoolGain) {
      w[i + 30] = sensors.pointerPoolGain;
      w[i + 40] = 1;
    }
    if (sensors.star !== undefined) {
      const star = sensors.star;
      const values = star ? [1, star.x, star.y, star.gain, ...star.rgb] : [0, 0, 0, 0, 0, 0, 0];
      if (values.some((value, index) => w[i + 31 + index] !== value)) {
        for (let n = 0; n < values.length; n++) w[i + 31 + n] = values[n]!;
        w[i + 40] = 1;
      }
    }
  }

  resize(width: number, height: number, dpr: number): void {
    if (![width, height, dpr].every((n) => Number.isFinite(n) && n > 0)) throw new RangeError("Invalid display");
    const w = this.#words, c = CONFIG();
    const scale = Math.min(dpr, w[c + 4] ?? 1.25, 3840 / Math.max(width, height),
      2160 / Math.min(width, height));
    w[c + 32] = Math.max(1, Math.floor(width * scale));
    w[c + 33] = Math.max(1, Math.floor(height * scale));
    w[c + 30] = w[c + 32]!;
    w[c + 31] = w[c + 33]!;
    w[INPUT() + 38] = Math.max(.5, Math.min(8, dpr));
    w[INPUT() + 11] = 1;
  }

  protect(rects: readonly ProtectedWallpaperRect[]): void {
    if (rects.length > 8) throw new RangeError("At most eight protected rectangles");
    const w = this.#words;
    w.fill(0, LAYERS(), LAYERS() + 64);
    rects.forEach((rect, j) => {
      const at = LAYERS() + j * 8;
      w[at] = rect.x; w[at + 1] = rect.y; w[at + 2] = rect.width; w[at + 3] = rect.height;
      w[at + 4] = rect.inkLuminance;
    });
    w[INPUT() + 39] = rects.length;
    w[INPUT() + 11] = 1;
  }

  step(nowUs: number, unixSeconds: number): void {
    const i = INPUT(), w = this.#words;
    const serial = (this.#serial + 1) >>> 0;
    w[i] = serial;
    w[i + 1] = nowUs;
    w[i + 2] = unixSeconds;
    const result = stepWallpaper(w);
    if (result !== 0) throw new RangeError(`Wallpaper step rejected snapshot (${result})`);
    this.#serial = serial;
    w[i + 11] = 0;
    if ((this.frameWord(3) & 1) !== 0) w[i + 40] = 0;
  }

  recipe(): Uint8Array {
    const result = new Array<number>(512).fill(0);
    if (encodeRecipe(this.#words, result) !== 512) throw new Error("Invalid wallpaper recipe");
    return Uint8Array.from(result);
  }

  frameBytes(target = new Uint8Array(384)): Uint8Array {
    if (target.length < 384 || serializeWallpaperFrame(this.#words, this.#frameBuffer) !== 384) {
      throw new RangeError("Wallpaper frame unavailable or output too short");
    }
    target.set(this.#frameBuffer);
    return target;
  }

  renderRows(y: number, rows: number, width: number, height: number, output: number[]): number {
    return renderWallpaperRows(this.#words, y, rows, width, height, output);
  }
}
