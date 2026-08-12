import fs from "node:fs";
import { createContext, destroyContext, render, type CodecMetrics } from "../src/ffi.ts";

const imagePath = "playground/media/fox.png";
const buf = new Uint8Array(fs.readFileSync(imagePath));
const MODE: "validate" | "build" = "validate";

const size_pairs = [
    { h: 1080, w: 1920 },
    { h: 512, w: 512 },
    { h: 256, w: 256 },
    { h: 100, w: 100 },
    { h: 80, w: 35 },
    { h: 40, w: 25 },
    { h: 20, w: 20 },
];

if (MODE === "build") {
    for (const size of size_pairs) {
        const ctx = createContext({ termW: size.w, termH: size.h });
        const { ansi, metrics } = render(ctx, buf);
        const fp = `./playground/valid_buffers/${size.h}x${size.w}`;
        await Bun.file(fp + ".buff").write(ansi);
        await Bun.file(fp + ".met").write(JSON.stringify(metrics, null, 2));
        destroyContext(ctx);
    }
    console.log("New files output to valid_buffers");
    process.exit(0);
}

interface RenderResult {
    ansi: string;
    metrics: CodecMetrics;
}

interface PerfChange {
    old: number;
    new: number;
    change: number;
    percent: number;
    direction: "improvement" | "regression" | "unchanged";
}

interface CompareResult {
    passed: boolean;
    ansiSame: boolean;
    perf: Record<string, PerfChange>;
}

const PERF_FIELDS: (keyof CodecMetrics)[] = [
    "parseMs",
    "drawMs",
    "buildMs",
    "totalMs",
];

async function readValid(fp: string): Promise<RenderResult> {
    const ansi = await Bun.file(fp + ".buff").text();
    const metrics = await Bun.file(fp + ".met").json() as CodecMetrics;
    return { ansi, metrics };
}

function compareResults(oldResult: RenderResult, newResult: RenderResult): CompareResult {
    const ansiSame = oldResult.ansi === newResult.ansi;
    const perf: Record<string, PerfChange> = {};

    for (const field of PERF_FIELDS) {
        const oldValue = oldResult.metrics[field];
        const newValue = newResult.metrics[field];
        const change = newValue - oldValue;
        const percent = oldValue === 0 ? 0 : (change / oldValue) * 100;

        let direction: PerfChange["direction"];
        if (Math.abs(change) < 0.0001) direction = "unchanged";
        else if (change < 0) direction = "improvement";
        else direction = "regression";

        perf[field] = { old: oldValue, new: newValue, change, percent, direction };
    }
    return { passed: ansiSame, ansiSame, perf };
}

function formatMs(value: number): string { return `${value.toFixed(3)}ms`; }

function formatChange(change: PerfChange): string {
    if (change.direction === "unchanged") return "unchanged";
    const sign = change.change > 0 ? "+" : "";
    const percentSign = change.percent > 0 ? "+" : "";
    return `${sign}${formatMs(change.change)} (${percentSign}${change.percent.toFixed(1)}%) ${change.direction}`;
}

function printResult(size: { h: number; w: number }, result: CompareResult) {
    const name = `${size.h}x${size.w}`;
    if (!result.passed) {
        console.log(`\n❌ ${name} FAILED - ANSI buffers differ`);
        return;
    }
    console.log(`\n✅ ${name} PASSED`);
    for (const field of PERF_FIELDS) {
        const change = result.perf[field];
        console.log(
            `   ${field!.padEnd(12)} ` +
            `${formatMs(change!.old).padStart(10)} -> ` +
            `${formatMs(change!.new).padStart(10)} | ` +
            formatChange(change!),
        );
    }
}

async function runTest(buf: Uint8Array, size: { h: number; w: number }): Promise<RenderResult> {
    const ctx = createContext({ termW: size.w, termH: size.h });
    const { ansi, metrics } = render(ctx, buf);
    destroyContext(ctx);
    return { ansi, metrics };
}

async function main() {
    const results: CompareResult[] = [];

    for (const size of size_pairs) {
        const fp = `./playground/valid_buffers/${size.h}x${size.w}`;
        const oldResult = await readValid(fp);
        const newResult = await runTest(buf, size);
        const result = compareResults(oldResult, newResult);
        results.push(result);
        printResult(size, result);
    }

    const passed = results.filter(r => r.passed).length;
    const failed = results.length - passed;

    console.log("\n" + "-".repeat(70));
    console.log(`Results: ${passed}/${results.length} passed` + (failed > 0 ? `, ${failed} failed` : ""));
    if (failed > 0) process.exitCode = 1;
}

await main();
