import { expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const floors = {
  idle: "calm idle starts zero timers, rAFs or tokens",
  hidden: "hidden and paused cancel pending rAF and reject stale delivery",
  reduced: "reduced motion installs one canonical static keyframe",
  modes: "OS modes resolve voice overlays, focus and a finite alert",
  thermal: "thermal governor caps fps and LOD at all four tiers",
  audio: "audio reactions require opt-in and a supported preset",
  solar: "solar edges use a single timer with wrap and fixed-bucket handling",
  parallax: "parallax ignores synthetic origin and settles within 24 frames",
  dpr: "DPR and 4K ceilings preserve the negotiated aspect ratio",
  bridge: "binding writes only zenith and stage A ignores previously shaded pools",
  scrim: "protected rect hits keep contrast and prohibit dark ink on amber",
  qoi: "QOI preserves hidden RGB and uses canonical run and diff encoding",
  png: "SLPNG1 uses Sub and stored DEFLATE with independent zlib verification",
  metrics: "lossless metrics retain infinity, unit SSIM and alpha byte checks",
  residual: "M1 residual and perceptual oracle detect real RGB error",
  lod: "M1 LOD admission counts four 4K tiles and every serialized byte",
  temporal: "M2 AV1 poster and delta R8 use absolute knots, advection and the VRAM cap",
  storage: "resident admission counts encoded and decoded allocations by identity",
  recipe: "L0 checksum protects canonical padding and preset configuration",
} as const;

type Mutation = readonly [string, keyof typeof floors, string, string, string];
const mutants: readonly Mutation[] = [
  ["unconditional-idle-timer", "idle", "src/wallpaper/host.ts",
    "const deadline = Math.min(liveDeadline, solarDeadline);", "const deadline = Math.min(liveDeadline, solarDeadline, now + 16667);"],
  ["hidden-draws", "hidden", "ss/wallpaper/dynamics.ss.ts",
    "const blocked = hidden || paused;", "const blocked = paused;"],
  ["moving-reduced-key", "reduced", "ss/wallpaper/dynamics.ss.ts",
    "q16(moving ? breath : setting(w, 45))", "q16(breath)"],
  ["infinite-alert-tail", "modes", "ss/wallpaper/dynamics.ss.ts",
    "now - state(w, 30) < 2400000", "now - state(w, 30) < 24000000"],
  ["thermal-cap", "thermal", "ss/wallpaper/dynamics.ss.ts",
    "thermal === 1 ? 10 : thermal === 2 ? 5", "thermal === 1 ? 14 : thermal === 2 ? 5"],
  ["audio-opt-in-bypass", "audio", "ss/wallpaper/dynamics.ss.ts",
    "if (setting(w, 36) === 1 && mod(Math.floor(channels / 2), 2) === 1)", "if (mod(Math.floor(channels / 2), 2) === 1)"],
  ["solar-edge-late", "solar", "ss/wallpaper/solar.ss.ts",
    "unix + civilEdge(bucket + 1) - mod", "unix + civilEdge(bucket + 1) + 1 - mod"],
  ["untrusted-pointer-admitted", "parallax", "src/wallpaper/runtime.ts",
    "if (!trusted || !Number.isFinite(x)", "if (!Number.isFinite(x)"],
  ["stationary-spring-wake", "parallax", "ss/wallpaper/dynamics.ss.ts",
    "&& state(w, 14) === 0 && state(w, 16) === 0) return false;", "&& state(w, 14) === 0 && state(w, 16) === 0) return true;"],
  ["rounded-up-dpr", "dpr", "src/wallpaper/runtime.ts",
    "Math.min(dpr, w[c + 4] ?? 1.25,", "Math.min(dpr, 2,"],
  ["zenith-overwrites-star", "bridge", "ss/wallpaper/light_bridge.ss.ts",
    "light[46 + i] =", "light[66 + i] ="],
  ["amber-dark-ink", "scrim", "ss/wallpaper/layers.ss.ts",
    "if (amberSurface(linearSrgb8(r * 65535) / 255, linearSrgb8(g * 65535) / 255, linearSrgb8(b * 65535) / 255)) opacity = 1;", "opacity = opacity;"],
  ["short-qoi-run", "qoi", "ss/wallpaper/codec_qoi.ss.ts",
    "run === 62", "run === 61"],
  ["transparent-rgb-rewritten", "qoi", "ss/wallpaper/codec_qoi.ss.ts",
    "out[cursor + 1] = r; out[cursor + 2] = g; out[cursor + 3] = b; out[cursor + 4] = a;",
    "out[cursor + 1] = a === 0 ? 0 : r; out[cursor + 2] = g; out[cursor + 3] = b; out[cursor + 4] = a;"],
  ["wrong-png-filter", "png", "ss/wallpaper/codec_png.ss.ts",
    "let value = 1;", "let value = 0;"],
  ["skip-png-crc", "png", "ss/wallpaper/codec_png.ss.ts",
    "|| readBE(bytes, size - 16) !== crc32(bytes, 37, size - 53)", ""],
  ["metrics-skip-alpha", "metrics", "ss/wallpaper/metrics.ss.ts",
    "for (let j = 0; j < 4; j++)", "for (let j = 0; j < 3; j++)"],
  ["wrong-4k-quantum", "residual", "ss/wallpaper/codec.ss.ts",
    "lod === 0 ? 8 : lod === 1 ? 4 : 2;", "lod === 0 ? 8 : lod === 1 ? 4 : 4;"],
  ["skip-index-bytes", "lod", "src/wallpaper/compression.ts",
    "let bytes = lod.overheadBytes;", "let bytes = 0;"],
  ["wrong-r8-delta-scale", "temporal", "ss/wallpaper/codec.ss.ts",
    "anchor + 2 * (delta - 128)", "anchor + (delta - 128)"],
  ["ignore-decoded-memory-total", "storage", "src/wallpaper/compression.ts",
    "bytes > 36_000_000 || this.#decoded + bytes > this.ceilingBytes", "bytes > 36_000_000"],
  ["skip-recipe-checksum", "recipe", "ss/wallpaper/recipe.ss.ts",
    "if (readLE(bytes, 508, 4) !== crc32(bytes, 0, 508)) return BAD_INPUT();", ""],
  ["round-half-up", "recipe", "ss/wallpaper/color.ss.ts",
    "fraction > .5 || (fraction === .5 && mod(lower, 2) !== 0)", "fraction >= .5"],
];

function runtimeFloor(cwd: string, name?: string) {
  const pattern = name === undefined ? [] : ["--test-name-pattern", name];
  const result = Bun.spawnSync([process.execPath, "test", "tests/wallpaper-runtime.test.ts", ...pattern], { cwd });
  return { code: result.exitCode, transcript: result.stdout.toString() + result.stderr.toString() };
}

test("wallpaper mutation gate kills every source mutant on its named floor", () => {
  const sandbox = mkdtempSync(join(tmpdir(), "starlux-wallpaper-mutants-"));
  try {
    for (const dir of ["ss", "src"]) cpSync(join(root, dir), join(sandbox, dir), { recursive: true });
    mkdirSync(join(sandbox, "tests"));
    writeFileSync(join(sandbox, "package.json"), readFileSync(join(root, "package.json")));
    cpSync(join(root, "tests/wallpaper-runtime.test.ts"), join(sandbox, "tests/wallpaper-runtime.test.ts"));
    const baseline = runtimeFloor(sandbox);
    expect(baseline.code, baseline.transcript).toBe(0);
    let killed = 0;
    for (const [id, floor, file, needle, fault] of mutants) {
      const path = join(sandbox, file);
      const clean = readFileSync(path, "utf8");
      expect(clean.split(needle).length, id).toBe(2);
      writeFileSync(path, clean.replace(needle, fault));
      const red = runtimeFloor(sandbox, floors[floor]);
      writeFileSync(path, clean);
      expect(red.code, `${id}\n${red.transcript}`).toBe(1);
      expect(red.transcript).toContain(`(fail) ${floors[floor]}`);
      expect(red.transcript).toContain("error: expect(");
      killed++;
    }
    expect(killed).toBe(mutants.length);
    expect(killed).toBeGreaterThanOrEqual(18);
    console.log(`Killed ${killed}/${mutants.length} wallpaper mutants (100%)`);
  } finally { rmSync(sandbox, { force: true, recursive: true }); }
}, 30_000);
