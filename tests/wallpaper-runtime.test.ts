import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import { createLightInput, defaultLightPolicy } from "../src/light/inputs.ts";
import {
  CONFIG, FRAME, INPUT, LIGHT_BRIDGE, STATE, WallpaperAssetBudget, WallpaperHost, WallpaperRuntime,
  amberSurface, bakeExactWebP, bindWallpaperZenith, civilEdge, contrastRatio, decodeWallpaperLossless,
  decodeTemporalMasks, deltaR8, encodeResidual, encodeWallpaperLossless, exactWebPHeader, governFps, governLod, linearPsnr,
  linearSsim, luminance, maxAbsoluteError, nextSolarBoundary, normalizeWallpaperPlanes, packRgb10, passesWallpaperQuality, readBE,
  recipeWord, reconstructR8, reconstructResidual, roundEven, sampleTemporalMask, sha256, solarBucket,
  srgbLinear16, temporalKnot, temporalPhase, validResidual, validTemporalPlate, validWallpaperPyramid,
  verifyLosslessWebP, vp8Rgb, wallpaperCodecMatrix, writeWallpaperLuminanceGrid,
} from "../src/wallpaper/index.ts";
import type { ExactWebPPort, TemporalMaskDecoder, TemporalWallpaperPlate, WallpaperLod, WallpaperPyramid, WallpaperScheduler } from "../src/wallpaper/index.ts";

class TestScheduler implements WallpaperScheduler {
  time = 0;
  wall = 0;
  serial = 0;
  readonly timers = new Map<number, { deadline: number; callback: () => void }>();
  readonly rafs = new Map<number, () => void>();
  nowUs() { return this.time; }
  unixSeconds() { return this.wall + Math.floor(this.time / 1_000_000); }
  requestFrame(callback: () => void) { this.rafs.set(++this.serial, callback); return this.serial; }
  cancelFrame(id: number) { this.rafs.delete(id); }
  setTimer(delayMs: number, callback: () => void) {
    this.timers.set(++this.serial, { deadline: this.time + delayMs * 1000, callback });
    return this.serial;
  }
  clearTimer(id: number) { this.timers.delete(id); }
  timer() {
    const first = this.timers.entries().next().value;
    if (!first) return false;
    const [id, { deadline, callback }] = first;
    this.time = Math.max(this.time, deadline);
    this.timers.delete(id);
    callback();
    return true;
  }
  frame() {
    const first = this.rafs.entries().next().value;
    if (!first) return false;
    this.rafs.delete(first[0]);
    first[1]();
    return true;
  }
  tick() { return this.timer() && this.frame(); }
}

function hostFixture(presetId = 181, audioReactive = false) {
  const scheduler = new TestScheduler(), draws: Uint8Array[] = [];
  const host = new WallpaperHost(scheduler, { draw: (r) => draws.push(r.frameBytes()) }, { presetId, audioReactive });
  return { host, scheduler, draws };
}

test("calm idle starts zero timers, rAFs or tokens", () => {
  const { host, scheduler } = hostFixture();
  host.update();
  expect(host.draws).toBe(1);
  for (let i = 1; i < 5; i++) {
    scheduler.time += 1_000_000;
    host.update();
  }
  expect(host.heldTokens).toBe(0);
  expect(host.frameCallbacks).toBe(0);
  expect(host.draws).toBe(1);
  expect(scheduler.timers.size + scheduler.rafs.size).toBe(0);
});

test("hidden and paused cancel pending rAF and reject stale delivery", () => {
  const { host, scheduler } = hostFixture();
  host.update({ voiceState: "thinking" });
  expect(scheduler.timer()).toBe(true);
  const stale = Array.from(scheduler.rafs.values())[0]!;
  const drawn = host.draws;
  host.update({ hidden: true });
  stale();
  expect(host.draws).toBe(drawn);
  expect(host.frameCallbacks).toBe(0);
  expect(host.heldTokens).toBe(0);
  expect(scheduler.rafs.size + scheduler.timers.size).toBe(0);
  host.update({ hidden: false, paused: true });
  expect(host.draws).toBe(drawn);
  host.update({ paused: false, voiceState: "calm" });
  expect(host.draws).toBe(drawn + 1);
});

test("reduced motion installs one canonical static keyframe", () => {
  const { host, scheduler } = hostFixture();
  host.update({ voiceState: "thinking", voiceLevel: .82 });
  expect(scheduler.tick()).toBe(true);
  const count = host.draws;
  host.update({ reducedMotion: true });
  expect(host.heldTokens).toBe(0);
  expect(host.draws).toBe(count + 1);
  expect(host.runtime.frameWord(16)).toBe(16384);
  expect(host.runtime.frameWord(17)).toBe(16384);
  expect(host.runtime.frameWord(80)).toBe(0);
  expect(host.runtime.frameWord(12)).toBe(0);
  host.update({ voiceState: "speaking", voiceLevel: .99 });
  expect(scheduler.rafs.size + scheduler.timers.size).toBe(0);
  expect(host.draws).toBe(count + 1);
});

test("OS modes resolve voice overlays, focus and a finite alert", () => {
  const { host, scheduler } = hostFixture();
  host.update({ baseMode: "focus" });
  expect(host.runtime.mode).toBe("focus");
  expect(host.heldTokens).toBe(0);
  for (const mode of ["listening", "thinking", "speaking"] as const) {
    host.update({ voiceState: mode, voiceLevel: .5 });
    expect(host.runtime.mode).toBe(mode);
    expect(host.heldTokens).toBe(1);
  }
  host.update({ voiceState: "calm", voiceLevel: 0, alert: true });
  expect(host.runtime.mode).toBe("alert");
  for (let i = 0; i < 50 && scheduler.timers.size > 0; i++) scheduler.tick();
  expect(host.heldTokens).toBe(0);
  expect(scheduler.timers.size).toBe(0);
  host.update({ alert: false, baseMode: "circadian" });
  expect(host.runtime.mode).toBe("solar");
});

test("thermal governor caps fps and LOD at all four tiers", () => {
  expect([0, 1, 2, 3].map((tier) => governFps(tier, 15))).toEqual([15, 10, 5, 0]);
  expect([0, 1, 2, 3].map((tier) => governLod(tier, 3))).toEqual([3, 2, 1, 0]);
  const { host } = hostFixture(183);
  host.update({ thermal: "fair" });
  expect(host.runtime.frameWord(4)).toBe(10);
  expect(host.runtime.frameWord(7)).toBe(2);
  host.update({ thermal: "serious" });
  expect(host.runtime.frameWord(4)).toBe(5);
  host.update({ thermal: "critical" });
  expect(host.runtime.frameWord(7)).toBe(0);
  expect(host.runtime.frameWord(4)).toBe(0);
  expect(host.heldTokens).toBe(0);
});

test("audio reactions require opt-in and a supported preset", () => {
  const disabled = hostFixture(23);
  disabled.host.update({ audioBands: [.85, .7, .2], audioLevel: .7 });
  expect(disabled.host.heldTokens).toBe(0);
  const enabled = hostFixture(23, true);
  enabled.host.update({ audioBands: [.85, .7, .2], audioLevel: .7 });
  expect(enabled.host.heldTokens).toBe(1);
  expect(enabled.host.runtime.frameWord(6) & 8).toBe(8);
  enabled.host.update({ audioBands: [], audioLevel: 0 });
  expect(enabled.host.heldTokens).toBe(0);
});

test("solar edges use a single timer with wrap and fixed-bucket handling", () => {
  const { host, scheduler } = hostFixture(1);
  scheduler.wall = civilEdge(5) - 1;
  host.update();
  expect(host.runtime.frameWord(15)).toBe(4);
  expect(host.runtime.nextBoundaryUnix).toBe(25200);
  expect(host.heldTokens).toBe(0);
  expect(scheduler.timers.size).toBe(1);
  expect(scheduler.timer()).toBe(true);
  expect(host.runtime.frameWord(15)).toBe(5);
  expect(host.runtime.nextBoundaryUnix).toBe(32400);
  expect(scheduler.rafs.size).toBe(0);
  expect(nextSolarBoundary(86399, 0, 0, 0, 0, 0)).toBe(86400);
  expect(solarBucket(-1, 0, 0, 0, 0, 0)).toBe(15);
  expect(nextSolarBoundary(86399, 2, 0, 0, 0, 4)).toBe(-1);
  const edge = nextSolarBoundary(1782045000, 1, 0, 80, 10, 0);
  expect(edge).toBeGreaterThan(1782045000);
  expect(solarBucket(edge, 1, 0, 80, 10, 0)).not.toBe(solarBucket(edge - 1, 1, 0, 80, 10, 0));
});

test("parallax ignores synthetic origin and settles within 24 frames", () => {
  const { host, scheduler } = hostFixture(1);
  host.update({ baseMode: "calm" });
  host.pointer(0, 0, true, true);
  host.pointer(120, 40, true, false);
  expect(host.heldTokens).toBe(0);
  host.pointer(120, 40, true, true);
  expect(host.heldTokens).toBe(1);
  for (let i = 0; i < 30 && host.heldTokens; i++) {
    scheduler.tick();
    host.pointer(120, 40, true, true);
  }
  expect(host.frameCallbacks).toBeGreaterThan(0);
  expect(host.frameCallbacks).toBeLessThanOrEqual(24);
  expect(host.heldTokens).toBe(0);
  expect(Math.abs(host.runtime.frameWord(32))).toBeGreaterThan(0);
});

test("DPR and 4K ceilings preserve the negotiated aspect ratio", () => {
  const runtime = new WallpaperRuntime({ presetId: 181 });
  runtime.resize(800, 500, 2);
  runtime.step(0, 0);
  expect([runtime.frameWord(10), runtime.frameWord(11)]).toEqual([1000, 625]);
  runtime.resize(7680, 4320, 3);
  runtime.step(1, 0);
  expect([runtime.frameWord(10), runtime.frameWord(11)]).toEqual([3840, 2160]);
});

test("binding writes only zenith and stage A ignores previously shaded pools", () => {
  const runtime = new WallpaperRuntime({ presetId: 21 });
  const light = createLightInput(
    { id: 1, x: 0, y: 0, width: 24, height: 24, radius: 3 }, defaultLightPolicy,
    { pointer: { x: 12, y: 4 }, star: { x: 32, y: 12 }, focus: { x: 40, y: 32 } },
  );
  runtime.step(0, 0);
  const grid = new Array<number>(64).fill(0), before = light.slice();
  expect(bindWallpaperZenith(runtime.words, light)).toBe(0);
  expect(light.slice(0, 46)).toEqual(before.slice(0, 46));
  expect(light.slice(66)).toEqual(before.slice(66));
  expect(light[46]).toBe(1);
  expect(writeWallpaperLuminanceGrid(runtime.words, grid)).toBe(0);
  expect(Math.max(...grid)).toBeGreaterThan(Math.min(...grid));
  const stageA = runtime.words.slice(LIGHT_BRIDGE(), LIGHT_BRIDGE() + 64);
  runtime.pointer(500, 540, true, true);
  runtime.setSignals({ voiceState: "thinking", voiceLevel: 1 });
  runtime.step(75600, 0);
  expect(runtime.words.slice(LIGHT_BRIDGE(), LIGHT_BRIDGE() + 64)).toEqual(stageA);
});

test("protected rect hits keep contrast and prohibit dark ink on amber", () => {
  const dark = luminance(srgbLinear16(28), srgbLinear16(22), srgbLinear16(19)) / 65535;
  const paper = luminance(srgbLinear16(255), srgbLinear16(253), srgbLinear16(249)) / 65535;
  const runtime = new WallpaperRuntime({ presetId: 21, width: 16, height: 16 });
  const rgba = new Array<number>(1024).fill(0);
  runtime.protect([{ x: 0, y: 0, width: 8, height: 16, inkLuminance: dark },
    { x: 8, y: 0, width: 8, height: 16, inkLuminance: paper }]);
  runtime.step(0, 0);
  expect(runtime.renderRows(0, 16, 16, 16, rgba)).toBe(1024);
  for (let i = 0; i < 256; i++) {
    const [r, g, b] = rgba.slice(i * 4, i * 4 + 3);
    const isDark = i % 16 < 8;
    const backing = luminance(srgbLinear16(r!), srgbLinear16(g!), srgbLinear16(b!)) / 65535;
    expect(contrastRatio(isDark ? dark : paper, backing)).toBeGreaterThanOrEqual(4.5);
    if (isDark) expect(amberSurface(r! / 255, g! / 255, b! / 255)).toBe(false);
  }
});

const master = new Uint8Array([45, 90, 119, 0, 116, 25, 40, 255, 200, 50, 151, 0, 2, 101, 226, 127]);

test("QOI preserves hidden RGB and uses canonical run and diff encoding", () => {
  const encoded = encodeWallpaperLossless("qoi", master, 2, 2);
  expect(decodeWallpaperLossless("qoi", encoded).rgba).toEqual(master);
  const opaqueBlack = new Uint8Array([0, 0, 0, 255]);
  expect(Array.from(encodeWallpaperLossless("qoi", opaqueBlack, 1, 1))).toEqual(
    [113, 111, 105, 102, 0, 0, 0, 1, 0, 0, 0, 1, 4, 0, 192, 0, 0, 0, 0, 0, 0, 0, 1],
  );
  const run = new Uint8Array(125 * 4);
  for (let i = 3; i < run.length; i += 4) run[i] = 255;
  expect([...encodeWallpaperLossless("qoi", run, 125, 1).slice(14, 17)]).toEqual([253, 253, 192]);
  const wrap = encodeWallpaperLossless("qoi", new Uint8Array([255, 255, 255, 255]), 1, 1);
  expect(wrap[14]).toBe(85);
  const bad = encoded.slice();
  bad[bad.length - 1] = 0;
  expect(() => decodeWallpaperLossless("qoi", bad)).toThrow();
});

test("SLPNG1 uses Sub and stored DEFLATE with independent zlib verification", () => {
  const png = encodeWallpaperLossless("slpng1", master, 2, 2);
  const n = readBE(Array.from(png), 33);
  const raw = inflateSync(png.slice(41, 41 + n));
  expect(Array.from(raw.slice(0, 9))).toEqual([1, 45, 90, 119, 0, 71, 191, 177, 255]);
  expect(png[43]).toBe(1);
  expect(decodeWallpaperLossless("slpng1", png).rgba).toEqual(master);
  const tall = new Uint8Array(256 * 65 * 4).fill(9);
  const split = encodeWallpaperLossless("slpng1", tall, 256, 65);
  expect(split[43]).toBe(0);
  expect(split[43 + 5 + 65535]).toBe(1);
  expect(decodeWallpaperLossless("slpng1", split).rgba).toEqual(tall);
  const bad = png.slice();
  bad[png.length - 16] ^= 1;
  expect(() => decodeWallpaperLossless("slpng1", bad)).toThrow();
});

test("lossless metrics retain infinity, unit SSIM and alpha byte checks", () => {
  const rgba = Array.from(master), decoded = Array.from(decodeWallpaperLossless("qoi", encodeWallpaperLossless("qoi", master, 2, 2)).rgba);
  expect(linearPsnr(rgba, decoded)).toBe(Infinity);
  expect(linearSsim(rgba, decoded, 2, 2)).toBe(1);
  expect(maxAbsoluteError(rgba, decoded)).toBe(0);
  decoded[3] = 9;
  expect(maxAbsoluteError(rgba, decoded)).toBe(9);
});

test("M1 residual and perceptual oracle detect real RGB error", () => {
  const predicted = Array.from({ length: 243 }, (_, i) => 460 + i % 3 * 22);
  const source = predicted.map((x) => x + 7), bytes = new Array<number>(251).fill(0);
  expect(encodeResidual(source, predicted, 8, 8, 2, bytes)).toBe(251);
  expect(validResidual(bytes, 2)).toBe(true);
  expect([...bytes.slice(0, 8)]).toEqual([83, 87, 82, 81, 1, 128, 2, 3]);
  const rgba = new Uint8Array(256), decoded = new Uint8Array(256);
  for (let i = 0; i < 64; i++) {
    for (let c = 0; c < 3; c++) {
      rgba[4 * i + c] = Math.floor((467 + c * 22) * 255 / 1023);
      decoded[4 * i + c] = Math.floor(reconstructResidual(bytes, 460 + c * 22, i % 8, Math.floor(i / 8), 8, 8, c) * 255 / 1023);
    }
  }
  expect(passesWallpaperQuality(rgba, decoded, 8, 8)).toBe(true);
  expect(linearPsnr(Array.from(rgba), Array.from(decoded))).toBeLessThan(100);
  expect(linearSsim(Array.from(rgba), Array.from(decoded), 8, 8)).toBeLessThan(1);
  expect(passesWallpaperQuality(rgba, new Uint8Array(256).fill(230), 8, 8)).toBe(false);
});

const digest = "a".repeat(64);
function lod(width: number, height: number, bytes: number, tiled = false): WallpaperLod {
  const w = tiled ? width / 2 : width, h = tiled ? height / 2 : height;
  return {
    width, height, overheadBytes: 0,
    tiles: Array.from({ length: tiled ? 4 : 1 }, (_, i) =>
      ({ x: i % 2 * w, y: Math.floor(i / 2) * h, width: w, height: h, bytes, sha256: digest, codec: 5 })),
  };
}

test("M1 LOD admission counts four 4K tiles and every serialized byte", () => {
  const pyramid: WallpaperPyramid = [lod(854, 480, 23999), lod(1920, 1080, 199999), lod(3840, 2160, 112000, true)];
  expect(validWallpaperPyramid(pyramid)).toBe(true);
  expect(validWallpaperPyramid([pyramid[0], pyramid[1], { ...pyramid[2], overheadBytes: 1 }])).toBe(false);
  expect(validWallpaperPyramid([pyramid[0], pyramid[1], lod(3840, 2160, 112001, true)])).toBe(false);
  expect(validWallpaperPyramid([lod(854, 480, 24000), pyramid[1], pyramid[2]])).toBe(false);
  expect(validWallpaperPyramid([pyramid[0], lod(1920, 1080, 200000), pyramid[2]])).toBe(false);
  expect(validWallpaperPyramid([pyramid[0], pyramid[1], { ...pyramid[2], tiles: pyramid[2].tiles.toReversed() }])).toBe(false);
});

test("M2 AV1 poster and delta R8 use absolute knots, advection and the VRAM cap", () => {
  expect(wallpaperCodecMatrix.length).toBe(9);
  const plate: TemporalWallpaperPlate = {
    poster: { ...lod(1920, 1080, 190000).tiles[0]!, codec: 8 }, width: 480, height: 270, fps: 15, periodUs: 6000000,
    masks: Array.from({ length: 6 }, (_, i) => ({ key: i * 15, anchor: i < 3 ? 0 : 45, codec: "av1-mono-intra", bytes: 5000, sha256: digest })),
    maskOverheadBytes: 2000,
  };
  expect(validTemporalPlate(plate)).toBe(true);
  expect(validTemporalPlate({ ...plate, maskOverheadBytes: 2001 })).toBe(false);
  expect(validTemporalPlate({ ...plate, width: 481 })).toBe(false);
  expect(deltaR8(91, 100)).toBe(124);
  expect(reconstructR8(124, 100)).toBe(92);
  expect(temporalPhase(6_000_000)).toBe(0);
  expect(temporalKnot(temporalPhase(3_000_000))).toBe(45);
  expect(temporalKnot(65535)).toBe(75);
  expect(sampleTemporalMask([6, 56, 114, 246], [10, 180, 190, 208], temporalPhase(3250000), 6, 6, 8, 8)).toBe(237);
  expect(sampleTemporalMask([255], [0], 65536, 0, 0, 1, 1)).toBe(-3);
  expect(packRgb10(1023, 0, 1)).toBe(0xc01003ff);
  expect([0, 1, 2].map((c) => vp8Rgb(235, 128, 128, c))).toEqual([255, 255, 255]);
});

test("resident admission counts encoded and decoded allocations by identity", () => {
  const budget = new WallpaperAssetBudget(96_000_000);
  const a = {}, b = {}, c = {}, d = {};
  expect(budget.reserve(a, 33_177_600)).toBe(true);
  expect(budget.reserve(a, 33_177_600)).toBe(true);
  expect(budget.reserve(b, 33_177_600)).toBe(true);
  expect(budget.reserve(c, 33_177_600)).toBe(false);
  expect(budget.decodedBytes).toBe(66_355_200);
  expect(budget.reserve(d, 1_200_001, true)).toBe(false);
  expect(budget.reserve(d, 1_200_000, true)).toBe(true);
  budget.release(a);
  expect(budget.reserve(c, 33_177_600)).toBe(true);
  expect(budget.encodedBytes).toBe(1_200_000);
});

test("L0 checksum protects canonical padding and preset configuration", () => {
  const runtime = new WallpaperRuntime({ presetId: 1 });
  const bytes = runtime.recipe();
  expect(recipeWord(runtime.words, 4)).toBe(1);
  expect(roundEven(-2.5)).toBe(-2);
  expect(roundEven(-3.5)).toBe(-4);
  bytes[500] = 1;
  expect(() => new WallpaperRuntime({ recipe: bytes })).toThrow();
  bytes[500] = 0;
  bytes[24] ^= 1;
  expect(() => new WallpaperRuntime({ recipe: bytes })).toThrow();
  runtime.step(0, 0);
  expect(runtime.words[FRAME()]).toBe(1);
  expect(runtime.words[INPUT() + 7]).toBe(1);
  expect(runtime.words[STATE() + 20]).toBe(0);
  expect(runtime.words[CONFIG() + 47]).toBe(0);
});

const cwebp = Bun.which("cwebp"), dwebp = Bun.which("dwebp");
test.skipIf(!cwebp || !dwebp)("cwebp exact port verifies pinned decoded SHA-256 with invisible RGB", async () => {
  const directory = mkdtempSync(join(tmpdir(), "starlux-webp-"));
  const source = join(directory, "source.png"), webp = join(directory, "source.webp"), pam = join(directory, "decoded.pam");
  const pinned = "73d5f569dc4eb18007cee22d1a5d012debab34c4b1a41a5f69353ffc57f7aca7";
  const port: ExactWebPPort = {
    async encode(rgba, width, height, args) {
      expect(args).toContain("-exact");
      writeFileSync(source, encodeWallpaperLossless("slpng1", rgba, width, height));
      const result = Bun.spawnSync([cwebp!, ...args, source, "-o", webp]);
      expect(result.exitCode).toBe(0);
      return Uint8Array.from(readFileSync(webp));
    },
    async decode(encoded) {
      writeFileSync(webp, encoded);
      const result = Bun.spawnSync([dwebp!, webp, "-pam", "-o", pam]);
      expect(result.exitCode).toBe(0);
      const file = readFileSync(pam);
      const start = file.indexOf("ENDHDR\n");
      expect(start).toBeGreaterThan(0);
      return Uint8Array.from(file.subarray(start + 7));
    },
  };
  try {
    expect(await sha256(master)).toBe(pinned);
    const encoded = await bakeExactWebP(master, 2, 2, pinned, port);
    expect(exactWebPHeader(encoded, 2, 2)).toBe(true);
    expect(await verifyLosslessWebP(encoded, 2, 2, pinned, port)).toEqual(master);
    await expect(verifyLosslessWebP(encoded, 2, 2, "0".repeat(64), port)).rejects.toThrow("SHA-256 mismatch");
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("verified AV1 host planes preserve P3 samples and reconstruct deltas from absolute keys", async () => {
  const tile = { x: 0, y: 0, width: 1, height: 1, codec: 6 as const, bytes: 1, sha256: digest };
  const planes = {
    width: 1, height: 1, y: new Uint16Array([0]), cb: new Uint16Array([1]), cr: new Uint16Array([1023]),
    bitDepth: 10 as const, sampling: "444" as const, primaries: 12 as const,
    transfer: 13 as const, matrix: 0 as const, fullRange: true, intra: true,
  };
  expect([...normalizeWallpaperPlanes(tile, planes)]).toEqual([255, 3, 16, 192]);
  expect(() => normalizeWallpaperPlanes(tile, { ...planes, sampling: "420" })).toThrow();
  const payloads = [100, 124, 140, 200, 125, 135].map((sample) => new Uint8Array([sample]));
  const plate: TemporalWallpaperPlate = {
    poster: { ...tile, codec: 8, width: 4, height: 4 }, width: 1, height: 1, fps: 15, periodUs: 6000000,
    masks: await Promise.all(payloads.map(async (payload, i) => ({
      key: 15 * i, anchor: i < 3 ? 0 : 45, codec: "av1-mono-intra", bytes: 1, sha256: await sha256(payload),
    }))), maskOverheadBytes: 128,
  };
  const decoder: TemporalMaskDecoder = {
    async decodeMonoIntra(y, width, height) { return { y, width, height, fullRange: true, intra: true, monochrome: true, bitDepth: 8 }; },
  };
  const masks = await decodeTemporalMasks(plate, payloads, decoder);
  expect(masks.map((mask) => mask[0])).toEqual([100, 92, 124, 200, 194, 214]);
  await expect(decodeTemporalMasks(plate, [new Uint8Array([7]), ...payloads.slice(1)], decoder)).rejects.toThrow("SHA-256 mismatch");
});

test("external light sensor updates draw without feeding back into stage A", () => {
  const { host, scheduler } = hostFixture(21);
  host.update();
  const bridge = host.runtime.words.slice(LIGHT_BRIDGE(), LIGHT_BRIDGE() + 64);
  const first = host.draws;
  host.updateLightSensors({ star: { x: 10, y: 10, gain: 1, rgb: [1, .55, .2] } });
  expect(host.heldTokens).toBe(1);
  expect(host.draws).toBe(first);
  expect(scheduler.tick()).toBe(true);
  expect(host.heldTokens).toBe(0);
  expect(host.draws).toBe(first + 1);
  expect(host.runtime.words.slice(LIGHT_BRIDGE(), LIGHT_BRIDGE() + 64)).toEqual(bridge);
});

test("scrims preserve AA even for mid-luminance protected text", () => {
  const runtime = new WallpaperRuntime({ presetId: 21, width: 8, height: 8 });
  for (const [index, ink] of [.18, .30, .49, .5].entries()) {
    runtime.protect([{ x: 0, y: 0, width: 8, height: 8, inkLuminance: ink }]);
    runtime.step(index, 0);
    const pixels = new Array<number>(8 * 8 * 4).fill(0);
    expect(runtime.renderRows(0, 8, 8, 8, pixels)).toBe(pixels.length);
    for (let at = 0; at < pixels.length; at += 4) {
      const [r, g, b] = pixels.slice(at, at + 3);
      const y = luminance(srgbLinear16(r!), srgbLinear16(g!), srgbLinear16(b!)) / 65535;
      expect(contrastRatio(ink, y)).toBeGreaterThanOrEqual(4.5);
      if (ink < .5) expect(amberSurface(r! / 255, g! / 255, b! / 255)).toBe(false);
    }
  }
});
