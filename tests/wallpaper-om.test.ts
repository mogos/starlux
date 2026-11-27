import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { shadeSurface } from "../ss/light/scene.ss.ts";
import { createLightInput, defaultLightPolicy } from "../src/light/inputs.ts";
import {
  LIGHT_BRIDGE, WallpaperAssetBudget, WallpaperHost, bindWallpaperZenith, decodeWallpaperLossless, encodeWallpaperLossless,
} from "../src/wallpaper/index.ts";
import type { WallpaperScheduler, WallpaperSignals } from "../src/wallpaper/index.ts";

const project = ".om/wallpaper";
const twins = [
  ["w001-calm-token", "calm_zero_idle_ticks"],
  ["w002-hidden-static", "hidden_zero_draws"],
  ["w003-reduce-keeps-token", "reduced_motion_static_frame"],
  ["w004-lossless-quantized", "codec_roundtrip_exact"],
  ["w005-zenith-reads-light", "light_binding_acyclic"],
  ["w006-admit-unguarded", "memory_and_asset_caps"],
] as const;

function om(...args: string[]) {
  const result = Bun.spawnSync(["om", ...args, "--json"]);
  return { code: result.exitCode, data: JSON.parse(result.stdout.toString()) };
}

function harness() {
  let now = 0, handle = 0, submissions = 0;
  const rafs = new Map<number, () => void>();
  const timers = new Map<number, () => void>();
  const scheduler: WallpaperScheduler = {
    nowUs: () => now, unixSeconds: () => Math.floor(now / 1_000_000),
    requestFrame(callback) { rafs.set(++handle, callback); return handle; },
    cancelFrame(id) { rafs.delete(id); },
    setTimer(_delay, callback) { timers.set(++handle, callback); return handle; },
    clearTimer(id) { timers.delete(id); },
  };
  const host = new WallpaperHost(scheduler, { draw: () => { submissions++; } }, { presetId: 1 });
  return {
    host,
    get draws() { return submissions; },
    get pending() { return timers.size + rafs.size; },
    update(signals: WallpaperSignals = {}, elapsed = 0) {
      now += elapsed;
      host.update(signals);
    },
    flush() {
      now += 70_000;
      for (const [id, callback] of [...timers]) { timers.delete(id); callback(); }
      for (const [id, callback] of [...rafs]) { rafs.delete(id); callback(); }
    },
  };
}

test("OM project closes three models and all six useful, non-echo claims", () => {
  const result = om("check", project);
  expect(result.code).toBe(0);
  expect(result.data.operation_status).toBe("PROJECT_CLOSED");
  expect(result.data.models).toHaveLength(3);
  const claims: string[] = [];
  for (const model of result.data.models) {
    expect(model.verdict).toBe("CLOSED");
    for (const claim of model.semantic_result.claims) {
      expect(claim.status).toBe("HOLDS");
      expect(claim.guard_echo).toBe(false);
      claims.push(claim.name);
    }
    expect(model.semantic_result.vacuity.classes).toEqual(model.semantic_result.claims.map(() => "USEFUL_INVARIANT"));
  }
  expect(claims.sort()).toEqual(twins.map((twin) => twin[1]).sort());
});

type TraceAction = { action: string; changed?: Record<string, string> };

function replay(index: number, steps: TraceAction[]): void {
  const runtime = harness();
  let observed: number[] = [];
  let ceiling = 6;
  let assets = new WallpaperAssetBudget(48 * 1024 * 1024);
  const light = createLightInput({ id: 1, x: 0, y: 0, width: 32, height: 24, radius: 3 }, defaultLightPolicy);
  for (const step of steps) {
    const act = step.action;
    if (act === "request_mode_0") runtime.update({ baseMode: "calm" });
    else if (act === "settle") {
      runtime.flush();
      expect(runtime.host.heldTokens).toBe(0);
      expect(runtime.host.frameCallbacks).toBe(0);
    } else if (act === "hide") runtime.update({ hidden: true, baseMode: "calm" });
    else if (act === "static_frame") {
      const before = runtime.draws;
      runtime.flush();
      expect(runtime.draws).toBe(before);
    } else if (act === "open_channel") {
      runtime.update({ baseMode: "calm", voiceLevel: .8 });
      expect(runtime.host.heldTokens).toBe(1);
    } else if (act === "reduce_on") {
      const before = runtime.draws;
      runtime.update({ reducedMotion: true });
      runtime.flush();
      expect(runtime.host.heldTokens).toBe(0);
      expect(runtime.pending).toBe(0);
      expect(runtime.draws - before).toBeLessThanOrEqual(1);
    } else if (act === "encode_lossless") {
      const original = new Uint8Array([21, 167, 42, 0, 29, 18, 31, 255]);
      const encoded = encodeWallpaperLossless("qoi", original, 2, 1);
      expect(decodeWallpaperLossless("qoi", encoded).rgba).toEqual(original);
    } else if (act === "export_zenith") {
      runtime.host.runtime.resize(1920, 1080, 1);
      runtime.update({ baseMode: "calm" });
      const now = runtime.host.runtime.words.slice(LIGHT_BRIDGE() + 4, LIGHT_BRIDGE() + 64);
      if (observed.length > 0) expect(now).toEqual(observed);
      else observed = now;
      expect(bindWallpaperZenith(runtime.host.runtime.words, light)).toBe(0);
    } else if (act === "light_shade") {
      light[26] = 1; light[27] = 7; light[28] = 12; light[29] = 180; light[30] = 200; light[44] = 1;
      expect(shadeSurface(light, new Array(1352).fill(0), new Array(8).fill(0), new Array(14).fill(0))).toBe(0);
    } else if (act.startsWith("set_cap_")) {
      ceiling = Number(act.slice("set_cap_".length));
      assets = new WallpaperAssetBudget(ceiling * 8 * 1024 * 1024);
    } else if (act.startsWith("admit_asset_")) {
      const units = Number(act.slice("admit_asset_".length));
      expect(assets.reserve({}, units * 8 * 1024 * 1024)).toBe(units <= ceiling);
      if (units > ceiling) expect(assets.decodedBytes).toBe(0);
    } else throw new Error(`Unmapped twin action ${act} for ${twins[index]?.[0]}`);
  }
  runtime.host.dispose();
}

for (const [index, [file, claim]] of twins.entries()) {
  test(`OM twin ${file} refutes ${claim} and replays against the real runtime`, () => {
    const result = om("check", `${project}/twins/${file}.om`, "--stop-at-first");
    expect(result.code).toBe(2);
    expect(result.data.counterexample.claim).toBe(claim);
    expect(result.data.failing_claims).toEqual([claim]);
    replay(index, result.data.counterexample.steps);
  });
}

test("OM conform accepts an observed live, reduced and hidden runtime trace", () => {
  const h = harness();
  const trace: TraceAction[] = [];
  h.update({ baseMode: "calm", voiceState: "thinking" });
  expect(h.host.heldTokens).toBe(1);
  trace.push({ action: "request_mode_4" });
  h.flush();
  expect(h.host.frameCallbacks).toBe(1);
  trace.push({ action: "live_frame" });
  h.update({ reducedMotion: true });
  expect(h.host.heldTokens).toBe(0);
  trace.push({ action: "reduce_on" });
  expect(h.host.runtime.frameWord(16)).toBe(16384);
  trace.push({ action: "static_frame" });
  h.update({ hidden: true });
  expect(h.pending).toBe(0);
  trace.push({ action: "hide" });
  const before = h.draws;
  h.flush();
  expect(h.draws).toBe(before);
  trace.push({ action: "stale_callback" });
  const dir = mkdtempSync(join(tmpdir(), "wallpaper-conform-"));
  try {
    const file = join(dir, "trace.jsonl");
    writeFileSync(file, trace.map((step) => JSON.stringify(step)).join("\n") + "\n");
    const result = om("conform", `${project}/wake.om`, file);
    expect(result.code).toBe(0);
    expect(result.data.operation_status).toBe("CONFORMING");
  } finally { rmSync(dir, { force: true, recursive: true }); }
});
