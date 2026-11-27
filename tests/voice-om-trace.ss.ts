// Runtime OM conformance trace generator for StarluxVoice (.om/voice/starluxvoice.om).
import { sin64 } from "../ss/physics/math.ss.ts";
import { type LuxClock } from "../ss/lux/wake.ss.ts";
import {
  type VoiceMachineState,
  VOICE_LISTEN,
  VOICE_REST,
  VOICE_SPEAK,
  createVoiceMachine,
  stepVoiceMachine,
  voiceHeldWakeTokens,
} from "../ss/voice/state.ss.ts";
import { createVoiceSignalState, processPcmFrame } from "../ss/voice/signal.ss.ts";

function row(
  action: string,
  vs: number,
  wake: number,
  settled: number,
  idle: number,
  rm: number,
  pm: number,
  vad: number,
  hang: number,
): string {
  return (
    '{"action":"' +
    action +
    '","state":{"idle_ticks":"' +
    String(idle) +
    '","phase_moved":"' +
    String(pm) +
    '","reduced_motion":"' +
    String(rm) +
    '","settled":"' +
    String(settled) +
    '","vad_hangover":"' +
    String(hang) +
    '","vad_state":"' +
    String(vad) +
    '","voice_state":"' +
    String(vs) +
    '","wake_held":"' +
    String(wake) +
    '"}}'
  );
}

export function main(_input: number): string {
  budget({ instructions: 50000000, outputBytes: 1048576, allocations: 500000 });
  const lines: string[] = [];

  let m = createVoiceMachine(false);

  m = stepVoiceMachine(m, VOICE_LISTEN, 0.5, 16000, true);
  lines.push(row("enter_listen", 1, voiceHeldWakeTokens(m) > 0 ? 1 : 0, 0, 0, 0, 0, 0, 0));

  m = stepVoiceMachine(m, VOICE_SPEAK, 0.85, 16000, true);
  const loud: number[] = [];
  const silent: number[] = [];
  for (let i = 0; i < 64; i++) {
    loud.push(0.7 * sin64(6.283185307179586 * 440 * i / 16000));
    silent.push(0);
  }
  let sig = createVoiceSignalState();
  for (let i = 0; i < 8; i++) {
    sig = processPcmFrame(sig, loud, 16000, 16000);
  }
  lines.push(row("enter_speak", 2, voiceHeldWakeTokens(m) > 0 ? 1 : 0, 0, 0, 0, 0, sig.vadActive, 2));

  const pBefore = m.phase;
  m = stepVoiceMachine(m, VOICE_SPEAK, 0.85, 16000, false);
  lines.push(row("step_active_motion", 2, 1, 0, 0, 0, m.phase > pBefore ? 1 : 0, 1, 2));

  sig = processPcmFrame(sig, silent, 16000, 16000);
  lines.push(row("vad_mid_band_hold", 2, 1, 0, 0, 0, 1, sig.vadActive, 1));
  sig = processPcmFrame(sig, silent, 16000, 16000);
  lines.push(row("vad_mid_band_hold", 2, 1, 0, 0, 0, 1, sig.vadActive, 0));

  for (let i = 0; i < 24; i++) {
    sig = processPcmFrame(sig, silent, 16000, 16000);
  }
  lines.push(row("vad_silence_close", 2, 1, 0, 0, 0, 1, sig.vadActive, 0));

  m = stepVoiceMachine(m, VOICE_REST, 0, 16000, true);
  lines.push(row("request_rest", 0, voiceHeldWakeTokens(m) > 0 ? 1 : 0, 0, 0, 0, 1, 0, 0));

  for (let i = 0; i < 120; i++) {
    m = stepVoiceMachine(m, VOICE_REST, 0, 16000, true);
    if (voiceHeldWakeTokens(m) === 0 && m.energy === 0 && m.presence === 0) break;
  }
  lines.push(row("settle_to_idle", 0, voiceHeldWakeTokens(m), 1, 0, 0, 1, 0, 0));

  const actBefore = m.activeTicks;
  for (let i = 0; i < 60; i++) {
    m = stepVoiceMachine(m, VOICE_REST, 0, 16000, false);
  }
  lines.push(row("idle_poll", 0, voiceHeldWakeTokens(m), 1, m.activeTicks - actBefore, 0, 1, 0, 0));

  let rm = createVoiceMachine(true);
  lines.push(row("enable_reduced", 0, 0, 1, 0, 1, 0, 0, 0));
  rm = stepVoiceMachine(rm, VOICE_LISTEN, 0.6, 16000, true);
  lines.push(row("enter_listen", 1, voiceHeldWakeTokens(rm) > 0 ? 1 : 0, 0, 0, 1, 0, 0, 0));
  const rmP0 = rm.phase;
  rm = stepVoiceMachine(rm, VOICE_LISTEN, 0.6, 16000, false);
  lines.push(row("step_active_reduced", 1, 1, 0, 0, 1, rm.phase !== rmP0 ? 1 : 0, 0, 0));

  let out = "";
  for (let i = 0; i < 32; i++) {
    if (i >= lines.length) break;
    const ln = lines[i];
    if (ln !== undefined) {
      if (i > 0) out += "\n";
      out += ln;
    }
  }
  return out;
}
