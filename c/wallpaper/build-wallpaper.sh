#!/usr/bin/env bash
set -euo pipefail
export RUSTC_WRAPPER="" CARGO_BUILD_RUSTC_WRAPPER="" PATH="$HOME/.local/bin:/usr/local/bin:$PATH"
root="$(cd "$(dirname "$0")/../.." && pwd)"
if [[ "$#" -ne 1 ]]; then
  printf 'Usage: %s OUTPUT_DIRECTORY\n' "$0" >&2
  exit 2
fi
mkdir -p "$1"
out="$(cd "$1" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
starc build --no-feedback --target c --lib "$root/c/wallpaper/wallpaper_entry.ss.ts" --out "$work/generated"
module="$work/generated/module.c"
header="$work/generated/module.h"
bind() {
  local name="$1" macro="$2" symbol entry direct
  symbol="$(awk -v name="/* $name */" '$0 == name { getline; sub(/^int /, ""); sub(/\(.*/, ""); print; exit }' "$header")"
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
    printf 'Missing Starscript C numeric-buffer binding for %s\n' "$name" >&2
    exit 1
  fi
  printf '#define %s %s\n' "$macro" "$direct"
}
{
  bind initWords INIT_WORDS
  bind loadPreset LOAD_PRESET
  bind stepWords STEP_WORDS
  bind decodeWords DECODE_WORDS
  bind encodeWords ENCODE_WORDS
  bind renderWords RENDER_WORDS
  bind encodeQoi ENCODE_QOI
  bind decodeQoi DECODE_QOI
  bind encodePng ENCODE_PNG
  bind decodePng DECODE_PNG
} > "$work/wallpaper_generated.h"
sed -i -E 's/^int (ss_[[:xdigit:]]+_export_[0-9]+\()/static int \1/' "$module"
"${CC:-cc}" -std="${C_STANDARD:-c17}" -Os -Wall -Wextra -Werror -pedantic -ffp-contract=off -fno-fast-math \
  -I "$work" -I "$work/generated" -c "$root/c/wallpaper/starlux_wallpaper.c" -o "$work/starlux_wallpaper.o"
"${AR:-ar}" rcs "$work/libstarlux_wallpaper.a" "$work/starlux_wallpaper.o"
cp "$work/libstarlux_wallpaper.a" "$root/c/wallpaper/starlux_wallpaper.h" "$out"
mkdir -p "$out/notices"
cp "$work/generated/NOTICE" "$work/generated/LICENSE-MIT" "$work/generated/LICENSE-APACHE" "$out/notices"
