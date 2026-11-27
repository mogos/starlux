// Pure 4-target Starscript Voice State Machine (TS, Rust, WASM, C17 byte-identical).
// 8 canonical voice states with hysteresis dwell timers, spring-damped attack/release,
// WakeToken zero-idle thermal invariant at rest, and reduced-motion static floor.

import {
  type LuxClock,
  acquireWake,
  createLuxClock,
  dispatchClock,
  heldWakeTokens,
  releaseWake,
} from "../lux/wake.ss.ts";
import { clamp, clamp01, finiteBound, frameUs } from "../physics/math.ss.ts";
import { springKick } from "../physics/spring.ss.ts";

export const VOICE_REST = 0;
export const VOICE_LISTEN = 1;
export const VOICE_THINK = 2;
export const VOICE_SPEAK = 3;
export const VOICE_ACT = 4;
export const VOICE_CONFIRM = 5;
export const VOICE_ERROR = 6;
export const VOICE_DONE = 7;

export type VoiceMachineState = {
  readonly state: number;
  readonly targetState: number;
  readonly pendingState: number;
  readonly pendingDwellUs: number;
  readonly energy: number;
  readonly energyVel: number;
  readonly presence: number;
  readonly presenceVel: number;
  readonly phase: number;
  readonly stateAgeUs: number;
  readonly settleRestFrames: number;
  readonly clock: LuxClock;
  readonly wakeToken: number;
  readonly activeTicks: number;
  readonly idleSkippedTicks: number;
  readonly reducedMotion: boolean;
};

export function clampVoiceState(stateId: number): number {
  const s = Math.floor(finiteBound(stateId, 16));
  if (s < VOICE_REST) return VOICE_REST;
  if (s > VOICE_DONE) return VOICE_DONE;
  return s;
}

export function voiceStateTargetEnergy(stateId: number, inputEnergy: number): number {
  const e = clamp01(inputEnergy);
  if (stateId === VOICE_REST) return 0;
  if (stateId === VOICE_LISTEN) return clamp01(0.22 + 0.72 * e);
  if (stateId === VOICE_THINK) return clamp01(0.38 + 0.28 * e);
  if (stateId === VOICE_SPEAK) return clamp01(0.28 + 0.72 * e);
  if (stateId === VOICE_ACT) return clamp01(0.54 + 0.42 * e);
  if (stateId === VOICE_CONFIRM) return clamp01(0.68 + 0.25 * e);
  if (stateId === VOICE_ERROR) return clamp01(0.75 + 0.25 * e);
  return clamp01(0.30 + 0.20 * e);
}

export function voiceStatePhaseRate(stateId: number): number {
  if (stateId === VOICE_REST) return 0;
  if (stateId === VOICE_LISTEN) return 2.4;
  if (stateId === VOICE_THINK) return 3.6;
  if (stateId === VOICE_SPEAK) return 5.2;
  if (stateId === VOICE_ACT) return 6.4;
  if (stateId === VOICE_CONFIRM) return 4.0;
  if (stateId === VOICE_ERROR) return 8.2;
  return 1.8;
}

export function voiceTransitionDwellUs(fromState: number, toState: number): number {
  if (fromState === toState) return 0;
  if (toState === VOICE_ERROR || toState === VOICE_CONFIRM || toState === VOICE_REST) {
    return 0;
  }
  if (fromState === VOICE_REST) {
    return 16000;
  }
  return 60000;
}

export function createVoiceMachine(reducedMotion: boolean): VoiceMachineState {
  return {
    state: VOICE_REST,
    targetState: VOICE_REST,
    pendingState: VOICE_REST,
    pendingDwellUs: 0,
    energy: 0,
    energyVel: 0,
    presence: 0,
    presenceVel: 0,
    phase: 0,
    stateAgeUs: 0,
    settleRestFrames: 0,
    clock: createLuxClock(),
    wakeToken: 0,
    activeTicks: 0,
    idleSkippedTicks: 0,
    reducedMotion: reducedMotion,
  };
}

export function voiceHeldWakeTokens(machine: VoiceMachineState): number {
  return heldWakeTokens(machine.clock);
}

export function stepVoiceMachine(
  machine: VoiceMachineState,
  requestedStateRaw: number,
  inputEnergy: number,
  dtUsRaw: number,
  forceImmediate: boolean,
): VoiceMachineState {
  const dtUs = frameUs(dtUsRaw);
  const reqState = clampVoiceState(requestedStateRaw);

  let curState = machine.state;
  let pendingState = machine.pendingState;
  let pendingDwellUs = machine.pendingDwellUs;
  let stateAgeUs = machine.stateAgeUs;

  if (reqState !== curState) {
    const needed = forceImmediate ? 0 : voiceTransitionDwellUs(curState, reqState);
    if (needed === 0) {
      curState = reqState;
      pendingState = reqState;
      pendingDwellUs = 0;
      stateAgeUs = 0;
    } else if (pendingState === reqState) {
      pendingDwellUs = finiteBound(pendingDwellUs + dtUs, 10000000);
      if (pendingDwellUs >= needed) {
        curState = reqState;
        pendingDwellUs = 0;
        stateAgeUs = 0;
      }
    } else {
      pendingState = reqState;
      pendingDwellUs = dtUs;
      if (pendingDwellUs >= needed) {
        curState = reqState;
        pendingDwellUs = 0;
        stateAgeUs = 0;
      }
    }
  } else {
    pendingState = curState;
    pendingDwellUs = 0;
    stateAgeUs = finiteBound(stateAgeUs + dtUs, 1000000000);
  }

  let clock = machine.clock;
  let wakeToken = machine.wakeToken;
  const wantActive = curState !== VOICE_REST || reqState !== VOICE_REST;
  const settledAtRest =
    !wantActive &&
    machine.energy <= 0.002 &&
    machine.presence <= 0.002 &&
    Math.abs(machine.energyVel) <= 0.005 &&
    Math.abs(machine.presenceVel) <= 0.005;

  // PLANT:voice_idle_burn
  if (settledAtRest) {
    if (wakeToken > 0) {
      clock = releaseWake(clock, wakeToken);
      wakeToken = 0;
    }
    return {
      state: VOICE_REST,
      targetState: VOICE_REST,
      pendingState: VOICE_REST,
      pendingDwellUs: 0,
      energy: 0,
      energyVel: 0,
      presence: 0,
      presenceVel: 0,
      phase: machine.phase,
      stateAgeUs: stateAgeUs,
      settleRestFrames: machine.settleRestFrames + 1,
      clock: clock,
      wakeToken: 0,
      activeTicks: machine.activeTicks,
      idleSkippedTicks: machine.idleSkippedTicks + 1,
      reducedMotion: machine.reducedMotion,
    };
  }

  if (wakeToken === 0) {
    const acq = acquireWake(clock, "body");
    clock = acq.clock;
    wakeToken = acq.token;
  }

  const ticked = dispatchClock(clock, clock.generation);
  clock = ticked.clock;
  const nextActiveTicks = machine.activeTicks + (ticked.accepted ? 1 : 0);

  // PLANT:voice_reduced_motion
  if (machine.reducedMotion) {
    const staticPresence = curState === VOICE_REST ? 0 : 1;
    const staticEnergy = curState === VOICE_REST ? 0 : clamp(voiceStateTargetEnergy(curState, inputEnergy) * 0.55, 0.2, 0.55);
    let nextToken = wakeToken;
    let nextClock = clock;
    if (curState === VOICE_REST && reqState === VOICE_REST && nextToken > 0) {
      nextClock = releaseWake(nextClock, nextToken);
      nextToken = 0;
    }
    return {
      state: curState,
      targetState: reqState,
      pendingState: pendingState,
      pendingDwellUs: pendingDwellUs,
      energy: staticEnergy,
      energyVel: 0,
      presence: staticPresence,
      presenceVel: 0,
      phase: machine.phase,
      stateAgeUs: stateAgeUs,
      settleRestFrames: curState === VOICE_REST ? machine.settleRestFrames + 1 : 0,
      clock: nextClock,
      wakeToken: nextToken,
      activeTicks: nextActiveTicks,
      idleSkippedTicks: machine.idleSkippedTicks,
      reducedMotion: true,
    };
  }

  const targetEnergy = voiceStateTargetEnergy(curState, inputEnergy);
  const targetPresence = curState === VOICE_REST ? 0 : 1;
  const energyOmega = targetEnergy >= machine.energy ? 28.0 : 14.0;
  const energyDamp = targetEnergy >= machine.energy ? 0.86 : 1.0;
  const presOmega = targetPresence >= machine.presence ? 24.0 : 12.0;

  const nextE = springKick(machine.energy, machine.energyVel, targetEnergy, dtUs, energyOmega, energyDamp);
  const nextP = springKick(machine.presence, machine.presenceVel, targetPresence, dtUs, presOmega, 1.0);

  let energy = clamp01(nextE.position);
  let energyVel = finiteBound(nextE.velocity, 120);
  let presence = clamp01(nextP.position);
  let presenceVel = finiteBound(nextP.velocity, 120);

  const dtSec = dtUs / 1000000;
  const rate = voiceStatePhaseRate(curState);
  let phase = machine.phase + dtSec * rate * (0.45 + 0.55 * presence);
  if (phase >= 6283.185307179586) {
    phase -= 6283.185307179586;
  }

  let settleRestFrames = 0;
  if (!wantActive && energy <= 0.004 && presence <= 0.004) {
    settleRestFrames = machine.settleRestFrames + 1;
    if (settleRestFrames >= 2) {
      energy = 0;
      energyVel = 0;
      presence = 0;
      presenceVel = 0;
      if (wakeToken > 0) {
        clock = releaseWake(clock, wakeToken);
        wakeToken = 0;
      }
    }
  }

  return {
    state: curState,
    targetState: reqState,
    pendingState: pendingState,
    pendingDwellUs: pendingDwellUs,
    energy: energy,
    energyVel: energyVel,
    presence: presence,
    presenceVel: presenceVel,
    phase: phase,
    stateAgeUs: stateAgeUs,
    settleRestFrames: settleRestFrames,
    clock: clock,
    wakeToken: wakeToken,
    activeTicks: nextActiveTicks,
    idleSkippedTicks: machine.idleSkippedTicks,
    reducedMotion: false,
  };
}
