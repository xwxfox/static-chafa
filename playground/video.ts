#!/usr/bin/env bun
/** @file playground/video.ts - Terminal video player via the public Chafa API.
 *  Same behavior as video-ffi.ts (which drives the low-level FFI path).
 *  Space=play/pause, arrows=seek, Q=quit.
 *
 *  Unlike the FFI version, the Chafa constructor auto-probes the terminal's
 *  real cell size so pixel modes fill the screen area exactly. */

import Chafa from "../src/index.ts";
import fs from "node:fs";
import { execSync } from "child_process";

const PATH = "playground/media/boykisser.mp4";
const B = "\x1b[1m", D = "\x1b[2m", R = "\x1b[0m";

let TW = 80, TH = 24;
try { TW = +execSync("tput cols", { stdio: ["pipe", "pipe", "pipe"] }).toString().trim() || 80; } catch { }
try { TH = +execSync("tput lines", { stdio: ["pipe", "pipe", "pipe"] }).toString().trim() || 24; } catch { }
if (process.stdout.columns) TW = process.stdout.columns;
if (process.stdout.rows) TH = process.stdout.rows;
const VH = TH - 2;
function fmt(s: number) { const m = Math.floor(s / 60); return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`; }

let quit = false, playing = false, seekDelta = 0, toggle = false;

// -- Keyboard: event listener for raw TTY input --
try {
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    stdin.on("data", (k: string) => {
        // Check first byte for single-char commands
        const b = k.charCodeAt(0);
        if (b === 0x03) { quit = true; return; }         // Ctrl+C
        if (b === 0x1b) {                                 // ESC or arrow prefix
            if (k.length === 1) { quit = true; return; }   // bare ESC = quit
            if (k[1] === "[") {
                if (k[2] === "D") seekDelta = -5;         // Left
                else if (k[2] === "C") seekDelta = 5;     // Right
                else if (k[2] === "A") seekDelta = -30;   // Up
                else if (k[2] === "B") seekDelta = 30;    // Down
            }
            return;
        }
        if (b === 0x20 || b === 0x70) { toggle = true; return; } // Space or p
        if (b === 0x71 || b === 0x51) { quit = true; return; }   // q or Q
    });
} catch { /* non-TTY */ }

process.on("SIGINT", () => { quit = true; });
process.on("SIGTERM", () => { quit = true; });

process.stdout.write("\x1b[2J\x1b[H\x1b[?25l");

const buf = new Uint8Array(fs.readFileSync(PATH));

// One Chafa instance owns both the video decoder and the render canvas.
// Frames decode directly at the pixel-fit size and nextFrame() returns a
// zero-copy view into the decoder ring buffer, so only one frame buffer
// exists - no copies, no second canvas. Pixel mode is auto-detected from
// the terminal (kitty/sixel where supported, symbols otherwise).
const chafa = new Chafa({ termW: TW, termH: VH });
await chafa.probeReady; /* correct cell size before the first frame - no mid-stream resize */
const video = chafa.openVideo(buf);

const t0 = performance.now() / 1000;
let fc = 0, pts = 0.0, idx = 0, rsum = 0, playWall = 0.0, playPts = 0.0;
let fpsEma = 0;             /* smoothed current playback rate */
let lastRenderMs = 0;

let f = video.nextFrame();
if (!f) { process.stdout.write("\x1b[?25h\x1b[2JNo frames\n"); process.exit(1); }
pts = f.ptsSec; idx = f.frameIndex;
let ren = f.rgba;
let lastRendered = -1;
let lastWrite = 0;

function shutdown() {
    quit = true;
    video.close(); chafa.destroy();
    const e = performance.now() / 1000 - t0;
    process.stdout.write(`\x1b[2J\x1b[H\x1b[?25h${fc} frames in ${e.toFixed(1)}s | ${(fc / e).toFixed(0)}fps avg\n`);
    process.exit(0);
}

while (!quit) {
    if (toggle) { playing = !playing; toggle = false; lastRendered = -1; if (playing) { playWall = performance.now() / 1000; playPts = pts; } }
    if (seekDelta !== 0) {
        video.seek(Math.max(0, pts + seekDelta));
        const n = video.nextFrame();
        if (n) { pts = n.ptsSec; idx = n.frameIndex; f = n; ren = n.rgba; lastRendered = -1; if (playing) { playWall = performance.now() / 1000; playPts = pts; } }
        seekDelta = 0;
    }

    /* Only render+write when the frame actually changed, or at ~10Hz to
       keep the status line fresh. Redundant 60Hz writes of the same frame
       starve the terminal's write bandwidth for no visual gain. */
    const nowMs = performance.now();
    if (idx !== lastRendered || nowMs - lastWrite > 100) {
        const r0 = performance.now();
        const { ansi } = chafa.renderRgba(ren, f.width, f.height);
        rsum += performance.now() - r0; fc++;

        /* Current rate: EMA of the interval between rendered frames
           (updated only while playing, so pausing doesn't drag it down). */
        if (playing && lastRenderMs > 0) {
            const inst = 1000 / Math.max(1, nowMs - lastRenderMs);
            fpsEma = fpsEma === 0 ? inst : fpsEma * 0.9 + inst * 0.1;
        }
        lastRenderMs = nowMs;

        let out = `\x1b[1;1H\x1b[2K ${B}boykisser.mp4${R} ${f.width}x${f.height} ${playing ? `${B}▶${R}` : `${D}⏸${R}`} ${fmt(pts)} ${fpsEma.toFixed(0)}fps`;
        const ls = ansi.split("\n");
        for (let li = 0; li < Math.min(ls.length, VH); li++) out += `\x1b[${2 + li};1H${ls[li]}`;
        out += `\x1b[${TH};1H\x1b[2K frame ${idx} ${(rsum / fc).toFixed(1)}ms ${D}␣ ←-> ↑↓ Q${R}`;
        process.stdout.write(out);
        lastRendered = idx;
        lastWrite = nowMs;
    }

    if (playing) {
        const w = performance.now() / 1000 - playWall;
        if (pts < playPts + w - 0.02) {
            const n = video.nextFrame();
            if (n) { pts = n.ptsSec; idx = n.frameIndex; f = n; ren = n.rgba; }
            else { playing = false; }
        } else {
            await new Promise(r => setTimeout(r, 16));
        }
    } else {
        await new Promise(r => setTimeout(r, 50));
    }
}
shutdown();
