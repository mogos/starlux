# Starlux light

`@mogos/starlux/light` computes received light and paints an optional source indicator in a separate pass. The packet contains face pools, bevels, Fresnel and chromatic rim lanes, transmitted caustics, and ambient fill. A separate eight-word scene record carries the room pool, contact shadow offsets, and the polarity coupon.

## Web and Starscript

```ts
import { mountLightDom } from "@mogos/starlux/light";

const light = mountLightDom(panel, {
  surfaces: [{
    element: panel,
    frame: () => {
      const { x, y, width, height } = panel.getBoundingClientRect();
      return { id: 1, x, y, width, height, radius: 16, blurPx: 8 };
    },
  }],
  sourceSwitch: document.querySelector<HTMLInputElement>("#show-light-source")!,
});

// Release observers, surface layers and the light's wake lease on teardown.
light.dispose();
```

Use a labelled native checkbox for the source switch. The adapter tracks the pointer without replacing the platform cursor. For a transformed surface, provide its local dimensions and local-to-viewport matrix in the frame callback. Keep text, focus, and other essential markers above the optical layers. Supply a conservative `protectedGain` from `protectedLightGain` for a surface with protected content, and use an opaque backing where the host cannot bound contrast.

Canvas hosts pass the packet to `paintLightCanvas` during their receiving-surface pass, and install `createCanvasLightGlyph` on a dedicated transparent overlay. Clear or damage physical pixels in the host's regular render transaction. Clip and path references can resolve to CSS clip paths or local Canvas `Path2D` masks.

`LightField` can share a `LuxClock` through `LightClockPort`. Its scheduler queues one callback when work becomes dirty, and releases its own lease when that work completes. Drive frame time and event timestamps from the same monotonic epoch. A reduced or critical field resolves a static upper-leading key in the current transaction. The DOM adapter observes `prefers-reduced-motion`.

Build light layers with `lightEffect`, `layer`, `sequence`, `attenuate`, and `polarityBind`. `resolveLightEffect` matches a `LuxEvent` against its bound semantic action and subject, retains a snapshot of the host's physics pose and optional path, and returns a plan that can be sampled at explicit microseconds. `bindLightEffects` subscribes to the existing event bus without modifying the event or its audio and haptic listeners. A mounted field applies the resolved plan to the surface matching the event subject, or the snapshot's explicit `surfaceId`.

The core `shadeSurface` writes into disjoint caller-owned arrays for packet, scene and scratch. It consumes only the 106-word physical input. Allocate the buffers once and reuse them. `paintLightSource` is the presentation entry that accepts visibility. `writeLightBytes` serializes the packet into a caller-owned buffer.

The package ships the isolated WASM library. Call `instantiateLightWasm()` or supply its module bytes to the same loader. The library receives the 106-word physical input and returns `{ status, packet, scene }` by value. The same binding can be built with the Rust target.

## Native ABI v1

Run `c/light/build.sh <out-dir>` to produce `libstarlux_light.a`, `starlux_light.h`, and the generated runtime notices. The archive uses the C17 Starscript emission with floating-point contraction disabled. Link the archive and `-lm` from a C11 or C17 caller. The frame path borrows workspace arrays from the caller. Each simultaneous call needs its own workspace.

`starlux_light_shade_with_workspace_v1` accepts exactly 856 input bytes. The first two little-endian u32 words are schema 1 and byte size 856. The remaining words are little-endian IEEE binary64. The convenience entry stores its workspace on the stack. Use a round-to-nearest floating environment and disjoint input, workspace, and output spans. Successful calls write exactly 5,408 bytes. On error, they leave the output buffer untouched.

| Physical word indices | Values, in order |
| --- | --- |
| 0 to 5 | Surface index, translation X/Y, width, height, radius |
| 6 to 9 | Local-to-scene affine coefficients a, b, c, d |
| 10 to 18 | Relief sign, full-pane flag, polarity, device scale, requested blur, governor blur cap, thermal tier, pinned flag, protected gain |
| 19 to 25 | Face clip, bevel clip, two extra segment clips, ambient clip, static key X/Y |
| 26 to 105 | Four 20-word emitters in pointer, zenith, Star, focus order |

Each emitter provides active, X, Y, height, range, gain, F0, integer bevel degrees, maximum tangent split, linear R/G/B, face-pool gain, bevel gain, transmission multiplier, segment mask, shadow multiplier, path, footprint scale, and ambient gain. The core rejects invalid snapshots. Nonpositive-size or singular surfaces emit an empty packet. An absent optional segment uses clip zero and has no lanes.

The packet starts with eight little-endian u32 words for version, packet length, surface index, active-slot mask, linear ambient R/G/B, and ambient clip index. Four slots each contain three segments, and each segment contains seven 64-byte lanes in this order: pool, bevel, Fresnel, red, green, blue, caustic. Every lane has sixteen little-endian u32 words:

| Field | Encoding |
| --- | --- |
| Enabled, clip reference | u32 |
| Center X/Y, tangent X/Y | i32 two's-complement, in 1/256 px and 1/32767 respectively |
| Major, minor, blur | u32 in 1/256 px |
| Gain, linear R/G/B | u32 in 1/65535 |
| Path, blend, reserved | u32, blend 0 normal, 1 additive, 2 multiply |

Inactive lanes, reserved words, and unset scene words are zero. Native callers with an explicit workspace can read its scene record after a successful call. The scene words, in order, are room-pool X/Y and radius in 1/256 px, pool gain in 1/65535, local shadow X/Y in 1/256 px, calibrated edge luminance in 1/65535, and reserved zero.
