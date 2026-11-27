import { roundLightEven } from "./optics.ss.ts";

// Only the presentation path accepts source visibility.
export function paintLightSource(showLightSource: boolean, active: boolean, x: number, y: number, out: number[]): number {
  const visible = showLightSource && active;
  out[0] = visible ? 1 : 0;
  out[1] = visible ? roundLightEven(x * 256) : 0;
  out[2] = visible ? roundLightEven(y * 256) : 0;
  out[3] = visible ? 11 * 256 : 0;
  return out[0] ?? 0;
}
