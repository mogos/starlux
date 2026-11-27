export type LightSlot = "pointer" | "zenith" | "star" | "focus";
export type LightPolarity = "obsidian-dark" | "sunlit-alabaster-light";
export type PresetPolarity = "obsidian-dark" | "sunlit-alabaster-light" | "adaptive";
export type LightCost = "E" | "F" | "P";

export type LightPreset = {
  readonly id: string;
  readonly description: string;
  readonly f0: number;
  readonly tiltDeg: number;
  readonly rangePx: number;
  readonly dispersion: number;
  readonly polarity: string;
  readonly showLightSourceDefault: boolean;
  readonly event: string;
  readonly binding: string;
  readonly cost: string;
  readonly durationUs: number;
};

export type SourceView = { readonly showLightSource: boolean; readonly sourceSlot: LightSlot };

export function lightPacketWords(): number { return 1352; }
export function lightInputWords(): number { return 106; }
export function lightLaneWords(): number { return 16; }
export function lightSceneWords(): number { return 8; }
export function lightScratchWords(): number { return 14; }

export function lightSlotIndex(slot: LightSlot): number {
  if (slot === "pointer") return 0;
  if (slot === "zenith") return 1;
  if (slot === "star") return 2;
  if (slot === "focus") return 3;
  return -1;
}
