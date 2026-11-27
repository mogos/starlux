import { clamp } from "../physics/math.ss.ts";

export type FrameSample = {
  readonly frameUs: number;
  readonly expectedUs: number;
  readonly elapsedUs: number;
};
export type LuxTrace = { readonly samples: readonly FrameSample[]; readonly idleWakeups: number };
export type LuxTraceSummary = {
  readonly count: number;
  readonly p50: number;
  readonly p90: number;
  readonly p99: number;
  readonly hitchMillisecondsPerSecond: number;
  readonly idleWakeups: number;
};
export type LuxBudget = {
  readonly p99Milliseconds: number;
  readonly hitchMillisecondsPerSecond: number;
  readonly idleWakeups: number;
};

export function createLuxTrace(): LuxTrace { return { samples: [], idleWakeups: 0 }; }

export function recordTrace(trace: LuxTrace, sample: FrameSample, idleWakeups: number): LuxTrace {
  if (!(sample.frameUs >= 0 && sample.frameUs <= 10000000 &&
    sample.expectedUs > 0 && sample.expectedUs <= 10000000 &&
    sample.elapsedUs > 0 && sample.elapsedUs <= 10000000)) return trace;
  const next: FrameSample[] = [];
  const skip = trace.samples.length >= 128;
  for (let i = 0; i < 128; i++) {
    if (i >= trace.samples.length) break;
    const frame = trace.samples[i];
    if (frame !== undefined && !(skip && i === 0)) next.push(frame);
  }
  next.push(sample);
  return { samples: next, idleWakeups: clamp(idleWakeups, 0, 9007199254740991) };
}

function percentile(samples: readonly FrameSample[], numerator: number): number {
  const rank = Math.floor((numerator * samples.length + 99) / 100);
  for (let i = 0; i < 128; i++) {
    if (i >= samples.length) break;
    const sample = samples[i];
    if (sample !== undefined) {
      let position = 1;
      for (let j = 0; j < 128; j++) {
        if (j >= samples.length) break;
        const other = samples[j];
        if (other !== undefined && (other.frameUs < sample.frameUs || (other.frameUs === sample.frameUs && j < i))) {
          position += 1;
        }
      }
      if (position === rank) return sample.frameUs / 1000;
    }
  }
  return 0;
}

export function summarizeTrace(trace: LuxTrace): LuxTraceSummary {
  let hitchUs = 0;
  let elapsedUs = 0;
  for (let i = 0; i < 128; i++) {
    if (i >= trace.samples.length) break;
    const frame = trace.samples[i];
    if (frame !== undefined) {
      if (frame.frameUs > frame.expectedUs) hitchUs += frame.frameUs - frame.expectedUs;
      elapsedUs += frame.elapsedUs;
    }
  }
  let hitchRate = 0;
  if (elapsedUs > 0) hitchRate = 1000 * hitchUs / elapsedUs;
  return {
    count: trace.samples.length, p50: percentile(trace.samples, 50), p90: percentile(trace.samples, 90),
    p99: percentile(trace.samples, 99), hitchMillisecondsPerSecond: hitchRate, idleWakeups: trace.idleWakeups,
  };
}

export function defaultLuxBudget(): LuxBudget {
  return { p99Milliseconds: 8.3, hitchMillisecondsPerSecond: 5, idleWakeups: 0 };
}

export function checkLuxBudget(summary: LuxTraceSummary, budget: LuxBudget): boolean {
  return summary.count > 0 && summary.p99 <= budget.p99Milliseconds &&
    summary.hitchMillisecondsPerSecond <= budget.hitchMillisecondsPerSecond && summary.idleWakeups <= budget.idleWakeups;
}
