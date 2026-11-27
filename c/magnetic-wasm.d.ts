export declare const magneticWasm: URL;
export declare function instantiateMagneticWasm(source?: BufferSource | WebAssembly.Module): Promise<{
  starluxMagneticFrame(input: ArrayLike<number>): readonly number[];
}>;
