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
