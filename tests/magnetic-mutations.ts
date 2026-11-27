import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const work = mkdtempSync(resolve(tmpdir(), "starlux-magnetic-mutation-"));
const tiling = "ss/magnetic_tiling.ss.ts";
const cases = [
  ["R29 mid-fade", tiling, "magneticSmooth(0.06, 0.48, u)", "magneticSmooth(0.06, 0.78, u)", "R29 empty glass"],
  ["neighbor overshoot", tiling, "if (monotone) velocity = Math.sign(delta) * clamp",
    "if (false) velocity = Math.sign(delta) * clamp", "neighbor overshoot"],
  ["idle rAF leak", "src/dom/magnetic-controller.ts", "heldTokens: engine.metrics().heldTokens, motionEnergy: 1",
    "heldTokens: 1, motionEnergy: 1", "IdleFalsifier"],
  ["absorb miss", tiling, "state.m.position < 0.88 && m.position >= 0.88",
    "state.m.position < 1.2 && m.position >= 1.2", "absorb crossing"],
  ["stuck translucent open pane", tiling, "glass: visible, content: visible *", "glass: visible * 0.9, content: visible *",
    "interrupted flights"],
  ["settled dock pane visible", tiling, "!magneticMoving(state.m) && state.m.position >= 1",
    "false && state.m.position >= 1", "interrupted flights"],
  ["snap threshold bypassed", tiling, "> 3 * (speed * dtUs", "> 4 * (speed * dtUs", "analytic snap audit"],
] as const;

function test(name: string) {
  return Bun.spawnSync([process.execPath, "test", "tests/magnetic.test.ts", "-t", name], {
    cwd: work, stdout: "pipe", stderr: "pipe",
  });
}

try {
  for (const directory of ["c", "ss", "src", "tests"]) {
    cpSync(resolve(root, directory), resolve(work, directory), { recursive: true });
  }
  cpSync(resolve(root, "package.json"), resolve(work, "package.json"));
  for (const [name, file, original, mutation, target] of cases) {
    const path = resolve(work, file);
    const source = readFileSync(path, "utf8");
    assert.equal(source.split(original).length, 2, "Ambiguous mutation anchor for " + name);
    writeFileSync(path, source.replace(original, mutation));
    const red = test(target);
    assert.equal(red.exitCode, 1, name + " survived:\n" + red.stderr.toString());
    assert.ok(red.stderr.toString().includes("(fail) " + target) &&
      red.stderr.toString().includes("error: expect("), name + " failed outside its assertion");
    writeFileSync(path, source);
    const green = test(target);
    assert.equal(green.exitCode, 0, name + " clean run:\n" + green.stderr.toString());
    assert.ok(green.stderr.toString().includes("(pass) " + target));
    console.log(name + " red=" + red.exitCode + " green=" + green.exitCode);
  }
  console.log(cases.length + "/" + cases.length + " magnetic source mutants killed");
} finally {
  rmSync(work, { recursive: true, force: true });
}
