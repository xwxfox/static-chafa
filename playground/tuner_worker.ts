/**
 * @file playground/tuner_worker.ts
 * @brief One TPE optimization loop for a single (terminal size, pixel mode)
 * job. Spawned as a separate PROCESS by tuner.ts (the native addon is not
 * thread-safe, so worker_threads can't be used - each job gets its own
 * process with its own copy of the addon and FFmpeg).
 *
 * Reads the job spec (JSON) from the file given in argv[2], then writes one
 * JSON message per line to stdout: {type:"obs"|"status"|"error"|"started"}.
 * Runs until killed (parent controls the deadline).
 */

import Chafa, {
    CanvasMode, PixelMode, DitherMode, ColorExtractor, ColorSpace, PixelFit,
} from "../src/index.ts";
import {
    bilinearScale, rasterizeMatrix, decodeSixel, decodeKitty, ssim, psnr,
} from "./harness.ts";
import fs from "node:fs";

interface JobSpec {
    id: string;
    mode: string;
    termW: number;
    termH: number;
    media: string[];
    frames: number;
    lambda: number;
    resume: Obs[] | null;
}

interface Obs {
    config: Record<string, number | string>;
    ssim: number;
    psnr: number;
    ms: number;
    bytes: number;
    score: number;
}

interface Frame {
    rgba: Uint8Array;
    w: number;
    h: number;
    refRgb: Uint8Array;
    decodeMs: number;
    video: boolean;
}

interface CachedMedia {
    frames: Frame[];
}

interface ParamDef {
    name: string;
    kind: "cat" | "float";
    values?: (number | string)[];
    min?: number;
    max?: number;
}

const jobFile = process.argv[2];
if (!jobFile) {
    console.error("usage: tuner_worker.ts <job.json>");
    process.exit(2);
}
const job = JSON.parse(fs.readFileSync(jobFile, "utf8")) as JobSpec;
const MODE_NUM: Record<string, number> = {
    symbols: PixelMode.SYMBOLS,
    sixel: PixelMode.SIXELS,
    kitty: PixelMode.KITTY,
};

function send(msg: any): void {
    process.stdout.write(JSON.stringify(msg) + "\n");
}

let phase = "startup";
function fail(e: any): never {
    send({ type: "error", id: job.id, error: `${phase}: ${e?.stack ?? String(e)}` });
    process.exit(1);
}
process.on("uncaughtException", fail);
process.on("unhandledRejection", fail);

Chafa.setThreads(1); /* each process renders small frames; one thread is fastest */

/* ── per-mode param space ─────────────────────────────────────────── */

const BASE_PARAMS: ParamDef[] = [
    { name: "workFactor", kind: "float", min: 0, max: 1 },
    { name: "ditherMode", kind: "cat", values: [DitherMode.NONE, DitherMode.ORDERED, DitherMode.DIFFUSION, DitherMode.NOISE] },
    { name: "colorExtractor", kind: "cat", values: [ColorExtractor.AVERAGE, ColorExtractor.MEDIAN] },
    { name: "colorSpace", kind: "cat", values: [ColorSpace.RGB, ColorSpace.DIN99D] },
    { name: "preprocessing", kind: "cat", values: [0, 1] },
    { name: "ditherIntensity", kind: "float", min: 0.25, max: 2.0 },
    { name: "ditherGrainW", kind: "cat", values: [2, 4, 8] },
    /* transparency + background handling (matters for alpha media) */
    { name: "alphaThreshold", kind: "cat", values: [64, 127, 192] },
    { name: "bgColor", kind: "cat", values: [0x000000, 0xffffff] },
    /* output-size optimizations (bytes only, never pixels) */
    { name: "optimizations", kind: "cat", values: [0x7fffffff, 0] },
    /* pre-scale vs let chafa scale internally */
    { name: "pixelFit", kind: "cat", values: [PixelFit.SCALE, PixelFit.NONE] },
];

const MODE_PARAMS: Record<string, ParamDef[]> = {
    symbols: [
        ...BASE_PARAMS,
        { name: "canvasMode", kind: "cat", values: [CanvasMode.TRUECOLOR, CanvasMode.INDEXED_256, CanvasMode.INDEXED_240, CanvasMode.INDEXED_16, CanvasMode.INDEXED_8] },
        {
            name: "symbols", kind: "cat",
            values: ["", "block", "block+border+space-wide", "block+border+space-wide+dot", "block+border+space-wide+inverted", "wide"],
        },
        {
            name: "fillSymbols", kind: "cat",
            values: ["", "block", "block+border+space-wide", "space-wide"],
        },
        { name: "fgOnly", kind: "cat", values: [0, 1] },
    ],
    sixel: [...BASE_PARAMS],
    kitty: [...BASE_PARAMS],
};

const hasVideo = job.media.some((m) => /\.(mp4|mkv|webm|avi|mov)$/i.test(m));

/* ── frame cache ───────────────────────────────────────────────────── */

function stretchToCanvas(rgba: Uint8Array, w: number, h: number): { rgb: Uint8Array; w: number; h: number } {
    const cellW = 8, cellH = 16;
    const cw = job.mode === "symbols" ? job.termW * 8 : job.termW * cellW;
    const chh = job.mode === "symbols" ? job.termH * 8 : job.termH * cellH;
    const ref = bilinearScale(rgba, w, h, cw, chh);
    const rgb = new Uint8Array(cw * chh * 3);
    for (let p = 0; p < cw * chh; p++) {
        rgb[p * 3] = ref[p * 4]!;
        rgb[p * 3 + 1] = ref[p * 4 + 1]!;
        rgb[p * 3 + 2] = ref[p * 4 + 2]!;
    }
    return { rgb, w: cw, h: chh };
}

function makeRef(rgba: Uint8Array, w: number, h: number): Uint8Array {
    return stretchToCanvas(rgba, w, h).rgb;
}

function buildVideoMedia(file: string, cfg: Record<string, number | string>): CachedMedia {
    const buf = fs.readFileSync(file);
    const chafa = new Chafa({ tuned: 0,
        termW: job.termW, termH: job.termH,
        cellW: 8, cellH: 16, pixelMode: MODE_NUM[job.mode]!,
        canvasMode: CanvasMode.TRUECOLOR,
        ...cfg,
    } as any);
    const v = chafa.openVideo(buf);
    const frames: Frame[] = [];
    const total = Math.max(1, Math.round(v.durationSec * v.fps));
    const stride = Math.max(1, Math.floor(total / job.frames));
    let i = 0, k = 0;
    while (k < job.frames) {
        const d0 = performance.now();
        const f = v.nextFrame();
        const decodeMs = performance.now() - d0;
        if (!f) break;
        if (i % stride === 0 || k === 0) {
            const rgba = new Uint8Array(f.rgba);
            frames.push({ rgba, w: f.width, h: f.height, refRgb: makeRef(rgba, f.width, f.height), decodeMs, video: true });
            k++;
        }
        i++;
    }
    v.close();
    chafa.destroy();
    return { frames };
}

function buildAnimMedia(file: string): CachedMedia {
    const buf = fs.readFileSync(file);
    const chafa = new Chafa({ tuned: 0,
        termW: job.termW, termH: job.termH,
        cellW: 8, cellH: 16, pixelMode: MODE_NUM[job.mode]!,
        canvasMode: CanvasMode.TRUECOLOR,
    });
    const anim = chafa.openAnimation(buf);
    const frames: Frame[] = [];
    let i = 0, k = 0;
    const total = Math.max(1, anim.frameCount > 0 ? anim.frameCount : 600);
    const stride = Math.max(1, Math.floor(total / job.frames));
    while (k < job.frames) {
        const f = anim.next();
        if (!f) break;
        if (i % stride === 0 || k === 0) {
            const data = anim.frameData(f.frameIndex);
            if (!data) break;
            const rgba = new Uint8Array(data);
            frames.push({ rgba, w: anim.width, h: anim.height, refRgb: makeRef(rgba, anim.width, anim.height), decodeMs: 0, video: false });
            k++;
        }
        i++;
    }
    anim.close();
    chafa.destroy();
    return { frames };
}

function buildImageMedia(file: string): CachedMedia {
    const buf = fs.readFileSync(file);
    const chafa = new Chafa({ tuned: 0,
        termW: job.termW, termH: job.termH,
        cellW: 8, cellH: 16, pixelMode: MODE_NUM[job.mode]!,
        canvasMode: CanvasMode.TRUECOLOR,
    });
    const img = chafa.decode(buf);
    const rgba = new Uint8Array(img.rgba);
    const frames: Frame[] = [{ rgba, w: img.width, h: img.height, refRgb: makeRef(rgba, img.width, img.height), decodeMs: 0, video: false }];
    img.destroy();
    chafa.destroy();
    return { frames };
}

/* ── cache manager: static media shared, video media per decode-knob ── */

let staticCache: CachedMedia[] | null = null;
const videoVariants = new Map<string, CachedMedia[]>();
const variantOrder: string[] = [];
const VARIANT_MAX = 4;

function cacheFor(config: Record<string, number | string>): CachedMedia[] {
    if (!staticCache) {
        staticCache = job.media
            .filter((m) => !/\.(mp4|mkv|webm|avi|mov)$/i.test(m))
            .map((m) => /\.(gif|webp)$/i.test(m) ? buildAnimMedia(m) : buildImageMedia(m));
    }
    const videoFiles = job.media.filter((m) => /\.(mp4|mkv|webm|avi|mov)$/i.test(m));
    if (videoFiles.length === 0) return staticCache;

    const key = `${config["pixelFit"] ?? 1}|${config["videoThreads"] ?? 0}|${config["swsScale"] ?? 0}|${config["videoDecodeScale"] ?? 1.0}`;
    let v = videoVariants.get(key);
    if (!v) {
        v = videoFiles.map((f) => buildVideoMedia(f, config));
        videoVariants.set(key, v);
        variantOrder.push(key);
        while (variantOrder.length > VARIANT_MAX) {
            videoVariants.delete(variantOrder.shift()!);
        }
    }
    return [...staticCache, ...v];
}

/* ── evaluation ────────────────────────────────────────────────────── */

function evalConfig(config: Record<string, number | string>, cache: CachedMedia[]): Obs | null {
    phase = `eval ${JSON.stringify(config).slice(0, 50)}`;
    const ditherGrain = config["ditherGrainW"] as number | undefined;

    const chafa = new Chafa({ tuned: 0,
        termW: job.termW, termH: job.termH,
        cellW: 8, cellH: 16,
        pixelMode: MODE_NUM[job.mode]!,
        pixelFit: PixelFit.SCALE,
        ...config,
        ditherGrainH: ditherGrain,
    } as any);
    try {
        let ssimSum = 0, psnrSum = 0, msSum = 0, bytesSum = 0, n = 0;
        for (const media of cache) {
            for (const fr of media.frames) {
                const t0 = performance.now();
                let raster: Uint8Array | null = null;
                let rasterW = 0;
                const rgba = fr.rgba;
                const w = fr.w, h = fr.h;
                const refRgb = fr.refRgb;
                if (job.mode === "symbols") {
                    const rr = chafa.renderRgba(rgba, w, h);
                    if (!rr) continue;
                    bytesSum += rr.ansi ? Buffer.byteLength(rr.ansi) : 0;
                    const mr = chafa.renderMatrixRgba(rgba, w, h);
                    if (!mr) continue;
                    const cells: number[][][] = JSON.parse(mr.matrix);
                    const chh = cells.length;
                    const cw = cells[0]?.length ?? 0;
                    const unique = new Map<number, number>();
                    const flat: number[] = [];
                    for (const row of cells) for (const cell of row ?? []) {
                        const cp = cell?.[0] ?? 32;
                        if (!unique.has(cp)) { unique.set(cp, flat.length); flat.push(cp); }
                    }
                    const glyphs = chafa.symbolGlyphs(Uint32Array.from(flat));
                    raster = rasterizeMatrix(mr.matrix, glyphs, unique, chafa.config.canvasMode, cw, chh);
                    rasterW = cw * 8;
                } else {
                    const rr = chafa.renderRgba(rgba, w, h);
                    if (!rr) continue;
                    bytesSum += rr.ansi ? Buffer.byteLength(rr.ansi) : 0;
                    const dec = job.mode === "sixel" ? decodeSixel(rr.ansi) : decodeKitty(rr.ansi);
                    if (!dec) continue;
                    raster = dec.rgb;
                    rasterW = dec.w;
                }
                const ms = performance.now() - t0;
                if (!raster) continue;
                const h2 = raster.length / 3 / rasterW;
                const p = psnr(raster, refRgb);
                const s = ssim(raster, refRgb, rasterW, h2);
                if (Number.isNaN(s) || Number.isNaN(p)) continue;
                ssimSum += s; psnrSum += p;
                msSum += ms + fr.decodeMs;
                n++;
            }
        }
        if (n === 0) return null;
        const ms = msSum / n;
        const meanSsim = ssimSum / n;
        const meanPsnr = psnrSum / n;
        return {
            config: { ...config },
            ssim: meanSsim, psnr: meanPsnr, ms,
            bytes: bytesSum / n,
            score: meanSsim * 100 - job.lambda * ms,
        };
    } finally {
        chafa.destroy();
    }
}

/* ── TPE sampler ───────────────────────────────────────────────────── */

function gauss(): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function sampleConfig(params: ParamDef[], obs: Obs[]): Record<string, number | string> {
    const cfg: Record<string, number | string> = {};
    if (obs.length < 20) {
        for (const p of params) {
            if (p.kind === "cat") cfg[p.name] = p.values![Math.floor(Math.random() * p.values!.length)]!;
            else cfg[p.name] = +(p.min! + Math.random() * (p.max! - p.min!)).toFixed(4);
        }
        return cfg;
    }
    const sorted = [...obs].sort((a, b) => b.score - a.score);
    /* The baseline obs has an empty config {} - it must never feed the
       distribution fit (undefined values poison the mean -> NaN cascade). */
    const withCfg = sorted.filter((o) => o.config && Object.keys(o.config).length > 0);
    const good = withCfg.slice(0, Math.max(2, Math.floor(sorted.length * 0.25)));
    for (const p of params) {
        if (p.kind === "cat") {
            const weights = new Map<number | string, number>();
            for (const v of p.values!) weights.set(v, 0.1);
            for (const o of good) {
                const val = o.config[p.name];
                if (val === undefined || val === null) continue;
                weights.set(val, (weights.get(val) ?? 0.1) + 1);
            }
            let total = 0;
            for (const w of weights.values()) total += w;
            let r = Math.random() * total;
            let pick = p.values![0]!;
            for (const v of p.values!) {
                r -= weights.get(v)!;
                if (r <= 0) { pick = v; break; }
            }
            cfg[p.name] = pick;
        } else {
            const vals = good
                .map((o) => o.config[p.name] as number)
                .filter((v) => Number.isFinite(v));
            if (vals.length === 0) {
                cfg[p.name] = +(p.min! + Math.random() * (p.max! - p.min!)).toFixed(4);
                continue;
            }
            const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
            const std = Math.max(
                1e-3,
                Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length),
            );
            let v = vals[Math.floor(Math.random() * vals.length)]! + gauss() * std;
            v = Math.min(p.max!, Math.max(p.min!, v));
            cfg[p.name] = Number.isFinite(v)
                ? +v.toFixed(4)
                : +(p.min! + Math.random() * (p.max! - p.min!)).toFixed(4);
        }
    }
    for (let attempt = 0; attempt < 5; attempt++) {
        const dup = obs.some((o) => JSON.stringify(o.config) === JSON.stringify(cfg));
        if (!dup) break;
        for (const p of params) {
            if (p.kind === "cat") cfg[p.name] = p.values![Math.floor(Math.random() * p.values!.length)]!;
            else cfg[p.name] = +(p.min! + Math.random() * (p.max! - p.min!)).toFixed(4);
        }
    }
    return cfg;
}

/* ── main loop ─────────────────────────────────────────────────────── */

async function main(): Promise<void> {
    phase = "buildCache";
    cacheFor({}); /* warm static cache */
    phase = "tune";
    const params = [...MODE_PARAMS[job.mode]!];
    if (hasVideo) {
        params.push({ name: "videoDecodeScale", kind: "float", min: 0.4, max: 1.0 });
        params.push({ name: "videoThreads", kind: "cat", values: [0, 1, 4, 8] });
        params.push({ name: "swsScale", kind: "cat", values: [0, 1, 2, 3, 4] });
    }

    /* sanitize resume data: earlier buggy runs may contain NaN-poisoned obs */
    const obs: Obs[] = (Array.isArray(job.resume) ? job.resume : [])
        .filter((o) => o && Number.isFinite(o.ms) && Number.isFinite(o.ssim) && Number.isFinite(o.score));
    let best = obs.length > 0 ? obs.reduce((a, b) => (b.score > a.score ? b : a)) : null;
    let stalled = 0;

    send({ type: "started", id: job.id });

    if (obs.length === 0) {
        const dflt = evalConfig({}, cacheFor({}));
        if (dflt) {
            dflt.config = {};
            obs.push(dflt);
            best = dflt;
            send({ type: "obs", id: job.id, obs: dflt });
        }
    }

    let evals = obs.length;
    for (;;) {
        const cfg = sampleConfig(params, obs);
        const o = evalConfig(cfg, cacheFor(cfg));
        if (!o) continue;
        evals++;
        obs.push(o);
        if (!best || o.score > best.score) {
            best = o;
            stalled = 0;
        } else {
            stalled++;
        }
        send({ type: "obs", id: job.id, obs: o });
        if (evals % 50 === 0) {
            send({
                type: "status", id: job.id, evals, stalled,
                best: best ? { score: best.score, ssim: best.ssim, ms: best.ms, config: best.config } : null,
            });
        }
    }
}

main().catch(fail);
