import { describe, expect, test } from "bun:test";
import {
  audioCatalogCount,
  audioCeilingS16,
  bandpassCoeffs,
  catalogFamilyName,
  catalogSize,
  createRenderState,
  cueIdBySlug,
  cueSlug,
  f32ToS16Exact,
  findCueByTrigger,
  getAudioCue,
  getAudioCueBySlug,
  lcgNext,
  materialModeRatio,
  panGainLQ15,
  panGainRQ15,
  pcmDigest,
  renderBlock,
  s16ToF32Exact,
  scaleDurationByRate,
  scaleOffsetByRate,
  stepBandpass,
  submitCueCommands,
  xorshift32Next,
} from "../src/audio/index.ts";

describe("@mogos/starlux/audio 250-effect catalog & DSP parity laws", () => {
  test("all 250 cues exist across 10 families x 25 with unique slugs and valid recipes", () => {
    expect(catalogSize()).toBe(250);
    expect(audioCatalogCount()).toBe(250);
    const seenSlugs = new Set<string>();
    const familyCounts = new Array<number>(10).fill(0);
    const validKinds = new Set([
      "IMPULSE", "SNAP_ENGAGE", "SNAP_RELEASE", "BOUNDARY_HIT",
      "SETTLE", "OS_STATE_CHANGE", "VOICE_LEVEL",
    ]);

    for (let id = 1; id <= 250; id++) {
      const cue = getAudioCue(id);
      expect(cue.id).toBe(id);
      expect(cue.slug.length).toBeGreaterThan(3);
      expect(seenSlugs.has(cue.slug)).toBe(false);
      seenSlugs.add(cue.slug);
      expect(cueSlug(id)).toBe(cue.slug);
      expect(cueIdBySlug(cue.slug)).toBe(id);
      expect(getAudioCueBySlug(cue.slug).id).toBe(id);
      expect(cue.family).toBeGreaterThanOrEqual(0);
      expect(cue.family).toBeLessThan(10);
      familyCounts[cue.family] = (familyCounts[cue.family] ?? 0) + 1;
      expect(catalogFamilyName(cue.family)).not.toBe("unknown");
      expect(cue.description.length).toBeGreaterThan(5);
      expect(cue.recipe.length).toBeGreaterThan(3);
      expect(cue.durationMs).toBeGreaterThan(0);
      expect(cue.durationMs).toBeLessThanOrEqual(900);
      expect(cue.peakDbfs).toBeLessThanOrEqual(-18);
      expect(cue.hits.length).toBeGreaterThanOrEqual(1);
      expect(cue.hits.length).toBeLessThanOrEqual(4);
      expect(validKinds.has(cue.triggerKind)).toBe(true);
      expect(cue.triggerTransition.length).toBeGreaterThan(0);
      for (const hit of cue.hits) {
        expect(hit.material).toBeGreaterThanOrEqual(0);
        expect(hit.material).toBeLessThanOrEqual(5);
        expect(hit.frames).toBeGreaterThanOrEqual(4);
        expect(hit.hz10).toBeGreaterThan(0);
      }
    }
    expect(seenSlugs.size).toBe(250);
    for (let f = 0; f < 10; f++) {
      expect(familyCounts[f]).toBe(25);
    }
    expect(findCueByTrigger("IMPULSE", "down")).toBe(cueIdBySlug("control.press"));
    expect(findCueByTrigger("OS_STATE_CHANGE", "completed")).toBe(cueIdBySlug("star.done"));
    expect(findCueByTrigger("OS_STATE_CHANGE", "audioEnabled")).toBe(cueIdBySlug("system.on"));
  });

  test("Floor P01, P02, P03, P10: exact PRNGs, glass ratios, and s16<->f32 round-trip", () => {
    const s1 = lcgNext(7);
    const s2 = lcgNext(s1);
    expect(s1).toBe(117649);
    expect(s2).toBe(1977326743);
    expect(xorshift32Next(1)).toBe(270369);

    expect(materialModeRatio(0, 0)).toBe(1);
    expect(materialModeRatio(0, 1)).toBe(2.756);
    expect(materialModeRatio(0, 2)).toBe(5.404);
    expect(materialModeRatio(0, 3)).toBe(8.933);

    for (let v = -32768; v <= 32767; v++) {
      const f = s16ToF32Exact(v);
      if (v === 0) expect(Object.is(f, 0)).toBe(true);
      expect(f32ToS16Exact(f)).toBe(v);
    }
  });

  test("Floor P06 & A17: constant-peak bandpass unit impulse and equal-power pan law", () => {
    const bp = bandpassCoeffs(1000);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    let energy = 0;
    for (let i = 0; i < 64; i++) {
      const x = i === 0 ? 16384 : 0;
      const step = stepBandpass(x, bp.b0Q29, bp.a1Q29, bp.a2Q29, x1, x2, y1, y2);
      x1 = step.x1; x2 = step.x2; y1 = step.y1; y2 = step.y2;
      energy += Math.abs(step.y);
      expect(Math.abs(step.y)).toBeLessThanOrEqual(131071);
    }
    expect(energy).toBeGreaterThan(0);

    // Equal-power pan endpoints and center
    expect(panGainLQ15(-32767)).toBe(32768);
    expect(panGainRQ15(-32767)).toBe(0);
    expect(panGainLQ15(32767)).toBe(0);
    expect(panGainRQ15(32767)).toBe(32768);
    expect(panGainLQ15(0)).toBe(panGainRQ15(0));
    const sumSq = Math.pow(panGainLQ15(0) / 32768, 2) + Math.pow(panGainRQ15(0) / 32768, 2);
    expect(Math.abs(sumSq - 1)).toBeLessThan(0.0002);
  });

  test("Floor A13: slow-mo rate law on window.min (0.25x doubles duration & 4x onset)", () => {
    const minCue = getAudioCueBySlug("window.min");
    expect(minCue.hits.length).toBe(2);
    const secondOffset1x = minCue.hits[1]!.startFrames; // 70 ms = 3360 frames
    expect(secondOffset1x).toBe(3360);
    expect(scaleOffsetByRate(secondOffset1x, 25)).toBe(13440); // 280 ms at 0.25x
    const dur1x = minCue.hits[0]!.frames; // 140 ms = 6720 frames
    const dur025x = scaleDurationByRate(dur1x, 25);
    expect(Math.abs(dur025x - dur1x * 2)).toBeLessThanOrEqual(1);
  });

  test("Floor A02 & A03: render all 250 cues; peak <= 23197 (-3 dBFS) and zero onset sample", () => {
    for (let id = 1; id <= 250; id++) {
      const cue = getAudioCue(id);
      let st = createRenderState();
      st = submitCueCommands(st, cue, 0, id, 1, 7, 32768, 0, 100, -1, 0);
      const blk = renderBlock(st, 256);
      expect(blk.pcmS16[0]).toBe(0);
      expect(blk.pcmS16[1]).toBe(0);
      expect(blk.state.peakHoldS16).toBeLessThanOrEqual(audioCeilingS16());
      let nonZero = 0;
      for (const s of blk.pcmS16) {
        expect(Math.abs(s)).toBeLessThanOrEqual(audioCeilingS16());
        if (s !== 0) nonZero += 1;
      }
      expect(nonZero).toBeGreaterThan(0);
    }
  });

  test("Block-repartition invariance across 1, 17, 128, 256 frame chunks", () => {
    const cue = getAudioCueBySlug("dock.ignite");
    const runWithChunk = (chunkSize: number) => {
      let st = createRenderState();
      st = submitCueCommands(st, cue, 0, 1, 1, 7, 32768, -12000, 100, -1, 0);
      const out: number[] = [];
      let rem = 256;
      while (rem > 0) {
        const n = Math.min(rem, chunkSize);
        const res = renderBlock(st, n);
        st = res.state;
        for (const s of res.pcmS16) out.push(s);
        rem -= n;
      }
      return { digest: pcmDigest(out), frame: st.frame, comp: st.compGainQ15, peak: st.peakHoldS16 };
    };
    const r256 = runWithChunk(256);
    expect(runWithChunk(128)).toEqual(r256);
    expect(runWithChunk(17)).toEqual(r256);
    expect(runWithChunk(1)).toEqual(r256);
  });
});
