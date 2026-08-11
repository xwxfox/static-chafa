// codec.ts — FFI bindings for codec.so / codec.dll (portable)
import { dlopen, FFIType, ptr, CString } from "bun:ffi";

export interface CodecMetrics {
    parseMs: number; inflateMs: number; defilterMs: number; renderMs: number;
    imgW: number; imgH: number; frameCount: number; frameDelayMs: number;
    format: number;
}
export interface CodecConfig {
    termW: number; termH: number; workFactor: number; ditherMode: number;
    canvasMode: number; preprocessing: number; bgColor: number;
    speed: number; maxFrames: number;
}

const LIB = process.platform === "win32" ? "codec.dll" : "codec.so";

const raw = dlopen(LIB, {
    codec_render_path:        { args: [FFIType.cstring, FFIType.ptr, FFIType.ptr, FFIType.ptr], returns: FFIType.ptr },
    codec_render_buffer:      { args: [FFIType.ptr, FFIType.i32, FFIType.ptr, FFIType.ptr, FFIType.ptr], returns: FFIType.ptr },
    codec_anim_open_buffer:   { args: [FFIType.ptr, FFIType.i32, FFIType.ptr, FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
    codec_anim_next:          { args: [FFIType.i32, FFIType.ptr], returns: FFIType.i32 },
    codec_anim_frame_data:    { args: [FFIType.i32, FFIType.i32], returns: FFIType.ptr },
    codec_anim_render_frame:  { args: [FFIType.i32, FFIType.i32, FFIType.ptr, FFIType.ptr], returns: FFIType.ptr },
    codec_anim_rewind:        { args: [FFIType.i32], returns: FFIType.void },
    codec_anim_close:         { args: [FFIType.i32], returns: FFIType.void },
    codec_anim_abort:         { args: [FFIType.i32], returns: FFIType.void },
    codec_free_string:        { args: [FFIType.ptr], returns: FFIType.void },
});

// Normalize: on some Bun versions symbols are on the object, others on .symbols
const s: any = (raw as any).codec_render_buffer ? raw : (raw as any).symbols;
if (!s || !s.codec_render_buffer) {
    console.error("FFI load failed. raw keys:", Object.keys(raw as any));
    console.error(".symbols keys:", Object.keys((raw as any).symbols || {}));
    throw new Error("Failed to load codec library");
}

type Lib = typeof s;

function defaultConfig(cfg?: Partial<CodecConfig>): CodecConfig {
    return { termW: 80, termH: 24, workFactor: 0, ditherMode: 0, canvasMode: 0,
             preprocessing: 0, bgColor: -1, speed: 1, maxFrames: 0, ...cfg };
}
function cfgBuf(cfg: CodecConfig): Uint8Array {
    const b = new ArrayBuffer(10 * 4);
    const i = new Int32Array(b);
    const f = new Float32Array(b);
    i[0] = cfg.termW;         i[1] = cfg.termH;
    f[2] = cfg.workFactor;
    i[3] = cfg.ditherMode;    i[4] = cfg.canvasMode;
    i[5] = cfg.preprocessing; i[6] = cfg.bgColor;
    i[7] = cfg.maxFrames;
    f[8] = cfg.speed;
    return new Uint8Array(b);
}
function errBuf(): Int32Array { return new Int32Array(new ArrayBuffer(4)); }
function metBuf(): Uint8Array { return new Uint8Array(new ArrayBuffer(56)); }
function readM(b: ArrayBuffer): CodecMetrics {
    const v = new DataView(b);
    return {
        parseMs:       v.getFloat32(0, true),
        inflateMs:     v.getFloat32(4, true),
        defilterMs:    v.getFloat32(8, true),
        renderMs:      v.getFloat32(12, true),
        imgW:          v.getInt32(16, true),
        imgH:          v.getInt32(20, true),
        frameCount:    v.getInt32(24, true),
        frameDelayMs:  v.getInt32(28, true),
        format:        v.getInt32(32, true),
    };
}

export interface RenderResult { ansi: string; metrics: CodecMetrics }

export function renderBuffer(data: Uint8Array, cfg?: Partial<CodecConfig>): RenderResult {
    const cv = cfgBuf(defaultConfig(cfg)), mv = metBuf(), eb = errBuf();
    const p = s.codec_render_buffer(ptr(data), data.length, ptr(cv), ptr(mv), ptr(eb));
    if (eb[0] !== 0) { const err = new CString(p).toString(); s.codec_free_string(p); throw new Error(err); }
    const ansi = new CString(p).toString(); s.codec_free_string(p);
    return { ansi, metrics: readM(mv.buffer) };
}

export function renderPath(path: string, cfg?: Partial<CodecConfig>): RenderResult {
    const cv = cfgBuf(defaultConfig(cfg)), mv = metBuf(), eb = errBuf();
    const p = s.codec_render_path(ptr(new Uint8Array(Buffer.from(path))), ptr(cv), ptr(mv), ptr(eb));
    if (eb[0] !== 0) { const err = new CString(p).toString(); s.codec_free_string(p); throw new Error(err); }
    const ansi = new CString(p).toString(); s.codec_free_string(p);
    return { ansi, metrics: readM(mv.buffer) };
}

export class AnimPlayer {
    handle: number; cfg: CodecConfig; aborted = false;
    private mBuf: Uint8Array; private fBuf: Uint8Array;

    constructor(handle: number, cfg: CodecConfig) {
        this.handle = handle; this.cfg = cfg; this.mBuf = metBuf(); this.fBuf = metBuf();
    }
    next() {
        if (this.aborted) return null;
        this.fBuf.fill(0);
        const idx = s.codec_anim_next(this.handle, ptr(this.fBuf));
        if (idx < 0) return null;
        return { frameIndex: idx, metrics: readM(this.fBuf.buffer) };
    }
    renderFrame(frameIndex: number) {
        this.mBuf.fill(0);
        const p = s.codec_anim_render_frame(this.handle, frameIndex, ptr(this.mBuf));
        const ansi = new CString(p).toString(); s.codec_free_string(p);
        return { ansi, metrics: readM(this.mBuf.buffer) };
    }
    close() { s.codec_anim_close(this.handle); }
    abort() { this.aborted = true; s.codec_anim_abort(this.handle); }
    rewind() { s.codec_anim_rewind(this.handle); }
}

let _cv: Uint8Array | null = null, _mv: Uint8Array | null = null;

export function openAnim(pathOrBuf: string | Uint8Array, cfg?: Partial<CodecConfig>): AnimPlayer | null {
    if (!_cv || _cv.length < 40) _cv = new Uint8Array(40);
    if (!_mv || _mv.length < 56) _mv = metBuf();
    _cv.set(cfgBuf(defaultConfig(cfg))); _mv.fill(0);
    const eb = errBuf(); let handle: number;
    if (typeof pathOrBuf === "string") {
        const fb = require("fs").readFileSync(pathOrBuf);
        handle = s.codec_anim_open_buffer(ptr(new Uint8Array(fb)), fb.length, ptr(_cv), ptr(_mv), ptr(eb));
    } else {
        handle = s.codec_anim_open_buffer(ptr(pathOrBuf), pathOrBuf.length, ptr(_cv), ptr(_mv), ptr(eb));
    }
    if (handle < 0) throw new Error(`openAnim failed: ${eb[0]}`);
    return new AnimPlayer(handle, defaultConfig(cfg));
}
