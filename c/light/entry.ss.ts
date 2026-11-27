import { shadeSurface } from "../../ss/light/scene.ss.ts";

export type LightFrame = {
  readonly status: number;
  readonly packet: readonly number[];
  readonly scene: readonly number[];
};

// Copy-based binding for the generated Rust and isolated WASM library ABIs.
// Native C and the TypeScript frame loop use borrowed, preallocated buffers.
export function starluxLightFrame(input: readonly number[]): LightFrame {
  const packet: number[] = [];
  const scene: number[] = [];
  const scratch: number[] = [];
  for (let i = 0; i < 1352; i++) packet.push(0);
  for (let i = 0; i < 8; i++) scene.push(0);
  for (let i = 0; i < 14; i++) scratch.push(0);
  const status = shadeSurface(input, packet, scene, scratch);
  if (status !== 0) return { status: status, packet: [], scene: [] };
  return { status: status, packet: packet, scene: scene };
}
