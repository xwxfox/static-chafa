import { renderBuffer, defaultConfig, AnimPlayer } from "./codec.ts";
import fs from "node:fs";

const W = 80, H = 35, runs = 10;

type Bench = { name: string; buf: Uint8Array };
const benches: Bench[] = [
    { name: "PNG",  buf: fs.readFileSync("fox.png") },
    { name: "JPEG", buf: fs.readFileSync("fox.jpg") },
    { name: "BMP",  buf: fs.readFileSync("fox.bmp") },
    { name: "WebP", buf: fs.readFileSync("fox.webp") },
    { name: "GIF",  buf: fs.readFileSync("fox.gif") },
];

// ── Preview ──
const { ansi } = renderBuffer(new Uint8Array(benches[0]!.buf), { termW: W, termH: H });
const { renderImageToTerminal } = await import("./chafa.ts");
console.log(ansi);
console.log("=== Preview (via codec.so) ↑\n");
console.log(`=== Bench (${runs}x avg) → terminal ${W}x${H} ===\n`);

// ── Benchmark ──
// warm canvas
renderBuffer(new Uint8Array(benches[0]!.buf), { termW: W, termH: H });

for (const b of benches) {
    let total = 0, min = Infinity, max = 0;
    let m: any;
    for (let i = 0; i < runs; i++) {
        const t = performance.now();
        const r = renderBuffer(new Uint8Array(b.buf), { termW: W, termH: H });
        const elapsed = performance.now() - t;
        total += elapsed;
        if (elapsed < min) min = elapsed;
        if (elapsed > max) max = elapsed;
        if (i === 0) m = r.metrics;
    }
    const avg = total / runs;
    const dm = m ? `parse ${m.parseMs.toFixed(1)}ms render ${m.renderMs.toFixed(1)}ms` : '';
    console.log(`${b.name.padEnd(5)} ${b.name}: ${m?.imgW}x${m?.imgH} → ${avg.toFixed(2)}ms (min ${min.toFixed(2)}ms max ${max.toFixed(2)}ms) → ${(1000/avg).toFixed(0)}fps [${dm}]`);
}
