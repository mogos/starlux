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
import * as root from "@mogos/starlux";

const pkg = JSON.parse(readFileSync("node_modules/@mogos/starlux/package.json", "utf8"));
assert.deepEqual(Object.keys(pkg.exports), [".", "./light", "./lux", "./physics", "./sensory", "./living-state", "./voice", "./dom", "./c", "./magnetic-tiling", "./dom/magnetic", "./wasm/magnetic", "./audio"]);
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

console.log("Packed ESM and all 13 exports (physics, magnetic, light+WASM, voice, audio) load with zero runtime dependencies");
JS
