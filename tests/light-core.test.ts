import { expect, test } from "bun:test";
import {
  bevelSpecular, createLightInput, defaultLightPolicy, findLightPreset, lightFalloff, lightPacketWords, lightPresets,
  lightSceneWords, lightScratchWords, lightUNorm, materialEdgeLuminance, paintLightSource, protectedLightGain,
  roundLightEven, schlickReflectance, shadeSurface, sqrtLight, transmittedCaustic, writeLightBytes,
} from "../src/light/index.ts";
import type { LightEmitter, LightPolicy, LightSlot, SurfaceFrame } from "../src/light/index.ts";
import { main as parity } from "./light-parity.ss.ts";

const pane: SurfaceFrame = { id: 7, x: 0, y: 0, width: 400, height: 240, radius: 24, blurPx: 19, bevelClip: 2 };
const buffer = (n: number) => new Array<number>(n).fill(0);
const word = (packet: readonly number[], lane: number, field: number, slot = 0) => packet[8 + slot * 336 + lane * 16 + field]!;
function shade(emitter: LightEmitter, frame = pane, policy: LightPolicy = defaultLightPolicy, visible = true) {
  const input = createLightInput(frame, policy, { pointer: emitter });
  const packet = buffer(lightPacketWords());
  const scene = buffer(lightSceneWords());
  const glyph = buffer(4);
  expect(shadeSurface(input, packet, scene, buffer(lightScratchWords()))).toBe(0);
  paintLightSource(visible, true, emitter.x, emitter.y, glyph);
  const bytes = buffer(5408);
  expect(writeLightBytes(packet, bytes)).toBe(0);
  return { packet, scene, glyph, bytes: Uint8Array.from(bytes) };
}

test("source visibility preserves all bytes at both polarities", () => {
  for (const polarity of ["obsidian-dark", "sunlit-alabaster-light"] as const) {
    const policy = { ...defaultLightPolicy, polarity };
    const left = shade({ x: -260, y: 100 }, pane, policy);
    const right = shade({ x: 750, y: 80 }, pane, policy);
    expect(left.bytes).not.toEqual(right.bytes);
    for (const emitter of [{ x: -260, y: 100 }, { x: 750, y: 80 }, { x: 199, y: 89 }]) {
      const shown = shade(emitter, pane, policy, true);
      const hidden = shade(emitter, pane, policy, false);
      expect(shown.bytes).toEqual(hidden.bytes);
      expect(shown.scene).toEqual(hidden.scene);
      expect(shown.glyph[0]).toBe(1);
      expect(hidden.glyph).toEqual([0, 0, 0, 0]);
      expect(word(shown.packet, 1, 9)).toBeGreaterThan(0);
      expect(word(shown.packet, 6, 9)).toBeGreaterThan(0);
    }
  }
});

test("Schlick normal incidence and grazing fixtures", () => {
  expect(lightUNorm(schlickReflectance(.04, 1))).toBe(2621);
  const values = [0, .5, 1, 2, 4, 8].map((d) => schlickReflectance(.04, 1 / Math.sqrt(1 + d * d)));
  expect(values).toEqual([...values].sort((a, b) => a - b));
  expect(values[5]!).toBeGreaterThan(values[0]!);
  expect(word(shade({ x: 200, y: 120 }).packet, 2, 9)).toBe(2621);
});

test("half range and reference tilted Blinn exponent", () => {
  expect(lightUNorm(lightFalloff(430, 430))).toBe(32768);
  expect(bevelSpecular(0, 1, 35)).toBeCloseTo(0.202729, 6);
  expect(bevelSpecular(0, 1, 0)).toBe(1);
});

test("transmission uses one minus reflectance on the opposite wall", () => {
  const left = shade({ x: -350, y: 100, dispersion: 0 });
  const well = shade({ x: -350, y: 100, dispersion: 0 }, { ...pane, relief: "recessed" });
  expect(word(left.packet, 1, 2)).toBe(0);
  expect(word(left.packet, 6, 2)).toBe(400 * 256);
  expect(word(well.packet, 1, 2)).toBe(400 * 256);
  expect(word(well.packet, 6, 2)).toBe(0);
  expect(lightUNorm(transmittedCaustic(.04, 1, 1, 1))).toBe(5033);
  expect(word(shade({ x: 200, y: 120 }).packet, 6, 9)).toBe(5033);
});

test("dispersion and blur remain bounded after quantization", () => {
  for (const scale of [.5, 1, 1.5, 2, 3, 8]) {
    const packet = shade({ x: 5015, y: -320, dispersion: 16, rangePx: 12000 },
      { ...pane, transform: [1, .375, -.25, .875] }, { ...defaultLightPolicy, deviceScale: scale, maxBlurPx: 11 }).packet;
    expect(word(packet, 3, 0)).toBe(1);
    expect(word(packet, 5, 0)).toBe(1);
    const dx = (word(packet, 3, 2) - word(packet, 5, 2)) / 256;
    const dy = (word(packet, 3, 3) - word(packet, 5, 3)) / 256;
    const split = Math.hypot(dx - .25 * dy, .375 * dx + .875 * dy);
    expect(split).toBeLessThanOrEqual(Math.min(1.5, 2 / scale));
    expect(split).toBeGreaterThan(.1);
    expect(word(packet, 3, 8)).toBe(11 * 256);
  }
  const hot = shade({ x: 5015, y: -320, dispersion: 16, rangePx: 12000 }, pane,
    { ...defaultLightPolicy, thermal: "serious" }).packet;
  expect(word(hot, 3, 0)).toBe(0);
  expect(word(hot, 2, 0)).toBe(1);
  expect(word(hot, 2, 8)).toBe(16 * 256);
});

test("polarity swaps exposure and keeps paired edge contrast", () => {
  const dark = shade({ x: 50, y: 50 });
  const light = shade({ x: 50, y: 50 }, pane, { ...defaultLightPolicy, polarity: "sunlit-alabaster-light" });
  expect(dark.bytes).not.toEqual(light.bytes);
  expect(word(dark.packet, 1, 14)).toBe(1);
  expect(word(light.packet, 1, 14)).toBe(2);
  expect(word(light.packet, 1, 9)).toBeLessThan(word(dark.packet, 1, 9));
  const darkY = materialEdgeLuminance(0);
  const lightY = materialEdgeLuminance(1);
  expect(darkY).toBeGreaterThan(.12);
  expect(lightY).toBeLessThan(.80);
  expect((darkY - .12) / (darkY + .12 + .10)).toBeCloseTo(.08, 12);
  expect((.80 - lightY) / (lightY + .80 + .10)).toBeCloseTo(.08, 12);
  expect(protectedLightGain(.03, .85, .94, 4.5)).toBeCloseTo(.1318681, 6);
  expect(protectedLightGain(.1, .2, 1, 4.5)).toBe(0);
});

test("canonical slots and empty reserved words", () => {
  const slots: readonly LightSlot[] = ["pointer", "zenith", "star", "focus"];
  const values = slots.map((slot, i) => [slot, { x: 300 * i, y: -100 * i, gain: .2 * (i + 1) }] as const);
  const first = createLightInput(pane, defaultLightPolicy, Object.fromEntries(values));
  const last = createLightInput(pane, defaultLightPolicy, Object.fromEntries(values.reverse()));
  expect(first).toEqual(last);
  expect(() => createLightInput(pane, defaultLightPolicy, { guest: { x: 0, y: 0 } } as never)).toThrow("LightCapacity");
  const packet = shade({ x: 200, y: 0 }).packet;
  expect(packet.slice(8 + 336).every((n) => n === 0)).toBe(true);
  for (let i = 8; i < packet.length; i += 16) expect(packet[i + 15]).toBe(0);
  const empty = shade({ x: 200, y: 0 }, { ...pane, transform: [1, 2, 1, 2] }).packet;
  expect(empty.slice(3).every((n) => n === 0)).toBe(true);
});

test("ABI validates before writing and uses nearest-even words", () => {
  const input = createLightInput(pane, defaultLightPolicy, { pointer: { x: 2, y: 3 } });
  const output = buffer(1352).fill(55);
  const scene = buffer(8).fill(66);
  const scratch = buffer(14).fill(77);
  expect(shadeSurface(input, output.slice(1), scene, scratch)).toBe(-4);
  input[33] = 81;
  expect(shadeSurface(input, output, scene, scratch)).toBe(-3);
  expect(output.every((v) => v === 55)).toBe(true);
  expect(scene.every((v) => v === 66)).toBe(true);
  expect(scratch.every((v) => v === 77)).toBe(true);
  expect([-.5, .5, 1.5, 2.5, -1.5, -2.5].map(roundLightEven)).toEqual([0, 0, 2, 2, -2, -2]);
});

test("120 unique Astra presets and exact family distribution", () => {
  expect(lightPresets).toHaveLength(120);
  const families = new Map<string, number>();
  const costs = { E: 0, F: 0, P: 0 };
  for (const preset of lightPresets) {
    const family = preset.id.split(".")[0]!;
    families.set(family, (families.get(family) ?? 0) + 1);
    expect(findLightPreset(preset.id)).toBe(preset);
    expect(preset.description).not.toBe("");
    expect(preset.durationUs > 0).toBe(preset.cost === "P");
    costs[preset.cost as keyof typeof costs]++;
  }
  expect([...families]).toEqual(["lamp", "rim", "caustic", "sweep", "magnetic", "presence", "polarity", "ambient"].map((id) => [id, 15]));
  expect(costs).toEqual({ E: 68, F: 22, P: 30 });
  expect(new Set(lightPresets.map(({ id }) => id)).size).toBe(120);
  expect(findLightPreset("ambient.motion-pin")?.dispersion).toBe(0);
});

test("portable trajectory records clean visibility witnesses", () => {
  Object.assign(globalThis, { budget: () => {} });
  const result = parity();
  expect(result.slice(0, 4)).toEqual([2621, 32768, 5033, .4]);
  expect(result).toHaveLength(21638);
  expect(result.at(-1)).toBe(0);
  expect(result.at(-2)).toBeGreaterThan(0);
});

test("allocation-free square root rounds identically across the binary64 range", () => {
  let random = 118139;
  for (let exponent = -1074; exponent <= 1023; exponent += 5) {
    for (let i = 0; i < 12; i++) {
      random = (random * 16807) % 2147483647;
      const input = (1 + random / 2147483647) * 2 ** exponent;
      expect(sqrtLight(input)).toBe(Math.sqrt(input));
    }
  }
  expect(sqrtLight(Number.MAX_VALUE)).toBe(Math.sqrt(Number.MAX_VALUE));
  expect(sqrtLight(0)).toBe(0);
});
