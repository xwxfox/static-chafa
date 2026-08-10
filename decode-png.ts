/* decode-png.ts
 *
 * Pure TypeScript PNG decoder with Bun FFI native defilter.
 * Uses bun:cc to compile a C defilter at runtime for near-native speed.
 * No external deps beyond node:zlib (for inflate).
 */

import { dlopen, FFIType, ptr } from "bun:ffi";
import sharp from "sharp";

export interface DecodeStats {
    parseMs: number;
    idatMs: number;
    inflateMs: number;
    defilterMs: number;
}

export interface RGBAImage {
    width: number;
    height: number;
    data: Uint8Array;
    stats: DecodeStats;
}

export interface GIFFrame {
    data: Uint8Array;
    delayMs: number;
    width: number;
    height: number;
    left: number;
    top: number;
    disposal: number;
}

const PNG_SIG = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);

function readU32BE(buf: Uint8Array, off: number): number {
    return (
        ((buf[off]! << 24) |
            (buf[off + 1]! << 16) |
            (buf[off + 2]! << 8) |
            buf[off + 3]!) >>>
        0
    );
}

const nativeDefilter = dlopen("defilter.so", {
    inflate_zlib: {
        args: [FFIType.ptr, FFIType.i32, FFIType.ptr, FFIType.i32],
        returns: FFIType.i32,
    },
    defilter: {
        args: [FFIType.ptr, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.ptr, FFIType.ptr],
        returns: FFIType.void,
    },
    defilter_rgb_to_rgba: {
        args: [FFIType.ptr, FFIType.i32, FFIType.i32, FFIType.ptr, FFIType.ptr],
        returns: FFIType.void,
    },
    decode_jpeg_to_rgba: {
        args: [FFIType.ptr, FFIType.i32, FFIType.ptr, FFIType.ptr, FFIType.ptr],
        returns: FFIType.i32,
    },
    decode_gif_frame: {
        args: [FFIType.ptr, FFIType.i32, FFIType.i32, FFIType.ptr, FFIType.i32],
        returns: FFIType.i32,
    },
    expand_palette_to_rgba: {
        args: [FFIType.ptr, FFIType.i32, FFIType.ptr, FFIType.i32, FFIType.ptr, FFIType.i32],
        returns: FFIType.void,
    },
});

const { inflate_zlib, defilter, defilter_rgb_to_rgba, decode_jpeg_to_rgba, decode_gif_frame, expand_palette_to_rgba } = nativeDefilter.symbols;

type Bufs = {
    compressed: Uint8Array;
    raw: Uint8Array;
    prev: Uint8Array;
    rgba: Uint8Array;
    width: number;
    height: number;
    channels: number;
};

let _pool: Bufs | null = null;

function getPool(width: number, height: number, channels: number, idatLen: number): Bufs {
    const scanline = width * channels;
    const rawLen = (scanline + 1) * height;
    const rgbaLen = width * height * 4;
    if (_pool && _pool.width === width && _pool.height === height && _pool.channels === channels) {
        if (_pool.compressed.length < idatLen) _pool.compressed = new Uint8Array(idatLen);
        if (_pool.raw.length < rawLen) _pool.raw = new Uint8Array(rawLen);
        return _pool;
    }
    _pool = {
        compressed: new Uint8Array(idatLen),
        raw: new Uint8Array(rawLen),
        prev: new Uint8Array(scanline),
        rgba: new Uint8Array(rgbaLen),
        width, height, channels,
    };
    return _pool;
}

export function decodePng(buf: Uint8Array): RGBAImage {
    let t0 = performance.now();

    for (let i = 0; i < 8; i++) {
        if (buf[i] !== PNG_SIG[i]!) throw new Error("Not a PNG");
    }

    let off = 8;
    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = 0;
    let interlace = 0;

    let palette: Uint8Array | null = null;
    let trns: Uint8Array | null = null;
    const idat: Uint8Array[] = [];
    let idatLen = 0;

    while (off + 12 <= buf.length) {
        const len = readU32BE(buf, off);
        const typeOff = off + 4;
        const dataOff = off + 8;
        const next = dataOff + len + 4;
        if (next > buf.length) throw new Error("Corrupt PNG");

        const t0 = buf[typeOff]!;
        const t1 = buf[typeOff + 1]!;
        const t2 = buf[typeOff + 2]!;
        const t3 = buf[typeOff + 3]!;

        if (t0 === 0x49 && t1 === 0x48 && t2 === 0x44 && t3 === 0x52) {
            width = readU32BE(buf, dataOff);
            height = readU32BE(buf, dataOff + 4);
            bitDepth = buf[dataOff + 8]!;
            colorType = buf[dataOff + 9]!;
            const compression = buf[dataOff + 10]!;
            const filter = buf[dataOff + 11]!;
            interlace = buf[dataOff + 12]!;
            if (compression !== 0) throw new Error("Unsupported PNG compression");
            if (filter !== 0) throw new Error("Unsupported PNG filter method");
            if (interlace !== 0) throw new Error("Interlaced PNG not supported");
            if (bitDepth !== 8) throw new Error(`Unsupported PNG bit depth: ${bitDepth}`);
        } else if (t0 === 0x50 && t1 === 0x4c && t2 === 0x54 && t3 === 0x45) {
            palette = buf.subarray(dataOff, dataOff + len);
        } else if (t0 === 0x74 && t1 === 0x52 && t2 === 0x4e && t3 === 0x53) {
            trns = buf.subarray(dataOff, dataOff + len);
        } else if (t0 === 0x49 && t1 === 0x44 && t2 === 0x41 && t3 === 0x54) {
            const c = buf.subarray(dataOff, dataOff + len);
            idat.push(c);
            idatLen += c.length;
        } else if (t0 === 0x49 && t1 === 0x45 && t2 === 0x4e && t3 === 0x44) {
            break;
        }

        off = next;
    }

    let t1 = performance.now();

    if (!width || !height) throw new Error("Missing IHDR");
    if (idatLen === 0) throw new Error("Missing IDAT");

    let channels = 0;
    switch (colorType) {
        case 0: channels = 1; break;
        case 2: channels = 3; break;
        case 3: channels = 1; break;
        case 4: channels = 2; break;
        case 6: channels = 4; break;
        default: throw new Error(`Unsupported PNG color type: ${colorType}`);
    }

    const pool = getPool(width, height, channels, idatLen);
    const compressed = pool.compressed;
    for (let i = 0, p = 0; i < idat.length; i++) {
        compressed.set(idat[i]!, p);
        p += idat[i]!.length;
    }

    let t2 = performance.now();

    const scanline = width * channels;
    const stride = scanline + 1;
    const expectedLen = stride * height;

    const raw = pool.raw;
    const actualLen = inflate_zlib(ptr(compressed), idatLen, ptr(raw), expectedLen);
    if (actualLen !== expectedLen) throw new Error(`Unexpected PNG inflate size: ${actualLen} vs ${expectedLen}`);

    let t3 = performance.now();

    const rgba = pool.rgba;

    if (colorType === 2) {
        defilter_rgb_to_rgba(ptr(raw), width, height, ptr(pool.prev), ptr(rgba));
        let t4 = performance.now();
        return { width, height, data: rgba, stats: { parseMs: t1 - t0, idatMs: t2 - t1, inflateMs: t3 - t2, defilterMs: t4 - t3 } };
    }

    if (colorType === 6) {
        defilter(ptr(raw), channels, scanline, stride, height, ptr(pool.prev), ptr(rgba));
        let t4 = performance.now();
        return { width, height, data: rgba, stats: { parseMs: t1 - t0, idatMs: t2 - t1, inflateMs: t3 - t2, defilterMs: t4 - t3 } };
    }

    const unpacked = new Uint8Array(scanline * height);
    defilter(ptr(raw), channels, scanline, stride, height, ptr(pool.prev), ptr(unpacked));

    let t4 = performance.now();

    const totalBytes = width * height * 4;

    if (colorType === 0) {
        for (let i = 3; i < totalBytes; i += 4) rgba[i] = 255;
        for (let s = 0, d = 0; s < unpacked.length; s++, d += 4) {
            const v = unpacked[s]!;
            rgba[d] = v;
            rgba[d + 1] = v;
            rgba[d + 2] = v;
        }
    } else if (colorType === 4) {
        for (let s = 0, d = 0; s < unpacked.length; s += 2, d += 4) {
            const v = unpacked[s]!;
            rgba[d] = v;
            rgba[d + 1] = v;
            rgba[d + 2] = v;
            rgba[d + 3] = unpacked[s + 1]!;
        }
    } else if (colorType === 3) {
        if (!palette) throw new Error("Indexed PNG missing PLTE");
        for (let i = 3; i < totalBytes; i += 4) rgba[i] = 255;
        for (let s = 0, d = 0; s < unpacked.length; s++, d += 4) {
            const idx = unpacked[s]!;
            const pOff = idx * 3;
            rgba[d] = palette[pOff]!;
            rgba[d + 1] = palette[pOff + 1]!;
            rgba[d + 2] = palette[pOff + 2]!;
            if (trns && idx < trns.length) rgba[d + 3] = trns[idx]!;
        }
    }

    return { width, height, data: rgba, stats: { parseMs: t1 - t0, idatMs: t2 - t1, inflateMs: t3 - t2, defilterMs: t4 - t3 } };
}

let _jpegBuf: Uint8Array | null = null;

export function decodeJpeg(buf: Uint8Array): RGBAImage {
    let t0 = performance.now();
    const dims = new Int32Array(2);
    const wView = new Int32Array(dims.buffer, dims.byteOffset, 1);
    const hView = new Int32Array(dims.buffer, dims.byteOffset + 4, 1);
    let t1 = performance.now();

    if (!_jpegBuf) _jpegBuf = new Uint8Array(4 * 4096 * 4096);
    decode_jpeg_to_rgba(ptr(buf), buf.length, ptr(_jpegBuf), ptr(wView), ptr(hView));
    let t2 = performance.now();

    const width = dims[0]!;
    const height = dims[1]!;
    const size = width * height * 4;
    const rgba = new Uint8Array(size);
    rgba.set(_jpegBuf.subarray(0, size));

    return {
        width,
        height,
        data: rgba,
        stats: { parseMs: t1 - t0, idatMs: 0, inflateMs: t2 - t1, defilterMs: 0 },
    };
}

export interface GIFResult {
    width: number;
    height: number;
    frames: GIFFrame[];
    loopCount: number;
    stats: DecodeStats;
}

export async function decodeGif(buf: Uint8Array, maxFrames?: number): Promise<GIFResult> {
    let t0 = performance.now();

    const meta = await sharp(buf, { animated: true }).metadata();
    const width = meta.width!;
    const height = meta.pageHeight!;
    const frameCount = maxFrames ? Math.min(meta.pages!, maxFrames) : meta.pages!;
    const delays: number[] = (meta.delay as number[]) || [];
    const loopCount = meta.loop || 0;
    let tParse = performance.now();

    const frames: GIFFrame[] = [];
    let totalDecode = 0;

    for (let i = 0; i < frameCount; i++) {
        let tDecode = performance.now();
        const { data, info } = await sharp(buf, { page: i }).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
        totalDecode += performance.now() - tDecode;

        const delayMs = (delays[i] ?? 10) * 10;

        frames.push({
            data: new Uint8Array(data),
            delayMs,
            width: info.width,
            height: info.height,
            left: 0,
            top: 0,
            disposal: 0,
        });
    }

    return {
        width,
        height,
        frames,
        loopCount,
        stats: {
            parseMs: tParse - t0,
            idatMs: 0,
            inflateMs: totalDecode,
            defilterMs: 0,
        },
    };
}

