// static-chafa — ESM entry (also re-exported as CJS via tsdown)
// Copyright (c) 2023-2024 c0d3d3v. MIT.

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const { platform, arch } = process;
const SUFFIX = `${platform}-${arch}`;
const PKG = `@static-chafa/${SUFFIX}`;

let native: Record<string, any>;
try {
    native = require(PKG);
} catch (e: any) {
    throw new Error(
        `static-chafa: unsupported platform ${SUFFIX}. ` +
        `Install error: ${(e as Error).message}`,
    );
}

export type RenderMetrics = import("./types.ts").CodecMetrics;
export type RenderConfig = Partial<import("./types.ts").CodecConfig>;
export type RenderResult = import("./types.ts").RenderResult;
export type AnimOpenResult = { handle: number; metrics: RenderMetrics };
export type AnimFrame = import("./types.ts").AnimFrame;

function ensureBuffer(data: Uint8Array): Buffer {
    if (Buffer.isBuffer(data)) return data as Buffer;
    return Buffer.from(data);
}

export function renderBuffer(
    data: Buffer | Uint8Array,
    cfg: RenderConfig = {},
): RenderResult {
    return native.renderBuffer(ensureBuffer(data), cfg);
}

export function renderPath(path: string, cfg: RenderConfig = {}): RenderResult {
    return native.renderPath(path, cfg);
}

export function animOpenBuffer(
    data: Buffer | Uint8Array,
    cfg: RenderConfig = {},
): AnimOpenResult {
    return native.animOpenBuffer(ensureBuffer(data), cfg);
}

export function animNext(handle: number): AnimFrame | null {
    return native.animNext(handle);
}

export function animRenderFrame(
    handle: number,
    frameIndex: number,
): RenderResult {
    return native.animRenderFrame(handle, frameIndex);
}

export function animRewind(handle: number): void {
    native.animRewind(handle);
}

export function animClose(handle: number): void {
    native.animClose(handle);
}

export function animAbort(handle: number): void {
    native.animAbort(handle);
}

export default {
    renderBuffer,
    renderPath,
    animOpenBuffer,
    animNext,
    animRenderFrame,
    animRewind,
    animClose,
    animAbort,
};
