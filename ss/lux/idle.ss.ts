export type IdleSample = {
  readonly clockTicks: number;
  readonly hostRafCount: number;
  readonly heldTokens: number;
};
export type IdleFalsifier = {
  readonly elapsedUs: number;
  readonly clockTicks: number;
  readonly hostRafCount: number;
  readonly heldTokens: number;
  readonly passed: boolean;
};

export function falsifyIdle(before: IdleSample, after: IdleSample, elapsedUs: number): IdleFalsifier {
  const ticks = after.clockTicks - before.clockTicks;
  const rafs = after.hostRafCount - before.hostRafCount;
  return {
    elapsedUs: elapsedUs, clockTicks: ticks, hostRafCount: rafs, heldTokens: after.heldTokens,
    passed: elapsedUs >= 10000000 && ticks === 0 && rafs === 0 && before.heldTokens === 0 && after.heldTokens === 0,
  };
}
