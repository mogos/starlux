import {
  lightPacketWords, lightSceneWords, lightScratchWords, lightSlotIndex, paintLightSource, shadeSurface,
} from "../../ss/light/index.ss.ts";
import type { LightSlot, SourceView } from "../../ss/light/index.ss.ts";
import { acquireWake, createLuxClock, dispatchClock, releaseWake } from "../lux.ts";
import type { LuxClock } from "../lux.ts";
import { createLightInput, defaultLightPolicy, writeEmitter, writeSurfaceFrame } from "./inputs.ts";
import type { LightEmitter, LightPoint, LightPolicy, SurfaceFrame } from "./inputs.ts";
import { sampleLightEffect } from "./plan.ts";
import type { ActiveLightEffect } from "./plan.ts";

export type LightClockPort = { read(): LuxClock; write(clock: LuxClock): void };
export type LightFrameHost = {
  requestFrame(callback: (timeMs: number) => void): number;
  cancelFrame(handle: number): void;
};
export type LightSurfaceSink = (packet: readonly number[], scene: readonly number[], surface: SurfaceFrame) => void;
export type LightGlyphSink = (glyph: readonly number[]) => void;

type RegisteredSurface = {
  frame: SurfaceFrame;
  readonly sink: LightSurfaceSink;
  readonly input: number[];
  readonly before: number[];
  readonly packet: number[];
  readonly scene: number[];
  dirty: boolean;
  painted: boolean;
};

const slots: readonly LightSlot[] = ["pointer", "zenith", "star", "focus"];
const pinnedKey: LightEmitter = { x: 0, y: 0, gain: .35, dispersion: 0, ambientGain: .08 };
const validationFrame: SurfaceFrame = { id: 0, x: 0, y: 0, width: 1, height: 1 };
const same = (a: readonly number[], b: readonly number[]) => a.every((word, index) => word === b[index]);

export class LightField {
  readonly #host: LightFrameHost;
  readonly #clock: LightClockPort;
  readonly #surface = new Map<number, RegisteredSurface>();
  readonly #scratch = new Array<number>(lightScratchWords()).fill(0);
  readonly #packet = new Array<number>(lightPacketWords()).fill(0);
  readonly #scene = new Array<number>(lightSceneWords()).fill(0);
  readonly #glyph = [0, 0, 0, 0];
  readonly #glyphNext = [0, 0, 0, 0];
  readonly #glyphSink: LightGlyphSink;
  readonly #base: Partial<Record<LightSlot, LightEmitter>> = {};
  #effect: { active: ActiveLightEffect; deadlineUs: number; sampledUs: number } | undefined;
  #overrides: Partial<Record<LightSlot, LightEmitter>> = {};
  #policy: LightPolicy;
  #source: SourceView;
  #userVisibility: boolean | undefined;
  #handle: number | undefined;
  #token = 0;
  #generation = 0;
  #hidden = false;
  #disposed = false;
  #flushing = false;
  #evaluations = 0;
  #writes = 0;
  #frameRequests = 0;
  #frameEntries = 0;
  #acceptedTicks = 0;
  #glyphWrites = 0;
  #lastFrameUs = -Infinity;

  constructor(options: {
    readonly host: LightFrameHost;
    readonly paintGlyph: LightGlyphSink;
    readonly policy?: LightPolicy;
    readonly source?: SourceView;
    readonly clock?: LightClockPort;
  }) {
    this.#host = options.host;
    this.#glyphSink = options.paintGlyph;
    this.#source = options.source ? { ...options.source } : { showLightSource: true, sourceSlot: "pointer" };
    if (lightSlotIndex(this.#source.sourceSlot) < 0) throw new RangeError("LightCapacity");
    this.#policy = this.#copyPolicy(options.policy ?? defaultLightPolicy);
    createLightInput(validationFrame, this.#policy);
    let localClock = createLuxClock();
    this.#clock = options.clock ?? { read: () => localClock, write: (clock) => { localClock = clock; } };
  }

  get policy(): LightPolicy { return this.#copyPolicy(this.#policy); }
  get dirty(): boolean {
    for (const surface of this.#surface.values()) if (surface.dirty) return true;
    return false;
  }

  metrics() {
    return {
      evaluations: this.#evaluations, packetWrites: this.#writes, frameRequests: this.#frameRequests,
      frameEntries: this.#frameEntries, acceptedTicks: this.#acceptedTicks, heldWakeTokens: this.#token === 0 ? 0 : 1,
      glyphWrites: this.#glyphWrites,
    };
  }

  setSourceVisible(showLightSource: boolean): void {
    this.#userVisibility = showLightSource;
    this.#setGlyphVisibility(showLightSource);
  }

  #setGlyphVisibility(showLightSource: boolean): void {
    if (this.#source.showLightSource === showLightSource) return;
    this.#source = { ...this.#source, showLightSource };
    this.#renderGlyph();
  }

  setEmitter(slot: LightSlot, emitter?: LightEmitter): boolean {
    const index = lightSlotIndex(slot);
    if (index < 0 || this.#disposed) return false;
    const value = emitter && { ...emitter, ...(emitter.color && { color: [...emitter.color] as typeof emitter.color }) };
    createLightInput(validationFrame, this.#policy, { [slot]: value });
    if (value) this.#base[slot] = value;
    else delete this.#base[slot];
    this.#invalidate();
    return true;
  }

  samplePointer(point: LightPoint): boolean {
    if (this.#disposed || this.#pinned()) return false;
    return this.setEmitter("pointer", { ...this.#base.pointer, ...point });
  }

  setPolicy(policy: LightPolicy): void { this.updateScene(policy, []); }

  updateScene(policy: LightPolicy, surfaces: readonly SurfaceFrame[]): void {
    if (this.#disposed) return;
    const next = this.#copyPolicy(policy);
    createLightInput(validationFrame, next);
    const updates = surfaces.map((surface) => {
      const entry = this.#surface.get(surface.id);
      if (!entry) throw new RangeError("Unknown light surface " + surface.id);
      const frame = this.#copySurface(surface);
      createLightInput(frame, next);
      return { entry, frame };
    });
    for (const { entry, frame } of updates) entry.frame = frame;
    const wasPinned = this.#pinned();
    const previousTier = this.#policy.thermal;
    this.#policy = next;
    if (previousTier !== next.thermal) this.#lastFrameUs = -Infinity;
    if (!wasPinned && this.#pinned()) this.#retire();
    this.#resolveEffectPolicy();
    this.#invalidate();
  }

  attachSurface(surface: SurfaceFrame, paint: LightSurfaceSink): () => void {
    if (this.#disposed || this.#surface.has(surface.id)) throw new RangeError("Duplicate light surface or disposed field");
    const frame = this.#copySurface(surface);
    const input = createLightInput(frame, this.#policy);
    const entry: RegisteredSurface = {
      frame, input, sink: paint, before: input.slice(), packet: this.#packet.slice(), scene: this.#scene.slice(),
      dirty: true, painted: false,
    };
    this.#surface.set(surface.id, entry);
    this.#invalidate();
    return () => {
      if (this.#surface.get(surface.id) !== entry) return;
      this.#surface.delete(surface.id);
      if (this.#surface.size === 0) this.cancel();
    };
  }

  setSurface(surface: SurfaceFrame): void {
    this.updateScene(this.#policy, [surface]);
  }

  applyEffect(active: ActiveLightEffect): boolean {
    const surface = active.snapshot.surfaceId ?? active.event.subject;
    if (this.#disposed || this.#hidden || !this.#surface.has(surface) || active.plan.steps.length === 0) return false;
    const deadlineUs = active.plan.steps.reduce((end, step) => step.durationUs > 0
      ? Math.max(end, step.startUs + step.durationUs) : end, 0);
    const timeUs = active.event.timeUs;
    this.#effect = { active, deadlineUs: timeUs + deadlineUs, sampledUs: timeUs };
    this.#resolveEffectPolicy();
    this.#invalidate();
    return true;
  }

  setHidden(hidden: boolean): void {
    if (this.#hidden === hidden || this.#disposed) return;
    this.#hidden = hidden;
    if (hidden) {
      this.cancel();
      this.#renderGlyph();
    } else {
      for (const entry of this.#surface.values()) entry.painted = false;
      this.#invalidate();
    }
  }

  cancel(): void {
    this.#stopEffect();
    this.#generation++;
    this.#retire();
    this.#invalidate(false);
    if (!this.#hidden && !this.#disposed) this.flush();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.cancel();
    this.#surface.clear();
    this.#renderGlyph();
  }

  // A host may flush in its current layout transaction. A clean call is a no-op.
  flush(): number {
    if (this.#disposed || this.#hidden || this.#flushing || !this.dirty) return 0;
    this.#flushing = true;
    const start = this.#evaluations;
    try {
      for (const entry of this.#surface.values()) {
        if (!entry.dirty) continue;
        entry.dirty = false;
        for (let i = 0; i < entry.input.length; i++) entry.before[i] = entry.input[i]!;
        if (shadeSurface(entry.input, this.#packet, this.#scene, this.#scratch) !== 0) {
          throw new Error("Invalid retained light surface " + entry.frame.id);
        }
        this.#evaluations++;
        if (!entry.painted || !same(this.#packet, entry.packet) || !same(this.#scene, entry.scene)) {
          for (let i = 0; i < this.#packet.length; i++) entry.packet[i] = this.#packet[i]!;
          for (let i = 0; i < this.#scene.length; i++) entry.scene[i] = this.#scene[i]!;
          this.#writes++;
          entry.painted = true;
          entry.sink(entry.packet, entry.scene, entry.frame);
        }
      }
    } finally {
      this.#flushing = false;
      if (this.dirty || this.#animating()) this.#schedule();
      else this.#retire();
    }
    return this.#evaluations - start;
  }

  #copySurface(frame: SurfaceFrame): SurfaceFrame {
    return { ...frame, ...(frame.transform && { transform: [...frame.transform] as typeof frame.transform }),
      ...(frame.segmentClips && { segmentClips: [...frame.segmentClips] as typeof frame.segmentClips }) };
  }

  #copyPolicy(policy: LightPolicy): LightPolicy { return { ...policy, staticKey: { ...policy.staticKey } }; }
  #pinned(): boolean { return this.#policy.motion !== "full" || this.#policy.thermal === "critical"; }

  #stopEffect(): void {
    this.#effect = undefined;
    this.#overrides = {};
  }

  #resolveEffectPolicy(): void {
    const state = this.#effect;
    if (!state) return;
    if (this.#pinned()) {
      const { active } = state;
      const steps = active.plan.steps.filter((step) => step.preset.cost === "E" && step.startUs === 0);
      if (steps.length === 0) {
        this.#stopEffect();
        return;
      }
      state.active = { ...active, plan: { steps, durationUs: 0 } };
      state.deadlineUs = state.sampledUs;
    }
    this.#sampleEffect(state.sampledUs);
  }

  #animating(): boolean {
    return this.#effect !== undefined && this.#effect.sampledUs < this.#effect.deadlineUs && !this.#pinned();
  }

  #sampleEffect(timeUs: number): void {
    const state = this.#effect;
    if (!state) return;
    const samples = sampleLightEffect(state.active, timeUs, this.#policy);
    const overrides: Partial<Record<LightSlot, LightEmitter>> = {};
    for (const sample of samples) {
      createLightInput(validationFrame, this.#policy, { [sample.slot]: sample.emitter });
      overrides[sample.slot] = sample.emitter;
      if (sample.slot === this.#source.sourceSlot && this.#userVisibility === undefined) {
        this.#source = { ...this.#source, showLightSource: sample.showLightSourceDefault };
      }
    }
    this.#overrides = overrides;
    state.sampledUs = timeUs;
  }

  #invalidate(schedule = true): void {
    for (const entry of this.#surface.values()) {
      writeSurfaceFrame(entry.input, entry.frame, this.#policy);
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i]!;
        const mounted = this.#effect?.active.snapshot.surfaceId ?? this.#effect?.active.event.subject;
        let emitter = (mounted === entry.frame.id ? this.#overrides[slot] : undefined) ?? this.#base[slot];
        if (this.#pinned()) {
          if (slot === "star") emitter = undefined;
          if (slot === "pointer" && emitter) emitter = pinnedKey;
          if (slot === "zenith" && !emitter && !this.#base.pointer) emitter = pinnedKey;
        }
        writeEmitter(entry.input, i, emitter);
      }
      entry.dirty = !entry.painted || !same(entry.input, entry.before);
    }
    this.#renderGlyph();
    if (schedule) {
      if (this.dirty || this.#animating()) this.#schedule();
      else if (!this.#flushing) this.#retire();
    }
  }

  #renderGlyph(): void {
    const slot = this.#source.sourceSlot;
    const emitter = this.#overrides[slot] ?? this.#base[slot];
    const point = this.#pinned() && slot !== "focus" ? this.#policy.staticKey : emitter;
    paintLightSource(this.#source.showLightSource, Boolean(emitter) && !this.#hidden && !this.#disposed,
      point?.x ?? 0, point?.y ?? 0, this.#glyphNext);
    if (same(this.#glyph, this.#glyphNext)) return;
    for (let i = 0; i < this.#glyph.length; i++) this.#glyph[i] = this.#glyphNext[i]!;
    this.#glyphWrites++;
    this.#glyphSink(this.#glyph);
  }

  #retire(): void {
    if (this.#handle !== undefined) {
      this.#host.cancelFrame(this.#handle);
      this.#handle = undefined;
      this.#generation++;
    }
    if (this.#token !== 0) {
      this.#clock.write(releaseWake(this.#clock.read(), this.#token));
      this.#token = 0;
    }
  }

  #schedule(): void {
    if (this.#handle !== undefined || this.#flushing || this.#hidden || this.#disposed) return;
    if (this.#pinned()) {
      this.flush();
      return;
    }
    if (this.#token === 0) {
      const acquired = acquireWake(this.#clock.read(), "plain");
      if (acquired.token === 0) {
        if (this.#effect) {
          this.#sampleEffect(this.#effect.deadlineUs);
          this.#invalidate(false);
        }
        this.flush();
        return;
      }
      this.#clock.write(acquired.clock);
      this.#token = acquired.token;
    }
    const epoch = this.#clock.read().generation;
    const generation = ++this.#generation;
    this.#frameRequests++;
    this.#handle = this.#host.requestFrame((timeMs) => {
      this.#frameEntries++;
      if (generation !== this.#generation || this.#disposed || this.#hidden) return;
      this.#handle = undefined;
      if (!this.#clock.read().registry.slots.some(({ token }) => token === this.#token)
        || this.#clock.read().generation !== epoch) {
        this.#retire();
        if (this.dirty || this.#animating()) this.#schedule();
        return;
      }
      const timeUs = Math.round(timeMs * 1000);
      const minInterval = this.#policy.thermal === "serious" ? 33333 : this.#policy.thermal === "fair" ? 16666 : 0;
      if (timeUs - this.#lastFrameUs < minInterval) {
        this.#schedule();
        return;
      }
      const dispatched = dispatchClock(this.#clock.read(), epoch);
      this.#clock.write(dispatched.clock);
      if (!dispatched.accepted) {
        this.#retire();
        return;
      }
      this.#lastFrameUs = timeUs;
      this.#acceptedTicks++;
      if (this.#animating()) {
        const state = this.#effect!;
        this.#sampleEffect(Math.max(state.sampledUs, timeUs));
        this.#invalidate(false);
      }
      if (this.dirty) this.flush();
      else if (this.#animating()) this.#schedule();
      else this.#retire();
    });
  }
}
