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

starc build --no-feedback --target c --lib "$root/ss/light/scene.ss.ts" --out "$work/generated"
header="$work/generated/module.h"
module="$work/generated/module.c"
symbol="$(awk '$0 == "/* shadeSurface */" { getline; sub(/^int /, ""); sub(/\(.*/, ""); print; exit }' "$header")"
entry="$(awk -v symbol="$symbol" '
  index($0, "int " symbol "(") == 1 { found=1 }
  found && match($0, /ss_dispatch\(c,[0-9]+,input\)/) {
    value=substr($0,RSTART,RLENGTH); split(value, fields, ","); print fields[2]; exit
  }' "$module")"
direct="$(awk -v entry="$entry" '
  index($0, " case " entry ":return ss_num(ss_direct_") == 1 {
    sub(/^.*ss_num\(/, ""); sub(/\(.*/, ""); print
  }' "$module")"
if [[ ! "$symbol" =~ ^ss_[a-zA-Z0-9_]+$ || ! "$entry" =~ ^[0-9]+$ || ! "$direct" =~ ^ss_direct_[0-9]+$ ]]; then
  printf 'Starscript C emitter did not expose the expected numeric-buffer binding\n' >&2
  exit 1
fi
printf '#define LIGHT_SHADE %s\n' "$direct" > "$work/light_generated.h"

"${CC:-cc}" -std=c17 -O2 -Wall -Wextra -Werror -ffp-contract=off -fno-fast-math \
  -I "$work" -I "$work/generated" -c "$root/c/light/starlux_light.c" -o "$work/starlux_light.o"
"${AR:-ar}" rcs "$work/libstarlux_light.a" "$work/starlux_light.o"
cp "$work/libstarlux_light.a" "$root/c/light/starlux_light.h" "$out"
mkdir -p "$out/notices"
cp "$work/generated/NOTICE" "$work/generated/LICENSE-MIT" "$work/generated/LICENSE-APACHE" "$out/notices"
