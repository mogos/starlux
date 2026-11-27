# Starlux

`@mogos/starlux` provides portable window physics, a wake-on-interaction frame clock and sensory envelopes. It is MIT-licensed and has zero runtime dependencies.

| Entry point | Surface |
| --- | --- |
| `@mogos/starlux` | All portable TypeScript functions and types, plus the knob JSON codec and event bus |
| `@mogos/starlux/lux` | Wake registry, clock, governor, FIFO events, trace, budgets, presets and idle falsifier |
| `@mogos/starlux/physics` | Spring, snap and neighbor coupling, rubber bounds, glass pose, gestures and the combined stepper |
| `@mogos/starlux/sensory` | Sound and haptic event envelopes, and voice smoothing |
| `@mogos/starlux/living-state` | Deterministic uniform solver for calm, listening, thinking, focus, alert and circadian states |
| `@mogos/starlux/dom` | Browser pointer and animation frame controller |
| `@mogos/starlux/c` | Starscript entry source for the [C11 adapter](c/README.md) |

## Browser usage

```ts
import { mount } from "@mogos/starlux/dom";

const controller = mount(pane, {
  preset: "spatial-os",
  module: {
    frostedGlass: true,
    onFrame({ state, pose }) {
      pane.style.translate = `${state.x + pose.translateX}px ${state.y + pose.translateY}px`;
    },
  },
});

// Call from the pane's teardown.
controller.unmount();
```

`mount` begins idle and acquires a gesture token on pointer down. Normal pointer-up can hand ownership to a settling body. Pointer cancellation, lost capture, blur, hiding the document or unmount release ownership synchronously. The controller removes its pointer, visibility and motion preference listeners on unmount. Hosts can inject a scheduler, swap the module with `setModule`, or change thermal and motion preferences with `setEnvironment`. The module can pass externally driven minimize progress and dock position. The adapter supplies frame data for the caller's rendering and envelope values for the caller's audio or haptic output.

## Physics and policy

Use `defaultSpatialKnobs()` or `spatialPreset(name)` for the closed record of 44 scalar values and 10 flags. Available presets are `spatial-os`, `crisp-pro`, `organic-her`, `tactile-game`, `reduced-motion` and `off`. `clampSpatialKnobs` validates bounds once at the configuration boundary. The JS JSON codec uses that portable validator and fills missing keys from the default preset.

The spring uses an analytic step in free space. Nonlinear forces advance through integer-microsecond accumulation at 4,000 us per substep, with up to 16 substeps per call. The active body can push a passive neighbor. Passive motion never feeds back to the active trajectory. Snapping uses separate enter and exit thresholds and a velocity breakaway limit. Frosted panes disable X/Y tilt and depth lift by default.

The empty-glass minimize clears content by progress 0.22 at the latest. The governor selects 120, 60, 30, 15 or 0 Hz and caps backdrop blur at 16 px and ambient animation at 15 Hz. SVG displacement and box reflection are disabled. The uniform solver produces `energy`, `voice`, `hueShift`, `turbulence`, `rim`, `ambientHz` and `blurPx` for renderers such as the Starshine living backdrop and marble effects. `timeOfDay` is given in local hours from 0 to 24. Sensory output is silent at rest and under reduced motion.

The math kernel uses ordinary binary64 operations, square root, floor and absolute value. Transcendentals use polynomial approximations and explicit range reduction. Inputs beyond the supported finite domain saturate. The trig reduction is bounded to 1 billion radians.

## Verification

Run `./gate.sh` with Starscript, OM, Bun, Node/npm, TypeScript, a Rust toolchain including `wasm32-unknown-unknown`, and a C11 compiler. On `omo-nl-5` the gate uses a 6 GiB systemd user scope with no swap. The [floors](FLOORS.jsonl) cover four-target trajectory parity, single-knob mutants, the feature work guards, idle and teardown falsifiers, OM claims and C11. Read the [OM rules](om/.om/RULESET.md) for the modeled scope and runtime replay.
