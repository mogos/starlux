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
import { parseKnobsJson } from "@mogos/starlux/lux";
import { stepPhysics } from "@mogos/starlux/physics";
import { solveLivingUniforms } from "@mogos/starlux/living-state";
import { synthesizeSensory } from "@mogos/starlux/sensory";
import { mount } from "@mogos/starlux/dom";
import { cSource } from "@mogos/starlux/c";

const pkg = JSON.parse(readFileSync("node_modules/@mogos/starlux/package.json", "utf8"));
assert.deepEqual(Object.keys(pkg.exports), [".", "./lux", "./physics", "./sensory", "./living-state", "./dom", "./c"]);
assert.equal(pkg.license, "MIT");
assert.equal(pkg.type, "module");
assert.equal(pkg.sideEffects, false);
assert.deepEqual(pkg.dependencies ?? {}, {});
assert.deepEqual(pkg.optionalDependencies ?? {}, {});
assert.deepEqual(pkg.peerDependencies ?? {}, {});
assert.deepEqual(defaultSpatialKnobs(), parseKnobsJson("{}"));
for (const exported of [stepPhysics, solveLivingUniforms, synthesizeSensory, mount]) assert.equal(typeof exported, "function");
assert.ok(existsSync(cSource));
console.log("Packed ESM and all 7 subpaths load with zero runtime dependencies");
JS
