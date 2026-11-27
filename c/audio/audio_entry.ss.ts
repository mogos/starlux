// Starscript C library entry point for @mogos/starlux/audio (stateful flat numeric ABI, zero JSON).
// Input array layout:
//   [0] frames (0..256)
//   [1..15] RenderState header:
//     [1] frame, [2] serial, [3] cancelGeneration, [4] muted (0|1), [5] compGainQ15,
//     [6] dcX1L, [7] dcY1L, [8] dcX1R, [9] dcY1R, [10] peakHoldS16,
//     [11] droppedCount, [12] stealCount, [13] maxSimultaneous, [14] quantaRendered, [15] pendingLen (0..64)
//   [16..465] 6 VoiceSlots x 75 words (25 scalars + 4 ModeStates x 9 words + hasReplacement + 13-word replacement cmd)
//   [466..466+pendingLen*13-1] pendingLen flattened AudioCommands (13 words each)
// Output array layout:
//   [0] isActive (1 if voices > 0 or pending > 0, else 0)
//   [1..15] updated RenderState header (same offsets as input)
//   [16..465] updated 6 VoiceSlots x 75 words
//   [466..466+outPendingLen*13-1] updated pending commands
//   [466+outPendingLen*13 .. +frames*2-1] interleaved stereo s16 PCM samples

import {
  type AudioCommand,
  type ModeState,
  type RenderState,
  type VoiceSlot,
  clampInt,
  emptyCommand,
  wrapU32,
} from "../../ss/audio/format.ss.ts";
import { emptyMode } from "../../ss/audio/modal.ss.ts";
import {
  isRenderActive,
  renderBlock,
} from "../../ss/audio/mix.ss.ts";

export function starluxAudioRenderFlat(input: readonly number[]): readonly number[] {
  const frames = clampInt(input[0] ?? 0, 0, 256);
  const pendingLen = clampInt(input[15] ?? 0, 0, 64);

  const voices: VoiceSlot[] = [];
  for (let v = 0; v < 6; v++) {
    voices.push(decodeVoice(input, 16 + v * 75));
  }

  const pending: AudioCommand[] = [];
  for (let p = 0; p < 64; p++) {
    if (p >= pendingLen) break;
    pending.push(decodeCommand(input, 466 + p * 13));
  }

  const st: RenderState = {
    frame: wrapU32(input[1] ?? 0),
    serial: Math.floor(input[2] ?? 0),
    cancelGeneration: Math.floor(input[3] ?? 0),
    muted: (input[4] ?? 0) !== 0,
    compGainQ15: clampInt(input[5] ?? 32768, 0, 32768),
    dcX1L: Math.floor(input[6] ?? 0),
    dcY1L: Math.floor(input[7] ?? 0),
    dcX1R: Math.floor(input[8] ?? 0),
    dcY1R: Math.floor(input[9] ?? 0),
    peakHoldS16: Math.floor(input[10] ?? 0),
    droppedCount: Math.floor(input[11] ?? 0),
    stealCount: Math.floor(input[12] ?? 0),
    maxSimultaneous: Math.floor(input[13] ?? 0),
    quantaRendered: Math.floor(input[14] ?? 0),
    voices,
    pending,
  };

  const res = renderBlock(st, frames);
  const ns = res.state;
  const outPendingLen = clampInt(ns.pending.length, 0, 64);

  const out: number[] = [];
  out.push(isRenderActive(ns) ? 1 : 0);
  out.push(ns.frame);
  out.push(ns.serial);
  out.push(ns.cancelGeneration);
  out.push(ns.muted ? 1 : 0);
  out.push(ns.compGainQ15);
  out.push(ns.dcX1L);
  out.push(ns.dcY1L);
  out.push(ns.dcX1R);
  out.push(ns.dcY1R);
  out.push(ns.peakHoldS16);
  out.push(ns.droppedCount);
  out.push(ns.stealCount);
  out.push(ns.maxSimultaneous);
  out.push(ns.quantaRendered);
  out.push(outPendingLen);

  for (let v = 0; v < 6; v++) {
    const slot = ns.voices[v];
    if (slot !== undefined) {
      pushVoice(out, slot);
    } else {
      pushVoice(out, {
        state: 0,
        admitOrder: 0,
        age: 0,
        totalFrames: 0,
        attackFrames: 0,
        releaseFrames: 0,
        gainQ15: 0,
        panLQ15: 23170,
        panRQ15: 23170,
        noiseKind: 0,
        noiseSeed: 7,
        noiseEnvQ24: 0,
        noiseMulQ24: 0,
        noiseStopFrames: 0,
        b0Q29: 0,
        a1Q29: 0,
        a2Q29: 0,
        x1: 0,
        x2: 0,
        y1: 0,
        y2: 0,
        fadeIndex: 0,
        subject: 0,
        epoch: 0,
        cueId: 0,
        modes: [emptyMode(), emptyMode(), emptyMode(), emptyMode()],
        hasReplacement: false,
        replacement: emptyCommand(),
      });
    }
  }

  for (let p = 0; p < 64; p++) {
    if (p >= outPendingLen) break;
    const item = ns.pending[p];
    if (item !== undefined) {
      pushCommand(out, item);
    } else {
      pushCommand(out, emptyCommand());
    }
  }

  for (let k = 0; k < 512; k++) {
    if (k >= res.pcmS16.length) break;
    out.push(res.pcmS16[k] ?? 0);
  }
  return out;
}

function decodeCommand(input: readonly number[], base: number): AudioCommand {
  return {
    atFrame: wrapU32(input[base] ?? 0),
    seq: Math.floor(input[base + 1] ?? 0),
    hitIndex: clampInt(input[base + 2] ?? 0, 0, 3),
    subject: Math.floor(input[base + 3] ?? 0),
    epoch: Math.floor(input[base + 4] ?? 0),
    seed: Math.floor(input[base + 5] ?? 7),
    cueId: clampInt(input[base + 6] ?? 0, 0, 250),
    gainQ15: clampInt(input[base + 7] ?? 0, 0, 32768),
    pan: clampInt(input[base + 8] ?? 0, -32767, 32767),
    rate100: clampInt(input[base + 9] ?? 100, 10, 400),
    materialOverride: clampInt(input[base + 10] ?? -1, -1, 5),
    pitchCents: clampInt(input[base + 11] ?? 0, -1200, 1200),
    op: clampInt(input[base + 12] ?? 0, 0, 2),
  };
}

function pushCommand(out: number[], cmd: AudioCommand): void {
  out.push(cmd.atFrame);
  out.push(cmd.seq);
  out.push(cmd.hitIndex);
  out.push(cmd.subject);
  out.push(cmd.epoch);
  out.push(cmd.seed);
  out.push(cmd.cueId);
  out.push(cmd.gainQ15);
  out.push(cmd.pan);
  out.push(cmd.rate100);
  out.push(cmd.materialOverride);
  out.push(cmd.pitchCents);
  out.push(cmd.op);
}

function decodeMode(input: readonly number[], base: number): ModeState {
  return {
    active: (input[base] ?? 0) !== 0,
    phase: wrapU32(input[base + 1] ?? 0),
    startInc: wrapU32(input[base + 2] ?? 0),
    endInc: wrapU32(input[base + 3] ?? 0),
    glideFrames: Math.floor(input[base + 4] ?? 0),
    weightQ15: clampInt(input[base + 5] ?? 0, 0, 32768),
    envQ15: Math.floor(input[base + 6] ?? 0),
    decayMulQ24: Math.floor(input[base + 7] ?? 0),
    totalFrames: Math.floor(input[base + 8] ?? 0),
  };
}

function pushMode(out: number[], m: ModeState): void {
  out.push(m.active ? 1 : 0);
  out.push(m.phase);
  out.push(m.startInc);
  out.push(m.endInc);
  out.push(m.glideFrames);
  out.push(m.weightQ15);
  out.push(m.envQ15);
  out.push(m.decayMulQ24);
  out.push(m.totalFrames);
}

function decodeVoice(input: readonly number[], base: number): VoiceSlot {
  const modes: ModeState[] = [];
  for (let m = 0; m < 4; m++) {
    modes.push(decodeMode(input, base + 25 + m * 9));
  }
  return {
    state: clampInt(input[base] ?? 0, 0, 2),
    admitOrder: Math.floor(input[base + 1] ?? 0),
    age: Math.floor(input[base + 2] ?? 0),
    totalFrames: Math.floor(input[base + 3] ?? 0),
    attackFrames: clampInt(input[base + 4] ?? 0, 0, 72),
    releaseFrames: clampInt(input[base + 5] ?? 0, 0, 96),
    gainQ15: clampInt(input[base + 6] ?? 0, 0, 32768),
    panLQ15: clampInt(input[base + 7] ?? 23170, 0, 32768),
    panRQ15: clampInt(input[base + 8] ?? 23170, 0, 32768),
    noiseKind: clampInt(input[base + 9] ?? 0, 0, 1),
    noiseSeed: wrapU32(input[base + 10] ?? 7),
    noiseEnvQ24: Math.floor(input[base + 11] ?? 0),
    noiseMulQ24: Math.floor(input[base + 12] ?? 0),
    noiseStopFrames: Math.floor(input[base + 13] ?? 0),
    b0Q29: Math.floor(input[base + 14] ?? 0),
    a1Q29: Math.floor(input[base + 15] ?? 0),
    a2Q29: Math.floor(input[base + 16] ?? 0),
    x1: Math.floor(input[base + 17] ?? 0),
    x2: Math.floor(input[base + 18] ?? 0),
    y1: Math.floor(input[base + 19] ?? 0),
    y2: Math.floor(input[base + 20] ?? 0),
    fadeIndex: clampInt(input[base + 21] ?? 0, 0, 96),
    subject: Math.floor(input[base + 22] ?? 0),
    epoch: Math.floor(input[base + 23] ?? 0),
    cueId: clampInt(input[base + 24] ?? 0, 0, 250),
    modes,
    hasReplacement: (input[base + 61] ?? 0) !== 0,
    replacement: decodeCommand(input, base + 62),
  };
}

function pushVoice(out: number[], v: VoiceSlot): void {
  out.push(v.state);
  out.push(v.admitOrder);
  out.push(v.age);
  out.push(v.totalFrames);
  out.push(v.attackFrames);
  out.push(v.releaseFrames);
  out.push(v.gainQ15);
  out.push(v.panLQ15);
  out.push(v.panRQ15);
  out.push(v.noiseKind);
  out.push(v.noiseSeed);
  out.push(v.noiseEnvQ24);
  out.push(v.noiseMulQ24);
  out.push(v.noiseStopFrames);
  out.push(v.b0Q29);
  out.push(v.a1Q29);
  out.push(v.a2Q29);
  out.push(v.x1);
  out.push(v.x2);
  out.push(v.y1);
  out.push(v.y2);
  out.push(v.fadeIndex);
  out.push(v.subject);
  out.push(v.epoch);
  out.push(v.cueId);
  for (let m = 0; m < 4; m++) {
    const mode = v.modes[m];
    if (mode !== undefined) {
      pushMode(out, mode);
    } else {
      pushMode(out, emptyMode());
    }
  }
  out.push(v.hasReplacement ? 1 : 0);
  pushCommand(out, v.replacement);
}
