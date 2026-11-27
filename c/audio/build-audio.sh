#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
if [[ "$#" -ne 1 ]]; then
  printf 'Usage: %s OUTPUT_DIRECTORY\n' "$0" >&2
  exit 2
fi
mkdir -p "$1"
out="$(cd "$1" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

starc build --target c --lib "$root/c/audio/audio_entry.ss.ts" --out "$work/audio"
target_id="$(sed -n 's/.*ss_dispatch(c,\([0-9][0-9]*\),input).*/\1/p' "$work/audio/module.c" | tail -n 1)"
target_id="${target_id:-0}"

cc_flags=(-std=c17 -Wall -Wextra -Werror -ffp-contract=off "-DSL_AUDIO_EXPORT_TARGET=${target_id}u")
if "${CC:-cc}" -fno-diagnostics-show-caret -fsyntax-only -x c /dev/null >/dev/null 2>&1; then
  cc_flags+=(-fno-diagnostics-show-caret)
fi
"${CC:-cc}" "${cc_flags[@]}" -I "$root/c/audio" -I "$work/audio" -c "$root/c/audio/starlux_audio.c" -o "$work/starlux_audio.o"
"${AR:-ar}" rcs "$work/libstarlux_audio.a" "$work/starlux_audio.o"
cp "$work/libstarlux_audio.a" "$root/c/audio/starlux_audio.h" "$out"
