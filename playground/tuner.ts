#!/usr/bin/env bun
/**
 * @file playground/tuner.ts
 * @brief Long-running automatic config optimizer with a live status page.
 *
 * Spawns one worker thread per (terminal size x pixel mode) job - 5 sizes
 * x 3 modes = 15 concurrent TPE (Tree-structured Parzen Estimator) loops.
 * Each job continuously renders cached media frames with sampled configs,
 * scores them (SSIM*100 - lambda*ms), and reports back. The main process
 * checkpoints state (resumable), shows a full-screen status page refreshed
 * every 2s, and at the end emits:
 *
 *   - best_configs.json  : best config per size/mode (ready to paste)
 *   - formulas.json      : term-size -> optimal-config-value formulas
 *                          (linear fit vs log2(pixel area), with R2)
 *   - tuner_state.json   : full observation history (resume with --resume)
 *
 * Usage:
 *   bun run playground/tuner.ts [--hours 8] [--lambda 2] [--frames 4]
 *       [--media fox.png,teseractor.gif,boykisser.mp4]
 *       [--sizes 40x12,80x24,100x30,120x40,240x72] [--out tuner_out] [--resume]
 *       [--silent]       (no status page - for short test runs)
 */

import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const argv = process.argv.slice(2);
function argVal(name: string, def: string): string {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && argv[i + 1] ? argv[i + 1]! : def;
}
const HOURS = parseFloat(argVal("hours", "8"));
const LAMBDA = parseFloat(argVal("lambda", "2"));
const FRAMES = parseInt(argVal("frames", "4"), 10);
const OUT = argVal("out", "tuner_out");
const MEDIA = argVal("media", "playground/media/fox.png,playground/media/teseractor.gif,playground/media/teseractor.webp,playground/media/boykisser.mp4")
    .split(",").map((m) => m.trim()).filter((m) => fs.existsSync(m));
const SIZES = argVal("sizes", "40x12,80x24,100x30,120x40,240x72")
    .split(",").map((s) => s.trim().split("x").map(Number));
const MODES = ["symbols", "sixel", "kitty"];
const RESUME = argv.includes("--resume");
const SILENT = argv.includes("--silent");

const START = Date.now();
const DEADLINE = START + HOURS * 3600 * 1000;
fs.mkdirSync(OUT, { recursive: true });

const STATE_FILE = path.join(OUT, "tuner_state.json");
let state: Record<string, any> = {};
if (RESUME && fs.existsSync(STATE_FILE)) {
    state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    console.log(`resuming from ${STATE_FILE}`);
}

interface Job {
    id: string;
    mode: string;
    termW: number;
    termH: number;
    proc: ChildProcess;
    evals: number;
    stalled: number;
    best: any | null;
    baseline: any | null;
    startedAt: number;
    lastEvalAt: number;
}

const JOBS_DIR = path.join(OUT, "jobs");
fs.mkdirSync(JOBS_DIR, { recursive: true });
const WORKER_FILE = path.join(import.meta.dir, "tuner_worker.ts");

const jobs: Job[] = [];
for (const [tw, th] of SIZES) {
    for (const mode of MODES) {
        const id = `${mode}@${tw}x${th}`;
        const prior = state[id];
        const jobFile = path.join(JOBS_DIR, `${id}.json`);
        fs.writeFileSync(jobFile, JSON.stringify({
            id, mode, termW: tw, termH: th,
            media: MEDIA, frames: FRAMES, lambda: LAMBDA,
            resume: prior?.obs ?? null,
        }));

        const proc = spawn(process.execPath, [WORKER_FILE, jobFile], {
            stdio: ["ignore", "pipe", "pipe"],
        });
        const j: Job = {
            id, mode, termW: tw!, termH: th!, proc,
            evals: prior?.obs?.length ?? 0,
            stalled: 0,
            best: prior?.best ?? null,
            baseline: prior?.baseline ?? null,
            startedAt: Date.now(),
            lastEvalAt: Date.now(),
        };
        jobs.push(j);
        let buf = "";
        proc.stdout!.on("data", (d: Buffer) => {
            buf += d.toString("utf8");
            let nl: number;
            while ((nl = buf.indexOf("\n")) >= 0) {
                const line = buf.slice(0, nl).trim();
                buf = buf.slice(nl + 1);
                if (!line) continue;
                try { onMsg(j, JSON.parse(line)); } catch {}
            }
        });
        proc.stderr!.on("data", (d: Buffer) => {
            process.stderr.write(`[${id}] ${d.toString("utf8")}`);
        });
        proc.on("exit", (code) => {
            if (!shuttingDown) console.error(`${id}: worker exited (${code})`);
        });
    }
}

function onMsg(job: Job, msg: any): void {
    if (msg.type === "obs") {
        job.evals++;
        job.lastEvalAt = Date.now();
        const o = msg.obs;
        /* defensive: never let a poisoned obs (NaN fields) into the state */
        if (!o || !Number.isFinite(o.ms) || !Number.isFinite(o.ssim) || !Number.isFinite(o.score)) return;
        if (!job.baseline) {
            job.baseline = o;
            job.best = o;
        }
        if (o.score > (job.best?.score ?? -Infinity)) {
            job.best = o;
            job.stalled = 0;
            if (SILENT) {
                console.log(
                    `${job.id} #${job.evals} NEW BEST ${o.score.toFixed(2)} ` +
                    `(ssim ${o.ssim.toFixed(4)}, ${o.ms.toFixed(2)}ms/f) ${summarize(o.config)}`,
                );
            }
        } else {
            job.stalled++;
        }
        saveState();
    } else if (msg.type === "status") {
        job.evals = msg.evals;
        job.stalled = msg.stalled;
        /* status payloads carry a slim best; keep the full obs */
        if (!job.best && msg.best) job.best = msg.best;
        job.lastEvalAt = Date.now();
    } else if (msg.type === "error") {
        console.error(`${job.id}: ${msg.error}`);
    }
}

function summarize(cfg: Record<string, any>): string {
    if (!cfg || Object.keys(cfg).length === 0) return "{defaults}";
    const p: string[] = [];
    if (cfg.workFactor !== undefined) p.push(`wf=${cfg.workFactor}`);
    if (cfg.ditherMode !== undefined && cfg.ditherMode !== 0) p.push(`dither=${cfg.ditherMode}`);
    if (cfg.canvasMode !== undefined && cfg.canvasMode !== 0) p.push(`canvas=${cfg.canvasMode}`);
    if (cfg.symbols) p.push(`sym=${cfg.symbols}`);
    if (cfg.fillSymbols) p.push(`fill=${cfg.fillSymbols}`);
    if (cfg.preprocessing) p.push("pre");
    if (cfg.colorExtractor) p.push("median");
    if (cfg.colorSpace) p.push("din99d");
    if (cfg.videoDecodeScale !== undefined && cfg.videoDecodeScale < 1) p.push(`dec=${cfg.videoDecodeScale}`);
    if (cfg.fgOnly) p.push("fgOnly");
    if (cfg.alphaThreshold !== undefined && cfg.alphaThreshold !== 127) p.push(`alpha=${cfg.alphaThreshold}`);
    if (cfg.bgColor === 0xffffff) p.push("bg=white");
    if (cfg.optimizations === 0) p.push("noopt");
    if (cfg.pixelFit === 0) p.push("fit=NONE");
    if (cfg.swsScale !== undefined && cfg.swsScale !== 0) p.push(`sws=${cfg.swsScale}`);
    if (cfg.videoThreads !== undefined && cfg.videoThreads !== 0) p.push(`vthr=${cfg.videoThreads}`);
    return `{${p.join(" ")}}`;
}

let checkpointTimer = Date.now();
let stateWrites = 0;
function saveState(): void {
    const now = Date.now();
    if (now - checkpointTimer < 10_000 && stateWrites > 0) return;
    checkpointTimer = now;
    stateWrites++;
    for (const j of jobs) {
        const s = state[j.id] ?? (state[j.id] = { obs: [] });
        if (s.obs.length > 3000) s.obs = s.obs.slice(-3000);
        if (j.best) s.best = j.best;
        if (j.baseline) s.baseline = j.baseline;
    }
    try {
        fs.writeFileSync(STATE_FILE + ".tmp", JSON.stringify(state));
        fs.renameSync(STATE_FILE + ".tmp", STATE_FILE);
    } catch {}
}

/* ── status page ───────────────────────────────────────────────────── */

let lastCpuTicks = os.cpus().reduce((a, c) => a + c.times.user + c.times.sys + c.times.idle, 0);
let lastCpuIdle = os.cpus().reduce((a, c) => a + c.times.idle, 0);
let lastCpuAt = Date.now();
let cpuPct = 0;
let prevEvals = 0;
let prevEvalsAt = Date.now();
let opsPerSec = 0;
let lastPageEvals = new Map<string, number>();
let lastPageAt = Date.now();

function renderPage(): void {
    const now = Date.now();
    const totalEvals = jobs.reduce((a, j) => a + j.evals, 0);
    const elapsed = (now - START) / 1000;
    const remaining = Math.max(0, (DEADLINE - now) / 1000);

    /* system cpu % between polls (workers are separate processes) */
    const dtMs = now - lastCpuAt;
    if (dtMs > 0) {
        const ticks = os.cpus().reduce((a, c) => a + c.times.user + c.times.sys + c.times.idle, 0);
        const idle = os.cpus().reduce((a, c) => a + c.times.idle, 0);
        const dTotal = Math.max(1, ticks - lastCpuTicks);
        cpuPct = Math.min(100, Math.max(0, ((dTotal - (idle - lastCpuIdle)) / dTotal) * 100));
        lastCpuTicks = ticks;
        lastCpuIdle = idle;
    }
    lastCpuAt = now;

    /* ops/sec (smoothed over the last interval) */
    const dtSec = (now - prevEvalsAt) / 1000;
    if (dtSec > 0) {
        opsPerSec = (totalEvals - prevEvals) / dtSec;
        prevEvals = totalEvals;
        prevEvalsAt = now;
    }

    const mem = process.memoryUsage();
    const sysMemUsed = os.totalmem() - os.freemem();
    const cpus = os.cpus().length;
    const h = Math.floor(elapsed / 3600), m = Math.floor((elapsed % 3600) / 60), s = Math.floor(elapsed % 60);
    const rh = Math.floor(remaining / 3600), rm = Math.floor((remaining % 3600) / 60);

    const lines: string[] = [];
    lines.push(`\x1b[2J\x1b[H\x1b[1mchafa tuner\x1b[0m  ${jobs.length} workers (${SIZES.length} sizes x ${MODES.length} modes)  ${MEDIA.length} media  lambda=${LAMBDA}`);
    lines.push(
        `elapsed ${h}h${String(m).padStart(2, "0")}m${String(s).padStart(2, "0")}s  |  ` +
        `remaining ${rh}h${String(rm).padStart(2, "0")}m  |  ` +
        `evals ${totalEvals.toLocaleString()}  (${opsPerSec.toFixed(1)}/s total)  |  ` +
        `sys cpu ${cpuPct.toFixed(1)}% (${cpus} cores)  |  ` +
        `sys mem ${(sysMemUsed / 1024 / 1024 / 1024).toFixed(1)}GB/${(os.totalmem() / 1024 / 1024 / 1024).toFixed(0)}GB  |  ` +
        `main rss ${(mem.rss / 1024 / 1024).toFixed(0)}MB  |  checkpoint ${stateWrites}`,
    );
    lines.push("─".repeat(120));

    const now2 = Date.now();
    const perJob = new Map<string, number>();
    const jobDelta = now2 - lastPageAt;
    const fnum = (v: any, d = 2): string => (Number.isFinite(v) ? v.toFixed(d) : "?");
    for (const j of jobs) {
        const evalsBefore = lastPageEvals.get(j.id) ?? j.evals;
        const ops = jobDelta > 0 ? ((j.evals - evalsBefore) / (jobDelta / 1000)) : 0;
        perJob.set(j.id, j.evals);
        const base = j.baseline?.score ?? 0;
        const best = j.best?.score ?? 0;
        const imp = base !== 0 ? ((best - base) / Math.abs(base)) * 100 : 0;
        const bestLine = j.best
            ? `ssim ${fnum(j.best.ssim, 4)}  ${fnum(j.best.ms)}ms/f  ${fnum((j.best.bytes ?? 0) / 1024, 0)}KB/f  ${summarize(j.best.config)}`
            : "waiting for first eval...";
        lines.push(
            `${j.id.padEnd(17)} ` +
            `evals ${String(j.evals).padStart(6)}  ` +
            `${ops.toFixed(1).padStart(5)}/s  ` +
            `best ${best.toFixed(2).padStart(7)}  base ${base.toFixed(2).padStart(7)}  ` +
            `${(imp >= 0 ? "+" : "")}${imp.toFixed(1).padStart(6)}%` +
            (j.stalled > 400 ? "  [stalled]" : "") +
            `\n      ${bestLine}`,
        );
    }
    lastPageEvals = perJob;
    lastPageAt = now2;

    lines.push("─".repeat(120));
    /* per-mode and per-size averages */
    for (const mode of MODES) {
        const js = jobs.filter((j) => j.mode === mode);
        const avgBest = js.reduce((a, j) => a + (j.best?.score ?? 0), 0) / Math.max(1, js.length);
        const avgEvals = js.reduce((a, j) => a + j.evals, 0);
        lines.push(
            `  ${mode.padEnd(8)} jobs ${js.length}  avg best ${avgBest.toFixed(2)}  evals ${avgEvals.toLocaleString()}`,
        );
    }
    for (const [tw, th] of SIZES) {
        const js = jobs.filter((j) => j.termW === tw && j.termH === th);
        const avgBest = js.reduce((a, j) => a + (j.best?.score ?? 0), 0) / Math.max(1, js.length);
        lines.push(`  ${String(tw).padStart(3)}x${String(th).padStart(3)}   avg best ${avgBest.toFixed(2)}`);
    }
    lines.push("─".repeat(120));
    lines.push("Ctrl-C or deadline: saves state, prints best configs + term-size formulas");

    process.stdout.write(lines.join("\n") + "\x1b[0m\n");
}

if (!SILENT) {
    const pageTimer = setInterval(renderPage, 2000);
    renderPage();
} else {
    console.log(`silent mode: ${jobs.length} workers, ${HOURS}h budget, checkpoint to ${STATE_FILE}`);
}

/* ── curve fitting: term size -> config value ──────────────────────── */

function fitFormula(mode: string, param: string): any {
    const points: { x: number; y: number }[] = [];
    for (const [tw, th] of SIZES) {
        const id = `${mode}@${tw}x${th}`;
        const best = state[id]?.best;
        if (!best || best.config[param] === undefined) continue;
        const area = tw! * 8 * th! * 8;
        points.push({ x: Math.log2(area), y: Number(best.config[param]) });
    }
    if (points.length < 3) return null;
    const n = points.length;
    const mx = points.reduce((a, p) => a + p.x, 0) / n;
    const my = points.reduce((a, p) => a + p.y, 0) / n;
    let sxx = 0, syy = 0, sxy = 0;
    for (const p of points) {
        sxx += (p.x - mx) ** 2;
        syy += (p.y - my) ** 2;
        sxy += (p.x - mx) * (p.y - my);
    }
    if (sxx === 0) return null;
    const slope = sxy / sxx;
    const intercept = my - slope * mx;
    const r2 = syy === 0 ? 0 : (sxy ** 2) / (sxx * syy);
    return {
        slope, intercept, r2, n,
        points: points.map((p) => ({ termArea: Math.round(2 ** p.x), value: p.y })),
    };
}

/* ── shutdown + final report ───────────────────────────────────────── */

let shuttingDown = false;
async function shutdown(): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    if (!SILENT) process.stdout.write("\x1b[2J\x1b[H");
    console.log("stopping workers...");
    for (const j of jobs) j.proc.kill();
    await new Promise((r) => setTimeout(r, 1500));
    saveState();

    console.log("\n=== best configs ===");
    const bests: Record<string, any> = {};
    const fnum = (v: any, d = 2): string => (Number.isFinite(v) ? v.toFixed(d) : "?");
    for (const j of jobs) {
        if (!j.best) continue;
        bests[j.id] = {
            mode: j.mode, termW: j.termW, termH: j.termH,
            config: j.best.config,
            ssim: j.best.ssim, psnr: j.best.psnr, ms: j.best.ms,
            bytes: j.best.bytes, score: j.best.score,
            baselineScore: j.baseline?.score ?? null,
        };
        console.log(
            `${j.id.padEnd(18)} ssim ${fnum(j.best.ssim, 4)} ${fnum(j.best.ms)}ms/f ` +
            `${fnum((j.best.bytes ?? 0) / 1024, 0)}KB/f ${summarize(j.best.config)}`,
        );
    }
    fs.writeFileSync(path.join(OUT, "best_configs.json"), JSON.stringify(bests, null, 2));

    console.log("\n=== term-size -> config formulas (value = slope*log2(pixelArea) + intercept) ===");
    const formulas: Record<string, any> = {};
    for (const mode of MODES) {
        for (const param of ["workFactor", "ditherIntensity", "ditherMode", "canvasMode", "preprocessing", "colorExtractor", "colorSpace", "videoDecodeScale", "alphaThreshold", "bgColor", "optimizations", "pixelFit", "swsScale", "videoThreads"]) {
            const f = fitFormula(mode, param);
            if (f) {
                formulas[`${mode}.${param}`] = f;
                console.log(
                    `  ${(mode + "." + param).padEnd(30)} = ${f.slope.toFixed(4)}*log2(px) + ${f.intercept.toFixed(4)} ` +
                    `(R2 ${f.r2.toFixed(2)}, n=${f.n})`,
                );
            }
        }
    }
    fs.writeFileSync(path.join(OUT, "formulas.json"), JSON.stringify(formulas, null, 2));

    console.log(`\nwrote ${OUT}/best_configs.json + formulas.json + tuner_state.json`);
    process.exit(0);
}

process.on("SIGINT", () => { void shutdown(); });
process.on("SIGTERM", () => { void shutdown(); });

const deadlineTimer = setInterval(() => {
    if (Date.now() >= DEADLINE) void shutdown();
}, 5000);
