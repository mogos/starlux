import { linearPsnr, linearSsim, pngCapacity, pngDecode, pngEncode, qoiDecode, qoiEncode, packRgb10, reconstructR8, vp8Rgb } from "../../ss/wallpaper/index.ss.ts";

export const wallpaperCodecMatrix = [
  { tag: 0, name: "slwp-r", tier: "L0", implementation: "starscript", fidelity: "recipe" },
  { tag: 1, name: "QOI", tier: "L1", implementation: "starscript", fidelity: "RGBA8" },
  { tag: 2, name: "SLPNG1", tier: "L1", implementation: "starscript", fidelity: "RGBA8" },
  { tag: 3, name: "WebP VP8L", tier: "L1", implementation: "host-verified", fidelity: "RGBA8" },
  { tag: 4, name: "WebP VP8", tier: "M1", implementation: "host", fidelity: "sRGB 8-bit 4:2:0" },
  { tag: 5, name: "AVIF", tier: "M1", implementation: "host", fidelity: "sRGB 8-bit GBR" },
  { tag: 6, name: "AVIF P3", tier: "M1", implementation: "host", fidelity: "Display P3 RGB10A2LE" },
  { tag: 7, name: "SWRQ", tier: "M1", implementation: "starscript", fidelity: "quantized RGB residual" },
  { tag: 8, maskTag: 9, name: "AV1 intra + delta R8", tier: "M2", implementation: "host + starscript", fidelity: "opaque poster + emissive R8" },
] as const;

export async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const losslessWebPArgs = ["-lossless", "-exact", "-z", "9", "-metadata", "none"] as const;

export interface ExactWebPPort {
  encode(rgba: Uint8Array<ArrayBuffer>, width: number, height: number, args: readonly string[]): Promise<Uint8Array<ArrayBuffer>>;
  decode(bitstream: Uint8Array<ArrayBuffer>, width: number, height: number): Promise<Uint8Array<ArrayBuffer>>;
}

function validDigest(digest: string): boolean { return /^[0-9a-f]{64}$/.test(digest); }

export function exactWebPHeader(bytes: Uint8Array, width: number, height: number): boolean {
  if (bytes.length < 26 || !Number.isInteger(width) || !Number.isInteger(height)
    || width < 1 || height < 1 || width > 16384 || height > 16384) return false;
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (data.getUint32(0) !== 0x52494646 || data.getUint32(4, true) !== bytes.length - 8
    || data.getUint32(8) !== 0x57454250 || data.getUint32(12) !== 0x5650384c || bytes[20] !== 0x2f) return false;
  const count = data.getUint32(16, true);
  if (count < 5 || 20 + count + count % 2 !== bytes.length || (count % 2 === 1 && bytes[bytes.length - 1] !== 0)) return false;
  const dims = data.getUint32(21, true);
  return dims >>> 29 === 0 && (dims & 16383) + 1 === width && ((dims >>> 14) & 16383) + 1 === height;
}

export async function verifyLosslessWebP(
  encoded: Uint8Array<ArrayBuffer>, width: number, height: number, expectedPixelSha256: string, port: Pick<ExactWebPPort, "decode">,
): Promise<Uint8Array<ArrayBuffer>> {
  if (!validDigest(expectedPixelSha256) || !exactWebPHeader(encoded, width, height)) throw new Error("Invalid VP8L descriptor or header");
  const decoded = await port.decode(encoded, width, height);
  if (decoded.length !== 4 * width * height || await sha256(decoded) !== expectedPixelSha256) {
    throw new Error("VP8L decoded pixel SHA-256 mismatch");
  }
  return decoded;
}

export async function bakeExactWebP(
  rgba: Uint8Array<ArrayBuffer>, width: number, height: number, pinnedPixelSha256: string, port: ExactWebPPort,
): Promise<Uint8Array<ArrayBuffer>> {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 16384 || height > 16384
    || rgba.length !== width * height * 4 || !validDigest(pinnedPixelSha256) || await sha256(rgba) !== pinnedPixelSha256) {
    throw new Error("Invalid WebP master or pinned pixel SHA-256");
  }
  const encoded = await port.encode(rgba, width, height, losslessWebPArgs);
  await verifyLosslessWebP(encoded, width, height, pinnedPixelSha256, port);
  return encoded;
}

export function encodeWallpaperLossless(
  format: "qoi" | "slpng1", rgba: Uint8Array, width: number, height: number,
): Uint8Array<ArrayBuffer> {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 1048576
    || rgba.length !== width * height * 4) throw new RangeError("Invalid lossless raster extent");
  const source = Array.from(rgba);
  const capacity = format === "qoi" ? width * height * 5 + 22 : pngCapacity(width, height);
  const encoded = new Array<number>(capacity).fill(0);
  const count = format === "qoi" ? qoiEncode(source, width, height, encoded, new Array<number>(64).fill(0))
    : pngEncode(source, width, height, encoded);
  if (count < 0) throw new RangeError(`Wallpaper encoder rejected input (${count})`);
  encoded.length = count;
  return Uint8Array.from(encoded);
}

export function decodeWallpaperLossless(
  format: "qoi" | "slpng1", bytes: Uint8Array,
): { width: number; height: number; rgba: Uint8Array<ArrayBuffer> } {
  const at = format === "qoi" ? 4 : 16;
  if (bytes.length < at + 8) throw new RangeError("Truncated lossless raster");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(at), height = view.getUint32(at + 4);
  if (width < 1 || height < 1 || width > 16384 || height > 16384 || width * height > 1048576) throw new RangeError("Invalid lossless raster extent");
  const source = Array.from(bytes);
  const output = new Array<number>(width * height * 4).fill(0);
  const count = format === "qoi" ? qoiDecode(source, output, new Array<number>(64).fill(0)) : pngDecode(source, output);
  if (count !== output.length) throw new Error("Corrupt wallpaper raster");
  return { width, height, rgba: Uint8Array.from(output) };
}

export type WallpaperTile = {
  readonly x: number; readonly y: number; readonly width: number; readonly height: number;
  readonly codec: 4 | 5 | 6 | 7 | 8;
  readonly bytes: number;
  readonly sha256: string;
};
export type WallpaperLod = {
  readonly width: number; readonly height: number;
  readonly tiles: readonly WallpaperTile[];
  readonly overheadBytes: number;
};
export type WallpaperPyramid = readonly [WallpaperLod, WallpaperLod, WallpaperLod];

export function validWallpaperPyramid(pyramid: WallpaperPyramid): boolean {
  if (pyramid.length !== 3) return false;
  const sizes = [[854, 480], [1920, 1080], [3840, 2160]];
  return pyramid.every((lod, level) => {
    const size = sizes[level]!;
    const portrait = lod.width < lod.height;
    if (lod.width !== size[portrait ? 1 : 0] || lod.height !== size[portrait ? 0 : 1]
      || !Number.isSafeInteger(lod.overheadBytes) || lod.overheadBytes < 0) return false;
    if (lod.tiles.length !== (level === 2 ? 4 : 1)) return false;
    let bytes = lod.overheadBytes;
    for (const [index, tile] of lod.tiles.entries()) {
      const w = level === 2 ? lod.width / 2 : lod.width;
      const h = level === 2 ? lod.height / 2 : lod.height;
      if (tile.width !== w || tile.height !== h || tile.x !== index % 2 * w
        || tile.y !== Math.floor(index / 2) * h
        || !Number.isInteger(tile.codec) || tile.codec < 4 || tile.codec > 8 || !validDigest(tile.sha256)
        || !Number.isSafeInteger(tile.bytes) || tile.bytes <= 0 || level === 2 && tile.bytes > 112_000) return false;
      bytes += tile.bytes;
    }
    return level === 0 ? bytes < 24_000 : level === 1 ? bytes < 200_000 : bytes <= 448_000;
  });
}

export type TemporalWallpaperMask = {
  readonly key: number; readonly anchor: 0 | 45; readonly codec: "av1-mono-intra";
  readonly bytes: number; readonly sha256: string;
};
export type TemporalWallpaperPlate = {
  readonly poster: WallpaperTile;
  readonly width: number; readonly height: number;
  readonly fps: 15; readonly periodUs: 6000000;
  readonly masks: readonly TemporalWallpaperMask[];
  readonly maskOverheadBytes: number;
};

export function validTemporalPlate(plate: TemporalWallpaperPlate): boolean {
  const { width, height, poster, masks } = plate;
  if (poster.codec !== 8 || poster.x !== 0 || poster.y !== 0 || poster.width !== width * 4 || poster.height !== height * 4
    || !Number.isSafeInteger(poster.bytes) || poster.bytes <= 0 || poster.bytes >= 200_000 || !validDigest(poster.sha256)
    || !Number.isInteger(width) || !Number.isInteger(height) || width < 1 || width > 480 || height < 1 || height > 270
    || plate.fps !== 15 || plate.periodUs !== 6000000 || masks.length !== 6
    || !Number.isSafeInteger(plate.maskOverheadBytes) || plate.maskOverheadBytes < 0
    || width * height * masks.length > 1_036_800) return false;
  let bytes = plate.maskOverheadBytes;
  for (const [i, mask] of masks.entries()) {
    if (mask.codec !== "av1-mono-intra" || mask.key !== i * 15 || mask.anchor !== (i < 3 ? 0 : 45)
      || !Number.isSafeInteger(mask.bytes) || mask.bytes <= 0 || !validDigest(mask.sha256)) return false;
    bytes += mask.bytes;
  }
  return bytes <= 32_000;
}

export function passesWallpaperQuality(reference: Uint8Array, candidate: Uint8Array, width: number, height: number): boolean {
  const master = Array.from(reference), decoded = Array.from(candidate);
  return linearPsnr(master, decoded) >= 38 && linearSsim(master, decoded, width, height) >= .96;
}

export class WallpaperAssetBudget {
  readonly #assets = new Map<object, { bytes: number; encoded: boolean }>();
  #decoded = 0;
  #encoded = 0;
  constructor(readonly ceilingBytes = 48 * 1024 * 1024) {
    if (!Number.isSafeInteger(ceilingBytes) || ceilingBytes <= 0 || ceilingBytes > 96_000_000) throw new RangeError("Invalid wallpaper memory cap");
  }

  get decodedBytes(): number { return this.#decoded; }
  get encodedBytes(): number { return this.#encoded; }

  reserve(identity: object, bytes: number, encoded = false): boolean {
    if (!Number.isSafeInteger(bytes) || bytes <= 0) return false;
    const existing = this.#assets.get(identity);
    if (existing) return existing.bytes === bytes && existing.encoded === encoded;
    if (encoded ? this.#encoded + bytes > 1_200_000 : bytes > 36_000_000 || this.#decoded + bytes > this.ceilingBytes) return false;
    this.#assets.set(identity, { bytes, encoded });
    if (encoded) this.#encoded += bytes;
    else this.#decoded += bytes;
    return true;
  }

  release(identity: object): void {
    const asset = this.#assets.get(identity);
    if (!asset) return;
    this.#assets.delete(identity);
    if (asset.encoded) this.#encoded -= asset.bytes;
    else this.#decoded -= asset.bytes;
  }
}

export async function verifyWallpaperTile(tile: WallpaperTile, payload: Uint8Array<ArrayBuffer>): Promise<boolean> {
  return payload.byteLength === tile.bytes && validDigest(tile.sha256) && await sha256(payload) === tile.sha256;
}

/** Planes supplied by the host decoder after inspecting the coded profile. */
export type WallpaperPlaneSnapshot = {
  readonly width: number; readonly height: number;
  readonly y: Uint8Array | Uint16Array; readonly cb: Uint8Array | Uint16Array; readonly cr: Uint8Array | Uint16Array;
  readonly bitDepth: 8 | 10; readonly sampling: "420" | "444";
  readonly primaries: 1 | 12; readonly transfer: 13; readonly matrix: 0 | 6;
  readonly fullRange: boolean; readonly intra: boolean;
};

export function normalizeWallpaperPlanes(tile: WallpaperTile, planes: WallpaperPlaneSnapshot): Uint8Array<ArrayBuffer> {
  const { width, height, y, cb, cr } = planes;
  const pixels = width * height;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1
    || Math.max(width, height) > 1920 || Math.min(width, height) > 1080
    || tile.width !== width || tile.height !== height || y.length !== pixels
    || !planes.intra || planes.transfer !== 13) throw new RangeError("Invalid wallpaper plane snapshot");
  const vp8 = tile.codec === 4;
  const p3 = tile.codec === 6 || tile.codec === 8 && planes.primaries === 12;
  const chromaWidth = vp8 ? Math.ceil(width / 2) : width;
  const chromaHeight = vp8 ? Math.ceil(height / 2) : height;
  if (cb.length !== chromaWidth * chromaHeight || cr.length !== cb.length
    || ![4, 5, 6, 8].includes(tile.codec)
    || planes.sampling !== (vp8 ? "420" : "444") || planes.matrix !== (vp8 ? 6 : 0)
    || planes.fullRange === vp8 || planes.primaries !== (p3 ? 12 : 1) || planes.bitDepth !== (p3 ? 10 : 8)
    || (p3 ? !(y instanceof Uint16Array && cb instanceof Uint16Array && cr instanceof Uint16Array)
      : !(y instanceof Uint8Array && cb instanceof Uint8Array && cr instanceof Uint8Array))) {
    throw new RangeError("Unsupported wallpaper plane profile");
  }
  const bytes = new Uint8Array(pixels * 4);
  const packed = new DataView(bytes.buffer);
  for (let i = 0; i < pixels; i++) {
    const at = i * 4;
    if (vp8) {
      const chroma = Math.floor(i / width / 2) * chromaWidth + Math.floor(i % width / 2);
      for (let c = 0; c < 3; c++) bytes[at + c] = vp8Rgb(y[i]!, cb[chroma]!, cr[chroma]!, c);
      bytes[at + 3] = 255;
    } else if (p3) {
      const r = cr[i]!, g = y[i]!, b = cb[i]!;
      if (Math.max(r, g, b) > 1023) throw new RangeError("Invalid 10-bit wallpaper plane sample");
      packed.setUint32(at, packRgb10(r, g, b), true);
    } else {
      bytes[at] = cr[i]!; bytes[at + 1] = y[i]!; bytes[at + 2] = cb[i]!; bytes[at + 3] = 255;
    }
  }
  return bytes;
}

export interface TemporalMaskDecoder {
  decodeMonoIntra(payload: Uint8Array<ArrayBuffer>, width: number, height: number): Promise<{
    readonly width: number; readonly height: number; readonly intra: boolean; readonly fullRange: boolean;
    readonly bitDepth: number; readonly monochrome: boolean; readonly y: Uint8Array<ArrayBuffer>;
  }>;
}

export async function decodeTemporalMasks(
  plate: TemporalWallpaperPlate, payloads: readonly Uint8Array<ArrayBuffer>[], decoder: TemporalMaskDecoder,
): Promise<readonly Uint8Array<ArrayBuffer>[]> {
  if (!validTemporalPlate(plate) || payloads.length !== plate.masks.length) throw new Error("Invalid temporal wallpaper descriptor");
  const count = plate.width * plate.height;
  const masks: Uint8Array<ArrayBuffer>[] = [];
  for (const [i, descriptor] of plate.masks.entries()) {
    const payload = payloads[i]!;
    if (payload.length !== descriptor.bytes || await sha256(payload) !== descriptor.sha256) {
      throw new Error("Temporal mask SHA-256 mismatch");
    }
    const sample = await decoder.decodeMonoIntra(payload, plate.width, plate.height);
    if (sample.width !== plate.width || sample.height !== plate.height || sample.y.length !== count
      || !sample.intra || !sample.fullRange || !sample.monochrome || sample.bitDepth !== 8) {
      throw new Error("Unsupported AV1 temporal mask profile");
    }
    const decoded = sample.y.slice();
    if (descriptor.key !== descriptor.anchor) {
      const key = masks[descriptor.anchor / 15]!;
      for (let pixel = 0; pixel < count; pixel++) decoded[pixel] = reconstructR8(decoded[pixel]!, key[pixel]!);
    }
    masks.push(decoded);
  }
  return masks;
}
