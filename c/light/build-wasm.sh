#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
if [[ "$#" -ne 1 ]]; then
  printf 'Usage: %s OUTPUT_DIRECTORY\n' "$0" >&2
  exit 2
fi
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
starc build --no-feedback --target wasm --lib "$root/c/light/entry.ss.ts" --out "$work/generated"
mkdir -p "$1"
cp "$work/generated/entry.ss.wasm" "$work/generated/entry.ss.wit" "$work/generated/loader.mjs" "$1"
