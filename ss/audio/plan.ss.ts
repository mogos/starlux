// Starlux Composable Effects Algebra (LuxEvent -> Motion + Light + Audio + Haptics),
// Admission Gates (Mute, Trusted Gesture, Cooldown, Duplicate Suppression, Reduced Motion, Thermal),
// and WakeToken Audio Lease built directly on ss/lux/wake.ss.ts.

import type { LuxEvent } from "../lux/events.ss.ts";
import {
  type LuxClock,
  acquireWake,
  createLuxClock,
  heldWakeTokens,
  releaseWake,
} from "../lux/wake.ss.ts";
import { clamp, clamp01, exp64 } from "../physics/math.ss.ts";
import {
  type AudioCommand,
  audioLingerUs,
  clampInt,
  clampRate100,
  classCooldownMs,
  opPlay,
  roundHalfToEven,
  usToFrames,
} from "./format.ss.ts";
import { cueIdBySlug, getAudioCue } from "./catalog.ss.ts";
import { scaleOffsetByRate } from "./tables.ss.ts";

// Channel bitmasks
export function channelMotion(): number { return 1; }
export function channelLight(): number { return 2; }
export function channelAudio(): number { return 4; }
export function channelTouch(): number { return 8; }
export function channelAll(): number { return 15; }

// Plan bounds
export function maxPlanNodes(): number { return 64; }
export function maxPlanDepth(): number { return 12; }
export function maxPlanLeaves(): number { return 32; }

// Plan node kinds
const NODE_EMPTY = 0;
const NODE_MOTION = 1;
const NODE_LIGHT = 2;
const NODE_AUDIO = 3;
const NODE_HAPTIC = 4;
const NODE_LAYER = 5;
const NODE_SEQUENCE = 6;
const NODE_STAGGER = 7;
const NODE_ENVELOPE = 8;
const NODE_PITCH_VEL = 9;
const NODE_PAN_RECT = 10;
const NODE_MATERIAL = 11;
const NODE_RATE = 12;
const NODE_THERMAL = 13;
const NODE_COOLDOWN = 14;
const NODE_REDUCED = 15;

export type PlanRect = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
};

export type EffectContext = {
  readonly event: LuxEvent;
  readonly transition: string;
  readonly serial: number;
  readonly epoch: number;
  readonly rect: PlanRect;
  readonly viewport: PlanRect;
  readonly vxPxS: number;
  readonly vyPxS: number;
  readonly material: number;        // 0..5
  readonly rate100: number;         // 10..400
  readonly thermalTier: number;     // 0 nominal, 1 fair, 2 serious, 3 critical
  readonly motionPolicy: number;    // 0 full, 1 reduce, 2 off
  readonly audioOptIn: boolean;
  readonly sessionActivated: boolean;
  readonly muted: boolean;
  readonly hapticOptIn: boolean;
  readonly hapticAvailable: boolean;
  readonly functionalAudio: boolean;
  readonly originFrame: number;
  readonly seed: number;
};

export type PlanNode = {
  readonly kind: number;
  readonly childA: number;
  readonly childB: number;
  readonly children: readonly number[];
  readonly extentUs: number;
  readonly channelMask: number;
  readonly p0: number;
  readonly p1: number;
  readonly p2: number;
  readonly p3: number;
  readonly label: string;
};

export type PlanArena = {
  readonly nodes: readonly PlanNode[];
  readonly valid: boolean;
  readonly error: string;
};

export type PlanHandle = {
  readonly arena: PlanArena;
  readonly fx: number;
};

export type MotionLeaf = {
  readonly startUs: number;
  readonly durationUs: number;
  readonly property: string;
  readonly target: number;
  readonly responseMs: number;
  readonly damping: number;
  readonly scaleAmplitude: number;
};

export type LightLeaf = {
  readonly startUs: number;
  readonly durationUs: number;
  readonly relief: number;          // 0=recess, 1=raised
  readonly gain: number;
  readonly material: number;
  readonly fresnelR0: number;
  readonly attenuation: number;
};

export type HapticLeaf = {
  readonly startUs: number;
  readonly durationUs: number;
  readonly intensity: number;
  readonly sharpness: number;
};

export type AdmissionEntry = {
  readonly keyA: number;            // subject
  readonly keyB: number;            // cueId
  readonly lastUs: number;
  readonly serial: number;
  readonly epoch: number;
};

export type AdmissionState = {
  readonly muted: boolean;
  readonly armed: boolean;          // true only after trusted user gesture
  readonly tokens: number;          // 0..12 token bucket
  readonly lastRefillUs: number;
  readonly lastCueId: number;
  readonly repeatCount: number;
  readonly classLastUs: readonly number[]; // length 5 (classes 0..4)
  readonly subjectCueHistory: readonly AdmissionEntry[];
  readonly hapticHistoryStartUs: readonly number[];
  readonly hapticHistoryDurUs: readonly number[];
  readonly refusedCount: number;
};

export type PlanEvalResult = {
  readonly accepted: boolean;
  readonly reason: string;
  readonly motion: readonly MotionLeaf[];
  readonly light: readonly LightLeaf[];
  readonly audio: readonly AudioCommand[];
  readonly haptics: readonly HapticLeaf[];
  readonly admission: AdmissionState;
};

export type AudioLease = {
  readonly clock: LuxClock;
  readonly token: number;
  readonly generation: number;
  readonly lingerUntilUs: number;
  readonly suspended: boolean;
};

export function createAudioLease(): AudioLease {
  return {
    clock: createLuxClock(),
    token: 0,
    generation: 0,
    lingerUntilUs: 0,
    suspended: true,
  };
}

export function leaseOnAdmit(lease: AudioLease): AudioLease {
  if (lease.token > 0) {
    return {
      clock: lease.clock,
      token: lease.token,
      generation: lease.generation,
      lingerUntilUs: 0,
      suspended: false,
    };
  }
  const acq = acquireWake(lease.clock, "plain");
  if (acq.token === 0) return lease;
  return {
    clock: acq.clock,
    token: acq.token,
    generation: lease.generation + 1,
    lingerUntilUs: 0,
    suspended: false,
  };
}

export function leaseOnDrained(lease: AudioLease, nowUs: number, lingerUs: number): AudioLease {
  if (lease.token === 0) return lease;
  const released = releaseWake(lease.clock, lease.token);
  const safeLinger = lingerUs > 0 ? lingerUs : audioLingerUs();
  return {
    clock: released,
    token: 0,
    generation: lease.generation,
    lingerUntilUs: nowUs + safeLinger,
    suspended: false,
  };
}

export function leaseMaySuspend(lease: AudioLease, nowUs: number): boolean {
  return !lease.suspended && heldWakeTokens(lease.clock) === 0 && lease.token === 0 && nowUs >= lease.lingerUntilUs;
}

export function leaseSuspend(lease: AudioLease, generation: number): AudioLease {
  // Generation guard: stale suspend callback cannot suspend a newer active generation (Floor A18)
  if (generation !== lease.generation || heldWakeTokens(lease.clock) > 0 || lease.token > 0) {
    return lease;
  }
  return {
    clock: lease.clock,
    token: 0,
    generation: lease.generation,
    lingerUntilUs: 0,
    suspended: true,
  };
}

export function leaseForceSuspend(lease: AudioLease): AudioLease {
  if (lease.token > 0) {
    return {
      clock: releaseWake(lease.clock, lease.token),
      token: 0,
      generation: lease.generation + 1,
      lingerUntilUs: 0,
      suspended: true,
    };
  }
  return {
    clock: lease.clock,
    token: 0,
    generation: lease.generation + 1,
    lingerUntilUs: 0,
    suspended: true,
  };
}

export function createAdmissionState(): AdmissionState {
  return {
    muted: true,                    // Muted by default until trusted gesture opt-in!
    armed: false,
    tokens: 12,
    lastRefillUs: 0,
    lastCueId: 0,
    repeatCount: 0,
    classLastUs: [-100000000, -100000000, -100000000, -100000000, -100000000],
    subjectCueHistory: [],
    hapticHistoryStartUs: [],
    hapticHistoryDurUs: [],
    refusedCount: 0,
  };
}

export function armAdmissionFromGesture(state: AdmissionState, trustedGesture: boolean, optIn: boolean): AdmissionState {
  if (!trustedGesture) return state;
  return {
    muted: !optIn,
    armed: true,
    tokens: state.tokens,
    lastRefillUs: state.lastRefillUs,
    lastCueId: state.lastCueId,
    repeatCount: state.repeatCount,
    classLastUs: state.classLastUs,
    subjectCueHistory: state.subjectCueHistory,
    hapticHistoryStartUs: state.hapticHistoryStartUs,
    hapticHistoryDurUs: state.hapticHistoryDurUs,
    refusedCount: state.refusedCount,
  };
}

export function setAdmissionMuted(state: AdmissionState, muted: boolean): AdmissionState {
  return {
    muted,
    armed: state.armed,
    tokens: state.tokens,
    lastRefillUs: state.lastRefillUs,
    lastCueId: state.lastCueId,
    repeatCount: state.repeatCount,
    classLastUs: state.classLastUs,
    subjectCueHistory: state.subjectCueHistory,
    hapticHistoryStartUs: state.hapticHistoryStartUs,
    hapticHistoryDurUs: state.hapticHistoryDurUs,
    refusedCount: state.refusedCount,
  };
}

// Fresnel M3 Glass Lighting calculation (lampH = 180 px, F0 = 0.04, range = 430 px)
export type FresnelLight = {
  readonly fresnelR: number;
  readonly attenuation: number;
  readonly transmitted: number;
};

export function computeFresnelLamp(horizontalDistancePx: number): FresnelLight {
  const d = Math.abs(horizontalDistancePx);
  const cosI = 180 / Math.sqrt(180 * 180 + d * d);
  const oneMinus = 1 - cosI;
  const pow5 = oneMinus * oneMinus * oneMinus * oneMinus * oneMinus;
  const fresnelR = 0.04 + 0.96 * pow5;
  const ratio = d / 430;
  const attenuation = 1 / (1 + ratio * ratio);
  return {
    fresnelR,
    attenuation,
    transmitted: (1 - fresnelR) * attenuation,
  };
}

// Compute equal-power pan from element rect within viewport (-32767..32767, scaled by 0.6 width)
export function computePanFromRect(rect: PlanRect, viewport: PlanRect): number {
  if (viewport.w <= 0) return 0;
  const cx = rect.x + rect.w * 0.5;
  const norm = clamp((2 * (cx - viewport.x)) / viewport.w - 1, -1, 1);
  return clampInt(roundHalfToEven(norm * 32767), -32767, 32767);
}

// Plan Arena constructors (immutable, bounded to 64 nodes / depth 12 / 32 leaves)
export function createPlanArena(): PlanArena {
  const rootEmpty: PlanNode = {
    kind: NODE_EMPTY,
    childA: 0,
    childB: 0,
    children: [],
    extentUs: 0,
    channelMask: 0,
    p0: 0,
    p1: 0,
    p2: 0,
    p3: 0,
    label: "",
  };
  return { nodes: [rootEmpty], valid: true, error: "" };
}

function pushNode(arena: PlanArena, node: PlanNode): PlanHandle {
  if (!arena.valid) return { arena, fx: 0 };
  if (arena.nodes.length >= maxPlanNodes()) {
    return { arena: { nodes: arena.nodes, valid: false, error: "PLAN_NODE_OVERFLOW" }, fx: 0 };
  }
  const next: PlanNode[] = [];
  for (let i = 0; i < 64; i++) {
    if (i >= arena.nodes.length) break;
    const item = arena.nodes[i];
    if (item !== undefined) next.push(item);
  }
  const idx = next.length;
  next.push(node);
  return { arena: { nodes: next, valid: true, error: "" }, fx: idx };
}

function emptyPlanNode(): PlanNode {
  const emptyKids: readonly number[] = [];
  return {
    kind: NODE_EMPTY,
    childA: 0,
    childB: 0,
    children: emptyKids,
    extentUs: 0,
    channelMask: 0,
    p0: 0,
    p1: 0,
    p2: 0,
    p3: 0,
    label: "",
  };
}

function getNode(arena: PlanArena, fx: number): PlanNode {
  const node = arena.nodes[fx];
  if (node !== undefined) {
    return {
      kind: node.kind,
      childA: node.childA,
      childB: node.childB,
      children: node.children,
      extentUs: node.extentUs,
      channelMask: node.channelMask,
      p0: node.p0,
      p1: node.p1,
      p2: node.p2,
      p3: node.p3,
      label: node.label,
    };
  }
  return emptyPlanNode();
}

export function emptyFx(): number { return 0; }

export function motionFx(
  arena: PlanArena,
  property: string,
  target: number,
  responseMs: number,
  damping: number,
): PlanHandle {
  if (responseMs < 0) {
    return { arena: { nodes: arena.nodes, valid: false, error: "NEGATIVE_INTERVAL" }, fx: 0 };
  }
  return pushNode(arena, {
    kind: NODE_MOTION,
    childA: 0,
    childB: 0,
    children: [],
    extentUs: Math.floor(responseMs * 1000),
    channelMask: channelMotion(),
    p0: target,
    p1: responseMs,
    p2: damping,
    p3: 0,
    label: property,
  });
}

export function lightFx(arena: PlanArena, relief: number, gain: number, durationMs: number): PlanHandle {
  if (durationMs < 0) {
    return { arena: { nodes: arena.nodes, valid: false, error: "NEGATIVE_INTERVAL" }, fx: 0 };
  }
  return pushNode(arena, {
    kind: NODE_LIGHT,
    childA: 0,
    childB: 0,
    children: [],
    extentUs: Math.floor(durationMs * 1000),
    channelMask: channelLight(),
    p0: relief,
    p1: gain,
    p2: durationMs,
    p3: 0,
    label: "",
  });
}

export function audioFx(arena: PlanArena, cueId: number): PlanHandle {
  if (cueId < 1 || cueId > 250) {
    return { arena: { nodes: arena.nodes, valid: false, error: "INVALID_CUE_ID" }, fx: 0 };
  }
  const cue = getAudioCue(cueId);
  return pushNode(arena, {
    kind: NODE_AUDIO,
    childA: 0,
    childB: 0,
    children: [],
    extentUs: cue.durationMs * 1000,
    channelMask: channelAudio(),
    p0: cueId,
    p1: 0,
    p2: 0,
    p3: 0,
    label: cue.slug,
  });
}

export function audioSlugFx(arena: PlanArena, slug: string): PlanHandle {
  return audioFx(arena, cueIdBySlug(slug));
}

export function hapticFx(arena: PlanArena, intensity: number, sharpness: number, durationMs: number): PlanHandle {
  if (durationMs < 0) {
    return { arena: { nodes: arena.nodes, valid: false, error: "NEGATIVE_INTERVAL" }, fx: 0 };
  }
  const clampedMs = durationMs > 35 ? 35 : durationMs;
  return pushNode(arena, {
    kind: NODE_HAPTIC,
    childA: 0,
    childB: 0,
    children: [],
    extentUs: Math.floor(clampedMs * 1000),
    channelMask: channelTouch(),
    p0: clamp01(intensity),
    p1: clamp01(sharpness),
    p2: clampedMs,
    p3: 0,
    label: "",
  });
}

export function layer(arena: PlanArena, a: number, b: number): PlanHandle {
  if (a === 0) return { arena, fx: b };
  if (b === 0) return { arena, fx: a };
  const na = getNode(arena, a);
  const nb = getNode(arena, b);
  const extent = na.extentUs > nb.extentUs ? na.extentUs : nb.extentUs;
  return pushNode(arena, {
    kind: NODE_LAYER,
    childA: a,
    childB: b,
    children: [],
    extentUs: extent,
    channelMask: na.channelMask | nb.channelMask,
    p0: 0,
    p1: 0,
    p2: 0,
    p3: 0,
    label: "",
  });
}

export function sequence(arena: PlanArena, a: number, b: number): PlanHandle {
  if (a === 0) return { arena, fx: b };
  if (b === 0) return { arena, fx: a };
  const na = getNode(arena, a);
  const nb = getNode(arena, b);
  return pushNode(arena, {
    kind: NODE_SEQUENCE,
    childA: a,
    childB: b,
    children: [],
    extentUs: na.extentUs + nb.extentUs,
    channelMask: na.channelMask | nb.channelMask,
    p0: 0,
    p1: 0,
    p2: 0,
    p3: 0,
    label: "",
  });
}

export function stagger(arena: PlanArena, children: readonly number[], stepUs: number): PlanHandle {
  if (stepUs < 0) {
    return { arena: { nodes: arena.nodes, valid: false, error: "NEGATIVE_INTERVAL" }, fx: 0 };
  }
  if (children.length === 0) return { arena, fx: 0 };
  if (children.length > 16) {
    return { arena: { nodes: arena.nodes, valid: false, error: "STAGGER_OVERFLOW" }, fx: 0 };
  }
  let maxEnd = 0;
  let mask = 0;
  const copy: number[] = [];
  for (let i = 0; i < 16; i++) {
    if (i >= children.length) break;
    const ch = children[i] ?? 0;
    copy.push(ch);
    const node = getNode(arena, ch);
    const end = i * stepUs + node.extentUs;
    if (end > maxEnd) maxEnd = end;
    mask = mask | node.channelMask;
  }
  return pushNode(arena, {
    kind: NODE_STAGGER,
    childA: 0,
    childB: 0,
    children: copy,
    extentUs: maxEnd,
    channelMask: mask,
    p0: stepUs,
    p1: 0,
    p2: 0,
    p3: 0,
    label: "",
  });
}

export function envelopeFx(
  arena: PlanArena,
  fx: number,
  channels: number,
  attackUs: number,
  holdUs: number,
  releaseUs: number,
): PlanHandle {
  if (attackUs < 0 || holdUs < 0 || releaseUs < 0) {
    return { arena: { nodes: arena.nodes, valid: false, error: "NEGATIVE_INTERVAL" }, fx: 0 };
  }
  const child = getNode(arena, fx);
  const envEnd = attackUs + holdUs + releaseUs;
  const ext = envEnd < child.extentUs ? envEnd : child.extentUs;
  return pushNode(arena, {
    kind: NODE_ENVELOPE,
    childA: fx,
    childB: 0,
    children: [],
    extentUs: ext > 0 ? ext : envEnd,
    channelMask: child.channelMask,
    p0: channels,
    p1: attackUs,
    p2: holdUs,
    p3: releaseUs,
    label: "",
  });
}

export function pitchByVelocity(arena: PlanArena, fx: number, maxPxS: number, maxCents: number): PlanHandle {
  if (maxPxS <= 0) {
    return { arena: { nodes: arena.nodes, valid: false, error: "INVALID_VELOCITY_SCALE" }, fx: 0 };
  }
  const child = getNode(arena, fx);
  return pushNode(arena, {
    kind: NODE_PITCH_VEL,
    childA: fx,
    childB: 0,
    children: [],
    extentUs: child.extentUs,
    channelMask: child.channelMask,
    p0: maxPxS,
    p1: clampInt(maxCents, -1200, 1200),
    p2: 0,
    p3: 0,
    label: "",
  });
}

export function panFromRect(arena: PlanArena, fx: number): PlanHandle {
  const child = getNode(arena, fx);
  return pushNode(arena, {
    kind: NODE_PAN_RECT,
    childA: fx,
    childB: 0,
    children: [],
    extentUs: child.extentUs,
    channelMask: child.channelMask,
    p0: 0,
    p1: 0,
    p2: 0,
    p3: 0,
    label: "",
  });
}

export function materialResonance(arena: PlanArena, fx: number, material: number): PlanHandle {
  if (material < 0 || material > 5) {
    return { arena: { nodes: arena.nodes, valid: false, error: "INVALID_MATERIAL" }, fx: 0 };
  }
  const child = getNode(arena, fx);
  return pushNode(arena, {
    kind: NODE_MATERIAL,
    childA: fx,
    childB: 0,
    children: [],
    extentUs: child.extentUs,
    channelMask: child.channelMask,
    p0: material,
    p1: 0,
    p2: 0,
    p3: 0,
    label: "",
  });
}

export function rateCouple(arena: PlanArena, fx: number): PlanHandle {
  const child = getNode(arena, fx);
  return pushNode(arena, {
    kind: NODE_RATE,
    childA: fx,
    childB: 0,
    children: [],
    extentUs: child.extentUs,
    channelMask: child.channelMask,
    p0: 1,
    p1: 0,
    p2: 0,
    p3: 0,
    label: "",
  });
}

export function thermalGate(
  arena: PlanArena,
  fx: number,
  nominalMask: number,
  fairMask: number,
  seriousMask: number,
  criticalMask: number,
): PlanHandle {
  const child = getNode(arena, fx);
  return pushNode(arena, {
    kind: NODE_THERMAL,
    childA: fx,
    childB: 0,
    children: [],
    extentUs: child.extentUs,
    channelMask: child.channelMask,
    p0: nominalMask,
    p1: fairMask,
    p2: seriousMask,
    p3: criticalMask,
    label: "",
  });
}

export function cooldownFx(arena: PlanArena, fx: number, classId: number, minUs: number): PlanHandle {
  if (minUs < 0) {
    return { arena: { nodes: arena.nodes, valid: false, error: "NEGATIVE_INTERVAL" }, fx: 0 };
  }
  const child = getNode(arena, fx);
  return pushNode(arena, {
    kind: NODE_COOLDOWN,
    childA: fx,
    childB: 0,
    children: [],
    extentUs: child.extentUs,
    channelMask: child.channelMask,
    p0: classId,
    p1: minUs,
    p2: 0,
    p3: 0,
    label: "",
  });
}

export function reducedMotionPolicy(
  arena: PlanArena,
  fx: number,
  reduceMask: number,
  offMask: number,
  functionalGainQ15: number,
): PlanHandle {
  const child = getNode(arena, fx);
  return pushNode(arena, {
    kind: NODE_REDUCED,
    childA: fx,
    childB: 0,
    children: [],
    extentUs: child.extentUs,
    channelMask: child.channelMask,
    p0: reduceMask,
    p1: offMask,
    p2: clampInt(functionalGainQ15, 0, 16384), // capped <= 0.5 gain under reduced motion
    p3: 0,
    label: "",
  });
}

// Compute rolling 1s energized haptic budget (<= 100 ms per rolling second, Floor A15)
function rollingHapticBudgetUs(admission: AdmissionState, nowUs: number): number {
  let total = 0;
  const windowStart = nowUs - 1000000;
  for (let i = 0; i < 32; i++) {
    if (i >= admission.hapticHistoryStartUs.length) break;
    const s = admission.hapticHistoryStartUs[i] ?? 0;
    const d = admission.hapticHistoryDurUs[i] ?? 0;
    const end = s + d;
    if (end > windowStart) {
      const clampedStart = s < windowStart ? windowStart : s;
      const overlap = end - clampedStart;
      if (overlap > 0) total += overlap;
    }
  }
  return total;
}

function makeAdmission(
  muted: boolean,
  armed: boolean,
  tokens: number,
  lastRefillUs: number,
  lastCueId: number,
  repeatCount: number,
  classLastUs: readonly number[],
  subjectCueHistory: readonly AdmissionEntry[],
  hapticHistoryStartUs: readonly number[],
  hapticHistoryDurUs: readonly number[],
  refusedCount: number,
): AdmissionState {
  return {
    muted,
    armed,
    tokens,
    lastRefillUs,
    lastCueId,
    repeatCount,
    classLastUs,
    subjectCueHistory,
    hapticHistoryStartUs,
    hapticHistoryDurUs,
    refusedCount,
  };
}

function refuseAdm(a: AdmissionState): AdmissionState {
  return makeAdmission(
    a.muted, a.armed, a.tokens, a.lastRefillUs, a.lastCueId, a.repeatCount,
    a.classLastUs, a.subjectCueHistory, a.hapticHistoryStartUs, a.hapticHistoryDurUs,
    a.refusedCount + 1,
  );
}

function recordHapticPulse(admission: AdmissionState, startUs: number, durUs: number): AdmissionState {
  const nextStarts: number[] = [];
  const nextDurs: number[] = [];
  const cutoff = startUs - 1000000;
  for (let i = 0; i < 32; i++) {
    if (i >= admission.hapticHistoryStartUs.length) break;
    const s = admission.hapticHistoryStartUs[i] ?? 0;
    const d = admission.hapticHistoryDurUs[i] ?? 0;
    if (s + d > cutoff && nextStarts.length < 31) {
      nextStarts.push(s);
      nextDurs.push(d);
    }
  }
  nextStarts.push(startUs);
  nextDurs.push(durUs);
  return makeAdmission(
    admission.muted, admission.armed, admission.tokens, admission.lastRefillUs,
    admission.lastCueId, admission.repeatCount, admission.classLastUs,
    admission.subjectCueHistory, nextStarts, nextDurs, admission.refusedCount,
  );
}

type WalkFrame = {
  readonly fx: number;
  readonly offsetUs: number;
  readonly allowedMask: number;
  readonly materialOverride: number;
  readonly panOverride: number;
  readonly useRectPan: boolean;
  readonly pitchCents: number;
  readonly rateCoupled: boolean;
  readonly cooldownClassOverride: number;
  readonly cooldownMinUsOverride: number;
  readonly reducedGainQ15: number;
  readonly depth: number;
};

function makeWalkFrame(
  fx: number,
  offsetUs: number,
  allowedMask: number,
  materialOverride: number,
  panOverride: number,
  useRectPan: boolean,
  pitchCents: number,
  rateCoupled: boolean,
  cooldownClassOverride: number,
  cooldownMinUsOverride: number,
  reducedGainQ15: number,
  depth: number,
): WalkFrame {
  return {
    fx,
    offsetUs,
    allowedMask,
    materialOverride,
    panOverride,
    useRectPan,
    pitchCents,
    rateCoupled,
    cooldownClassOverride,
    cooldownMinUsOverride,
    reducedGainQ15,
    depth,
  };
}

function tryAdmitAudioCue(
  admission: AdmissionState,
  ctx: EffectContext,
  cueId: number,
  offsetUs: number,
  classOverride: number,
  minUsOverride: number,
  reducedGainCapQ15: number,
): { readonly admitted: boolean; readonly gainQ15: number; readonly admission: AdmissionState } {
  if (admission.muted || !admission.armed || ctx.muted || !ctx.audioOptIn || !ctx.sessionActivated) {
    return { admitted: false, gainQ15: 0, admission: refuseAdm(admission) };
  }
  const cue = getAudioCue(cueId);
  const nowUs = ctx.event.timeUs + offsetUs;

  if (ctx.motionPolicy === 2) {
    return { admitted: false, gainQ15: 0, admission: refuseAdm(admission) };
  }
  let policyGainQ15 = 32768;
  if (ctx.motionPolicy === 1) {
    if (cue.isKinetic || !ctx.functionalAudio) {
      return { admitted: false, gainQ15: 0, admission: refuseAdm(admission) };
    }
    policyGainQ15 = reducedGainCapQ15 <= 16384 ? reducedGainCapQ15 : 16384;
  }

  const subj = ctx.event.subject;
  let lastSubjectCueUs = -100000000;
  for (let i = 0; i < 64; i++) {
    if (i >= admission.subjectCueHistory.length) break;
    const e = admission.subjectCueHistory[i];
    if (e === undefined) break;
    if (e.keyA === subj && e.keyB === cueId) {
      if (e.epoch === ctx.epoch && e.serial === ctx.serial) {
        return { admitted: false, gainQ15: 0, admission: refuseAdm(admission) };
      }
      lastSubjectCueUs = e.lastUs;
    }
  }

  const rowCooldownUs = cue.cooldownMs * 1000;
  const effRowCooldownUs = minUsOverride > rowCooldownUs ? minUsOverride : rowCooldownUs;
  if (nowUs - lastSubjectCueUs < effRowCooldownUs) {
    return { admitted: false, gainQ15: 0, admission: refuseAdm(admission) };
  }

  const cls = classOverride > 0 ? classOverride : cue.classId;
  if (cls >= 1 && cls <= 4) {
    const clsMinUs = classCooldownMs(cls) * 1000;
    const clsLast = admission.classLastUs[cls] ?? -100000000;
    if (nowUs - clsLast < clsMinUs) {
      return { admitted: false, gainQ15: 0, admission: refuseAdm(admission) };
    }
  }

  let tokens = admission.tokens + Math.max(0, nowUs - admission.lastRefillUs) * 0.000012;
  if (tokens > 12) tokens = 12;
  if (tokens < 1) {
    return {
      admitted: false,
      gainQ15: 0,
      admission: makeAdmission(
        admission.muted, admission.armed, tokens, nowUs, admission.lastCueId,
        admission.repeatCount, admission.classLastUs, admission.subjectCueHistory,
        admission.hapticHistoryStartUs, admission.hapticHistoryDurUs,
        admission.refusedCount + 1,
      ),
    };
  }
  const nextTokens = tokens - 1;
  let reps = 0;
  if (admission.lastCueId === cueId && nowUs - lastSubjectCueUs < 1000000) {
    reps = admission.repeatCount + 1;
    if (reps > 6) reps = 6;
  }
  const habFactor = exp64(-0.17269388197455343 * reps);
  const finalGainQ15 = clampInt(roundHalfToEven(policyGainQ15 * habFactor), 1, 32768);

  const nextClassLast: number[] = [];
  for (let i = 0; i < 5; i++) {
    const prev = admission.classLastUs[i] ?? -100000000;
    nextClassLast.push(i === cls && cls >= 1 && cls <= 4 ? nowUs : prev);
  }

  const nextHist: AdmissionEntry[] = [];
  let updated = false;
  for (let i = 0; i < 64; i++) {
    if (i >= admission.subjectCueHistory.length) break;
    const e = admission.subjectCueHistory[i];
    if (e === undefined) break;
    if (e.keyA === subj && e.keyB === cueId) {
      nextHist.push({ keyA: subj, keyB: cueId, lastUs: nowUs, serial: ctx.serial, epoch: ctx.epoch });
      updated = true;
    } else if (nextHist.length < 63) {
      nextHist.push(e);
    }
  }
  if (!updated) {
    nextHist.push({ keyA: subj, keyB: cueId, lastUs: nowUs, serial: ctx.serial, epoch: ctx.epoch });
  }

  return {
    admitted: true,
    gainQ15: finalGainQ15,
    admission: makeAdmission(
      admission.muted, admission.armed, nextTokens, nowUs, cueId, reps,
      nextClassLast, nextHist, admission.hapticHistoryStartUs,
      admission.hapticHistoryDurUs, admission.refusedCount,
    ),
  };
}

export function evaluatePlan(
  arena: PlanArena,
  rootFx: number,
  ctx: EffectContext,
  admission: AdmissionState,
): PlanEvalResult {
  if (!arena.valid) {
    return {
      accepted: false,
      reason: arena.error,
      motion: [],
      light: [],
      audio: [],
      haptics: [],
      admission,
    };
  }

  const motion: MotionLeaf[] = [];
  const light: LightLeaf[] = [];
  const audio: AudioCommand[] = [];
  const haptics: HapticLeaf[] = [];
  let curAdm = admission;
  let leafCount = 0;
  let overflow = false;

  // Iterative DFS stack (push children in reverse order so left-to-right order is preserved)
  let stack: WalkFrame[] = [
    makeWalkFrame(rootFx, 0, channelAll(), -1, 0, false, 0, false, 0, 0, 16384, 0),
  ];

  for (let iter = 0; iter < 256; iter++) {
    if (stack.length === 0) break;
    const topIdx = stack.length - 1;
    const ws = stack[topIdx];
    const popped: WalkFrame[] = [];
    for (let k = 0; k < 128; k++) {
      if (k >= topIdx) break;
      const it = stack[k];
      if (it !== undefined) popped.push(it);
    }
    stack = popped;
    if (ws === undefined || ws.fx === 0) continue;
    if (ws.depth > maxPlanDepth()) {
      overflow = true;
      break;
    }
    const node = getNode(arena, ws.fx);

    if (node.kind === NODE_EMPTY) continue;

    if (node.kind === NODE_LAYER) {
      if (stack.length + 2 > 128) { overflow = true; break; }
      stack.push(makeWalkFrame(
        node.childB, ws.offsetUs, ws.allowedMask, ws.materialOverride, ws.panOverride,
        ws.useRectPan, ws.pitchCents, ws.rateCoupled, ws.cooldownClassOverride,
        ws.cooldownMinUsOverride, ws.reducedGainQ15, ws.depth + 1,
      ));
      stack.push(makeWalkFrame(
        node.childA, ws.offsetUs, ws.allowedMask, ws.materialOverride, ws.panOverride,
        ws.useRectPan, ws.pitchCents, ws.rateCoupled, ws.cooldownClassOverride,
        ws.cooldownMinUsOverride, ws.reducedGainQ15, ws.depth + 1,
      ));
      continue;
    }

    if (node.kind === NODE_SEQUENCE) {
      if (stack.length + 2 > 128) { overflow = true; break; }
      const na = getNode(arena, node.childA);
      const shiftUs = ws.rateCoupled
        ? roundHalfToEven((na.extentUs * 100) / clampRate100(ctx.rate100))
        : na.extentUs;
      stack.push(makeWalkFrame(
        node.childB, ws.offsetUs + shiftUs, ws.allowedMask, ws.materialOverride, ws.panOverride,
        ws.useRectPan, ws.pitchCents, ws.rateCoupled, ws.cooldownClassOverride,
        ws.cooldownMinUsOverride, ws.reducedGainQ15, ws.depth + 1,
      ));
      stack.push(makeWalkFrame(
        node.childA, ws.offsetUs, ws.allowedMask, ws.materialOverride, ws.panOverride,
        ws.useRectPan, ws.pitchCents, ws.rateCoupled, ws.cooldownClassOverride,
        ws.cooldownMinUsOverride, ws.reducedGainQ15, ws.depth + 1,
      ));
      continue;
    }

    if (node.kind === NODE_STAGGER) {
      const cnt = node.children.length;
      if (stack.length + cnt > 128) { overflow = true; break; }
      for (let rev = 0; rev < 16; rev++) {
        if (rev >= cnt) break;
        const idx = cnt - 1 - rev;
        const ch = node.children[idx] ?? 0;
        const rawOff = idx * node.p0;
        const effOff = ws.rateCoupled
          ? roundHalfToEven((rawOff * 100) / clampRate100(ctx.rate100))
          : rawOff;
        stack.push(makeWalkFrame(
          ch, ws.offsetUs + effOff, ws.allowedMask, ws.materialOverride, ws.panOverride,
          ws.useRectPan, ws.pitchCents, ws.rateCoupled, ws.cooldownClassOverride,
          ws.cooldownMinUsOverride, ws.reducedGainQ15, ws.depth + 1,
        ));
      }
      continue;
    }

    if (node.kind === NODE_ENVELOPE) {
      stack.push(makeWalkFrame(
        node.childA, ws.offsetUs, ws.allowedMask, ws.materialOverride, ws.panOverride,
        ws.useRectPan, ws.pitchCents, ws.rateCoupled, ws.cooldownClassOverride,
        ws.cooldownMinUsOverride, ws.reducedGainQ15, ws.depth + 1,
      ));
      continue;
    }

    if (node.kind === NODE_PITCH_VEL) {
      const speed = Math.sqrt(ctx.vxPxS * ctx.vxPxS + ctx.vyPxS * ctx.vyPxS);
      const frac = clamp01(speed / node.p0);
      const cents = roundHalfToEven(node.p1 * frac);
      stack.push(makeWalkFrame(
        node.childA, ws.offsetUs, ws.allowedMask, ws.materialOverride, ws.panOverride,
        ws.useRectPan, ws.pitchCents + cents, ws.rateCoupled, ws.cooldownClassOverride,
        ws.cooldownMinUsOverride, ws.reducedGainQ15, ws.depth + 1,
      ));
      continue;
    }

    if (node.kind === NODE_PAN_RECT) {
      stack.push(makeWalkFrame(
        node.childA, ws.offsetUs, ws.allowedMask, ws.materialOverride, ws.panOverride,
        true, ws.pitchCents, ws.rateCoupled, ws.cooldownClassOverride,
        ws.cooldownMinUsOverride, ws.reducedGainQ15, ws.depth + 1,
      ));
      continue;
    }

    if (node.kind === NODE_MATERIAL) {
      stack.push(makeWalkFrame(
        node.childA, ws.offsetUs, ws.allowedMask, node.p0, ws.panOverride,
        ws.useRectPan, ws.pitchCents, ws.rateCoupled, ws.cooldownClassOverride,
        ws.cooldownMinUsOverride, ws.reducedGainQ15, ws.depth + 1,
      ));
      continue;
    }

    if (node.kind === NODE_RATE) {
      stack.push(makeWalkFrame(
        node.childA, ws.offsetUs, ws.allowedMask, ws.materialOverride, ws.panOverride,
        ws.useRectPan, ws.pitchCents, true, ws.cooldownClassOverride,
        ws.cooldownMinUsOverride, ws.reducedGainQ15, ws.depth + 1,
      ));
      continue;
    }

    if (node.kind === NODE_THERMAL) {
      let tierMask = node.p0;
      if (ctx.thermalTier === 1) tierMask = node.p1;
      else if (ctx.thermalTier === 2) tierMask = node.p2;
      else if (ctx.thermalTier >= 3) tierMask = node.p3;
      stack.push(makeWalkFrame(
        node.childA, ws.offsetUs, ws.allowedMask & tierMask, ws.materialOverride, ws.panOverride,
        ws.useRectPan, ws.pitchCents, ws.rateCoupled, ws.cooldownClassOverride,
        ws.cooldownMinUsOverride, ws.reducedGainQ15, ws.depth + 1,
      ));
      continue;
    }

    if (node.kind === NODE_COOLDOWN) {
      stack.push(makeWalkFrame(
        node.childA, ws.offsetUs, ws.allowedMask, ws.materialOverride, ws.panOverride,
        ws.useRectPan, ws.pitchCents, ws.rateCoupled, node.p0, node.p1,
        ws.reducedGainQ15, ws.depth + 1,
      ));
      continue;
    }

    if (node.kind === NODE_REDUCED) {
      let nextMask = ws.allowedMask;
      if (ctx.motionPolicy === 1) nextMask = nextMask & node.p0;
      else if (ctx.motionPolicy >= 2) nextMask = nextMask & node.p1;
      stack.push(makeWalkFrame(
        node.childA, ws.offsetUs, nextMask, ws.materialOverride, ws.panOverride,
        ws.useRectPan, ws.pitchCents, ws.rateCoupled, ws.cooldownClassOverride,
        ws.cooldownMinUsOverride, node.p2, ws.depth + 1,
      ));
      continue;
    }

    // Leaf nodes
    if (leafCount >= maxPlanLeaves()) {
      overflow = true;
      break;
    }

    if (node.kind === NODE_MOTION) {
      if ((ws.allowedMask & channelMotion()) === 0) continue;
      let dur = Math.floor(node.p1 * 1000);
      let resp = node.p1;
      let amp = 1;
      if (ctx.motionPolicy >= 1) {
        dur = 0;
        resp = 0;
        amp = 0;
      }
      motion.push({
        startUs: ws.offsetUs,
        durationUs: dur,
        property: node.label,
        target: node.p0,
        responseMs: resp,
        damping: node.p2,
        scaleAmplitude: amp,
      });
      leafCount += 1;
      continue;
    }

    if (node.kind === NODE_LIGHT) {
      if ((ws.allowedMask & channelLight()) === 0) continue;
      const dist = Math.abs((ctx.rect.x + ctx.rect.w * 0.5) - (ctx.viewport.x + ctx.viewport.w * 0.5));
      const fl = computeFresnelLamp(dist);
      const mat = ws.materialOverride >= 0 ? ws.materialOverride : ctx.material;
      light.push({
        startUs: ws.offsetUs,
        durationUs: Math.floor(node.p2 * 1000),
        relief: node.p0,
        gain: node.p1,
        material: mat,
        fresnelR0: fl.fresnelR,
        attenuation: fl.attenuation,
      });
      leafCount += 1;
      continue;
    }

    if (node.kind === NODE_HAPTIC) {
      if ((ws.allowedMask & channelTouch()) === 0) continue;
      if (!ctx.hapticOptIn || !ctx.hapticAvailable || ctx.motionPolicy >= 1) continue;
      const durUs = Math.floor(clamp(node.p2, 1, 35) * 1000);
      const nowUs = ctx.event.timeUs + ws.offsetUs;
      const usedUs = rollingHapticBudgetUs(curAdm, nowUs);
      if (usedUs + durUs > 100000) continue;
      haptics.push({
        startUs: ws.offsetUs,
        durationUs: durUs,
        intensity: node.p0,
        sharpness: node.p1,
      });
      curAdm = recordHapticPulse(curAdm, nowUs, durUs);
      leafCount += 1;
      continue;
    }

    if (node.kind === NODE_AUDIO) {
      if ((ws.allowedMask & channelAudio()) === 0) continue;
      const cueId = node.p0;
      const adm = tryAdmitAudioCue(
        curAdm,
        ctx,
        cueId,
        ws.offsetUs,
        ws.cooldownClassOverride,
        ws.cooldownMinUsOverride,
        ws.reducedGainQ15,
      );
      curAdm = adm.admission;
      if (!adm.admitted) continue;
      const cue = getAudioCue(cueId);
      const rawPan = ws.useRectPan ? computePanFromRect(ctx.rect, ctx.viewport) : ws.panOverride;
      const pan = ctx.motionPolicy === 1 ? roundHalfToEven(rawPan * 0.4) : rawPan;
      const rate = ws.rateCoupled ? clampRate100(ctx.rate100) : 100;
      const baseFrame = ctx.originFrame + usToFrames(ws.offsetUs);
      for (let i = 0; i < 4; i++) {
        if (i >= cue.hits.length) break;
        const hit = cue.hits[i];
        if (hit === undefined) break;
        const hitOffset = scaleOffsetByRate(hit.startFrames, rate);
        const matOvr = hit.exactDetune ? -1 : ws.materialOverride;
        audio.push({
          atFrame: baseFrame + hitOffset,
          seq: ctx.serial,
          hitIndex: i,
          subject: ctx.event.subject,
          epoch: ctx.epoch,
          seed: ctx.seed,
          cueId: cue.id,
          gainQ15: adm.gainQ15,
          pan,
          rate100: rate,
          materialOverride: matOvr,
          pitchCents: ws.pitchCents,
          op: opPlay(),
        });
      }
      leafCount += 1;
    }
  }

  if (overflow) {
    return {
      accepted: false,
      reason: "PLAN_LIMIT_EXCEEDED",
      motion: [],
      light: [],
      audio: [],
      haptics: [],
      admission,
    };
  }
  return {
    accepted: true,
    reason: "OK",
    motion,
    light,
    audio,
    haptics,
    admission: curAdm,
  };
}

// Wrap any recipe with standard rateCouple -> thermalGate(15,15,13,0) -> reducedMotionPolicy(7,0,16384)
export function wrapStandardPolicy(arena: PlanArena, innerFx: number): PlanHandle {
  const r1 = rateCouple(arena, innerFx);
  const r2 = thermalGate(r1.arena, r1.fx, 15, 15, 13, 0);
  return reducedMotionPolicy(r2.arena, r2.fx, 7, 0, 16384);
}

// Five Canonical Composed Interaction Recipes (Part 2 of Architecture Spec)

// 1. Button press & release
export function buildButtonPressRecipe(): PlanHandle {
  const a0 = createPlanArena();
  const m = motionFx(a0, "scale", 0.86, 90, 0.95);
  const l = lightFx(m.arena, 0, 0.45, 70);
  const aRaw = audioSlugFx(l.arena, "control.press");
  const aPan = panFromRect(aRaw.arena, aRaw.fx);
  const h = hapticFx(aPan.arena, 0.30, 0.43, 12);
  const l1 = layer(h.arena, m.fx, l.fx);
  const l2 = layer(l1.arena, l1.fx, aPan.fx);
  const l3 = layer(l2.arena, l2.fx, h.fx);
  const cd = cooldownFx(l3.arena, l3.fx, 3, 24000);
  return wrapStandardPolicy(cd.arena, cd.fx);
}

export function buildButtonReleaseRecipe(): PlanHandle {
  const a0 = createPlanArena();
  const m = motionFx(a0, "scale", 1.0, 180, 0.78);
  const l = lightFx(m.arena, 1, 0.60, 100);
  const aRaw = audioSlugFx(l.arena, "control.release");
  const aPan = panFromRect(aRaw.arena, aRaw.fx);
  const h = hapticFx(aPan.arena, 0.21, 0.32, 9);
  const l1 = layer(h.arena, m.fx, l.fx);
  const l2 = layer(l1.arena, l1.fx, aPan.fx);
  const l3 = layer(l2.arena, l2.fx, h.fx);
  return wrapStandardPolicy(l3.arena, l3.fx);
}

// 2. Magnetic snap and neighbor push
export function buildMagneticSnapRecipe(): PlanHandle {
  const a0 = createPlanArena();
  const m1 = motionFx(a0, "tileRect", 1, 460, 1.0);
  const m2 = motionFx(m1.arena, "sharedDivider", 1, 460, 1.0);
  const l = lightFx(m2.arena, 1, 0.55, 100);
  const a00 = audioSlugFx(l.arena, "magnetic.engage");
  const aMat = materialResonance(a00.arena, a00.fx, 2); // Titanium T
  const aPitch = pitchByVelocity(aMat.arena, aMat.fx, 1200, 180);
  const aPan = panFromRect(aPitch.arena, aPitch.fx);
  const h = hapticFx(aPan.arena, 0.52, 0.72, 18);
  const s1 = layer(h.arena, m1.fx, m2.fx);
  const s2 = layer(s1.arena, s1.fx, l.fx);
  const s3 = layer(s2.arena, s2.fx, aPan.fx);
  const s4 = layer(s3.arena, s3.fx, h.fx);
  return wrapStandardPolicy(s4.arena, s4.fx);
}

// 3. Empty-glass minimize and dock absorb
export function buildMinimizeDockRecipe(): PlanHandle {
  const a0 = createPlanArena();
  const m = motionFx(a0, "dockScale", 0.92, 85, 0.85);
  const lRecess = lightFx(m.arena, 0, 0.65, 35);
  const lRaised = lightFx(lRecess.arena, 1, 0.24, 90);
  const lSeq = sequence(lRaised.arena, lRecess.fx, lRaised.fx);
  const aRaw = audioSlugFx(lSeq.arena, "dock.land");
  const aPan = panFromRect(aRaw.arena, aRaw.fx);
  const h = hapticFx(aPan.arena, 0.44, 0.34, 20);
  const c1 = layer(h.arena, m.fx, lSeq.fx);
  const c2 = layer(c1.arena, c1.fx, aPan.fx);
  const c3 = layer(c2.arena, c2.fx, h.fx);
  return wrapStandardPolicy(c3.arena, c3.fx);
}

// 4. Combobox open and select
export function buildComboboxSelectRecipe(): PlanHandle {
  const a0 = createPlanArena();
  const m = motionFx(a0, "popoverScale", 0.98, 90, 1.0);
  const l = lightFx(m.arena, 0, 0.26, 60);
  const aRaw = audioSlugFx(l.arena, "nav.combo-select");
  const aPan = panFromRect(aRaw.arena, aRaw.fx);
  const h = hapticFx(aPan.arena, 0.20, 0.50, 10);
  const c1 = layer(h.arena, m.fx, l.fx);
  const c2 = layer(c1.arena, c1.fx, aPan.fx);
  const c3 = layer(c2.arena, c2.fx, h.fx);
  return wrapStandardPolicy(c3.arena, c3.fx);
}

// 5. Star wake, think and done
export function buildStarDoneRecipe(): PlanHandle {
  const a0 = createPlanArena();
  const m = motionFx(a0, "orbScale", 1.0, 200, 0.90);
  const l1 = lightFx(m.arena, 1, 0.40, 80);
  const l2 = lightFx(l1.arena, 1, 0.18, 90);
  const lStag = stagger(l2.arena, [l1.fx, l2.fx], 45000);
  const aRaw = audioSlugFx(lStag.arena, "star.done");
  const h = hapticFx(aRaw.arena, 0.24, 0.30, 14);
  const c1 = layer(h.arena, m.fx, lStag.fx);
  const c2 = layer(c1.arena, c1.fx, aRaw.fx);
  const c3 = layer(c2.arena, c2.fx, h.fx);
  return wrapStandardPolicy(c3.arena, c3.fx);
}
