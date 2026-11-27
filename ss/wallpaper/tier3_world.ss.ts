import { BAD_ARGUMENT, OK, mod, word } from "./types.ss.ts";

// Ruling #27 Tier-3 IRIZ / @mogos/starlux/wallpaper living-worlds contract.
// Pure 4-way Starscript (zero libm, zero heap allocations on packed buffer write).

export function WALLPAPER_TIER_L0(): number { return 0; }
export function WALLPAPER_TIER_M1(): number { return 1; }
export function WALLPAPER_TIER_M2(): number { return 2; }
export function WALLPAPER_TIER_G3(): number { return 3; }

export function TIER3_PROMOTE_HYSTERESIS_MS(): number { return 60000; }
export function TIER3_OVERLOAD_DEMOTE_FRAMES(): number { return 30; }
export function TIER3_WORLD_UNIFORM_FLOATS(): number { return 64; }
export function TIER3_WORLD_UNIFORM_BYTES(): number { return 256; }

export type Tier3HostCaps = {
  readonly webgpu: boolean;
  readonly webgl2: boolean;
  readonly webgl2Float: boolean;
  readonly worldWebgl2Compat: boolean;
  readonly reducedMotion: boolean;
};

export type Tier3PowerState = {
  readonly onAcPower: boolean;
  readonly batteryPct: number;
  readonly overloadFrames: number;
  readonly nominalHeadroomMs: number;
  readonly m2BudgetBreached: boolean;
};

export type Tier3Decision = {
  readonly tier: number;
  readonly tierCode: string;
  readonly renderer: string;
  readonly settledStatic: boolean;
  readonly demoted: boolean;
  readonly promoted: boolean;
  readonly crossfadeMs: number;
};

export type WorldUniformInput = {
  readonly solarElevationRad: number;
  readonly solarAzimuthRad: number;
  readonly precipitation: number;
  readonly cloudCoverage: number;
  readonly fogDensity: number;
  readonly windSpeedMps: number;
  readonly windDirX: number;
  readonly windDirZ: number;
  readonly gustPhase: number;
  readonly seasonPhase: number;
  readonly osStateId: number;
  readonly osStateIntensity: number;
  readonly pulsePhase: number;
  readonly voiceRms: number;
  readonly polarity: number;
  readonly camX: number;
  readonly camY: number;
  readonly camZ: number;
  readonly fovRad: number;
  readonly targetX: number;
  readonly targetY: number;
  readonly targetZ: number;
  readonly parallaxStrength: number;
  readonly pointerX: number;
  readonly pointerY: number;
  readonly simTimeSec: number;
  readonly frameIndex: number;
  readonly activeTier: number;
  readonly thermalTier: number;
  readonly lodLevel: number;
  readonly onBattery: boolean;
  readonly is4k: boolean;
  readonly exposureEv: number;
  readonly lightAnchorX: number;
  readonly lightAnchorY: number;
  readonly lightAnchorZ: number;
  readonly lightKeyElevation: number;
  readonly lightRimR: number;
  readonly lightRimG: number;
  readonly lightRimB: number;
  readonly hudScrimAlpha: number;
  readonly width: number;
  readonly height: number;
  readonly settleBlend: number;
  readonly hudTopLumaTarget: number;
  readonly hudBottomLumaTarget: number;
};

export type StarluxWorldUniforms = {
  readonly uSunDir: readonly number[];
  readonly uSunIrradiance: readonly number[];
  readonly uWeather: readonly number[];
  readonly uWindSeason: readonly number[];
  readonly uOsState: readonly number[];
  readonly uOsAccentPolarity: readonly number[];
  readonly uCameraPosFov: readonly number[];
  readonly uCameraRig: readonly number[];
  readonly uCameraMotion: readonly number[];
  readonly uThermalLod: readonly number[];
  readonly uRenderBudget: readonly number[];
  readonly uLightAnchor: readonly number[];
  readonly uLightRimScrim: readonly number[];
  readonly uResolution: readonly number[];
  readonly uSettleHudGuard: readonly number[];
  readonly uReserved: readonly number[];
};

function clampVal(v: number, lo: number, hi: number): number {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

function clampInt(v: number, lo: number, hi: number): number {
  return Math.floor(clampVal(v, lo, hi));
}

function approxSqrt(x: number): number {
  if (x <= 0) return 0;
  let g = x >= 1 ? x * 0.5 : 0.5;
  for (let i = 0; i < 8; i++) {
    g = 0.5 * (g + x / g);
  }
  return g;
}

// Pure algebraic sine approximation on radians (zero libm, 4-way identical).
function approxSin(rad: number): number {
  const tau = 6.283185307179586;
  const pi = 3.141592653589793;
  let x = mod(rad + pi, tau) - pi;
  if (x > 1.5707963267948966) x = pi - x;
  if (x < -1.5707963267948966) x = -pi - x;
  const x2 = x * x;
  const x3 = x2 * x;
  const x5 = x3 * x2;
  const x7 = x5 * x2;
  return x - x3 / 6 + x5 / 120 - x7 / 5040;
}

function approxCos(rad: number): number {
  return approxSin(rad + 1.5707963267948966);
}

export function wallpaperTierCode(tier: number): string {
  if (tier >= 3) return "G3";
  if (tier === 2) return "M2";
  if (tier === 1) return "M1";
  return "L0";
}

function resolveRenderer(tier: number, hostCaps: Tier3HostCaps): string {
  if (tier >= 3) {
    if (hostCaps.webgpu) return "webgpu";
    return "webgl2";
  }
  if (tier >= 1) return "plate";
  return "recipe";
}

export function selectWallpaperTier(
  currentTier: number,
  userMaxTier: number,
  thermalTier: number,
  hostCaps: Tier3HostCaps,
  power: Tier3PowerState,
): Tier3Decision {
  const cur = clampInt(currentTier, 0, 3);
  const userCap = clampInt(userMaxTier, 0, 3);
  const thermal = clampInt(thermalTier, 0, 3);
  const hwCap = hostCaps.webgpu
    ? 3
    : (hostCaps.webgl2 && hostCaps.webgl2Float && hostCaps.worldWebgl2Compat)
      ? 3
      : hostCaps.webgl2
        ? 2
        : 0;
  const ceiling = hwCap < userCap ? hwCap : userCap;

  let next = cur;
  let demoted = false;
  let promoted = false;

  // Instant thermal, battery, or overload demotion never waits for hysteresis.
  if (thermal >= 3) {
    if (cur > 0) demoted = true;
    next = 0;
  } else if (thermal === 2 || (!power.onAcPower && power.batteryPct < 20) || power.overloadFrames >= TIER3_OVERLOAD_DEMOTE_FRAMES()) {
    if (cur >= 3) {
      next = 2;
      demoted = true;
    } else if (cur === 2 && power.m2BudgetBreached) {
      next = 0;
      demoted = true;
    } else if (cur > 2) {
      next = 2;
      demoted = true;
    }
  } else if (cur > ceiling) {
    next = ceiling;
    demoted = true;
  } else if (cur < ceiling) {
    const canPromote = thermal === 0
      && power.nominalHeadroomMs >= TIER3_PROMOTE_HYSTERESIS_MS()
      && (power.onAcPower || power.batteryPct > 30);
    if (canPromote) {
      next = cur + 1;
      promoted = true;
    }
  }

  if (next > ceiling) {
    if (next !== cur) demoted = true;
    next = ceiling;
  }
  if (next === 2 && power.m2BudgetBreached) {
    next = 0;
    demoted = true;
    promoted = false;
  }

  const settledStatic = hostCaps.reducedMotion;
  const crossfadeMs = settledStatic ? 0 : (demoted || promoted ? 300 : 0);
  return {
    tier: next,
    tierCode: wallpaperTierCode(next),
    renderer: resolveRenderer(next, hostCaps),
    settledStatic,
    demoted,
    promoted,
    crossfadeMs,
  };
}

export function buildStarluxWorldUniforms(input: WorldUniformInput): StarluxWorldUniforms {
  const elev = clampVal(input.solarElevationRad, -1.5707963267948966, 1.5707963267948966);
  const cosElev = approxCos(elev);
  const sx = cosElev * approxCos(input.solarAzimuthRad);
  const sy = approxSin(elev);
  const sz = cosElev * approxSin(input.solarAzimuthRad);
  const sLen = approxSqrt(sx * sx + sy * sy + sz * sz);
  const sunX = sLen > 0 ? sx / sLen : 0;
  const sunY = sLen > 0 ? sy / sLen : 1;
  const sunZ = sLen > 0 ? sz / sLen : 0;

  const daylight = clampVal((sy + 0.12) / 1.12, 0, 1);
  const sunR = 0.22 + daylight * 0.98;
  const sunG = 0.14 + daylight * 0.88;
  const sunB = 0.10 + daylight * 0.76;

  const wLen = approxSqrt(input.windDirX * input.windDirX + input.windDirZ * input.windDirZ);
  const windX = wLen > 0 ? input.windDirX / wLen : 1;
  const windZ = wLen > 0 ? input.windDirZ / wLen : 0;

  const stateId = clampInt(input.osStateId, 0, 6);
  const intensity = clampVal(input.osStateIntensity, 0, 1);
  const polarity = input.polarity >= 0.5 ? 1 : 0;

  // Ruling #26 safe linear accent tint (Deep Molten Ember #B84309 / warm alabaster).
  const accR = stateId === 5 ? 0.52 : (polarity === 1 ? 0.48 : 0.45);
  const accG = stateId === 5 ? 0.11 : (polarity === 1 ? 0.14 : 0.13);
  const accB = stateId === 5 ? 0.04 : (polarity === 1 ? 0.05 : 0.03);

  const lod = clampInt(input.lodLevel, 0, 11);
  const thermal = clampInt(input.thermalTier, 0, 3);
  const tier = clampInt(input.activeTier, 0, 3);
  const baseScale = thermal >= 3 ? 0.5 : thermal === 2 ? 0.70 : thermal === 1 ? 0.85 : (1.0 - lod * 0.04);
  const maxScale = input.onBattery ? 1.0 : (input.is4k ? 1.25 : 1.5);
  const renderScale = clampVal(baseScale, 0.5, maxScale);
  const volumetricSteps = thermal >= 2 ? 8 : clampInt(64 - lod * 4, 8, 64);
  const giEnabled = tier >= 3 && thermal === 0 && lod <= 6 ? 1 : 0;
  const targetFps = input.settleBlend >= 1 ? 0 : (thermal >= 3 ? 0 : thermal === 2 ? 15 : thermal === 1 ? 30 : 60);
  const temporalAlpha = clampVal(0.08 + lod * 0.02, 0.04, 1.0);
  const bloomStrength = thermal >= 2 ? 0.15 : 0.35;

  // Strictly one-way light anchor copied from @mogos/starlux/light inputs (never reads sky/sun back).
  const aLen = approxSqrt(
    input.lightAnchorX * input.lightAnchorX
    + input.lightAnchorY * input.lightAnchorY
    + input.lightAnchorZ * input.lightAnchorZ,
  );
  const kx = aLen > 0 ? input.lightAnchorX / aLen : 0;
  const ky = aLen > 0 ? input.lightAnchorY / aLen : 1;
  const kz = aLen > 0 ? input.lightAnchorZ / aLen : 0;

  const w = input.width > 1 ? input.width : 1;
  const h = input.height > 1 ? input.height : 1;

  return {
    uSunDir: [sunX, sunY, sunZ, elev],
    uSunIrradiance: [sunR, sunG, sunB, daylight],
    uWeather: [
      clampVal(input.precipitation, 0, 1),
      clampVal(input.cloudCoverage, 0, 1),
      clampVal(input.fogDensity, 0, 1),
      clampVal(input.windSpeedMps, 0, 80),
    ],
    uWindSeason: [windX, windZ, mod(input.gustPhase, 6.283185307179586), clampVal(input.seasonPhase, 0, 1)],
    uOsState: [stateId, intensity, mod(input.pulsePhase, 6.283185307179586), clampVal(input.voiceRms, 0, 1)],
    uOsAccentPolarity: [accR, accG, accB, polarity],
    uCameraPosFov: [input.camX, input.camY, input.camZ, clampVal(input.fovRad, 0.35, 1.8)],
    uCameraRig: [input.targetX, input.targetY, input.targetZ, clampVal(input.parallaxStrength, 0, 1)],
    uCameraMotion: [
      clampVal(input.pointerX, -1, 1),
      clampVal(input.pointerY, -1, 1),
      input.simTimeSec >= 0 ? input.simTimeSec : 0,
      mod(Math.floor(input.frameIndex), 1024),
    ],
    uThermalLod: [renderScale, lod, volumetricSteps, giEnabled],
    uRenderBudget: [targetFps, temporalAlpha, bloomStrength, clampVal(input.exposureEv, -4, 4)],
    uLightAnchor: [kx, ky, kz, clampVal(input.lightKeyElevation, 0, 1)],
    uLightRimScrim: [
      clampVal(input.lightRimR, 0, 1),
      clampVal(input.lightRimG, 0, 1),
      clampVal(input.lightRimB, 0, 1),
      clampVal(input.hudScrimAlpha, 0, 0.45),
    ],
    uResolution: [w, h, 1 / w, 1 / h],
    uSettleHudGuard: [
      clampVal(input.settleBlend, 0, 1),
      clampVal(input.hudTopLumaTarget, 0, 1),
      clampVal(input.hudBottomLumaTarget, 0, 1),
      0,
    ],
    uReserved: [0, 0, 0, 0],
  };
}

function writeVec4(out: number[], offset: number, vec: readonly number[]): void {
  out[offset] = word(vec, 0);
  out[offset + 1] = word(vec, 1);
  out[offset + 2] = word(vec, 2);
  out[offset + 3] = word(vec, 3);
}

export function packStarluxWorldUniforms(uniforms: StarluxWorldUniforms, out: number[]): number {
  if (out.length < TIER3_WORLD_UNIFORM_FLOATS()) return BAD_ARGUMENT();
  writeVec4(out, 0, uniforms.uSunDir);
  writeVec4(out, 4, uniforms.uSunIrradiance);
  writeVec4(out, 8, uniforms.uWeather);
  writeVec4(out, 12, uniforms.uWindSeason);
  writeVec4(out, 16, uniforms.uOsState);
  writeVec4(out, 20, uniforms.uOsAccentPolarity);
  writeVec4(out, 24, uniforms.uCameraPosFov);
  writeVec4(out, 28, uniforms.uCameraRig);
  writeVec4(out, 32, uniforms.uCameraMotion);
  writeVec4(out, 36, uniforms.uThermalLod);
  writeVec4(out, 40, uniforms.uRenderBudget);
  writeVec4(out, 44, uniforms.uLightAnchor);
  writeVec4(out, 48, uniforms.uLightRimScrim);
  writeVec4(out, 52, uniforms.uResolution);
  writeVec4(out, 56, uniforms.uSettleHudGuard);
  writeVec4(out, 60, uniforms.uReserved);
  return OK();
}

export function worldUniformsDigest(packed: readonly number[]): number {
  let hash = 2166136261;
  for (let i = 0; i < 64; i++) {
    const q = Math.floor(word(packed, i) * 10000 + 0.5);
    hash = mod(hash * 65599 + mod(q + 100000000, 4294967296), 4294967296);
  }
  return hash;
}
