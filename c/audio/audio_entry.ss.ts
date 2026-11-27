// Starscript C library entry point for @mogos/starlux/audio (flat numeric ABI, zero JSON).
// Input array layout:
//   [0] frames (1..256)
//   [1] cmdCount (0..16)
//   [2..2+cmdCount*12-1] flattened commands (atFrame, seq, hitIndex, subject, epoch, seed,
//                        cueId, gainQ15, pan, rate100, materialOverride, pitchCents)
// Output array layout:
//   [0] activeVoices
//   [1] peakHoldS16
//   [2] stealCount
//   [3] pcmDigest
//   [4..4+frames*2-1] interleaved stereo s16 PCM samples

import {
  type AudioCommand,
  clampInt,
} from "../../ss/audio/format.ss.ts";
import {
  createRenderState,
  pcmDigest,
  renderBlock,
  submitCommand,
} from "../../ss/audio/mix.ss.ts";

export function starluxAudioRenderFlat(input: readonly number[]): readonly number[] {
  const frames = clampInt(input[0] ?? 0, 0, 256);
  const cmdCount = clampInt(input[1] ?? 0, 0, 16);
  let st = createRenderState();
  for (let i = 0; i < 16; i++) {
    if (i >= cmdCount) break;
    const base = 2 + i * 12;
    const cmd: AudioCommand = {
      atFrame: input[base] ?? 0,
      seq: input[base + 1] ?? (i + 1),
      hitIndex: input[base + 2] ?? 0,
      subject: input[base + 3] ?? 1,
      epoch: input[base + 4] ?? 1,
      seed: input[base + 5] ?? 7,
      cueId: input[base + 6] ?? 1,
      gainQ15: input[base + 7] ?? 32768,
      pan: input[base + 8] ?? 0,
      rate100: input[base + 9] ?? 100,
      materialOverride: input[base + 10] ?? -1,
      pitchCents: input[base + 11] ?? 0,
      op: 0,
    };
    st = submitCommand(st, cmd);
  }
  const res = renderBlock(st, frames);
  const out: number[] = [];
  out.push(res.activeVoices);
  out.push(res.state.peakHoldS16);
  out.push(res.state.stealCount);
  out.push(pcmDigest(res.pcmS16));
  for (let k = 0; k < 512; k++) {
    if (k >= res.pcmS16.length) break;
    out.push(res.pcmS16[k] ?? 0);
  }
  return out;
}
