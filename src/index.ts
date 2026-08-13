/**
 * static-chafa - Zero-dependency terminal image rendering.
 *
 * Renders PNG, JPEG, BMP, GIF, and WebP images to ANSI terminal art
 * using the chafa engine compiled directly into the native addon.
 *
 * ```ts
 * import Chafa from "static-chafa";
 *
 * const chafa = new Chafa({ termW: 80, termH: 24 });
 * const { ansi, metrics } = chafa.render(imageBuffer);
 * process.stdout.write(ansi);
 * chafa.destroy();
 * ```
 *
 * @module static-chafa
 */

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
import { defaultConfig as defaultChafaConfig, PixelMode, CanvasMode } from "./types.ts";
import { tunedDefaults } from "./tuned.ts";

const { platform, arch } = process;
const SUFFIX = `${platform}-${arch}`;
const PKG = `@static-chafa/${SUFFIX}`;

let native: Record<string, any>;
try {
    native = require(PKG);
} catch (e: any) {
    throw new Error(
        `static-chafa: unsupported platform ${SUFFIX}. ` +
        `Install error: ${(e as Error).message}`,
    );
}

/* ═══════════════════════════════════════════════════════════════════
   Type re-exports
   ═══════════════════════════════════════════════════════════════════ */

export type {
    ChafaFormat,
    ChafaConfig,
    ChafaConfigPartial,
    CodecMetrics,
    RenderResult,
    MatrixResult,
    AnimFrame,
    ChafaImageData,
    VideoFrame,
} from "./types.ts";
export {
    FMT_NAMES,
    CanvasMode,
    PixelMode,
    PixelFit,
    DitherMode,
    ColorExtractor,
    ColorSpace,
    Passthrough,
    SwsScale,
    defaultConfig,
    pixelCanvasSize,
} from "./types.ts";
export { tunedDefaults } from "./tuned.ts";

/* -- helpers -- */
function ensureBuffer(data: Uint8Array): Buffer {
    if (Buffer.isBuffer(data)) return data as Buffer;
    return Buffer.from(data);
}

/* Parse SGR parameters ("38;2;255;0;0") from [start, end) into the reusable
   @out array, returning the number of codes. Zero-allocation fast path for
   the HTML/console converters (called once per cell in large outputs). */
function parseSgr(line: string, start: number, end: number, out: number[]): number {
    let n = 0;
    let num = -1;
    for (let i = start; i < end; i++) {
        const c = line.charCodeAt(i);
        if (c === 59 /* ';' */) { out[n++] = num; num = -1; }
        else if (c >= 48 && c <= 57) num = num < 0 ? c - 48 : num * 10 + c - 48;
    }
    out[n++] = num;
    return n;
}

/* ═══════════════════════════════════════════════════════════════════
   ChafaImage - decoded raw RGBA pixels
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Holds a decoded image's raw RGBA pixel data.
 *
 * Created by `chafa.decode(buffer)`. Can be passed to `chafa.renderRgba()`
 * to render multiple times without re-decoding.
 *
 * Supports `using` for automatic cleanup.
 */
export class ChafaImage {
    /** RGBA pixel buffer (8 bits per channel, unassociated alpha). Read-only for safety. */
    readonly rgba: Uint8Array;
    /** Image width in pixels. */
    readonly width: number;
    /** Image height in pixels. */
    readonly height: number;
    /** Row stride in bytes (always `width * 4`). */
    readonly stride: number;
    /** Decode metrics (format, decode time, etc.). */
    readonly metrics: import("./types.ts").CodecMetrics;

    constructor(data: import("./types.ts").ChafaImageData) {
        this.rgba = data.rgba;
        this.width = data.width;
        this.height = data.height;
        this.stride = data.stride;
        this.metrics = data.metrics;
    }

    /** Detected image format (0=PNG, 1=JPEG, 2=BMP, 3=GIF, 4=WebP). */
    get format(): number { return this.metrics.format; }

    /**
     * Free the native RGBA buffer.
     * After calling this the image is unusable.
     */
    destroy(): void {
        (this as any).rgba = undefined;
    }

    /** @inheritdoc */
    [Symbol.dispose](): void {
        this.destroy();
    }
}

/* ═══════════════════════════════════════════════════════════════════
   ChafaAnimation - animated image player
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Plays animated GIF or WebP images frame-by-frame.
 *
 * Created by `chafa.openAnimation(buffer)`. Supports `using` for
 * automatic cleanup at end of scope. Works in every pixel mode
 * (symbols, sixels, kitty, iterm2) - `play()` renders frames with the
 * owning instance's config (pixel mode, fit, size), so output fills the
 * terminal out of the box.
 *
 * ```ts
 * const anim = chafa.openAnimation(gifBuf);
 * anim.loop = true;
 * anim.onFrame((frame) => process.stdout.write(frame.ansi!));
 * anim.play();          // internal timer honors per-frame delays
 * // ...
 * anim.pause();         // freeze on the current frame
 * anim.goto(10);        // jump to frame 10
 * anim.close();
 * ```
 *
 * Manual stepping (`next()` + `renderFrame()`) is also fully supported.
 */
export class ChafaAnimation {
    #ctx: number;
    #handle: number;
    #closed = false;
    #loop = false;
    #playing = false;
    #timer: ReturnType<typeof setTimeout> | null = null;
    #listeners = new Set<(frame: import("./types.ts").AnimFrameEvent) => void>();
    #loopedWrap = false;

    /** Total frames in the animation (-1 for unknown-length WebP). */
    readonly frameCount: number;
    /** Source image width in pixels. */
    readonly width: number;
    /** Source image height in pixels. */
    readonly height: number;
    /** Image format (3=GIF, 4=WebP). */
    readonly imageFormat: number;

    constructor(ctx: number, handle: number, metrics: import("./types.ts").CodecMetrics) {
        this.#ctx = ctx;
        this.#handle = handle;
        this.frameCount = metrics.frameCount;
        this.width = metrics.imgW;
        this.height = metrics.imgH;
        this.imageFormat = metrics.format;
    }

    /**
     * Loop mode. When enabled, playback automatically rewinds and
     * continues after the last frame instead of stopping.
     */
    get loop(): boolean {
        return this.#loop;
    }
    set loop(value: boolean) {
        this.#loop = value;
    }

    /** Whether `play()` is currently running the internal playback timer. */
    get playing(): boolean {
        return this.#playing;
    }

    /**
     * Register a listener for frame events. Fires whenever a frame
     * becomes current via `next()`, `play()` ticks, or `goto()`.
     * Returns an unsubscribe function.
     */
    onFrame(listener: (frame: import("./types.ts").AnimFrameEvent) => void): () => void {
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }

    #emit(frame: import("./types.ts").AnimFrame, ansi?: string): void {
        const evt: import("./types.ts").AnimFrameEvent = {
            frameIndex: frame.frameIndex,
            metrics: frame.metrics,
            ansi,
            looped: this.#loopedWrap,
        };
        this.#loopedWrap = false;
        for (const l of this.#listeners) l(evt);
    }

    /**
     * Advance to the next frame. Emits an `onFrame` event.
     * @returns Frame info or `null` when playback ends (or, with `loop`
     *   enabled, `null` only if rewind fails).
     */
    next(): import("./types.ts").AnimFrame | null {
        if (this.#closed) return null;
        let frame = native.chafaAnimNext(this.#ctx, this.#handle);
        if (!frame && this.#loop) {
            native.chafaAnimRewind(this.#ctx, this.#handle);
            frame = native.chafaAnimNext(this.#ctx, this.#handle);
            if (frame) this.#loopedWrap = true;
        }
        if (frame) this.#emit(frame);
        return frame;
    }

    /**
     * Render a specific frame to ANSI terminal art.
     * @param frameIndex Zero-based frame index (from `next().frameIndex`).
     */
    renderFrame(frameIndex: number): import("./types.ts").RenderResult {
        if (this.#closed) throw new Error("Animation closed");
        return native.chafaAnimRenderFrame(this.#ctx, this.#handle, frameIndex);
    }

    /** Rewind playback to the first frame. */
    rewind(): void {
        if (this.#closed) return;
        native.chafaAnimRewind(this.#ctx, this.#handle);
    }

    /**
     * Raw RGBA pixels of a decoded frame (zero-copy view into the frame
     * pool, valid until the next anim call or `close()`). `null` when the
     * frame hasn't been decoded yet. Used by the tuning harness for
     * ground-truth comparisons.
     */
    frameData(frameIndex: number): Uint8Array | null {
        if (this.#closed) return null;
        const buf = native.chafaAnimFrameData(this.#ctx, this.#handle, frameIndex);
        if (!buf) return null;
        return new Uint8Array(buf.buffer, buf.byteOffset, this.width * this.height * 4);
    }

    /**
     * Jump to an absolute frame index. Emits an `onFrame` event with the
     * rendered frame. Stops `play()` timing (playback resumes from the
     * new position if still playing).
     * @returns The jumped-to frame info + ansi, or `null` on invalid index.
     */
    goto(frameIndex: number): { frameIndex: number; metrics: import("./types.ts").CodecMetrics; ansi: string } | null {
        if (this.#closed) return null;
        if (native.chafaAnimGoto(this.#ctx, this.#handle, frameIndex) < 0) return null;
        const rendered = this.renderFrame(frameIndex);
        this.#emit({ frameIndex, metrics: rendered.metrics }, rendered.ansi);
        if (this.#playing) this.#schedule();
        return { frameIndex, metrics: rendered.metrics, ansi: rendered.ansi };
    }

    #schedule(): void {
        if (this.#timer) clearTimeout(this.#timer);
        this.#timer = null;
        if (!this.#playing || this.#closed) return;

        /* Advance directly (next() also emits - the play path emits once,
           with the rendered ansi included) */
        let frame = native.chafaAnimNext(this.#ctx, this.#handle);
        if (!frame && this.#loop) {
            native.chafaAnimRewind(this.#ctx, this.#handle);
            frame = native.chafaAnimNext(this.#ctx, this.#handle);
            if (frame) this.#loopedWrap = true;
        }
        if (!frame) {
            this.#playing = false;
            return;
        }
        const rendered = this.renderFrame(frame.frameIndex);
        this.#emit({ frameIndex: frame.frameIndex, metrics: rendered.metrics }, rendered.ansi);

        const delay = Math.max(1, frame.metrics.frameDelayMs || rendered.metrics.frameDelayMs || 100);
        this.#timer = setTimeout(() => this.#schedule(), delay);
    }

    /**
     * Start (or resume) automatic playback. Frames advance on an internal
     * timer honoring each frame's delay and render through the owning
     * instance's config (pixel mode aware), emitting `onFrame` events.
     */
    play(): void {
        if (this.#closed || this.#playing) return;
        this.#playing = true;
        this.#schedule();
    }

    /** Pause automatic playback. The current frame stays on screen. */
    pause(): void {
        this.#playing = false;
        if (this.#timer) {
            clearTimeout(this.#timer);
            this.#timer = null;
        }
    }

    /** Close the animation and free native resources. Stops playback. */
    close(): void {
        if (this.#closed) return;
        this.pause();
        this.#closed = true;
        this.#listeners.clear();
        native.chafaAnimClose(this.#ctx, this.#handle);
    }

    /**
     * Debug / perf snapshot: format, dimensions, frame count, playback
     * state, and listener count.
     */
    info(): { imageFormat: number; width: number; height: number; frameCount: number; loop: boolean; playing: boolean; listeners: number } {
        return {
            imageFormat: this.imageFormat,
            width: this.width,
            height: this.height,
            frameCount: this.frameCount,
            loop: this.#loop,
            playing: this.#playing,
            listeners: this.#listeners.size,
        };
    }

    /** Signal early termination (stops async decoders). Does not free resources. */
    abort(): void {
        if (this.#closed) return;
        native.chafaAnimAbort(this.#ctx, this.#handle);
    }

    /** @inheritdoc */
    [Symbol.dispose](): void {
        this.close();
    }
}

/* ═══════════════════════════════════════════════════════════════════
   ChafaVideo - FFmpeg-based video playback
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Decodes and plays MP4/MKV/WebM/AVI videos frame-by-frame via FFmpeg.
 *
 * Created by `chafa.openVideo(buffer)`. Requires FFmpeg shared libraries
 * installed on the system (throws a descriptive error if not found).
 *
 * Videos are decoded to RGBA at a configurable target resolution (the
 * pixel-fit size by default) and stored in an 8-frame ring buffer for
 * smooth playback. Frames are zero-copy views into the ring buffer
 * (valid until the next call).
 *
 * Set `videoIncludeAudio: 1` in the config to also decode audio - each
 * frame then carries interleaved float32 PCM covering its timespan.
 */
export class ChafaVideo {
    #ctx: number;
    #handle: number;
    #closed = false;
    #playing = false;
    #owner: Chafa;
    #listeners = new Set<(frame: import("./types.ts").VideoFrameEvent) => void>();

    /** Native video width in pixels. */
    readonly width: number;
    /** Native video height in pixels. */
    readonly height: number;
    /** Duration in seconds. */
    readonly durationSec: number;
    /** Frames per second. */
    readonly fps: number;
    /** Whether the video contains an audio track. */
    readonly hasAudio: boolean;
    /** Audio codec name (e.g. "aac", "mp3"). Empty if no audio. */
    readonly audioCodec: string;
    /** Audio sample rate in Hz. 0 if no audio. */
    readonly audioSampleRate: number;
    /** Audio channel count. 0 if no audio. */
    readonly audioChannels: number;

    constructor(ctx: number, handle: number, info: any, owner: Chafa) {
        this.#ctx = ctx;
        this.#handle = handle;
        this.#owner = owner;
        this.width = info.width;
        this.height = info.height;
        this.durationSec = info.durationSec;
        this.fps = info.fps;
        this.hasAudio = !!info.hasAudio;
        this.audioCodec = info.audioCodec;
        this.audioSampleRate = info.audioSampleRate;
        this.audioChannels = info.audioChannels;
    }

    /** Whether `play()` is running the internal playback loop. */
    get playing(): boolean {
        return this.#playing;
    }

    /**
     * Register a listener for frame events. Fires on every frame that
     * becomes current via `nextFrame()`, `play()` ticks or `goto()`.
     * Returns an unsubscribe function.
     */
    onFrame(listener: (frame: import("./types.ts").VideoFrameEvent) => void): () => void {
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }

    #toFrame(raw: any): import("./types.ts").VideoFrame {
        let audio: Float32Array | null = null;
        if (raw.audio && raw.audioSamples > 0 && raw.audioChannels > 0) {
            audio = new Float32Array(
                raw.audio.buffer, raw.audio.byteOffset,
                raw.audioSamples * raw.audioChannels,
            );
        }
        return {
            rgba: raw.rgba,
            width: raw.width,
            height: raw.height,
            ptsSec: raw.ptsSec,
            frameIndex: raw.frameIndex,
            audio,
            audioSamples: raw.audioSamples ?? 0,
            audioChannels: raw.audioChannels ?? 0,
            audioSampleRate: raw.audioSampleRate ?? 0,
            metrics: raw.metrics,
        };
    }

    /**
     * Returns the next decoded RGBA frame, or null at end of video.
     * Emits an `onFrame` event.
     *
     * Zero-copy: `frame.rgba` (and `frame.audio`) are views into
     * decoder-owned buffers. They are only valid until the next
     * `nextFrame()` / `seek()` / `close()` call on this video.
     * Copy them if you need them longer.
     */
    nextFrame(): import("./types.ts").VideoFrame | null {
        if (this.#closed) return null;
        const raw = native.chafaVideoNext(this.#ctx, this.#handle);
        if (!raw) return null;
        const frame = this.#toFrame(raw);
        for (const l of this.#listeners) l(frame);
        return frame;
    }

    /**
     * Async iterator over decoded frames (yields as fast as decode
     * allows). Each yielded frame is the same object as `nextFrame()`
     * would return (zero-copy, valid until the next call).
     *
     * ```ts
     * for await (const frame of video) {
     *     process.stdout.write(chafa.renderRgba(frame.rgba, frame.width, frame.height).ansi);
     * }
     * ```
     */
    async *[Symbol.asyncIterator](): AsyncGenerator<import("./types.ts").VideoFrame> {
        while (true) {
            const frame = this.nextFrame();
            if (!frame) return;
            yield frame;
        }
    }

    /** Seek to the given time in seconds (nearest keyframe, clamped to
     *  `[0, duration]`). Equivalent to `goto()` without fetching a frame. */
    seek(timeSec: number): void {
        if (this.#closed) return;
        native.chafaVideoSeek(this.#ctx, this.#handle, timeSec);
    }

    /**
     * Jump to the given time and return the first decoded frame at/after
     * it. Emits an `onFrame` event.
     */
    goto(timeSec: number): import("./types.ts").VideoFrame | null {
        if (this.#closed) return null;
        native.chafaVideoSeek(this.#ctx, this.#handle, timeSec);
        return this.nextFrame();
    }

    /**
     * Render the video's first frame (cached at open time) with the
     * owning instance's current config - pixel mode aware.
     * Useful for a poster frame / preview.
     */
    thumbnail(): { ansi: string; metrics: import("./types.ts").CodecMetrics; width: number; height: number } {
        const raw = native.chafaVideoThumbnail?.(this.#ctx, this.#handle);
        if (!raw) throw new Error("Thumbnail unavailable");
        const rendered = this.#owner.renderRgba(raw.rgba, raw.width, raw.height);
        return { ansi: rendered.ansi, metrics: rendered.metrics, width: raw.width, height: raw.height };
    }

    /**
     * Start automatic playback: decodes and emits frames paced to their
     * presentation timestamps. Stops at the end of the video.
     * @param speed Playback speed multiplier (1.0 = native).
     */
    play(speed = 1.0): void {
        if (this.#closed || this.#playing) return;
        this.#playing = true;
        native.chafaVideoPlay?.(this.#ctx, this.#handle, speed);
        this.#playLoop();
    }

    /** Pause automatic playback. The current frame stays on screen. */
    pause(): void {
        this.#playing = false;
        native.chafaVideoPause?.(this.#ctx, this.#handle);
    }

    async #playLoop(): Promise<void> {
        let pts0 = -1;
        let wall0 = 0;
        while (this.#playing && !this.#closed) {
            const frame = this.nextFrame();
            if (!frame) {
                this.#playing = false;
                return;
            }
            if (pts0 < 0) {
                pts0 = frame.ptsSec;
                wall0 = performance.now() / 1000;
            }
            const wait = frame.ptsSec - pts0 - (performance.now() / 1000 - wall0);
            if (wait > 0.002) await new Promise((r) => setTimeout(r, wait * 1000));
        }
    }

    /** Close the video and free all resources. Stops playback. */
    close(): void {
        if (this.#closed) return;
        this.pause();
        this.#closed = true;
        this.#listeners.clear();
        native.chafaVideoClose(this.#ctx, this.#handle);
    }

    /**
     * Debug / perf snapshot: dimensions, duration, fps, audio track info,
     * playback state, and native decoder status (decode size, progress).
     */
    info(): {
        width: number; height: number; durationSec: number; fps: number;
        hasAudio: boolean; audioCodec: string; audioSampleRate: number; audioChannels: number;
        playing: boolean; listeners: number;
        status: any;
    } {
        let status: any = null;
        try { status = native.chafaVideoStatus?.(this.#ctx, this.#handle) ?? null; } catch {}
        return {
            width: this.width,
            height: this.height,
            durationSec: this.durationSec,
            fps: this.fps,
            hasAudio: this.hasAudio,
            audioCodec: this.audioCodec,
            audioSampleRate: this.audioSampleRate,
            audioChannels: this.audioChannels,
            playing: this.#playing,
            listeners: this.#listeners.size,
            status,
        };
    }

    /** @inheritdoc */
    [Symbol.dispose](): void {
        this.close();
    }
}

/* ═══════════════════════════════════════════════════════════════════
   Terminal detection
   ═══════════════════════════════════════════════════════════════════ */

/** Sync, env-only terminal detection (no I/O). Used by the constructor. */
function detectEnvDefaults(): Partial<import("./types.ts").ChafaConfig> {
    const env = process.env;
    const term = (env.TERM ?? "").toLowerCase();
    const out: Partial<import("./types.ts").ChafaConfig> = {};

    if (env.KITTY_WINDOW_ID || term.includes("kitty")) {
        out.pixelMode = PixelMode.KITTY;
    } else if (env.TERM_PROGRAM === "iTerm.app") {
        out.pixelMode = PixelMode.ITERM2;
    } else if (env.TERM_PROGRAM === "WezTerm") {
        out.pixelMode = PixelMode.KITTY;
    } else if (env.TERM_PROGRAM === "ghostty") {
        out.pixelMode = PixelMode.KITTY;
    } else if (env.KONSOLE_VERSION || env.TERM_PROGRAM === "Konsole") {
        out.pixelMode = PixelMode.KITTY;
    } else if (term.includes("sixel")) {
        out.pixelMode = PixelMode.SIXELS;
    }

    if (env.COLORTERM === "truecolor" || env.COLORTERM === "24bit") {
        out.canvasMode = CanvasMode.TRUECOLOR;
    } else if (term.includes("256color")) {
        out.canvasMode = CanvasMode.INDEXED_256;
    } else if (term === "dumb") {
        out.canvasMode = CanvasMode.FGBG;
    }

    return out;
}

/** Env snapshot used by both detect paths. */
function detectEnvInfo(): import("./types.ts").TerminalInfo["env"] {
    const env = process.env;
    return {
        TERM: env.TERM,
        TERM_PROGRAM: env.TERM_PROGRAM,
        COLORTERM: env.COLORTERM,
        KITTY_WINDOW_ID: env.KITTY_WINDOW_ID,
    };
}

/* Helper: run a batch of terminal queries concurrently and collect their
   responses. All queries are sent up-front (terminals answer in order), and
   each response is matched to its query by content, so the whole batch
   costs a single round-trip + one shared timeout. Queries that never get an
   answer resolve to "". Returns "" for every query on non-TTY. */
function termQueries(
    queries: { query: string; terminator: (buf: Buffer) => number }[],
    timeoutMs: number,
): Promise<string[]> {
    const stdout = process.stdout;
    const stdin = process.stdin as NodeJS.ReadStream & { fd?: number };
    if (!stdin.isTTY || !stdout.isTTY)
        return Promise.resolve(queries.map(() => ""));

    return new Promise<string[]>((resolve) => {
        const results: string[] = new Array<string>(queries.length).fill("");
        const pending = new Map<number, (buf: Buffer) => number>();
        queries.forEach((q, i) => pending.set(i, q.terminator));
        let buf: Buffer = Buffer.alloc(0);
        let done = false;
        /* Preserve the caller's raw-mode state (e.g. an app with its own
           keyboard handling running alongside the probe). */
        let wasRaw = false;
        try { wasRaw = !!(stdin as any).isRaw; } catch {}

        const finish = () => {
            if (done) return;
            done = true;
            try {
                stdin.setRawMode?.(wasRaw);
                if (!wasRaw) stdin.pause?.();
            } catch {}
            stdin.off?.("data", onData);
            resolve(results);
        };

        const consume = () => {
            for (const [i, term] of pending) {
                const idx = term(buf);
                if (idx >= 0) {
                    const end = buf.indexOf("\x1b\\", idx);
                    const consumed = end >= 0 ? end + 2 : idx + 16;
                    results[i] = buf.subarray(0, consumed).toString("binary");
                    pending.delete(i);
                    /* strip the consumed response; a chunk may hold several */
                    buf = buf.subarray(consumed);
                    consume();
                    break;
                }
            }
            if (pending.size === 0) finish();
        };

        const onData = (chunk: Buffer | string) => {
            const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            buf = buf.length === 0 ? b : Buffer.concat([buf, b]);
            consume();
        };

        setTimeout(finish, timeoutMs);
        try {
            stdin.setRawMode?.(true);
            stdin.resume?.();
            stdin.on?.("data", onData);
            for (const q of queries) stdout.write(q.query);
        } catch {
            finish();
        }
    });
}

/* Active terminal probe: pixel protocol support, cell size, truecolor.
   Falls back to env-only info on non-TTY or timeouts. */
async function probeTerminal(timeoutMs = 300): Promise<import("./types.ts").TerminalInfo> {
    const env = detectEnvInfo();
    const envDefaults = detectEnvDefaults();
    const term = (env.TERM ?? "").toLowerCase();

    const info: import("./types.ts").TerminalInfo = {
        term: env.TERM ?? "",
        termProgram: env.TERM_PROGRAM ?? "",
        termW: 0, termH: 0,
        cellW: 0, cellH: 0,
        pixelModes: [],
        pixelMode: envDefaults.pixelMode ?? PixelMode.SYMBOLS,
        canvasMode: envDefaults.canvasMode ?? CanvasMode.TRUECOLOR,
        truecolor: env.COLORTERM === "truecolor" || env.COLORTERM === "24bit",
        probed: false,
        env,
    };

    const stdout = process.stdout;
    const stdin = process.stdin as NodeJS.ReadStream & { fd?: number };
    if (!stdin.isTTY || !stdout.isTTY) return info;

    /* All independent probes run concurrently: one round-trip + one shared
       timeout instead of four sequential timeouts (worst case 300ms instead
       of 1.2s). Responses are matched to their query by content. */
    const [kittyResp, da1, px] = await termQueries([
        {
            /* Kitty graphics probe */
            query: "\x1b_Gi=31,s=1,v=1,a=q,t=d,f=24;AAAA\x1b\\",
            terminator: (b) => b.includes("\x1b_Gi=31") ? b.indexOf("\x1b_Gi=31") : -1,
        },
        {
            /* Sixel probe: DA1 response param 4 means sixel graphics support */
            query: "\x1b[c",
            terminator: (b) => {
                const s = b.toString("binary");
                const i = s.indexOf("\x1b[?");
                if (i >= 0) {
                    const end = s.indexOf("c", i);
                    return end > i ? i : -1;
                }
                return -1;
            },
        },
        {
            /* Cell size: CSI 14 t (pixels) */
            query: "\x1b[14t",
            terminator: (b) => b.includes("\x1b[4;") ? b.indexOf("\x1b[4;") : -1,
        },
    ], timeoutMs);

    if (kittyResp?.includes("OK")) {
        info.pixelModes.push(PixelMode.KITTY);
        info.probed = true;
    }

    if (da1) {
        info.probed = true;
        const params = da1.replace(/\x1b\[\?/g, "").split("c")[0]?.split(";").map(Number) ?? [];
        if (params.includes(4)) {
            info.pixelModes.push(PixelMode.SIXELS);
        }
    }

    if (px) {
        const m = /\[4;(\d+);(\d+)t/.exec(px);
        if (m) {
            const ph = +m[1]!, pw = +m[2]!;
            const [cells] = await termQueries([{
                /* CSI 18 t (cells) - only sent when 14 t answered */
                query: "\x1b[18t",
                terminator: (b) => b.includes("\x1b[8;") ? b.indexOf("\x1b[8;") : -1,
            }], timeoutMs);
            const mc = /\[8;(\d+);(\d+)t/.exec(cells ?? "");
            if (mc) {
                info.termH = +mc[1]!;
                info.termW = +mc[2]!;
                if (info.termW > 0 && info.termH > 0) {
                    info.cellW = Math.max(1, Math.round(pw / info.termW));
                    info.cellH = Math.max(1, Math.round(ph / info.termH));
                }
                info.probed = true;
            }
        }
    }

    /* Preference order */
    if (info.pixelModes.length === 0) {
        const m = envDefaults.pixelMode;
        if (m !== undefined && m !== PixelMode.SYMBOLS) info.pixelModes = [m];
    }
    if (info.pixelModes.length > 0) info.pixelMode = info.pixelModes[0]!;

    return info;
}

/* ═══════════════════════════════════════════════════════════════════
   Chafa - main rendering instance
   ═══════════════════════════════════════════════════════════════════ */

/**
 * The main entry point for rendering images with chafa.
 *
 * Each instance holds its own configuration and caches a single chafa
 * canvas internally (rebuilt when config changes). Create multiple
 * instances for different rendering settings.
 *
 * Supports `using` for automatic cleanup:
 * ```ts
 * using chafa = new Chafa({ termW: 80, termH: 24, canvasMode: CanvasMode.TRUECOLOR });
 * const { ansi } = chafa.render(imageBuffer);
 * // chafa.destroy() called automatically here
 * ```
 *
 * @example
 * ```ts
 * import Chafa, { CanvasMode, DitherMode } from "static-chafa";
 *
 * const chafa = new Chafa({ termW: 80, termH: 24 });
 *
 * // Quick render
 * const { ansi, metrics } = chafa.render(imageBuffer);
 * console.log(`Rendered in ${metrics.totalMs.toFixed(1)}ms`);
 *
 * // Decode once, render with multiple configs
 * const img = chafa.decode(imageBuffer);
 * chafa.updateConfig({ canvasMode: CanvasMode.INDEXED_256 });
 * const { ansi: indexed } = chafa.renderRgba(img.rgba, img.width, img.height);
 *
 * chafa.destroy();
 * ```
 */
export class Chafa {
    /** Native context pointer (napi_external). */
    #ctx: number;

    /** Current configuration snapshot. Use `updateConfig()` to mutate. */
    #config: import("./types.ts").ChafaConfig;

    #destroyed = false;
    #lastMetrics: import("./types.ts").CodecMetrics | null = null;
    #probed = false;
    #rendered = false;
    #probeReady: Promise<void> = Promise.resolve();
    /** Config keys the user set explicitly (constructor or updateConfig).
        Tuned defaults never touch these. */
    #userSet = new Set<string>();

    /**
     * Create a new chafa instance.
     *
     * Unspecified config fields are auto-detected from the environment
     * (e.g. `$TERM`, `$KITTY_WINDOW_ID`, `$COLORTERM`) for the best
     * out-of-the-box experience: a kitty terminal gets kitty pixel mode,
     * truecolor-capable terminals get truecolor, etc. Explicitly passing
     * a field always wins. Use {@link Chafa.detect} for a full active
     * probe of the terminal's capabilities.
     *
     * When the terminal supports it (TTY), the constructor also starts a
     * one-shot async probe of the real cell pixel size. Pixel modes emit
     * images at `termW × cellW` by `termH × cellH` pixels, so without the
     * real cell size the output can draw smaller than the terminal area.
     * The probe patches `cellW`/`cellH` (and `termW`/`termH`) as soon as it
     * completes - only for fields you didn't set explicitly.
     *
     * @param config Partial config overrides.
     */
    constructor(config?: import("./types.ts").ChafaConfigPartial) {
        const auto = detectEnvDefaults();
        const user = config ?? {};
        const explicit = new Set(Object.keys(user));
        this.#userSet = explicit;
        for (const key of Object.keys(auto)) {
            if (!(key in user)) (user as any)[key] = (auto as any)[key];
        }
        this.#config = { ...defaultChafaConfig(), ...user };
        if (this.#config.tuned) this.#applyTuned();
        const r = native.chafaCreate(this.#config);
        if (!r) throw new Error("Failed to create chafa instance");
        this.#ctx = r;

        /* Pixel modes must fill the terminal's real pixel area - and env-only
           detection misses terminals whose $TERM/$TERM_PROGRAM say nothing
           (e.g. sixel-capable terminals). Fire the async probe whenever the
           user left pixelMode or cellW/cellH unset; it lands well before the
           first render in practice. Explicitly configured fields are never
           touched, and the patch is skipped if the instance already
           rendered/opened media (a mid-stream resize would be visible).
           Await `probeReady` before rendering when a guaranteed first-frame
           size/mode matters. */
        if (
            (!explicit.has("pixelMode") ||
             !explicit.has("cellW") || !explicit.has("cellH")) &&
            process.stdin.isTTY && process.stdout.isTTY
        ) {
            this.#probeReady = probeTerminal(300).then((info) => {
                if (this.#destroyed || this.#probed || this.#rendered) return;
                this.#probed = true;
                const patch: import("./types.ts").ChafaConfigPartial = {};
                /* Upgrade to a probed pixel protocol when the user didn't
                   pick one and env detection found nothing. */
                if (!explicit.has("pixelMode") &&
                    this.#config.pixelMode === PixelMode.SYMBOLS &&
                    info.pixelModes.length > 0) {
                    patch.pixelMode = info.pixelModes[0]!;
                }
                if (!explicit.has("cellW") && info.cellW > 0) patch.cellW = info.cellW;
                if (!explicit.has("cellH") && info.cellH > 0) patch.cellH = info.cellH;
                if (!explicit.has("termW") && info.termW > 0) patch.termW = info.termW;
                if (!explicit.has("termH") && info.termH > 0) patch.termH = info.termH;
                if (Object.keys(patch).length > 0) this.updateConfig(patch);
            }).catch(() => {});
        }
    }

    /**
     * Resolves once the constructor's automatic terminal probe has
     * finished (immediately when no probe runs - non-TTY, symbol mode, or
     * fully explicit config). Await it before opening media when pixel-mode
     * output must be sized correctly from the very first frame.
     */
    get probeReady(): Promise<void> {
        return this.#probeReady;
    }

    /**
     * Read-only snapshot of the current effective configuration.
     * Use `updateConfig()` to change settings.
     */
    get config(): Readonly<import("./types.ts").ChafaConfig> {
        return this.#config;
    }

    /**
     * Update one or more configuration fields.
     * Invalidates the internal canvas so the next render picks up new settings.
     *
     * Fields you pass become "user-set": tuned defaults (see {@link tunedDefaults})
     * will never override them again. When `pixelMode` / `termW` / `termH`
     * change, tuned defaults are re-derived for the new mode/size and applied
     * to all fields you haven't set yourself.
     *
     * @param config Fields to update. Omitted fields keep their current value.
     *
     * @example
     * ```ts
     * chafa.updateConfig({
     *     canvasMode: CanvasMode.INDEXED_256,
     *     ditherMode: DitherMode.DIFFUSION,
     *     symbols: "block+border+space-wide",
     * });
     * ```
     */
    updateConfig(config: import("./types.ts").ChafaConfigPartial): void {
        for (const key of Object.keys(config)) this.#userSet.add(key);
        const modeChanged =
            (config.pixelMode !== undefined && config.pixelMode !== this.#config.pixelMode) ||
            (config.termW !== undefined && config.termW !== this.#config.termW) ||
            (config.termH !== undefined && config.termH !== this.#config.termH);
        Object.assign(this.#config, config);
        if (this.#config.tuned && modeChanged) this.#applyTuned();
        native.chafaConfigure(this.#ctx, this.#config);
    }

    /** Fill fields the user didn't set with tuned per-mode/size defaults. */
    #applyTuned(): void {
        const tuned = tunedDefaults(
            this.#config.pixelMode,
            this.#config.termW,
            this.#config.termH,
        );
        for (const [key, value] of Object.entries(tuned)) {
            if (!this.#userSet.has(key)) (this.#config as any)[key] = value;
        }
    }

    /* ════ Image operations ════ */

    /**
     * Decode any supported image format to raw RGBA pixels.
     *
     * Useful for pre-decoding an image once then rendering multiple times
     * with different configs via `renderRgba()`.
     *
     * @param data Encoded image bytes (PNG, JPEG, BMP, GIF, WebP).
     * @returns A {@link ChafaImage} holding the decoded pixels and metadata.
     */
    decode(data: Buffer | Uint8Array): ChafaImage {
        this.#ensureAlive();
        const img = new ChafaImage(native.chafaDecode(ensureBuffer(data)));
        this.#lastMetrics = img.metrics;
        return img;
    }

    /**
     * Render any supported image to ANSI terminal art in a single call.
     *
     * This is the simplest path: decode + draw + build ANSI string.
     * For repeated renders of the same image, prefer `decode()` then `renderRgba()`.
     *
     * @param data Encoded image bytes.
     * @returns ANSI string and detailed timing/metrics.
     */
    render(data: Buffer | Uint8Array): import("./types.ts").RenderResult {
        this.#ensureAlive();
        this.#rendered = true;
        const r = native.chafaRender(this.#ctx, ensureBuffer(data));
        this.#lastMetrics = r.metrics;
        return r;
    }

    /**
     * Render pre-decoded RGBA pixels to ANSI terminal art.
     *
     * Bypasses the decode step - use when you already have a `ChafaImage` from `decode()`.
     *
     * @param rgba RGBA pixel buffer (8 bits per channel, unassociated alpha).
     * @param width Image width in pixels.
     * @param height Image height in pixels.
     * @returns ANSI string and detailed timing/metrics.
     */
    renderRgba(rgba: Uint8Array, width: number, height: number): import("./types.ts").RenderResult {
        this.#ensureAlive();
        this.#rendered = true;
        const r = native.chafaRenderRgba(this.#ctx, ensureBuffer(rgba), width, height);
        this.#lastMetrics = r.metrics;
        return r;
    }

    /**
     * Render any supported image to a character cell matrix.
     *
     * The result is a JSON-encoded 3D array: `[[[charCode, fg, bg], ...], ...]`
     * where each inner triplet is `[Unicode code point, foreground color, background color]`.
     * Colors are -1 for transparent, packed 0xRRGGBB otherwise (truecolor mode),
     * or palette indices 0–255 (indexed modes).
     *
     * @param data Encoded image bytes.
     * @returns JSON matrix string and metrics.
     */
    renderMatrix(data: Buffer | Uint8Array): import("./types.ts").MatrixResult {
        this.#ensureAlive();
        this.#rendered = true;
        if (this.#config.pixelMode !== PixelMode.SYMBOLS)
            throw new Error("renderMatrix is only available in symbol mode (pixelMode: PixelMode.SYMBOLS)");
        return native.chafaRenderMatrix(this.#ctx, ensureBuffer(data));
    }

    /**
     * Render pre-decoded RGBA pixels to a character cell matrix.
     * @param rgba RGBA pixel buffer.
     * @param width Image width in pixels.
     * @param height Image height in pixels.
     * @returns JSON matrix string and metrics.
     */
    renderMatrixRgba(rgba: Uint8Array, width: number, height: number): import("./types.ts").MatrixResult {
        this.#ensureAlive();
        this.#rendered = true;
        if (this.#config.pixelMode !== PixelMode.SYMBOLS)
            throw new Error("renderMatrixRgba is only available in symbol mode (pixelMode: PixelMode.SYMBOLS)");
        return native.chafaRenderMatrixRgba(this.#ctx, ensureBuffer(rgba), width, height);
    }

    /* ════ Animation ════ */

    /**
     * Open an animated GIF or WebP image for frame-by-frame playback.
     *
     * @param data Encoded image bytes.
     * @returns A {@link ChafaAnimation} instance for controlling playback.
     *
     * @example
     * ```ts
     * const anim = chafa.openAnimation(gifBuf);
     * while (true) {
     *     const f = anim.next();
     *     if (!f) break;
     *     const { ansi, metrics } = anim.renderFrame(f.frameIndex);
     *     await new Promise(r => setTimeout(r, metrics.frameDelayMs));
     * }
     * anim.close();
     * ```
     */
    openAnimation(data: Buffer | Uint8Array): ChafaAnimation {
        this.#ensureAlive();
        this.#rendered = true;
        const { handle, metrics } = native.chafaAnimOpen(this.#ctx, ensureBuffer(data));
        return new ChafaAnimation(this.#ctx, handle, metrics);
    }

    /**
     * Open a video file (MP4, MKV, WebM, AVI, etc.) for frame-by-frame decode.
     *
     * Requires FFmpeg shared libraries installed on the system.
     * Throws a descriptive error if FFmpeg is not found.
     *
     * A single Chafa instance can own the video decoder and render its
     * frames - no second instance is needed:
     * ```ts
     * const chafa = new Chafa({ termW: 80, termH: 24, pixelMode: PixelMode.SIXELS });
     * const video = chafa.openVideo(buf);
     * while (true) {
     *     const f = video.nextFrame();
     *     if (!f) break;
     *     const { ansi } = chafa.renderRgba(f.rgba, f.width, f.height);
     *     process.stdout.write(ansi);
     * }
     * ```
     *
     * @param data Video file bytes.
     * @param decodeW Target decode width in pixels. `0` (default) decodes
     *   at the pixel-fit size (`termW x cellW` by `termH x cellH`, aspect
     *   preserving) so frames render 1:1.
     * @param decodeH Target decode height in pixels. `0` = fit size.
     * @returns A {@link ChafaVideo} instance for frame iteration.
     */
    openVideo(data: Buffer | Uint8Array, decodeW?: number, decodeH?: number): ChafaVideo {
        this.#ensureAlive();
        this.#rendered = true;
        const { handle, metrics } = native.chafaVideoOpen(
            this.#ctx, ensureBuffer(data), decodeW ?? 0, decodeH ?? 0
        );
        const info = native.chafaVideoInfo(this.#ctx, handle);
        return new ChafaVideo(this.#ctx, handle, info, this);
    }

    /* ════ Lifecycle ════ */

    /**
     * Coverage bitmaps for glyphs in the active symbol map (8 bytes per
     * codepoint: 8 rows of 8 bits, LSB = leftmost pixel, 1 = glyph pixel).
     * Uses the exact symbol map the renderer uses, so the returned bitmaps
     * rasterize symbol-mode output faithfully (used by the tuning harness).
     *
     * @param charCodes Codepoints to look up.
     * @returns Uint8Array of `charCodes.length * 8` bytes.
     */
    symbolGlyphs(charCodes: number[] | Uint32Array): Uint8Array {
        this.#ensureAlive();
        const u32 = charCodes instanceof Uint32Array
            ? charCodes
            : Uint32Array.from(charCodes);
        const buf = Buffer.from(u32.buffer, u32.byteOffset, u32.byteLength);
        const out = native.chafaSymbolGlyphs(this.#ctx, buf);
        if (!out) return new Uint8Array(u32.length * 8);
        return new Uint8Array(out.buffer, out.byteOffset, u32.length * 8);
    }

    /**
     * Free all native resources (canvas, pending animations).
     * After calling this, the instance is permanently unusable.
     *
     * Called automatically when the instance is garbage collected (NAPI path)
     * or at end of `using` scope.
     */
    destroy(): void {
        if (this.#destroyed) return;
        this.#destroyed = true;
        native.chafaFree(this.#ctx);
    }

    /** @inheritdoc */
    [Symbol.dispose](): void {
        this.destroy();
    }

    #ensureAlive(): void {
        if (this.#destroyed)
            throw new Error("Chafa instance has been destroyed");
    }

    /* ════ Static utilities ════ */

    /**
     * Get a human-readable string of supported CPU features
     * (e.g. "POPCNT"). Requires NAPI or FFI native addon.
     */
    static supportedFeatures(): string {
        try { return native.chafaFeatures?.() ?? ""; }
        catch { return ""; }
    }

    /**
     * Set the number of worker threads chafa's internal batch processors
     * may spawn (per-process global). Defaults to the CPU count. Lower it
     * when many renderer processes/workers run in parallel to avoid
     * oversubscription (the tuner uses this).
     */
    static setThreads(n: number): void {
        try { native.chafaSetThreads?.(Math.max(1, n | 0)); } catch {}
    }

    /**
     * Actively probe the connected terminal and return its capabilities:
     * pixel protocol support (kitty / sixels), cell pixel size, terminal
     * dimensions, and color mode.
     *
     * Sends escape-sequence queries to stdout and reads the replies from
     * stdin. Requires a TTY; falls back to environment detection silently
     * otherwise (e.g. in tests, pipes, or non-interactive shells).
     *
     * ```ts
     * const info = await Chafa.detect();
     * const chafa = new Chafa({
     *     pixelMode: info.pixelMode,
     *     cellW: info.cellW || 8,
     *     cellH: info.cellH || 16,
     *     canvasMode: info.canvasMode,
     *     termW: info.termW || 80,
     *     termH: info.termH || 24,
     * });
     * ```
     */
    static async detect(timeoutMs = 300): Promise<import("./types.ts").TerminalInfo> {
        return probeTerminal(timeoutMs);
    }

    /**
     * Probe the terminal and apply the detected capabilities to this
     * instance (pixel mode, cell size, color mode, terminal size).
     * Explicitly configured fields are kept - only unspecified ones are
     * filled in.
     */
    async autoDetect(timeoutMs = 300): Promise<import("./types.ts").TerminalInfo> {
        const info = await probeTerminal(timeoutMs);
        this.#probed = true;
        const patch: Partial<import("./types.ts").ChafaConfig> = {};
        if (info.pixelMode !== PixelMode.SYMBOLS && !("pixelMode" in this.#config)) {
            /* constructor may have filled pixelMode from env; only apply when
               the user didn't pass one explicitly. env-filled == safe to replace. */
            patch.pixelMode = info.pixelMode;
        }
        if (info.cellW > 0 && info.cellH > 0) {
            patch.cellW = info.cellW;
            patch.cellH = info.cellH;
        }
        if (info.termW > 0) patch.termW = info.termW;
        if (info.termH > 0) patch.termH = info.termH;
        patch.canvasMode = info.canvasMode;
        this.updateConfig(patch);
        return info;
    }

    /**
     * Debug / perf snapshot for this instance: current config, features,
     * and metrics of the most recent operation.
     */
    info(): { config: Readonly<import("./types.ts").ChafaConfig>; features: string; lastMetrics: import("./types.ts").CodecMetrics | null } {
        return {
            config: this.#config,
            features: Chafa.supportedFeatures(),
            lastMetrics: this.#lastMetrics,
        };
    }

    /**
     * Convert an ANSI escape sequence string to HTML with inline styles.
     *
     * Handles SGR color codes (8-color, 256-color, truecolor), bold,
     * underline, and inversion. Useful for web-based previews.
     *
     * @param ansi Terminal art string from `render()` or `renderFrame()`.
     * @returns HTML string with `<span style="...">` elements and `<br>` line breaks.
     */
    static ansiToHtml(ansi: string): string {
        const lines = ansi.split("\n");
        const htmlLines: string[] = [];
        for (const line of lines) {
            const parts: string[] = [];
            let i = 0;
            let fg = 255, bg = -1, bold = false, inverted = false, underline = false;
            let css = "";
            let run = "";
            const codes: number[] = [];

            const flush = () => {
                if (run.length === 0) return;
                if (css.length === 0) parts.push(run);
                else parts.push(`<span style="${css}">${run}</span>`);
                run = "";
            };

            while (i < line.length) {
                if (line[i] === "\x1b" && line[i + 1] === "[") {
                    const end = line.indexOf("m", i + 2);
                    if (end === -1) break;
                    const count = parseSgr(line, i + 2, end, codes);
                    let j = 0;
                    while (j < count) {
                        const c = codes[j]!;
                        if (c === 0) { fg = 255; bg = -1; bold = false; inverted = false; underline = false; }
                        else if (c === 1) bold = true;
                        else if (c === 4) underline = true;
                        else if (c === 7) inverted = true;
                        else if (c >= 30 && c <= 37) fg = c - 30;
                        else if (c === 38 && codes[j + 1] === 5 && codes[j + 2] !== undefined) { fg = codes[j + 2]!; j += 2; }
                        else if (c === 38 && codes[j + 1] === 2 && codes[j + 4] !== undefined) { fg = (codes[j + 2]! << 16) | (codes[j + 3]! << 8) | codes[j + 4]!; j += 4; }
                        else if (c === 39) fg = 255;
                        else if (c >= 40 && c <= 47) bg = c - 40;
                        else if (c === 48 && codes[j + 1] === 5 && codes[j + 2] !== undefined) { bg = codes[j + 2]!; j += 2; }
                        else if (c === 48 && codes[j + 1] === 2 && codes[j + 4] !== undefined) { bg = (codes[j + 2]! << 16) | (codes[j + 3]! << 8) | codes[j + 4]!; j += 4; }
                        else if (c === 49) bg = -1;
                        j++;
                    }
                    i = end + 1;

                    /* Compute the CSS for the new state once, then group all
                       following characters sharing it into a single span. */
                    const styles: string[] = [];
                    if (fg >= 0) {
                        if (typeof fg === "number" && fg > 255)
                            styles.push(`color:#${(fg & 0xffffff).toString(16).padStart(6, "0")}`);
                    }
                    if (bg >= 0 && typeof bg === "number") {
                        if (bg > 255)
                            styles.push(`background-color:#${(bg & 0xffffff).toString(16).padStart(6, "0")}`);
                    }
                    if (bold) styles.push("font-weight:bold");
                    if (underline) styles.push("text-decoration:underline");
                    if (inverted) {
                        const tmp = (styles[0] ?? "").replace("color:", "background-color:");
                        if (styles[0]) styles[0] = styles[0]!.replace("background-color:", "color:");
                        if (tmp && !styles.includes(tmp)) styles.push(tmp);
                    }
                    const nextCss = styles.join(";");
                    if (nextCss !== css) {
                        flush();
                        css = nextCss;
                    }
                    continue;
                }

                const ch = line[i]!;
                run += ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : ch;
                i++;
            }
            flush();
            htmlLines.push(parts.join(""));
        }
        return htmlLines.join("<br>");
    }

    /**
     * Convert an ANSI terminal art string to an array of `console.log` arguments.
     *
     * Returns `[formatString, ...cssStyles]` suitable for `console.log(...)`.
     * Only the 8 basic ANSI colors + bright variants are mapped (256-color and
     * truecolor are approximated).
     *
     * @param ansi Terminal art string from `render()` or `renderFrame()`.
     * @returns Array suitable for spread into `console.log(...)`.
     */
    static ansiToConsoleArgs(ansi: string): string[] {
        const lines = ansi.split("\n");
        const args: string[] = [];
        let fmt = "";

        let first = true;
        for (const line of lines) {
            if (!first) { fmt += "\n%c"; args.push(""); }
            first = false;

            let i = 0;
            let fg = 255, bg = -1, bold = false, inverted = false;
            let currentFmt = "";
            let currentStyles: string[] = [];
            const codes: number[] = [];

            const flush = () => {
                if (currentFmt.length > 0) {
                    fmt += "%c" + currentFmt;
                    args.push(currentStyles.join(";"));
                    currentFmt = "";
                    currentStyles = [];
                }
            };

            while (i < line.length) {
                if (line[i] === "\x1b" && line[i + 1] === "[") {
                    flush();
                    const end = line.indexOf("m", i + 2);
                    if (end === -1) break;
                    const count = parseSgr(line, i + 2, end, codes);
                    let j = 0;
                    while (j < count) {
                        const c = codes[j]!;
                        if (c === 0) { fg = 255; bg = -1; bold = false; inverted = false; }
                        else if (c === 1) bold = true;
                        else if (c === 7) inverted = true;
                        else if (c >= 30 && c <= 37) fg = c - 30;
                        else if (c === 38 && codes[j + 1] === 5 && codes[j + 2] !== undefined) { fg = codes[j + 2]!; j += 2; }
                        else if (c === 38 && codes[j + 1] === 2 && codes[j + 4] !== undefined) { fg = (codes[j + 2]! << 16) | (codes[j + 3]! << 8) | codes[j + 4]!; j += 4; }
                        else if (c === 39) fg = 255;
                        else if (c >= 40 && c <= 47) bg = c - 40;
                        else if (c === 48 && codes[j + 1] === 5 && codes[j + 2] !== undefined) { bg = codes[j + 2]!; j += 2; }
                        else if (c === 48 && codes[j + 1] === 2 && codes[j + 4] !== undefined) { bg = (codes[j + 2]! << 16) | (codes[j + 3]! << 8) | codes[j + 4]!; j += 4; }
                        else if (c === 49) bg = -1;
                        j++;
                    }
                    i = end + 1;

                    const css: string[] = [];
                    if (fg >= 0) {
                        if (fg > 255) css.push(`color:#${(fg & 0xffffff).toString(16).padStart(6, "0")}`);
                        else if (fg < 8) css.push(`color:${BASIC_COLORS_8[fg]}`);
                        else css.push(`color:${BASIC_COLORS_BRIGHT[fg - 8]}`);
                    }
                    if (bg >= 0) {
                        if (bg > 255) css.push(`background:#${(bg & 0xffffff).toString(16).padStart(6, "0")}`);
                        else if (bg < 8) css.push(`background:${BASIC_COLORS_8[bg]}`);
                        else css.push(`background:${BASIC_COLORS_BRIGHT[bg - 8]}`);
                    }
                    if (bold) css.push("font-weight:bold");
                    if (inverted) { /* CSS invert not well supported, skip */ }
                    currentStyles = css;
                    continue;
                }

                currentFmt += line[i]!;
                i++;
            }
            flush();
        }

        return [fmt, ...args];
    }
}

/** 8 standard ANSI colors (indices 0–7). */
const BASIC_COLORS_8 = [
    "#000", "#c00", "#0a0", "#a50", "#00f", "#a0a", "#0aa", "#aaa",
];

/** 8 bright ANSI colors (indices 8–15). */
const BASIC_COLORS_BRIGHT = [
    "#555", "#f55", "#5f5", "#ff5", "#55f", "#f5f", "#5ff", "#fff",
];

export default Chafa;
