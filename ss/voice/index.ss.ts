// Pure 4-target Starscript Voice Animation Backend Entrypoint & C17/WASM-ready ABI.
// Exports createVoiceRuntime, stepVoiceFrame, stepVoiceFrameWithPcm, evalVoiceStyle,
// plus full VoiceStateMachine, VoiceSignalProcessor, and 28-style catalog.

import { clamp } from "../physics/math.ss.ts";
import {
  type VoiceMachineState,
  VOICE_ACT,
  VOICE_CONFIRM,
  VOICE_DONE,
  VOICE_ERROR,
  VOICE_LISTEN,
  VOICE_REST,
  VOICE_SPEAK,
  VOICE_THINK,
  clampVoiceState,
  createVoiceMachine,
  stepVoiceMachine,
  voiceHeldWakeTokens,
  voiceStatePhaseRate,
  voiceStateTargetEnergy,
  voiceTransitionDwellUs,
} from "./state.ss.ts";
import {
  type VoiceSignalState,
  createVoiceSignalState,
  processPcmFrame,
  signalBandAt,
  signalBandTotalEnergy,
  synthesizeSpeechCadence,
} from "./signal.ss.ts";
import {
  type VoicePrimitiveFrame,
  VOICE_PRIM_STRIDE,
  evalVoiceStyle,
} from "./styles.ss.ts";
import {
  type VoiceStyleMeta,
  PRIM_KIND_BAR,
  PRIM_KIND_DOT,
  PRIM_KIND_FIELD,
  PRIM_KIND_RADIAL,
  PRIM_KIND_RIBBON,
  VOICE_STYLE_COUNT,
  findVoiceStyleBySlug,
  getAllVoiceStyles,
  getVoiceStyleMeta,
} from "./catalog.ss.ts";

export type VoiceRuntimeState = {
  readonly styleId: number;
  readonly machine: VoiceMachineState;
  readonly signal: VoiceSignalState;
};

export type VoiceFrameResult = {
  readonly runtime: VoiceRuntimeState;
  readonly frame: VoicePrimitiveFrame;
  readonly heldWakeTokens: number;
  readonly activeTicks: number;
  readonly idleSkippedTicks: number;
};

export function createVoiceRuntime(styleId: number, reducedMotion: boolean): VoiceRuntimeState {
  return {
    styleId: Math.floor(clamp(styleId, 0, 27)),
    machine: createVoiceMachine(reducedMotion),
    signal: createVoiceSignalState(),
  };
}

export function setVoiceRuntimeStyle(runtime: VoiceRuntimeState, styleId: number): VoiceRuntimeState {
  return {
    styleId: Math.floor(clamp(styleId, 0, 27)),
    machine: runtime.machine,
    signal: runtime.signal,
  };
}

export function setVoiceRuntimeReducedMotion(
  runtime: VoiceRuntimeState,
  reducedMotion: boolean,
): VoiceRuntimeState {
  const m = runtime.machine;
  return {
    styleId: runtime.styleId,
    machine: {
      state: m.state,
      targetState: m.targetState,
      pendingState: m.pendingState,
      pendingDwellUs: m.pendingDwellUs,
      energy: m.energy,
      energyVel: m.energyVel,
      presence: m.presence,
      presenceVel: m.presenceVel,
      phase: m.phase,
      stateAgeUs: m.stateAgeUs,
      settleRestFrames: m.settleRestFrames,
      clock: m.clock,
      wakeToken: m.wakeToken,
      activeTicks: m.activeTicks,
      idleSkippedTicks: m.idleSkippedTicks,
      reducedMotion: reducedMotion,
    },
    signal: runtime.signal,
  };
}

export function stepVoiceFrame(
  runtime: VoiceRuntimeState,
  requestedState: number,
  dtUs: number,
  cadenceEnergy: number,
  forceImmediate: boolean,
): VoiceFrameResult {
  const nextState = clampVoiceState(requestedState);
  const sig = synthesizeSpeechCadence(runtime.signal, dtUs, nextState, cadenceEnergy);
  const inputEnergy = nextState === VOICE_REST ? 0 : sig.rms;
  const machine = stepVoiceMachine(runtime.machine, nextState, inputEnergy, dtUs, forceImmediate);
  const frame = evalVoiceStyle(
    runtime.styleId,
    machine.state,
    machine.energy,
    machine.presence,
    machine.phase,
    sig,
    machine.reducedMotion,
  );
  const nextRuntime: VoiceRuntimeState = {
    styleId: runtime.styleId,
    machine: machine,
    signal: sig,
  };
  return {
    runtime: nextRuntime,
    frame: frame,
    heldWakeTokens: voiceHeldWakeTokens(machine),
    activeTicks: machine.activeTicks,
    idleSkippedTicks: machine.idleSkippedTicks,
  };
}

export function stepVoiceFrameWithPcm(
  runtime: VoiceRuntimeState,
  requestedState: number,
  samples: readonly number[],
  sampleRateHz: number,
  dtUs: number,
  forceImmediate: boolean,
): VoiceFrameResult {
  const nextState = clampVoiceState(requestedState);
  const sig = processPcmFrame(runtime.signal, samples, sampleRateHz, dtUs);
  const inputEnergy = nextState === VOICE_REST ? 0 : sig.rms;
  const machine = stepVoiceMachine(runtime.machine, nextState, inputEnergy, dtUs, forceImmediate);
  const frame = evalVoiceStyle(
    runtime.styleId,
    machine.state,
    machine.energy,
    machine.presence,
    machine.phase,
    sig,
    machine.reducedMotion,
  );
  const nextRuntime: VoiceRuntimeState = {
    styleId: runtime.styleId,
    machine: machine,
    signal: sig,
  };
  return {
    runtime: nextRuntime,
    frame: frame,
    heldWakeTokens: voiceHeldWakeTokens(machine),
    activeTicks: machine.activeTicks,
    idleSkippedTicks: machine.idleSkippedTicks,
  };
}
