import { projectLight } from "./geometry.ss.ts";
import {
  bevelSpecular, clampLight, lightAt, lightFalloff, lightUNorm, materialEdgeLuminance, maxLight, minLight,
  roundLightEven, schlickReflectance, sqrtLight, transmittedCaustic, unitLight,
} from "./optics.ss.ts";
import { lightInputWords, lightPacketWords, lightSceneWords, lightScratchWords } from "./types.ss.ts";

function bounded(n: number, lo: number, hi: number): boolean { return n >= lo && n <= hi; }
function indexWord(n: number, hi: number): boolean { return bounded(n, 0, hi) && Math.floor(n) === n; }

export function validLightInput(input: readonly number[]): boolean {
  if (input.length !== lightInputWords()) return false;
  for (let i = 0; i < 106; i++) {
    if (!bounded(lightAt(input, i), -4294967295, 4294967295) || input[i] === undefined) return false;
  }
  if (!indexWord(lightAt(input, 0), 4294967295)) return false;
  for (let i = 1; i <= 5; i++) {
    if (!bounded(lightAt(input, i), -32767, 32767)) return false;
  }
  for (let i = 6; i <= 9; i++) {
    if (!bounded(lightAt(input, i), -16, 16)) return false;
  }
  if (!bounded(lightAt(input, 10), -1, 1) || !indexWord(lightAt(input, 11), 1)
    || !indexWord(lightAt(input, 12), 1) || !bounded(lightAt(input, 13), .5, 8)
    || !bounded(lightAt(input, 14), 0, 4096) || !bounded(lightAt(input, 15), 0, 4096)
    || !indexWord(lightAt(input, 16), 3) || !indexWord(lightAt(input, 17), 1)
    || !bounded(lightAt(input, 18), 0, 1)) return false;
  for (let i = 19; i <= 23; i++) {
    if (!indexWord(lightAt(input, i), 4294967295)) return false;
  }
  if (!bounded(lightAt(input, 24), -32767, 32767) || !bounded(lightAt(input, 25), -32767, 32767)) return false;
  for (let slot = 0; slot < 4; slot++) {
    const s = 26 + slot * 20;
    const active = lightAt(input, s);
    if (!indexWord(active, 1)) return false;
    if (active === 1) {
      if (!bounded(lightAt(input, s + 1), -32767, 32767) || !bounded(lightAt(input, s + 2), -32767, 32767)
        || !bounded(lightAt(input, s + 3), .00390625, 32767) || !bounded(lightAt(input, s + 4), .00390625, 32767)
        || !bounded(lightAt(input, s + 5), 0, 2) || !bounded(lightAt(input, s + 6), 0, 1)
        || !indexWord(lightAt(input, s + 7), 80) || !bounded(lightAt(input, s + 8), 0, 16)
        || !indexWord(lightAt(input, s + 15), 7) || !bounded(lightAt(input, s + 16), 0, .05)
        || !indexWord(lightAt(input, s + 17), 4294967295) || !bounded(lightAt(input, s + 18), .25, 2)
        || !bounded(lightAt(input, s + 19), 0, 1)) return false;
      for (let i = 9; i <= 14; i++) {
        if (!bounded(lightAt(input, s + i), 0, 1)) return false;
      }
    }
  }
  return true;
}

function qpx(value: number): number {
  return roundLightEven(clampLight(value * 256, -2147483648, 2147483647));
}

function writeLane(
  out: number[], start: number, clip: number, x: number, y: number, tx: number, ty: number,
  major: number, minor: number, blur: number, gain: number, r: number, g: number, b: number, path: number, blend: number,
): number {
  const energy = lightUNorm(gain);
  if (energy === 0) return 0;
  out[start] = 1; out[start + 1] = clip;
  out[start + 2] = qpx(x); out[start + 3] = qpx(y);
  out[start + 4] = roundLightEven(tx * 32767); out[start + 5] = roundLightEven(ty * 32767);
  out[start + 6] = qpx(major); out[start + 7] = qpx(minor); out[start + 8] = qpx(blur);
  out[start + 9] = energy;
  out[start + 10] = lightUNorm(r); out[start + 11] = lightUNorm(g); out[start + 12] = lightUNorm(b);
  out[start + 13] = path; out[start + 14] = blend;
  return 1;
}

function shadeSlot(
  input: readonly number[], slot: number, pinned: boolean, packet: number[], scene: number[], scratch: number[],
): number {
  const s = 26 + slot * 20;
  let x = lightAt(input, s + 1);
  let y = lightAt(input, s + 2);
  if (pinned && slot !== 3) {
    x = lightAt(input, 24);
    y = lightAt(input, 25);
  }
  projectLight(input, x, y, scratch);
  let nearX = lightAt(scratch, 0);
  let nearY = lightAt(scratch, 1);
  let farX = lightAt(scratch, 2);
  let farY = lightAt(scratch, 3);
  let tx = lightAt(scratch, 4);
  let ty = lightAt(scratch, 5);
  const d = lightAt(scratch, 6);
  const px = lightAt(scratch, 7);
  const py = lightAt(scratch, 8);
  const relief = lightAt(input, 10);
  const h = lightAt(input, s + 3);
  const length = sqrtLight(d * d + h * h);
  const cosI = h / length;
  const f0 = lightAt(input, s + 6);
  const reflectance = schlickReflectance(f0, cosI);
  const att = lightFalloff(d, lightAt(input, s + 4));
  const over = d === 0 ? 1 : 0;
  const spec = bevelSpecular(d / length, cosI, lightAt(input, s + 7));
  let intensity = unitLight(spec * att / .72) * (.72 + .28 * unitLight(reflectance / .25));
  if (relief < 0) {
    nearX = lightAt(scratch, 2); nearY = lightAt(scratch, 3);
    farX = lightAt(scratch, 0); farY = lightAt(scratch, 1);
    tx = -tx; ty = -ty;
    intensity *= .75;
  }
  intensity += .2 * over;

  const tier = lightAt(input, 16);
  const tangentX = lightAt(input, 6) * tx + lightAt(input, 8) * ty;
  const tangentY = lightAt(input, 7) * tx + lightAt(input, 9) * ty;
  const tangentScale = sqrtLight(tangentX * tangentX + tangentY * tangentY);
  const w = lightAt(input, 3);
  const height = lightAt(input, 4);
  const radius = clampLight(lightAt(input, 5), 0, minLight(w, height) / 2);
  const size = lightAt(input, s + 18);
  let major = clampLight(radius * 1.25, 12, 60) * size;
  if (lightAt(input, 11) !== 0) major = clampLight(70 + .5 * d, 70, 300) * size / tangentScale;
  const minor = minLight(major, .55 * minLight(w, height));
  const blur = minLight(16, minLight(lightAt(input, 14), lightAt(input, 15)));
  const polarity = lightAt(input, 12);
  const guard = lightAt(input, 18);
  // A uniform worst-case budget across the four emitters and all optical families.
  const protectedGain = guard < 1 ? guard / 28 : 1;
  const gain = lightAt(input, s + 5) * protectedGain;
  const red = lightAt(input, s + 9);
  const green = lightAt(input, s + 10);
  const blue = lightAt(input, s + 11);
  const highlight = polarity === 1 ? .55 : 1;
  const transmission = polarity === 1 ? .70 : 1;
  const pool = (1 - reflectance) * lightAt(input, s + 12) * gain;
  const bevel = intensity * lightAt(input, s + 13) * gain * highlight;
  const rim = reflectance * att * gain * highlight;
  const caustic = transmittedCaustic(reflectance, att, over, gain) * lightAt(input, s + 14) * transmission;
  const faceClip = lightAt(input, 19);
  const path = lightAt(input, s + 17);
  const mask = lightAt(input, s + 15);
  const device = lightAt(input, 13);
  // Two independently rounded centers can expand the separation by sqrt(2)/256 local px.
  const a = lightAt(input, 6);
  const b = lightAt(input, 7);
  const c = lightAt(input, 8);
  const e = lightAt(input, 9);
  const pointError = (sqrtLight(a * a + b * b) + sqrtLight(c * c + e * e)) / 256;
  let split = minLight(lightAt(input, s + 8) * (1 - cosI), maxLight(0, minLight(1.5, 2 / device) - pointError));
  if (pinned || tier >= 2) split = 0;
  if (polarity === 1) split *= .5;
  const halfSplit = split / (2 * tangentScale);
  const ambient = lightAt(input, s + 19) * gain * (polarity === 1 ? .5 : 1);
  scratch[9] = lightAt(scratch, 9) + ambient * red;
  scratch[10] = lightAt(scratch, 10) + ambient * green;
  scratch[11] = lightAt(scratch, 11) + ambient * blue;

  if (slot === 0) {
    scene[0] = qpx(x); scene[1] = qpx(y); scene[2] = qpx(h * 1.25); scene[3] = lightUNorm(pool);
    const offset = lightAt(input, s + 16);
    scene[4] = qpx(clampLight((w / 2 - px) * offset, -24, 24));
    scene[5] = qpx(clampLight((height / 2 - py) * offset, -24, 24));
  }
  for (let segment = 0; segment < 3; segment++) {
    const bit = segment === 0 ? 1 : (segment === 1 ? 2 : 4);
    const edgeClip = lightAt(input, 20 + segment);
    if (Math.floor(mask / bit) % 2 !== 0 && (segment === 0 || edgeClip !== 0)) {
      const start = 8 + (slot * 3 + segment) * 112;
      if (segment === 0 && tier < 2) {
        const poolRadius = h * 1.25 / tangentScale;
        writeLane(packet, start, faceClip, px, py, 1, 0, poolRadius, poolRadius, blur, pool, red, green, blue, path, 0);
      }
      const tone = materialEdgeLuminance(polarity);
      if (polarity === 1) {
        writeLane(packet, start + 16, edgeClip, nearX, nearY, tx, ty, major, minor, blur, bevel, tone, tone, tone, path, 2);
      } else {
        writeLane(packet, start + 16, edgeClip, nearX, nearY, tx, ty, major, minor, blur, bevel, red, green, blue, path, 1);
      }
      if (halfSplit > 0 && (qpx(nearX + tx * halfSplit) !== qpx(nearX - tx * halfSplit)
        || qpx(nearY + ty * halfSplit) !== qpx(nearY - ty * halfSplit))) {
        writeLane(packet, start + 48, edgeClip, nearX + tx * halfSplit, nearY + ty * halfSplit,
          tx, ty, major, minor, blur, rim, red, 0, 0, path, 1);
        writeLane(packet, start + 64, edgeClip, nearX, nearY, tx, ty, major, minor, blur, rim, 0, green, 0, path, 1);
        writeLane(packet, start + 80, edgeClip, nearX - tx * halfSplit, nearY - ty * halfSplit,
          tx, ty, major, minor, blur, rim, 0, 0, blue, path, 1);
      } else {
        writeLane(packet, start + 32, edgeClip, nearX, nearY, tx, ty, major, minor, blur, rim, red, green, blue, path, 1);
      }
      if (tier < 2) {
        writeLane(packet, start + 96, edgeClip, farX, farY, -tx, -ty, .9 * major, .9 * minor,
          blur, caustic, red, green * .62, blue * .28, path, polarity === 1 ? 2 : 1);
      }
    }
  }
  return 0;
}

// Caller-owned buffers must be disjoint. A negative status leaves all buffers unchanged.
// This function's complete input schema is physical. Glyph visibility never enters it.
export function shadeSurface(input: readonly number[], packet: number[], scene: number[], scratch: number[]): number {
  if (packet.length < lightPacketWords() || scene.length < lightSceneWords() || scratch.length < lightScratchWords()) return -4;
  if (!validLightInput(input)) return -3;
  for (let i = 0; i < 1352; i++) packet[i] = 0;
  for (let i = 0; i < 8; i++) scene[i] = 0;
  const w = lightAt(input, 3);
  const h = lightAt(input, 4);
  const determinant = lightAt(input, 6) * lightAt(input, 9) - lightAt(input, 7) * lightAt(input, 8);
  packet[0] = 1; packet[1] = 5408; packet[2] = lightAt(input, 0);
  if (w <= 0 || h <= 0 || (determinant > -.000001 && determinant < .000001)) return 0;
  packet[7] = lightAt(input, 23);
  scratch[9] = 0; scratch[10] = 0; scratch[11] = 0;
  const pinned = lightAt(input, 17) === 1 || lightAt(input, 16) >= 3;
  const hasZenith = lightAt(input, 46) === 1;
  let active = 0;
  let bit = 1;
  for (let slot = 0; slot < 4; slot++) {
    const s = 26 + slot * 20;
    if (lightAt(input, s) === 1 && (!pinned || slot === 1 || slot === 3 || (slot === 0 && !hasZenith))) {
      if (lightAt(input, s + 5) > 0) {
        active += bit;
        shadeSlot(input, slot, pinned, packet, scene, scratch);
      }
    }
    bit *= 2;
  }
  packet[3] = active;
  packet[4] = lightUNorm(lightAt(scratch, 9));
  packet[5] = lightUNorm(lightAt(scratch, 10));
  packet[6] = lightUNorm(lightAt(scratch, 11));
  scene[6] = lightUNorm(materialEdgeLuminance(lightAt(input, 12)));
  return 0;
}

export function writeLightBytes(packet: readonly number[], bytes: number[]): number {
  if (packet.length < lightPacketWords() || bytes.length < 5408) return -4;
  for (let i = 0; i < 1352; i++) {
    let word = lightAt(packet, i);
    if (word < 0) word += 4294967296;
    for (let j = 0; j < 4; j++) {
      bytes[i * 4 + j] = word % 256;
      word = Math.floor(word / 256);
    }
  }
  return 0;
}
