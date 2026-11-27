import { expect, test } from "bun:test";
import { lightPresets } from "../ss/light/catalog.ss.ts";
import { validLightInput } from "../ss/light/scene.ss.ts";
import { createLightInput, defaultLightPolicy } from "../src/light/inputs.ts";
import {
  WallpaperRuntime, amberSurface, contrastRatio, crc32, linearSrgb8, luminance, paletteChannel, srgbLinear16,
  wallpaperPreset, wallpaperPresetCount, wallpaperPresetId, writeWallpaperLight,
} from "../src/wallpaper/index.ts";

const families = ["solar", "ember", "obsidian", "alabaster", "horizon", "tide", "mineral", "grove", "night", "presence"];
function rgb(hex: string): number[] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}
function linearY(hex: string): number {
  const [r, g, b] = rgb(hex).map((n) => srgbLinear16(n) / 65535);
  return luminance(r!, g!, b!);
}

test("catalog preserves all Fable IDs, slugs, families, polarities, tier mix and semantic rows", () => {
  expect(wallpaperPresetCount()).toBe(200);
  const slugs = new Set<string>(), descriptions = new Set<string>();
  const polarities = new Map<string, number>(), tiers = new Map<string, number>();
  for (let id = 1; id <= 200; id++) {
    const preset = wallpaperPreset(id)!;
    expect(preset.id).toBe(id);
    expect(preset.family).toBe(families[Math.floor((id - 1) / 20)]!);
    expect(wallpaperPresetId(preset.slug)).toBe(id);
    expect(wallpaperPresetId(`wallpaper.${preset.family}.${preset.slug}`)).toBe(id);
    slugs.add(preset.slug);
    descriptions.add(preset.description);
    polarities.set(preset.polarity, (polarities.get(preset.polarity) ?? 0) + 1);
    tiers.set(preset.tier, (tiers.get(preset.tier) ?? 0) + 1);
    expect(preset.referenceRecipeBytes).toBeLessThan(2000);
    expect(preset.budget).toContain(`${preset.referenceRecipeBytes} B`);
    if (preset.tier === "L1") expect(preset.budget).toContain("200 kB");
    if (preset.tier === "M1" || preset.tier === "M2") expect(preset.budget).toContain("24 / 200 / 448");
    if (preset.tier === "M2") expect(preset.budget).toContain("32 kB");
    const zenith = lightPresets.find((row) => row.id === preset.zenith);
    expect(zenith).toBeDefined();
    expect(zenith?.polarity === "adaptive" || zenith?.polarity === preset.polarity).toBe(true);
    if (preset.accent) expect(lightPresets.some((light) => light.id === preset.accent)).toBe(true);
  }
  expect(slugs.size).toBe(200);
  expect(descriptions.size).toBe(200);
  expect(Object.fromEntries(polarities)).toEqual({ "obsidian-dark": 89, "sunlit-alabaster-light": 29, adaptive: 82 });
  expect(Object.fromEntries(tiers)).toEqual({ L0: 91, L1: 27, M1: 54, M2: 28 });
  for (const invalid of [0, 201, 1.5, Infinity, NaN]) expect(wallpaperPreset(invalid)).toBeUndefined();
  expect(wallpaperPresetId("missing-preset")).toBe(0);
});

test("catalog anchor bytes and serialized catalog digest match all 200 recipes", () => {
  let digest = 1;
  const fingerprints = new Set<number>();
  for (let id = 1; id <= 200; id++) {
    const preset = wallpaperPreset(id)!;
    const runtime = new WallpaperRuntime({ presetId: id });
    const bytes = runtime.recipe();
    expect(bytes.length).toBe(512);
    expect([...bytes.slice(0, 16)]).toEqual([83, 76, 87, 80, 0, 0, 1, 0, 5, 0, 0, 0, 0, 2, 0, 0]);
    fingerprints.add(crc32(Array.from(bytes), 0, 508));
    const face = preset.polarity === "sunlit-alabaster-light" ? 1 : 0;
    [preset.base, preset.horizon, preset.top].forEach((hex, anchor) => {
      expect([0, 1, 2].map((lane) => linearSrgb8(paletteChannel(runtime.words, face, anchor, lane) * 65535))).toEqual(rgb(hex));
    });
    const restored = new WallpaperRuntime({ recipe: bytes });
    expect(restored.recipe()).toEqual(bytes);
    runtime.step(0, 0); restored.step(0, 0);
    expect(restored.frameWord(46)).toBe(runtime.frameWord(46));
    for (const octet of bytes) digest = (Math.imul(digest, 65599) + octet) >>> 0;
  }
  expect(fingerprints.size).toBe(200);
  expect(digest).toBe(3227246858);
  expect(wallpaperPreset(1)?.base).toBe("#15100e");
  expect(wallpaperPreset(21)?.top).toBe("#f3a24a");
  expect(wallpaperPreset(200)?.horizon).toBe("#4d3a22");
});

test("Ruling 26 preserves paper ink, ember and alabaster discipline", () => {
  const ink = linearY("#FFFDF9");
  expect(contrastRatio(ink, linearY("#B84309"))).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(ink, linearY("#1C1613"))).toBeGreaterThanOrEqual(4.5);
  expect(amberSurface(.72, .263, .035)).toBe(true);
  for (let id = 1; id <= 200; id++) {
    const { polarity, base, horizon, top } = wallpaperPreset(id)!;
    const bands = [base, horizon, top].map((hex) => {
      expect(["#000000", "#06b6d4", "#22d3ee"]).not.toContain(hex);
      if (polarity === "sunlit-alabaster-light") {
        expect(linearY(hex)).toBeGreaterThanOrEqual(.60);
        const [r, g, b] = rgb(hex).map((v) => v / 255);
        expect(amberSurface(r!, g!, b!)).toBe(false);
      }
      const [r, g, b] = rgb(hex).map((v) => v / 255);
      const hi = Math.max(r!, g!, b!), lo = Math.min(r!, g!, b!);
      const c = hi - lo, l = (hi + lo) / 2;
      if (c === 0 || l < .2 || l > .85 || c / (1 - Math.abs(2 * l - 1)) < .35) return 0;
      const hue = 60 * ((hi === b ? 4 + (r! - g!) / c : hi === g ? 2 + (b! - r!) / c : (g! - b!) / c) + 6) % 360;
      return hue >= 195 && hue < 250 ? 1 : hue >= 250 && hue <= 320 ? 2 : 0;
    });
    expect(bands.includes(1) && bands.includes(2)).toBe(false);
    if (polarity === "obsidian-dark") expect(linearY(base)).toBeGreaterThanOrEqual(.002);
  }
});

test("all 200 catalog zenith emitters pass light validation in each solar bucket", () => {
  const light = createLightInput({ id: 1, x: 0, y: 0, width: 32, height: 32, radius: 3 }, defaultLightPolicy);
  for (let id = 1; id <= 200; id++) {
    const runtime = new WallpaperRuntime({ presetId: id });
    runtime.setSignals({ baseMode: "solar" });
    for (const [index, time] of [0, 16200, 18000, 19800, 21600, 25200, 32400, 39600, 46800, 54000, 61200, 66600, 68400, 70200, 72000, 77400].entries()) {
      runtime.step(index * 3000000, time);
      expect(writeWallpaperLight(runtime, light)).toBe(true);
      expect(validLightInput(light)).toBe(true);
    }
  }
});

test("four-target wallpaper parity vector reports the pinned digest and quality values", async () => {
  const scope = globalThis as typeof globalThis & { budget?: (limits: unknown) => void };
  scope.budget = () => {};
  try {
    const { main } = await import("./wallpaper-parity.ss.ts");
    const result = main(1);
    expect(result.slice(0, 4)).toEqual([3574483510, 99991, 237, 41785]);
    expect(result[4]).toBeGreaterThan(0);
  } finally { delete scope.budget; }
});
