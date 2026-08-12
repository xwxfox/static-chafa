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
import { defaultConfig as defaultChafaConfig } from "./types.ts";

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
    DitherMode,
    ColorExtractor,
    ColorSpace,
    Passthrough,
    defaultConfig,
} from "./types.ts";

/* -- helpers -- */
function ensureBuffer(data: Uint8Array): Buffer {
    if (Buffer.isBuffer(data)) return data as Buffer;
    return Buffer.from(data);
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
 * automatic cleanup at end of scope.
 *
 * ```ts
 * const anim = chafa.openAnimation(gifBuf);
 * while (true) {
 *     const frame = anim.next();
 *     if (!frame) break;
 *     const { ansi, metrics } = anim.renderFrame(frame.frameIndex);
 *     process.stdout.write(ansi);
 *     await sleep(metrics.frameDelayMs);
 * }
 * anim.close();
 * ```
 */
export class ChafaAnimation {
    #ctx: number;
    #handle: number;
    #closed = false;

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
     * Advance to the next frame.
     * @returns Frame info or `null` when playback ends.
     */
    next(): import("./types.ts").AnimFrame | null {
        if (this.#closed) return null;
        return native.chafaAnimNext(this.#ctx, this.#handle);
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

    /** Close the animation and free native resources. */
    close(): void {
        if (this.#closed) return;
        this.#closed = true;
        native.chafaAnimClose(this.#ctx, this.#handle);
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
 * Videos are decoded to RGBA at a configurable target resolution and
 * stored in an 8-frame ring buffer for smooth playback. Audio metadata
 * is tracked but audio is not decoded (future feature).
 */
export class ChafaVideo {
    #ctx: number;
    #handle: number;
    #closed = false;

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

    constructor(ctx: number, handle: number, info: any) {
        this.#ctx = ctx;
        this.#handle = handle;
        this.width = info.width;
        this.height = info.height;
        this.durationSec = info.durationSec;
        this.fps = info.fps;
        this.hasAudio = info.hasAudio;
        this.audioCodec = info.audioCodec;
        this.audioSampleRate = info.audioSampleRate;
        this.audioChannels = info.audioChannels;
    }

    /** Returns the next decoded RGBA frame, or null at end of video. */
    nextFrame(): import("./types.ts").VideoFrame | null {
        if (this.#closed) return null;
        return native.chafaVideoNext(this.#ctx, this.#handle);
    }

    /** Seek to the given time in seconds (nearest keyframe). */
    seek(timeSec: number): void {
        if (this.#closed) return;
        native.chafaVideoSeek(this.#ctx, this.#handle, timeSec);
    }

    /** Close the video and free all resources. */
    close(): void {
        if (this.#closed) return;
        this.#closed = true;
        native.chafaVideoClose(this.#ctx, this.#handle);
    }

    /** @inheritdoc */
    [Symbol.dispose](): void {
        this.close();
    }
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

    /**
     * Create a new chafa instance.
     * @param config Partial config overrides. Unspecified fields use {@link defaultConfig}.
     */
    constructor(config?: import("./types.ts").ChafaConfigPartial) {
        this.#config = { ...defaultChafaConfig(), ...config };
        const r = native.chafaCreate(this.#config);
        if (!r) throw new Error("Failed to create chafa instance");
        this.#ctx = r;
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
        Object.assign(this.#config, config);
        native.chafaConfigure(this.#ctx, this.#config);
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
        return new ChafaImage(native.chafaDecode(ensureBuffer(data)));
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
        return native.chafaRender(this.#ctx, ensureBuffer(data));
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
        return native.chafaRenderRgba(this.#ctx, ensureBuffer(rgba), width, height);
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
        const { handle, metrics } = native.chafaAnimOpen(this.#ctx, ensureBuffer(data));
        return new ChafaAnimation(this.#ctx, handle, metrics);
    }

    /**
     * Open a video file (MP4, MKV, WebM, AVI, etc.) for frame-by-frame decode.
     *
     * Requires FFmpeg shared libraries installed on the system.
     * Throws a descriptive error if FFmpeg is not found.
     *
     * @param data Video file bytes.
     * @param decodeW Target decode width (0 = native resolution).
     * @param decodeH Target decode height (0 = native resolution).
     * @returns A {@link ChafaVideo} instance for frame iteration.
     */
    openVideo(data: Buffer | Uint8Array, decodeW?: number, decodeH?: number): ChafaVideo {
        this.#ensureAlive();
        const { handle, metrics } = native.chafaVideoOpen(
            this.#ctx, ensureBuffer(data), decodeW ?? 0, decodeH ?? 0
        );
        const info = native.chafaVideoInfo(this.#ctx, handle);
        return new ChafaVideo(this.#ctx, handle, info);
    }

    /* ════ Lifecycle ════ */

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
            let html = "";
            let i = 0;
            let fg = 255, bg = -1, bold = false, inverted = false, underline = false;

            while (i < line.length) {
                if (line[i] === "\x1b" && line[i + 1] === "[") {
                    const end = line.indexOf("m", i + 2);
                    if (end === -1) break;
                    const codes = line.slice(i + 2, end).split(";").map(Number);
                    let j = 0;
                    while (j < codes.length) {
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
                    continue;
                }

                const ch = line[i]!;
                const escaped = ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : ch;

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

                html += styles.length > 0
                    ? `<span style="${styles.join(";")}">${escaped}</span>`
                    : escaped;
                i++;
            }
            htmlLines.push(html);
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
                    const codes = line.slice(i + 2, end).split(";").map(Number);
                    let j = 0;
                    while (j < codes.length) {
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
