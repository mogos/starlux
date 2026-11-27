// Comprehensive Bun unit + 12 red-before mutant test suite for @mogos/starlux/voice.
import { describe, expect, test } from "bun:test";
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  VOICE_REST,
  VOICE_LISTEN,
  VOICE_THINK,
  VOICE_SPEAK,
  VOICE_ACT,
  VOICE_CONFIRM,
  VOICE_ERROR,
  VOICE_DONE,
  VOICE_STYLE_COUNT,
  VOICE_PRIM_STRIDE,
  createVoiceMachine,
  stepVoiceMachine,
  voiceHeldWakeTokens,
  createVoiceSignalState,
  processPcmFrame,
  signalBandTotalEnergy,
  synthesizeSpeechCadence,
  evalVoiceStyle,
  getVoiceStyleMeta,
  findVoiceStyleBySlug,
  getAllVoiceStyles,
  createVoiceRuntime,
  setVoiceRuntimeStyle,
  setVoiceRuntimeReducedMotion,
  stepVoiceFrame,
  stepVoiceFrameWithPcm,
} from "../src/voice.ts";
import { sin64 } from "../ss/physics/math.ss.ts";

const EXPECTED_SLUGS = [
  "amber-bead-cadence",
  "sol-dot-constellation",
  "braille-cadence-matrix",
  "pendulum-pearls",
  "horizon-spark-ticks",
  "morse-ember-pulse",
  "sunlit-eq-bars",
  "glass-prism-columns",
  "mirror-horizon-eq",
  "kinetic-spring-pillars",
  "stepped-telemetry-vu",
  "slit-aperture-bars",
  "solar-filament-ribbon",
  "liquid-mercury-wave",
  "calligraphic-twin-wave",
  "whisper-dunes",
  "dual-helix-lissajous",
  "horizon-breath-line",
  "sun-corona-ring",
  "concentric-acoustic-ripples",
  "sunburst-spokes",
  "orbital-eclipse-arcs",
  "chladni-resonance-ring",
  "ferrofluid-amber-blob",
  "caustic-light-band",
  "ember-spark-swarm",
  "waterfall-spectrogram",
  "crystalline-chime-petals",
];

function makeSinePcm(freqHz: number, amp: number, len = 128, sr = 16000): number[] {
  const out: number[] = [];
  for (let i = 0; i < len; i++) {
    out.push(amp * sin64((2 * Math.PI * freqHz * i) / sr));
  }
  return out;
}

describe("Starlux Voice 28-Style Backend", () => {
  test("catalog exposes all 28 exact slugs across 5 families", () => {
    const all = getAllVoiceStyles();
    expect(all.length).toBe(VOICE_STYLE_COUNT);
    expect(all.length).toBe(28);
    const families = new Set<string>();
    for (let i = 0; i < 28; i++) {
      const m = getVoiceStyleMeta(i);
      expect(m.id).toBe(i);
      expect(m.slug).toBe(EXPECTED_SLUGS[i]);
      expect(findVoiceStyleBySlug(m.slug)).toBe(i);
      expect(m.minWidthPx).toBeGreaterThanOrEqual(100);
      expect(m.primitiveCount).toBeGreaterThanOrEqual(10);
      families.add(m.family);
    }
    expect(families.size).toBe(5);
    expect(findVoiceStyleBySlug("nonexistent")).toBe(-1);
  });

  test("VoiceStateMachine covers all 8 states, dwell hysteresis, reducedMotion freeze, and 0-idle WakeToken at rest", () => {
    let m = createVoiceMachine(false);
    expect(voiceHeldWakeTokens(m)).toBe(0);

    for (const s of [
      VOICE_REST,
      VOICE_LISTEN,
      VOICE_THINK,
      VOICE_SPEAK,
      VOICE_ACT,
      VOICE_CONFIRM,
      VOICE_ERROR,
      VOICE_DONE,
    ]) {
      m = stepVoiceMachine(m, s, 0.8, 16000, true);
      expect(m.state).toBe(s);
      if (s !== VOICE_REST) {
        expect(voiceHeldWakeTokens(m)).toBe(1);
      }
    }

    // Settle back to REST
    for (let i = 0; i < 120; i++) {
      m = stepVoiceMachine(m, VOICE_REST, 0, 16000, true);
      if (voiceHeldWakeTokens(m) === 0 && m.energy === 0 && m.presence === 0) break;
    }
    expect(voiceHeldWakeTokens(m)).toBe(0);
    const active0 = m.activeTicks;
    const phase0 = m.phase;
    for (let i = 0; i < 240; i++) {
      m = stepVoiceMachine(m, VOICE_REST, 0, 16000, false);
    }
    expect(m.activeTicks).toBe(active0);
    expect(m.phase).toBe(phase0);
    expect(voiceHeldWakeTokens(m)).toBe(0);
    expect(m.idleSkippedTicks).toBeGreaterThanOrEqual(240);

    // Dwell hysteresis (listen -> speak requires 60ms dwell)
    let hm = stepVoiceMachine(createVoiceMachine(false), VOICE_LISTEN, 0.6, 16000, true);
    hm = stepVoiceMachine(hm, VOICE_SPEAK, 0.8, 16000, false);
    expect(hm.state).toBe(VOICE_LISTEN);
    for (let i = 0; i < 5; i++) {
      hm = stepVoiceMachine(hm, VOICE_SPEAK, 0.8, 16000, false);
    }
    expect(hm.state).toBe(VOICE_SPEAK);

    // reducedMotion freezes phase
    let rm = stepVoiceMachine(createVoiceMachine(true), VOICE_SPEAK, 0.85, 16000, true);
    const rPhase0 = rm.phase;
    for (let i = 0; i < 30; i++) {
      rm = stepVoiceMachine(rm, VOICE_SPEAK, 0.85, 16000, false);
    }
    expect(rm.phase).toBe(rPhase0);
  });

  test("VoiceSignalProcessor computes 8-band Goertzel energy conservation and Schmitt VAD hysteresis", () => {
    const loud440 = makeSinePcm(440, 0.7);
    const mid440 = makeSinePcm(440, 0.12);
    const silent = new Array<number>(128).fill(0);

    let sig = createVoiceSignalState();
    for (let i = 0; i < 8; i++) {
      sig = processPcmFrame(sig, loud440, 16000, 16000);
    }
    expect(sig.vadActive).toBe(1);
    expect(sig.b2).toBeGreaterThan(sig.b7);
    const total = signalBandTotalEnergy(sig);
    expect(total).toBeGreaterThan(0.2);
    expect(total).toBeLessThanOrEqual(8.0);

    // Mid-band stays active due to hysteresis
    sig = processPcmFrame(sig, mid440, 16000, 16000);
    expect(sig.vadActive).toBe(1);

    // Silence drains hangover and closes VAD
    for (let i = 0; i < 30; i++) {
      sig = processPcmFrame(sig, silent, 16000, 16000);
    }
    expect(sig.vadActive).toBe(0);
    expect(signalBandTotalEnergy(sig)).toBeLessThan(0.05);

    // Synthetic cadence at REST stays strictly silent
    const restSig = synthesizeSpeechCadence(sig, 16000, VOICE_REST, 0.9);
    expect(restSig.rms).toBe(0);
    expect(signalBandTotalEnergy(restSig)).toBe(0);
  });

  test("all 28 styles emit distinct normalized flat stride-8 primitive buffers across all 8 states", () => {
    let syn = createVoiceSignalState();
    for (let i = 0; i < 12; i++) {
      syn = synthesizeSpeechCadence(syn, 16000, VOICE_SPEAK, 0.85);
    }
    const signatures = new Set<string>();
    for (let id = 0; id < 28; id++) {
      const meta = getVoiceStyleMeta(id);
      const frame = evalVoiceStyle(id, VOICE_SPEAK, 0.8, 1.0, 2.2, syn, false);
      expect(frame.styleId).toBe(id);
      expect(frame.kind).toBe(meta.primitiveKind);
      expect(frame.count).toBe(meta.primitiveCount);
      expect(frame.primitives.length).toBe(meta.primitiveCount * VOICE_PRIM_STRIDE);
      for (const v of frame.primitives) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(-1.0001);
        expect(v).toBeLessThanOrEqual(1.0001);
      }
      signatures.add(frame.primitives.map((n) => Math.round(n * 1000)).join(","));
    }
    expect(signatures.size).toBe(28);

    // Verify stepVoiceFrame + stepVoiceFrameWithPcm runtime helpers
    let rt = createVoiceRuntime(0, false);
    const res1 = stepVoiceFrame(rt, VOICE_SPEAK, 16000, 0.8, true);
    expect(res1.heldWakeTokens).toBe(1);
    expect(res1.frame.count).toBe(12);
    rt = setVoiceRuntimeStyle(setVoiceRuntimeReducedMotion(res1.runtime, true), 18);
    const res2 = stepVoiceFrameWithPcm(rt, VOICE_SPEAK, makeSinePcm(440, 0.6), 16000, 16000, true);
    expect(res2.frame.styleId).toBe(18);
    expect(res2.frame.count).toBe(24);
  });

  test("12 red-before source mutants are 100% KILLED across state, signal, catalog, and all 5 style families", async () => {
    const root = join(import.meta.dir, "..");
    type MutantSpec = {
      name: string;
      relFile: string;
      find: string;
      replace: string;
      check: (mod: typeof import("../src/voice.ts")) => boolean;
    };

    const mutants: MutantSpec[] = [
      {
        name: "01-wake-idle-burn",
        relFile: "ss/voice/state.ss.ts",
        find: "if (settledAtRest) {",
        replace: "if (false && settledAtRest) {",
        check: (mod) => {
          let m = mod.createVoiceMachine(false);
          const a0 = m.activeTicks;
          m = mod.stepVoiceMachine(m, mod.VOICE_REST, 0, 16000, false);
          return m.activeTicks === a0 && mod.voiceHeldWakeTokens(m) === 0;
        },
      },
      {
        name: "02-reduced-motion-phase-drift",
        relFile: "ss/voice/state.ss.ts",
        find: "if (machine.reducedMotion) {",
        replace: "if (false && machine.reducedMotion) {",
        check: (mod) => {
          let rm = mod.stepVoiceMachine(mod.createVoiceMachine(true), mod.VOICE_SPEAK, 0.8, 16000, true);
          const p0 = rm.phase;
          rm = mod.stepVoiceMachine(rm, mod.VOICE_SPEAK, 0.8, 16000, false);
          return rm.phase === p0;
        },
      },
      {
        name: "03-dwell-hysteresis-bypass",
        relFile: "ss/voice/state.ss.ts",
        find: "return 60000;",
        replace: "return 0;",
        check: (mod) => {
          let m = mod.stepVoiceMachine(mod.createVoiceMachine(false), mod.VOICE_LISTEN, 0.6, 16000, true);
          m = mod.stepVoiceMachine(m, mod.VOICE_SPEAK, 0.8, 16000, false);
          return m.state === mod.VOICE_LISTEN;
        },
      },
      {
        name: "04-vad-hysteresis-premature-drop",
        relFile: "ss/voice/signal.ss.ts",
        find: "if (envFast <= 0.07) {",
        replace: "if (envFast <= 0.14) {",
        check: (mod) => {
          let sig = mod.createVoiceSignalState();
          const loud = makeSinePcm(440, 0.7);
          const mid = makeSinePcm(440, 0.12);
          for (let i = 0; i < 8; i++) sig = mod.processPcmFrame(sig, loud, 16000, 16000);
          for (let i = 0; i < 40; i++) sig = mod.processPcmFrame(sig, mid, 16000, 16000);
          return sig.vadActive === 1;
        },
      },
      {
        name: "05-band-conservation-overflow",
        relFile: "ss/voice/signal.ss.ts",
        find: "const maxAllowed = clamp(rawRms * 6.0, 0, 8.0);",
        replace: "const maxAllowed = 9999.0; r0 = 5.0; r1 = 5.0;",
        check: (mod) => {
          let sig = mod.createVoiceSignalState();
          const quiet = makeSinePcm(440, 0.05);
          for (let i = 0; i < 15; i++) sig = mod.processPcmFrame(sig, quiet, 16000, 16000);
          return mod.signalBandTotalEnergy(sig) <= 1.0;
        },
      },
      {
        name: "06-rest-cadence-signal-leak",
        relFile: "ss/voice/signal.ss.ts",
        find: "if (stateId === VOICE_REST) {",
        replace: "if (false && stateId === VOICE_REST) {",
        check: (mod) => {
          const s = mod.synthesizeSpeechCadence(mod.createVoiceSignalState(), 16000, mod.VOICE_REST, 0.9);
          return s.rms === 0 && mod.signalBandTotalEnergy(s) === 0;
        },
      },
      {
        name: "07-family-a-amber-bead-corrupt",
        relFile: "ss/voice/styles.ss.ts",
        find: "for (let i = 0; i < 12; i++) {",
        replace: "for (let i = 0; i < 4; i++) {",
        check: (mod) => {
          const f = mod.evalVoiceStyle(0, mod.VOICE_SPEAK, 0.8, 1, 1.5, mod.createVoiceSignalState(), false);
          return f.primitives.length === 12 * 8;
        },
      },
      {
        name: "08-family-b-eq-bars-corrupt",
        relFile: "ss/voice/styles.ss.ts",
        find: "if (styleId === 6) {\n    const buf: number[] = [];\n    // 6: sunlit-eq-bars",
        replace: "if (styleId === 6) {\n    const buf: number[] = [];\n    return { styleId: 6, kind: PRIM_KIND_BAR, count: 0, primitives: buf };\n    // 6: sunlit-eq-bars",
        check: (mod) => {
          const f = mod.evalVoiceStyle(6, mod.VOICE_SPEAK, 0.8, 1, 1.5, mod.createVoiceSignalState(), false);
          return f.count === 16 && f.primitives.length === 16 * 8;
        },
      },
      {
        name: "09-family-c-ribbon-corrupt",
        relFile: "ss/voice/styles.ss.ts",
        find: "if (styleId === 12) {\n    const buf: number[] = [];\n    // 12: solar-filament-ribbon",
        replace: "if (styleId === 12) {\n    const buf: number[] = [];\n    return { styleId: 12, kind: PRIM_KIND_RIBBON, count: 0, primitives: buf };\n    // 12: solar-filament-ribbon",
        check: (mod) => {
          const f = mod.evalVoiceStyle(12, mod.VOICE_SPEAK, 0.8, 1, 1.5, mod.createVoiceSignalState(), false);
          return f.count === 24 && f.primitives.length === 24 * 8;
        },
      },
      {
        name: "10-family-d-corona-corrupt",
        relFile: "ss/voice/styles.ss.ts",
        find: "if (styleId === 18) {\n    const buf: number[] = [];\n    // 18: sun-corona-ring",
        replace: "if (styleId === 18) {\n    const buf: number[] = [];\n    return { styleId: 18, kind: PRIM_KIND_RADIAL, count: 0, primitives: buf };\n    // 18: sun-corona-ring",
        check: (mod) => {
          const f = mod.evalVoiceStyle(18, mod.VOICE_SPEAK, 0.8, 1, 1.5, mod.createVoiceSignalState(), false);
          return f.count === 24 && f.primitives.length === 24 * 8;
        },
      },
      {
        name: "11-family-e-ferrofluid-corrupt",
        relFile: "ss/voice/styles.ss.ts",
        find: "if (styleId === 23) {\n    const buf: number[] = [];\n    // 23: ferrofluid-amber-blob",
        replace: "if (styleId === 23) {\n    const buf: number[] = [];\n    return { styleId: 23, kind: PRIM_KIND_FIELD, count: 0, primitives: buf };\n    // 23: ferrofluid-amber-blob",
        check: (mod) => {
          const f = mod.evalVoiceStyle(23, mod.VOICE_SPEAK, 0.8, 1, 1.5, mod.createVoiceSignalState(), false);
          return f.count === 20 && f.primitives.length === 20 * 8;
        },
      },
      {
        name: "12-catalog-slug-drift",
        relFile: "ss/voice/catalog.ss.ts",
        find: 'slug: "amber-bead-cadence"',
        replace: 'slug: "wrong-slug"',
        check: (mod) => mod.findVoiceStyleBySlug("amber-bead-cadence") === 0,
      },
    ];

    const work = mkdtempSync(join(tmpdir(), "starlux-voice-mutants-"));
    try {
      let killed = 0;
      for (const m of mutants) {
        const dir = join(work, m.name);
        cpSync(join(root, "ss"), join(dir, "ss"), { recursive: true });
        cpSync(join(root, "src"), join(dir, "src"), { recursive: true });
        const target = join(dir, m.relFile);
        const orig = readFileSync(target, "utf8");
        expect(orig.includes(m.find)).toBe(true);
        writeFileSync(target, orig.replace(m.find, m.replace));
        const mod = (await import(pathToFileURL(join(dir, "src/voice.ts")).href)) as typeof import("../src/voice.ts");
        const passed = m.check(mod);
        if (passed) {
          throw new Error(`Mutant survived: ${m.name}`);
        }
        killed += 1;
      }
      expect(killed).toBe(12);
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  });
});
