import { paintLightSource } from "../ss/light/glyph.ss.ts";
import { lightUNorm, schlickReflectance, lightFalloff, transmittedCaustic } from "../ss/light/optics.ss.ts";
import { shadeSurface, writeLightBytes } from "../ss/light/scene.ss.ts";
import { lightStepGain } from "../ss/light/plan.ss.ts";

export function main(): readonly number[] {
  budget({ instructions: 1000000000, allocations: 10000000, outputBytes: 1048576 });
  const physical: number[] = [];
  const shown: number[] = [];
  const hidden: number[] = [];
  const sceneA: number[] = [];
  const sceneB: number[] = [];
  const scratchA: number[] = [];
  const scratchB: number[] = [];
  const glyph = [0, 0, 0, 0];
  const bytes: number[] = [];
  const output: number[] = [];
  let errors = 0;
  for (let i = 0; i < 106; i++) physical.push(0);
  for (let i = 0; i < 1352; i++) {
    shown.push(0);
    hidden.push(0);
  }
  for (let i = 0; i < 5408; i++) bytes.push(0);
  for (let i = 0; i < 14; i++) {
    scratchA.push(0);
    scratchB.push(0);
  }
  for (let i = 0; i < 8; i++) {
    sceneA.push(0);
    sceneB.push(0);
  }
  output.push(lightUNorm(schlickReflectance(.04, 1)));
  output.push(lightUNorm(lightFalloff(430, 430)));
  output.push(lightUNorm(transmittedCaustic(.04, 1, 1, 1)));
  output.push(lightStepGain(.5, 0, 0, 100, .8, false, false));
  physical[6] = 1; physical[9] = 1;
  physical[13] = 1; physical[14] = 19; physical[15] = 16;
  physical[18] = 1; physical[19] = 1; physical[20] = 2; physical[21] = 3;
  physical[22] = 4; physical[23] = 5; physical[24] = 32; physical[25] = 24;
  for (let k = 0; k < 4; k++) {
    const slot = 26 + k * 20;
    physical[slot] = 1;
    physical[slot + 1] = 200 * k;
    physical[slot + 2] = -300 * k;
    physical[slot + 3] = 180 - 10 * k;
    physical[slot + 4] = 430 + 20 * k;
    physical[slot + 5] = 1 / (k + 1);
    physical[slot + 6] = .04 + .015 * k;
    physical[slot + 7] = 35 + k * 7;
    physical[slot + 8] = 1.5;
    physical[slot + 9] = 1; physical[slot + 10] = .86; physical[slot + 11] = .72;
    physical[slot + 12] = .14; physical[slot + 13] = 1; physical[slot + 14] = 1;
    physical[slot + 15] = 1 + k * 2; physical[slot + 16] = .018;
    physical[slot + 17] = 4294967295 - k; physical[slot + 18] = 1;
    physical[slot + 19] = k === 1 ? .08 : 0;
  }
  let rng = 7;
  let hash = 0;
  for (let frame = 0; frame < 1024; frame++) {
    rng = (rng * 16807) % 2147483647;
    const x = rng % 1300 - 500;
    rng = (rng * 16807) % 2147483647;
    const y = rng % 1000 - 400;
    physical[0] = frame;
    physical[3] = 400 - (frame % 6) * 21;
    physical[4] = 52 + (frame % 6) * 43;
    physical[5] = (frame % 6) * 11;
    physical[7] = (frame % 3) * .125;
    physical[8] = -(frame % 3) * .125;
    physical[10] = frame % 2 === 0 ? 1 : -1;
    physical[11] = frame % 3 === 0 ? 0 : 1;
    physical[12] = frame % 2;
    physical[13] = .5 + (frame % 8);
    physical[16] = frame % 4;
    physical[17] = frame % 7 === 0 ? 1 : 0;
    physical[30] = 84 + frame % 617;
    physical[32] = .025 + (frame % 34) / 1000;
    physical[33] = frame % 81;
    physical[34] = (frame % 16) / 10;
    physical[27] = x;
    physical[28] = y;
    errors += shadeSurface(physical, shown, sceneA, scratchA) === 0 ? 0 : 1;
    errors += paintLightSource(true, true, x, y, glyph) === 1 ? 0 : 1;
    errors += shadeSurface(physical, hidden, sceneB, scratchB) === 0 ? 0 : 1;
    errors += paintLightSource(false, true, x, y, glyph) === 0 ? 0 : 1;
    for (let i = 0; i < 1352; i++) {
      const word = shown[i] ?? 0;
      if (word !== (hidden[i] ?? 0)) errors += 1;
      hash = (hash * 257 + word + 2147483648) % 2147483647;
    }
    for (let j = 0; j < 8; j++) {
      const word = sceneA[j] ?? 0;
      if (word !== (sceneB[j] ?? 0)) errors += 1;
      hash = (hash * 257 + word + 2147483648) % 2147483647;
    }
    // Complete little-endian vectors supplement the trajectory digest.
    if (frame > 0 && frame < 5) {
      errors += writeLightBytes(shown, bytes) === 0 ? 0 : 1;
      for (let i = 0; i < 5408; i++) output.push(bytes[i] ?? 0);
    }
  }
  output.push(hash);
  output.push(errors);
  return output;
}
