import { dlopen, FFIType, ptr } from "bun:ffi";
import fs from "node:fs"
import { decodePng, decodeJpeg, decodeGif } from "./decode-png.ts"

const W = 80, H = 35;
const runs = 10;

const pngBuf = new Uint8Array(fs.readFileSync("fox.png"));
const jpgBuf = new Uint8Array(fs.readFileSync("fox.jpg"));
const gifBuf = new Uint8Array(fs.readFileSync("fox.gif"));

const cs = dlopen("libchafa.so.0", {
    chafa_canvas_config_new: { args: [], returns: FFIType.ptr },
    chafa_canvas_config_set_geometry: { args: [FFIType.ptr, FFIType.i32, FFIType.i32], returns: FFIType.void },
    chafa_canvas_config_set_canvas_mode: { args: [FFIType.ptr, FFIType.i32], returns: FFIType.void },
    chafa_canvas_config_set_pixel_mode: { args: [FFIType.ptr, FFIType.i32], returns: FFIType.void },
    chafa_canvas_config_set_bg_color: { args: [FFIType.ptr, FFIType.u32], returns: FFIType.void },
    chafa_canvas_config_set_work_factor: { args: [FFIType.ptr, FFIType.f32], returns: FFIType.void },
    chafa_canvas_config_set_dither_mode: { args: [FFIType.ptr, FFIType.i32], returns: FFIType.void },
    chafa_canvas_config_set_preprocessing_enabled: { args: [FFIType.ptr, FFIType.i32], returns: FFIType.void },
    chafa_canvas_new: { args: [FFIType.ptr], returns: FFIType.ptr },
    chafa_canvas_draw_all_pixels: { args: [FFIType.ptr, FFIType.i32, FFIType.ptr, FFIType.i32, FFIType.i32, FFIType.i32], returns: FFIType.void },
    chafa_canvas_build_ansi: { args: [FFIType.ptr], returns: FFIType.ptr },
    chafa_canvas_unref: { args: [FFIType.ptr], returns: FFIType.void },
    chafa_canvas_config_unref: { args: [FFIType.ptr], returns: FFIType.void },
}).symbols;

const gsf = dlopen("libglib-2.0.so.0", {
    g_string_free: { args: [FFIType.ptr, FFIType.i32], returns: FFIType.ptr },
}).symbols.g_string_free;

function makeCfg() {
    const c = cs.chafa_canvas_config_new();
    cs.chafa_canvas_config_set_geometry(c, W, H);
    cs.chafa_canvas_config_set_canvas_mode(c, 0);
    cs.chafa_canvas_config_set_pixel_mode(c, 0);
    cs.chafa_canvas_config_set_bg_color(c, 0);
    cs.chafa_canvas_config_set_work_factor(c, 0.0);
    cs.chafa_canvas_config_set_dither_mode(c, 0);
    cs.chafa_canvas_config_set_preprocessing_enabled(c, 0);
    return c;
}

function renderChafa(rgba: Uint8Array, w: number, h: number, canvas: any, cfg: any): [number, number] {
    let t = performance.now();
    cs.chafa_canvas_draw_all_pixels(canvas, 4, ptr(rgba), w, h, w * 4);
    const draw = performance.now() - t;
    t = performance.now();
    const gs = cs.chafa_canvas_build_ansi(canvas);
    const ansi = performance.now() - t;
    gsf(gs, 1);
    return [draw, ansi];
}

// ── Prerender previews ──
const { renderImageToTerminal } = await import("./chafa.ts");

const pngImg = decodePng(pngBuf);
console.log(renderImageToTerminal(new Uint8Array(pngImg.data), pngImg.width, pngImg.height, W, H));
console.log("=== PNG ↑\n");

const jpgImg = decodeJpeg(jpgBuf);
console.log(renderImageToTerminal(new Uint8Array(jpgImg.data), jpgImg.width, jpgImg.height, W, H));
console.log("=== JPEG ↑\n");

const gifData = decodeGif(gifBuf);
const gifFrame = gifData.frames[0]!;
console.log(renderImageToTerminal(gifFrame.data, gifFrame.width, gifFrame.height, W, H));
console.log("=== GIF ↑\n");

// ── Benchmark ──
console.log(`=== Bench (${runs}x avg)   →  terminal ${W}x${H}  ===\n`);

function benchFormat(label: string, fn: () => any) {
    let parseSum = 0, idatSum = 0, inflateSum = 0, defilterSum = 0, drawSum = 0, ansiSum = 0;
    const cfg = makeCfg();
    const canvas = cs.chafa_canvas_new(cfg);
    for (let i = 0; i < runs; i++) {
        const img = fn();
        parseSum += img.stats.parseMs;
        idatSum += img.stats.idatMs;
        inflateSum += img.stats.inflateMs;
        defilterSum += img.stats.defilterMs;
        const [d, a] = renderChafa(img.data, img.width, img.height, canvas, cfg);
        drawSum += d;
        ansiSum += a;
    }
    cs.chafa_canvas_unref(canvas);
    cs.chafa_canvas_config_unref(cfg);

    const decodeTotal = (parseSum + idatSum + inflateSum + defilterSum) / runs;
    const renderTotal = (drawSum + ansiSum) / runs;
    const total = decodeTotal + renderTotal;
    console.log(`${label}: decode ${decodeTotal.toFixed(2)}ms + render ${renderTotal.toFixed(2)}ms = ${total.toFixed(2)}ms → ${(1000/total).toFixed(0)}fps`);
}

benchFormat("PNG ", () => decodePng(pngBuf));
benchFormat("JPEG", () => decodeJpeg(jpgBuf));
benchFormat("GIF ", () => {
    const g = decodeGif(gifBuf);
    const f = g.frames[0]!;
    return { stats: g.stats, data: f.data, width: f.width, height: f.height };
});

// GIF frame timing (already decoded above)
if (gifData.frames.length > 1) {
    console.log(`\nGIF has ${gifData.frames.length} frames`);
    for (let i = 0; i < gifData.frames.length; i++) {
        console.log(`  frame ${i}: ${gifData.frames[i]!.delayMs}ms delay`);
    }
}
