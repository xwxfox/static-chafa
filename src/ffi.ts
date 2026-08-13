// ffi.ts - Bun FFI bindings for codec.so (dev/test only)
import { dlopen, FFIType, ptr, CString, toArrayBuffer, type Pointer } from "bun:ffi";
import type { CodecMetrics, ChafaConfig, ChafaConfigPartial, ChafaImageData } from "./types.ts";
import { defaultConfig } from "./types.ts";
export type { CodecMetrics, ChafaConfig, ChafaConfigPartial, ChafaImageData };
export {
    CanvasMode, PixelMode, DitherMode, ColorExtractor, ColorSpace, Passthrough,
    PixelFit, defaultConfig
} from "./types.ts";

const FMT_NAMES = ["PNG", "JPEG", "BMP", "GIF", "WebP"];
export { FMT_NAMES };

const lib = dlopen("codec.so", {
    codec_ctx_new: { args: [FFIType.ptr], returns: FFIType.ptr },
    codec_ctx_free: { args: [FFIType.ptr], returns: FFIType.void },
    codec_ctx_configure: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.void },
    codec_decode_buffer: { args: [FFIType.ptr, FFIType.i32, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr], returns: FFIType.ptr },
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
    codec_anim_goto: { args: [FFIType.ptr, FFIType.i32, FFIType.i32], returns: FFIType.i32 },
    codec_free: { args: [FFIType.ptr], returns: FFIType.void },
    codec_video_open: { args: [FFIType.ptr, FFIType.ptr, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
    codec_video_next: { args: [FFIType.ptr, FFIType.i32, FFIType.ptr, FFIType.i32, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
    codec_video_info: { args: [FFIType.ptr, FFIType.i32, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
    codec_video_seek: { args: [FFIType.ptr, FFIType.i32, FFIType.f64], returns: FFIType.i32 },
    codec_video_close: { args: [FFIType.ptr, FFIType.i32], returns: FFIType.void },
    codec_video_thumbnail: { args: [FFIType.ptr, FFIType.i32, FFIType.ptr, FFIType.i32, FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
    codec_video_thumb_size: { args: [FFIType.ptr, FFIType.i32, FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
    codec_video_play: { args: [FFIType.ptr, FFIType.i32, FFIType.f64], returns: FFIType.void },
    codec_video_pause: { args: [FFIType.ptr, FFIType.i32], returns: FFIType.void },
    codec_video_status: { args: [FFIType.ptr, FFIType.i32, FFIType.ptr], returns: FFIType.i32 },
    codec_video_error: { args: [], returns: FFIType.cstring },
});
const s = lib.symbols;

/* bun:ffi's typings are strict (Pointer objects, non-null), while the
   runtime also accepts plain numbers. These helpers keep the type checker
   happy without changing runtime behavior. */
function ptrOrThrow(v: Uint8Array | Int32Array | Float64Array): Pointer {
    const p = ptr(v);
    if (p === null) throw new Error("FFI: failed to allocate pointer");
    return p;
}
const asPtr = (n: number | Pointer | null) => n as unknown as Pointer;

/* -- CodecConfig layout (must match codec.c byte-for-byte) --
   Layout: 27 fields (int32/float) + 2 × 128 byte char buffers
   Fields in order:
     i[0]  term_w          f[4]  work_factor      f[16] dither_intensity
     i[1]  term_h          i[5]  dither_mode       i[17] fg_only
     i[2]  cell_w          i[6]  canvas_mode       i[18] optimizations
     i[3]  cell_h          i[7]  preprocessing     i[19] passthrough
                           i[8]  color_extractor   i[20] max_frames
                           i[9]  color_space       f[21] speed
                           i[10] pixel_mode        i[22] pixel_fit
                           i[11] bg_color          i[23] video_include_audio
                           i[12] fg_color          i[24] video_threads
                           i[13] alpha_threshold   i[25] sws_scale
                           i[14] dither_grain_w    f[26] video_decode_scale
                           i[15] dither_grain_h    :108  symbols[128]
                                                   :236  fill_symbols[128]
                                                  =364 bytes total
*/
const CONFIG_INTS = 27;   // 27 × 4 = 108 bytes of int32/float fields
const CONFIG_SIZE = CONFIG_INTS * 4 + 128 + 128; // 364 bytes

let _cfgBuf: Uint8Array | null = null;
let _metricsBuf: Uint8Array | null = null;
let _errBuf: Int32Array | null = null;

const _textEncoder = new TextEncoder();

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
    i[22] = cfg.pixelFit;
    i[23] = cfg.videoIncludeAudio;
    i[24] = cfg.videoThreads;
    i[25] = cfg.swsScale;
    f[26] = cfg.videoDecodeScale;

    /* Write symbols string at byte offset 108, fillSymbols at 236 */
    const writeStr = (str: string | undefined, off: number) => {
        if (!str) { b[off] = 0; return; }
        const bytes = _textEncoder.encode(str);
        const n = Math.min(bytes.length, 127);
        for (let j = 0; j < n; j++) b[off + j] = bytes[j]!;
        b[off + n] = 0;
    };
    writeStr(cfg.symbols, 108);
    writeStr(cfg.fillSymbols, 236);

    return b;
}

function metricsFromNative(b: ArrayBufferLike): CodecMetrics {
    const f = new Float32Array(b);
    const i = new Int32Array(b);
    return {
        parseMs: f[0]!, drawMs: f[1]!, buildMs: f[2]!, totalMs: f[3]!,
        imgW: i[4]!, imgH: i[5]!,
        canvasW: i[6]!, canvasH: i[7]!, canvasPw: i[8]!, canvasPh: i[9]!,
        frameCount: i[10]!, frameDelayMs: i[11]!,
        rgbaBytes: i[12]!,
        format: i[13]!, canvasMode: i[14]!, pixelMode: i[15]!, haveAlpha: i[16]!,
        pixelFit: i[17]!,
        scaleMs: f[18]!,
    };
}

/* ═════════════════════════════════════════════════════════════════════
   Public API (used by index.ts classes)
   ═════════════════════════════════════════════════════════════════════ */

export function createContext(cfg?: ChafaConfigPartial): number {
    const native = configToNative({ ...defaultConfig(), ...cfg });
    const ctxPtr = s.codec_ctx_new(ptrOrThrow(native));
    if (!ctxPtr) throw new Error("Failed to create chafa context");
    return Number(ctxPtr);
}

export function destroyContext(ctx: number): void {
    if (!ctx) return;
    s.codec_ctx_free(asPtr(ctx));
}

export function configureContext(ctx: number, cfg: ChafaConfigPartial): void {
    const d = defaultConfig();
    const merged: ChafaConfig = { ...d, ...cfg };
    s.codec_ctx_configure(asPtr(ctx), ptrOrThrow(configToNative(merged)));
}

export function decodeBuffer(data: Uint8Array): ChafaImageData {
    if (!data || data.length === 0) throw new Error("Empty buffer");
    const m = metricsBuf();
    const eb = errBuf();
    const wArr = new Int32Array(1), hArr = new Int32Array(1), strideArr = new Int32Array(1);

    /* Exact-size decode: the native side allocates only what the image
       needs (no 256MB worst-case buffer) */
    const rgbaPtr = s.codec_decode_buffer(
        ptrOrThrow(data), data.length,
        ptrOrThrow(new Uint8Array(wArr.buffer)), ptrOrThrow(new Uint8Array(hArr.buffer)),
        ptrOrThrow(new Uint8Array(strideArr.buffer)), ptrOrThrow(m), ptrOrThrow(eb),
    );

    if (!rgbaPtr || eb[0] !== 0)
        throw new Error(`Decode failed (error ${eb[0]})`);

    const w = wArr[0]!, h = hArr[0]!, stride = strideArr[0]!;
    const size = h * stride;
    const rgba = new Uint8Array(toArrayBuffer(asPtr(Number(rgbaPtr)), 0, size));
    s.codec_free(rgbaPtr);
    return { rgba, width: w, height: h, stride, metrics: metricsFromNative(m.buffer) };
}

export function freeNative(ptr_val: number): void {
    s.codec_free(asPtr(ptr_val));
}

export function render(ctx: number, data: Uint8Array): { ansi: string; metrics: CodecMetrics } {
    if (!data || data.length === 0) throw new Error("Empty buffer");
    const m = metricsBuf();
    const eb = errBuf();
    const resultPtr = s.codec_render(asPtr(ctx), ptrOrThrow(data), data.length, ptrOrThrow(m), ptrOrThrow(eb));
    if (!resultPtr) throw new Error("Render returned null");
    const ansi = new CString(resultPtr).toString();
    s.codec_free(resultPtr);
    if (eb[0] !== 0) throw new Error(`${ansi} (code ${eb[0]})`);
    return { ansi, metrics: metricsFromNative(m.buffer) };
}

export function renderRgba(ctx: number, rgba: Uint8Array, w: number, h: number): { ansi: string; metrics: CodecMetrics } {
    if (!rgba || rgba.length === 0) throw new Error("Empty RGBA buffer");
    const m = metricsBuf();
    const resultPtr = s.codec_render_rgba(asPtr(ctx), ptrOrThrow(rgba), w, h, w * 4, ptrOrThrow(m));
    if (!resultPtr) throw new Error("Render returned null");
    const ansi = new CString(resultPtr).toString();
    s.codec_free(resultPtr);
    return { ansi, metrics: metricsFromNative(m.buffer) };
}

export function renderMatrix(ctx: number, data: Uint8Array): { matrix: string; metrics: CodecMetrics } {
    if (!data || data.length === 0) throw new Error("Empty buffer");
    const m = metricsBuf();
    const eb = errBuf();
    const resultPtr = s.codec_render_matrix(asPtr(ctx), ptrOrThrow(data), data.length, ptrOrThrow(m), ptrOrThrow(eb));
    if (!resultPtr) throw new Error("Render matrix returned null");
    const matrix = new CString(resultPtr).toString();
    s.codec_free(resultPtr);
    if (eb[0] !== 0) throw new Error(`Render matrix failed (code ${eb[0]})`);
    return { matrix, metrics: metricsFromNative(m.buffer) };
}

export function renderMatrixRgba(ctx: number, rgba: Uint8Array, w: number, h: number): { matrix: string; metrics: CodecMetrics } {
    if (!rgba || rgba.length === 0) throw new Error("Empty RGBA buffer");
    const m = metricsBuf();
    const resultPtr = s.codec_render_matrix_rgba(asPtr(ctx), ptrOrThrow(rgba), w, h, w * 4, ptrOrThrow(m));
    if (!resultPtr) throw new Error("Render matrix returned null");
    const matrix = new CString(resultPtr).toString();
    s.codec_free(resultPtr);
    return { matrix, metrics: metricsFromNative(m.buffer) };
}

export function animOpen(ctx: number, data: Uint8Array): { handle: number; metrics: CodecMetrics } {
    if (!data || data.length === 0) throw new Error("Empty buffer");
    const m = metricsBuf();
    const eb = errBuf();
    const handle = s.codec_anim_open(asPtr(ctx), ptrOrThrow(data), data.length, ptrOrThrow(m), ptrOrThrow(eb));
    if (handle < 0) throw new Error(`Failed to open animation (error ${eb[0]})`);
    return { handle, metrics: metricsFromNative(m.buffer) };
}

export function animNext(ctx: number, handle: number): { frameIndex: number; metrics: CodecMetrics } | null {
    const m = metricsBuf();
    const idx = s.codec_anim_next(asPtr(ctx), handle, ptrOrThrow(m));
    if (idx < 0) return null;
    return { frameIndex: idx, metrics: metricsFromNative(m.buffer) };
}

export function animRenderFrame(ctx: number, handle: number, frameIndex: number): { ansi: string; metrics: CodecMetrics } {
    const m = metricsBuf();
    const resultPtr = s.codec_anim_render_frame(asPtr(ctx), handle, frameIndex, ptrOrThrow(m));
    if (!resultPtr) throw new Error("Render frame returned null");
    const ansi = new CString(resultPtr).toString();
    s.codec_free(resultPtr);
    return { ansi, metrics: metricsFromNative(m.buffer) };
}

export function animRewind(ctx: number, handle: number): void {
    s.codec_anim_rewind(asPtr(ctx), handle);
}

export function animClose(ctx: number, handle: number): void {
    s.codec_anim_close(asPtr(ctx), handle);
}

/* ═══════════════════════════════════════════════════════════════════
   Video (FFmpeg, optional - fails gracefully without FFmpeg)
   ═══════════════════════════════════════════════════════════════════ */

export function videoOpen(ctx: number, data: Uint8Array, decodeW: number, decodeH: number): { handle: number; metrics: CodecMetrics } {
    const m = metricsBuf();
    const eb = new Int32Array(1); eb[0] = 0;
    const handle = s.codec_video_open(asPtr(ctx), ptrOrThrow(data), data.length, decodeW, decodeH, ptrOrThrow(m), ptrOrThrow(new Uint8Array(eb.buffer)));
    if (handle < 0) {
        const err = new (require("bun:ffi").CString)(s.codec_video_error()).toString();
        throw new Error(`Failed to open video: ${err}`);
    }
    return { handle, metrics: metricsFromNative(m.buffer) };
}

export function videoNext(ctx: number, handle: number, rgba?: Uint8Array): { frameIndex: number; w: number; h: number; ptsSec: number; metrics: CodecMetrics; rgba?: Uint8Array; audio?: Float32Array; audioSamples: number; audioChannels: number; audioSampleRate: number } | null {
    const w = new Int32Array(1), h = new Int32Array(1);
    const pts = new Float64Array(1);
    const m = metricsBuf();

    /* Zero-copy path: when no caller buffer is provided, the frame is a
       direct view into the decoder ring buffer. Valid until the next
       videoNext()/videoSeek()/videoClose() call. */
    let out: Uint8Array;
    if (rgba && rgba.length > 0) {
        out = rgba;
        const idx = s.codec_video_next(asPtr(ctx), handle, ptrOrThrow(rgba), rgba.length,
            ptrOrThrow(new Uint8Array(w.buffer)), ptrOrThrow(new Uint8Array(h.buffer)),
            ptrOrThrow(new Uint8Array(pts.buffer)), ptrOrThrow(m), 0, 0,
            0, 0, 0, 0);
        if (idx < 0) return null;
        return { frameIndex: idx, w: w[0]!, h: h[0]!, ptsSec: pts[0]!, metrics: metricsFromNative(m.buffer), rgba: out, audioSamples: 0, audioChannels: 0, audioSampleRate: 0 };
    }

    const ptrBuf = new Uint8Array(8);
    const sizeArr = new Int32Array(1);
    const audioPtrBuf = new Uint8Array(8);
    const audioSamplesArr = new Int32Array(1);
    const audioChArr = new Int32Array(1);
    const audioRateArr = new Int32Array(1);
    const idx = s.codec_video_next(asPtr(ctx), handle, 0, 0,
        ptrOrThrow(new Uint8Array(w.buffer)), ptrOrThrow(new Uint8Array(h.buffer)),
        ptrOrThrow(new Uint8Array(pts.buffer)), ptrOrThrow(m),
        ptrOrThrow(ptrBuf), ptrOrThrow(new Uint8Array(sizeArr.buffer)),
        ptrOrThrow(audioPtrBuf), ptrOrThrow(new Uint8Array(audioSamplesArr.buffer)),
        ptrOrThrow(new Uint8Array(audioChArr.buffer)), ptrOrThrow(new Uint8Array(audioRateArr.buffer)));
    if (idx < 0) return null;

    const framePtr = Number(new BigUint64Array(ptrBuf.buffer, ptrBuf.byteOffset, 1)[0]);
    const size = sizeArr[0]!;
    if (framePtr && size > 0) {
        out = new Uint8Array(toArrayBuffer(asPtr(framePtr), 0, size));
    } else {
        out = new Uint8Array(0);
    }

    const audioPtr = Number(new BigUint64Array(audioPtrBuf.buffer, audioPtrBuf.byteOffset, 1)[0]);
    const audioSamples = audioSamplesArr[0]!;
    const audioChannels = audioChArr[0]!;
    const audioSampleRate = audioRateArr[0]!;
    let audio: Float32Array | undefined;
    if (audioPtr && audioSamples > 0 && audioChannels > 0) {
        const ab = toArrayBuffer(asPtr(audioPtr), 0, audioSamples * audioChannels * 4);
        audio = new Float32Array(ab, 0, audioSamples * audioChannels);
    }

    return { frameIndex: idx, w: w[0]!, h: h[0]!, ptsSec: pts[0]!, metrics: metricsFromNative(m.buffer), rgba: out, audio, audioSamples, audioChannels, audioSampleRate };
}

export function videoThumbnail(ctx: number, handle: number): { rgba: Uint8Array; width: number; height: number } {
    const w = new Int32Array(1), h = new Int32Array(1);
    const bytes = s.codec_video_thumb_size(asPtr(ctx), handle,
        ptrOrThrow(new Uint8Array(w.buffer)), ptrOrThrow(new Uint8Array(h.buffer)));
    if (bytes <= 0) throw new Error("Thumbnail unavailable");
    const buf = new Uint8Array(bytes);
    const r = s.codec_video_thumbnail(asPtr(ctx), handle, ptrOrThrow(buf), buf.length,
        ptrOrThrow(new Uint8Array(w.buffer)), ptrOrThrow(new Uint8Array(h.buffer)));
    if (r < 0) throw new Error("Thumbnail unavailable");
    return { rgba: buf.slice(0, w[0]! * h[0]! * 4), width: w[0]!, height: h[0]! };
}

export function videoPlay(ctx: number, handle: number, speed = 1.0): void {
    s.codec_video_play(asPtr(ctx), handle, speed);
}

export function videoPause(ctx: number, handle: number): void {
    s.codec_video_pause(asPtr(ctx), handle);
}

export function animGoto(ctx: number, handle: number, frameIdx: number): number {
    return s.codec_anim_goto(asPtr(ctx), handle, frameIdx);
}

export function videoSeek(ctx: number, handle: number, targetSec: number): void {
    s.codec_video_seek(asPtr(ctx), handle, targetSec);
}

export function videoClose(ctx: number, handle: number): void {
    s.codec_video_close(asPtr(ctx), handle);
}

export function animAbort(ctx: number, handle: number): void {
    s.codec_anim_abort(asPtr(ctx), handle);
}
