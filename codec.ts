// codec.ts — FFI bindings for the unified codec.so
import { dlopen, FFIType, ptr, CString } from "bun:ffi";

export interface CodecMetrics {
    parseMs: number;
    inflateMs: number;
    defilterMs: number;
    renderMs: number;
    imgW: number;
    imgH: number;
    frameCount: number;
    frameDelayMs: number;
    format: number; // 0=PNG 1=JPEG 2=BMP 3=GIF 4=WebP
}

export interface CodecConfig {
    termW: number;
    termH: number;
    workFactor: number;
    ditherMode: number;
    canvasMode: number;
    preprocessing: number;
    bgColor: number;
    speed: number;
    maxFrames: number;
}

const FMT_NAMES = ["PNG", "JPEG", "BMP", "GIF", "WebP"];

const lib = dlopen("codec.so", {
    codec_render_path:        { args: [FFIType.cstring, FFIType.ptr, FFIType.ptr, FFIType.ptr], returns: FFIType.ptr },
    codec_render_buffer:      { args: [FFIType.ptr, FFIType.i32, FFIType.ptr, FFIType.ptr, FFIType.ptr], returns: FFIType.ptr },
    codec_anim_open_buffer:   { args: [FFIType.ptr, FFIType.i32, FFIType.ptr, FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
    codec_anim_next:          { args: [FFIType.i32, FFIType.ptr], returns: FFIType.i32 },
    codec_anim_frame_data:    { args: [FFIType.i32, FFIType.i32], returns: FFIType.ptr },
    codec_anim_render_frame:  { args: [FFIType.i32, FFIType.i32, FFIType.ptr], returns: FFIType.ptr },
    codec_anim_rewind:        { args: [FFIType.i32], returns: FFIType.i32 },
    codec_anim_close:         { args: [FFIType.i32], returns: FFIType.void },
    codec_anim_abort:         { args: [FFIType.i32], returns: FFIType.void },
    codec_free_string:        { args: [FFIType.ptr], returns: FFIType.void },
});
const s = lib.symbols;

export function defaultConfig(overrides?: Partial<CodecConfig>): CodecConfig {
    return {
        termW: 80, termH: 35, workFactor: 0.0, ditherMode: 0,
        canvasMode: 0, preprocessing: 0, bgColor: 0,
        speed: 1.0, maxFrames: -1, ...overrides,
    };
}

function metricsFromBuf(b: ArrayBuffer): CodecMetrics {
    const f = new Float32Array(b);
    const i = new Int32Array(b);
    return { parseMs: f[0]!, inflateMs: f[1]!, defilterMs: f[2]!, renderMs: f[3]!,
             imgW: i[4]!, imgH: i[5]!, frameCount: i[6]!, frameDelayMs: i[7]!, format: i[8]! };
}

function configToBuf(c: CodecConfig): ArrayBuffer {
    const b = new ArrayBuffer(10 * 4);
    const i = new Int32Array(b);
    const f = new Float32Array(b);
    i[0] = c.termW; i[1] = c.termH;
    f[2] = c.workFactor;
    i[3] = c.ditherMode; i[4] = c.canvasMode; i[5] = c.preprocessing; i[6] = c.bgColor;
    i[7] = c.maxFrames;
    f[8] = c.speed;
    return b;
}

let _errBuf: Int32Array | null = null;
function errBuf(): Int32Array { if (!_errBuf) _errBuf = new Int32Array(1); _errBuf[0] = 0; return _errBuf; }

export function renderPath(path: string, cfg?: Partial<CodecConfig>): { ansi: string; metrics: CodecMetrics } {
    const c = configToBuf(defaultConfig(cfg));
    const m = new ArrayBuffer(9 * 4);
    const mv = new Uint8Array(m);
    const cv = new Uint8Array(c);
    const eb = errBuf();
    const resultPtr = s.codec_render_path(ptr(Buffer.from(path + "\0")), ptr(cv), ptr(mv), ptr(eb));
    if (!resultPtr) throw new Error("renderPath returned null");
    const ansi = new CString(resultPtr).toString();
    s.codec_free_string(resultPtr);
    if (eb[0] !== 0) throw new Error(`${ansi} (code ${eb[0]})`);
    return { ansi, metrics: metricsFromBuf(m) };
}

export function renderBuffer(buf: Uint8Array, cfg?: Partial<CodecConfig>): { ansi: string; metrics: CodecMetrics } {
    if (!buf || buf.length === 0) throw new Error("renderBuffer: empty buffer");
    const c = configToBuf(defaultConfig(cfg));
    const m = new ArrayBuffer(9 * 4);
    const mv = new Uint8Array(m);
    const cv = new Uint8Array(c);
    const eb = errBuf();
    const resultPtr = s.codec_render_buffer(ptr(buf), buf.length, ptr(cv), ptr(mv), ptr(eb));
    if (!resultPtr) throw new Error("renderBuffer returned null");
    const ansi = new CString(resultPtr).toString();
    s.codec_free_string(resultPtr);
    if (eb[0] !== 0) throw new Error(`${ansi} (code ${eb[0]})`);
    return { ansi, metrics: metricsFromBuf(m) };
}

export class AnimPlayer {
    handle: number;
    cfg: CodecConfig;
    private mBuf: ArrayBuffer;
    private fBuf: ArrayBuffer;
    aborted = false;

    constructor(handle: number, cfg: CodecConfig) {
        this.handle = handle;
        this.cfg = cfg;
        this.mBuf = new ArrayBuffer(9 * 4);
        this.fBuf = new ArrayBuffer(9 * 4);
    }

    next(): { frameIndex: number; metrics: CodecMetrics } | null {
        if (this.aborted) return null;
        const idx = s.codec_anim_next(this.handle, ptr(new Uint8Array(this.fBuf)));
        if (idx < 0) return null;
        return { frameIndex: idx, metrics: metricsFromBuf(this.fBuf) };
    }

    renderFrame(frameIndex: number): { ansi: string; metrics: CodecMetrics } {
        const resultPtr = s.codec_anim_render_frame(this.handle, frameIndex, ptr(new Uint8Array(this.mBuf)));
        const ansi = new CString(resultPtr).toString();
        s.codec_free_string(resultPtr);
        return { ansi, metrics: metricsFromBuf(this.mBuf) };
    }

    frameData(frameIndex: number): { data: Uint8Array; w: number; h: number } | null {
        const ptrData = s.codec_anim_frame_data(this.handle, frameIndex);
        if (!ptrData) return null;
        // We need to know the frame size. The metrics from renderFrame tell us dimensions.
        // Use the stored metrics from last render or open.
        // Actually, we stored w/h during open — need to expose them.
        return null; // placeholder — dimensions unknown without storing them
    }

    close() { s.codec_anim_close(this.handle); }
    abort() { this.aborted = true; s.codec_anim_abort(this.handle); }
    rewind() { s.codec_anim_rewind(this.handle); }
}

let _cv: Uint8Array | null = null;
let _mv: Uint8Array | null = null;

export function openAnim(pathOrBuf: string | Uint8Array, cfg?: Partial<CodecConfig>): AnimPlayer | null {
    if (!_cv || _cv.length < 40) _cv = new Uint8Array(40);
    if (!_mv || _mv.length < 36) _mv = new Uint8Array(36);
    const c = configToBuf(defaultConfig(cfg));
    _cv.set(new Uint8Array(c));
    _mv.fill(0);
    const eb = errBuf();
    let handle: number;
    if (typeof pathOrBuf === "string") {
        const fb = require("fs").readFileSync(pathOrBuf);
        if (!fb || fb.length === 0) throw new Error("openAnim: empty file");
        const fbv = new Uint8Array(fb);
        handle = s.codec_anim_open_buffer(ptr(fbv), fb.length, ptr(_cv), ptr(_mv), ptr(eb));
    } else {
        if (!pathOrBuf || pathOrBuf.length === 0) throw new Error("openAnim: empty buffer");
        handle = s.codec_anim_open_buffer(ptr(pathOrBuf), pathOrBuf.length, ptr(_cv), ptr(_mv), ptr(eb));
    }
    if (handle < 0) throw new Error(`openAnim failed: error code ${eb[0]}`);
    return new AnimPlayer(handle, defaultConfig(cfg));
}
