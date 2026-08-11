import { openAnim, AnimPlayer } from "../src/ffi.ts";
import fs from "node:fs";

const W = 80, H = 35;
const SPEED = 10;
const MAX_FRAMES = 100;
const PATH = "playground/media/stress_test.webp";

const buf = new Uint8Array(fs.readFileSync(PATH));
console.log(`Opening ${PATH}...`);

const t = performance.now();
const player = openAnim(buf, { termW: W, termH: H, maxFrames: MAX_FRAMES, speed: SPEED });
if (!player) { console.log("Failed to open"); process.exit(1); }
console.log(`opened in ${(performance.now()-t).toFixed(0)}ms\n`);

const CLEAR = "\x1b[2J\x1b[H";
const start = performance.now();
let frameCount = 0;
const renderTimes: number[] = [];

while (true) {
    const n = player.next();
    if (!n) break;

    const t0 = performance.now();
    const { ansi } = player.renderFrame(n.frameIndex);
    const renderTime = performance.now() - t0;
    renderTimes.push(renderTime);
    frameCount++;

    Bun.write(Bun.stdout,
        CLEAR + ansi +
        `\nframe ${frameCount} | render ${renderTime.toFixed(1)}ms | ` +
        `delay ${n.metrics.frameDelayMs}ms | ${((frameCount)/((performance.now()-start)/1000)).toFixed(0)}fps`
    );

    const wait = (n.metrics.frameDelayMs / SPEED) - renderTime;
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
}

player.close();
const total = (performance.now() - start) / 1000;

console.log(`\n\n=== Summary ===`);
console.log(`frames: ${frameCount}  speed: ${SPEED}x`);
console.log(`playback: ${total.toFixed(2)}s → ${(frameCount/total).toFixed(0)}fps`);
console.log(`render avg: ${(renderTimes.reduce((a,b)=>a+b,0)/renderTimes.length).toFixed(2)}ms`);
