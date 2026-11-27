import { bevelCos, bevelSin } from "./bevel.ss.ts";

export function minLight(a: number, b: number): number { return a < b ? a : b; }
export function maxLight(a: number, b: number): number { return a > b ? a : b; }
export function clampLight(x: number, lo: number, hi: number): number { return maxLight(lo, minLight(hi, x)); }
export function unitLight(x: number): number { return clampLight(x, 0, 1); }
export function lightAt(values: readonly number[], index: number): number {
  const value = values[index] ?? 0;
  return value === 0 ? 0 : value;
}

export function roundLightEven(value: number): number {
  const lo = Math.floor(value);
  const fraction = value - lo;
  if (fraction > .5 || (fraction === .5 && lo % 2 !== 0)) return lo + 1;
  if (lo === 0) return 0;
  return lo;
}

export function lightUNorm(value: number): number { return roundLightEven(unitLight(value) * 65535); }

export function schlickReflectance(f0: number, cosI: number): number {
  const graze = 1 - cosI;
  const square = graze * graze;
  return f0 + (1 - f0) * ((square * square) * graze);
}

export function lightFalloff(distance: number, rangePx: number): number {
  const ratio = distance / rangePx;
  return 1 / (1 + ratio * ratio);
}

export function bevelSpecular(horizontal: number, vertical: number, tiltDeg: number): number {
  const hz = vertical + 1;
  const length = sqrtLight(horizontal * horizontal + hz * hz);
  const hx = horizontal / length;
  const hy = hz / length;
  const dot = maxLight(0, bevelSin(tiltDeg) * hx + bevelCos(tiltDeg) * hy);
  const squared = dot * dot;
  const fourth = squared * squared;
  return fourth * fourth;
}

export function transmittedCaustic(reflectance: number, att: number, over: number, gain: number): number {
  return (1 - reflectance) * att * .20 * (1 - .60 * over) * gain;
}

// Positive tone on the obsidian coupon and negative tone on the alabaster coupon.
export function materialEdgeLuminance(polarity: number): number {
  if (polarity === 1) return (.80 - .08 * (.80 + .10)) / 1.08;
  return (.12 + .08 * (.12 + .10)) / .92;
}

// Conservative uniform guard for a protected area and its worst-case backing.
export function protectedLightGain(base: number, foreground: number, optical: number, ratio: number): number {
  if (foreground > base) {
    const ceiling = (foreground + .05) / ratio - .05;
    if (base > ceiling) return 0;
    if (optical <= base) return 1;
    return unitLight((ceiling - base) / (optical - base));
  }
  const floor = ratio * (foreground + .05) - .05;
  if (base < floor) return 0;
  if (optical >= base) return 1;
  return unitLight((base - floor) / (base - optical));
}

// Restoring square root for nonnegative binary64 inputs. The two final
// restoring steps use split integer remainders to keep every bit exact.
export function sqrtLight(value: number): number {
  if (value === 0) return 0;
  let mantissa = value;
  let scale = 1;
  for (let i = 0; i < 17; i++) {
    if (mantissa >= 18446744073709551616) {
      mantissa *= 5.421010862427522e-20;
      scale *= 4294967296;
    } else if (mantissa < 5.421010862427522e-20) {
      mantissa *= 18446744073709551616;
      scale *= 2.3283064365386963e-10;
    } else break;
  }
  for (let i = 0; i < 33; i++) {
    if (mantissa >= 4) {
      mantissa *= .25;
      scale *= 2;
    } else if (mantissa < 1) {
      mantissa *= 4;
      scale *= .5;
    } else break;
  }
  let root = 0;
  let remainder = 0;
  for (let i = 0; i < 51; i++) {
    const digit = Math.floor(mantissa);
    mantissa = (mantissa - digit) * 4;
    remainder = remainder * 4 + digit;
    const trial = 4 * root + 1;
    root *= 2;
    if (remainder >= trial) {
      remainder -= trial;
      root += 1;
    }
  }
  const base = 67108864;
  let high = Math.floor(remainder / base);
  let low = remainder - high * base;
  for (let i = 0; i < 2; i++) {
    // A normalized binary64 mantissa has no digits left after 51 steps.
    low *= 4;
    const carry = Math.floor(low / base);
    low -= carry * base;
    high = high * 4 + carry;
    const rootHigh = Math.floor(root / base);
    const trial = 4 * (root - rootHigh * base) + 1;
    const trialCarry = Math.floor(trial / base);
    const trialHigh = 4 * rootHigh + trialCarry;
    const trialLow = trial - trialCarry * base;
    root *= 2;
    if (high > trialHigh || (high === trialHigh && low >= trialLow)) {
      high -= trialHigh;
      low -= trialLow;
      if (low < 0) {
        low += base;
        high -= 1;
      }
      root += 1;
    }
  }
  // The radicand is an integer at this scale. Its rounding threshold is
  // (root + 1/2)^2, so remainder > root suffices and the tie is unreachable.
  const rootHigh = Math.floor(root / base);
  if (high > rootHigh || (high === rootHigh && low > root - rootHigh * base)) root += 1;
  return (root * 2.220446049250313e-16) * scale;
}
