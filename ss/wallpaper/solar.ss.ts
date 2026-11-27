import { clamp } from "./color.ss.ts";
import { mod } from "./types.ss.ts";

export function civilEdge(bucket: number): number {
  switch (bucket) {
    case 1: return 16200;
    case 2: return 18000;
    case 3: return 19800;
    case 4: return 21600;
    case 5: return 25200;
    case 6: return 32400;
    case 7: return 39600;
    case 8: return 46800;
    case 9: return 54000;
    case 10: return 61200;
    case 11: return 66600;
    case 12: return 68400;
    case 13: return 70200;
    case 14: return 72000;
    case 15: return 77400;
    case 16: return 86400;
    default: return 0;
  }
}

function cosine(turn: number): number {
  const x = mod(turn + .5, 1) - .5;
  const angle = x * 6.283185307179586;
  const s = angle * angle;
  return 1 + s * (-.5 + s * (.041666666666666664 + s * (-.001388888888888889
    + s * (.0000248015873015873 + s * (-.0000002755731922398589 + s * .00000000208767569878681)))));
}

function geoBucket(unix: number, latitude: number, longitude: number): number {
  const day = unix / 86400;
  const year = (day - 10) / 365.2422;
  const declination = -23.44 * cosine(year) / 360;
  const anomaly = (day - 81) / 365.2422;
  const equationMin = 9.87 * cosine(.25 - 2 * anomaly) - 7.53 * cosine(anomaly) - 1.5 * cosine(.25 - anomaly);
  const hourAngle = mod(day + longitude / 360 + equationMin / 1440, 1) - .5;
  const lat = latitude / 360;
  const altitudeSine = clamp(cosine(.25 - lat) * cosine(.25 - declination)
    + cosine(lat) * cosine(declination) * cosine(hourAngle), -1, 1);
  let band = 0;
  if (altitudeSine >= -.3090169943749474) band = 1;
  if (altitudeSine >= -.2079116908177593) band = 2;
  if (altitudeSine >= -.1045284632676535) band = 3;
  if (altitudeSine >= 0) band = 4;
  if (altitudeSine >= .1045284632676535) band = 5;
  if (altitudeSine >= .3420201433256687) band = 6;
  if (altitudeSine >= .6427876096865393) band = 7;
  return hourAngle < 0 ? band : 15 - band;
}

export function solarBucket(unix: number, source: number, offsetMinutes: number, lat: number, lon: number, fixed: number): number {
  if (source === 2) return fixed;
  if (source === 1) return geoBucket(unix, lat, lon);
  const local = mod(unix + offsetMinutes * 60, 86400);
  for (let i = 1; i < 16; i++) if (local < civilEdge(i)) return i - 1;
  return 15;
}

export function nextSolarBoundary(unix: number, source: number, offsetMinutes: number, lat: number, lon: number, fixed: number): number {
  if (source === 2) return -1;
  const bucket = solarBucket(unix, source, offsetMinutes, lat, lon, fixed);
  if (source === 0) return unix + civilEdge(bucket + 1) - mod(unix + offsetMinutes * 60, 86400);
  let low = unix;
  for (let i = 1; i < 313; i++) {
    let high = unix + i * 300;
    if (geoBucket(high, lat, lon) !== bucket) {
      for (let step = 0; step < 10; step++) {
        if (high - low <= 1) break;
        const pivot = Math.floor((low + high) / 2);
        if (geoBucket(pivot, lat, lon) === bucket) low = pivot;
        else high = pivot;
      }
      return high;
    }
    low = high;
  }
  return -1;
}

export function daylight(bucket: number): number {
  return (7.5 - Math.abs(bucket - 7.5)) / 7;
}
