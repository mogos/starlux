#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

npm pack --pack-destination "$work" --json > "$work/pack-result.json"
root="$work/node_modules/@mogos/starlux"
mkdir -p "$root"
tar -xzf "$work/mogos-starlux-0.1.0.tgz" -C "$root" --strip-components=1
cd "$work"
node --input-type=module <<'JS'
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { defaultSpatialKnobs } from "@mogos/starlux";
import {
  LightField,
  createLightInput,
  defaultLightPolicy,
  instantiateLightWasm,
  lightWasm,
  shadeSurface,
} from "@mogos/starlux/light";
import { parseKnobsJson } from "@mogos/starlux/lux";
import { stepPhysics } from "@mogos/starlux/physics";
import { solveLivingUniforms } from "@mogos/starlux/living-state";
import { synthesizeSensory } from "@mogos/starlux/sensory";
import {
  VOICE_SPEAK,
  VOICE_STYLE_COUNT,
  createVoiceRuntime,
  stepVoiceFrame,
} from "@mogos/starlux/voice";
import { mount } from "@mogos/starlux/dom";
import { cSource, magneticCSource } from "@mogos/starlux/c";
import { MagneticTiling } from "@mogos/starlux/magnetic-tiling";
import { mountMagneticTiling } from "@mogos/starlux/dom/magnetic";
import { instantiateMagneticWasm, magneticWasm } from "@mogos/starlux/wasm/magnetic";
import { catalogSize, getAudioCue, StarluxAudioHost } from "@mogos/starlux/audio";
import {
  TIER3_WORLD_UNIFORM_FLOATS,
  WALLPAPER_TIER_G3,
  WALLPAPER_TIER_L0,
  WALLPAPER_TIER_M2,
  WallpaperRuntime,
  buildStarluxWorldUniforms,
  packStarluxWorldUniforms,
  selectWallpaperTier,
} from "@mogos/starlux/wallpaper";
import * as root from "@mogos/starlux";

const pkg = JSON.parse(readFileSync("node_modules/@mogos/starlux/package.json", "utf8"));
assert.deepEqual(Object.keys(pkg.exports), [".", "./light", "./lux", "./physics", "./sensory", "./living-state", "./voice", "./dom", "./c", "./magnetic-tiling", "./dom/magnetic", "./wasm/magnetic", "./audio", "./wallpaper"]);
assert.equal(pkg.license, "MIT");
assert.equal(pkg.type, "module");
assert.equal(pkg.sideEffects, false);
assert.deepEqual(pkg.dependencies ?? {}, {});
assert.deepEqual(pkg.optionalDependencies ?? {}, {});
assert.deepEqual(pkg.peerDependencies ?? {}, {});
assert.deepEqual(defaultSpatialKnobs(), parseKnobsJson("{}"));
for (const exported of [stepPhysics, solveLivingUniforms, synthesizeSensory, mount, LightField, shadeSurface, createVoiceRuntime, stepVoiceFrame]) {
  assert.equal(typeof exported, "function");
}

assert.equal(VOICE_STYLE_COUNT, 28);
const voiceStep = stepVoiceFrame(createVoiceRuntime(0, false), VOICE_SPEAK, 16000, 0.8, true);
assert.equal(voiceStep.frame.count, 12);

assert.equal(catalogSize(), 250);
assert.equal(getAudioCue(27).slug, "control.press");
assert.equal(typeof StarluxAudioHost, "function");

assert.ok(existsSync(cSource));
assert.ok(existsSync(magneticCSource));
assert.ok(existsSync(magneticWasm));
assert.ok(existsSync(lightWasm));

assert.equal(root.MagneticTiling, MagneticTiling);
assert.equal(root.mountMagneticTiling, mountMagneticTiling);
assert.equal(root.instantiateMagneticWasm, instantiateMagneticWasm);

const wasm = await instantiateMagneticWasm();
assert.deepEqual(wasm.starluxMagneticFrame([]), []);

const lightWasmMod = await instantiateLightWasm();
const lightInput = createLightInput(
  { id: 1, x: 0, y: 0, width: 200, height: 100, radius: 12, blurPx: 16 },
  defaultLightPolicy,
  { pointer: { x: 80, y: 40, dispersion: 1.2 } },
);
const lightRes = lightWasmMod.starluxLightFrame(lightInput);
assert.equal(lightRes.status, 0);
assert.equal(lightRes.packet.length, 1352);

const wpRuntime = new WallpaperRuntime({ presetId: 1, width: 1920, height: 1080 });
wpRuntime.step(0, 0);
const tierDrop = selectWallpaperTier(
  WALLPAPER_TIER_G3(),
  WALLPAPER_TIER_G3(),
  2,
  { webgpu: true, webgl2: true, webgl2Float: true, worldWebgl2Compat: true, reducedMotion: false },
  { onAcPower: true, batteryPct: 100, overloadFrames: 0, nominalHeadroomMs: 0, m2BudgetBreached: false },
);
assert.equal(tierDrop.tier, WALLPAPER_TIER_M2());
assert.equal(tierDrop.demoted, true);
const tierCrit = selectWallpaperTier(
  WALLPAPER_TIER_G3(),
  WALLPAPER_TIER_G3(),
  3,
  { webgpu: true, webgl2: true, webgl2Float: true, worldWebgl2Compat: true, reducedMotion: false },
  { onAcPower: true, batteryPct: 100, overloadFrames: 0, nominalHeadroomMs: 0, m2BudgetBreached: false },
);
assert.equal(tierCrit.tier, WALLPAPER_TIER_L0());
const uniforms = buildStarluxWorldUniforms({
  solarElevationRad: 0.42, solarAzimuthRad: 1.1,
  precipitation: 0, cloudCoverage: 0.3, fogDensity: 0.1, windSpeedMps: 4,
  windDirX: 1, windDirZ: 0, gustPhase: 0.5, seasonPhase: 0.25,
  osStateId: 0, osStateIntensity: 0, pulsePhase: 0, voiceRms: 0, polarity: 0,
  camX: 0, camY: 2, camZ: 6, fovRad: 0.9, targetX: 0, targetY: 1, targetZ: 0, parallaxStrength: 0.25,
  pointerX: 0, pointerY: 0, simTimeSec: 0, frameIndex: 0,
  activeTier: WALLPAPER_TIER_G3(), thermalTier: 0, lodLevel: 0, onBattery: false, is4k: false, exposureEv: 0,
  lightAnchorX: 0, lightAnchorY: 1, lightAnchorZ: 0.5, lightKeyElevation: 0.7,
  lightRimR: 0.9, lightRimG: 0.6, lightRimB: 0.3, hudScrimAlpha: 0.2,
  width: 1920, height: 1080, settleBlend: 1, hudTopLumaTarget: 0.1, hudBottomLumaTarget: 0.1,
});
const packed = new Array(TIER3_WORLD_UNIFORM_FLOATS()).fill(0);
assert.equal(packStarluxWorldUniforms(uniforms, packed), 0);
assert.equal(packed[40], 0);

console.log("Packed ESM and all 14 exports (physics, magnetic, light+WASM, voice, audio, wallpaper) load with zero runtime dependencies");
JS
