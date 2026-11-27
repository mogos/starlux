import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { relative, resolve } from "node:path";
import { defaultSpatialKnobs } from "../ss/lux/knobs.ss.ts";

const root = resolve(import.meta.dir, "..");
const isolated = mkdtempSync(resolve(tmpdir(), "starlux-mutation-"));
const defaults = defaultSpatialKnobs();
const knobs = Object.entries(defaults).filter(([, value]) => typeof value === "number");

function run(where: string, knob: string) {
  return Bun.spawnSync([process.execPath, resolve(where, "tests/knob-probe.ts"), knob], {
    cwd: where, stdout: "pipe", stderr: "pipe",
  });
}

// These insertion points follow the feature guard and precede actual work.
const work = [
  ["enableSprings", "physics/spring.ss.ts", "  let response = knobs.springResponseMs;"],
  ["enableMagnetism", "physics/magnet.ss.ts", "  const speed = Math.sqrt(vx * vx + vy * vy);"],
  ["enableRubberBand", "physics/rubber.ss.ts", "  const speedX = finiteBound(vx, 12000);"],
  ["enableOrganicTilt", "physics/organic.ss.ts", "    const tiltScale = knobs.tiltVelocityScale;"],
  ["enableInertialSquash", "physics/organic.ss.ts", "    const stretch = clamp("],
  ["enableEmptyGlassMinimize", "physics/organic.ss.ts", "    content = clamp01("],
  ["enableDockImpulse", "physics/organic.ss.ts", "    impulse = knobs.dockImpulseScale;"],
  ["enableCoupledNeighbors", "physics/magnet.ss.ts", "  const pressure = (knobs.magnetRadiusPx"],
  ["enableSpecularRim", "physics/organic.ss.ts", "    rim = (perspective - z)"],
  ["enableLivingBackdrop", "living-state.ss.ts", "  const thermal = thermalLevel("],
] as const;

try {
  cpSync(resolve(root, "ss"), resolve(isolated, "ss"), { recursive: true });
  cpSync(resolve(root, "tests/knob-probe.ts"), resolve(isolated, "tests/knob-probe.ts"));
  const sources = readdirSync(resolve(root, "ss"), { recursive: true, encoding: "utf8" })
    .filter((path) => path.endsWith(".ss.ts"))
    .map((path) => ({ path: resolve(isolated, "ss", path), text: readFileSync(resolve(root, "ss", path), "utf8") }));
  assert.equal(knobs.length, 44);

  // Red before green: each single knob is frozen to its baseline in every consumer.
  for (const [key, value] of knobs) {
    const use = new RegExp("\\bknobs\\." + key + "\\b", "g");
    const mutated = sources.filter((source) => source.text.search(use) !== -1);
    assert.ok(mutated.length > 0, "no source use for " + key);
    for (const source of mutated) writeFileSync(source.path, source.text.replace(use, String(value)));
    const red = run(isolated, key);
    assert.equal(red.exitCode, 42, key + " mutant: " + red.stderr.toString());
    assert.equal(red.stderr.toString().trim(), "no-observable-effect " + key);
    for (const source of mutated) writeFileSync(source.path, source.text);
    const green = run(isolated, key);
    assert.equal(green.exitCode, 0, key + " baseline: " + green.stderr.toString());
  }
  console.log("44/44 isolated single-knob source mutants killed");

  for (const [key, file, anchor] of work) {
    const path = resolve(isolated, "ss", file);
    const source = readFileSync(path, "utf8");
    assert.equal(source.split(anchor).length, 2, relative(root, path) + ": " + key);
    writeFileSync(path, source.replace(anchor, '  globalThis.__starluxFeatureWork("' + key + '");\n' + anchor));
  }
  const flags = run(isolated, "--flags");
  assert.equal(flags.exitCode, 0, flags.stderr.toString());
  process.stdout.write(flags.stdout);
} finally {
  rmSync(isolated, { recursive: true, force: true });
}
