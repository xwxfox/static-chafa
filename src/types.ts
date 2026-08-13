/** @file types.ts - Shared types, enums, and default configuration for static-chafa.
 *
 *  Chafa config maps 1:1 to the chafa CLI utility's options.
 *  See https://hpjansson.org/chafa/man/ for complete documentation.
 */

/** Image format detected by the decoder.
 *
 *  - `0` - PNG
 *  - `1` - JPEG
 *  - `2` - BMP
 *  - `3` - GIF
 *  - `4` - WebP
 */
export type ChafaFormat = number;

export const FMT_NAMES = ["PNG", "JPEG", "BMP", "GIF", "WebP"] as const;

/* ═══════════════════════════════════════════════════════════════════
   Chafa output mode enums
   ═══════════════════════════════════════════════════════════════════ */

/** Chafa canvas color modes.
 *
 *  - `TRUECOLOR` (0) - 24-bit direct color. Best quality, no dithering.
 *  - `INDEXED_256` (1) - 256-color palette.
 *  - `INDEXED_240` (2) - 256-color palette minus the 16 aixterm codes (safer cross-terminal).
 *  - `INDEXED_16` (3) - 16 aixterm colors.
 *  - `FGBG_BGFG` (4) - Default FG/BG colors plus inversion.
 *  - `FGBG` (5) - Default FG/BG colors only. No ANSI codes emitted.
 *  - `INDEXED_8` (6) - 8 basic ANSI colors.
 *  - `INDEXED_16_8` (7) - 16 FG colors (8 via bold) and 8 BG colors.
 */
export const CanvasMode = {
    TRUECOLOR: 0,
    INDEXED_256: 1,
    INDEXED_240: 2,
    INDEXED_16: 3,
    FGBG_BGFG: 4,
    FGBG: 5,
    INDEXED_8: 6,
    INDEXED_16_8: 7,
} as const;

/** Chafa pixel rendering modes.
 *
 *  - `SYMBOLS` (0) - Unicode block characters (ANSI art). Default.
 *  - `SIXELS` (1) - Sixel bitmap protocol. Requires sixel-capable terminal.
 *  - `KITTY` (2) - Kitty terminal graphics protocol.
 *  - `ITERM2` (3) - iTerm2 inline image protocol.
 */
export const PixelMode = {
    SYMBOLS: 0,
    SIXELS: 1,
    KITTY: 2,
    ITERM2: 3,
} as const;

/** Chafa dithering modes.
 *
 *  - `NONE` (0) - No dithering.
 *  - `ORDERED` (1) - Bayer-style ordered dithering. Fast, predictable.
 *  - `DIFFUSION` (2) - Error-diffusion dithering (Floyd-Steinberg). Smooth, slower.
 *  - `NOISE` (3) - Blue-noise dithering. Good at low color counts, moderate perf.
 */
export const DitherMode = {
    NONE: 0,
    ORDERED: 1,
    DIFFUSION: 2,
    NOISE: 3,
} as const;

/** Chafa color extraction strategies.
 *
 *  - `AVERAGE` (0) - Average color of each symbol's coverage area. Fast.
 *  - `MEDIAN` (1) - Median color. Better at handling outliers, slightly slower.
 */
export const ColorExtractor = {
    AVERAGE: 0,
    MEDIAN: 1,
} as const;

/** Chafa color spaces for distance calculations.
 *
 *  - `RGB` (0) - Fast, straightforward. Good enough for most use cases.
 *  - `DIN99D` (1) - Perceptually uniform. Better color matching, slower.
 */
export const ColorSpace = {
    RGB: 0,
    DIN99D: 1,
} as const;

/** Protocol passthrough guards for multiplexers.
 *
 *  - `NONE` (0) - No wrapping. Works in most terminals.
 *  - `SCREEN` (1) - Wrap output for GNU Screen compatibility.
 *  - `TMUX` (2) - Wrap output for tmux compatibility.
 */
export const Passthrough = {
    NONE: 0,
    SCREEN: 1,
    TMUX: 2,
} as const;

/** Pixel-mode size fitting strategy.
 *
 *  Controls how source pixels are matched to the terminal area in
 *  pixel modes (SIXELS, KITTY, ITERM2). Ignored in symbol mode.
 *
 *  In pixel modes the target pixel area is `termW × cellW` by
 *  `termH × cellH` (default cells 8×16, matching a typical 1:2 font
 *  aspect, so the output fills the same area as symbol mode).
 *
 *  - `NONE` (0) - Hand source pixels to chafa unchanged. Chafa's
 *    internal scaler fills the target area. Equivalent to letting
 *    chafa do everything (its CLI behavior).
 *  - `SCALE` (1) - Pre-scale the source pixels to the target area
 *    (aspect-preserving fit, centered) before handing them to chafa.
 *    Chafa then draws 1:1 with no resampling work. Default.
 *    For video, frames are decoded directly at the target size,
 *    making this effectively free.
 */
export const PixelFit = {
    NONE: 0,
    SCALE: 1,
} as const;

/* ═══════════════════════════════════════════════════════════════════
   ChafaConfig - full canvas configuration
   ═══════════════════════════════════════════════════════════════════ */

/** Full chafa canvas configuration.
 *
 *  Maps directly to chafa's `ChafaCanvasConfig` setters.
 *  All fields are optional when passed to the `Chafa` constructor or
 *  `updateConfig()` - unspecified fields retain their current value.
 */
export interface ChafaConfig {
    /** Canvas width in character cells (columns). Default: 80 */
    termW: number;
    /** Canvas height in character cells (rows). Default: 24 */
    termH: number;
    /** Character cell width in pixels. Used for pixel-mode canvas sizing
     *  (ignored in symbol mode). Default: 8 */
    cellW: number;
    /** Character cell height in pixels. Used for pixel-mode canvas sizing
     *  (ignored in symbol mode). Default: 16 (typical 1:2 font aspect) */
    cellH: number;
    /** Quality/speed tradeoff (0.0–1.0). 0.0 = fastest, 1.0 = best quality.
     *  Chafa CLI defaults to 0.5; our default is 0.0 for speed. */
    workFactor: number;
    /** Dithering mode. See {@link DitherMode}. Default: NONE */
    ditherMode: number;
    /** Color mode for output. See {@link CanvasMode}. Default: TRUECOLOR */
    canvasMode: number;
    /** Enable auto contrast/brightness preprocessing. 0=off, 1=on. Default: 0 */
    preprocessing: number;
    /** Color extraction method. See {@link ColorExtractor}. Default: AVERAGE */
    colorExtractor: number;
    /** Color distance space. See {@link ColorSpace}. Default: RGB */
    colorSpace: number;
    /** Pixel rendering mode. See {@link PixelMode}. Default: SYMBOLS */
    pixelMode: number;
    /** Background color (0xRRGGBB). -1 for transparent. Default: 0x000000 */
    bgColor: number;
    /** Foreground color (0xRRGGBB). -1 for transparent. Default: 0xFFFFFF */
    fgColor: number;
    /** Alpha threshold (0–255). Pixels with alpha below this are transparent. Default: 127 */
    alphaThreshold: number;
    /** Dither grain width in pixels. Default: 4 */
    ditherGrainW: number;
    /** Dither grain height in pixels. Default: 4 */
    ditherGrainH: number;
    /** Dither intensity multiplier. Typical range 0.0–2.0. Default: 1.0 */
    ditherIntensity: number;
    /** Foreground-only mode. When 1, only foreground color is drawn. Default: 0 */
    fgOnly: number;
    /** Output optimization flags bitmask. 0x7fffffff = all optimizations enabled. Default: 0x7fffffff */
    optimizations: number;
    /** Passthrough guard for multiplexers. See {@link Passthrough}. Default: NONE */
    passthrough: number;
    /** Pixel-mode fit strategy. See {@link PixelFit}. Default: SCALE */
    pixelFit: number;
    /** Decode video audio into per-frame PCM samples (interleaved float).
     *  0 = discard audio entirely (default, saves CPU/memory).
     *  1 = decode audio; `video.nextFrame().audio` returns the frame's samples. */
    videoIncludeAudio: number;
    /** Max animation frames to decode. -1 = all frames. Default: -1 */
    maxFrames: number;
    /** Animation playback speed multiplier. 1.0 = native speed. Default: 1.0 */
    speed: number;
    /** Chafa CLI selector string for the primary symbol map.
     *  Example: `"block+border+space-wide"`.
     *  Empty string = chafa defaults. See chafa man page for tag names. */
    symbols: string;
    /** Chafa CLI selector string for the fill symbol map (used for solid areas).
     *  Empty string = chafa defaults. */
    fillSymbols: string;
}

/** Partial config, for constructor and `updateConfig()`. */
export type ChafaConfigPartial = Partial<ChafaConfig>;

/* ═══════════════════════════════════════════════════════════════════
   CodecMetrics - per-operation timing and metadata
   ═══════════════════════════════════════════════════════════════════ */

/** Metrics returned with every render/decode operation.
 *
 *  All times are in milliseconds on the monotonic clock.
 */
export interface CodecMetrics {
    /** Image format detection + codec decode time (ms) */
    parseMs: number;
    /** Time spent in `chafa_canvas_draw_all_pixels` - scaling, symbol matching, color assignment (ms) */
    drawMs: number;
    /** Time spent in `chafa_canvas_print` - ANSI string generation (ms) */
    buildMs: number;
    /** Time spent pre-scaling pixels to the fit box (ms). 0 when no scaling happened (pixelFit NONE or already 1:1) */
    scaleMs: number;
    /** `parseMs + scaleMs + drawMs + buildMs` (ms) */
    totalMs: number;
    /** Source image width in pixels */
    imgW: number;
    /** Source image height in pixels */
    imgH: number;
    /** Canvas width in character cells */
    canvasW: number;
    /** Canvas height in character cells */
    canvasH: number;
    /** Internal canvas pixel width (canvasW × cellW for symbol mode) */
    canvasPw: number;
    /** Internal canvas pixel height (canvasH × cellH for symbol mode) */
    canvasPh: number;
    /** Total frame count (1 for static images, `-1` for unknown-length WebP) */
    frameCount: number;
    /** Delay before displaying the next frame (ms) */
    frameDelayMs: number;
    /** Size of the decoded RGBA buffer in bytes */
    rgbaBytes: number;
    /** Image format (0=PNG, 1=JPEG, 2=BMP, 3=GIF, 4=WebP). See {@link FMT_NAMES} */
    format: ChafaFormat;
    /** Active canvas mode. See {@link CanvasMode} */
    canvasMode: number;
    /** Active pixel mode. See {@link PixelMode} */
    pixelMode: number;
    /** Active pixel fit strategy. See {@link PixelFit} */
    pixelFit: number;
    /** Whether the source image contained an alpha channel (1 = yes, 0 = no) */
    haveAlpha: number;
}

/* ═══════════════════════════════════════════════════════════════════
   Result types
   ═══════════════════════════════════════════════════════════════════ */

/** Returned by {@link Chafa.render} and {@link Chafa.renderRgba}. */
export interface RenderResult {
    /** UTF-8 ANSI terminal art string */
    ansi: string;
    /** Timing and metadata */
    metrics: CodecMetrics;
}

/** Returned by {@link Chafa.renderMatrix} and {@link Chafa.renderMatrixRgba}. */
export interface MatrixResult {
    /** JSON-encoded 2D cell grid: `[[[charCode, fg, bg], ...], ...]` */
    matrix: string;
    /** Timing and metadata */
    metrics: CodecMetrics;
}

/** Returned by {@link ChafaAnimation.next}. */
export interface AnimFrame {
    /** Zero-based frame index */
    frameIndex: number;
    /** Per-frame metrics including `frameDelayMs` */
    metrics: CodecMetrics;
}

/** Emitted by {@link ChafaAnimation.onFrame} (play path includes ansi). */
export interface AnimFrameEvent extends AnimFrame {
    /** Rendered ANSI output for the frame (present when playing / after goto). */
    ansi?: string;
    /** True when this frame was reached via an automatic loop wrap. */
    looped?: boolean;
}

/** Emitted by {@link ChafaVideo.onFrame}. */
export interface VideoFrameEvent extends VideoFrame {
    /** Interleaved float32 PCM for this frame's timespan (requires `videoIncludeAudio`). */
    audio?: Float32Array | null;
}

/** Terminal capabilities detected by {@link Chafa.detect}. */
export interface TerminalInfo {
    /** Terminal type from $TERM */
    term: string;
    /** Terminal program from $TERM_PROGRAM */
    termProgram: string;
    /** Terminal width in cells (0 = unknown) */
    termW: number;
    /** Terminal height in cells (0 = unknown) */
    termH: number;
    /** Cell width in pixels (0 = unknown) */
    cellW: number;
    /** Cell height in pixels (0 = unknown) */
    cellH: number;
    /** Supported pixel modes in preference order. Empty = no pixel protocol detected. */
    pixelModes: number[];
    /** Best pixel mode to use (PixelMode.SYMBOLS when none supported). */
    pixelMode: number;
    /** Best canvas color mode (CanvasMode.TRUECOLOR / INDEXED_256 / ...). */
    canvasMode: number;
    /** Whether truecolor output is believed safe. */
    truecolor: boolean;
    /** Whether active terminal probing succeeded (false = env-only detection). */
    probed: boolean;
    /** Env vars snapshot used for detection */
    env: { TERM?: string; TERM_PROGRAM?: string; COLORTERM?: string; KITTY_WINDOW_ID?: string };
}

/** Raw decoded image data returned by {@link Chafa.decode}. */
export interface ChafaImageData {
    /** RGBA pixel buffer (8 bits per channel, unassociated alpha) */
    rgba: Uint8Array;
    /** Image width in pixels */
    width: number;
    /** Image height in pixels */
    height: number;
    /** Row stride in bytes (width × 4) */
    stride: number;
    /** Decode metrics */
    metrics: CodecMetrics;
}

/** A single decoded video frame from {@link ChafaVideo.nextFrame}. */
export interface VideoFrame {
    /** RGBA pixel buffer (copied from the video ring buffer) */
    rgba: Uint8Array;
    /** Frame width in pixels (decode target, not native) */
    width: number;
    /** Frame height in pixels (decode target, not native) */
    height: number;
    /** Presentation timestamp in seconds */
    ptsSec: number;
    /** Frame index (0-based, monotonic within a session) */
    frameIndex: number;
    /** Interleaved float32 PCM covering this frame's timespan.
     *  Only present when the config option `videoIncludeAudio` is enabled. */
    audio?: Float32Array | null;
    /** Number of PCM sample frames in `audio` */
    audioSamples?: number;
    /** Audio channel count */
    audioChannels?: number;
    /** Audio sample rate in Hz */
    audioSampleRate?: number;
    /** Video playback metadata (frame delay, dimensions) */
    metrics: CodecMetrics;
}

/* ═══════════════════════════════════════════════════════════════════
   Defaults
   ═══════════════════════════════════════════════════════════════════ */

/** Returns a fresh default config object.
 *
 *  Defaults are tuned for speed (workFactor=0.0, no preprocessing).
 *  For higher quality matching chafa CLI defaults, override:
 *  `{ workFactor: 0.5, preprocessing: 1 }`.
 *
 *  In pixel modes the canvas pixel area is `termW × cellW` by
 *  `termH × cellH` (80×24 -> 640×384 by default), so output fills
 *  the same terminal area as symbol mode.
 */
export function defaultConfig(): ChafaConfig {
    return {
        termW: 80, termH: 24,
        cellW: 8, cellH: 16,
        workFactor: 0.0,
        ditherMode: DitherMode.NONE,
        canvasMode: CanvasMode.TRUECOLOR,
        preprocessing: 0,
        colorExtractor: ColorExtractor.AVERAGE,
        colorSpace: ColorSpace.RGB,
        pixelMode: PixelMode.SYMBOLS,
        bgColor: 0x000000, fgColor: 0xffffff,
        alphaThreshold: 127,
        ditherGrainW: 4, ditherGrainH: 4,
        ditherIntensity: 1.0,
        fgOnly: 0,
        optimizations: 0x7fffffff,
        passthrough: Passthrough.NONE,
        pixelFit: PixelFit.SCALE,
        videoIncludeAudio: 0,
        maxFrames: -1,
        speed: 1.0,
        symbols: "",
        fillSymbols: "",
    };
}

/** Target pixel dimensions for a pixel-mode config.
 *
 *  Returns `{ width: termW × cellW, height: termH × cellH }` - the
 *  pixel area the rendered image will occupy on screen. In symbol
 *  mode returns the cell counts unchanged.
 */
export function pixelCanvasSize(config: ChafaConfig): { width: number; height: number } {
    if (config.pixelMode === PixelMode.SYMBOLS) {
        return { width: config.termW, height: config.termH };
    }
    return { width: config.termW * config.cellW, height: config.termH * config.cellH };
}
