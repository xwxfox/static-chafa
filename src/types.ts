// types.ts - shared types for both Bun FFI and NAPI entry points

/** 0=PNG, 1=JPEG, 2=BMP, 3=GIF, 4=WebP */
export type ChafaFormat = number;

export interface CodecMetrics {
    parseMs: number;
    inflateMs: number;
    defilterMs: number;
    renderMs: number;
    imgW: number;
    imgH: number;
    frameCount: number;
    frameDelayMs: number;
    format: ChafaFormat;
}

export interface CodecConfig {
    termW: number;
    termH: number;
    workFactor: number;
    ditherMode: number;
    canvasMode: number;
    preprocessing: number;
    bgColor: number;
    speed: number;
    maxFrames: number;
}

export interface RenderResult {
    ansi: string;
    metrics: CodecMetrics;
}

export interface AnimFrame {
    frameIndex: number;
    metrics: CodecMetrics;
}
