// 4-target Starscript Voice Animation Backend verification (TS, Rust, WASM, C17 byte-identical).
// Exercises all 8 states, WakeToken zero-idle at rest, reducedMotion static floor,
// deterministic 8-band Goertzel PCM signal processor + Schmitt VAD hysteresis,
// synthetic speech cadence, and ALL 28 styles across Families A..E!

import { sin64 } from "../ss/physics/math.ss.ts";
import {
  VOICE_ACT,
  VOICE_CONFIRM,
  VOICE_DONE,
  VOICE_ERROR,
  VOICE_LISTEN,
  VOICE_REST,
  VOICE_SPEAK,
  VOICE_THINK,
  createVoiceMachine,
  stepVoiceMachine,
  voiceHeldWakeTokens,
} from "../ss/voice/state.ss.ts";
import {
  createVoiceSignalState,
  processPcmFrame,
  signalBandTotalEnergy,
  synthesizeSpeechCadence,
} from "../ss/voice/signal.ss.ts";
import { VOICE_PRIM_STRIDE, evalVoiceStyle } from "../ss/voice/styles.ss.ts";
import { VOICE_STYLE_COUNT, getVoiceStyleMeta } from "../ss/voice/catalog.ss.ts";
import {
  createVoiceRuntime,
  setVoiceRuntimeStyle,
  stepVoiceFrame,
} from "../ss/voice/index.ss.ts";

export type Voice4WayResult = {
  readonly ok: boolean;
  readonly stylesVerified: number;
  readonly statesVerified: number;
  readonly distinctStyleHashes: number;
  readonly idleActiveTickDelta: number;
  readonly idleHeldTokens: number;
  readonly idleSkipped: number;
  readonly reducedPhaseDelta: number;
  readonly vadHysteresisOk: boolean;
  readonly bandConservationOk: boolean;
  readonly dwellHysteresisOk: boolean;
  readonly checksumMilli: number;
};

function hashPrimitives(prims: readonly number[]): number {
  let acc = 0;
  for (let i = 0; i < 256; i++) {
    if (i >= prims.length) break;
    const v = prims[i];
    if (v !== undefined) {
      acc += Math.round(v * 1000) * (i + 1);
    }
  }
  return acc;
}

export function main(dtUs: number): Voice4WayResult {
  budget({ instructions: 50000000, outputBytes: 1048576, allocations: 500000 });
  const stepUs = dtUs > 0 ? dtUs : 16000;

  // 1. Verify all 8 states via state machine + WakeToken zero-idle at rest
  let m = createVoiceMachine(false);
  let statesOkCount = 0;
  for (let s = 0; s < 8; s++) {
    m = stepVoiceMachine(m, s, 0.75, stepUs, true);
    if (m.state === s) {
      statesOkCount += 1;
    }
    if (s !== VOICE_REST && voiceHeldWakeTokens(m) === 0) {
      statesOkCount = 0;
    }
  }

  // Return to REST and settle until WakeToken is released
  for (let i = 0; i < 120; i++) {
    m = stepVoiceMachine(m, VOICE_REST, 0, stepUs, true);
    if (voiceHeldWakeTokens(m) === 0 && m.energy === 0 && m.presence === 0) {
      break;
    }
  }
  const activeBeforeIdle = m.activeTicks;
  const skippedBeforeIdle = m.idleSkippedTicks;
  for (let i = 0; i < 120; i++) {
    m = stepVoiceMachine(m, VOICE_REST, 0, stepUs, false);
  }
  const idleActiveTickDelta = m.activeTicks - activeBeforeIdle;
  const idleHeldTokens = voiceHeldWakeTokens(m);
  const idleSkipped = m.idleSkippedTicks - skippedBeforeIdle;

  // 2. Verify state transition dwell hysteresis (listen -> speak blocked before 60ms dwell)
  let hm = stepVoiceMachine(createVoiceMachine(false), VOICE_LISTEN, 0.5, stepUs, true);
  hm = stepVoiceMachine(hm, VOICE_SPEAK, 0.8, 16000, false);
  const blockedEarly = hm.state === VOICE_LISTEN;
  for (let i = 0; i < 5; i++) {
    hm = stepVoiceMachine(hm, VOICE_SPEAK, 0.8, 16000, false);
  }
  const dwellHysteresisOk = blockedEarly && hm.state === VOICE_SPEAK;

  // 3. Verify reducedMotion freezes phase completely across active frames
  let rm = createVoiceMachine(true);
  rm = stepVoiceMachine(rm, VOICE_SPEAK, 0.8, stepUs, true);
  const rmPhase0 = rm.phase;
  for (let i = 0; i < 20; i++) {
    rm = stepVoiceMachine(rm, VOICE_SPEAK, 0.8, stepUs, false);
  }
  const reducedPhaseDelta = Math.abs(rm.phase - rmPhase0);

  // 4. Verify 8-band Goertzel PCM energy conservation + Schmitt VAD hysteresis
  const loudPcm: number[] = [];
  const midPcm: number[] = [];
  const silentPcm: number[] = [];
  for (let i = 0; i < 128; i++) {
    loudPcm.push(0.65 * sin64(6.283185307179586 * 440 * i / 16000) + 0.25 * sin64(6.283185307179586 * 1180 * i / 16000));
    midPcm.push(0.12 * sin64(6.283185307179586 * 440 * i / 16000));
    silentPcm.push(0);
  }
  let sig = createVoiceSignalState();
  for (let i = 0; i < 8; i++) {
    sig = processPcmFrame(sig, loudPcm, 16000, 16000);
  }
  const vadOpened = sig.vadActive === 1;
  const loudBandSum = signalBandTotalEnergy(sig);
  // Mid amplitude between 0.07 and 0.14 must keep VAD open (hysteresis)
  sig = processPcmFrame(sig, midPcm, 16000, 16000);
  const vadHeldInBand = sig.vadActive === 1;
  // Silence drains hangover and closes VAD
  for (let i = 0; i < 30; i++) {
    sig = processPcmFrame(sig, silentPcm, 16000, 16000);
  }
  const vadClosedOnSilence = sig.vadActive === 0;
  const silentBandSum = signalBandTotalEnergy(sig);
  const vadHysteresisOk = vadOpened && vadHeldInBand && vadClosedOnSilence;
  const bandConservationOk =
    loudBandSum > 0.2 &&
    loudBandSum <= 8.0 &&
    silentBandSum < 0.05 &&
    sig.b2 >= 0;

  // 5. Verify ALL 28 styles across Families A..E produce valid, distinct, normalized primitives
  let syn = createVoiceSignalState();
  for (let i = 0; i < 12; i++) {
    syn = synthesizeSpeechCadence(syn, 16000, VOICE_SPEAK, 0.85);
  }
  let rt = createVoiceRuntime(0, false);
  for (let i = 0; i < 6; i++) {
    rt = stepVoiceFrame(rt, VOICE_SPEAK, stepUs, 0.85, true).runtime;
  }

  let stylesOk = 0;
  let checksum = 0;
  const hashes: number[] = [];
  for (let id = 0; id < 28; id++) {
    const meta = getVoiceStyleMeta(id);
    const frame = evalVoiceStyle(id, VOICE_SPEAK, 0.78, 1.0, 2.35, syn, false);
    const rtStep = stepVoiceFrame(setVoiceRuntimeStyle(rt, id), VOICE_SPEAK, stepUs, 0.85, true);
    let boundsOk =
      meta.id === id &&
      frame.styleId === id &&
      frame.kind === meta.primitiveKind &&
      frame.count === meta.primitiveCount &&
      frame.primitives.length === frame.count * VOICE_PRIM_STRIDE &&
      rtStep.frame.count === meta.primitiveCount;

    for (let k = 0; k < 256; k++) {
      if (k >= frame.primitives.length) break;
      const val = frame.primitives[k];
      if (val === undefined || val < -1.0001 || val > 1.0001) {
        boundsOk = false;
      }
    }
    if (boundsOk) {
      stylesOk += 1;
    }
    const h = hashPrimitives(frame.primitives);
    hashes.push(h);
    checksum += h;
  }

  // Count pairwise-distinct style hashes across all 28 styles
  let distinctCount = 0;
  for (let i = 0; i < 28; i++) {
    const hi = hashes[i];
    let seenBefore = false;
    if (hi !== undefined) {
      for (let j = 0; j < 28; j++) {
        if (j >= i) break;
        const hj = hashes[j];
        if (hj !== undefined) {
          if (hj === hi) {
            seenBefore = true;
          }
        }
      }
    }
    if (!seenBefore) {
      distinctCount += 1;
    }
  }

  const ok =
    stylesOk === VOICE_STYLE_COUNT &&
    statesOkCount === 8 &&
    distinctCount === 28 &&
    idleActiveTickDelta === 0 &&
    idleHeldTokens === 0 &&
    idleSkipped === 120 &&
    reducedPhaseDelta === 0 &&
    vadHysteresisOk &&
    bandConservationOk &&
    dwellHysteresisOk;

  return {
    ok: ok,
    stylesVerified: stylesOk,
    statesVerified: statesOkCount,
    distinctStyleHashes: distinctCount,
    idleActiveTickDelta: idleActiveTickDelta,
    idleHeldTokens: idleHeldTokens,
    idleSkipped: idleSkipped,
    reducedPhaseDelta: reducedPhaseDelta,
    vadHysteresisOk: vadHysteresisOk,
    bandConservationOk: bandConservationOk,
    dwellHysteresisOk: dwellHysteresisOk,
    checksumMilli: Math.round(checksum),
  };
}
