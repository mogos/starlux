// Starlux 6-Voice Audio Pool, Oldest-Steal Fade, Linked Stereo Dynamics (-18 dBFS 4:1 + -3 dBFS Limiter),
// and Deterministic Chunk-Invariant PCM Renderer (TS == Rust == WASM == C17).
// Zero spread operators, compile-time literal loop bounds, 100% 4-target Starscript admissible.

import {
  type AudioCommand,
  type AudioCue,
  type AudioHit,
  type RenderBlockResult,
  type RenderState,
  type VoiceSlot,
  audioCeilingS16,
  audioMasterTrimQ15,
  audioMaxBlockFrames,
  audioMaxPending,
  clampInt,
  emptyCommand,
  frameDiff,
  opCancel,
  opMute,
  opPlay,
  wrapU32,
} from "./format.ss.ts";
import { resolveCatalogHit } from "./catalog.ss.ts";
import { emptyVoiceSlot, initVoiceFromHit, stepVoiceSample } from "./modal.ss.ts";
import { compAttackCoeffQ15, compReleaseCoeffQ15, compressorTargetGainQ15, scaleOffsetByRate } from "./tables.ss.ts";

function makeRenderState(
  frame: number,
  serial: number,
  cancelGeneration: number,
  muted: boolean,
  compGainQ15: number,
  dcX1L: number,
  dcY1L: number,
  dcX1R: number,
  dcY1R: number,
  peakHoldS16: number,
  droppedCount: number,
  stealCount: number,
  maxSimultaneous: number,
  quantaRendered: number,
  voices: readonly VoiceSlot[],
  pending: readonly AudioCommand[],
): RenderState {
  return {
    frame,
    serial,
    cancelGeneration,
    muted,
    compGainQ15,
    dcX1L,
    dcY1L,
    dcX1R,
    dcY1R,
    peakHoldS16,
    droppedCount,
    stealCount,
    maxSimultaneous,
    quantaRendered,
    voices,
    pending,
  };
}

function makeVoiceSlotWith(
  v: VoiceSlot,
  state: number,
  fadeIndex: number,
  hasReplacement: boolean,
  replacement: AudioCommand,
): VoiceSlot {
  return {
    state,
    admitOrder: v.admitOrder,
    age: v.age,
    totalFrames: v.totalFrames,
    attackFrames: v.attackFrames,
    releaseFrames: v.releaseFrames,
    gainQ15: v.gainQ15,
    panLQ15: v.panLQ15,
    panRQ15: v.panRQ15,
    noiseKind: v.noiseKind,
    noiseSeed: v.noiseSeed,
    noiseEnvQ24: v.noiseEnvQ24,
    noiseMulQ24: v.noiseMulQ24,
    noiseStopFrames: v.noiseStopFrames,
    b0Q29: v.b0Q29,
    a1Q29: v.a1Q29,
    a2Q29: v.a2Q29,
    x1: v.x1,
    x2: v.x2,
    y1: v.y1,
    y2: v.y2,
    fadeIndex,
    subject: v.subject,
    epoch: v.epoch,
    cueId: v.cueId,
    modes: v.modes,
    hasReplacement,
    replacement,
  };
}

export function createRenderState(): RenderState {
  const voices: VoiceSlot[] = [
    emptyVoiceSlot(),
    emptyVoiceSlot(),
    emptyVoiceSlot(),
    emptyVoiceSlot(),
    emptyVoiceSlot(),
    emptyVoiceSlot(),
  ];
  return makeRenderState(0, 0, 0, false, 32768, 0, 0, 0, 0, 0, 0, 0, 0, 0, voices, []);
}

export function countActiveVoices(state: RenderState): number {
  let count = 0;
  for (let i = 0; i < 6; i++) {
    const v = state.voices[i];
    if (v !== undefined && v.state !== 0) count += 1;
  }
  return count;
}

export function isRenderActive(state: RenderState): boolean {
  if (state.pending.length > 0) return true;
  return countActiveVoices(state) > 0;
}

// Submit one flattened hit command into the bounded 64-entry pending queue.
export function submitCommand(state: RenderState, cmd: AudioCommand): RenderState {
  if (cmd.op === opMute()) {
    return muteRenderState(state);
  }
  if (cmd.op === opCancel()) {
    return cancelRenderSubject(state, cmd.subject, cmd.epoch);
  }
  if (state.muted) return state;
  const dist = frameDiff(cmd.atFrame, state.frame);
  if (dist < 0 || dist >= 2147483647 || state.pending.length >= audioMaxPending()) {
    return makeRenderState(
      state.frame, state.serial, state.cancelGeneration, state.muted, state.compGainQ15,
      state.dcX1L, state.dcY1L, state.dcX1R, state.dcY1R, state.peakHoldS16,
      state.droppedCount + 1, state.stealCount, state.maxSimultaneous, state.quantaRendered,
      state.voices, state.pending,
    );
  }
  const nextPending: AudioCommand[] = [];
  for (let i = 0; i < 64; i++) {
    if (i >= state.pending.length) break;
    const item = state.pending[i];
    if (item !== undefined) nextPending.push(item);
  }
  nextPending.push(cmd);
  return makeRenderState(
    state.frame, state.serial, state.cancelGeneration, state.muted, state.compGainQ15,
    state.dcX1L, state.dcY1L, state.dcX1R, state.dcY1R, state.peakHoldS16,
    state.droppedCount, state.stealCount, state.maxSimultaneous, state.quantaRendered,
    state.voices, nextPending,
  );
}

// Atomically enqueue all child hits of a cue; if all hits do not fit, enqueue ZERO (Floor P12).
export function submitCueCommands(
  state: RenderState,
  cue: AudioCue,
  atFrame: number,
  subject: number,
  epoch: number,
  seed: number,
  gainQ15: number,
  pan: number,
  rate100: number,
  materialOverride: number,
  pitchCents: number,
): RenderState {
  if (state.muted) return state;
  const hitCount = cue.hits.length;
  if (hitCount === 0) return state;
  if (state.pending.length + hitCount > audioMaxPending()) {
    return makeRenderState(
      state.frame, state.serial, state.cancelGeneration, state.muted, state.compGainQ15,
      state.dcX1L, state.dcY1L, state.dcX1R, state.dcY1R, state.peakHoldS16,
      state.droppedCount + 1, state.stealCount, state.maxSimultaneous, state.quantaRendered,
      state.voices, state.pending,
    );
  }
  let cur = state;
  const baseSeq = state.serial + 1;
  for (let i = 0; i < 4; i++) {
    if (i >= hitCount) break;
    const h = cue.hits[i];
    if (h === undefined) break;
    const offset = scaleOffsetByRate(h.startFrames, rate100);
    const cmd: AudioCommand = {
      atFrame: wrapU32(atFrame + offset),
      seq: baseSeq,
      hitIndex: i,
      subject,
      epoch,
      seed,
      cueId: cue.id,
      gainQ15,
      pan,
      rate100,
      materialOverride,
      pitchCents,
      op: opPlay(),
    };
    cur = submitCommand(cur, cmd);
  }
  return makeRenderState(
    cur.frame, baseSeq, cur.cancelGeneration, cur.muted, cur.compGainQ15,
    cur.dcX1L, cur.dcY1L, cur.dcX1R, cur.dcY1R, cur.peakHoldS16,
    cur.droppedCount, cur.stealCount, cur.maxSimultaneous, cur.quantaRendered,
    cur.voices, cur.pending,
  );
}

function getVoiceSlot(voices: readonly VoiceSlot[], idx: number): VoiceSlot {
  const v = voices[idx];
  if (v !== undefined) {
    return makeVoiceSlotWith(v, v.state, v.fadeIndex, v.hasReplacement, v.replacement);
  }
  return emptyVoiceSlot();
}

// Independent cancellation latch: works even when pending queue is full (Floor P13).
export function cancelRenderSubject(state: RenderState, subject: number, epoch: number): RenderState {
  const nextPending: AudioCommand[] = [];
  for (let i = 0; i < 64; i++) {
    if (i >= state.pending.length) break;
    const item = state.pending[i];
    if (item === undefined) break;
    const matchSubj = subject === 0 || item.subject === subject;
    const matchEpoch = epoch === 0 || item.epoch === epoch;
    if (!(matchSubj && matchEpoch)) {
      nextPending.push(item);
    }
  }
  const nextVoices: VoiceSlot[] = [];
  for (let i = 0; i < 6; i++) {
    const v = state.voices[i];
    if (v === undefined) {
      nextVoices.push(emptyVoiceSlot());
    } else {
      const matchSubj = subject === 0 || v.subject === subject;
      const matchEpoch = epoch === 0 || v.epoch === epoch;
      const cancelRep = v.hasReplacement &&
        (subject === 0 || v.replacement.subject === subject) &&
        (epoch === 0 || v.replacement.epoch === epoch);
      if (v.state === 1 && matchSubj && matchEpoch) {
        if (cancelRep) {
          nextVoices.push(makeVoiceSlotWith(v, 2, 0, false, emptyCommand()));
        } else {
          nextVoices.push(makeVoiceSlotWith(v, 2, 0, v.hasReplacement, v.replacement));
        }
      } else if (cancelRep) {
        nextVoices.push(makeVoiceSlotWith(v, v.state, v.fadeIndex, false, emptyCommand()));
      } else {
        nextVoices.push(v);
      }
    }
  }
  return makeRenderState(
    state.frame, state.serial, state.cancelGeneration + 1, state.muted, state.compGainQ15,
    state.dcX1L, state.dcY1L, state.dcX1R, state.dcY1R, state.peakHoldS16,
    state.droppedCount, state.stealCount, state.maxSimultaneous, state.quantaRendered,
    nextVoices, nextPending,
  );
}

export function muteRenderState(state: RenderState): RenderState {
  const c = cancelRenderSubject(state, 0, 0);
  return makeRenderState(
    c.frame, c.serial, c.cancelGeneration, true, c.compGainQ15,
    c.dcX1L, c.dcY1L, c.dcX1R, c.dcY1R, c.peakHoldS16,
    c.droppedCount, c.stealCount, c.maxSimultaneous, c.quantaRendered,
    c.voices, c.pending,
  );
}

export function unmuteRenderState(state: RenderState): RenderState {
  return makeRenderState(
    state.frame, state.serial, state.cancelGeneration, false, state.compGainQ15,
    state.dcX1L, state.dcY1L, state.dcX1R, state.dcY1R, state.peakHoldS16,
    state.droppedCount, state.stealCount, state.maxSimultaneous, state.quantaRendered,
    state.voices, state.pending,
  );
}

function commandComesBefore(a: AudioCommand, b: AudioCommand, curFrame: number): boolean {
  const da = frameDiff(a.atFrame, curFrame);
  const db = frameDiff(b.atFrame, curFrame);
  if (da !== db) return da < db;
  if (a.seq !== b.seq) return a.seq < b.seq;
  return a.hitIndex < b.hitIndex;
}

type AllocResult = {
  readonly voices: readonly VoiceSlot[];
  readonly stolen: boolean;
  readonly dropped: boolean;
};

function allocateVoiceForCommand(
  voices: readonly VoiceSlot[],
  cmd: AudioCommand,
  hit: AudioHit,
  admitOrder: number,
): AllocResult {
  // 1. Lowest free slot
  for (let i = 0; i < 6; i++) {
    const v = voices[i];
    if (v !== undefined && v.state === 0) {
      const next: VoiceSlot[] = [];
      for (let j = 0; j < 6; j++) {
        if (j === i) next.push(initVoiceFromHit(hit, cmd, admitOrder, false, emptyCommand()));
        else next.push(getVoiceSlot(voices, j));
      }
      return { voices: next, stolen: false, dropped: false };
    }
  }

  // 2. Oldest sounding slot (state === 1) without reservation, tie-break lowest index
  let victim = -1;
  let oldestOrder = 2147483647;
  for (let i = 0; i < 6; i++) {
    const v = voices[i];
    if (v !== undefined && v.state === 1 && !v.hasReplacement) {
      if (v.admitOrder < oldestOrder) {
        oldestOrder = v.admitOrder;
        victim = i;
      }
    }
  }
  if (victim >= 0) {
    const next: VoiceSlot[] = [];
    for (let j = 0; j < 6; j++) {
      const v = getVoiceSlot(voices, j);
      if (j === victim) next.push(makeVoiceSlotWith(v, 2, 0, true, cmd));
      else next.push(v);
    }
    return { voices: next, stolen: true, dropped: false };
  }

  // 3. Fading slot without reservation
  for (let i = 0; i < 6; i++) {
    const v = voices[i];
    if (v !== undefined && v.state === 2 && !v.hasReplacement) {
      const next: VoiceSlot[] = [];
      for (let j = 0; j < 6; j++) {
        const cur = getVoiceSlot(voices, j);
        if (j === i) next.push(makeVoiceSlotWith(cur, cur.state, cur.fadeIndex, true, cmd));
        else next.push(cur);
      }
      return { voices: next, stolen: false, dropped: false };
    }
  }

  // 4. All 6 slots already have reservations -> drop newest request
  return { voices, stolen: false, dropped: true };
}

// Render `frames` stereo samples (0..256) with strict block-repartition invariance.
export function renderBlock(state: RenderState, frames: number): RenderBlockResult {
  const count = clampInt(frames, 0, audioMaxBlockFrames());
  if (count === 0) {
    return {
      state,
      pcmS16: [],
      renderedFrames: 0,
      activeVoices: countActiveVoices(state),
    };
  }

  let curFrame = state.frame;
  let serial = state.serial;
  let compGainQ15 = state.compGainQ15;
  let dcX1L = state.dcX1L;
  let dcY1L = state.dcY1L;
  let dcX1R = state.dcX1R;
  let dcY1R = state.dcY1R;
  let peakHoldS16 = state.peakHoldS16;
  let droppedCount = state.droppedCount;
  let stealCount = state.stealCount;
  let maxSimultaneous = state.maxSimultaneous;

  let voices: readonly VoiceSlot[] = state.voices;
  let pending: readonly AudioCommand[] = state.pending;
  const pcm: number[] = [];

  for (let f = 0; f < 256; f++) {
    if (f >= count) break;

    // 1. Dispatch all commands due at `curFrame` in publication order, then hitIndex order
    for (let step = 0; step < 64; step++) {
      let bestIdx = -1;
      for (let i = 0; i < 64; i++) {
        if (i >= pending.length) break;
        const cand = pending[i];
        if (cand === undefined) break;
        if (frameDiff(cand.atFrame, curFrame) <= 0) {
          if (bestIdx < 0) {
            bestIdx = i;
          } else {
            const best = pending[bestIdx];
            if (best !== undefined && commandComesBefore(cand, best, curFrame)) {
              bestIdx = i;
            }
          }
        }
      }
      if (bestIdx < 0) break;
      const due = pending[bestIdx];
      const nextPending: AudioCommand[] = [];
      for (let i = 0; i < 64; i++) {
        if (i >= pending.length) break;
        if (i !== bestIdx) {
          const item = pending[i];
          if (item !== undefined) nextPending.push(item);
        }
      }
      pending = nextPending;
      if (due !== undefined && due.op === opPlay()) {
        serial += 1;
        const hit = resolveCatalogHit(due.cueId, due.hitIndex);
        const alloc = allocateVoiceForCommand(voices, due, hit, serial);
        voices = alloc.voices;
        if (alloc.stolen) stealCount += 1;
        if (alloc.dropped) droppedCount += 1;
      }
    }

    // 2. Sum widened L/R in ascending slot order 0..5
    let sumL = 0;
    let sumR = 0;
    let activeNow = 0;
    const nextVoices: VoiceSlot[] = [];

    for (let i = 0; i < 6; i++) {
      const v = getVoiceSlot(voices, i);
      if (v.state !== 0) activeNow += 1;
      const res = stepVoiceSample(v);
      const s = res.sampleQ15;
      sumL += Math.floor((s * v.panLQ15) / 32768);
      sumR += Math.floor((s * v.panRQ15) / 32768);
      if (res.promoteReplacement) {
        serial += 1;
        const rep = v.replacement;
        const repHit = resolveCatalogHit(rep.cueId, rep.hitIndex);
        nextVoices.push(initVoiceFromHit(repHit, rep, serial, false, emptyCommand()));
      } else {
        nextVoices.push(res.slot);
      }
    }
    voices = nextVoices;
    if (activeNow > maxSimultaneous) maxSimultaneous = activeNow;

    // 3. Master trim (0.6)
    const mL = Math.floor((sumL * audioMasterTrimQ15()) / 32768);
    const mR = Math.floor((sumR * audioMasterTrimQ15()) / 32768);

    // 4. First-order DC blocker (pole 0.9995 = 32752/32768) when active
    let dL = 0;
    let dR = 0;
    if (activeNow > 0 || dcY1L !== 0 || dcY1R !== 0 || dcX1L !== 0 || dcX1R !== 0) {
      dL = mL - dcX1L + Math.floor((dcY1L * 32752) / 32768);
      dR = mR - dcX1R + Math.floor((dcY1R * 32752) / 32768);
      dcX1L = mL;
      dcY1L = dL;
      dcX1R = mR;
      dcY1R = dR;
      if (activeNow === 0 && Math.abs(dL) <= 1 && Math.abs(dR) <= 1 && mL === 0 && mR === 0) {
        dL = 0;
        dR = 0;
        dcX1L = 0;
        dcY1L = 0;
        dcX1R = 0;
        dcY1R = 0;
      }
    }

    // 5. Linked stereo -18 dBFS 4:1 compressor
    const absL = Math.abs(dL);
    const absR = Math.abs(dR);
    const det = absL > absR ? absL : absR;
    const targetGain = compressorTargetGainQ15(det);
    const coeff = targetGain < compGainQ15 ? compAttackCoeffQ15() : compReleaseCoeffQ15();
    compGainQ15 = Math.floor((compGainQ15 * coeff + targetGain * (32768 - coeff)) / 32768);

    let outL = Math.floor((dL * compGainQ15) / 32768);
    let outR = Math.floor((dR * compGainQ15) / 32768);

    // 6. Linked stereo hard ceiling limiter (-3 dBFS = 23197, truncating toward zero)
    const absOutL = Math.abs(outL);
    const absOutR = Math.abs(outR);
    const peakPost = absOutL > absOutR ? absOutL : absOutR;
    const ceil = audioCeilingS16();
    if (peakPost > ceil) {
      const limL = Math.floor((absOutL * ceil) / peakPost);
      const limR = Math.floor((absOutR * ceil) / peakPost);
      outL = outL < 0 ? -limL : limL;
      outR = outR < 0 ? -limR : limR;
    }

    const finAbsL = Math.abs(outL);
    const finAbsR = Math.abs(outR);
    const finalPeak = finAbsL > finAbsR ? finAbsL : finAbsR;
    if (finalPeak > peakHoldS16) peakHoldS16 = finalPeak;

    pcm.push(outL);
    pcm.push(outR);
    curFrame = wrapU32(curFrame + 1);
  }

  let activeEnd = 0;
  for (let i = 0; i < 6; i++) {
    const v = voices[i];
    if (v !== undefined && v.state !== 0) activeEnd += 1;
  }

  const nextState = makeRenderState(
    curFrame, serial, state.cancelGeneration, state.muted, compGainQ15,
    dcX1L, dcY1L, dcX1R, dcY1R, peakHoldS16, droppedCount, stealCount,
    maxSimultaneous, state.quantaRendered + 1, voices, pending,
  );

  return {
    state: nextState,
    pcmS16: pcm,
    renderedFrames: count,
    activeVoices: activeEnd,
  };
}

// Deterministic 32-bit digest over interleaved s16 PCM (bounded up to 65536 samples)
export function pcmDigest(pcmS16: readonly number[]): number {
  let h = 2166136261;
  const len = pcmS16.length;
  for (let i = 0; i < 65536; i++) {
    if (i >= len) break;
    const sample = pcmS16[i] ?? 0;
    const u16 = sample < 0 ? sample + 65536 : sample;
    const lo = u16 - Math.floor(u16 / 256) * 256;
    const hi = Math.floor(u16 / 256);
    h = wrapU32((h + lo * 131 + hi * 257) * 65599);
  }
  return h;
}
