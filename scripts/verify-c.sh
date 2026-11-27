#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# 1. Core physics + magnetic tiling C11/C17 ABI
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
  console.log("C11 caller and all 3 existing C FFI exports passed with strict warnings");
' "$work/starlux-smoke"

for standard in c11 c17; do
  "${CC:-cc}" -std="$standard" -Wall -Wextra -Werror -pedantic -ffp-contract=off -I "$work" \
    tests/magnetic-abi.c "$work/libstarlux.a" -lm -o "$work/magnetic-$standard"
done
npm run build:wasm
bun tests/magnetic-abi.ts "$work/magnetic-c11"
bun tests/magnetic-abi.ts "$work/magnetic-c17"

# 2. Light optical engine C11/C17 ABI + zero libm transcendentals
mkdir -p "$work/light"
./c/light/build.sh "$work/light"
if nm -u "$work/light/libstarlux_light.a" | rg -q ' (sin|cos|atan2|exp|log|pow|sincos)(f|l)?$'; then
  printf 'Light C library contains a libm transcendental reference\n' >&2
  exit 1
fi
for standard in c11 c17; do
  "${CC:-cc}" -std="$standard" -Wall -Wextra -Werror -pedantic -ffp-contract=off -I "$work/light" \
    c/light/smoke.c "$work/light/libstarlux_light.a" -Wl,--wrap=malloc -lm -o "$work/light-smoke-$standard"
done
printf 'Light C11 and C17 callers compiled cleanly with zero libm transcendentals\n'

# 3. Audio modal synthesizer + atomic SPSC ring C11/C17 ABI + multi-quantum smoke
mkdir -p "$work/audio"
./c/audio/build-audio.sh "$work/audio"
if nm -u "$work/audio/libstarlux_audio.a" | rg -q ' (sin|cos|atan2|exp|log|pow|sincos)(f|l)?$'; then
  printf 'Audio C library contains a libm transcendental reference\n' >&2
  exit 1
fi
for standard in c11 c17; do
  "${CC:-cc}" -std="$standard" -Wall -Wextra -Werror -pedantic -ffp-contract=off -I "$work/audio" \
    tests/audio-c-smoke.c "$work/audio/libstarlux_audio.a" -lm -o "$work/audio-smoke-$standard"
  "$work/audio-smoke-$standard"
done

# 4. Wallpaper 688-word caller-owned ABI C11/C17 + zero libm + zero heap allocators
mkdir -p "$work/wallpaper"
./c/wallpaper/build-wallpaper.sh "$work/wallpaper"
if nm -u "$work/wallpaper/libstarlux_wallpaper.a" | rg -q ' (malloc|calloc|realloc|free|sin|cos|tan|atan|atan2|asin|acos|pow|exp|log|log2|log10|sqrt|floor|ceil|fmod|hypot|cbrt|sincos)(f|l)?$'; then
  printf 'Wallpaper C library contains a forbidden libm or allocator reference\n' >&2
  exit 1
fi
for standard in c11 c17; do
  "${CC:-cc}" -std="$standard" -O2 -Wall -Wextra -Werror -pedantic -ffp-contract=off -fno-fast-math \
    -I "$work/wallpaper" tests/wallpaper-c-smoke.c "$work/wallpaper/libstarlux_wallpaper.a" -o "$work/wallpaper-smoke-$standard"
  "$work/wallpaper-smoke-$standard"
done
printf 'Wallpaper C11 and C17 callers compiled cleanly with zero libm or heap allocator symbols\n'
