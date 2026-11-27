#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

export RUSTC_WRAPPER="" CARGO_BUILD_RUSTC_WRAPPER=""
if [[ "$(hostname -s)" == omo-nl-5 ]]; then
  export PATH="/home/fleet/.bun/bin:/home/fleet/.local/bin:/usr/local/bin:$PATH"
  export CARGO_HOME="${CARGO_HOME:-/home/fleet/.cargo}"
  # Resolve the actual toolchain under the gate's memory scope.
  rust_bin="$(dirname "$(rustup which --toolchain 1.100.0 cargo)")"
  export PATH="$rust_bin:$PATH"
  if [[ "${STARLUX_GATE_SCOPED:-}" != 1 ]]; then
    exec systemd-run --user --scope -q -p MemoryMax=6G -p MemorySwapMax=0 env STARLUX_GATE_SCOPED=1 "$PWD/gate.sh"
  fi
fi

if rg -n "$(printf '\342\200\224')" --hidden --glob '!.git/**' --glob '!dist/**' --glob '!node_modules/**' .; then
  printf 'Authored files contain a U+2014 character\n' >&2
  exit 1
fi
if rg -n "['\"](@mogos/(starstyle|starkit|starshine)(/[^'\"]*)?|solid-js(/[^'\"]*)?)['\"]" ss src c; then
  printf 'Found an excluded import or dependency\n' >&2
  exit 1
fi

npm run build:wasm
npm run build:wasm:light

bun test \
  tests/runtime.test.ts \
  tests/magnetic.test.ts \
  tests/light-core.test.ts \
  tests/light-runtime.test.ts \
  tests/light-browser.test.ts \
  tests/light-native.test.ts \
  tests/light-om.test.ts \
  tests/voice-core.test.ts \
  tests/audio-catalog.test.ts \
  tests/audio-runtime.test.ts \
  tests/audio-mutations.test.ts \
  tests/audio-om.test.ts \
  tests/wallpaper-catalog.test.ts \
  tests/wallpaper-runtime.test.ts \
  tests/wallpaper-om.test.ts \
  tests/wallpaper-mutations.test.ts

bun tests/mutations.ts
bun tests/magnetic-mutations.ts
bun tests/light-mutations.ts

starc test --all-targets --require-all --targets ts,rust,wasm,c tests/trajectory.ss.ts --input 4000
starc test --all-targets --require-all --targets ts,rust,wasm,c tests/magnetic-trajectory.ss.ts --input 8333

core_output="$(starc test --all-targets --require-all --targets ts,rust,wasm,c tests/core-portable.ss.ts --input 4000 --print-output)"
printf '%s\n' "$core_output"
if ! rg -q '^[1-9][0-9]*(\.[0-9]+)?$' <<< "$core_output"; then
  printf 'Portable core smoke test failed its behavioral checks\n' >&2
  exit 1
fi

light_output="$(starc test --all-targets --require-all --targets ts,rust,wasm,c tests/light-parity.ss.ts --print-output)"
if ! rg -q ',0\]$' <<< "$light_output"; then
  printf 'Light 4-target parity test reported non-zero errors\n' >&2
  exit 1
fi

voice_output="$(starc test --all-targets --require-all --targets ts,rust,wasm,c tests/voice-4way.ss.ts --input 16000 --print-output)"
printf '%s\n' "$voice_output"
if ! rg -q '"ok"\s*:\s*true' <<< "$voice_output"; then
  printf 'Voice 4-target parity test failed behavioral checks\n' >&2
  exit 1
fi

starc test --all-targets --require-all --targets ts,rust,wasm,c tests/audio-parity.ss.ts --input 100

wallpaper_output="$(starc test --all-targets --require-all --targets ts,rust,wasm,c tests/wallpaper-parity.ss.ts --input 1 --print-output)"
printf '%s\n' "$wallpaper_output"
if ! rg -q '^\[[1-9][0-9]*,' <<< "$wallpaper_output"; then
  printf 'Wallpaper 4-target parity test failed behavioral checks\n' >&2
  exit 1
fi

./scripts/verify-c.sh
./scripts/verify-om.sh
./scripts/verify-package.sh
printf 'Starlux gate passed\n'
