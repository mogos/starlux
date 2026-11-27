import { magneticFrameFlat } from "../ss/magnetic_abi.ss.ts";

export function starluxMagneticFrame(input: readonly number[]): readonly number[] {
  return magneticFrameFlat(input);
}
