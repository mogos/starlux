#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
if [[ "$#" -ne 1 ]]; then
  printf 'Usage: %s OUTPUT_DIRECTORY\n' "$0" >&2
  exit 2
fi
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
starc build --target wasm --lib "$root/c/magnetic.ss.ts" --out "$work/generated"
mkdir -p "$1"
cp "$work/generated/magnetic.ss.wasm" "$work/generated/magnetic.ss.wit" "$work/generated/loader.mjs" "$1"
