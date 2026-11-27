import { lightInputWords, lightSlotIndex, roundLightEven, validLightInput } from "../../ss/light/index.ss.ts";
import type { LightPolarity, LightPreset, LightSlot } from "../../ss/light/index.ss.ts";
import type { ReducedMotionPolicy, ThermalTier } from "../lux.ts";

export type LightPoint = { readonly x: number; readonly y: number };
export type LinearLightColor = readonly [number, number, number];
export type LightEmitter = LightPoint & {
  readonly heightPx?: number;
  readonly rangePx?: number;
  readonly gain?: number;
  readonly f0?: number;
  readonly tiltDeg?: number;
  readonly dispersion?: number;
  readonly color?: LinearLightColor;
  readonly poolGain?: number;
  readonly bevelGain?: number;
  readonly causticGain?: number;
  readonly segments?: number;
  readonly shadowFollow?: number;
  readonly path?: number;
  readonly footprint?: number;
  readonly ambientGain?: number;
};

export type SurfaceFrame = {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly radius?: number;
  // Local-to-scene CSS matrix [a,b,c,d], with x and y as translation.
  readonly transform?: readonly [number, number, number, number];
  readonly relief?: "raised" | "recessed";
  readonly full?: boolean;
  readonly blurPx?: number;
  readonly protectedGain?: number;
  readonly faceClip?: number;
  readonly bevelClip?: number;
  readonly segmentClips?: readonly [number, number];
  readonly ambientClip?: number;
};

export type LightPolicy = {
  readonly polarity: LightPolarity;
  readonly motion: ReducedMotionPolicy;
  readonly thermal: ThermalTier;
  readonly deviceScale: number;
  readonly maxBlurPx: number;
  readonly staticKey: LightPoint;
};

export const defaultLightPolicy: LightPolicy = {
  polarity: "obsidian-dark", motion: "full", thermal: "nominal", deviceScale: 1, maxBlurPx: 16,
  staticKey: { x: 32, y: 24 },
};

const tier = { nominal: 0, fair: 1, serious: 2, critical: 3 } as const;
const defaultColor: LinearLightColor = [1, .89, .75];
const pointer = lightSlotIndex("pointer");
const zenith = lightSlotIndex("zenith");

function position(value: number): number {
  if (!Number.isFinite(value) || Math.abs(value) > 32767) return NaN;
  return roundLightEven(value * 256) / 256;
}

export function writeSurfaceFrame(input: number[], surface: SurfaceFrame, policy: LightPolicy): void {
  const transform = surface.transform ?? [1, 0, 0, 1];
  const segments = surface.segmentClips;
  input[0] = surface.id;
  input[1] = position(surface.x); input[2] = position(surface.y);
  input[3] = position(surface.width); input[4] = position(surface.height); input[5] = position(surface.radius ?? 0);
  input[6] = transform[0]; input[7] = transform[1]; input[8] = transform[2]; input[9] = transform[3];
  input[10] = surface.relief === "recessed" ? -1 : 1;
  input[11] = surface.full === false ? 0 : 1;
  input[12] = policy.polarity === "sunlit-alabaster-light" ? 1 : 0;
  input[13] = policy.deviceScale;
  input[14] = surface.blurPx ?? 0; input[15] = policy.maxBlurPx;
  input[16] = tier[policy.thermal]; input[17] = policy.motion === "full" ? 0 : 1;
  input[18] = surface.protectedGain ?? 1;
  input[19] = surface.faceClip ?? 0; input[20] = surface.bevelClip ?? 0;
  input[21] = segments?.[0] ?? 0; input[22] = segments?.[1] ?? 0;
  input[23] = surface.ambientClip ?? 0;
  input[24] = position(policy.staticKey.x); input[25] = position(policy.staticKey.y);
}

export function writeEmitter(input: number[], index: number, emitter: LightEmitter | undefined): void {
  const s = 26 + index * 20;
  if (emitter === undefined) {
    input.fill(0, s, s + 20);
    return;
  }
  const color = emitter.color ?? defaultColor;
  input[s] = 1;
  input[s + 1] = position(emitter.x); input[s + 2] = position(emitter.y);
  input[s + 3] = emitter.heightPx ?? 180; input[s + 4] = emitter.rangePx ?? 430;
  input[s + 5] = emitter.gain ?? 1; input[s + 6] = emitter.f0 ?? .04;
  input[s + 7] = emitter.tiltDeg ?? 35; input[s + 8] = emitter.dispersion ?? 1.2;
  input[s + 9] = color[0]; input[s + 10] = color[1]; input[s + 11] = color[2];
  input[s + 12] = emitter.poolGain ?? .14; input[s + 13] = emitter.bevelGain ?? 1;
  input[s + 14] = emitter.causticGain ?? 1; input[s + 15] = emitter.segments ?? 1;
  input[s + 16] = emitter.shadowFollow ?? (index === pointer ? .018 : 0);
  input[s + 17] = emitter.path ?? 0; input[s + 18] = emitter.footprint ?? 1;
  input[s + 19] = emitter.ambientGain ?? (index === zenith ? .08 : 0);
}

export function createLightInput(
  surface: SurfaceFrame, policy: LightPolicy, emitters: Partial<Record<LightSlot, LightEmitter>> = {},
): number[] {
  const input = new Array<number>(lightInputWords()).fill(0);
  writeSurfaceFrame(input, surface, policy);
  for (const slot of Object.keys(emitters) as LightSlot[]) {
    const index = lightSlotIndex(slot);
    if (index < 0) throw new RangeError("LightCapacity");
    writeEmitter(input, index, emitters[slot]);
  }
  if (!validLightInput(input)) throw new RangeError("Invalid light input");
  return input;
}

export function presetEmitter(preset: LightPreset, pose: LightPoint, gain = 1): LightEmitter {
  return { ...pose, gain, f0: preset.f0, tiltDeg: preset.tiltDeg, rangePx: preset.rangePx, dispersion: preset.dispersion };
}

// Native v1 wire envelope. DataView stores explicitly little-endian.
export function encodeLightInput(input: readonly number[], output: Uint8Array): number {
  if (output.byteLength < 856) return -4;
  if (!validLightInput(input)) return -3;
  const view = new DataView(output.buffer, output.byteOffset, output.byteLength);
  view.setUint32(0, 1, true);
  view.setUint32(4, 856, true);
  for (let i = 0; i < lightInputWords(); i++) {
    const word = input[i]!;
    view.setFloat64(8 + i * 8, word === 0 ? 0 : word, true);
  }
  return 0;
}
