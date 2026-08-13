/**
 * @file tests/pixelmodes.test.ts
 * @brief Pixel graphics protocol tests: sixel, kitty, iTerm2, sizing, animations.
 *
 * Chafa natively emits sixel (DCS), kitty (APC) and iTerm2 (OSC 1337)
 * pixel data when `pixelMode` is set accordingly. These tests pin that
 * behavior, the pixel-fit sizing model, animation frame id reuse (kitty)
 * and looping for both static renders and animations.
 */

import { describe, test, expect, beforeAll } from "bun:test";
import Chafa, { PixelMode, PixelFit, pixelCanvasSize } from "../src/index.ts";
import fs from "node:fs";

const MEDIA = "playground/media";
let pngBuf: Buffer;
let gifAnimBuf: Buffer;

beforeAll(() => {
    pngBuf = fs.readFileSync(`${MEDIA}/fox.png`);
    gifAnimBuf = fs.readFileSync(`${MEDIA}/teseractor.gif`);
});

function renderIn(mode: number, extra: Record<string, number> = {}) {
    const c = new Chafa({ termW: 40, termH: 20, pixelMode: mode, ...extra });
    const r = c.render(pngBuf);
    c.destroy();
    return r;
}

describe("Pixel modes - static", () => {
    test("sixel emits DCS sixel sequence", () => {
        const { ansi, metrics } = renderIn(PixelMode.SIXELS);
        expect(metrics.pixelMode).toBe(PixelMode.SIXELS);
        expect(ansi.startsWith("\x1bP")).toBe(true);
        expect(ansi).toContain("q");
        expect(ansi.endsWith("\x1b\\")).toBe(true);
        expect(ansi.includes("\x00")).toBe(false);
    });

    test("kitty emits APC graphics sequence", () => {
        const { ansi, metrics } = renderIn(PixelMode.KITTY);
        expect(metrics.pixelMode).toBe(PixelMode.KITTY);
        expect(ansi.startsWith("\x1b_G")).toBe(true);
        expect(ansi).toContain("a=T");
        expect(ansi).toContain("f=32");
        expect(ansi.includes("\x00")).toBe(false);
    });

    test("iterm2 emits OSC 1337 inline image", () => {
        const { ansi, metrics } = renderIn(PixelMode.ITERM2);
        expect(metrics.pixelMode).toBe(PixelMode.ITERM2);
        expect(ansi.startsWith("\x1b]1337;File=")).toBe(true);
        expect(ansi.includes("\x00")).toBe(false);
    });

    test("symbol mode unchanged", () => {
        const { ansi, metrics } = renderIn(PixelMode.SYMBOLS);
        expect(metrics.pixelMode).toBe(PixelMode.SYMBOLS);
        expect(ansi.startsWith("\x1bP")).toBe(false);
        expect(ansi.startsWith("\x1b_G")).toBe(false);
        expect(ansi.startsWith("\x1b]1337")).toBe(false);
    });
});

describe("Pixel modes - sizing (pixel fit)", () => {
    test("canvas pixel area = termW x cellW by termH x cellH", () => {
        const { metrics } = renderIn(PixelMode.SIXELS, { termW: 60, termH: 30, cellW: 8, cellH: 16 });
        expect(metrics.canvasPw).toBe(60 * 8);
        expect(metrics.canvasPh).toBe(30 * 16);
    });

    test("sixel raster matches full terminal area by default (cell 8x16)", () => {
        const { ansi } = renderIn(PixelMode.SIXELS, { termW: 60, termH: 30 });
        expect(ansi).toContain(`"1;1;480;480`);
    });

    test("legacy half-height behavior requires explicit cellH 8", () => {
        const { ansi } = renderIn(PixelMode.SIXELS, { termW: 60, termH: 30, cellH: 8 });
        expect(ansi).toContain(`"1;1;480;240`);
    });

    test("SCALE fit reports pixelFit and still fills canvas", () => {
        const { ansi, metrics } = renderIn(PixelMode.SIXELS, { pixelFit: PixelFit.SCALE });
        expect(metrics.pixelFit).toBe(PixelFit.SCALE);
        expect(ansi).toContain(`"1;1;320;320`);
    });

    test("NONE fit also fills canvas (chafa scales internally)", () => {
        const { ansi, metrics } = renderIn(PixelMode.KITTY, { pixelFit: PixelFit.NONE });
        expect(metrics.pixelFit).toBe(PixelFit.NONE);
        expect(ansi).toContain("s=320,v=320");
    });

    test("pixelCanvasSize helper", () => {
        expect(pixelCanvasSize({ termW: 80, termH: 24, cellW: 8, cellH: 16, pixelMode: PixelMode.SIXELS } as any))
            .toEqual({ width: 640, height: 384 });
    });
});

describe("Pixel modes - animation", () => {
    for (const mode of [PixelMode.SIXELS, PixelMode.KITTY] as const) {
        test(`animated frame in mode ${mode}`, () => {
            const c = new Chafa({ termW: 40, termH: 20, pixelMode: mode });
            const anim = c.openAnimation(gifAnimBuf);
            const frame = anim.next();
            expect(frame).not.toBeNull();
            const { ansi } = anim.renderFrame(frame!.frameIndex);
            expect(
                ansi.startsWith(mode === PixelMode.SIXELS ? "\x1bP" : "\x1b_G"),
            ).toBe(true);
            anim.close();
            c.destroy();
        });
    }

    test("kitty animation frames reuse one image id", () => {
        const c = new Chafa({ termW: 40, termH: 20, pixelMode: PixelMode.KITTY });
        const anim = c.openAnimation(gifAnimBuf);
        const ids = new Set<string>();
        for (let i = 0; i < 4; i++) {
            const frame = anim.next();
            if (!frame) break;
            const { ansi } = anim.renderFrame(frame.frameIndex);
            const m = /i=(\d+)/.exec(ansi);
            expect(m).not.toBeNull();
            ids.add(m![1]);
        }
        expect(ids.size).toBe(1); // one stable id across frames
        anim.close();
        c.destroy();
    });

    test("two kitty animations get distinct image ids", () => {
        const c = new Chafa({ termW: 40, termH: 20, pixelMode: PixelMode.KITTY });
        const a1 = c.openAnimation(gifAnimBuf);
        const a2 = c.openAnimation(gifAnimBuf);
        const f1 = a1.renderFrame(a1.next()!.frameIndex).ansi;
        const f2 = a2.renderFrame(a2.next()!.frameIndex).ansi;
        const id1 = /i=(\d+)/.exec(f1)?.[1];
        const id2 = /i=(\d+)/.exec(f2)?.[1];
        expect(id1).toBeDefined();
        expect(id2).toBeDefined();
        expect(id1).not.toBe(id2);
        a1.close();
        a2.close();
        c.destroy();
    });

    test("static kitty renders have no image id", () => {
        const { ansi } = renderIn(PixelMode.KITTY);
        expect(/i=\d+/.test(ansi)).toBe(false);
    });

    test("loop mode auto-rewinds at the end", () => {
        const c = new Chafa();
        const anim = c.openAnimation(gifAnimBuf);
        const total = anim.frameCount;
        let seen = 0;
        while (anim.next()) seen++;
        expect(seen).toBe(total);
        expect(anim.next()).toBeNull(); // no loop: ends

        anim.loop = true;
        const f = anim.next(); // rewinds and restarts
        expect(f).not.toBeNull();
        expect(f!.frameIndex).toBe(0);
        anim.close();
        c.destroy();
    });
});

describe("Pixel modes - matrix guard", () => {
    test("renderMatrix throws in pixel modes", () => {
        const c = new Chafa({ pixelMode: PixelMode.SIXELS });
        expect(() => c.renderMatrix(pngBuf)).toThrow(/symbol mode/);
        c.destroy();
    });

    test("renderMatrix works in symbol mode", () => {
        const c = new Chafa();
        const { matrix } = c.renderMatrix(pngBuf);
        expect(matrix.startsWith("[")).toBe(true);
        c.destroy();
    });
});
