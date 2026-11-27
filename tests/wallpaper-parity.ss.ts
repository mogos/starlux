import { bindWallpaperZenith, writeWallpaperLuminanceGrid } from "../ss/wallpaper/light_bridge.ss.ts";
import { loadWallpaperPreset } from "../ss/wallpaper/catalog.ss.ts";
import { encodeResidual, reconstructR8, reconstructResidual, sampleTemporalMask, temporalKnot, temporalPhase, validResidual } from "../ss/wallpaper/codec.ss.ts";
import { pngDecode, pngEncode } from "../ss/wallpaper/codec_png.ss.ts";
import { qoiDecode, qoiEncode } from "../ss/wallpaper/codec_qoi.ss.ts";
import { serializeWallpaperFrame, stepWallpaper } from "../ss/wallpaper/dynamics.ss.ts";
import { renderWallpaperRows } from "../ss/wallpaper/layers.ss.ts";
import { linearPsnr, linearSsim, maxAbsoluteError } from "../ss/wallpaper/metrics.ss.ts";
import { decodeRecipe, encodeRecipe } from "../ss/wallpaper/recipe.ss.ts";
import { civilEdge, nextSolarBoundary, solarBucket } from "../ss/wallpaper/solar.ss.ts";
import { FRAME, INPUT, LIGHT_BRIDGE, defaultWallpaperWords, mod, word } from "../ss/wallpaper/types.ss.ts";
import {
  TIER3_WORLD_UNIFORM_FLOATS,
  WALLPAPER_TIER_G3,
  WALLPAPER_TIER_L0,
  WALLPAPER_TIER_M2,
  buildStarluxWorldUniforms,
  packStarluxWorldUniforms,
  selectWallpaperTier,
  worldUniformsDigest,
} from "../ss/wallpaper/tier3_world.ss.ts";

function buffer(size: number): number[] {
  const values: number[] = [];
  for (let i = 0; i < 688; i++) {
    if (i >= size) break;
    values.push(0);
  }
  return values;
}

function hashBytes(hash: number, bytes: readonly number[], count: number): number {
  let digest = hash;
  for (let i = 0; i < 512; i++) {
    if (i >= count) break;
    digest = mod(digest * 65599 + word(bytes, i), 4294967296);
  }
  return digest;
}

function catalogDigest(w: number[], w2: number[], bytes: number[], again: number[], seed: number): number {
  let digest = seed;
  for (let i = 1; i <= 200; i++) {
    if (loadWallpaperPreset(w, i) !== 0 || encodeRecipe(w, bytes) !== 512
      || decodeRecipe(bytes, w2) !== 0 || encodeRecipe(w2, again) !== 512
      || maxAbsoluteError(bytes, again) !== 0) return -1;
    digest = hashBytes(digest, bytes, 512);
  }
  return digest;
}

function losslessDigest(w: number[], seed: number): number {
  const pixels = buffer(60);
  if (renderWallpaperRows(w, 0, 3, 5, 3, pixels) !== 60) return -3;
  const cache = buffer(64);
  const qoi = buffer(160);
  const png = buffer(131);
  const decoded = buffer(60);
  const q = qoiEncode(pixels, 5, 3, qoi, cache);
  if (q < 22) return -4;
  const exact: number[] = [];
  for (let i = 0; i < 160; i++) {
    if (i >= q) break;
    exact.push(word(qoi, i));
  }
  if (qoiDecode(exact, decoded, cache) !== 60 || maxAbsoluteError(pixels, decoded) !== 0
    || linearPsnr(pixels, decoded) < 1e100) return -5;
  const p = pngEncode(pixels, 5, 3, png);
  if (p !== 131) return -6;
  if (pngDecode(png, decoded) !== 60 || maxAbsoluteError(pixels, decoded) !== 0
    || linearPsnr(pixels, decoded) < 1e100 || linearSsim(pixels, decoded, 5, 3) !== 1) return -7;
  return hashBytes(hashBytes(hashBytes(seed, pixels, 60), qoi, q), png, p);
}

function compareLossy(): number {
  const predicted = buffer(243), master = buffer(243), bytes = buffer(251);
  for (let i = 0; i < 243; i++) {
    predicted[i] = 460 + mod(i, 3) * 22;
    master[i] = word(predicted, i) + 7;
  }
  if (encodeResidual(master, predicted, 8, 8, 2, bytes) !== 251 || !validResidual(bytes, 2)) return -8;
  const a = buffer(256), b = buffer(256);
  for (let i = 0; i < 64; i++) {
    for (let c = 0; c < 3; c++) {
      a[i * 4 + c] = Math.floor((467 + c * 22) * 255 / 1023);
      b[i * 4 + c] = Math.floor(reconstructResidual(bytes, 460 + c * 22, mod(i, 8), Math.floor(i / 8), 8, 8, c) * 255 / 1023);
    }
  }
  const psnr = linearPsnr(a, b), ssim = linearSsim(a, b, 8, 8);
  if (psnr < 38 || psnr > 100 || ssim < .96 || ssim >= 1) return -9;
  return Math.floor(ssim * 100000);
}

export function main(seed: number): readonly number[] {
  budget({ instructions: 1000000000, allocations: 10000000, outputBytes: 1048576 });
  const w = buffer(688), w2 = buffer(688), bytes = buffer(512), again = buffer(512);
  defaultWallpaperWords(w);
  defaultWallpaperWords(w2);
  let digest = catalogDigest(w, w2, bytes, again, seed);
  if (digest < 0) return [digest];
  loadWallpaperPreset(w, 1);
  const input = INPUT(), frame = FRAME();
  w[input] = 1;
  if (stepWallpaper(w) !== 0 || word(w, frame + 6) !== 0) return [-2];
  serializeWallpaperFrame(w, bytes);
  digest = losslessDigest(w, hashBytes(digest, bytes, 384));
  if (digest < 0) return [digest];

  const light = buffer(106), grid = buffer(64);
  light[26] = 11; light[66] = 22;
  bindWallpaperZenith(w, light);
  writeWallpaperLuminanceGrid(w, grid);
  const zenith = word(w, LIGHT_BRIDGE() + 3);
  for (let i = 1; i <= 7; i++) {
    w[input + 1] = i * 1000000;
    w[input + 8] = i;
    if (stepWallpaper(w) !== 0 || word(w, LIGHT_BRIDGE() + 3) !== zenith) return [-10];
    if (i === 1 && word(w, frame + 12) !== 3) return [-11];
    if (i === 2 && word(w, frame + 12) !== 4) return [-12];
    if (i === 3 && word(w, frame + 12) !== 5) return [-13];
    if (i === 6 && word(w, frame + 12) !== 6) return [-14];
  }
  w[input + 8] = 0;
  w[input + 7] = 2; w[input + 6] = 2; w[input + 3] = 1;
  if (stepWallpaper(w) !== 0 || mod(word(w, frame + 3), 2) !== 0 || word(w, frame + 7) !== 0) return [-15];
  w[input + 7] = 1; w[input + 3] = 0; w[input + 5] = 1;
  w[input + 2] = civilEdge(5) - 1;
  if (stepWallpaper(w) !== 0 || word(w, frame + 5) !== 1000 || word(w, frame + 15) !== 4
    || word(w, frame + 6) !== 0 || word(light, 26) !== 11 || word(light, 66) !== 22 || word(light, 46) !== 1) return [-16];
  if (solarBucket(civilEdge(5), 0, 0, 0, 0, 0) !== 5
    || nextSolarBoundary(civilEdge(5) - 1, 0, 0, 0, 0, 0) !== civilEdge(5)) return [-17];
  const left: readonly number[] = [6, 56, 114, 246];
  const right: readonly number[] = [10, 180, 190, 208];
  const phase = temporalPhase(3250000);
  const sample = sampleTemporalMask(left, right, phase, 6, 6, 8, 8);
  if (temporalKnot(phase) !== 45 || sample < 120 || reconstructR8(124, 100) !== 92) return [-18];

  // Ruling #27 Tier-3 G3 capability ladder + 60s hysteresis + 256-byte StarluxWorldUniforms parity
  const caps = { webgpu: true, webgl2: true, webgl2Float: true, worldWebgl2Compat: true, reducedMotion: false };
  const dropSerious = selectWallpaperTier(WALLPAPER_TIER_G3(), WALLPAPER_TIER_G3(), 2, caps,
    { onAcPower: true, batteryPct: 100, overloadFrames: 0, nominalHeadroomMs: 0, m2BudgetBreached: false });
  const dropCrit = selectWallpaperTier(WALLPAPER_TIER_G3(), WALLPAPER_TIER_G3(), 3, caps,
    { onAcPower: true, batteryPct: 100, overloadFrames: 0, nominalHeadroomMs: 0, m2BudgetBreached: false });
  const holdShort = selectWallpaperTier(WALLPAPER_TIER_M2(), WALLPAPER_TIER_G3(), 0, caps,
    { onAcPower: true, batteryPct: 100, overloadFrames: 0, nominalHeadroomMs: 59999, m2BudgetBreached: false });
  const promoteOk = selectWallpaperTier(WALLPAPER_TIER_M2(), WALLPAPER_TIER_G3(), 0, caps,
    { onAcPower: true, batteryPct: 100, overloadFrames: 0, nominalHeadroomMs: 60000, m2BudgetBreached: false });
  const dropBatt = selectWallpaperTier(WALLPAPER_TIER_G3(), WALLPAPER_TIER_G3(), 0, caps,
    { onAcPower: false, batteryPct: 15, overloadFrames: 0, nominalHeadroomMs: 90000, m2BudgetBreached: false });
  if (dropSerious.tier !== WALLPAPER_TIER_M2() || !dropSerious.demoted || dropSerious.crossfadeMs !== 300) return [-19];
  if (dropCrit.tier !== WALLPAPER_TIER_L0() || !dropCrit.demoted) return [-20];
  if (holdShort.tier !== WALLPAPER_TIER_M2() || holdShort.promoted) return [-21];
  if (promoteOk.tier !== WALLPAPER_TIER_G3() || !promoteOk.promoted) return [-22];
  if (dropBatt.tier !== WALLPAPER_TIER_M2() || !dropBatt.demoted) return [-23];
  const worldU = buildStarluxWorldUniforms({
    solarElevationRad: 0.42, solarAzimuthRad: 1.1,
    precipitation: 0.1, cloudCoverage: 0.35, fogDensity: 0.15, windSpeedMps: 6.5,
    windDirX: 0.6, windDirZ: 0.8, gustPhase: 1.2, seasonPhase: 0.5,
    osStateId: 1, osStateIntensity: 0.75, pulsePhase: 2.1, voiceRms: 0.32, polarity: 0,
    camX: 0, camY: 2.5, camZ: 8, fovRad: 0.95, targetX: 0, targetY: 1, targetZ: 0, parallaxStrength: 0.3,
    pointerX: 0.2, pointerY: -0.1, simTimeSec: 12.5, frameIndex: 1040,
    activeTier: WALLPAPER_TIER_G3(), thermalTier: 0, lodLevel: 2, onBattery: false, is4k: true, exposureEv: 0.25,
    lightAnchorX: 0.3, lightAnchorY: 0.9, lightAnchorZ: 0.3, lightKeyElevation: 0.82,
    lightRimR: 0.92, lightRimG: 0.64, lightRimB: 0.32, hudScrimAlpha: 0.28,
    width: 2560, height: 1440, settleBlend: 0, hudTopLumaTarget: 0.12, hudBottomLumaTarget: 0.14,
  });
  const packedWorld = buffer(TIER3_WORLD_UNIFORM_FLOATS());
  if (packStarluxWorldUniforms(worldU, packedWorld) !== 0) return [-24];
  const worldDigest = worldUniformsDigest(packedWorld);
  return [digest, compareLossy(), sample, Math.floor(word(grid, 0) * 65535), worldDigest];
}
