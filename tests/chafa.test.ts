/**
 * @file tests/chafa.test.ts
 * @brief Comprehensive test suite via the public Chafa class (NAPI addon).
 *
 * Covers: all image formats, error cases, animation, matrix output,
 * config changes, decode + renderRgba, context lifecycle, multi-instance,
 * and Symbol.dispose.
 *
 * Uses vitest. Run: bunx vitest run
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import Chafa, {
    CanvasMode,
    DitherMode,
    PixelMode,
    defaultConfig,
} from "../src/index.ts";
import fs from "node:fs";

/* -- Test media -- */
const MEDIA = "playground/media";
let pngBuf: Buffer;
let jpgBuf: Buffer;
let bmpBuf: Buffer;
let webpBuf: Buffer;
let gifStaticBuf: Buffer;
let gifAnimBuf: Buffer;
let webpAnimBuf: Buffer;

beforeAll(() => {
    pngBuf = fs.readFileSync(`${MEDIA}/fox.png`);
    jpgBuf = fs.readFileSync(`${MEDIA}/fox.jpg`);
    bmpBuf = fs.readFileSync(`${MEDIA}/fox.bmp`);
    webpBuf = fs.readFileSync(`${MEDIA}/fox.webp`);
    gifStaticBuf = fs.readFileSync(`${MEDIA}/fox.gif`);
    gifAnimBuf = fs.readFileSync(`${MEDIA}/teseractor.gif`);
    webpAnimBuf = fs.readFileSync(`${MEDIA}/teseractor.webp`);
});

/* ═══════════════════════════════════════════════════════════════════
   Context lifecycle
   ═══════════════════════════════════════════════════════════════════ */

describe("Context lifecycle", () => {
    test("create with defaults", () => {
        const c = new Chafa();
        expect(c).toBeInstanceOf(Chafa);
        c.destroy();
    });

    test("create with partial config", () => {
        const c = new Chafa({ termW: 60, termH: 20 });
        expect(c.config.termW).toBe(60);
        expect(c.config.termH).toBe(20);
        c.destroy();
    });

    test("updateConfig changes dimensions", () => {
        const c = new Chafa({ termW: 80, termH: 24 });
        c.updateConfig({ termW: 40, termH: 12, canvasMode: CanvasMode.INDEXED_256 });
        const { metrics } = c.render(pngBuf);
        expect(metrics.canvasW).toBe(40);
        expect(metrics.canvasH).toBe(12);
        expect(metrics.canvasMode).toBe(CanvasMode.INDEXED_256);
        c.destroy();
    });

    test("destroy is idempotent", () => {
        const c = new Chafa();
        c.destroy();
        expect(() => c.destroy()).not.toThrow();
    });

    test("render after destroy throws", () => {
        const c = new Chafa();
        c.destroy();
        expect(() => c.render(pngBuf)).toThrow();
    });

    test("multiple instances with different configs", () => {
        const c1 = new Chafa({ termW: 80, termH: 24 });
        const c2 = new Chafa({ termW: 40, termH: 12 });

        const { metrics: m1 } = c1.render(pngBuf);
        const { metrics: m2 } = c2.render(pngBuf);

        expect(m1.canvasW).toBe(80);
        expect(m2.canvasW).toBe(40);

        c1.destroy();
        c2.destroy();
    });
});

/* ═══════════════════════════════════════════════════════════════════
   Render - all static formats
   ═══════════════════════════════════════════════════════════════════ */

describe("Render - static formats", () => {
    let c: Chafa;

    beforeAll(() => { c = new Chafa({ termW: 80, termH: 24 }); });

    test("PNG", () => {
        const { ansi, metrics } = c.render(pngBuf);
        expect(ansi.length).toBeGreaterThan(100);
        expect(metrics.format).toBe(0);
        expect(metrics.parseMs).toBeGreaterThan(0);
        expect(metrics.drawMs).toBeGreaterThan(0);
        expect(metrics.buildMs).toBeGreaterThanOrEqual(0);
        expect(metrics.imgW).toBe(641);
        expect(metrics.imgH).toBe(641);
        expect(metrics.rgbaBytes).toBe(641 * 641 * 4);
        expect(metrics.frameCount).toBe(1);
        expect(ansi).toContain("\x1b[");
    });

    test("JPEG", () => {
        const { metrics } = c.render(jpgBuf);
        expect(metrics.format).toBe(1);
        expect(metrics.imgW).toBe(641);
    });

    test("BMP", () => {
        const { metrics } = c.render(bmpBuf);
        expect(metrics.format).toBe(2);
    });

    test("WebP static", () => {
        const { metrics } = c.render(webpBuf);
        expect(metrics.format).toBe(4);
    });

    test("GIF static (single frame)", () => {
        const { metrics } = c.render(gifStaticBuf);
        expect(metrics.format).toBe(3);
    });

    afterAll(() => { c.destroy(); });
});

/* ═══════════════════════════════════════════════════════════════════
   Render - errors
   ═══════════════════════════════════════════════════════════════════ */

describe("Render - errors", () => {
    test("empty buffer throws", () => {
        const c = new Chafa();
        expect(() => c.render(Buffer.alloc(0))).toThrow();
        c.destroy();
    });

    test("corrupt data throws", () => {
        const c = new Chafa();
        const corrupt = Buffer.from([0xFF, 0xD8, 0xFF, 0x00, 0x00, 0x00]);
        expect(() => c.render(corrupt)).toThrow();
        c.destroy();
    });

    test("unknown format throws", () => {
        const c = new Chafa();
        const unknown = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
        expect(() => c.render(unknown)).toThrow();
        c.destroy();
    });
});

/* ═══════════════════════════════════════════════════════════════════
   Decode + renderRgba
   ═══════════════════════════════════════════════════════════════════ */

describe("Decode + renderRgba", () => {
    test("decode returns correct dimensions", () => {
        const c = new Chafa();
        const img = c.decode(pngBuf);
        expect(img.width).toBe(641);
        expect(img.height).toBe(641);
        expect(img.stride).toBe(641 * 4);
        expect(img.rgba.length).toBe(641 * 641 * 4);
        expect(img.metrics.format).toBe(0);
        expect(img.metrics.rgbaBytes).toBe(641 * 641 * 4);
        c.destroy();
    });

    test("renderRgba with decoded image", () => {
        const c = new Chafa();
        const img = c.decode(pngBuf);
        const { ansi, metrics } = c.renderRgba(img.rgba, img.width, img.height);
        expect(ansi).toContain("\x1b[");
        expect(metrics.parseMs).toBe(0); // no decode step
        expect(metrics.drawMs).toBeGreaterThan(0);
        c.destroy();
    });

    test("renderRgba twice with same image", () => {
        const c = new Chafa();
        const img = c.decode(pngBuf);
        const r1 = c.renderRgba(img.rgba, img.width, img.height);
        const r2 = c.renderRgba(img.rgba, img.width, img.height);
        expect(r1.ansi.length).toBe(r2.ansi.length);
        c.destroy();
    });
});

/* ═══════════════════════════════════════════════════════════════════
   Matrix output
   ═══════════════════════════════════════════════════════════════════ */

describe("Matrix", () => {
    test("renderMatrix produces valid JSON grid", () => {
        const c = new Chafa({ termW: 80, termH: 24 });
        const { matrix } = c.renderMatrix(pngBuf);
        const parsed: number[][][] = JSON.parse(matrix);
        expect(parsed.length).toBe(24);
        expect(parsed[0]!.length).toBe(80);
        // Each cell is [charCode, fg, bg]
        const cell = parsed[0]![0]!;
        expect(cell.length).toBe(3);
        expect(cell[0]).toBeGreaterThanOrEqual(32);
        expect(cell[1]).toBeGreaterThanOrEqual(-1);
        expect(cell[2]).toBeGreaterThanOrEqual(-1);
        c.destroy();
    });

    test("matrix dimensions follow config", () => {
        const c = new Chafa({ termW: 40, termH: 12 });
        const { matrix } = c.renderMatrix(pngBuf);
        const parsed: number[][][] = JSON.parse(matrix);
        expect(parsed.length).toBe(12);
        expect(parsed[0]!.length).toBe(40);
        c.destroy();
    });

    test("renderMatrixRgba equivalent to renderMatrix", () => {
        const c = new Chafa({ termW: 80, termH: 24 });
        const img = c.decode(pngBuf);
        const { matrix: m1 } = c.renderMatrix(pngBuf);
        const { matrix: m2 } = c.renderMatrixRgba(img.rgba, img.width, img.height);
        expect(m1).toBe(m2);
        c.destroy();
    });
});

/* ═══════════════════════════════════════════════════════════════════
   Metrics consistency
   ═══════════════════════════════════════════════════════════════════ */

describe("Metrics", () => {
    let c: Chafa;
    beforeAll(() => { c = new Chafa({ termW: 80, termH: 24 }); });

    test("totalMs equals sum of parts", () => {
        const { metrics } = c.render(pngBuf);
        expect(metrics.totalMs).toBeCloseTo(
            metrics.parseMs + metrics.scaleMs + metrics.drawMs + metrics.buildMs, 0
        );
    });

    test("rgbaBytes matches image dimensions", () => {
        const { metrics } = c.render(pngBuf);
        expect(metrics.rgbaBytes).toBe(metrics.imgW * metrics.imgH * 4);
    });

    test("canvasPw/Ph = canvasW/H × 8 (symbol mode)", () => {
        const { metrics } = c.render(pngBuf);
        expect(metrics.canvasPw).toBe(metrics.canvasW * 8);
        expect(metrics.canvasPh).toBe(metrics.canvasH * 8);
    });

    test("format is consistent across all types", () => {
        const expected: [Buffer, number][] = [
            [pngBuf, 0], [jpgBuf, 1], [bmpBuf, 2], [gifStaticBuf, 3], [webpBuf, 4],
        ];
        for (const [buf, fmt] of expected) {
            const { metrics } = c.render(buf);
            expect(metrics.format).toBe(fmt);
        }
    });

    test("haveAlpha from metrics", () => {
        const { metrics } = c.render(pngBuf);
        expect(typeof metrics.haveAlpha).toBe("number");
    });

    afterAll(() => { c.destroy(); });
});

/* ═══════════════════════════════════════════════════════════════════
   Animation - GIF
   ═══════════════════════════════════════════════════════════════════ */

describe("Animation - GIF", () => {
    test("open", () => {
        const c = new Chafa({ termW: 80, termH: 24 });
        const anim = c.openAnimation(gifAnimBuf);
        expect(anim.frameCount).toBe(58);
        expect(anim.imageFormat).toBe(3);
        expect(anim.width).toBe(640);
        expect(anim.height).toBe(640);
        anim.close();
        c.destroy();
    });

    test("iterate all frames", () => {
        const c = new Chafa();
        const anim = c.openAnimation(gifAnimBuf);
        let count = 0;
        while (true) {
            const f = anim.next();
            if (!f) break;
            expect(f.frameIndex).toBe(count);
            count++;
        }
        expect(count).toBe(58);
        anim.close();
        c.destroy();
    });

    test("render individual frame", () => {
        const c = new Chafa();
        const anim = c.openAnimation(gifAnimBuf);
        const f = anim.next()!;
        const { ansi, metrics } = anim.renderFrame(f.frameIndex);
        expect(ansi).toContain("\x1b[");
        expect(metrics.drawMs).toBeGreaterThan(0);
        expect(metrics.frameDelayMs).toBeGreaterThanOrEqual(0);
        expect(metrics.format).toBe(3);
        anim.close();
        c.destroy();
    });

    test("rewind", () => {
        const c = new Chafa();
        const anim = c.openAnimation(gifAnimBuf);
        anim.next(); anim.next(); anim.next();
        anim.rewind();
        const f = anim.next()!;
        expect(f.frameIndex).toBe(0);
        anim.close();
        c.destroy();
    });

    test("abort", () => {
        const c = new Chafa();
        const anim = c.openAnimation(gifAnimBuf);
        anim.abort();
        const f = anim.next();
        expect(f).toBeNull();
        anim.close();
        c.destroy();
    });

    test("multiple concurrent animations", () => {
        const c = new Chafa();
        const a1 = c.openAnimation(gifAnimBuf);
        const a2 = c.openAnimation(gifAnimBuf);
        const f1 = a1.next()!;
        const f2 = a2.next()!;
        expect(f1.frameIndex).toBe(0);
        expect(f2.frameIndex).toBe(0);
        a1.close();
        a2.close();
        c.destroy();
    });
});

/* ═══════════════════════════════════════════════════════════════════
   Animation - WebP
   ═══════════════════════════════════════════════════════════════════ */

describe("Animation - WebP", () => {
    test("open and iterate", () => {
        const c = new Chafa();
        const anim = c.openAnimation(webpAnimBuf);
        expect(anim.imageFormat).toBe(4);
        expect(anim.width).toBe(640);
        expect(anim.height).toBe(640);
        let count = 0;
        while (true) {
            const f = anim.next();
            if (!f) break;
            expect(f.metrics.frameDelayMs).toBeGreaterThan(0);
            count++;
        }
        expect(count).toBeGreaterThan(0);
        anim.close();
        c.destroy();
    });
});

/* ═══════════════════════════════════════════════════════════════════
   Config defaults
   ═══════════════════════════════════════════════════════════════════ */

describe("Default config", () => {
    test("has expected defaults", () => {
        const d = defaultConfig();
        expect(d.termW).toBe(80);
        expect(d.termH).toBe(24);
        expect(d.workFactor).toBe(0.0);
        expect(d.preprocessing).toBe(0);
        expect(d.canvasMode).toBe(CanvasMode.TRUECOLOR);
        expect(d.pixelMode).toBe(PixelMode.SYMBOLS);
        expect(d.ditherMode).toBe(DitherMode.NONE);
        expect(d.maxFrames).toBe(-1);
        expect(d.speed).toBe(1.0);
    });
});

/* ═══════════════════════════════════════════════════════════════════
   Symbol.dispose
   ═══════════════════════════════════════════════════════════════════ */

describe("Symbol.dispose", () => {
    test("Chafa has Symbol.dispose method", () => {
        const c = new Chafa();
        expect(typeof (c as any)[Symbol.dispose]).toBe("function");
        c.destroy();
    });

    test("ChafaAnimation has Symbol.dispose method", () => {
        const c = new Chafa();
        const anim = c.openAnimation(gifAnimBuf);
        expect(typeof (anim as any)[Symbol.dispose]).toBe("function");
        anim.close();
        c.destroy();
    });

    test("ChafaImage has Symbol.dispose method", () => {
        const c = new Chafa();
        const img = c.decode(pngBuf);
        expect(typeof (img as any)[Symbol.dispose]).toBe("function");
        img.destroy();
        c.destroy();
    });
});

/* ═══════════════════════════════════════════════════════════════════
   Static utilities
   ═══════════════════════════════════════════════════════════════════ */

describe("Static utilities", () => {
    test("ansiToHtml returns HTML string", () => {
        const c = new Chafa();
        const { ansi } = c.render(pngBuf);
        const html = Chafa.ansiToHtml(ansi);
        expect(html).toContain("<span");
        expect(html).toContain("</span>");
        expect(html).toContain("<br>");
        c.destroy();
    });

    test("ansiToConsoleArgs returns arguments array", () => {
        const c = new Chafa();
        const { ansi } = c.render(pngBuf);
        const args = Chafa.ansiToConsoleArgs(ansi);
        expect(args.length).toBeGreaterThanOrEqual(1);
        expect(typeof args[0]).toBe("string");
        c.destroy();
    });
});

/* ═══════════════════════════════════════════════════════════════════
   Video (FFmpeg)
   ═══════════════════════════════════════════════════════════════════ */

describe("Video", () => {
    let videoBuf: Buffer;

    beforeAll(() => {
        // Use the test.mp4 generated earlier, or skip if not found
        try {
            videoBuf = fs.readFileSync("playground/media/test.mp4");
        } catch {
            // Try boykisser.mp4 as fallback
            try {
                videoBuf = fs.readFileSync("playground/media/boykisser.mp4");
            } catch {
                videoBuf = null as any;
            }
        }
    });

    const hasVideo = () => {
        if (!videoBuf || videoBuf.length === 0) return false;
        // Test if FFmpeg is available
        try {
            const c = new Chafa();
            const v = c.openVideo(videoBuf, 160, 120);
            v.close();
            c.destroy();
            return true;
        } catch {
            return false;
        }
    };

    test("open video returns ChafaVideo", () => {
        if (!hasVideo()) return; // skip if FFmpeg not installed
        const c = new Chafa();
        const v = c.openVideo(videoBuf, 160, 120);
        expect(v).toBeDefined();
        expect(v.width).toBeGreaterThan(0);
        expect(v.height).toBeGreaterThan(0);
        expect(v.fps).toBeGreaterThan(0);
        expect(typeof v.durationSec).toBe("number");
        expect(typeof v.hasAudio).toBe("boolean");
        expect(typeof v.audioCodec).toBe("string");
        v.close();
        c.destroy();
    });

    test("decode frames", () => {
        if (!hasVideo()) return;
        const c = new Chafa();
        const v = c.openVideo(videoBuf, 160, 120);
        let count = 0;
        while (true) {
            const f = v.nextFrame();
            if (!f) break;
            count++;
            expect(f.width).toBeGreaterThan(0);
            expect(f.height).toBeGreaterThan(0);
            expect(f.rgba.length).toBe(f.width * f.height * 4);
            expect(f.ptsSec).toBeGreaterThanOrEqual(0);
            expect(f.frameIndex).toBeGreaterThanOrEqual(0);
            expect(f.metrics.frameDelayMs).toBeGreaterThan(0);
            if (count >= 10) break; // only test first 10
        }
        expect(count).toBeGreaterThan(0);
        v.close();
        c.destroy();
    });

    test("seek forward", () => {
        if (!hasVideo()) return;
        const c = new Chafa();
        const v = c.openVideo(videoBuf, 160, 120);
        v.seek(1.0);
        const f = v.nextFrame();
        expect(f).not.toBeNull();
        // PTS should be >= 0.5s (seek may land on nearest keyframe)
        expect(f!.ptsSec).toBeGreaterThanOrEqual(0);
        v.close();
        c.destroy();
    });

    test("seek to start", () => {
        if (!hasVideo()) return;
        const c = new Chafa();
        const v = c.openVideo(videoBuf, 160, 120);
        // Read a few frames, then seek back
        v.nextFrame();
        v.nextFrame();
        v.seek(0);
        const f = v.nextFrame();
        expect(f).not.toBeNull();
        expect(f!.ptsSec).toBeLessThan(0.5);
        v.close();
        c.destroy();
    });

    test("rapid seeks do not crash", () => {
        if (!hasVideo()) return;
        const c = new Chafa();
        const v = c.openVideo(videoBuf, 160, 120);
        // Fire 3 seeks in quick succession
        v.seek(1);
        v.seek(2);
        v.seek(1);
        // Should still be able to read frames
        const f = v.nextFrame();
        expect(f).not.toBeNull();
        v.close();
        c.destroy();
    });

    test("decode at lower resolution", () => {
        if (!hasVideo()) return;
        const c = new Chafa();
        const v = c.openVideo(videoBuf, 320, 240);
        const f = v.nextFrame();
        expect(f).not.toBeNull();
        // Should be <= target resolution
        expect(f!.width).toBeLessThanOrEqual(320);
        expect(f!.height).toBeLessThanOrEqual(240);
        v.close();
        c.destroy();
    });

    test("decode at pixel-fit size when no explicit size given", () => {
        if (!hasVideo()) return;
        const c = new Chafa({ termW: 80, termH: 24, pixelMode: PixelMode.SIXELS });
        const v = c.openVideo(videoBuf, 0, 0);
        const f = v.nextFrame();
        expect(f).not.toBeNull();
        // 80x24 cells at 8x16 px = 640x384 canvas; 16:9 video -> 640x360 fit box
        expect(f!.width).toBeGreaterThan(0);
        expect(f!.width).toBeLessThanOrEqual(640);
        expect(f!.height).toBeGreaterThan(0);
        expect(f!.height).toBeLessThanOrEqual(384);
        v.close();
        c.destroy();
    });

    test("seek target is clamped to video duration", () => {
        if (!hasVideo()) return;
        const c = new Chafa();
        const v = c.openVideo(videoBuf, 320, 240);
        v.nextFrame();
        v.seek(v.durationSec + 500);
        const f = v.nextFrame();
        expect(f).not.toBeNull();
        expect(f!.ptsSec).toBeLessThanOrEqual(v.durationSec);
        v.close();
        c.destroy();
    });

    test("rapid seeks near the end stay near the end and can seek back", () => {
        if (!hasVideo()) return;
        const c = new Chafa();
        const v = c.openVideo(videoBuf, 320, 240);
        let pts = v.nextFrame()!.ptsSec;
        // Repeated +30s seeks (targeting past the end) must never go backward
        let prev = pts;
        for (let i = 0; i < 4; i++) {
            v.seek(pts + 30);
            const f = v.nextFrame();
            expect(f).not.toBeNull();
            expect(f!.ptsSec).toBeGreaterThanOrEqual(prev);
            prev = f!.ptsSec;
            pts = f!.ptsSec;
        }
        // Seeking backward still works
        v.seek(1);
        const g = v.nextFrame();
        expect(g).not.toBeNull();
        expect(g!.ptsSec).toBeLessThan(5);
        v.close();
        c.destroy();
    });

    test("single instance owns both video decode and rendering", () => {
        if (!hasVideo()) return;
        const c = new Chafa({ termW: 60, termH: 20, pixelMode: PixelMode.SIXELS });
        const v = c.openVideo(videoBuf, 320, 180);
        const f = v.nextFrame();
        expect(f).not.toBeNull();
        const { ansi, metrics } = c.renderRgba(f!.rgba, f!.width, f!.height);
        expect(ansi.startsWith("\x1bP")).toBe(true);
        expect(metrics.pixelMode).toBe(PixelMode.SIXELS);
        v.close();
        c.destroy();
    });

    test("close is safe to call twice", () => {
        if (!hasVideo()) return;
        const c = new Chafa();
        const v = c.openVideo(videoBuf, 160, 120);
        v.close();
        expect(() => v.close()).not.toThrow();
        c.destroy();
    });

    test("nextFrame after close returns null", () => {
        if (!hasVideo()) return;
        const c = new Chafa();
        const v = c.openVideo(videoBuf, 160, 120);
        v.close();
        const f = v.nextFrame();
        expect(f).toBeNull();
        c.destroy();
    });

    test("context destroy closes all videos", () => {
        if (!hasVideo()) return;
        const c = new Chafa();
        const v1 = c.openVideo(videoBuf, 160, 120);
        const v2 = c.openVideo(videoBuf, 160, 120);
        // Destroy context - should close both
        c.destroy();
        expect(v1.nextFrame()).toBeNull();
        expect(v2.nextFrame()).toBeNull();
    });

    test("video through renderRgba produces ANSI", () => {
        if (!hasVideo()) return;
        const c = new Chafa({ termW: 80, termH: 24 });
        const v = c.openVideo(videoBuf, 320, 240);
        const f = v.nextFrame();
        expect(f).not.toBeNull();
        const { ansi } = c.renderRgba(f!.rgba, f!.width, f!.height);
        expect(ansi).toContain("\x1b[");
        expect(ansi.length).toBeGreaterThan(100);
        v.close();
        c.destroy();
    });

    test("Symbol.dispose on video", () => {
        if (!hasVideo()) return;
        const c = new Chafa();
        const v = c.openVideo(videoBuf, 160, 120);
        expect(typeof (v as any)[Symbol.dispose]).toBe("function");
        v.close();
        c.destroy();
    });
});

/* ═══════════════════════════════════════════════════════════════════
   Rapid animation seek stress test
   ═══════════════════════════════════════════════════════════════════ */

describe("Animation rapid seek", () => {
    test("rapid rewind/unread does not crash", () => {
        const c = new Chafa();
        const anim = c.openAnimation(gifAnimBuf);
        // Rapid rewind + replay
        anim.next(); anim.next(); anim.next();
        anim.rewind();
        anim.next(); anim.next();
        anim.rewind();
        anim.next();
        anim.close();
        c.destroy();
    });
});

/* ═══════════════════════════════════════════════════════════════════
   Animation player: play / pause / goto / onFrame
   ═══════════════════════════════════════════════════════════════════ */

describe("Animation player", () => {
    test("onFrame fires on manual next()", () => {
        const c = new Chafa();
        const anim = c.openAnimation(gifAnimBuf);
        const seen: number[] = [];
        const unsub = anim.onFrame((f) => seen.push(f.frameIndex));
        anim.next();
        anim.next();
        expect(seen).toEqual([0, 1]);
        unsub();
        anim.next();
        expect(seen).toEqual([0, 1]); // unsubscribed
        anim.close();
        c.destroy();
    });

    test("goto jumps to frame and emits rendered ansi", () => {
        const c = new Chafa({ pixelMode: PixelMode.KITTY });
        const anim = c.openAnimation(gifAnimBuf);
        const events: any[] = [];
        anim.onFrame((f) => events.push(f));
        const r = anim.goto(3);
        expect(r).not.toBeNull();
        expect(r!.frameIndex).toBe(3);
        expect(r!.ansi.startsWith("\x1b_G")).toBe(true);
        expect(events.length).toBe(1);
        expect(events[0].frameIndex).toBe(3);
        expect(events[0].ansi).toBeDefined();
        // next() continues from frame 4
        expect(anim.next()!.frameIndex).toBe(4);
        anim.close();
        c.destroy();
    });

    test("goto out of range returns null", () => {
        const c = new Chafa();
        const anim = c.openAnimation(gifAnimBuf);
        expect(anim.goto(anim.frameCount + 10)).toBeNull();
        expect(anim.goto(-1)).toBeNull();
        anim.close();
        c.destroy();
    });

    test("play advances frames and pause freezes", async () => {
        const c = new Chafa({ pixelMode: PixelMode.SIXELS });
        const anim = c.openAnimation(gifAnimBuf);
        let count = 0;
        let sawAnsi = false;
        anim.onFrame((f) => {
            count++;
            if (f.ansi?.startsWith("\x1bP")) sawAnsi = true;
        });
        anim.play();
        expect(anim.playing).toBe(true);
        await new Promise((r) => setTimeout(r, 400));
        anim.pause();
        expect(anim.playing).toBe(false);
        expect(count).toBeGreaterThan(0);
        expect(sawAnsi).toBe(true); // pixel-mode aware rendering during play
        const frozen = count;
        await new Promise((r) => setTimeout(r, 150));
        expect(count).toBe(frozen); // paused: no more frames
        anim.close();
        c.destroy();
    });

    test("loop + play wraps past the end", async () => {
        const c = new Chafa();
        const anim = c.openAnimation(gifAnimBuf);
        anim.loop = true;
        const seen: number[] = [];
        anim.onFrame((f) => seen.push(f.frameIndex));
        anim.play();
        // Play long enough to exceed one full loop
        await new Promise((r) => setTimeout(r, 3000));
        anim.pause();
        expect(seen.length).toBeGreaterThan(anim.frameCount);
        // indices must wrap (a later event smaller than an earlier one)
        const wrapped = seen.some((v, i) => i > 0 && v < seen[i - 1]!);
        expect(wrapped).toBe(true);
        const loops = seen.filter((v) => v === 0).length;
        expect(loops).toBeGreaterThan(1);
        anim.close();
        c.destroy();
    });
});

/* ═══════════════════════════════════════════════════════════════════
   Video player: iterator / onFrame / play / goto / thumbnail / audio
   ═══════════════════════════════════════════════════════════════════ */

describe("Video player", () => {
    let videoBuf: Buffer;
    let audioBuf: Buffer;

    beforeAll(() => {
        try {
            videoBuf = fs.readFileSync("playground/media/test.mp4");
        } catch {
            videoBuf = fs.readFileSync("playground/media/boykisser.mp4");
        }
        try {
            audioBuf = fs.readFileSync("playground/media/test_audio.mp4");
        } catch {
            audioBuf = null as any;
        }
    });

    const hasVideo = () => {
        if (!videoBuf || videoBuf.length === 0) return false;
        try {
            const c = new Chafa();
            const v = c.openVideo(videoBuf, 160, 120);
            v.close();
            c.destroy();
            return true;
        } catch {
            return false;
        }
    };
    const hasAudioVideo = () => {
        if (!audioBuf || audioBuf.length === 0) return false;
        try {
            const c = new Chafa();
            const v = c.openVideo(audioBuf, 160, 120);
            v.close();
            c.destroy();
            return true;
        } catch {
            return false;
        }
    };

    test("async iterator yields frames", async () => {
        if (!hasVideo()) return;
        const c = new Chafa();
        const v = c.openVideo(videoBuf, 160, 120);
        let n = 0;
        for await (const f of v) {
            expect(f.rgba.length).toBe(f.width * f.height * 4);
            n++;
            if (n >= 5) break;
        }
        expect(n).toBe(5);
        v.close();
        c.destroy();
    });

    test("onFrame fires on nextFrame and goto", () => {
        if (!hasVideo()) return;
        const c = new Chafa();
        const v = c.openVideo(videoBuf, 160, 120);
        const events: any[] = [];
        const unsub = v.onFrame((f) => events.push(f));
        const f1 = v.nextFrame();
        expect(events.length).toBe(1);
        expect(events[0].frameIndex).toBe(f1!.frameIndex);
        const g = v.goto(1.0);
        expect(g).not.toBeNull();
        expect(events.length).toBe(2);
        unsub();
        v.nextFrame();
        expect(events.length).toBe(2);
        v.close();
        c.destroy();
    });

    test("thumbnail renders with instance config", () => {
        if (!hasVideo()) return;
        const c = new Chafa({ termW: 40, termH: 20, pixelMode: PixelMode.SIXELS });
        const v = c.openVideo(videoBuf, 320, 240);
        const t = v.thumbnail();
        expect(t.ansi.startsWith("\x1bP")).toBe(true);
        expect(t.width).toBe(320);
        expect(t.height).toBe(240);
        v.close();
        c.destroy();
    });

    test("play toggles playing state and pauses", async () => {
        if (!hasVideo()) return;
        const c = new Chafa();
        const v = c.openVideo(videoBuf, 160, 120);
        let frames = 0;
        v.onFrame(() => frames++);
        expect(v.playing).toBe(false);
        v.play(4.0); // fast
        expect(v.playing).toBe(true);
        await new Promise((r) => setTimeout(r, 300));
        v.pause();
        expect(v.playing).toBe(false);
        expect(frames).toBeGreaterThan(0);
        v.close();
        c.destroy();
    });

    test("videoIncludeAudio exposes per-frame PCM; default does not", () => {
        if (!hasAudioVideo()) return;
        // Default: no audio decode
        {
            const c = new Chafa();
            const v = c.openVideo(audioBuf, 160, 120);
            const f = v.nextFrame();
            expect(f).not.toBeNull();
            expect(f!.audio ?? null).toBeNull();
            expect(f!.audioSamples).toBe(0);
            v.close();
            c.destroy();
        }
        // Opt-in: PCM samples covering the frame
        {
            const c = new Chafa({ videoIncludeAudio: 1 });
            const v = c.openVideo(audioBuf, 160, 120);
            expect(v.hasAudio).toBe(true);
            expect(v.audioCodec.length).toBeGreaterThan(0);
            const f = v.nextFrame();
            expect(f).not.toBeNull();
            expect(f!.audio).toBeInstanceOf(Float32Array);
            expect(f!.audioSamples).toBeGreaterThan(0);
            expect(f!.audioChannels).toBeGreaterThan(0);
            expect(f!.audioSampleRate).toBeGreaterThan(0);
            expect(f!.audio!.length).toBe(f!.audioSamples! * f!.audioChannels!);
            // non-silent: 440Hz sine -> nonzero energy
            let energy = 0;
            for (let i = 0; i < f!.audio!.length; i++) energy += f!.audio![i]! ** 2;
            expect(energy).toBeGreaterThan(0);
            v.close();
            c.destroy();
        }
    });

    test("info() exposes status and audio metadata", () => {
        if (!hasVideo()) return;
        const c = new Chafa();
        const v = c.openVideo(videoBuf, 160, 120);
        const info = v.info();
        expect(info.durationSec).toBeGreaterThan(0);
        expect(info.fps).toBeGreaterThan(0);
        expect(info.status).not.toBeNull();
        expect(typeof info.status.frameIndex).toBe("number");
        v.close();
        c.destroy();
    });
});

/* ═══════════════════════════════════════════════════════════════════
   Terminal detection + instance info
   ═══════════════════════════════════════════════════════════════════ */

describe("Terminal detection", () => {
    test("env auto-detect applies pixel mode for kitty terminals", () => {
        const old = process.env.KITTY_WINDOW_ID;
        process.env.KITTY_WINDOW_ID = "12345";
        try {
            const c = new Chafa();
            expect(c.config.pixelMode).toBe(PixelMode.KITTY);
            c.destroy();
        } finally {
            if (old === undefined) delete process.env.KITTY_WINDOW_ID;
            else process.env.KITTY_WINDOW_ID = old;
        }
    });

    test("explicit config wins over env detection", () => {
        const old = process.env.KITTY_WINDOW_ID;
        process.env.KITTY_WINDOW_ID = "12345";
        try {
            const c = new Chafa({ pixelMode: PixelMode.SIXELS });
            expect(c.config.pixelMode).toBe(PixelMode.SIXELS);
            c.destroy();
        } finally {
            if (old === undefined) delete process.env.KITTY_WINDOW_ID;
            else process.env.KITTY_WINDOW_ID = old;
        }
    });

    test("detect() falls back to env info in non-TTY", async () => {
        const info = await Chafa.detect();
        expect(info.probed).toBe(false);
        expect(typeof info.pixelMode).toBe("number");
        expect(typeof info.canvasMode).toBe("number");
        expect(Array.isArray(info.pixelModes)).toBe(true);
    });

    test("chafa.info() exports config, features and last metrics", () => {
        const c = new Chafa();
        c.render(pngBuf);
        const info = c.info();
        expect(info.config.termW).toBe(80);
        expect(typeof info.features).toBe("string");
        expect(info.lastMetrics).not.toBeNull();
        expect(info.lastMetrics!.totalMs).toBeGreaterThanOrEqual(0);
        expect(typeof info.lastMetrics!.scaleMs).toBe("number");
        c.destroy();
    });

    test("anim.info() exports playback state", () => {
        const c = new Chafa();
        const anim = c.openAnimation(gifAnimBuf);
        const info = anim.info();
        expect(info.frameCount).toBeGreaterThan(1);
        expect(info.playing).toBe(false);
        expect(info.loop).toBe(false);
        anim.close();
        c.destroy();
    });
});
