import { loadWallpaperPreset } from "../../ss/wallpaper/catalog.ss.ts";
import { stepWallpaper } from "../../ss/wallpaper/dynamics.ss.ts";
import { renderWallpaperSpan } from "../../ss/wallpaper/layers.ss.ts";
import { decodeRecipe, encodeRecipe } from "../../ss/wallpaper/recipe.ss.ts";
import { defaultWallpaperWords } from "../../ss/wallpaper/types.ss.ts";
import { pngDecode, pngEncode } from "../../ss/wallpaper/codec_png.ss.ts";
import { qoiDecode, qoiEncode } from "../../ss/wallpaper/codec_qoi.ss.ts";

export function initWords(w: number[]): number { return defaultWallpaperWords(w); }
export function loadPreset(w: number[], id: number): number { return loadWallpaperPreset(w, id); }
export function stepWords(w: number[]): number { return stepWallpaper(w); }
export function decodeWords(bytes: readonly number[], w: number[]): number { return decodeRecipe(bytes, w); }
export function encodeWords(w: readonly number[], bytes: number[]): number { return encodeRecipe(w, bytes); }
export function renderWords(w: readonly number[], x: number, y: number, n: number, width: number, height: number, out: number[]): number {
  return renderWallpaperSpan(w, x, y, n, width, height, out);
}
export function encodeQoi(bytes: readonly number[], width: number, height: number, out: number[], cache: number[]): number {
  return qoiEncode(bytes, width, height, out, cache);
}
export function decodeQoi(bytes: readonly number[], out: number[], cache: number[]): number {
  return qoiDecode(bytes, out, cache);
}
export function encodePng(bytes: readonly number[], width: number, height: number, out: number[]): number {
  return pngEncode(bytes, width, height, out);
}
export function decodePng(bytes: readonly number[], out: number[]): number {
  return pngDecode(bytes, out);
}

// Array-returning component entry points expose mutations through the
// generated WASM component's copy-based list boundary.
export function wasmPreset(workspace: number[], id: number): readonly number[] {
  if (defaultWallpaperWords(workspace) !== 0 || loadWallpaperPreset(workspace, id) !== 0) return [];
  return workspace;
}

export function wasmStep(workspace: number[]): readonly number[] {
  if (stepWallpaper(workspace) !== 0) return [];
  return workspace;
}

export function wasmRecipe(workspace: readonly number[], out: number[]): readonly number[] {
  if (out.length !== 512 || encodeRecipe(workspace, out) !== 512) return [];
  return out;
}
