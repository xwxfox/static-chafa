import { dlopen, FFIType, ptr, read, CString } from "bun:ffi";
import fs from "node:fs";
import { decodeGif } from "./decode-png.ts";

const W = 80, H = 35;
const GIF_PATH = "stress_test.gif";
const SPEED = 10; // 1x=native, 10x=10x faster
const MAX_FRAMES = 100;

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

const gifBuf = new Uint8Array(fs.readFileSync(GIF_PATH));
console.log(`\nDecoding ${GIF_PATH}...`);
const decodeStart = performance.now();
const gif = decodeGif(gifBuf, MAX_FRAMES);
const decodeTime = performance.now() - decodeStart;

console.log(`${gif.width}x${gif.height}, ${gif.frames.length} frames, native delays ~${gif.frames[0]!.delayMs}ms`);
console.log(`decode: ${decodeTime.toFixed(0)}ms | speed: ${SPEED}x → target ${Math.round(1000 / (gif.frames[0]!.delayMs / SPEED))}fps\n`);

const cfg = cs.chafa_canvas_config_new();
cs.chafa_canvas_config_set_geometry(cfg, W, H);
cs.chafa_canvas_config_set_canvas_mode(cfg, 0);
cs.chafa_canvas_config_set_pixel_mode(cfg, 0);
cs.chafa_canvas_config_set_bg_color(cfg, 0);
cs.chafa_canvas_config_set_work_factor(cfg, 0.0);
cs.chafa_canvas_config_set_dither_mode(cfg, 0);
cs.chafa_canvas_config_set_preprocessing_enabled(cfg, 0);
const canvas = cs.chafa_canvas_new(cfg);

const FRAME_COUNT = gif.frames.length;
const CLEAR = "\x1b[2J\x1b[H";

const renderTimes: number[] = [];
let totalRenderTime = 0;
const playbackStart = performance.now();

for (let i = 0; i < FRAME_COUNT; i++) {
    const frame = gif.frames[i]!;
    const frameDelay = frame.delayMs / SPEED;
    const frameStart = performance.now();

    const rStart = performance.now();
    cs.chafa_canvas_draw_all_pixels(canvas, 4, ptr(frame.data), frame.width, frame.height, frame.width * 4);
    const gs = cs.chafa_canvas_build_ansi(canvas)!;
    const strPtr = read.ptr(gs, 0);
    const ansi = new CString(strPtr).toString();
    gsf(gs, 1);
    const renderTime = performance.now() - rStart;

    totalRenderTime += renderTime;
    renderTimes.push(renderTime);

    const avgRender = totalRenderTime / (i + 1);
    const elapsed = (performance.now() - playbackStart) / 1000;
    const realFps = (i + 1) / elapsed;

    Bun.write(Bun.stdout,
        CLEAR + ansi +
        `\nframe ${i + 1}/${FRAME_COUNT} | ` +
        `render ${renderTime.toFixed(1)}ms (avg ${avgRender.toFixed(1)}) | ` +
        `${realFps.toFixed(0)}fps | ${elapsed.toFixed(1)}s`
    );

    const wait = frameDelay - (performance.now() - frameStart);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
}

cs.chafa_canvas_unref(canvas);
cs.chafa_canvas_config_unref(cfg);

const totalTime = (performance.now() - playbackStart) / 1000;
const avgRender = totalRenderTime / FRAME_COUNT;
const fps = FRAME_COUNT / totalTime;
const minR = Math.min(...renderTimes);
const maxR = Math.max(...renderTimes);

console.log(`\n\n=== Summary ===`);
console.log(`frames: ${FRAME_COUNT}  speed: ${SPEED}x`);
console.log(`decoded in: ${decodeTime.toFixed(0)}ms`);
console.log(`playback: ${totalTime.toFixed(2)}s → ${fps.toFixed(0)}fps`);
console.log(`render avg: ${avgRender.toFixed(2)}ms (min ${minR.toFixed(2)}ms, max ${maxR.toFixed(2)}ms)`);
