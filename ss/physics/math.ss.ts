export function clamp(value: number, low: number, high: number): number {
  if (value < low) return low;
  if (value > high) return high;
  if (value >= low) return value;
  return low;
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function finiteBound(value: number, limit: number): number {
  if (value >= -limit && value <= limit) return value;
  if (value > limit) return limit;
  if (value < -limit) return -limit;
  return 0;
}

export function frameUs(dtUs: number): number {
  return Math.floor(clamp(dtUs, 0, 64000));
}

function sineOnQuadrant(x: number): number {
  const z = x * x;
  let p = -1 / 25852016738884976640000;
  p = 1 / 51090942171709440000 + z * p;
  p = -1 / 121645100408832000 + z * p;
  p = 1 / 355687428096000 + z * p;
  p = -1 / 1307674368000 + z * p;
  p = 1 / 6227020800 + z * p;
  p = -1 / 39916800 + z * p;
  p = 1 / 362880 + z * p;
  p = -1 / 5040 + z * p;
  p = 1 / 120 + z * p;
  p = -1 / 6 + z * p;
  return x + x * z * p;
}

function reduceAngle(angle: number): number {
  const x = finiteBound(angle, 1000000000);
  const turns = Math.floor(x / 6.283185307179586 + 0.5);
  // The high part times any in-range turn count is exactly representable.
  return (x - turns * 6.2831852436065673828125) - turns * 6.357301909411279e-8;
}

export function sin64(angle: number): number {
  let x = reduceAngle(angle);
  if (x > 1.5707963267948966) x = 3.141592653589793 - x;
  if (x < -1.5707963267948966) x = -3.141592653589793 - x;
  return sineOnQuadrant(x);
}

export function cos64(angle: number): number {
  return sin64(1.5707963267948966 - reduceAngle(angle));
}

function atanUnit(value: number): number {
  let x = value;
  let offset = 0;
  if (x > 0.41421356237309503) {
    x = (x - 1) / (x + 1);
    offset = 0.7853981633974483;
  }
  const z = x * x;
  let p = 0;
  for (let i = 0; i < 20; i++) {
    p = 1 / (41 - 2 * i) - z * p;
  }
  return offset + (x - x * z * p);
}

export function atan2_64(y: number, x: number): number {
  const a = Math.abs(finiteBound(x, 1.7976931348623157e308));
  const b = Math.abs(finiteBound(y, 1.7976931348623157e308));
  if (a === 0 && b === 0) return 0;
  let angle = 0;
  if (a >= b) angle = atanUnit(b / a);
  else angle = 1.5707963267948966 - atanUnit(a / b);
  if (x < 0) angle = 3.141592653589793 - angle;
  if (y < 0) return -angle;
  return angle;
}

export function exp64(value: number): number {
  const x = clamp(value, -746, 709.7827128933839);
  if (x < -745.1332191019411) return 0;
  const n = Math.floor(x / 0.6931471805599453 + 0.5);
  const r = (x - n * 0.6931471803691238) - n * 1.9082149292705877e-10;
  let p = 1;
  for (let i = 0; i < 17; i++) p = 1 + r * p / (17 - i);
  let remaining = Math.abs(n);
  let scale = 2;
  if (n < 0) scale = 0.5;
  // Build 2^n without squaring a scale that the result cannot use.
  // For the upper boundary, 2^1024 itself is not representable.
  if (n === 1024) {
    remaining = 1023;
    p *= 2;
  }
  for (let i = 0; i < 11; i++) {
    if (remaining === 0) break;
    const half = Math.floor(remaining / 2);
    if (remaining !== half * 2) p *= scale;
    remaining = half;
    if (remaining > 0) scale *= scale;
  }
  return p;
}

export function ln64(value: number): number {
  let x = clamp(value, 5e-324, 1.7976931348623157e308);
  let n = 0;
  for (let i = 0; i < 9; i++) {
    if (x >= 1.157920892373162e77) {
      x /= 1.157920892373162e77;
      n += 256;
    } else if (x < 8.636168555094445e-78) {
      x *= 1.157920892373162e77;
      n -= 256;
    } else {
      break;
    }
  }
  for (let i = 0; i < 257; i++) {
    if (x > 1.4142135623730951) {
      x *= 0.5;
      n += 1;
    } else if (x < 0.7071067811865476) {
      x *= 2;
      n -= 1;
    } else {
      break;
    }
  }
  const r = (x - 1) / (x + 1);
  const z = r * r;
  let p = 0;
  for (let i = 0; i < 12; i++) p = 1 / (23 - 2 * i) + z * p;
  return n * 0.6931471803691238 + (2 * r * p + n * 1.9082149292705877e-10);
}
