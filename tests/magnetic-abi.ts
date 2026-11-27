import assert from "node:assert/strict";
import { magneticFrameFlat } from "../ss/magnetic_abi.ss.ts";
import { instantiateMagneticWasm } from "../c/magnetic-wasm.js";

const binary = process.argv[2];
assert.ok(binary);
const c = Bun.spawnSync([binary]);
assert.equal(c.exitCode, 0, c.stderr.toString());
const wasm = await instantiateMagneticWasm();
const input = Array<number>(76).fill(0);
input.splice(2, 4, 80, 80, 420, 350);
input.splice(10, 4, 600, 860, 60, 44);
const frames = new Float64Array(320 * 93);
for (let i = 0; i < 320; i++) {
  input[0] = 1;
  input[1] = 8333;
  if (i === 0) input[0] = 0;
  if (i === 1) {
    input[0] = 2;
    input[4] = 640;
    input[6] = 0.52;
    input[7] = 1;
  }
  if (i === 20 || i === 38) {
    input[0] = 4;
    input[8] = Number(i === 20);
    input[6] = input[8];
  }
  if (i === 50 || i === 180) {
    input[0] = 3;
    input[8] = Number(i === 50);
  }
  if (i === 250) input[0] = 6;
  if (i === 295) { input[0] = 5; input[8] = 1; }
  const frame = magneticFrameFlat(input);
  assert.equal(frame.length, 93);
  assert.deepEqual(wasm.starluxMagneticFrame(Float64Array.from(input)), frame, "WASM frame " + i);
  frames.set(frame, i * 93);
  input.splice(14, 62, ...frame.slice(0, 62));
}
assert.deepEqual(c.stdout, Buffer.from(frames.buffer));
console.log("320 flat binary64 frames match across TypeScript, the WASM library and both C header standards");
