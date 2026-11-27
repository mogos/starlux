// Web Audio Worklet kernel bridge for @mogos/starlux/audio.
// Executes the exact 4-target Starscript DSP kernel (ss/audio/mix.ss.ts) at 48 kHz stereo.

import {
  type AudioCommand,
  type RenderState,
  cancelRenderSubject,
  countActiveVoices,
  createRenderState,
  isRenderActive,
  muteRenderState,
  opCancel,
  opMute,
  renderBlock,
  s16ToF32Exact,
  submitCommand,
  unmuteRenderState,
  wrapU32,
} from "../../../ss/audio/index.ss.ts";

export type WorkletMessage =
  | { readonly type: "cmd"; readonly command: AudioCommand; readonly relativeFrames?: number; readonly hostGen?: number }
  | { readonly type: "cancel"; readonly subject: number; readonly epoch: number; readonly hostGen?: number }
  | { readonly type: "mute"; readonly hostGen?: number }
  | { readonly type: "unmute"; readonly hostGen?: number };

export type WorkletDrainCallback = (activeVoices: number, quantaRendered: number, hostGen: number) => void;

export class StarluxAudioWorkletCore {
  private state: RenderState;
  private lastActive: number;
  private lastHostGen: number;
  private readonly onDrainChange: WorkletDrainCallback | undefined;

  constructor(onDrainChange?: WorkletDrainCallback) {
    this.state = createRenderState();
    this.lastActive = 0;
    this.lastHostGen = 0;
    this.onDrainChange = onDrainChange;
  }

  postMessage(msg: WorkletMessage): void {
    if (msg.hostGen !== undefined) {
      this.lastHostGen = msg.hostGen;
    }
    const wasActive = this.lastActive;
    if (msg.type === "mute") {
      this.state = muteRenderState(this.state);
    } else if (msg.type === "unmute") {
      this.state = unmuteRenderState(this.state);
    } else if (msg.type === "cancel") {
      this.state = cancelRenderSubject(this.state, msg.subject, msg.epoch);
    } else if (msg.command.op === opMute()) {
      this.state = muteRenderState(this.state);
    } else if (msg.command.op === opCancel()) {
      this.state = cancelRenderSubject(this.state, msg.command.subject, msg.command.epoch);
    } else {
      this.state = submitCommand(this.state, msg.command);
    }
    const nowActive = isRenderActive(this.state) ? 1 : 0;
    this.lastActive = nowActive;
    if (wasActive > 0 && nowActive === 0 && this.onDrainChange !== undefined) {
      this.onDrainChange(0, this.state.quantaRendered, this.lastHostGen);
    }
  }

  // Render `frames` (typically 128) into planar stereo Float32Arrays (exact s16 * 2^-15).
  processQuantum(outLeft: Float32Array, outRight: Float32Array, frames = 128): number {
    const n = Math.min(frames, outLeft.length, outRight.length, 256);
    if (n <= 0) return countActiveVoices(this.state);
    const res = renderBlock(this.state, n);
    this.state = res.state;
    for (let i = 0; i < n; i++) {
      outLeft[i] = s16ToF32Exact(res.pcmS16[2 * i] ?? 0);
      outRight[i] = s16ToF32Exact(res.pcmS16[2 * i + 1] ?? 0);
    }
    const stillActive = isRenderActive(this.state) ? Math.max(1, res.activeVoices) : 0;
    if (stillActive === 0) {
      if (this.lastActive !== 0) {
        this.lastActive = 0;
        if (this.onDrainChange !== undefined) {
          this.onDrainChange(0, this.state.quantaRendered, this.lastHostGen);
        }
      }
    } else {
      this.lastActive = stillActive;
    }
    return stillActive;
  }

  isActive(): boolean {
    return isRenderActive(this.state);
  }

  // Used on main thread when a real AudioWorkletNode rendered & drained on the audio thread.
  syncRemoteDrain(quantaRendered: number): void {
    const muted = this.state.muted;
    const fresh = createRenderState();
    this.state = {
      ...fresh,
      muted,
      quantaRendered: Math.max(this.state.quantaRendered, quantaRendered),
      peakHoldS16: this.state.peakHoldS16,
      serial: this.state.serial,
      cancelGeneration: this.state.cancelGeneration,
    };
    this.lastActive = 0;
  }

  snapshot(): RenderState {
    return this.state;
  }
}

export interface AudioWorkletPortLike {
  onmessage: ((ev: { readonly data: WorkletMessage }) => void) | null;
  postMessage(data: unknown): void;
}

export interface AudioWorkletProcessorBase {
  readonly port: AudioWorkletPortLike;
}

export type AudioWorkletProcessorCtor = new () => AudioWorkletProcessorBase;

// Factory for browser AudioWorkletGlobalScope without requiring AudioWorkletProcessor at import time.
export function createStarluxAudioWorkletProcessor(Base: AudioWorkletProcessorCtor): new () => AudioWorkletProcessorBase & {
  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean;
} {
  return class StarluxAudioProcessor extends Base {
    private readonly core: StarluxAudioWorkletCore;

    constructor() {
      super();
      this.core = new StarluxAudioWorkletCore((active, quanta, hostGen) => {
        this.port.postMessage({ type: "drained", active, quanta, hostGen });
      });
      this.port.onmessage = (ev) => {
        if (ev.data !== undefined && ev.data !== null) {
          if (ev.data.type === "cmd" && ev.data.relativeFrames !== undefined) {
            const curFrame = this.core.snapshot().frame;
            const rebased: AudioCommand = {
              ...ev.data.command,
              atFrame: wrapU32(curFrame + Math.max(0, Math.floor(ev.data.relativeFrames))),
            };
            this.core.postMessage({ ...ev.data, command: rebased });
          } else {
            this.core.postMessage(ev.data);
          }
        }
      };
    }

    process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
      const ch = outputs[0];
      if (ch === undefined || ch.length < 2) return true;
      const left = ch[0];
      const right = ch[1];
      if (left === undefined || right === undefined) return true;
      this.core.processQuantum(left, right, left.length);
      return true;
    }
  };
}
