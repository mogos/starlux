# Starlux wallpaper v1

The wallpaper kernel uses one caller-owned binary64 workspace. Build the
native C library from the same Starscript sources used by the TS, Rust and
WASM parity gate.

```sh
./c/wallpaper/build-wallpaper.sh ./dist/wallpaper-c
./c/wallpaper/build-wasm.sh ./dist/wallpaper-wasm
```

The native library is C17 by default. Set `C_STANDARD=c11` to build it as
C11. Both builds use strict warnings and ordered binary64 arithmetic. The
native kernel has an allocation limit of zero. Use one workspace per
concurrent call. The WASM component uses starc's isolated-copy list ABI.
Its `wasm-preset`, `wasm-step` and `wasm-recipe` operations return buffers.

## Workspace and records

| Plane | Word offset | Words |
| --- | ---: | ---: |
| Config | 0 | 48 |
| State | 48 | 40 |
| Input | 88 | 64 |
| Layers | 152 | 192 |
| Light bridge | 344 | 64 |
| Frame | 408 | 96 |
| Recipe | 504 | 120 |
| Scratch | 624 | 64 |

The size is 688 words or 5,504 bytes. Input words 0 through 39 follow the
signal layout. Word 40 is a pending external light sensor update. Word 63
pins an adaptive face (0 automatic, 1 obsidian, 2 alabaster). The layers
plane starts with eight protected rectangles of eight words each, followed
by six resolved 20-word layers. The final eight words are reserved.

`starlux_wallpaper_init_v1` initializes a workspace from a catalog ID. Use
`starlux_wallpaper_step_workspace_v1` after writing a new input snapshot.
`starlux_wallpaper_step_v1` accepts a 2,760-byte little-endian snapshot,
including its eight-byte header, and publishes a 1,224-byte envelope.
Frame words are serialized as little-endian u32, with signed words in
two's complement and IEEE CRC-32 in word 95. Render rows into a disjoint
RGBA8 destination. The alpha channel is emission coverage.

The light bridge begins with four header words and a 20-word zenith
emitter. Four linear RGB horizon stops follow. Eight worst-case row
luminances expand to an 8 by 8 base-only grid. The TS binding writes
exactly light input words 46 through 65. Pointer and Star sensor inputs
affect the wallpaper composite downstream of the bridge.

## Wire formats and boundaries

- The 512-byte recipe starts with Astra's `SLWP` header (ABI word
  0x00010000, kind 5). The six 12-word layer descriptors start at word 16.
  Words 112 through 120 pack the two three-stop linear RGB palettes in
  UNORM16. Words 121 through 123 pack zenith RGBAmbient, light catalog
  ordinals, polarity and channel flags. Words 124 through 126 are zero.
  Word 127 is the IEEE CRC-32 over the first 508 bytes.
- QOI uses straight RGBA8, including the RGB of zero-alpha pixels.
  SLPNG1 uses IHDR, one IDAT and IEND, with a Sub filter for every row,
  65,535-byte stored DEFLATE blocks, Adler-32 and per-chunk CRC-32.
  Gamut travels in the caller's descriptor. QOI and SLPNG1 operate on
  bounded tiles. The C codec APIs borrow a disjoint scratch span of
  `input_bytes + output_capacity + 64` binary64 words.
- M1 accepts rate-bounded WebP and AVIF tile descriptors and the
  procedural SWRQ residual. The host supplies VP8 and AV1 decoded
  planes. The reference converts VP8 color and preserves packed AVIF
  10-bit samples. M2 uses an AV1 intra poster, R8 absolute knots and R8
  delta knots. The kernel reconstructs and advects the masks.
- VP8L is a host port using `cwebp -lossless -exact`. The verifier
  validates the RIFF header, dimensions and decoded-pixel SHA-256.
  The catalog ships procedural fallback recipes. Raster masters and
  encoded production asset packs are supplied at the host boundary.

`@mogos/starlux/wallpaper` exports the TS kernel, runtime, presentation
scheduler and browser bridge. A presenter receives synchronous draw
submissions. The scheduler owns one wallpaper wake token per live burst
and accepts a shared wake port when the host already has a LuxClock.
