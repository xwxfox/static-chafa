// ffi.ts - Bun FFI bindings for codec.so (dev/test only)
import { dlopen, FFIType, ptr, CString } from "bun:ffi";
import type { CodecMetrics, ChafaConfig, ChafaConfigPartial, ChafaImageData } from "./types.ts";
import { defaultConfig } from "./types.ts";
export type { CodecMetrics, ChafaConfig, ChafaConfigPartial, ChafaImageData };
export {
    CanvasMode, PixelMode, DitherMode, ColorExtractor, ColorSpace, Passthrough,
    defaultConfig
} from "./types.ts";

const FMT_NAMES = ["PNG", "JPEG", "BMP", "GIF", "WebP"];
export { FMT_NAMES };

const lib = dlopen("codec.so", {
    codec_ctx_new: { args: [FFIType.ptr], returns: FFIType.ptr },
    codec_ctx_free: { args: [FFIType.ptr], returns: FFIType.void },
    codec_ctx_configure: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.void },
    codec_decode_into: { args: [FFIType.ptr, FFIType.i32, FFIType.ptr, FFIType.i32, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
    codec_render: { args: [FFIType.ptr, FFIType.ptr, FFIType.i32, FFIType.ptr, FFIType.ptr], returns: FFIType.ptr },
    codec_render_rgba: { args: [FFIType.ptr, FFIType.ptr, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.ptr], returns: FFIType.ptr },
    codec_render_matrix: { args: [FFIType.ptr, FFIType.ptr, FFIType.i32, FFIType.ptr, FFIType.ptr], returns: FFIType.ptr },
    codec_render_matrix_rgba: { args: [FFIType.ptr, FFIType.ptr, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.ptr], returns: FFIType.ptr },
    codec_anim_open: { args: [FFIType.ptr, FFIType.ptr, FFIType.i32, FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
    codec_anim_next: { args: [FFIType.ptr, FFIType.i32, FFIType.ptr], returns: FFIType.i32 },
    codec_anim_render_frame: { args: [FFIType.ptr, FFIType.i32, FFIType.i32, FFIType.ptr], returns: FFIType.ptr },
    codec_anim_rewind: { args: [FFIType.ptr, FFIType.i32], returns: FFIType.i32 },
    codec_anim_close: { args: [FFIType.ptr, FFIType.i32], returns: FFIType.void },
    codec_anim_abort: { args: [FFIType.ptr, FFIType.i32], returns: FFIType.void },
    codec_free: { args: [FFIType.ptr], returns: FFIType.void },
    codec_video_open: { args: [FFIType.ptr, FFIType.ptr, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
    codec_video_next: { args: [FFIType.ptr, FFIType.i32, FFIType.ptr, FFIType.i32, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
    codec_video_info: { args: [FFIType.ptr, FFIType.i32, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
    codec_video_seek: { args: [FFIType.ptr, FFIType.i32, FFIType.f64], returns: FFIType.i32 },
    codec_video_close: { args: [FFIType.ptr, FFIType.i32], returns: FFIType.void },
    codec_video_status: { args: [FFIType.ptr, FFIType.i32, FFIType.ptr], returns: FFIType.i32 },
    codec_video_error: { args: [], returns: FFIType.cstring },
});
const s = lib.symbols;

/* -- CodecConfig layout (must match codec.c byte-for-byte) --
   Layout: 22 fields (int32/float) + 2 × 128 byte char buffers
   Fields in order:
     i[0]  term_w          f[4]  work_factor      f[16] dither_intensity
     i[1]  term_h          i[5]  dither_mode       i[17] fg_only
     i[2]  cell_w          i[6]  canvas_mode       i[18] optimizations
     i[3]  cell_h          i[7]  preprocessing     i[19] passthrough
                           i[8]  color_extractor   i[20] max_frames
                           i[9]  color_space       f[21] speed
                           i[10] pixel_mode         :88  symbols[128]
                           i[11] bg_color           :216 fill_symbols[128]
                           i[12] fg_color           =344 bytes total
                           i[13] alpha_threshold
                           i[14] dither_grain_w
                           i[15] dither_grain_h
*/
const CONFIG_INTS = 22;   // 22 × 4 = 88 bytes of int32/float fields
const CONFIG_SIZE = CONFIG_INTS * 4 + 128 + 128; // 344 bytes

let _cfgBuf: Uint8Array | null = null;
let _metricsBuf: Uint8Array | null = null;
let _errBuf: Int32Array | null = null;

function errBuf(): Int32Array {
    if (!_errBuf) _errBuf = new Int32Array(1);
    _errBuf[0] = 0;
    return _errBuf;
}

function configBuf(): Uint8Array {
    if (!_cfgBuf || _cfgBuf.length < CONFIG_SIZE)
        _cfgBuf = new Uint8Array(CONFIG_SIZE);
    _cfgBuf.fill(0);
    return _cfgBuf;
}

function metricsBuf(): Uint8Array {
    if (!_metricsBuf || _metricsBuf.length < 80)
        _metricsBuf = new Uint8Array(80);
    _metricsBuf.fill(0);
    return _metricsBuf;
}

function configToNative(cfg: ChafaConfig): Uint8Array {
    const b = configBuf();
    const i = new Int32Array(b.buffer, b.byteOffset, CONFIG_INTS);
    const f = new Float32Array(b.buffer, b.byteOffset, CONFIG_INTS);

    i[0] = cfg.termW; i[1] = cfg.termH;
    i[2] = cfg.cellW; i[3] = cfg.cellH;
    f[4] = cfg.workFactor;
    i[5] = cfg.ditherMode; i[6] = cfg.canvasMode;
    i[7] = cfg.preprocessing; i[8] = cfg.colorExtractor;
    i[9] = cfg.colorSpace; i[10] = cfg.pixelMode;
    i[11] = cfg.bgColor; i[12] = cfg.fgColor;
    i[13] = cfg.alphaThreshold;
    i[14] = cfg.ditherGrainW; i[15] = cfg.ditherGrainH;
    f[16] = cfg.ditherIntensity;
    i[17] = cfg.fgOnly; i[18] = cfg.optimizations;
    i[19] = cfg.passthrough; i[20] = cfg.maxFrames;
    f[21] = cfg.speed;

    /* Write symbols string at byte offset 88, fillSymbols at 216 */
    const enc = new TextEncoder();
    const writeStr = (str: string | undefined, off: number) => {
        if (!str) { b[off] = 0; return; }
        const bytes = enc.encode(str);
        const n = Math.min(bytes.length, 127);
        for (let j = 0; j < n; j++) b[off + j] = bytes[j]!;
        b[off + n] = 0;
    };
    writeStr(cfg.symbols, 88);
    writeStr(cfg.fillSymbols, 216);

    return b;
}

function metricsFromNative(b: ArrayBuffer): CodecMetrics {
    const f = new Float32Array(b);
    const i = new Int32Array(b);
    return {
        parseMs: f[0]!, drawMs: f[1]!, buildMs: f[2]!, totalMs: f[3]!,
        imgW: i[4]!, imgH: i[5]!,
        canvasW: i[6]!, canvasH: i[7]!, canvasPw: i[8]!, canvasPh: i[9]!,
        frameCount: i[10]!, frameDelayMs: i[11]!,
        rgbaBytes: i[12]!,
        format: i[13]!, canvasMode: i[14]!, pixelMode: i[15]!, haveAlpha: i[16]!,
    };
}

/* ═════════════════════════════════════════════════════════════════════
   Public API (used by index.ts classes)
   ═════════════════════════════════════════════════════════════════════ */

export function createContext(cfg?: ChafaConfigPartial): number {
    const native = configToNative({ ...defaultConfig(), ...cfg });
    const ctxPtr = s.codec_ctx_new(ptr(native));
    if (!ctxPtr) throw new Error("Failed to create chafa context");
    return Number(ctxPtr);
}

export function destroyContext(ctx: number): void {
    if (!ctx) return;
    s.codec_ctx_free(ctx);
}

export function configureContext(ctx: number, cfg: ChafaConfigPartial): void {
    const d = defaultConfig();
    const merged: ChafaConfig = { ...d, ...cfg };
    s.codec_ctx_configure(ctx, ptr(configToNative(merged)));
}

export function decodeBuffer(data: Uint8Array): ChafaImageData {
    if (!data || data.length === 0) throw new Error("Empty buffer");
    const m = metricsBuf();
    const eb = errBuf();
    const wArr = new Int32Array(1), hArr = new Int32Array(1), strideArr = new Int32Array(1);

    /* Pre-allocate a large RGBA buffer (max 256MB) for FFI to write into */
    const MAX_RGBA = 256 * 1024 * 1024;
    const rgba = new Uint8Array(MAX_RGBA);

    const r = s.codec_decode_into(
        ptr(data), data.length,
        ptr(rgba), rgba.length,
        ptr(new Uint8Array(wArr.buffer)), ptr(new Uint8Array(hArr.buffer)),
        ptr(new Uint8Array(strideArr.buffer)), ptr(m), ptr(eb),
    );

    if (r !== 0 || eb[0] !== 0)
        throw new Error(`Decode failed (error ${eb[0]})`);

    const w = wArr[0]!, h = hArr[0]!, stride = strideArr[0]!;
    const size = h * stride;
    return { rgba: rgba.slice(0, size), width: w, height: h, stride, metrics: metricsFromNative(m.buffer) };
}

export function freeNative(ptr_val: number): void {
    s.codec_free(ptr_val);
}

export function render(ctx: number, data: Uint8Array): { ansi: string; metrics: CodecMetrics } {
    if (!data || data.length === 0) throw new Error("Empty buffer");
    const m = metricsBuf();
    const eb = errBuf();
    const resultPtr = s.codec_render(ctx, ptr(data), data.length, ptr(m), ptr(eb));
    if (!resultPtr) throw new Error("Render returned null");
    const ansi = new CString(resultPtr).toString();
    s.codec_free(resultPtr);
    if (eb[0] !== 0) throw new Error(`${ansi} (code ${eb[0]})`);
    return { ansi, metrics: metricsFromNative(m.buffer) };
}

export function renderRgba(ctx: number, rgba: Uint8Array, w: number, h: number): { ansi: string; metrics: CodecMetrics } {
    if (!rgba || rgba.length === 0) throw new Error("Empty RGBA buffer");
    const m = metricsBuf();
    const resultPtr = s.codec_render_rgba(ctx, ptr(rgba), w, h, w * 4, ptr(m));
    if (!resultPtr) throw new Error("Render returned null");
    const ansi = new CString(resultPtr).toString();
    s.codec_free(resultPtr);
    return { ansi, metrics: metricsFromNative(m.buffer) };
}

export function renderMatrix(ctx: number, data: Uint8Array): { matrix: string; metrics: CodecMetrics } {
    if (!data || data.length === 0) throw new Error("Empty buffer");
    const m = metricsBuf();
    const eb = errBuf();
    const resultPtr = s.codec_render_matrix(ctx, ptr(data), data.length, ptr(m), ptr(eb));
    if (!resultPtr) throw new Error("Render matrix returned null");
    const matrix = new CString(resultPtr).toString();
    s.codec_free(resultPtr);
    if (eb[0] !== 0) throw new Error(`Render matrix failed (code ${eb[0]})`);
    return { matrix, metrics: metricsFromNative(m.buffer) };
}

export function renderMatrixRgba(ctx: number, rgba: Uint8Array, w: number, h: number): { matrix: string; metrics: CodecMetrics } {
    if (!rgba || rgba.length === 0) throw new Error("Empty RGBA buffer");
    const m = metricsBuf();
    const resultPtr = s.codec_render_matrix_rgba(ctx, ptr(rgba), w, h, w * 4, ptr(m));
    if (!resultPtr) throw new Error("Render matrix returned null");
    const matrix = new CString(resultPtr).toString();
    s.codec_free(resultPtr);
    return { matrix, metrics: metricsFromNative(m.buffer) };
}

export function animOpen(ctx: number, data: Uint8Array): { handle: number; metrics: CodecMetrics } {
    if (!data || data.length === 0) throw new Error("Empty buffer");
    const m = metricsBuf();
    const eb = errBuf();
    const handle = s.codec_anim_open(ctx, ptr(data), data.length, ptr(m), ptr(eb));
    if (handle < 0) throw new Error(`Failed to open animation (error ${eb[0]})`);
    return { handle, metrics: metricsFromNative(m.buffer) };
}

export function animNext(ctx: number, handle: number): { frameIndex: number; metrics: CodecMetrics } | null {
    const m = metricsBuf();
    const idx = s.codec_anim_next(ctx, handle, ptr(m));
    if (idx < 0) return null;
    return { frameIndex: idx, metrics: metricsFromNative(m.buffer) };
}

export function animRenderFrame(ctx: number, handle: number, frameIndex: number): { ansi: string; metrics: CodecMetrics } {
    const m = metricsBuf();
    const resultPtr = s.codec_anim_render_frame(ctx, handle, frameIndex, ptr(m));
    const ansi = new CString(resultPtr).toString();
    s.codec_free(resultPtr);
    return { ansi, metrics: metricsFromNative(m.buffer) };
}

export function animRewind(ctx: number, handle: number): void {
    s.codec_anim_rewind(ctx, handle);
}

export function animClose(ctx: number, handle: number): void {
    s.codec_anim_close(ctx, handle);
}

/* ═══════════════════════════════════════════════════════════════════
   Video (FFmpeg, optional - fails gracefully without FFmpeg)
   ═══════════════════════════════════════════════════════════════════ */

export function videoOpen(ctx: number, data: Uint8Array, decodeW: number, decodeH: number): { handle: number; metrics: CodecMetrics } {
    const m = metricsBuf();
    const eb = new Int32Array(1); eb[0] = 0;
    const handle = s.codec_video_open(ctx, ptr(data), data.length, decodeW, decodeH, ptr(m), ptr(new Uint8Array(eb.buffer)));
    if (handle < 0) {
        const err = new (require("bun:ffi").CString)(s.codec_video_error()).toString();
        throw new Error(`Failed to open video: ${err}`);
    }
    return { handle, metrics: metricsFromNative(m.buffer) };
}

export function videoNext(ctx: number, handle: number, rgba: Uint8Array): { frameIndex: number; w: number; h: number; ptsSec: number; metrics: CodecMetrics } | null {
    const w = new Int32Array(1), h = new Int32Array(1);
    const pts = new Float64Array(1);
    const m = metricsBuf();
    const idx = s.codec_video_next(ctx, handle, ptr(rgba), rgba.length,
        ptr(new Uint8Array(w.buffer)), ptr(new Uint8Array(h.buffer)),
        ptr(new Uint8Array(pts.buffer)), ptr(m));
    if (idx < 0) return null;
    return { frameIndex: idx, w: w[0]!, h: h[0]!, ptsSec: pts[0]!, metrics: metricsFromNative(m.buffer) };
}

export function videoSeek(ctx: number, handle: number, targetSec: number): void {
    s.codec_video_seek(ctx, handle, targetSec);
}

export function videoClose(ctx: number, handle: number): void {
    s.codec_video_close(ctx, handle);
}

export function animAbort(ctx: number, handle: number): void {
    s.codec_anim_abort(ctx, handle);
}
