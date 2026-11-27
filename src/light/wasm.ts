import { validLightInput } from "../../ss/light/scene.ss.ts";

const lightWasmRelPath = import.meta.url.endsWith(".ts")
  ? "../../dist/wasm/light/entry.ss.wasm"
  : "../../wasm/light/entry.ss.wasm";

export const lightWasm = new URL(lightWasmRelPath, import.meta.url);

export type WasmLightFrame = {
  readonly status: number;
  readonly packet: readonly number[];
  readonly scene: readonly number[];
};

export async function instantiateLightWasm(source?: BufferSource): Promise<{
  starluxLightFrame(input: readonly number[]): WasmLightFrame;
}> {
  if (source === undefined) {
    if (lightWasm.protocol === "file:") {
      const fsModule = "node:fs/promises";
      const { readFile } = await import(fsModule) as { readFile(url: URL): Promise<Uint8Array<ArrayBuffer>> };
      source = await readFile(lightWasm);
    } else {
      const response = await fetch(lightWasm);
      if (!response.ok) throw new Error("Starlux light WASM fetch failed with HTTP " + response.status);
      source = await response.arrayBuffer();
    }
  }
  const address = new URL("./loader.mjs", lightWasm).href;
  const loader = await import(address) as {
    instantiate(data: BufferSource): Promise<{ starluxLightFrame(input: readonly number[]): WasmLightFrame }>;
  };
  const { starluxLightFrame } = await loader.instantiate(source);
  return {
    starluxLightFrame(input) {
      if (!validLightInput(input)) return { status: -3, packet: [], scene: [] };
      return starluxLightFrame(input);
    },
  };
}
