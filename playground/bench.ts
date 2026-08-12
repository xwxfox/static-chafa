import { createContext, destroyContext, render, defaultConfig } from "../src/ffi.ts";
import fs from "node:fs";

const W = 80, H = 35, runs = 10;

type Bench = { name: string; buf: Uint8Array };
const benches: Bench[] = [
    { name: "PNG", buf: fs.readFileSync("playground/media/fox.png") },
    { name: "JPEG", buf: fs.readFileSync("playground/media/fox.jpg") },
    { name: "BMP", buf: fs.readFileSync("playground/media/fox.bmp") },
    { name: "WebP", buf: fs.readFileSync("playground/media/fox.webp") },
    { name: "GIF", buf: fs.readFileSync("playground/media/fox.gif") },
];

const ctx = createContext({ termW: W, termH: H });

// Preview
const { ansi } = render(ctx, benches[0]!.buf);
console.log(ansi.slice(0, 200) + "...");
console.log("=== Preview ↑\n");
console.log(`=== Bench (${runs}x avg) -> terminal ${W}x${H} ===\n`);

// warm
render(ctx, benches[0]!.buf);

for (const b of benches) {
    let total = 0, min = Infinity, max = 0;
    let lastMetrics: any;
    for (let i = 0; i < runs; i++) {
        const t = performance.now();
        const r = render(ctx, new Uint8Array(b.buf));
        const elapsed = performance.now() - t;
        total += elapsed;
        if (elapsed < min) min = elapsed;
        if (elapsed > max) max = elapsed;
        lastMetrics = r.metrics;
    }
    const avg = total / runs;
    const m = lastMetrics;
    console.log(
        `${b.name.padEnd(5)} ${m?.imgW}x${m?.imgH} -> ${avg.toFixed(2)}ms ` +
        `(min ${min.toFixed(2)}ms max ${max.toFixed(2)}ms) -> ${(1000 / avg).toFixed(0)}fps ` +
        `[parse ${m?.parseMs.toFixed(1)}ms draw ${m?.drawMs.toFixed(1)}ms build ${m?.buildMs.toFixed(1)}ms]`
    );
}

destroyContext(ctx);
