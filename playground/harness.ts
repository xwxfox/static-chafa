#!/usr/bin/env bun
/**
 * @file playground/harness.ts
 * @brief Quality/perf tuning harness - renders media with detailed per-stage
 * metrics and compares outputs pixel-for-pixel against ground-truth frames.
 *
 * Emits per frame:
 *   - ground/frame_NNN.png   decoded RGBA frame (what chafa received)
 *   - ref/frame_NNN.png      ground truth scaled to the draw fit box
 *   - symbols/frame_NNN.png  symbol-mode output rasterized (exact chafa glyphs)
 *   - sixel/frame_NNN.png    sixel output decoded back to pixels
 *   - kitty/frame_NNN.png    kitty output decoded back to pixels
 * plus metrics.json with per-stage timings + PSNR/SSIM quality scores.
 *
 * Usage:
 *   bun run playground/harness.ts render fox.png --mode all
 *   bun run playground/harness.ts render boykisser.mp4 --frames 10 --term 123x40
 *   bun run playground/harness.ts render teseractor.gif --frames 5 --out out/gif
 *   bun run playground/harness.ts tune fox.png --frames 5
 *   bun run playground/harness.ts tune boykisser.mp4 --frames 20 --term 123x40 --lambda 2
 */

import Chafa, {
    CanvasMode, PixelMode, DitherMode, ColorExtractor, ColorSpace, PixelFit,
} from "../src/index.ts";
import fs from "node:fs";
import path from "node:path";
import { deflateSync } from "node:zlib";

/* ════════════════════════════════════════════════════════════════════
   CLI args
   ════════════════════════════════════════════════════════════════════ */

const argv = process.argv.slice(2);
const CMD = argv[0] ?? "render";
const FILE = argv[1];
function argVal(name: string, def: string): string {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && argv[i + 1] ? argv[i + 1]! : def;
}
const FRAMES = parseInt(argVal("frames", "3"), 10);
const OUT = argVal("out", `harness_out/${path.basename(FILE ?? "media").replace(/\.[^.]+$/, "")}`);
const MODE = argVal("mode", "all");
const LAMBDA = parseFloat(argVal("lambda", "2"));
const TERM_ARG = argVal("term", "80x24");
let CONFIG_JSON: Record<string, number | string> = {};
try { CONFIG_JSON = JSON.parse(argVal("config", "{}") ?? "{}"); } catch {}
const [termW, termH] = TERM_ARG.split("x").map(Number) as [number, number];
const IS_VIDEO = /\.(mp4|mkv|webm|avi|mov)$/i.test(FILE ?? "");
const IS_ANIM = /\.(gif|webp)$/i.test(FILE ?? "");

const MODE_NAMES: Record<string, number> = {
    symbols: PixelMode.SYMBOLS,
    sixel: PixelMode.SIXELS,
    kitty: PixelMode.KITTY,
    iterm2: PixelMode.ITERM2,
};

/* ════════════════════════════════════════════════════════════════════
   PNG writer (RGB8, filter 0, zlib)
   ════════════════════════════════════════════════════════════════════ */

const CRC_TABLE: number[] = (() => {
    const t = new Array<number>(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();

function crc32(buf: Uint8Array): number {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
    const out = new Uint8Array(12 + data.length);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, data.length);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
}

export function writePng(file: string, rgb: Uint8Array, w: number, h: number): void {
    const ihdr = new Uint8Array(13);
    const dv = new DataView(ihdr.buffer);
    dv.setUint32(0, w);
    dv.setUint32(4, h);
    ihdr[8] = 8;
    ihdr[9] = 2; /* RGB */
    const raw = new Uint8Array((w * 3 + 1) * h);
    for (let y = 0; y < h; y++) {
        raw[y * (w * 3 + 1)] = 0;
        raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (w * 3 + 1) + 1);
    }
    const idat = deflateSync(raw, { level: 6 });
    const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const parts = [sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", idat), pngChunk("IEND", new Uint8Array(0))];
    const total = parts.reduce((a, p) => a + p.length, 0);
    const all = new Uint8Array(total);
    let off = 0;
    for (const p of parts) { all.set(p, off); off += p.length; }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, all);
}

/* ════════════════════════════════════════════════════════════════════
   Bilinear scaler
   ════════════════════════════════════════════════════════════════════ */

export function bilinearScale(rgba: Uint8Array, sw: number, sh: number, dw: number, dh: number): Uint8Array {
    const out = new Uint8Array(dw * dh * 4);
    const xs = sw / dw, ys = sh / dh;
    for (let y = 0; y < dh; y++) {
        const sy = Math.min(sh - 1, y * ys);
        const y0 = Math.floor(sy), fy = sy - y0;
        const y1 = Math.min(sh - 1, y0 + 1);
        const r0 = y0 * sw * 4, r1 = y1 * sw * 4, ro = y * dw * 4;
        for (let x = 0; x < dw; x++) {
            const sx = Math.min(sw - 1, x * xs);
            const x0 = Math.floor(sx), fx = sx - x0;
            const x1 = Math.min(sw - 1, x0 + 1);
            const i00 = r0 + x0 * 4, i01 = r0 + x1 * 4, i10 = r1 + x0 * 4, i11 = r1 + x1 * 4;
            for (let c = 0; c < 4; c++) {
                const v = rgba[i00 + c]! * (1 - fx) * (1 - fy) + rgba[i01 + c]! * fx * (1 - fy)
                        + rgba[i10 + c]! * (1 - fx) * fy + rgba[i11 + c]! * fx * fy;
                out[ro + x * 4 + c] = Math.round(v);
            }
        }
    }
    return out;
}

/* ════════════════════════════════════════════════════════════════════
   Sixel decoder
   ════════════════════════════════════════════════════════════════════ */

export function decodeSixel(ansi: string): { rgb: Uint8Array; w: number; h: number } | null {
    let start = ansi.indexOf("\x1bP");
    if (start < 0) return null;
    const q = ansi.indexOf("q", start);
    if (q < 0) return null;
    let end = ansi.indexOf("\x1b\\", q);
    if (end < 0) end = ansi.length;
    const payload = ansi.slice(q + 1, end);

    let W = 0, H = 0;
    const m = /"([0-9;]+);(\d+);(\d+)/.exec(payload);
    if (m) { W = +m[2]!; H = +m[3]!; }

    const palette = new Map<number, [number, number, number]>();
    const palDef = /#(\d+);2;(\d+);(\d+);(\d+)/g;
    let pm: RegExpExecArray | null;
    while ((pm = palDef.exec(payload))) {
        palette.set(+pm[1]!, [
            Math.min(255, Math.round((+pm[2]! * 255) / 100)),
            Math.min(255, Math.round((+pm[3]! * 255) / 100)),
            Math.min(255, Math.round((+pm[4]! * 255) / 100)),
        ]);
    }
    const data = payload.replace(/#\d+;2;\d+;\d+;\d+/g, "");

    if (W <= 0 || H <= 0) return null;

    const rgb = new Uint8Array(W * H * 3);
    let cur: [number, number, number] = [0, 0, 0];
    let x = 0, y = 0;

    const paint = (ch: string) => {
        const bits = ch.charCodeAt(0) - 63;
        for (let i = 0; i < 6; i++) {
            if (bits & (1 << i)) {
                const py = y + i;
                if (py < H) {
                    const o = (py * W + x) * 3;
                    rgb[o] = cur[0]; rgb[o + 1] = cur[1]; rgb[o + 2] = cur[2];
                }
            }
        }
        x++;
    };

    for (let i = 0; i < data.length; i++) {
        const c = data[i]!;
        if (c === "$") { x = 0; continue; }
        if (c === "-") { y += 6; x = 0; continue; }
        if (c === "!") {
            let n = 0, j = i + 1;
            while (j < data.length && data[j]! >= "0" && data[j]! <= "9") {
                n = n * 10 + (data.charCodeAt(j) - 48);
                j++;
            }
            const rep = data[j];
            if (rep && rep >= "?" && rep <= "~") {
                for (let k = 0; k < n; k++) paint(rep);
                i = j;
            }
            continue;
        }
        if (c === "#") {
            let n = 0, j = i + 1;
            while (j < data.length && data[j]! >= "0" && data[j]! <= "9") {
                n = n * 10 + (data.charCodeAt(j) - 48);
                j++;
            }
            const col = palette.get(n);
            if (col) cur = col;
            i = j - 1;
            continue;
        }
        if (c >= "?" && c <= "~") paint(c);
    }
    return { rgb, w: W, h: H };
}

/* ════════════════════════════════════════════════════════════════════
   Kitty decoder (f=32 raw RGBA chunks, base64)
   ════════════════════════════════════════════════════════════════════ */

export function decodeKitty(ansi: string): { rgb: Uint8Array; w: number; h: number } | null {
    /* chafa emits (passthrough NONE): one header with s=/v= and no payload,
       then per-chunk "\x1b_Gm=1;<base64>\x1b\\" payload sequences. */
    const parts: Buffer[] = [];
    let W = 0, H = 0;
    const re = /\x1b_G(.*?)\x1b\\/gs;
    let m: RegExpExecArray | null;
    while ((m = re.exec(ansi))) {
        const body = m[1]!;
        const semi = body.lastIndexOf(";");
        const keys = semi >= 0 ? body.slice(0, semi) : body;
        const payload = semi >= 0 ? body.slice(semi + 1) : "";
        if (!W) {
            const sm = /s=(\d+)/.exec(keys);
            const vm = /v=(\d+)/.exec(keys);
            if (sm && vm) { W = +sm[1]!; H = +vm[1]!; }
        }
        if (payload.length > 0) parts.push(Buffer.from(payload, "base64"));
    }
    if (!W || !H || parts.length === 0) return null;
    const raw = Buffer.concat(parts);
    const need = W * H * 4;
    if (raw.length < need) return null;
    const rgb = new Uint8Array(W * H * 3);
    for (let i = 0; i < W * H; i++) {
        rgb[i * 3] = raw[i * 4]!;
        rgb[i * 3 + 1] = raw[i * 4 + 1]!;
        rgb[i * 3 + 2] = raw[i * 4 + 2]!;
    }
    return { rgb, w: W, h: H };
}

/* ════════════════════════════════════════════════════════════════════
   Symbol rasterizer (exact chafa glyph bitmaps)
   ════════════════════════════════════════════════════════════════════ */

const XTERM_256: number[][] = (() => {
    const pal: number[][] = [];
    for (let i = 0; i < 16; i++) {
        pal.push((i < 8
            ? [i & 1 ? 0xcd : 0x00, i & 2 ? 0xcd : 0x00, i & 4 ? 0xcd : 0x00]
            : [i & 1 ? 0xff : 0x5f, i & 2 ? 0xff : 0x5f, i & 4 ? 0xff : 0x5f]) as [number, number, number]);
    }
    const ramp = [0, 0x5f, 0x87, 0xaf, 0xd7, 0xff];
    for (let r = 0; r < 6; r++) for (let g = 0; g < 6; g++) for (let b = 0; b < 6; b++) {
        pal.push([ramp[r]!, ramp[g]!, ramp[b]!]);
    }
    for (let i = 0; i < 24; i++) {
        const v = 8 + i * 10;
        pal.push([v, v, v]);
    }
    return pal;
})();

function resolveColor(v: number, canvasMode: number): [number, number, number] {
    if (v < 0) return [0, 0, 0];
    if (canvasMode === CanvasMode.TRUECOLOR && v > 255) {
        return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
    }
    if (v <= 255) {
        /* INDEXED_240 = xterm palette minus the first 16 aixterm colors */
        if (canvasMode === CanvasMode.INDEXED_240 && v < 240) v += 16;
        return (XTERM_256[v] ?? [0, 0, 0]) as [number, number, number];
    }
    return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

/** Rasterize a chafa matrix to RGB at 8x8 px per cell (canvas pixel space). */
export function rasterizeMatrix(
    matrix: string, glyphs: Uint8Array, charToIdx: Map<number, number>,
    canvasMode: number, cw: number, ch: number,
): Uint8Array {
    const cells: number[][][] = JSON.parse(matrix);
    const W = cw * 8, H = ch * 8;
    const rgb = new Uint8Array(W * H * 3);
    for (let cy = 0; cy < ch; cy++) {
        const row = cells[cy] ?? [];
        for (let cx = 0; cx < cw; cx++) {
            const cell = row[cx] ?? [32, -1, -1];
            const cp = cell[0] ?? 32;
            const fg = resolveColor(cell[1] ?? -1, canvasMode);
            const bg = resolveColor(cell[2] ?? -1, canvasMode);
            const gi = charToIdx.get(cp);
            const bits = gi !== undefined ? glyphs.subarray(gi * 8, gi * 8 + 8) : null;
            const px = cx * 8, py = cy * 8;
            for (let y = 0; y < 8; y++) {
                const rowBits = bits ? bits[y]! : 0xff;
                for (let x = 0; x < 8; x++) {
                    const col = rowBits & (1 << x) ? fg : bg;
                    const o = ((py + y) * W + (px + x)) * 3;
                    rgb[o] = col[0]; rgb[o + 1] = col[1]; rgb[o + 2] = col[2];
                }
            }
        }
    }
    return rgb;
}

/* ════════════════════════════════════════════════════════════════════
   Quality metrics
   ════════════════════════════════════════════════════════════════════ */

export function psnr(a: Uint8Array, b: Uint8Array): number {
    if (a.length !== b.length) return NaN;
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
        const d = a[i]! - b[i]!;
        sum += d * d;
    }
    const mse = sum / a.length;
    if (mse === 0) return Infinity;
    return 10 * Math.log10((255 * 255) / mse);
}

export function ssim(a: Uint8Array, b: Uint8Array, w: number, h: number): number {
    if (a.length !== b.length || w < 8 || h < 8) return NaN;
    const lum = (r: Uint8Array, i: number) => 0.299 * r[i]! + 0.587 * r[i + 1]! + 0.114 * r[i + 2]!;
    const K1 = 0.01, K2 = 0.03;
    const C1 = (K1 * 255) ** 2, C2 = (K2 * 255) ** 2;
    let sum = 0, count = 0;
    const step = 4;
    for (let y = 0; y + 8 <= h; y += step) {
        for (let x = 0; x + 8 <= w; x += step) {
            let ma = 0, mb = 0;
            for (let j = 0; j < 8; j++) {
                const r = (y + j) * w * 3;
                for (let i = 0; i < 8; i++) {
                    ma += lum(a, r + (x + i) * 3);
                    mb += lum(b, r + (x + i) * 3);
                }
            }
            ma /= 64; mb /= 64;
            let va = 0, vb = 0, cov = 0;
            for (let j = 0; j < 8; j++) {
                const r = (y + j) * w * 3;
                for (let i = 0; i < 8; i++) {
                    const o = r + (x + i) * 3;
                    const da = lum(a, o) - ma;
                    const db = lum(b, o) - mb;
                    va += da * da; vb += db * db; cov += da * db;
                }
            }
            va /= 63; vb /= 63; cov /= 63;
            sum += ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
            count++;
        }
    }
    return count > 0 ? sum / count : NaN;
}

/* ════════════════════════════════════════════════════════════════════
   Fit box (mirrors codec.c compute_fit_box exactly: even dims, no upscale
   beyond source when source < canvas? No - mirrors: s = min(cw/sw, ch/sh))
   ════════════════════════════════════════════════════════════════════ */

function fitBox(srcW: number, srcH: number, cw: number, ch: number): [number, number] {
    const s = Math.min(cw / srcW, ch / srcH);
    let fw = Math.floor(srcW * s) & ~1;
    let fh = Math.floor(srcH * s) & ~1;
    if (fw < 2) fw = 2;
    if (fh < 2) fh = 2;
    return [fw, fh];
}

function rgbaToRgb(rgba: Uint8Array): Uint8Array {
    const n = rgba.length / 4 | 0;
    const rgb = new Uint8Array(n * 3);
    for (let i = 0; i < n; i++) {
        rgb[i * 3] = rgba[i * 4]!;
        rgb[i * 3 + 1] = rgba[i * 4 + 1]!;
        rgb[i * 3 + 2] = rgba[i * 4 + 2]!;
    }
    return rgb;
}

/** Compare a canvas-sized raster against the reference, which is the ground
    truth stretched (non-uniform, matching chafa's default TUCK_STRETCH
    placement) to the full canvas. Sizes must match. */
function compareFull(
    raster: Uint8Array, rasterW: number, ref: Uint8Array,
): { psnr: number; ssim: number } {
    const h = raster.length / 3 / rasterW;
    const p = psnr(raster, ref);
    const s = ssim(raster, ref, rasterW, h);
    return { psnr: p, ssim: s };
}

/* ════════════════════════════════════════════════════════════════════
   Sources (per Chafa instance / pixel mode)
   ════════════════════════════════════════════════════════════════════ */

interface Frame {
    rgba: Uint8Array;
    w: number;
    h: number;
}

interface Source {
    kind: string;
    frameCountHint: number;
    nextGround: () => Promise<Frame | null>;
    renderCurrent: () => Promise<{ ansi: string; metrics: any } | null>;
    matrixCurrent: () => Promise<{ matrix: string; metrics: any } | null>;
    close: () => void;
}

async function openSource(file: string, chafa: Chafa, decodeScale: number): Promise<Source> {
    const buf = fs.readFileSync(file);
    await chafa.probeReady;

    if (IS_VIDEO) {
        let v = chafa.openVideo(buf);
        if (decodeScale !== 1.0) {
            /* reopen at a scaled decode target */
            const pm = chafa.config.pixelMode;
            const cw = pm === PixelMode.SYMBOLS ? termW * 8 : termW * chafa.config.cellW;
            const chh = pm === PixelMode.SYMBOLS ? termH * 8 : termH * chafa.config.cellH;
            const [dw0, dh0] = fitBox(v.width, v.height, cw, chh);
            v.close();
            v = chafa.openVideo(buf,
                Math.max(2, Math.round(dw0 * decodeScale) & ~1),
                Math.max(2, Math.round(dh0 * decodeScale) & ~1));
        }
        let cur: Frame | null = null;
        return {
            kind: "video",
            frameCountHint: Math.round(v.durationSec * v.fps),
            nextGround: async () => {
                const f = v.nextFrame();
                if (!f) return null;
                cur = { rgba: new Uint8Array(f.rgba), w: f.width, h: f.height };
                return cur;
            },
            renderCurrent: async () => {
                if (!cur) return null;
                const r = chafa.renderRgba(cur.rgba, cur.w, cur.h);
                return { ansi: r.ansi, metrics: r.metrics };
            },
            matrixCurrent: async () => {
                if (!cur) return null;
                return chafa.renderMatrixRgba(cur.rgba, cur.w, cur.h);
            },
            close: () => v.close(),
        };
    }

    if (IS_ANIM) {
        const anim = chafa.openAnimation(buf);
        let idx = 0;
        return {
            kind: "anim",
            frameCountHint: anim.frameCount,
            nextGround: async () => {
                const f = anim.next();
                if (!f) return null;
                const data = anim.frameData(f.frameIndex);
                if (!data) return null;
                idx = f.frameIndex;
                return { rgba: new Uint8Array(data), w: anim.width, h: anim.height };
            },
            renderCurrent: async () => {
                const r = anim.renderFrame(idx);
                return { ansi: r.ansi, metrics: r.metrics };
            },
            matrixCurrent: async () => {
                const data = anim.frameData(idx);
                if (!data) return null;
                return chafa.renderMatrixRgba(data, anim.width, anim.height);
            },
            close: () => anim.close(),
        };
    }

    /* static image */
    const img = chafa.decode(buf);
    const rgba = new Uint8Array(img.rgba);
    const w = img.width, h = img.height;
    return {
        kind: "image",
        frameCountHint: 1,
        nextGround: async () => ({ rgba, w, h }),
        renderCurrent: async () => {
            const r = chafa.renderRgba(rgba, w, h);
            return { ansi: r.ansi, metrics: r.metrics };
        },
        matrixCurrent: async () => chafa.renderMatrixRgba(rgba, w, h),
        close: () => img.destroy(),
    };
}

/* ════════════════════════════════════════════════════════════════════
   Per-mode render + compare
   ════════════════════════════════════════════════════════════════════ */

interface ModeReport {
    mode: string;
    frames: {
        i: number;
        decodeMs: number;
        renderMs: number;
        metrics: Record<string, number>;
        outputBytes: number;
        quality: { psnr: number; ssim: number } | null;
        harnessMs: Record<string, number>;
    }[];
}

async function runMode(
    file: string, chafa: Chafa, mode: string, outDir: string, decodeScale: number,
): Promise<ModeReport> {
    const src = await openSource(file, chafa, decodeScale);
    const frames: ModeReport["frames"] = [];
    const canvasPw = mode === "symbols" ? termW * 8 : termW * chafa.config.cellW;
    const canvasPh = mode === "symbols" ? termH * 8 : termH * chafa.config.cellH;

    for (let i = 0; i < FRAMES; i++) {
        const d0 = performance.now();
        const g = await src.nextGround();
        const decodeMs = performance.now() - d0;
        if (!g) break;

        const harnessMs: Record<string, number> = {};
        const pad = String(i).padStart(3, "0");

        /* ground (shared) + per-mode reference PNGs */
        let t0 = performance.now();
        writePng(path.join(outDir, "ground", `frame_${pad}.png`), rgbaToRgb(g.rgba), g.w, g.h);
        harnessMs["groundPng"] = performance.now() - t0;
        t0 = performance.now();
        /* reference = ground truth stretched to the full canvas (chafa's
           default TUCK_STRETCH placement fills the canvas, changing aspect) */
        const ref = bilinearScale(g.rgba, g.w, g.h, canvasPw, canvasPh);
        const refRgb = rgbaToRgb(ref);
        writePng(path.join(outDir, mode, `ref_frame_${pad}.png`), refRgb, canvasPw, canvasPh);
        harnessMs["refPng"] = performance.now() - t0;

        const r0 = performance.now();
        let ansi: string | null = null;
        let metrics: any = null;
        let matrix: string | null = null;
        let quality: { psnr: number; ssim: number } | null = null;

        const rr = await src.renderCurrent();
        if (rr) { ansi = rr.ansi; metrics = rr.metrics; }

        if (mode === "symbols") {
            const mr = await src.matrixCurrent();
            matrix = mr?.matrix ?? null;
            if (!metrics && mr) metrics = mr.metrics;
            if (matrix) {
                t0 = performance.now();
                const cells: number[][][] = JSON.parse(matrix);
                const chh = cells.length;
                const cw = cells[0]?.length ?? 0;
                const unique = new Map<number, number>();
                const flat: number[] = [];
                for (const row of cells) for (const cell of row ?? []) {
                    const cp = cell?.[0] ?? 32;
                    if (!unique.has(cp)) { unique.set(cp, flat.length); flat.push(cp); }
                }
                const glyphs = chafa.symbolGlyphs(Uint32Array.from(flat));
                const raster = rasterizeMatrix(matrix, glyphs, unique, chafa.config.canvasMode, cw, chh);
                quality = compareFull(raster, cw * 8, refRgb);
                writePng(path.join(outDir, "symbols", `frame_${pad}.png`), raster, cw * 8, chh * 8);
                harnessMs["symbolsRaster"] = performance.now() - t0;
            }
        } else if (ansi) {
            t0 = performance.now();
            const dec = mode === "sixel" ? decodeSixel(ansi) : decodeKitty(ansi);
            if (dec) {
                quality = compareFull(dec.rgb, dec.w, refRgb);
                writePng(path.join(outDir, mode, `frame_${pad}.png`), dec.rgb, dec.w, dec.h);
            }
            harnessMs[`${mode}Decode`] = performance.now() - t0;
        }

        frames.push({
            i,
            decodeMs,
            renderMs: performance.now() - r0,
            metrics: metrics ? {
                parseMs: metrics.parseMs, scaleMs: metrics.scaleMs, drawMs: metrics.drawMs,
                buildMs: metrics.buildMs, totalMs: metrics.totalMs,
                imgW: metrics.imgW, imgH: metrics.imgH,
                canvasW: metrics.canvasW, canvasH: metrics.canvasH,
                canvasPw: metrics.canvasPw, canvasPh: metrics.canvasPh,
                rgbaBytes: metrics.rgbaBytes, frameDelayMs: metrics.frameDelayMs,
                haveAlpha: metrics.haveAlpha,
            } : {},
            outputBytes: ansi ? Buffer.byteLength(ansi) : 0,
            quality,
            harnessMs,
        });
    }
    src.close();
    return { mode, frames };
}

/* ════════════════════════════════════════════════════════════════════
   render command
   ════════════════════════════════════════════════════════════════════ */

async function cmdRender(): Promise<void> {
    if (!FILE) { console.error("usage: harness.ts render <file> ..."); process.exit(1); }
    const modes = MODE === "all" ? ["symbols", "sixel", "kitty"] : [MODE];
    console.log(`render ${FILE} at ${termW}x${termH}, modes: ${modes.join(",")}, frames: ${FRAMES}`);

    const modeReports: ModeReport[] = [];
    for (const mode of modes) {
        const chafa = new Chafa({
            termW, termH, pixelMode: MODE_NAMES[mode],
            canvasMode: CanvasMode.TRUECOLOR,
            ...(CONFIG_JSON as any),
        });
        const rep = await runMode(FILE, chafa, mode, OUT, 1.0);
        modeReports.push(rep);
        chafa.destroy();
    }

    const mean = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const summary: Record<string, any> = {};
    for (const mr of modeReports) {
        const f = mr.frames;
        summary[mr.mode] = {
            frames: f.length,
            decodeMs: mean(f.map(x => x.decodeMs)),
            renderMs: mean(f.map(x => x.renderMs)),
            drawMs: mean(f.map(x => x.metrics.drawMs ?? 0)),
            buildMs: mean(f.map(x => x.metrics.buildMs ?? 0)),
            scaleMs: mean(f.map(x => x.metrics.scaleMs ?? 0)),
            totalMs: mean(f.map(x => x.decodeMs + x.renderMs)),
            outputBytes: mean(f.map(x => x.outputBytes)),
            ssim: mean(f.filter(x => x.quality).map(x => x.quality!.ssim)),
            psnr: mean(f.filter(x => x.quality).map(x => x.quality!.psnr)),
        };
        const q = summary[mr.mode]!;
        console.log(
            `${mr.mode.padEnd(8)} | ${String(q.frames).padStart(3)}f | decode ${q.decodeMs.toFixed(2)} ` +
            `draw ${q.drawMs.toFixed(2)} build ${q.buildMs.toFixed(2)} scale ${q.scaleMs.toFixed(2)} ` +
            `total ${q.totalMs.toFixed(2)}ms/f | ${(q.outputBytes / 1024).toFixed(1)}KB/f | ` +
            `ssim ${q.ssim.toFixed(4)} psnr ${q.psnr.toFixed(1)}dB`,
        );
    }

    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, "metrics.json"), JSON.stringify({
        media: FILE,
        term: { termW, termH },
        config: CONFIG_JSON,
        modes: modeReports,
        summary,
    }, null, 2));
    console.log(`wrote ${OUT}/metrics.json + PNGs`);
}

/* ════════════════════════════════════════════════════════════════════
   tune command
   ════════════════════════════════════════════════════════════════════ */

interface TuneResult {
    label: string;
    config: Record<string, number | string>;
    ssim: number;
    psnr: number;
    ms: number;
    bytes: number;
    score: number;
}

async function tuneOne(file: string, label: string, cfgOver: Record<string, number | string>, mode: string): Promise<TuneResult> {
    const decodeScale = typeof cfgOver["decodeScale"] === "number" ? cfgOver["decodeScale"] as number : 1.0;
    const cfg: any = { ...cfgOver };
    delete cfg.decodeScale;
    const chafa = new Chafa({ termW, termH, pixelMode: MODE_NAMES[mode], ...cfg });
    await chafa.probeReady;
    const src = await openSource(file, chafa, decodeScale);
    const canvasPw = mode === "symbols" ? termW * 8 : termW * chafa.config.cellW;
    const canvasPh = mode === "symbols" ? termH * 8 : termH * chafa.config.cellH;

    let ssimSum = 0, psnrSum = 0, bytes = 0, n = 0;
    /* Warm up: first-frame costs (canvas build, symbol maps, decoder start)
       must not skew the ranking - the baseline run would always look worse. */
    const warm = await src.nextGround();
    if (warm) {
        await src.renderCurrent();
        if (mode === "symbols") await src.matrixCurrent();
    }
    const t0 = performance.now();
    for (let i = 0; i < Math.min(FRAMES, 60); i++) {
        const g = await src.nextGround();
        if (!g) break;
        const ref = bilinearScale(g.rgba, g.w, g.h, canvasPw, canvasPh);
        const refRgb = rgbaToRgb(ref);
        const rr = await src.renderCurrent();
        if (!rr) break;
        bytes += Buffer.byteLength(rr.ansi);

        let raster: Uint8Array | null = null;
        if (mode === "symbols") {
            const mr = await src.matrixCurrent();
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
        } else {
            const dec = mode === "sixel" ? decodeSixel(rr.ansi) : decodeKitty(rr.ansi);
            if (!dec) continue;
            raster = dec.rgb;
        }
        const q = compareFull(raster, canvasPw, refRgb);
        ssimSum += q.ssim; psnrSum += q.psnr;
        n++;
    }
    const ms = (performance.now() - t0) / Math.max(1, n);
    src.close();
    chafa.destroy();
    const ssim = n > 0 ? ssimSum / n : 0;
    const psnr = n > 0 ? psnrSum / n : 0;
    return {
        label, config: cfgOver, ssim, psnr, ms,
        bytes: n > 0 ? bytes / n : 0,
        score: ssim * 100 - LAMBDA * ms,
    };
}

async function cmdTune(): Promise<void> {
    if (!FILE) { console.error("usage: harness.ts tune <file> ..."); process.exit(1); }
    const mode = MODE === "all" ? "symbols" : MODE;
    console.log(`tune ${FILE} (${mode}) at ${termW}x${termH}, frames ${FRAMES}, lambda ${LAMBDA}`);

    const base: Record<string, number | string> = {
        workFactor: 0, ditherMode: DitherMode.NONE, colorExtractor: ColorExtractor.AVERAGE,
        colorSpace: ColorSpace.RGB, canvasMode: CanvasMode.TRUECOLOR, preprocessing: 0,
        pixelFit: PixelFit.SCALE, symbols: "",
    };
    const dims: { key: string; values: (number | string)[] }[] = [
        { key: "workFactor", values: [0, 0.25, 0.5, 1.0] },
        { key: "ditherMode", values: [DitherMode.NONE, DitherMode.ORDERED, DitherMode.DIFFUSION, DitherMode.NOISE] },
        { key: "colorExtractor", values: [ColorExtractor.AVERAGE, ColorExtractor.MEDIAN] },
        { key: "colorSpace", values: [ColorSpace.RGB, ColorSpace.DIN99D] },
        { key: "preprocessing", values: [0, 1] },
        { key: "canvasMode", values: [CanvasMode.TRUECOLOR, CanvasMode.INDEXED_256] },
        { key: "symbols", values: ["", "block+border+space-wide"] },
    ];
    if (IS_VIDEO) dims.push({ key: "decodeScale", values: [1.0, 0.75, 0.5] });

    const results: TuneResult[] = [];
    results.push(await tuneOne(FILE, "baseline", { ...base }, mode));
    for (const dim of dims) {
        for (const v of dim.values) {
            if (v === base[dim.key]) continue;
            results.push(await tuneOne(FILE, `${dim.key}=${v}`, { ...base, [dim.key]: v }, mode));
        }
    }

    results.sort((a, b) => b.score - a.score);
    console.log("\n=== tune results (score = ssim*100 - lambda*ms, lambda=" + LAMBDA + ") ===");
    console.log(
        "label".padEnd(32) + "ssim".padStart(7) + "psnr".padStart(9) + "ms/f".padStart(8) +
        "KB/f".padStart(8) + "score".padStart(9),
    );
    for (const r of results) {
        console.log(
            r.label.padEnd(32) + r.ssim.toFixed(4).padStart(7) + r.psnr.toFixed(1).padStart(9) +
            r.ms.toFixed(2).padStart(8) + (r.bytes / 1024).toFixed(1).padStart(8) +
            r.score.toFixed(2).padStart(9),
        );
    }
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, "tune_results.json"), JSON.stringify({
        media: FILE, mode, term: { termW, termH }, lambda: LAMBDA, frames: FRAMES, results,
    }, null, 2));
    console.log(`\nwrote ${OUT}/tune_results.json`);
}

/* main - only when run directly (workers import this file as a library) */
if (import.meta.main) {
    if (CMD === "render") await cmdRender();
    else if (CMD === "tune") await cmdTune();
    else {
        console.error("usage: harness.ts render|tune <file> [--frames N] [--term WxH] [--mode symbols|sixel|kitty|all] [--out DIR] [--config JSON] [--lambda N]");
        process.exit(1);
    }
}
