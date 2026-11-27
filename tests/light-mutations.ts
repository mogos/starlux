import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const scene = "ss/light/scene.ss.ts";
const optics = "ss/light/optics.ss.ts";
const runtime = "src/light/runtime.ts";
const plan = "src/light/plan.ts";
const coreTests = "tests/light-core.test.ts";
const runtimeTests = "tests/light-runtime.test.ts";
const mutations = [
  ["hidden source dims bevel and caustic", runtime,
    "        if (shadeSurface(entry.input,",
    "        if (!this.#source.showLightSource) entry.input[31] = 0;\n        if (shadeSurface(entry.input,",
    runtimeTests, "runtime glyph toggle"],
  ["F0 zeroed", optics, "return f0 + (1 - f0)", "return 0 + (1 - 0)",
    coreTests, "Schlick normal incidence"],
  ["half intensity knee removed", optics, "return 1 / (1 + ratio * ratio)", "return 1 / (ratio * ratio)",
    coreTests, "half range and reference"],
  ["transmitted share dropped", optics, "return (1 - reflectance) * att", "return att",
    coreTests, "transmission uses"],
  ["recessed relief ignored", scene, "if (relief < 0) {", "if (false) {",
    coreTests, "transmission uses"],
  ["caustic placed on the lit wall", scene, "start + 96, edgeClip, farX, farY", "start + 96, edgeClip, nearX, nearY",
    coreTests, "transmission uses"],
  ["dirty comparison bypassed", runtime, "entry.dirty = !entry.painted || !same(entry.input, entry.before);", "entry.dirty = true;",
    runtimeTests, "clean flush and stationary"],
  ["settled flush retains a wake", runtime, "if (this.dirty || this.#animating()) this.#schedule();\n      else this.#retire();",
    "this.#schedule();", runtimeTests, "clean flush and stationary"],
  ["polarity swap ignored", scene, "const polarity = lightAt(input, 12);", "const polarity = 0;",
    coreTests, "polarity swaps exposure"],
  ["reduced mode follows input", runtime, "if (this.#disposed || this.#pinned()) return false;", "if (this.#disposed) return false;",
    runtimeTests, "reduced-motion static"],
  ["one semantic preset removed", "ss/light/catalog.ss.ts",
    /  \{ id: "ambient\.motion-pin",[^\n]+\n[^\n]+\n[^\n]+\n/, "",
    coreTests, "120 unique Astra presets"],
  ["device pixel split cap dropped", scene, "minLight(1.5, 2 / device)", "minLight(1.5, 2)",
    coreTests, "dispersion and blur"],
  ["nominal blur exceeds sixteen pixels", scene, "minLight(16, minLight(lightAt(input, 14), lightAt(input, 15)))",
    "minLight(lightAt(input, 14), lightAt(input, 15) + 16)", coreTests, "dispersion and blur"],
  ["a fifth role aliases pointer", "ss/light/types.ss.ts", "  return -1;", "  return 0;",
    coreTests, "canonical slots"],
  ["short buffer starts a partial packet", scene, "packet.length < lightPacketWords() || scene.length < lightSceneWords()", "scene.length < lightSceneWords()",
    coreTests, "ABI validates before writing"],
  ["inactive records retain garbage", scene, "packet[i] = 0;", "packet[i] = 9;",
    coreTests, "canonical slots"],
  ["stale callbacks ignore owner generation", runtime,
    "if (generation !== this.#generation || this.#disposed || this.#hidden) return;",
    "if (this.#disposed || this.#hidden) return;", runtimeTests, "stale callback cannot consume"],
  ["plan attenuation ignored", plan, "gain: step.gain * gain", "gain: step.gain",
    runtimeTests, "effect plans layer"],
  ["sequence overlaps its children", plan, "startUs: durationUs + step.startUs", "startUs: step.startUs",
    runtimeTests, "effect plans layer"],
  ["glyph toggle borrows a frame", runtime, "this.#source = { ...this.#source, showLightSource };\n    this.#renderGlyph();",
    "this.#source = { ...this.#source, showLightSource };\n    this.#renderGlyph();\n    this.#schedule();",
    runtimeTests, "runtime glyph toggle"],
] as const;

const temp = mkdtempSync(join(tmpdir(), "starlux-light-mutants-"));
try {
  cpSync("src", join(temp, "src"), { recursive: true });
  cpSync("ss", join(temp, "ss"), { recursive: true });
  mkdirSync(join(temp, "tests"));
  for (const file of [coreTests, runtimeTests, "tests/light-parity.ss.ts"]) cpSync(file, join(temp, file));
  const run = (file: string, filter: string) => {
    const result = Bun.spawnSync(["bun", "test", file, "--test-name-pattern", filter], { cwd: temp });
    return { code: result.exitCode, log: result.stdout.toString() + result.stderr.toString() };
  };
  for (const [name, file, needle, replacement, test, filter] of mutations) {
    const path = join(temp, file);
    const source = readFileSync(path, "utf8");
    const anchors = typeof needle === "string" ? source.split(needle).length - 1 : [...source.matchAll(new RegExp(needle.source, "g"))].length;
    assert.equal(anchors, 1, "Expected one source mutation anchor for " + name);
    writeFileSync(path, source.replace(needle, replacement));
    const red = run(test, filter);
    assert.equal(red.code, 1, name + "\n" + red.log);
    assert.ok(red.log.includes("(fail) " + filter) && /\b1 fail\b/.test(red.log), name + "\n" + red.log);
    writeFileSync(path, source);
    const green = run(test, filter);
    assert.equal(green.code, 0, name + "\n" + green.log);
    assert.ok(green.log.includes("(pass) " + filter) && /\b1 pass\b/.test(green.log), name + "\n" + green.log);
    console.log(name + " red=1 green=0");
  }
  console.log(`${mutations.length}/${mutations.length} light source mutants killed`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
