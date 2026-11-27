import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { auditSettledInvariants, MagneticTiling, mountMagneticTiling } from "../src/index.ts";
import { fakeMagneticDom } from "./fixtures.ts";

const twins = [
  ["r29_empty_glass", "phase := 2, glass := 2, content := 0, crossing := false",
    "phase := 2, glass := 2, content := 1, crossing := false"],
  ["neighbor_monotone", "then neighbor := 1", "then neighbor := 3"],
  ["magnetic_idle_clock", "then dispatched := false, leaseAtDispatch := false",
    "then dispatched := true, leaseAtDispatch := false"],
  ["dock_absorbs_crossing", "crossing := true, absorb := true", "crossing := true, absorb := false"],
  ["open_is_opaque", "phase := 0, glass := 2, content := 2, crossing := false",
    "phase := 0, glass := 1, content := 2, crossing := false"],
  ["minimized_is_hidden", "phase := 4, glass := 0, content := 0, hidden := true",
    "phase := 4, glass := 0, content := 0, hidden := false"],
  ["magnetic_rest_releases", "lease := pushed\naction reopen_glass", "lease := true\naction reopen_glass"],
] as const;

function replay(actions: readonly string[]) {
  const fake = fakeMagneticDom();
  const engine = new MagneticTiling({
    monitors: [{ id: "screen", viewport: { x: 0, y: 0, w: 1200, h: 900 } }],
    windows: [
      { id: "a", rect: { x: 40, y: 70, w: 500, h: 380 }, dock: { x: 500, y: 850, z: 60, size: 44 } },
      { id: "b", rect: { x: 320, y: 240, w: 400, h: 370 }, dock: { x: 550, y: 850, z: 60, size: 44 } },
    ],
  });
  const mounted = mountMagneticTiling(fake.root, { host: fake.host, engine, windows: fake.windows });
  const checked = new Set<string>();
  let absorbed = 0;
  let eventsAtMinimize = 0;
  let sourceX = 0;
  let targetX = 0;
  const trace: { action: string }[] = [];
  const off = engine.onEvent((event) => { if (event.kind === "absorb" && event.id === "a") absorbed++; });
  const w = () => engine.window("a");
  const step = () => mounted.runMs(8.333);
  const until = (done: () => boolean) => {
    for (let i = 0; i < 240 && !done(); i++) step();
    assert.ok(done(), "Runtime did not reach the replay phase");
  };
  const between = () => {
    const x = engine.window("b").state.x.position;
    assert.ok(x >= Math.min(sourceX, targetX) && x <= Math.max(sourceX, targetX));
  };
  try {
    for (const action of actions) {
      switch (action) {
        case "minimize":
          eventsAtMinimize = absorbed;
          assert.equal(engine.minimize("a"), true);
          break;
        case "restore":
          assert.equal(engine.restore("a"), true);
          assert.equal(w().pose.hidden, false);
          break;
        case "fade":
          until(() => w().pose.u >= 0.12);
          assert.ok(w().pose.content > 0 && w().pose.content < 1);
          break;
        case "empty":
          until(() => w().pose.u >= 0.48);
          assert.equal(w().pose.glass, 1);
          assert.equal(w().pose.content, 0);
          assert.equal(w().pose.hidden, false);
          assert.ok(w().pose.sheen > 0);
          checked.add("r29_empty_glass");
          break;
        case "arrive":
          until(() => w().pose.u >= 0.88);
          assert.equal(absorbed, eventsAtMinimize + 1);
          assert.ok(w().state.pulse.velocity !== 0);
          checked.add("dock_absorbs_crossing");
          break;
        case "hide":
          until(() => w().pose.hidden && w().pose.pulse === 0 && w().pose.glow === 0 &&
            w().state.pulse.velocity === 0 && w().state.glow.velocity === 0);
          assert.equal(w().pose.glass, 0);
          assert.equal(fake.pane.getAttribute("inert"), "");
          checked.add("minimized_is_hidden");
          if (engine.metrics().activeSprings === 0) {
            assert.equal(engine.metrics().heldTokens, 0);
            checked.add("magnetic_rest_releases");
          }
          break;
        case "reopen_glass":
          until(() => w().pose.u <= 0.84);
          assert.equal(w().pose.glass, 1);
          assert.equal(w().pose.content, 0);
          break;
        case "reopen_content":
          until(() => w().pose.u < 0.48);
          assert.ok(w().pose.content > 0);
          break;
        case "finish_open":
          mounted.runMs(2000);
          assert.equal(w().pose.glass, 1);
          assert.equal(w().pose.content, 1);
          assert.equal(fake.pane.getAttribute("inert"), null);
          assert.equal(auditSettledInvariants(w()).passed, true);
          checked.add("open_is_opaque");
          break;
        case "request_push":
          sourceX = engine.window("b").state.x.position;
          engine.snap("a", "left");
          targetX = engine.window("b").state.x.target;
          assert.notEqual(targetX, sourceX);
          break;
        case "step_neighbor":
          step();
          between();
          checked.add("neighbor_monotone");
          break;
        case "settle_neighbor":
          until(() => {
            between();
            return engine.window("b").state.x.position === targetX && engine.metrics().activeSprings === 0;
          });
          break;
        case "dispatch_idle": {
          const metrics = mounted.metrics();
          assert.equal(fake.scheduled.size, 0);
          fake.advance(10000);
          assert.equal(mounted.falsifyIdle(metrics, 10000000).passed, true);
          checked.add("magnetic_idle_clock");
          break;
        }
        case "dispatch_live": {
          const ticks = engine.metrics().clockTicks;
          assert.ok(engine.metrics().heldTokens > 0);
          step();
          assert.equal(engine.metrics().clockTicks, ticks + 1);
          break;
        }
        default:
          throw new Error("Unmapped OM action " + action);
      }
      trace.push({ action });
    }
    return { checked, trace };
  } finally {
    off();
    mounted.unmount();
  }
}

const [model, work] = process.argv.slice(2);
assert.ok(model && work);
const source = readFileSync(model, "utf8");
for (const [claim, original, broken] of twins) {
  assert.equal(source.split(original).length, claim === "r29_empty_glass" ? 3 : 2, "Twin anchor " + claim);
  const path = work + "/" + claim + ".om";
  writeFileSync(path, source.replace(original, broken));
  const run = Bun.spawnSync(["om", "check", path, "--stop-at-first", "--json"]);
  assert.equal(run.exitCode, 2, run.stderr.toString());
  const receipt = JSON.parse(run.stdout.toString());
  assert.equal(receipt.exit_code, 2);
  assert.equal(receipt.counterexample.claim, claim);
  assert.ok(replay(receipt.counterexample.steps.map((step: { action: string }) => step.action)).checked.has(claim));
  console.log("OM twin " + claim + " exit=2 | runtime replay=0");
}
const actions = [
  "dispatch_idle", "minimize", "dispatch_live", "fade", "empty", "arrive", "hide", "dispatch_idle",
  "restore", "reopen_glass", "reopen_content", "finish_open", "request_push", "step_neighbor", "settle_neighbor",
  "dispatch_idle",
];
const valid = replay(actions);
assert.equal(valid.checked.size, twins.length);
const trace = work + "/magnetic-runtime.jsonl";
writeFileSync(trace, valid.trace.map((row) => JSON.stringify(row)).join("\n") + "\n");
const conformance = Bun.spawnSync(["om", "conform", model, trace, "--json"]);
assert.equal(conformance.exitCode, 0, conformance.stderr.toString());
assert.equal(JSON.parse(conformance.stdout.toString()).operation_status, "CONFORMING");
console.log("OM magnetic runtime trace | conform=0 | " + actions.length + " observed actions");
