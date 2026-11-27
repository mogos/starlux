// Browser AudioWorkletGlobalScope module entry point for "starlux-audio-processor".
import {
  type AudioWorkletProcessorCtor,
  createStarluxAudioWorkletProcessor,
} from "./worklet.ts";

type RegisterProcessorFn = (name: string, processorCtor: unknown) => void;

const workletScope = globalThis as unknown as {
  AudioWorkletProcessor?: AudioWorkletProcessorCtor;
  registerProcessor?: RegisterProcessorFn;
};

if (
  typeof workletScope.AudioWorkletProcessor === "function" &&
  typeof workletScope.registerProcessor === "function"
) {
  workletScope.registerProcessor(
    "starlux-audio-processor",
    createStarluxAudioWorkletProcessor(workletScope.AudioWorkletProcessor),
  );
}
