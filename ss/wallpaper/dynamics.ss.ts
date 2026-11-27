import { clamp, q16, roundEven, smooth } from "./color.ss.ts";
import { exportZenith } from "./light_bridge.ss.ts";
import { baseColor, layerEnvelope } from "./layers.ss.ts";
import { crcByte, recipeWord, validRecipe, writeLE } from "./recipe.ss.ts";
import { nextSolarBoundary, solarBucket } from "./solar.ss.ts";
import {
  BAD_ARGUMENT, BAD_INPUT, CONFIG, FRAME, INPUT, LAYERS, LIGHT_BRIDGE, NO_DEADLINE, SHORT_OUTPUT, STATE,
  UNSUPPORTED_SCHEMA, WORKSPACE_WORDS, inRange, ceilInt, integer, mod, word, zeroWords,
} from "./types.ss.ts";

function setting(w: readonly number[], at: number): number { return word(w, CONFIG() + at); }
function signal(w: readonly number[], at: number): number { return word(w, INPUT() + at); }
function state(w: readonly number[], at: number): number { return word(w, STATE() + at); }
function save(w: number[], at: number, value: number): void { w[STATE() + at] = value; }

export function governFps(thermal: number, cap: number): number {
  return Math.min(cap, thermal === 0 ? 15 : thermal === 1 ? 10 : thermal === 2 ? 5 : 0);
}

export function governLod(thermal: number, ceiling: number): number {
  return Math.min(ceiling, thermal === 0 ? 3 : thermal === 1 ? 2 : thermal === 2 ? 1 : 0);
}

function validSnapshot(w: readonly number[]): boolean {
  for (let i = 0; i < 48; i++) {
    if (!inRange(setting(w, i), -65535, 4294967295) || w[CONFIG() + i] === undefined) return false;
  }
  for (let i = 0; i < 64; i++) {
    if (!inRange(signal(w, i), -9007199254740991, 9007199254740991) || w[INPUT() + i] === undefined) return false;
    if (i >= 41 && i <= 62 && signal(w, i) !== 0) return false;
  }
  if (setting(w, 47) !== 0 || !integer(setting(w, 1), 0, 200) || !integer(setting(w, 2), 0, 2)
    || !integer(setting(w, 3), 0, 1) || !inRange(setting(w, 4), .5, 1.25)
    || !integer(setting(w, 5), 0, 15) || !inRange(setting(w, 6), .1, .95)
    || !inRange(setting(w, 7), 0, .6) || !inRange(setting(w, 8), 0, .25)
    || !inRange(setting(w, 9), .5, 2) || !inRange(setting(w, 10), 0, 24)
    || !inRange(setting(w, 11), 120, 1200) || !inRange(setting(w, 12), .7, 1.5)
    || !integer(setting(w, 13), 0, 2) || !inRange(setting(w, 14), 3, 7)
    || !inRange(setting(w, 15), 0, .72) || !integer(setting(w, 16), 0, 2)
    || !inRange(setting(w, 17), 0, 1) || !inRange(setting(w, 18), 0, 16)
    || !integer(setting(w, 19), 0, 2) || !inRange(setting(w, 20), -90, 90)
    || !inRange(setting(w, 21), -180, 180) || !integer(setting(w, 22), -840, 840)
    || !integer(setting(w, 23), 0, 15) || !inRange(setting(w, 24), 0, 4000)
    || !integer(setting(w, 26), 1, 16) || !integer(setting(w, 25), 0, setting(w, 26) - 1)
    || !integer(setting(w, 27), 0, 2) || !integer(setting(w, 28), -65535, 65535)
    || !integer(setting(w, 29), -65535, 65535) || !integer(setting(w, 30), 1, 65535)
    || !integer(setting(w, 31), 1, 65535) || !integer(setting(w, 32), 1, 16384)
    || !integer(setting(w, 33), 1, 16384) || !inRange(setting(w, 34), 0, 240)
    || !integer(setting(w, 35), 0, 1) || !integer(setting(w, 36), 0, 1)
    || !integer(setting(w, 37), 0, 255) || !inRange(setting(w, 38), 0, 2) || !inRange(setting(w, 39), 0, 2)
    || !integer(setting(w, 40), 0, 1) || !integer(setting(w, 41), 0, 3) || !integer(setting(w, 42), 0, 3)
    || !inRange(setting(w, 43), 8, 96) || !integer(setting(w, 44), 0, 4294967295)
    || !inRange(setting(w, 45), 0, 1) || !integer(setting(w, 46), 0, 1)) return false;
  if (!integer(signal(w, 0), 0, 4294967295) || !integer(signal(w, 1), state(w, 10), 9007199254740991)
    || !integer(signal(w, 2), -8640000000000, 8640000000000) || !integer(signal(w, 6), 0, 3)
    || !integer(signal(w, 7), 0, 2) || !integer(signal(w, 8), 0, 7)
    || !inRange(signal(w, 28), -32767, 32767) || !inRange(signal(w, 29), -32767, 32767)
    || !inRange(signal(w, 32), -32767, 32767) || !inRange(signal(w, 33), -32767, 32767)
    || !inRange(signal(w, 34), 0, 2) || !inRange(signal(w, 38), .5, 8)
    || !integer(signal(w, 39), 0, 8) || !integer(signal(w, 40), 0, 1) || !integer(signal(w, 63), 0, 2)) return false;
  for (let i = 3; i < 38; i++) {
    if (i === 6 || i === 7 || i === 8 || i === 28 || i === 29 || i === 32 || i === 33 || i === 34) continue;
    if (!inRange(signal(w, i), 0, 1)) return false;
    if ((i <= 11 || i === 13 || i === 26 || i === 27 || i === 31) && !integer(signal(w, i), 0, 1)) return false;
  }
  for (let i = 0; i < 8; i++) {
    if (i >= signal(w, 39)) break;
    const at = LAYERS() + i * 8;
    if (!inRange(word(w, at), -32767, 32767) || !inRange(word(w, at + 1), -32767, 32767)
      || !inRange(word(w, at + 2), 0, 32767) || !inRange(word(w, at + 3), 0, 32767)
      || !inRange(word(w, at + 4), 0, 1) || !integer(word(w, at + 5), 0, 2)
      || !inRange(word(w, at + 6), 0, 1) || !inRange(word(w, at + 7), 0, 16)) return false;
  }
  return true;
}

function resolveMode(base: number, voiceState: number, alert: boolean): number {
  if (alert || voiceState === 6) return 6;
  if (voiceState === 1) return 3;
  if (voiceState === 2 || voiceState === 4) return 4;
  if (voiceState === 3 || voiceState === 5) return 5;
  return base;
}

function stepSpring(w: number[], active: boolean, parallax: boolean, elapsed: number): boolean {
  if (!active || !parallax) {
    for (let i = 13; i <= 19; i++) save(w, i, 0);
    return false;
  }
  const enabled = signal(w, 26) === 1 && signal(w, 27) === 1;
  const x = signal(w, 28), y = signal(w, 29);
  if (enabled && (x !== 0 || y !== 0)) save(w, 25, 1);
  if (enabled && x === 0 && y === 0 && state(w, 25) === 0) return false;
  const extent = setting(w, 10);
  const targetX = enabled ? clamp(2 * x / setting(w, 32) - 1, -1, 1) * extent : 0;
  const targetY = enabled ? clamp(2 * y / setting(w, 33) - 1, -1, 1) * extent : 0;
  if (targetX !== state(w, 17) || targetY !== state(w, 18)) {
    save(w, 17, targetX); save(w, 18, targetY); save(w, 19, 0);
  }
  if (state(w, 13) === targetX && state(w, 15) === targetY && state(w, 14) === 0 && state(w, 16) === 0) return false;
  if (elapsed <= 0) return true;
  const dt = Math.min(elapsed, 100000) / 1000000;
  const omega = 4000 / setting(w, 11);
  let velocityX = (state(w, 14) + (targetX - state(w, 13)) * omega * omega * dt) / (1 + 2 * omega * setting(w, 12) * dt);
  let velocityY = (state(w, 16) + (targetY - state(w, 15)) * omega * omega * dt) / (1 + 2 * omega * setting(w, 12) * dt);
  let posX = clamp(state(w, 13) + velocityX * dt, -extent, extent);
  let posY = clamp(state(w, 15) + velocityY * dt, -extent, extent);
  const count = state(w, 19) + 1;
  save(w, 19, count);
  if (count >= 24 || (Math.abs(posX - targetX) + Math.abs(posY - targetY) < .02
    && Math.abs(velocityX) + Math.abs(velocityY) < .05)) {
    posX = targetX; posY = targetY; velocityX = 0; velocityY = 0;
  }
  save(w, 13, posX); save(w, 14, velocityX); save(w, 15, posY); save(w, 16, velocityY);
  return posX !== targetX || posY !== targetY || velocityX !== 0 || velocityY !== 0;
}

function frameCrc(w: readonly number[]): number {
  let crc = 4294967295;
  for (let i = 0; i < 95; i++) {
    let next = mod(word(w, FRAME() + i), 4294967296);
    for (let j = 0; j < 4; j++) {
      crc = crcByte(crc, mod(next, 256));
      next = Math.floor(next / 256);
    }
  }
  return 4294967295 - crc;
}

export function serializeWallpaperFrame(w: readonly number[], bytes: number[]): number {
  if (w.length !== WORKSPACE_WORDS() || word(w, FRAME()) !== 1) return BAD_INPUT();
  if (bytes.length < 384) return SHORT_OUTPUT();
  for (let i = 0; i < 96; i++) writeLE(bytes, i * 4, 4, mod(word(w, FRAME() + i), 4294967296));
  return 384;
}

export function stepWallpaper(w: number[]): number {
  if (w.length !== WORKSPACE_WORDS()) return BAD_ARGUMENT();
  if (setting(w, 0) !== 1 || state(w, 0) !== 1) return UNSUPPORTED_SCHEMA();
  if (!validSnapshot(w) || !validRecipe(w, false)) return BAD_INPUT();
  const now = signal(w, 1), unix = signal(w, 2), elapsed = now - state(w, 10);
  const thermal = signal(w, 6);
  const hidden = signal(w, 3) === 1, paused = signal(w, 4) === 1;
  const reduced = signal(w, 5) === 1 || setting(w, 16) > 0;
  const staticOnly = reduced || thermal === 3 || (setting(w, 46) === 1 && signal(w, 10) === 1);
  const blocked = hidden || paused;
  const hz = governFps(thermal, Math.min(setting(w, 5), setting(w, 34)));
  const lod = governLod(thermal, Math.min(setting(w, 42), recipeWord(w, 7)));
  const live = !blocked && !staticOnly && hz > 0;
  const policy = hidden ? 3 : paused ? 2 : staticOnly || hz === 0 ? 1 : 0;
  const faceMask = signal(w, 63);
  const base = signal(w, 7);
  const oldBucket = state(w, 6);
  const first = word(w, FRAME()) === 0;
  const geometry = signal(w, 11) === 1;
  const source = setting(w, 19);
  const priorEdge = state(w, 8);
  const solveSolar = base === 1 && (first || geometry || base !== state(w, 36)
    || unix < state(w, 37) || (priorEdge >= 0 && unix >= priorEdge));
  let bucket = base === 1 ? oldBucket : 8;
  if (solveSolar) bucket = solarBucket(unix, source, setting(w, 22), setting(w, 20), setting(w, 21), setting(w, 23));
  const oldPolicy = state(w, 33);
  let face = setting(w, 2);
  if (face === 2) {
    if (faceMask > 0) face = faceMask - 1;
    else face = base === 1 && (bucket < 4 || bucket >= 12) ? 0 : 1;
  }
  const previousFace = state(w, 34);
  const channels = mod(Math.floor(recipeWord(w, 123) / 128), 8);
  const voiceAllowed = setting(w, 35) === 1 && mod(Math.floor(channels / 4), 2) === 1;
  const voice = voiceAllowed ? clamp(signal(w, 12) * setting(w, 38), 0, 1) : 0;
  let audio = 0, bandCount = 0, bandBit = 1;
  if (setting(w, 36) === 1 && mod(Math.floor(channels / 2), 2) === 1) {
    for (let i = 0; i < 8; i++) {
      if (mod(Math.floor(setting(w, 37) / bandBit), 2) === 1) {
        audio += signal(w, 18 + i);
        bandCount++;
      }
      bandBit *= 2;
    }
    if (bandCount > 0) audio = clamp(Math.max(audio / bandCount, signal(w, 17)) * setting(w, 39), 0, 1);
  }
  const alert = signal(w, 9) === 1;
  const mode = resolveMode(base, voiceAllowed ? signal(w, 8) : 0, alert);
  const visualMode = live ? mode : base;
  const oldMode = state(w, 2);
  const thermalChanged = thermal !== state(w, 35);
  const bridgePolicyChanged = word(w, LIGHT_BRIDGE() + 1) !== setting(w, 40);
  const baseChanged = first || oldBucket !== bucket || previousFace !== face || geometry || bridgePolicyChanged;
  const visualChanged = first || geometry || previousFace !== face || bucket !== oldBucket || policy !== oldPolicy || thermalChanged;
  const modeChanged = mode !== oldMode;
  if (modeChanged) {
    save(w, 3, oldMode);
    if (mode === 6) save(w, 30, now);
  }
  if (oldBucket !== bucket || first) save(w, 7, first ? bucket : oldBucket);
  if (!live) save(w, 5, 0);
  else if (first || geometry || previousFace !== face) save(w, 5, 0);
  else if (bucket !== oldBucket || modeChanged) {
    save(w, 4, now);
    save(w, 5, (bucket !== oldBucket ? setting(w, 24) : 420) * 1000);
  }
  const transition = state(w, 5) === 0 ? 1 : clamp((now - state(w, 4)) / state(w, 5), 0, 1);
  if (transition === 1) save(w, 7, bucket);
  const wasMoving = state(w, 20) > 0;
  const spring = stepSpring(w, live, mod(channels, 2) === 1, elapsed);
  let mask = 0;
  if (live) {
    if (transition < 1) mask += bucket === state(w, 7) ? 1 : 32;
    if (spring) mask += 2;
    if (mode === 3 || mode === 4 || mode === 5 || voice > .015) mask += 4;
    if (audio > .015) mask += 8;
    if (mode === 6 && now - state(w, 30) < 2400000) mask += 16;
  }
  const interval = hz > 0 ? ceilInt(1000000 / hz) : 0;
  const poolRequested = live && signal(w, 40) === 1;
  if (poolRequested && now - state(w, 23) < interval) mask += 1 - mod(mask, 2);
  const moving = mask > 0;
  if (moving !== wasMoving) save(w, 1, mod(state(w, 1) + 1, 4294967296));
  const phase = moving ? mod((wasMoving ? state(w, 9) : 0) + elapsed, 6000000) : setting(w, 45) * 6000000;
  let draw = false;
  if (!blocked) {
    draw = visualChanged || state(w, 24) === 1 || (live && !moving && modeChanged);
    if (!draw && (moving || poolRequested) && now - state(w, 23) >= interval) draw = true;
    if (!draw && live && wasMoving && !moving) draw = true;
  }
  if (draw) {
    save(w, 23, now);
    save(w, 26, state(w, 26) + 1);
    save(w, 24, 0);
  } else if (blocked && visualChanged) save(w, 24, 1);
  let boundary = base === 1 ? priorEdge : -1;
  if (solveSolar) boundary = nextSolarBoundary(unix, source, setting(w, 22), setting(w, 20), setting(w, 21), setting(w, 23));
  if (baseChanged) {
    save(w, 28, mod(state(w, 28) + 1, 4294967296));
    exportZenith(w, face, bucket, state(w, 28));
  }
  save(w, 2, mode); save(w, 6, bucket); save(w, 8, boundary); save(w, 9, phase); save(w, 10, now);
  save(w, 11, live ? voice : 0); save(w, 12, live ? audio : 0);
  save(w, 20, mask); save(w, 21, moving ? hz : 0); save(w, 22, lod);
  save(w, 33, policy); save(w, 34, face); save(w, 35, thermal); save(w, 36, base); save(w, 37, unix);
  const at = FRAME();
  zeroWords(w, at, at + 96);
  w[at] = 1; w[at + 1] = 384; w[at + 2] = signal(w, 0);
  w[at + 3] = (draw ? 1 : 0) + (!moving ? 18 : 0) + (hidden ? 4 : 0) + (baseChanged ? 8 : 0) + (reduced ? 32 : 0);
  w[at + 4] = moving ? hz : 0;
  w[at + 5] = NO_DEADLINE();
  if (!blocked && boundary > unix) w[at + 5] = Math.min(NO_DEADLINE() - 1, (boundary - unix) * 1000);
  w[at + 6] = mask; w[at + 7] = lod;
  w[at + 10] = draw ? setting(w, 32) : 0; w[at + 11] = draw ? setting(w, 33) : 0;
  w[at + 12] = visualMode; w[at + 13] = live ? state(w, 3) : base;
  w[at + 14] = q16(transition); w[at + 15] = bucket;
  const cycle = mod(phase * (mode === 4 ? .85 : mode === 3 || mode === 5 ? .62 : .28) / 1000000, 1);
  const breath = smooth(1 - Math.abs(2 * cycle - 1));
  let pulse = 0;
  if (mode === 6 && moving) pulse = (1 - Math.abs(2 * mod((now - state(w, 30)) / 800000, 1) - 1)) * .27;
  const light = clamp(.12 + breath * .32 + voice * .48 + audio * .32 + pulse, 0, setting(w, 7))
    * (1 - thermal * setting(w, 17) / 3);
  w[at + 16] = q16(moving ? breath : setting(w, 45));
  w[at + 17] = q16(moving ? cycle : setting(w, 45));
  w[at + 18] = moving ? roundEven(phase / 6000000 * 512) : 0;
  w[at + 24] = q16(setting(w, 6));
  w[at + 25] = q16(moving ? light : .12);
  w[at + 26] = q16(setting(w, 7)); w[at + 27] = q16(setting(w, 8));
  for (let layer = 0; layer < 3; layer++) {
    const depth = (layer + 1) / 3;
    const curve = clamp(depth * (1 + (1 - setting(w, 9)) * (1 - depth)), 0, 1);
    w[at + 28 + 2 * layer] = roundEven(state(w, 13) * curve * 256);
    w[at + 29 + 2 * layer] = roundEven(state(w, 15) * curve * 256);
  }
  for (let layer = 0; layer < 6; layer++) {
    const src = 16 + layer * 12, dst = LAYERS() + 64 + layer * 20;
    zeroWords(w, dst, dst + 20);
    for (let i = 0; i < 12; i++) w[dst + i] = recipeWord(w, src + i);
    w[at + 34 + layer] = q16(layerEnvelope(w, layer));
  }
  w[at + 45] = signal(w, 39); w[at + 46] = face; w[at + 47] = setting(w, 3);
  for (let stop = 0; stop < 8; stop++) {
    const y = stop / 7;
    w[at + 48 + 4 * stop] = q16(y);
    for (let c = 0; c < 3; c++) w[at + 49 + 4 * stop + c] = q16(baseColor(w, face, bucket, y, c));
  }
  w[at + 80] = q16(state(w, 11)); w[at + 81] = q16(live && voiceAllowed ? signal(w, 14) : 0);
  w[at + 82] = q16(state(w, 12)); w[at + 87] = q16(state(w, 11) + state(w, 12));
  w[at + 95] = frameCrc(w);
  return 0;
}
