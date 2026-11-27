import { expect, test } from "bun:test";
import { createLuxEventBus } from "../src/events.ts";
import { acquireWake, createLuxClock, heldWakeTokens } from "../src/lux.ts";
import {
  attenuate, bindLightEffects, defaultLightPolicy, emptyLightEffectPlan, layer, LightField, lightEffect,
  polarityBind, resolveLightEffect, sampleLightEffect, sequence, writeLightBytes,
} from "../src/light/index.ts";
import type { LightFrameHost, LightPolicy, SurfaceFrame } from "../src/light/index.ts";

const frame: SurfaceFrame = { id: 7, x: 25, y: 10, width: 380, height: 210, radius: 20, blurPx: 17 };

function fixture(policy: LightPolicy = defaultLightPolicy) {
  let last = 0;
  let clock = createLuxClock();
  const callbacks = new Map<number, (ms: number) => void>();
  const host: LightFrameHost = {
    requestFrame(callback) { callbacks.set(++last, callback); return last; },
    cancelFrame(handle) { callbacks.delete(handle); },
  };
  let glyph = [0, 0, 0, 0];
  const frames: { bytes: Uint8Array; scene: readonly number[]; words: readonly number[] }[] = [];
  const field = new LightField({ host, policy, clock: { read: () => clock, write: (value) => { clock = value; } },
    paintGlyph(words) { glyph = Array.from(words); } });
  const detach = field.attachSurface(frame, (words, scene) => {
    const bytes = new Array<number>(5408).fill(0);
    writeLightBytes(words, bytes);
    frames.push({ bytes: Uint8Array.from(bytes), scene: Array.from(scene), words: Array.from(words) });
  });
  const run = (ms: number) => {
    for (const [id, callback] of [...callbacks]) {
      callbacks.delete(id);
      callback(ms);
    }
  };
  return { field, frames, run, callbacks, detach, glyph: () => glyph, clock: () => clock,
    unrelatedLease() { clock = acquireWake(clock, "body").clock; } };
}

test("runtime glyph toggle never changes reflection bytes or schedules", () => {
  const shown = fixture();
  const hidden = fixture();
  hidden.field.setSourceVisible(false);
  for (let i = 0; i < 100; i++) {
    const p = { x: -210 + i * 7, y: i * 2 };
    for (const { field, run } of [shown, hidden]) {
      field.samplePointer(p);
      run(i * 17);
    }
    expect(shown.frames.at(-1)?.bytes).toEqual(hidden.frames.at(-1)?.bytes);
    expect(shown.frames.at(-1)?.scene).toEqual(hidden.frames.at(-1)?.scene);
    expect(shown.glyph()[0]).toBe(1);
    expect(hidden.glyph()[0]).toBe(0);
  }
  expect(shown.frames[0]!.bytes).not.toEqual(shown.frames.at(-1)?.bytes);
  const stats = shown.field.metrics();
  shown.field.setSourceVisible(false);
  expect(shown.field.metrics()).toEqual({ ...stats, glyphWrites: stats.glyphWrites + 1 });
  expect(shown.callbacks.size).toBe(0);
  shown.field.samplePointer({ x: 90, y: 80 });
  const before = shown.field.metrics();
  shown.field.setSourceVisible(true);
  expect(shown.field.metrics()).toEqual({ ...before, glyphWrites: before.glyphWrites + 1 });
  shown.run(1700);
  expect(shown.field.metrics().heldWakeTokens).toBe(0);
});

test("clean flush and stationary samples schedule zero light work", () => {
  const { field, run, callbacks, clock } = fixture();
  field.samplePointer({ x: 120, y: 72 });
  run(0);
  const before = field.metrics();
  for (let i = 0; i < 100; i++) {
    field.samplePointer({ x: 120 + i * .000001, y: 72 });
    expect(field.flush()).toBe(0);
    run(i * 100);
  }
  expect(field.metrics()).toEqual(before);
  expect(heldWakeTokens(clock())).toBe(0);
  expect(callbacks.size).toBe(0);
});

test("coalesced input and independent dirty surface geometry", () => {
  const { field, run, callbacks } = fixture();
  let other = 0;
  field.attachSurface({ ...frame, id: 8, x: 390 }, () => { other++; });
  for (let i = 0; i < 100; i++) field.samplePointer({ x: i, y: i * 2 });
  expect(callbacks.size).toBe(1);
  run(0);
  expect(field.metrics().evaluations).toBe(2);
  expect(other).toBe(1);
  field.setSurface({ ...frame, radius: 35 });
  run(17);
  expect(field.metrics().evaluations).toBe(3);
  expect(other).toBe(1);
  expect(field.setEmitter("unexpected" as never, { x: 0, y: 0 })).toBe(false);
  expect(callbacks.size).toBe(0);
});

test("reduced-motion static upper-leading key suppresses pointer work", () => {
  const { field, frames, callbacks, run } = fixture();
  field.samplePointer({ x: 400, y: 240 });
  run(0);
  const before = frames.at(-1)!.bytes;
  field.setPolicy({ ...defaultLightPolicy, motion: "reduce" });
  expect(frames.at(-1)!.bytes).not.toEqual(before);
  expect(frames.at(-1)!.scene.slice(0, 2)).toEqual([32 * 256, 24 * 256]);
  const after = field.metrics();
  for (let i = 0; i < 60; i++) expect(field.samplePointer({ x: i * 30, y: i })).toBe(false);
  expect(field.metrics()).toEqual(after);
  field.setEmitter("focus", { x: 120, y: 55 });
  expect(field.metrics().evaluations).toBe(after.evaluations + 1);
  expect(callbacks.size).toBe(0);
});

test("hide releases the light lease and rejects stale callbacks on a shared clock", () => {
  const { field, frames, callbacks, clock, unrelatedLease, run } = fixture();
  unrelatedLease();
  field.samplePointer({ x: 150, y: 90 });
  const stale = [...callbacks.values()][0]!;
  field.setHidden(true);
  expect(callbacks.size).toBe(0);
  expect(heldWakeTokens(clock())).toBe(1);
  const before = field.metrics();
  stale(17);
  expect(field.metrics().acceptedTicks).toBe(before.acceptedTicks);
  expect(field.metrics().evaluations).toBe(before.evaluations);
  field.setPolicy({ ...defaultLightPolicy, polarity: "sunlit-alabaster-light", deviceScale: 3 });
  field.setSurface({ ...frame, width: 300 });
  field.setHidden(false);
  run(33);
  expect(frames[0]?.words[8 + 16 + 14]).toBe(2);
  expect(heldWakeTokens(clock())).toBe(1);
  field.dispose();
  expect(callbacks.size).toBe(0);
});

test("effect plans layer, sequence, attenuate and bind polarity", () => {
  const rim = lightEffect("rim.tab-leading", "focus");
  const under = lightEffect("caustic.under-tab", "pointer");
  const effect = attenuate(layer(rim, under), .5);
  const event = { kind: "OS_STATE_CHANGE" as const, subject: 7, timeUs: 100, intensity: .8 };
  const point = { x: 14, y: 18 };
  const snapshot = { pose: point, binding: "tab-select", subject: 7 };
  const a = sampleLightEffect(resolveLightEffect(effect, event, snapshot), 100, defaultLightPolicy);
  const b = sampleLightEffect(resolveLightEffect(attenuate(layer(under, rim, emptyLightEffectPlan), .5), event, snapshot),
    100, defaultLightPolicy);
  expect(a).toEqual(b);
  expect(a.map(({ slot, emitter }) => [slot, emitter.gain])).toEqual([["pointer", .4], ["focus", .4]]);
  expect(() => layer(rim, lightEffect("caustic.under-tab", "focus"))).toThrow("Ambiguous");
  const joined = sampleLightEffect(resolveLightEffect(layer(attenuate(rim, .5), attenuate(rim, .5)), event, snapshot),
    100, defaultLightPolicy);
  expect(joined[0]?.emitter.gain).toBe(.8);
  expect(sampleLightEffect(resolveLightEffect(polarityBind(effect, "sunlit-alabaster-light"), event, snapshot),
    100, defaultLightPolicy)).toEqual([]);
  expect(sampleLightEffect(resolveLightEffect(effect, event, { ...snapshot, subject: 8 }), 100, defaultLightPolicy)).toEqual([]);
  const sweep = lightEffect("sweep.commit");
  const two = sequence(sweep, sweep);
  expect(two.steps.map((step) => step.startUs)).toEqual([0, 180000]);
  expect(two.durationUs).toBe(360000);
});

test("LuxEvent dispatch follows a retained physics path and finite lease", () => {
  const { field, frames, callbacks, run } = fixture();
  const bus = createLuxEventBus();
  const point = { x: 290, y: 20 };
  const unsub = bindLightEffects(field, bus, lightEffect("sweep.commit"), ({ subject }) =>
    ({ binding: "commit", subject, pose: { x: 10, y: 20 }, path: [{ x: 10, y: 20 }, point] }));
  bus.publish({ kind: "OS_STATE_CHANGE", timeUs: 0, subject: 7, intensity: 1 });
  point.x = 2000;
  run(36);
  expect(frames.at(-1)!.scene[0]).toBe(66 * 256);
  run(190);
  expect(frames.at(-1)!.words[3]).toBe(0);
  expect(field.metrics().heldWakeTokens).toBe(0);
  expect(callbacks.size).toBe(0);
  unsub();
});

test("reduction mid-sweep cancels pending work and never resumes the old envelope", () => {
  const { field, frames, run, callbacks } = fixture();
  field.samplePointer({ x: 410, y: -20 });
  const active = resolveLightEffect(lightEffect("sweep.commit"),
    { kind: "OS_STATE_CHANGE", subject: 7, timeUs: 0, intensity: 1 },
    { subject: 7, binding: "commit", pose: { x: 25, y: 15 }, target: { x: 180, y: 90 } });
  field.applyEffect(active);
  run(36);
  const stale = [...callbacks.values()][0]!;
  field.setPolicy({ ...defaultLightPolicy, motion: "off" });
  expect(callbacks.size).toBe(0);
  const before = field.metrics();
  stale(60);
  expect(field.metrics().acceptedTicks).toBe(before.acceptedTicks);
  field.setPolicy(defaultLightPolicy);
  run(100);
  expect(frames.at(-1)!.scene[0]).toBe(410 * 256);
  expect(callbacks.size).toBe(0);
});

test("stale callback cannot consume a replacement lease", () => {
  const { field, callbacks, unrelatedLease, run } = fixture();
  unrelatedLease();
  field.samplePointer({ x: 70, y: 90 });
  const stale = [...callbacks.values()][0]!;
  field.cancel();
  field.samplePointer({ x: 80, y: 100 });
  const before = field.metrics();
  stale(17);
  expect(field.metrics().evaluations).toBe(before.evaluations);
  expect(field.metrics().acceptedTicks).toBe(before.acceptedTicks);
  expect(field.metrics().heldWakeTokens).toBe(1);
  run(34);
  expect(field.metrics().acceptedTicks).toBe(before.acceptedTicks + 1);
});

test("preset glyph defaults preserve an explicit user toggle", () => {
  const { field, glyph, run } = fixture();
  field.samplePointer({ x: 60, y: 70 });
  const active = resolveLightEffect(lightEffect("lamp.slider-thumb"),
    { kind: "OS_STATE_CHANGE", subject: 7, timeUs: 0, intensity: 1 },
    { subject: 7, binding: "slider", pose: { x: 85, y: 70 } });
  field.applyEffect(active);
  run(0);
  expect(glyph()[0]).toBe(0);
  field.setSourceVisible(true);
  field.applyEffect(active);
  run(17);
  expect(glyph()[0]).toBe(1);
});
