#!/usr/bin/env bun
/**
 * @file scripts/bench.ts
 * @brief Comprehensive benchmark across formats, sizes, and terminal dimensions.
 *
 * Usage: bun run bench [--quick] [--json]
 */
/* eslint-disable */

import { createContext, destroyContext, render, CanvasMode, DitherMode } from "../src/ffi.ts";
import fs from "node:fs";

const RUNS = process.argv.includes("--quick") ? 3 : 10;
const MEDIA = "playground/media";

const FORMATS = [
    { name: "PNG",  path: MEDIA + "/fox.png",  size: "641x641" },
    { name: "JPEG", path: MEDIA + "/fox.jpg",  size: "641x641" },
    { name: "BMP",  path: MEDIA + "/fox.bmp",  size: "641x641" },
    { name: "WebP", path: MEDIA + "/fox.webp", size: "641x641" },
    { name: "GIF",  path: MEDIA + "/fox.gif",  size: "200x200" },
];

const TERM_SIZES = [
    { w: 40, h: 12, label: "40x12" },
    { w: 80, h: 24, label: "80x24" },
    { w: 160, h: 48, label: "160x48" },
    { w: 320, h: 96, label: "320x96" },
];

const MODES = [
    { name: "truecolor", canvasMode: CanvasMode.TRUECOLOR, ditherMode: DitherMode.NONE },
    { name: "indexed256", canvasMode: CanvasMode.INDEXED_256, ditherMode: DitherMode.DIFFUSION },
    { name: "indexed16", canvasMode: CanvasMode.INDEXED_16, ditherMode: DitherMode.DIFFUSION },
];

/* ── Benchmark single config ── */

function benchSingle(ctx: number, buf: Uint8Array, runs: number) {
    let total = 0;
    let lastMetrics: any = null;
    for (let i = 0; i < runs; i++) {
        const t0 = performance.now();
        const { metrics } = render(ctx, new Uint8Array(buf));
        total += performance.now() - t0;
        if (i === runs - 1) lastMetrics = metrics;
    }
    return { metrics: lastMetrics, msAvg: total / runs };
}

/* ── Main ── */

console.log(`=== static-chafa benchmark (${RUNS} runs each) ===\n`);

const results: any[] = [];
const buffers = new Map<string, Uint8Array>();

for (const fmt of FORMATS) {
    buffers.set(fmt.path, new Uint8Array(fs.readFileSync(fmt.path)));
}

for (const term of TERM_SIZES) {
    for (const mode of MODES) {
        const ctx = createContext({
            termW: term.w,
            termH: term.h,
            canvasMode: mode.canvasMode,
            ditherMode: mode.ditherMode,
        });

        for (const fmt of FORMATS) {
            const buf = buffers.get(fmt.path)!;
            const { metrics, msAvg } = benchSingle(ctx, buf, RUNS);

            results.push({
                format: fmt.name,
                srcSize: fmt.size,
                termSize: term.label,
                mode: mode.name,
                runs: RUNS,
                parseMsAvg: metrics.parseMs,
                drawMsAvg: metrics.drawMs,
                buildMsAvg: metrics.buildMs,
                msAvg,
                fps: Math.round(1000 / msAvg),
                rgbaBytes: metrics.rgbaBytes,
            });

            const bar = "=".repeat(Math.min(Math.round(msAvg), 30));
            console.log(`${fmt.name.padEnd(5)} ${term.label.padEnd(8)} ${mode.name.padEnd(12)} ${msAvg.toFixed(1).padStart(6)}ms ${String(Math.round(1000 / msAvg)).padStart(4)}fps ${bar}`);
        }

        destroyContext(ctx);
    }
    console.log();
}

/* ── Summary ── */

console.log("=== Per-format fastest ===\n");
for (const fmt of FORMATS) {
    const best = results.filter((r: any) => r.format === fmt.name)
        .reduce((a: any, b: any) => a.msAvg < b.msAvg ? a : b);
    console.log(`${fmt.name.padEnd(5)} fastest: ${best.termSize} ${best.mode} -> ${best.msAvg.toFixed(1)}ms (${best.fps}fps)`);
}

console.log("\n=== Timing breakdown (80x24 truecolor) ===\n");
for (const r of results.filter((r: any) => r.termSize === "80x24" && r.mode === "truecolor")) {
    console.log(`${r.format.padEnd(5)} parse ${r.parseMsAvg.toFixed(1)}ms  draw ${r.drawMsAvg.toFixed(1)}ms  build ${r.buildMsAvg.toFixed(1)}ms  rgba ${(r.rgbaBytes / 1024).toFixed(0)}KB`);
}

/* ── JSON output for CI ── */
if (process.argv.includes("--json")) {
    console.log("\n--- BENCH_JSON ---");
    console.log(JSON.stringify(results, null, 2));
    console.log("--- END ---");
}
