#!/usr/bin/env bun
/**
 * @file playground/perf.ts
 * @brief Real-world playback benchmark: animations + video.
 *
 * Usage:
 *   bun run playground/perf.ts
 *   bun run playground/perf.ts --term 160x48 --mode kitty
 *   bun run playground/perf.ts --mode all --frames 300
 *   bun run playground/perf.ts --files teseractor.gif boykisser.mp4
 *
 * When stdout is a TTY, the real terminal size is used. Modes:
 * symbols, kitty, sixels, iterm2, all (default: symbols).
 *
 * Per run it reports: terminal size, render size (cells + pixels),
 * bytes written per frame, fps, per-frame decode/render breakdown.
 */

import Chafa, { PixelMode, CanvasMode } from "../src/index.ts";
import fs from "node:fs";
import path from "node:path";

/* ---- args ---- */
const argv = process.argv.slice(2);
function argVal(name: string, def: string): string {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && argv[i + 1] ? argv[i + 1]! : def;
}
const TERM_ARG = argVal("term", "");
const MODE_ARG = argVal("mode", "symbols");
const FRAMES_ARG = parseInt(argVal("frames", "600"), 10);
const FILES_ARG = argVal("files", "");
const MEDIA = argVal("media", "playground/media");
const WRITE_OUT = argv.includes("--write");
const DETECT_ONLY = argv.includes("--detect");

const MODE_NAMES: Record<string, number> = {
    symbols: PixelMode.SYMBOLS,
    kitty: PixelMode.KITTY,
    sixels: PixelMode.SIXELS,
    iterm2: PixelMode.ITERM2,
};

let termW = 80, termH = 24;
if (TERM_ARG.includes("x")) {
    [termW, termH] = TERM_ARG.split("x").map(Number) as [number, number];
} else if (process.stdout.isTTY) {
    termW = process.stdout.columns ?? 80;
    termH = process.stdout.rows ? process.stdout.rows - 2 : 24;
}

const modes: number[] =
    MODE_ARG === "all"
        ? [PixelMode.SYMBOLS, PixelMode.KITTY, PixelMode.SIXELS, PixelMode.ITERM2]
        : [MODE_NAMES[MODE_ARG] ?? PixelMode.SYMBOLS];

const DEFAULT_FILES = [
    "teseractor.gif", "teseractor.webp", "stress_test.gif", "stress_test.webp",
    "test.mp4", "boykisser.mp4", "test_audio.mp4",
];
const files = (FILES_ARG ? FILES_ARG.split(",") : DEFAULT_FILES)
    .map((f) => (fs.existsSync(f) ? f : path.join(MEDIA, f)))
    .filter((f) => fs.existsSync(f));

console.log(
    `term ${termW}x${termH} cells | tty ${process.stdout.isTTY} | platform ${process.platform}/${process.arch} | ` +
    `frames cap ${FRAMES_ARG} | write ${WRITE_OUT} | media: ${files.join(", ")}`
);
console.log("=".repeat(120));

if (DETECT_ONLY) {
    const info = await Chafa.detect();
    console.log("detect():", JSON.stringify(info, null, 2));
    process.exit(0);
}

/* ---- one animation file, one mode ---- */
async function runAnim(file: string, mode: number): Promise<void> {
    const buf = fs.readFileSync(file);
    const chafa = new Chafa({ termW, termH, pixelMode: mode, canvasMode: CanvasMode.TRUECOLOR });
    await chafa.probeReady; /* real cell size + probed mode before opening */
    const tOpen = performance.now();
    const anim = chafa.openAnimation(buf);
    const openMs = performance.now() - tOpen;

    let n = 0, bytes = 0, writeMs = 0;
    let scale = 0, draw = 0, build = 0, decode = 0;
    let first = true;
    const cw: number[] = [], chh: number[] = [], pw: number[] = [], ph: number[] = [];
    const t0 = performance.now();
    while (n < FRAMES_ARG) {
        const d0 = performance.now();
        const f = anim.next();
        decode += performance.now() - d0;
        if (!f) break;
        const r = anim.renderFrame(f.frameIndex);
        n++;
        if (first) {
            cw.push(r.metrics.canvasW); chh.push(r.metrics.canvasH);
            pw.push(r.metrics.canvasPw); ph.push(r.metrics.canvasPh);
            first = false;
        }
        bytes += Buffer.byteLength(r.ansi);
        scale += r.metrics.scaleMs; draw += r.metrics.drawMs; build += r.metrics.buildMs;
        if (WRITE_OUT) {
            const w0 = performance.now();
            await Bun.write(Bun.stdout, r.ansi);
            writeMs += performance.now() - w0;
        }
    }
    const dt = performance.now() - t0;
    anim.close();
    chafa.destroy();

    const modeName = Object.keys(MODE_NAMES).find((k) => MODE_NAMES[k] === mode)!;
    console.log(
        `${path.basename(file).padEnd(20)} ${"anim".padEnd(5)} ${modeName.padEnd(7)} ` +
        `term ${String(termW).padStart(3)}x${String(termH).padStart(3)} | ` +
        `render ${String(cw[0] ?? "?").padStart(3)}x${String(chh[0] ?? "?").padStart(3)} cells ` +
        `${String(pw[0] ?? "?").padStart(4)}x${String(ph[0] ?? "?").padStart(4)}px | ` +
        `open ${openMs.toFixed(0).padStart(6)}ms | ${String(n).padStart(4)}f ${(dt / 1000).toFixed(1).padStart(6)}s ` +
        `(${(n / (dt / 1000)).toFixed(0).padStart(4)}fps) | ` +
        `decode ${(decode / n).toFixed(1)} scale ${(scale / n).toFixed(1)} draw ${(draw / n).toFixed(1)} ` +
        `build ${(build / n).toFixed(1)}${WRITE_OUT ? ` write ${(writeMs / n).toFixed(1)}` : ""} ms/f | ` +
        `${(bytes / Math.max(1, n) / 1024).toFixed(1)}KB/frame`
    );
}

/* ---- one video file, one mode ---- */
async function runVideo(file: string, mode: number): Promise<void> {
    const buf = fs.readFileSync(file);
    const chafa = new Chafa({ termW, termH, pixelMode: mode, canvasMode: CanvasMode.TRUECOLOR });
    await chafa.probeReady; /* real cell size + probed mode before opening */
    const tOpen = performance.now();
    const video = chafa.openVideo(buf);
    const openMs = performance.now() - tOpen;

    let n = 0, bytes = 0, writeMs = 0;
    let decode = 0, draw = 0, scale = 0, build = 0;
    let first = true;
    const cw: number[] = [], chh: number[] = [], pw: number[] = [], ph: number[] = [];
    const t0 = performance.now();
    while (n < FRAMES_ARG) {
        const d0 = performance.now();
        const f = video.nextFrame();
        decode += performance.now() - d0;
        if (!f) break;
        const r = chafa.renderRgba(f.rgba, f.width, f.height);
        n++;
        if (first) {
            cw.push(r.metrics.canvasW); chh.push(r.metrics.canvasH);
            pw.push(r.metrics.canvasPw); ph.push(r.metrics.canvasPh);
            first = false;
        }
        bytes += Buffer.byteLength(r.ansi);
        draw += r.metrics.drawMs; scale += r.metrics.scaleMs; build += r.metrics.buildMs;
        if (WRITE_OUT) {
            const w0 = performance.now();
            await Bun.write(Bun.stdout, r.ansi);
            writeMs += performance.now() - w0;
        }
    }
    const dt = performance.now() - t0;
    video.close();
    chafa.destroy();

    const modeName = Object.keys(MODE_NAMES).find((k) => MODE_NAMES[k] === mode)!;
    console.log(
        `${path.basename(file).padEnd(20)} ${"video".padEnd(5)} ${modeName.padEnd(7)} ` +
        `term ${String(termW).padStart(3)}x${String(termH).padStart(3)} | ` +
        `render ${String(cw[0] ?? "?").padStart(3)}x${String(chh[0] ?? "?").padStart(3)} cells ` +
        `${String(pw[0] ?? "?").padStart(4)}x${String(ph[0] ?? "?").padStart(4)}px | ` +
        `open ${openMs.toFixed(0).padStart(6)}ms | ${String(n).padStart(4)}f ${(dt / 1000).toFixed(1).padStart(6)}s ` +
        `(${(n / (dt / 1000)).toFixed(0).padStart(4)}fps) | ` +
        `decode ${(decode / n).toFixed(1)} scale ${(scale / n).toFixed(1)} draw ${(draw / n).toFixed(1)} ` +
        `build ${(build / n).toFixed(1)}${WRITE_OUT ? ` write ${(writeMs / n).toFixed(1)}` : ""} ms/f | ` +
        `${(bytes / Math.max(1, n) / 1024).toFixed(1)}KB/frame`
    );
}

for (const mode of modes) {
    for (const file of files) {
        const isVideo = /\.(mp4|mkv|webm|avi|mov)$/i.test(file);
        if (isVideo) await runVideo(file, mode);
        else await runAnim(file, mode);
    }
}
