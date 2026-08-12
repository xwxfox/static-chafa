import { createContext, destroyContext, render, animOpen, animNext, animRenderFrame, animRewind, animClose, animAbort, FMT_NAMES } from "../src/ffi.ts";
import fs from "node:fs";
import { execSync } from "child_process";
import { createInterface } from "node:readline";

let TW = 80, TH = 24;
try { TW = parseInt(execSync("tput cols", { stdio: ["pipe", "pipe", "pipe"] }).toString().trim()) || 80; } catch { }
try { TH = parseInt(execSync("tput lines", { stdio: ["pipe", "pipe", "pipe"] }).toString().trim()) || 24; } catch { }
if (process.stdout.columns) TW = process.stdout.columns;
if (process.stdout.rows) TH = process.stdout.rows;

const QW = Math.floor(TW / 2) - 1;
const QH = Math.floor((TH - 6) / 3);
const CLEAR = "\x1b[2J\x1b[H";
const RESET = "\x1b[0m";
const HIDE = "\x1b[?25l";
const SHOW = "\x1b[?25h";
const CLR_LN = "\x1b[2K";

function fit(s: string, w: number) { return s.length > w ? s.slice(0, w - 1) + "…" : s.padEnd(w); }

const rl = createInterface({ input: process.stdin, output: process.stdout });
function waitKey(msg: string): Promise<void> {
    return new Promise(resolve => {
        Bun.write(Bun.stdout, `\x1b[${TH};0H${SHOW}${msg} `);
        rl.question("", () => { Bun.write(Bun.stdout, `\x1b[${TH};0H${CLR_LN}`); resolve(); });
    });
}

const staticFiles = [
    { name: "PNG", file: "playground/media/fox.png" },
    { name: "JPEG", file: "playground/media/fox.jpg" },
    { name: "BMP", file: "playground/media/fox.bmp" },
    { name: "WebP", file: "playground/media/fox.webp" },
];
const bufs = new Map<string, Uint8Array>();
for (const f of staticFiles) bufs.set(f.file, new Uint8Array(fs.readFileSync(f.file)));
const gifBuf = new Uint8Array(fs.readFileSync("playground/media/teseractor.gif"));
const webpBuf = new Uint8Array(fs.readFileSync("playground/media/teseractor.webp"));

interface AnimResult { name: string; firstFrameMs: number; totalFrames: number; avgRenderMs: number; avgFps: number; minRenderMs: number; maxRenderMs: number; totalTimeMs: number; canvasW: number; canvasH: number; canvasPw: number; canvasPh: number; rgbaKB: number; format: number; }
interface MaxResult { name: string; srcW: number; srcH: number; termW: number; termH: number; frames: number; totalMs: number; fps: number; avgRender: number; minRender: number; maxRender: number; canvasW: number; canvasH: number; rgbaKB: number; format: number; }

// ═══════════════ SECTION 1: STATIC 2x2 ═══════════════
console.log(CLEAR + HIDE);
console.log(`${"═".repeat(TW)}`);
console.log(fit(`  fox.png 641x641 -> ${TW}x${TH}  quads ${QW}x${QH}`, TW));
console.log(`${"═".repeat(TW)}`);

const staticStats: {
    name: string;
    parseMs: number; drawMs: number; buildMs: number; totalMs: number;
    srcW: number; srcH: number; termW: number; termH: number;
    canvasW: number; canvasH: number; canvasPw: number; canvasPh: number;
    rgbaKB: number; format: number; canvasMode: number; pixelMode: number; haveAlpha: number;
}[] = [];
const ctx = createContext({ termW: QW, termH: QH });
render(ctx, bufs.get("playground/media/fox.png")!); // warm canvas

for (let i = 0; i < staticFiles.length; i++) {
    const f = staticFiles[i]!;
    const buf = bufs.get(f.file)!;
    let pSum = 0, dSum = 0, bSum = 0, tSum = 0;
    let lastM: any = null;
    for (let r = 0; r < 10; r++) {
        const { metrics: m } = render(ctx, new Uint8Array(buf));
        pSum += m.parseMs; dSum += m.drawMs; bSum += m.buildMs; tSum += m.totalMs;
        if (r === 9) lastM = m;
    }
    const pAvg = pSum / 10, dAvg = dSum / 10, bAvg = bSum / 10, tAvg = tSum / 10;
    staticStats[i] = {
        name: f.name,
        parseMs: pAvg, drawMs: dAvg, buildMs: bAvg, totalMs: tAvg,
        srcW: lastM.imgW, srcH: lastM.imgH, termW: QW, termH: QH,
        canvasW: lastM.canvasW, canvasH: lastM.canvasH,
        canvasPw: lastM.canvasPw, canvasPh: lastM.canvasPh,
        rgbaKB: lastM.rgbaBytes / 1024, format: lastM.format,
        canvasMode: lastM.canvasMode, pixelMode: lastM.pixelMode, haveAlpha: lastM.haveAlpha,
    };

    const { ansi } = render(ctx, buf);
    const col = (i % 2) * (QW + 1);
    const rowOff = 3 + Math.floor(i / 2) * (QH + 3);
    const lines = ansi.split("\n");
    for (let li = 0; li < Math.min(lines.length, QH); li++)
        Bun.write(Bun.stdout, `\x1b[${rowOff + li};${col}H${lines[li]}${RESET}`);
    const statsLine = `${f.name.padEnd(5)} p${pAvg.toFixed(1)} d${dAvg.toFixed(1)} b${bAvg.toFixed(1)} t${tAvg.toFixed(1)}ms -> ${(1000 / tAvg).toFixed(0)}fps`;
    Bun.write(Bun.stdout, `\x1b[${rowOff + QH};${col}H${RESET}${fit(statsLine, QW + 1)}`);
}
console.log(`\x1b[${3 + 2 * (QH + 3)};0H${"-".repeat(TW)}`);

// ═══════════════ SECTION 2: ANIMATED (10s native speed) ═══════════════
await waitKey("[Enter] for animated tests ->");

async function runAnim(name: string, buf: Uint8Array, speed: number): Promise<AnimResult> {
    const AH = Math.min(TH - 4, TH - 2), AW = TW;
    console.log(CLEAR + HIDE);
    console.log(`${"═".repeat(TW)}`);
    console.log(fit(`  ${name} - native speed, 10s - term ${AW}x${AH}`, TW));
    console.log(`${"═".repeat(TW)}`);

    const actx = createContext({ termW: AW, termH: AH, speed });
    const { handle } = animOpen(actx, buf);

    const renderTimes: number[] = [];
    let frameCount = 0, ffMs = 0, ffDone = false;
    let firstMetrics: any = null;
    const fb = performance.now(), t0 = performance.now();

    while (true) {
        const n = animNext(actx, handle);
        if (!n) { animClose(actx, handle); break; }
        const r0 = performance.now();
        const result = animRenderFrame(actx, handle, n.frameIndex);
        const { ansi } = result;
        renderTimes.push(performance.now() - r0); frameCount++;
        if (!ffDone) { ffMs = performance.now() - t0; ffDone = true; firstMetrics = result.metrics; }

        const lines = ansi.split("\n");
        for (let li = 0; li < Math.min(lines.length, AH); li++)
            Bun.write(Bun.stdout, `\x1b[${3 + li};0H${RESET}${lines[li]}${RESET}`);
        const elapsed = (performance.now() - fb) / 1000;
        const avgR = renderTimes.reduce((a, b) => a + b, 0) / frameCount;
        Bun.write(Bun.stdout, `\x1b[${3 + AH};0H${RESET}${name} frame ${frameCount} | render ${renderTimes[frameCount - 1]!.toFixed(1)}ms (avg ${avgR.toFixed(1)}) | ${(frameCount / elapsed).toFixed(0)}fps | ${elapsed.toFixed(1)}s`);
        if (elapsed >= 10) break;
        const wait = (n.metrics.frameDelayMs / speed) - renderTimes[frameCount - 1]!;
        if (wait > 0) await new Promise(r => setTimeout(r, wait));
    }
    animAbort(actx, handle);
    const totalMs = performance.now() - fb;
    destroyContext(actx);
    return {
        name, firstFrameMs: ffMs, totalFrames: frameCount,
        avgRenderMs: renderTimes.reduce((a, b) => a + b, 0) / frameCount,
        avgFps: frameCount / (totalMs / 1000),
        minRenderMs: Math.min(...renderTimes), maxRenderMs: Math.max(...renderTimes), totalTimeMs: totalMs,
        canvasW: firstMetrics?.canvasW ?? 0, canvasH: firstMetrics?.canvasH ?? 0,
        canvasPw: firstMetrics?.canvasPw ?? 0, canvasPh: firstMetrics?.canvasPh ?? 0,
        rgbaKB: (firstMetrics?.rgbaBytes ?? 0) / 1024,
        format: firstMetrics?.format ?? -1,
    };
}

const gifAnim = await runAnim("GIF", gifBuf, 1);
const webpAnim = await runAnim("WebP", webpBuf, 1);

// ═══════════════ SECTION 3: MAX SPEED (10s each) ═══════════════
await waitKey("[Enter] for max-speed tests ->");

async function runMax(name: string, buf: Uint8Array): Promise<MaxResult> {
    const AH = Math.min(TH - 4, TH - 2), AW = TW;
    console.log(CLEAR + HIDE);
    console.log(`${"═".repeat(TW)}`);
    console.log(fit(`  ${name} - max speed (10s)`, TW));
    console.log(`${"═".repeat(TW)}`);

    const actx = createContext({ termW: AW, termH: AH, speed: 1e9 });
    const { handle } = animOpen(actx, buf);

    const first = animNext(actx, handle);
    if (!first) { destroyContext(actx); return { name, srcW: 0, srcH: 0, termW: AW, termH: AH, frames: 0, totalMs: 0, fps: 0, avgRender: 0, minRender: 0, maxRender: 0, canvasW: 0, canvasH: 0, rgbaKB: 0, format: -1 }; }
    const sw = first.metrics.imgW, sh = first.metrics.imgH;
    animRewind(actx, handle);

    const renderTimes: number[] = [];
    const tStart = performance.now();
    let frameCount = 0;
    let firstMetrics: any = null;

    while ((performance.now() - tStart) < 10000) {
        const n = animNext(actx, handle);
        if (!n) { animRewind(actx, handle); continue; }
        const tr = performance.now();
        const r = animRenderFrame(actx, handle, n.frameIndex);
        renderTimes.push(performance.now() - tr);
        frameCount++;
        if (!firstMetrics) firstMetrics = r.metrics;

        const lines = r.ansi.split("\n");
        for (let li = 0; li < Math.min(lines.length, AH); li++)
            Bun.write(Bun.stdout, `\x1b[${3 + li};0H${RESET}${lines[li]}${RESET}`);
        Bun.write(Bun.stdout, `\x1b[${3 + AH};0H${RESET}${name} ${frameCount}f | ${Math.round(frameCount / ((performance.now() - tStart) / 1000))}fps | ${((performance.now() - tStart) / 1000).toFixed(1)}s`);

        if (frameCount % 20 === 0) await new Promise(r => setTimeout(r, 0));
    }

    animClose(actx, handle);
    const totalMs = performance.now() - tStart;
    destroyContext(actx);
    return {
        name, srcW: sw, srcH: sh, termW: AW, termH: AH, frames: frameCount, totalMs,
        fps: frameCount / (totalMs / 1000),
        avgRender: renderTimes.reduce((a, b) => a + b, 0) / frameCount,
        minRender: Math.min(...renderTimes), maxRender: Math.max(...renderTimes),
        canvasW: firstMetrics?.canvasW ?? 0, canvasH: firstMetrics?.canvasH ?? 0,
        rgbaKB: (firstMetrics?.rgbaBytes ?? 0) / 1024,
        format: firstMetrics?.format ?? -1,
    };
}

const gifMax = await runMax("GIF", gifBuf);
const webpMax = await runMax("WebP", webpBuf);

// ═══════════════ SECTION 4: SUMMARY ═══════════════
await waitKey("[Enter] for summary ->");
console.log(CLEAR);
rl.close();
console.log(SHOW);
destroyContext(ctx);

console.log(`=== Summary (${TW}x${TH} terminal) ===\n`);

console.log("Static (10x avg):");
for (const s of staticStats) {
    const fps = (1000 / s.totalMs).toFixed(0);
    console.log(`  ${s.name.padEnd(5)} src ${s.srcW}x${s.srcH} -> term ${s.termW}x${s.termH}`);
    console.log(`  ${" ".repeat(5)} parse ${s.parseMs.toFixed(1)}ms draw ${s.drawMs.toFixed(1)}ms build ${s.buildMs.toFixed(1)}ms total ${s.totalMs.toFixed(1)}ms -> ${fps}fps`);
    console.log(`  ${" ".repeat(5)} canvas ${s.canvasW}x${s.canvasH}  pixels ${s.canvasPw}x${s.canvasPh}  rgba ${s.rgbaKB.toFixed(0)}KB  fmt ${FMT_NAMES[s.format]}  cmode ${s.canvasMode} pmode ${s.pixelMode}  alpha ${s.haveAlpha ? "yes" : "no"}`);
}

console.log("\nAnimated (10s, native speed):");
for (const r of [gifAnim, webpAnim]) {
    const fps = r.avgFps.toFixed(0);
    console.log(`  ${r.name.padEnd(5)} term ${TW}x${Math.min(TH - 4, TH - 2)}`);
    console.log(`  ${" ".repeat(5)} first-frame ${r.firstFrameMs.toFixed(0)}ms | ${r.totalFrames}frames @ ${fps}fps`);
    console.log(`  ${" ".repeat(5)} render ${r.avgRenderMs.toFixed(1)}ms avg (${r.minRenderMs.toFixed(1)}-${r.maxRenderMs.toFixed(1)}ms) | ${(r.totalTimeMs / 1000).toFixed(1)}s`);
    console.log(`  ${" ".repeat(5)} canvas ${r.canvasW}x${r.canvasH}  pixels ${r.canvasPw}x${r.canvasPh}  rgba ${r.rgbaKB.toFixed(0)}KB  fmt ${FMT_NAMES[r.format] ?? "?"}`);
}

console.log("\nMax-speed (10s, ignoring timings):");
for (const r of [gifMax, webpMax]) {
    const fps = r.fps.toFixed(0);
    console.log(`  ${r.name.padEnd(5)} src ${r.srcW}x${r.srcH} -> term ${r.termW}x${r.termH}`);
    console.log(`  ${" ".repeat(5)} ${r.frames}frames -> ${fps}fps (${r.totalMs.toFixed(0)}ms total)`);
    console.log(`  ${" ".repeat(5)} render ${r.avgRender.toFixed(1)}ms avg (${r.minRender.toFixed(1)}-${r.maxRender.toFixed(1)}ms)`);
    console.log(`  ${" ".repeat(5)} canvas ${r.canvasW}x${r.canvasH}  rgba ${r.rgbaKB.toFixed(0)}KB  fmt ${FMT_NAMES[r.format] ?? "?"}`);
}
