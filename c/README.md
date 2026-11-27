# C11 host adapter

Run `./c/build.sh out` with Starscript, a C11 compiler and an archiver on PATH. This emits `out/starlux.h`, `out/libstarlux.a` and the generated runtime notices. Link the archive with the platform math library when required, for example `cc host.c -Iout out/libstarlux.a -lm`.

| Symbol | Input |
| --- | --- |
| `starlux_default_knobs` | No input. This writes the full 54-field default config. |
| `starlux_step_spring` | UTF-8 JSON array `[axis, target, dtUs, knobs, mode]`. Modes 0, 1 and 2 select normal, minimize and maximize. |
| `starlux_step_physics` | UTF-8 JSON array `[body, input, dtUs, knobs]`. Use the closed `BodyState` and `PhysicsInput` record shapes. |

Every entry writes one LF-terminated JSON value to the provided output stream on success and returns zero. Errors return a nonzero status and are written to the errors stream. Callers own both `FILE *` streams. Calls can run on separate threads. Serialize calls on the same thread and avoid nesting them. The stable names in `starlux.h` are suitable for C hosts and Swift bridging headers.

`src/physics.ts` exports the matching TypeScript record types. The npm `@mogos/starlux/c` subpath exports `cSource`, a file URL for the Starscript C library entry point.

The build turns off floating-point contraction and compiles with `-std=c11 -Wall -Wextra -Werror`. The adapter scopes five diagnostics to the unmodified Starscript-generated source. They concern indentation, missing explicit initializers and unused generated declarations. The authored adapter and ABI smoke program use the full warning set. Run `./scripts/verify-c.sh` from the repository to check all three C exports against the TypeScript results.

## Magnetic compositor ABI v1

`starlux_magnetic_frame(input, input_count, output, output_count)` accepts a
76-element binary64 input buffer and writes a 93-element binary64 output buffer.
Use `STARLUX_MAGNETIC_*` constants and the command enum from `starlux.h` to size
and interpret the buffers. Initialize unused input slots to zero. Keep each
window's 62 state values and feed them back into the next call for that window.

| Input index | Value |
| --- | --- |
| 0 | Command enum |
| 1 | Step duration in microseconds, 0 through 64000 |
| 2 to 5 | Init or target rectangle as x, y, width, height |
| 6 to 7 | Target spring response in seconds and damping ratio, or latch strength at 6 for pickup |
| 8 | Command flag. Init or reduce selects reduced motion, target jumps, visibility minimizes, and pickup sets the held state. |
| 9 | Held flag for target commands |
| 10 to 13 | Dock goal as x, y, z, short-side tile size in workspace coordinates |
| 14 to 75 | Previous output state, or zero-fill on init |

| Output index | Value |
| --- | --- |
| 0 to 61 | Opaque window state for the next call |
| 62 to 90 | Pose fields in the order listed below |
| 91 | Per-step event bits for absorb (1), release (2) and handoff (4) |
| 92 | Number of active springs and crossfades |

The pose fields are `cx, cy, z, w, h, sx, sy, fx, fy, rz, tiltX, tiltY, squash,
phi, vx, vy, u, glass, content, shadow, frost, sheen, sheenAt, sheenAngle, tile,
lift, pulse, glow, hidden`. The center and velocity share workspace coordinates,
`phi` is radians, and the bank, tilt and sheen angles are degrees. `fx` and
`fy` describe the layout scale for content counter-scaling. The flight multiplies
both axes by the same logarithmic scale. Use a 1600px shared perspective and
render a separate glass layer. `hidden` is 1 when the pane should be removed
from drawing and hit testing.

The C function returns 0 on success, 1 for invalid input and 2 on a generated
runtime failure. C11 and C17 callers link to the same archive. The WASM and
TypeScript functions return an empty array on invalid input. Build standalone
WASM with `./c/build-wasm.sh <out>` or use the packaged binding.

```ts
import { instantiateMagneticWasm } from "@mogos/starlux/wasm/magnetic";

const wasm = await instantiateMagneticWasm();
const input = new Float64Array(76);
input.set([0, 0, 80, 80, 420, 350], 0);
input.set([600, 860, 60, 44], 10);
const frame = wasm.starluxMagneticFrame(input);
input.set(frame.slice(0, 62), 14);
```
