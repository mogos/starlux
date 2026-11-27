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

## Magnetic tiling

`@mogos/starlux` exports the portable window solver, layout planners, `MagneticTiling`
and `mountMagneticTiling`. Use the engine directly when your compositor owns drawing
and input. Use the DOM adapter when Starlux should apply the poses and own the frame
source.

```ts
import { mountMagneticTiling } from "@mogos/starlux";

const { engine, runMs, metrics, unmount } = mountMagneticTiling(workspace);
engine.setLayout("bento");
engine.gatherAll();
runMs(1200);
engine.returnAll();
```

Set `position: relative` on the workspace. Give each pane a unique
`data-magnetic-window` value, and give its dock button the matching
`data-magnetic-dock` value. Mark descendants with `data-magnetic-handle`,
`data-magnetic-glass` and `data-magnetic-content`. Give glass and content separate
layers so the content can dissolve while the glass keeps its backdrop filter.
Optional `data-magnetic-shadow`, `data-magnetic-frost` and `data-magnetic-sheen`
layers receive independent opacity. Use `--magnetic-sheen-angle` in the sheen's
gradient. Optional `data-magnetic-minimize` and `data-magnetic-zoom` buttons wire
the window actions. The adapter also accepts explicit elements for every part.

A `data-magnetic-orb` button toggles gather and return. Optional
`data-magnetic-ghost`, `data-magnetic-neighbors` and `data-magnetic-onion` layers
render the snap preview and motion traces. Position overlay layers over the
workspace and give them `pointer-events: none`. The `fields` option binds edge
glow elements. Call `setOnion(true)` to show the traces.

The six presets are `focus`, `split`, `thirds`, `bento`, `cascade` and
`gather`. `free`, `master`, `cols3` and `grid` retain the study's free
drag and its original layouts. In free layout, `edgeMode: "thirds"` adds thirds
along the top and bottom edges, `"primary"` selects a two-thirds primary pane
along either side, and `"focus"` enables the centered focus target along the top.
`snap(id, zone)` can select any zone directly. Pass separate monitor viewports
and workspaces to reserve dock space and enable edge handoff. All rectangles
share the workspace's CSS pixel coordinate system.

`MagneticTiling` exposes absolute spring poses, target geometry, previews,
lifecycle events and sensory envelopes. `runMs(ms)` advances deterministic time
without asking the browser for a frame. `auditSettledInvariants(win)` checks
hidden docked panes, opaque open panes, settled layout and snap anomalies.
The adapter follows the OS reduced-motion setting by default, supports a thermal
tier override and releases its wake token when all springs finish.

Native compositors can build the C17 archive with `./c/build.sh <out>` and
include its C11/C17 header. The packed package also ships the generated WASM
module and loader at `@mogos/starlux/wasm/magnetic`. Both expose the same flat
window state and pose protocol used by `magneticFrameFlat` in TypeScript.
See [the native ABI](c/README.md#magnetic-compositor-abi-v1) for the protocol.
