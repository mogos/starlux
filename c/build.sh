#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
if [[ "$#" -ne 1 ]]; then
  printf 'Usage: %s OUTPUT_DIRECTORY\n' "$0" >&2
  exit 2
fi
mkdir -p "$1"
out="$(cd "$1" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

starc build --target c --lib "$root/c/entry.ss.ts" --out "$work/generated"

aliases="$work/starlux_generated.h"
while read -r public private; do
  symbol="$(awk -v marker="/* $private */" '
    $0 == marker {
      getline
      if ($0 ~ /^int ss_[a-zA-Z0-9_]+\(/) {
        sub(/^int /, "")
        sub(/\(.*/, "")
        print
      }
    }' "$work/generated/module.h")"
  if [[ ! "$symbol" =~ ^ss_[a-zA-Z0-9_]+$ ]]; then
    printf 'Unable to identify C export %s\n' "$private" >&2
    exit 1
  fi
  printf '#define %s %s\n' "$public" "$symbol" >> "$aliases"
done <<'MAP'
STARLUX_DEFAULT_KNOBS starluxDefaultKnobs
STARLUX_STEP_SPRING starluxStepSpring
STARLUX_STEP_PHYSICS starluxStepPhysics
MAP

cc_flags=(-std=c11 -Wall -Wextra -Werror -ffp-contract=off)
if "${CC:-cc}" -fno-diagnostics-show-caret -fsyntax-only -x c /dev/null >/dev/null 2>&1; then
  cc_flags+=(-fno-diagnostics-show-caret)
fi
"${CC:-cc}" "${cc_flags[@]}" \
  -I "$work" -I "$work/generated" -c "$root/c/starlux.c" -o "$work/starlux.o"
"${AR:-ar}" rcs "$work/libstarlux.a" "$work/starlux.o"
cp "$work/libstarlux.a" "$root/c/starlux.h" "$out"
mkdir -p "$out/notices"
cp "$work/generated/NOTICE" "$work/generated/LICENSE-MIT" "$work/generated/LICENSE-APACHE" "$out/notices"
