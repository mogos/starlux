import { expect, test } from "bun:test";
import { Buffer } from "node:buffer";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createLightInput,
  defaultLightPolicy,
  encodeLightInput,
  instantiateLightWasm,
  lightWasm,
  shadeSurface,
  writeLightBytes,
} from "../src/light/index.ts";

test("C11 and C17 callers match the Starscript packets without allocation", () => {
  const temp = mkdtempSync(join(tmpdir(), "starlux-light-native-"));
  try {
    const build = Bun.spawnSync(["bash", "c/light/build.sh", temp]);
    expect(build.exitCode, build.stderr.toString()).toBe(0);
    const inputBytes = [];
    const outputBytes = [];
    const output = new Array<number>(1352).fill(0);
    const scene = new Array<number>(8).fill(0);
    const scratch = new Array<number>(14).fill(0);
    const encoded = new Array<number>(5408).fill(0);
    for (let i = 0; i < 96; i++) {
      const surface = { id: i, x: 48, y: 91, width: 425, height: 22 + i, radius: i % 30, blurPx: 20,
        transform: [1, (i % 3) / 4, -.25, .85] as const, relief: i % 3 === 0 ? "recessed" as const : "raised" as const };
      const policy = { ...defaultLightPolicy, deviceScale: 1 + (i % 8),
        polarity: i % 2 === 0 ? "obsidian-dark" as const : "sunlit-alabaster-light" as const };
      const input = createLightInput(surface, policy, {
        pointer: { x: i * 11 - 200, y: -600 + i * 13, dispersion: 1.5 },
        star: { x: 52, y: 1238, gain: .7, dispersion: 1.5 },
        focus: { x: -30, y: 129, gain: .2, color: [1, 0, .2] },
      });
      const wire = new Uint8Array(856);
      expect(encodeLightInput(input, wire)).toBe(0);
      inputBytes.push(wire);
      expect(shadeSurface(input, output, scene, scratch)).toBe(0);
      expect(writeLightBytes(output, encoded)).toBe(0);
      outputBytes.push(Uint8Array.from(encoded));
    }
    const input = Buffer.concat(inputBytes);
    const expected = Buffer.concat(outputBytes);
    for (const standard of ["c11", "c17"]) {
      const exe = join(temp, "smoke-" + standard);
      const compile = Bun.spawnSync([process.env.CC ?? "cc", "-std=" + standard, "-Wall", "-Wextra", "-Werror", "-pedantic",
        "-I", temp, "c/light/smoke.c", join(temp, "libstarlux_light.a"), "-Wl,--wrap=malloc", "-lm", "-o", exe]);
      expect(compile.exitCode, compile.stderr.toString()).toBe(0);
      const run = Bun.spawnSync([exe], { stdin: input });
      expect(run.exitCode, run.stderr.toString()).toBe(0);
      expect(run.stdout.equals(expected)).toBe(true);
      console.log(standard.toUpperCase() + " ABI | 96 exact packets | short output preserved | 0 malloc calls");
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}, 60_000);

test("source-mode lightWasm resolves dist/wasm/light/entry.ss.wasm and matches shadeSurface", async () => {
  const wasmFile = fileURLToPath(lightWasm);
  if (!existsSync(wasmFile)) {
    const buildWasm = Bun.spawnSync(["bash", "c/light/build-wasm.sh", "dist/wasm/light"]);
    expect(buildWasm.exitCode, buildWasm.stderr.toString()).toBe(0);
  }
  expect(existsSync(wasmFile)).toBe(true);
  const wasm = await instantiateLightWasm();
  const input = createLightInput(
    { id: 7, x: 24, y: 40, width: 320, height: 140, radius: 16, blurPx: 18 },
    defaultLightPolicy,
    { pointer: { x: 120, y: 60, dispersion: 1.4 } },
  );
  const output = new Array<number>(1352).fill(0);
  const scene = new Array<number>(8).fill(0);
  const scratch = new Array<number>(14).fill(0);
  expect(shadeSurface(input, output, scene, scratch)).toBe(0);
  const res = wasm.starluxLightFrame(input);
  expect(res.status).toBe(0);
  expect(Array.from(res.packet)).toEqual(output);
  expect(Array.from(res.scene)).toEqual(scene);
}, 60_000);
