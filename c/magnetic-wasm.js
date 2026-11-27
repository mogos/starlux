export const magneticWasm = new URL("../dist/wasm/magnetic/magnetic.ss.wasm", import.meta.url);

export async function instantiateMagneticWasm(source) {
  if (source === undefined) {
    if (magneticWasm.protocol === "file:") {
      const { readFile } = await import("node:fs/promises");
      source = await readFile(magneticWasm);
    } else {
      const response = await fetch(magneticWasm);
      if (!response.ok) throw new Error("Starlux WASM fetch failed with HTTP " + response.status);
      source = await response.arrayBuffer();
    }
  }
  const { instantiate } = await import("../dist/wasm/magnetic/loader.mjs");
  const { starluxMagneticFrame } = await instantiate(source);
  return { starluxMagneticFrame: (input) => starluxMagneticFrame(Array.from(input)) };
}
