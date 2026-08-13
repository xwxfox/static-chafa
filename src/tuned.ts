/**
 * @file tuned.ts
 * @brief Tuned default configs discovered by playground/tuner.ts.
 *
 * A ~4h multi-process TPE run scored `SSIM*100 - 2*ms` per (pixel mode,
 * terminal size) combination across 4 media files at 5 sizes. The best
 * configs are baked in here. `tunedDefaults(pixelMode, termW, termH)`
 * returns a partial config: numeric fields are interpolated linearly in
 * log2(cell area) between the bracketing table entries, categorical fields
 * are taken from the nearest entry. Sizes outside the probed range clamp
 * to the nearest edge.
 *
 * Fields the user sets explicitly (constructor or updateConfig) are never
 * overridden. Disable entirely with `tuned: 0` in the config.
 */

import { PixelMode, type ChafaConfigPartial } from "./types.ts";

interface TunedEntry {
    w: number;
    h: number;
    cfg: ChafaConfigPartial;
}

const NUMERIC = new Set([
    "workFactor",
    "ditherIntensity",
    "alphaThreshold",
    "videoDecodeScale",
    "videoThreads",
    "swsScale",
]) as ReadonlySet<string>;

const ROUND_TO_INT = new Set(["alphaThreshold", "videoThreads", "swsScale"]) as ReadonlySet<string>;

const TUNED_TABLE: Record<number, TunedEntry[]> = {
    [PixelMode.SYMBOLS]: [
        {
            w: 40, h: 12,
            cfg: {
                workFactor: 0, ditherMode: 1, colorExtractor: 1, colorSpace: 0,
                preprocessing: 1, ditherIntensity: 1.2178, ditherGrainW: 2, ditherGrainH: 2,
                alphaThreshold: 192, bgColor: 0x000000, optimizations: 0, pixelFit: 1,
                canvasMode: 0, symbols: "block+border+space-wide+inverted", fillSymbols: "", fgOnly: 0,
                videoDecodeScale: 0.4, videoThreads: 4, swsScale: 1,
            },
        },
        {
            w: 80, h: 24,
            cfg: {
                workFactor: 0.1144, ditherMode: 3, colorExtractor: 0, colorSpace: 0,
                preprocessing: 0, ditherIntensity: 1.1672, ditherGrainW: 8, ditherGrainH: 8,
                alphaThreshold: 127, bgColor: 0x000000, optimizations: 0, pixelFit: 1,
                canvasMode: 0, symbols: "block", fillSymbols: "space-wide", fgOnly: 0,
                videoDecodeScale: 1.0, videoThreads: 8, swsScale: 3,
            },
        },
        {
            w: 100, h: 30,
            cfg: {
                workFactor: 0.0127, ditherMode: 3, colorExtractor: 0, colorSpace: 0,
                preprocessing: 0, ditherIntensity: 0.25, ditherGrainW: 4, ditherGrainH: 4,
                alphaThreshold: 192, bgColor: 0x000000, optimizations: 0, pixelFit: 1,
                canvasMode: 0, symbols: "block+border+space-wide+inverted", fillSymbols: "block", fgOnly: 0,
                videoDecodeScale: 1.0, videoThreads: 0, swsScale: 1,
            },
        },
        {
            w: 120, h: 40,
            cfg: {
                workFactor: 0.0327, ditherMode: 0, colorExtractor: 0, colorSpace: 0,
                preprocessing: 0, ditherIntensity: 1.0265, ditherGrainW: 8, ditherGrainH: 8,
                alphaThreshold: 192, bgColor: 0xffffff, optimizations: 0, pixelFit: 0,
                canvasMode: 1, symbols: "block", fillSymbols: "space-wide", fgOnly: 0,
                videoDecodeScale: 1.0, videoThreads: 4, swsScale: 1,
            },
        },
        {
            w: 240, h: 72,
            cfg: {
                workFactor: 0.0081, ditherMode: 3, colorExtractor: 0, colorSpace: 0,
                preprocessing: 1, ditherIntensity: 0.8909, ditherGrainW: 8, ditherGrainH: 8,
                alphaThreshold: 192, bgColor: 0xffffff, optimizations: 0x7fffffff, pixelFit: 0,
                canvasMode: 0, symbols: "wide", fillSymbols: "", fgOnly: 0,
                videoDecodeScale: 1.0, videoThreads: 4, swsScale: 1,
            },
        },
    ],
    [PixelMode.SIXELS]: [
        {
            w: 40, h: 12,
            cfg: {
                workFactor: 0.0453, ditherMode: 0, colorExtractor: 0, colorSpace: 0,
                preprocessing: 0, ditherIntensity: 1.8143, ditherGrainW: 4, ditherGrainH: 4,
                alphaThreshold: 192, bgColor: 0x000000, optimizations: 0, pixelFit: 1,
                videoDecodeScale: 1.0, videoThreads: 4, swsScale: 2,
            },
        },
        {
            w: 80, h: 24,
            cfg: {
                workFactor: 0, ditherMode: 0, colorExtractor: 1, colorSpace: 0,
                preprocessing: 0, ditherIntensity: 1.3759, ditherGrainW: 4, ditherGrainH: 4,
                alphaThreshold: 192, bgColor: 0xffffff, optimizations: 0, pixelFit: 0,
                videoDecodeScale: 0.4, videoThreads: 8, swsScale: 0,
            },
        },
        {
            w: 100, h: 30,
            cfg: {
                workFactor: 0.0893, ditherMode: 0, colorExtractor: 0, colorSpace: 0,
                preprocessing: 1, ditherIntensity: 1.4247, ditherGrainW: 4, ditherGrainH: 4,
                alphaThreshold: 127, bgColor: 0xffffff, optimizations: 0, pixelFit: 1,
                videoDecodeScale: 1.0, videoThreads: 4, swsScale: 3,
            },
        },
        {
            w: 120, h: 40,
            cfg: {
                workFactor: 0.0603, ditherMode: 0, colorExtractor: 0, colorSpace: 0,
                preprocessing: 0, ditherIntensity: 1.0201, ditherGrainW: 4, ditherGrainH: 4,
                alphaThreshold: 192, bgColor: 0xffffff, optimizations: 0x7fffffff, pixelFit: 0,
                videoDecodeScale: 1.0, videoThreads: 1, swsScale: 4,
            },
        },
        {
            w: 240, h: 72,
            cfg: {
                workFactor: 0.0872, ditherMode: 0, colorExtractor: 0, colorSpace: 0,
                preprocessing: 0, ditherIntensity: 2.0, ditherGrainW: 8, ditherGrainH: 8,
                alphaThreshold: 127, bgColor: 0xffffff, optimizations: 0, pixelFit: 0,
                videoDecodeScale: 1.0, videoThreads: 0, swsScale: 2,
            },
        },
    ],
    [PixelMode.KITTY]: [
        {
            w: 40, h: 12,
            cfg: {
                workFactor: 0, ditherMode: 3, colorExtractor: 0, colorSpace: 1,
                preprocessing: 1, ditherIntensity: 1.8657, ditherGrainW: 2, ditherGrainH: 2,
                alphaThreshold: 127, bgColor: 0xffffff, optimizations: 0x7fffffff, pixelFit: 1,
                videoDecodeScale: 1.0, videoThreads: 0, swsScale: 0,
            },
        },
        {
            w: 80, h: 24,
            cfg: {
                workFactor: 1.0, ditherMode: 3, colorExtractor: 0, colorSpace: 0,
                preprocessing: 0, ditherIntensity: 2.0, ditherGrainW: 2, ditherGrainH: 2,
                alphaThreshold: 127, bgColor: 0x000000, optimizations: 0x7fffffff, pixelFit: 0,
                videoDecodeScale: 0.4, videoThreads: 4, swsScale: 2,
            },
        },
        {
            w: 100, h: 30,
            cfg: {
                workFactor: 0.8971, ditherMode: 1, colorExtractor: 0, colorSpace: 1,
                preprocessing: 1, ditherIntensity: 0.25, ditherGrainW: 8, ditherGrainH: 8,
                alphaThreshold: 64, bgColor: 0xffffff, optimizations: 0, pixelFit: 1,
                videoDecodeScale: 1.0, videoThreads: 0, swsScale: 2,
            },
        },
        {
            w: 120, h: 40,
            cfg: {
                workFactor: 0.1961, ditherMode: 0, colorExtractor: 1, colorSpace: 1,
                preprocessing: 0, ditherIntensity: 0.25, ditherGrainW: 8, ditherGrainH: 8,
                alphaThreshold: 192, bgColor: 0xffffff, optimizations: 0, pixelFit: 1,
                videoDecodeScale: 1.0, videoThreads: 4, swsScale: 2,
            },
        },
        {
            w: 240, h: 72,
            cfg: {
                workFactor: 0, ditherMode: 3, colorExtractor: 0, colorSpace: 1,
                preprocessing: 1, ditherIntensity: 0.25, ditherGrainW: 8, ditherGrainH: 8,
                alphaThreshold: 127, bgColor: 0xffffff, optimizations: 0, pixelFit: 0,
                videoDecodeScale: 1.0, videoThreads: 8, swsScale: 3,
            },
        },
    ],
    [PixelMode.ITERM2]: [], /* not tuned - falls back to defaults */
};

/**
 * Best-known default config for a pixel mode at a given terminal size.
 * Numeric fields are interpolated in log2(cell area) between the bracketing
 * probed sizes; categorical fields follow the nearest probed size. Returns
 * an empty object for unknown modes / when tuning has no data.
 */
export function tunedDefaults(
    pixelMode: number,
    termW: number,
    termH: number,
): ChafaConfigPartial {
    const table = TUNED_TABLE[pixelMode];
    if (!table || table.length === 0) return {};
    const w = Math.max(1, termW | 0);
    const h = Math.max(1, termH | 0);

    const target = Math.log2(w * h);
    const sizes = table.map((e) => Math.log2(e.w * e.h));

    /* bracketing entries */
    let lo = 0, hi = 0;
    if (target <= sizes[0]!) { lo = 0; hi = 0; }
    else if (target >= sizes[sizes.length - 1]!) { lo = sizes.length - 1; hi = sizes.length - 1; }
    else {
        hi = sizes.findIndex((s) => s >= target);
        lo = Math.max(0, hi - 1);
    }

    const a = table[lo]!, b = table[hi]!;
    const span = sizes[hi]! - sizes[lo]!;
    const t = span > 0 ? (target - sizes[lo]!) / span : 0;
    const out: ChafaConfigPartial = {};

    for (const key of Object.keys(a.cfg) as (keyof ChafaConfigPartial)[]) {
        const va = a.cfg[key], vb = b.cfg[key];
        if (typeof va === "number" && typeof vb === "number" && NUMERIC.has(key)) {
            const v = va + (vb - va) * t;
            (out as any)[key] = ROUND_TO_INT.has(key) ? Math.round(v) : +v.toFixed(4);
        } else {
            /* categorical: nearest entry wins */
            (out as any)[key] = t < 0.5 ? va : vb;
        }
    }
    return out;
}
