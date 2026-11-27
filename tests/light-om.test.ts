import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { acquireWake, createLuxClock } from "../src/lux.ts";
import { defaultLightPolicy, LightField } from "../src/light/index.ts";
import type { LightPolicy } from "../src/light/index.ts";

const model = ".om/light/light.om";
const claimForTwin = {
  hidden_source_dims_reflections_broken: "hidden_source_preserves_reflections",
  clean_frame_still_flushes_broken: "idle_light_zero_ticks",
  reduced_pointer_moves_broken: "reduced_motion_static_key",
  unbounded_blur_broken: "blur_and_dispersion_bounded",
  toggle_rearms_wake_broken: "idle_light_zero_ticks",
  stale_callback_evaluates_broken: "idle_light_zero_ticks",
};
type Action = "sample_left" | "sample_right" | "sample_reduced" | "toggle_off" | "toggle_on" | "theme"
  | "reduce" | "flush" | "settle" | "clean_flush" | "cancel" | "hide" | "resume" | "deliver_stale" | "apply_recipe";

function replay(actions: readonly Action[]) {
  const output = [[], []] as number[][];
  let pose = [0, 0];
  let glyph = 0;
  let now = 0;
  let mounted = true;
  let policy: LightPolicy = defaultLightPolicy;
  let clock = acquireWake(createLuxClock(), "body").clock;
  let serial = 0;
  const pending = new Map<number, (ms: number) => void>();
  let lastCallback: ((ms: number) => void) | undefined;
  const fields = [0, 1].map((world) => {
    const field = new LightField({
      host: { requestFrame: (callback) => {
        if (world === 1) lastCallback = callback;
        pending.set(++serial, callback);
        return serial;
      }, cancelFrame: (handle) => { pending.delete(handle); } },
      clock: { read: () => clock, write: (next) => { clock = next; } },
      paintGlyph: (words) => { if (world === 1) glyph = words[0]!; },
    });
    field.attachSurface({ id: 10, x: 0, y: 0, width: 310, height: 180, radius: 12, blurPx: 17 }, (words, scene) => {
      output[world] = Array.from(words);
      if (world === 1) pose = [scene[0]!, scene[1]!];
    });
    return field;
  });
  const [reference, product] = fields as [LightField, LightField];
  function tick() {
    now += 35;
    for (const [handle, callback] of [...pending]) {
      if (pending.delete(handle)) callback(now);
    }
  }
  tick();
  const trace: { action: Action }[] = [];
  let hasLamp = false;
  let show = true;
  for (const action of actions) {
    const before = product.metrics();
    switch (action) {
      case "sample_left":
      case "sample_right":
        hasLamp = true;
        for (const field of fields) field.samplePointer({ x: action === "sample_left" ? -250 : 550, y: 50 });
        assert.equal(product.metrics().heldWakeTokens, 1);
        break;
      case "sample_reduced":
        for (const field of fields) assert.equal(field.samplePointer({ x: 999, y: 73 }), false);
        assert.equal(product.metrics().evaluations, before.evaluations);
        assert.deepEqual(pose, [32 * 256, 24 * 256]);
        break;
      case "toggle_off":
      case "toggle_on":
        show = action === "toggle_on";
        product.setSourceVisible(show);
        assert.equal(product.metrics().frameRequests, before.frameRequests);
        assert.equal(product.metrics().heldWakeTokens, before.heldWakeTokens);
        break;
      case "theme":
        policy = { ...policy, polarity: policy.polarity === "obsidian-dark" ? "sunlit-alabaster-light" : "obsidian-dark" };
        for (const field of fields) field.setPolicy(policy);
        break;
      case "reduce":
        policy = { ...policy, motion: "reduce" };
        for (const field of fields) field.setPolicy(policy);
        assert.deepEqual(pose, [32 * 256, 24 * 256]);
        assert.equal(product.metrics().heldWakeTokens, 0);
        break;
      case "flush":
        tick();
        assert.ok(output[1]![8 + 16 + 9]! > 0);
        assert.ok(output[1]![8 + 96 + 9]! > 0);
        assert.equal(product.metrics().heldWakeTokens, 0);
        break;
      case "settle":
      case "clean_flush":
        assert.equal(product.flush(), 0);
        assert.deepEqual(product.metrics(), before);
        assert.equal(pending.size, 0);
        break;
      case "cancel":
        for (const field of fields) field.cancel();
        assert.equal(product.metrics().heldWakeTokens, 0);
        break;
      case "hide":
        mounted = false;
        for (const field of fields) field.setHidden(true);
        assert.equal(product.metrics().heldWakeTokens, 0);
        break;
      case "resume":
        mounted = true;
        for (const field of fields) field.setHidden(false);
        if (!hasLamp) tick();
        break;
      case "deliver_stale":
        lastCallback?.(now + 1);
        assert.equal(product.metrics().evaluations, before.evaluations);
        assert.equal(product.metrics().acceptedTicks, before.acceptedTicks);
        break;
      case "apply_recipe":
        assert.ok(output[1]!.every((value, index) => index < 8 || (index - 8) % 16 !== 8 || value <= 16 * 256));
        break;
      default: throw new Error("Unknown OM action: " + action);
    }
    assert.deepEqual(output[0], output[1]);
    assert.equal(glyph, mounted && show && hasLamp ? 1 : 0);
    trace.push({ action });
  }
  for (const field of fields) field.dispose();
  return trace;
}

function om(args: string[], status: number) {
  const run = Bun.spawnSync(["om", ...args, "--json"]);
  expect(run.exitCode, run.stdout.toString() + run.stderr.toString()).toBe(status);
  return JSON.parse(run.stdout.toString());
}

test("OM light CLOSED, broken twins rejected and runtime trace conforms", () => {
  const project = om(["check", ".om/light"], 0);
  expect(project.operation_status).toBe("PROJECT_CLOSED");
  const [closed] = project.models;
  expect(closed.verdict).toBe("CLOSED");
  expect(closed.semantic_result.completeness.status).toBe("CLOSED");
  expect(closed.vacuous_claims).toEqual([]);
  expect(closed.claims).toHaveLength(6);
  expect(closed.claims.every((claim: { status: string; guard_echo: boolean }) => claim.status === "HOLDS" && !claim.guard_echo)).toBe(true);
  console.log(`OM light CLOSED | ${closed.distinct} states | 6 claims | 0 VACUOUS | 0 INCOMPLETE`);
  const twins = readdirSync(".om/light/twins").filter((name) => name.endsWith(".om"));
  expect(twins).toHaveLength(Object.keys(claimForTwin).length);
  for (const twin of twins) {
    const receipt = om(["check", ".om/light/twins/" + twin, "--stop-at-first"], 2);
    const inspected = receipt.counterexample;
    expect(inspected.claim).toBe(claimForTwin[twin.slice(0, -3) as keyof typeof claimForTwin]);
    replay(inspected.steps.map(({ action }: { action: Action }) => action));
    console.log("OM twin " + twin + " exit=2 | runtime replay=0");
  }
  const actions: Action[] = ["settle", "sample_left", "flush", "clean_flush", "toggle_off", "sample_right", "flush",
    "apply_recipe", "theme", "flush", "cancel", "deliver_stale", "hide", "resume", "flush", "reduce",
    "flush", "sample_reduced", "toggle_on", "clean_flush"];
  const trace = replay(actions);
  const temp = mkdtempSync(join(tmpdir(), "starlux-light-om-"));
  try {
    const path = join(temp, "observed.jsonl");
    writeFileSync(path, trace.map((action) => JSON.stringify(action)).join("\n") + "\n");
    expect(om(["conform", model, path], 0).operation_status).toBe("CONFORMING");
    console.log(`OM runtime trace | conform=0 | ${trace.length} observed actions`);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
