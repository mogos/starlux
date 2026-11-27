#!/usr/bin/env bash
set -euo pipefail
export RUSTC_WRAPPER="" CARGO_BUILD_RUSTC_WRAPPER="" PATH="$HOME/.local/bin:/usr/local/bin:$PATH"
root="$(cd "$(dirname "$0")/../.." && pwd)"
if [[ "$#" -ne 1 ]]; then
  printf 'Usage: %s OUTPUT_DIRECTORY\n' "$0" >&2
  exit 2
fi
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
starc build --no-feedback --target wasm --lib "$root/c/wallpaper/wallpaper_entry.ss.ts" --out "$work/generated"
mkdir -p "$1"
cp "$work/generated/wallpaper_entry.ss.wasm" "$work/generated/wallpaper_entry.ss.wit" "$work/generated/loader.mjs" "$1"
