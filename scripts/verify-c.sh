#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
./c/build.sh "$work"
"${CC:-cc}" -std=c11 -Wall -Wextra -Werror -ffp-contract=off -I "$work" tests/c-smoke.c \
  "$work/libstarlux.a" -lm -o "$work/starlux-smoke"
if nm -u "$work/libstarlux.a" | rg -q ' (sin|cos|atan2|exp|log|pow|sincos)(f|l)?$'; then
  printf 'C library contains a libm transcendental reference\n' >&2
  exit 1
fi
bun -e '
  import assert from "node:assert/strict";
  import { defaultSpatialKnobs } from "./ss/lux/knobs.ss.ts";
  import { initialBody, launchBody, stepPhysics } from "./ss/physics/simulator.ss.ts";
  import { stepSpring } from "./ss/physics/spring.ss.ts";
  import { input } from "./tests/fixtures.ts";
  const binary = process.argv[1];
  function invoke(...args) {
    const result = Bun.spawnSync([binary, ...args]);
    assert.equal(result.exitCode, 0, result.stderr.toString());
    return result.stdout.toString();
  }
  const knobs = defaultSpatialKnobs();
  const axis = { position: 5, velocity: 3 };
  const state = launchBody(initialBody(-11, -8, 28, 23), -11, -8, 30, -15);
  assert.equal(invoke(), JSON.stringify(knobs) + "\n");
  assert.equal(invoke("spring", JSON.stringify([axis, 1, 4000, knobs, 1])), JSON.stringify(stepSpring(axis, 1, 4000, knobs, 1)) + "\n");
  assert.equal(invoke("physics", JSON.stringify([state, input, 4000, knobs])), JSON.stringify(stepPhysics(state, input, 4000, knobs)) + "\n");
  console.log("C11 archive and all 3 C FFI exports passed with strict warnings");
' "$work/starlux-smoke"
