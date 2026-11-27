import { mod } from "./types.ss.ts";

export function clamp(value: number, low: number, high: number): number {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

export function roundEven(value: number): number {
  const lower = Math.floor(value);
  const fraction = value - lower;
  if (fraction > .5 || (fraction === .5 && mod(lower, 2) !== 0)) return lower + 1;
  return lower;
}

export function q16(value: number): number { return roundEven(clamp(value, 0, 1) * 65535); }

export function luminance(r: number, g: number, b: number): number {
  return .2126 * r + .7152 * g + .0722 * b;
}

export function mix(a: number, b: number, t: number): number { return a + (b - a) * t; }

export function smooth(t: number): number { return t * t * (3 - 2 * t); }

export function amberSurface(r: number, g: number, b: number): boolean {
  const hi = Math.max(r, Math.max(g, b));
  const lo = Math.min(r, Math.min(g, b));
  const chroma = hi - lo;
  const lightness = (hi + lo) / 2;
  if (chroma < .22 || lightness < .25 || lightness > .78 || hi !== r) return false;
  const hue = (g - b) * 60 / chroma;
  return hue >= 10 && hue <= 55 && chroma / (1 - Math.abs(2 * lightness - 1)) >= .35;
}

export function contrastRatio(ink: number, backing: number): number {
  return (Math.max(ink, backing) + .05) / (Math.min(ink, backing) + .05);
}

// Generated from the IEC sRGB EOTF, rounded to linear UNORM16.
export function srgbLinear16(code: number): number {
  switch (code) {
    case 0: return 0;
    case 1: return 20;
    case 2: return 40;
    case 3: return 60;
    case 4: return 80;
    case 5: return 99;
    case 6: return 119;
    case 7: return 139;
    case 8: return 159;
    case 9: return 179;
    case 10: return 199;
    case 11: return 219;
    case 12: return 241;
    case 13: return 264;
    case 14: return 288;
    case 15: return 313;
    case 16: return 340;
    case 17: return 367;
    case 18: return 396;
    case 19: return 427;
    case 20: return 458;
    case 21: return 491;
    case 22: return 526;
    case 23: return 562;
    case 24: return 599;
    case 25: return 637;
    case 26: return 677;
    case 27: return 718;
    case 28: return 761;
    case 29: return 805;
    case 30: return 851;
    case 31: return 898;
    case 32: return 947;
    case 33: return 997;
    case 34: return 1048;
    case 35: return 1101;
    case 36: return 1156;
    case 37: return 1212;
    case 38: return 1270;
    case 39: return 1330;
    case 40: return 1391;
    case 41: return 1453;
    case 42: return 1517;
    case 43: return 1583;
    case 44: return 1651;
    case 45: return 1720;
    case 46: return 1790;
    case 47: return 1863;
    case 48: return 1937;
    case 49: return 2013;
    case 50: return 2090;
    case 51: return 2170;
    case 52: return 2250;
    case 53: return 2333;
    case 54: return 2418;
    case 55: return 2504;
    case 56: return 2592;
    case 57: return 2681;
    case 58: return 2773;
    case 59: return 2866;
    case 60: return 2961;
    case 61: return 3058;
    case 62: return 3157;
    case 63: return 3258;
    case 64: return 3360;
    case 65: return 3464;
    case 66: return 3570;
    case 67: return 3678;
    case 68: return 3788;
    case 69: return 3900;
    case 70: return 4014;
    case 71: return 4129;
    case 72: return 4247;
    case 73: return 4366;
    case 74: return 4488;
    case 75: return 4611;
    case 76: return 4736;
    case 77: return 4864;
    case 78: return 4993;
    case 79: return 5124;
    case 80: return 5257;
    case 81: return 5392;
    case 82: return 5530;
    case 83: return 5669;
    case 84: return 5810;
    case 85: return 5953;
    case 86: return 6099;
    case 87: return 6246;
    case 88: return 6395;
    case 89: return 6547;
    case 90: return 6700;
    case 91: return 6856;
    case 92: return 7014;
    case 93: return 7174;
    case 94: return 7335;
    case 95: return 7500;
    case 96: return 7666;
    case 97: return 7834;
    case 98: return 8004;
    case 99: return 8177;
    case 100: return 8352;
    case 101: return 8528;
    case 102: return 8708;
    case 103: return 8889;
    case 104: return 9072;
    case 105: return 9258;
    case 106: return 9445;
    case 107: return 9635;
    case 108: return 9828;
    case 109: return 10022;
    case 110: return 10219;
    case 111: return 10417;
    case 112: return 10619;
    case 113: return 10822;
    case 114: return 11028;
    case 115: return 11235;
    case 116: return 11446;
    case 117: return 11658;
    case 118: return 11873;
    case 119: return 12090;
    case 120: return 12309;
    case 121: return 12530;
    case 122: return 12754;
    case 123: return 12980;
    case 124: return 13209;
    case 125: return 13440;
    case 126: return 13673;
    case 127: return 13909;
    case 128: return 14146;
    case 129: return 14387;
    case 130: return 14629;
    case 131: return 14874;
    case 132: return 15122;
    case 133: return 15371;
    case 134: return 15623;
    case 135: return 15878;
    case 136: return 16135;
    case 137: return 16394;
    case 138: return 16656;
    case 139: return 16920;
    case 140: return 17187;
    case 141: return 17456;
    case 142: return 17727;
    case 143: return 18001;
    case 144: return 18277;
    case 145: return 18556;
    case 146: return 18837;
    case 147: return 19121;
    case 148: return 19407;
    case 149: return 19696;
    case 150: return 19987;
    case 151: return 20281;
    case 152: return 20577;
    case 153: return 20876;
    case 154: return 21177;
    case 155: return 21481;
    case 156: return 21787;
    case 157: return 22096;
    case 158: return 22407;
    case 159: return 22721;
    case 160: return 23038;
    case 161: return 23357;
    case 162: return 23678;
    case 163: return 24002;
    case 164: return 24329;
    case 165: return 24658;
    case 166: return 24990;
    case 167: return 25325;
    case 168: return 25662;
    case 169: return 26001;
    case 170: return 26344;
    case 171: return 26688;
    case 172: return 27036;
    case 173: return 27386;
    case 174: return 27739;
    case 175: return 28094;
    case 176: return 28452;
    case 177: return 28813;
    case 178: return 29176;
    case 179: return 29542;
    case 180: return 29911;
    case 181: return 30282;
    case 182: return 30656;
    case 183: return 31033;
    case 184: return 31412;
    case 185: return 31794;
    case 186: return 32179;
    case 187: return 32567;
    case 188: return 32957;
    case 189: return 33350;
    case 190: return 33745;
    case 191: return 34143;
    case 192: return 34544;
    case 193: return 34948;
    case 194: return 35355;
    case 195: return 35764;
    case 196: return 36176;
    case 197: return 36591;
    case 198: return 37008;
    case 199: return 37429;
    case 200: return 37852;
    case 201: return 38278;
    case 202: return 38706;
    case 203: return 39138;
    case 204: return 39572;
    case 205: return 40009;
    case 206: return 40449;
    case 207: return 40891;
    case 208: return 41337;
    case 209: return 41785;
    case 210: return 42236;
    case 211: return 42690;
    case 212: return 43147;
    case 213: return 43606;
    case 214: return 44069;
    case 215: return 44534;
    case 216: return 45002;
    case 217: return 45473;
    case 218: return 45947;
    case 219: return 46423;
    case 220: return 46903;
    case 221: return 47385;
    case 222: return 47871;
    case 223: return 48359;
    case 224: return 48850;
    case 225: return 49344;
    case 226: return 49841;
    case 227: return 50341;
    case 228: return 50844;
    case 229: return 51349;
    case 230: return 51858;
    case 231: return 52369;
    case 232: return 52884;
    case 233: return 53401;
    case 234: return 53921;
    case 235: return 54445;
    case 236: return 54971;
    case 237: return 55500;
    case 238: return 56032;
    case 239: return 56567;
    case 240: return 57105;
    case 241: return 57646;
    case 242: return 58190;
    case 243: return 58737;
    case 244: return 59287;
    case 245: return 59840;
    case 246: return 60396;
    case 247: return 60955;
    case 248: return 61517;
    case 249: return 62082;
    case 250: return 62650;
    case 251: return 63221;
    case 252: return 63795;
    case 253: return 64372;
    case 254: return 64952;
    case 255: return 65535;
    default: return 0;
  }
}

export function linearSrgb8(value: number): number {
  let lo = 0;
  let hi = 255;
  for (let i = 0; i < 8; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const threshold = (srgbLinear16(mid) + srgbLinear16(mid + 1)) / 2;
    if (value <= threshold) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

export function hexChannel(rgb: number, channel: number): number {
  if (channel === 0) return Math.floor(rgb / 65536);
  if (channel === 1) return mod(Math.floor(rgb / 256), 256);
  return mod(rgb, 256);
}

export function gamutChannel(r: number, g: number, b: number, channel: number, gamut: number): number {
  if (gamut === 1) {
    if (channel === 0) return (53910 * r + 11626 * g) / 65536;
    if (channel === 1) return (2176 * r + 63360 * g) / 65536;
    return (1120 * r + 4745 * g + 59671 * b) / 65536;
  }
  if (channel === 0) return r;
  if (channel === 1) return g;
  return b;
}
