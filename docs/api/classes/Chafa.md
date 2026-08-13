# Class: Chafa

Defined in: [index.ts:857](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L857)

The main entry point for rendering images with chafa.

Each instance holds its own configuration and caches a single chafa
canvas internally (rebuilt when config changes). Create multiple
instances for different rendering settings.

Supports `using` for automatic cleanup:
```ts
using chafa = new Chafa({ termW: 80, termH: 24, canvasMode: CanvasMode.TRUECOLOR });
const { ansi } = chafa.render(imageBuffer);
// chafa.destroy() called automatically here
```

## Example

```ts
import Chafa, { CanvasMode, DitherMode } from "static-chafa";

const chafa = new Chafa({ termW: 80, termH: 24 });

// Quick render
const { ansi, metrics } = chafa.render(imageBuffer);
console.log(`Rendered in ${metrics.totalMs.toFixed(1)}ms`);

// Decode once, render with multiple configs
const img = chafa.decode(imageBuffer);
chafa.updateConfig({ canvasMode: CanvasMode.INDEXED_256 });
const { ansi: indexed } = chafa.renderRgba(img.rgba, img.width, img.height);

chafa.destroy();
```

## Constructors

### Constructor

```ts
new Chafa(config?): Chafa;
```

Defined in: [index.ts:889](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L889)

Create a new chafa instance.

Unspecified config fields are auto-detected from the environment
(e.g. `$TERM`, `$KITTY_WINDOW_ID`, `$COLORTERM`) for the best
out-of-the-box experience: a kitty terminal gets kitty pixel mode,
truecolor-capable terminals get truecolor, etc. Explicitly passing
a field always wins. Use [Chafa.detect](#detect) for a full active
probe of the terminal's capabilities.

When the terminal supports it (TTY), the constructor also starts a
one-shot async probe of the real cell pixel size. Pixel modes emit
images at `termW × cellW` by `termH × cellH` pixels, so without the
real cell size the output can draw smaller than the terminal area.
The probe patches `cellW`/`cellH` (and `termW`/`termH`) as soon as it
completes - only for fields you didn't set explicitly.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `config?` | `Partial`\<[`ChafaConfig`](../interfaces/ChafaConfig.md)\> | Partial config overrides. |

#### Returns

`Chafa`

## Accessors

### config

#### Get Signature

```ts
get config(): Readonly<ChafaConfig>;
```

Defined in: [index.ts:949](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L949)

Read-only snapshot of the current effective configuration.
Use `updateConfig()` to change settings.

##### Returns

`Readonly`\<[`ChafaConfig`](../interfaces/ChafaConfig.md)\>

***

### probeReady

#### Get Signature

```ts
get probeReady(): Promise<void>;
```

Defined in: [index.ts:941](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L941)

Resolves once the constructor's automatic terminal probe has
finished (immediately when no probe runs - non-TTY, symbol mode, or
fully explicit config). Await it before opening media when pixel-mode
output must be sized correctly from the very first frame.

##### Returns

`Promise`\<`void`\>

## Methods

### \[dispose\]()

```ts
dispose: void;
```

Defined in: [index.ts:1159](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L1159)

#### Returns

`void`

#### Inherit Doc

***

### autoDetect()

```ts
autoDetect(timeoutMs?): Promise<TerminalInfo>;
```

Defined in: [index.ts:1220](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L1220)

Probe the terminal and apply the detected capabilities to this
instance (pixel mode, cell size, color mode, terminal size).
Explicitly configured fields are kept - only unspecified ones are
filled in.

#### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `timeoutMs` | `number` | `300` |

#### Returns

`Promise`\<`TerminalInfo`\>

***

### decode()

```ts
decode(data): ChafaImage;
```

Defined in: [index.ts:984](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L984)

Decode any supported image format to raw RGBA pixels.

Useful for pre-decoding an image once then rendering multiple times
with different configs via `renderRgba()`.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `data` | `Uint8Array`\<`ArrayBufferLike`\> \| `Buffer`\<`ArrayBufferLike`\> | Encoded image bytes (PNG, JPEG, BMP, GIF, WebP). |

#### Returns

[`ChafaImage`](ChafaImage.md)

A [ChafaImage](ChafaImage.md) holding the decoded pixels and metadata.

***

### destroy()

```ts
destroy(): void;
```

Defined in: [index.ts:1152](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L1152)

Free all native resources (canvas, pending animations).
After calling this, the instance is permanently unusable.

Called automatically when the instance is garbage collected (NAPI path)
or at end of `using` scope.

#### Returns

`void`

***

### info()

```ts
info(): {
  config: Readonly<ChafaConfig>;
  features: string;
  lastMetrics: CodecMetrics | null;
};
```

Defined in: [index.ts:1244](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L1244)

Debug / perf snapshot for this instance: current config, features,
and metrics of the most recent operation.

#### Returns

```ts
{
  config: Readonly<ChafaConfig>;
  features: string;
  lastMetrics: CodecMetrics | null;
}
```

| Name | Type | Defined in |
| ------ | ------ | ------ |
| `config` | `Readonly`\<[`ChafaConfig`](../interfaces/ChafaConfig.md)\> | [index.ts:1244](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L1244) |
| `features` | `string` | [index.ts:1244](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L1244) |
| `lastMetrics` | [`CodecMetrics`](../interfaces/CodecMetrics.md) \| `null` | [index.ts:1244](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L1244) |

***

### openAnimation()

```ts
openAnimation(data): ChafaAnimation;
```

Defined in: [index.ts:1080](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L1080)

Open an animated GIF or WebP image for frame-by-frame playback.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `data` | `Uint8Array`\<`ArrayBufferLike`\> \| `Buffer`\<`ArrayBufferLike`\> | Encoded image bytes. |

#### Returns

[`ChafaAnimation`](ChafaAnimation.md)

A [ChafaAnimation](ChafaAnimation.md) instance for controlling playback.

#### Example

```ts
const anim = chafa.openAnimation(gifBuf);
while (true) {
    const f = anim.next();
    if (!f) break;
    const { ansi, metrics } = anim.renderFrame(f.frameIndex);
    await new Promise(r => setTimeout(r, metrics.frameDelayMs));
}
anim.close();
```

***

### openVideo()

```ts
openVideo(
   data, 
   decodeW?, 
   decodeH?): ChafaVideo;
```

Defined in: [index.ts:1113](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L1113)

Open a video file (MP4, MKV, WebM, AVI, etc.) for frame-by-frame decode.

Requires FFmpeg shared libraries installed on the system.
Throws a descriptive error if FFmpeg is not found.

A single Chafa instance can own the video decoder and render its
frames - no second instance is needed:
```ts
const chafa = new Chafa({ termW: 80, termH: 24, pixelMode: PixelMode.SIXELS });
const video = chafa.openVideo(buf);
while (true) {
    const f = video.nextFrame();
    if (!f) break;
    const { ansi } = chafa.renderRgba(f.rgba, f.width, f.height);
    process.stdout.write(ansi);
}
```

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `data` | `Uint8Array`\<`ArrayBufferLike`\> \| `Buffer`\<`ArrayBufferLike`\> | Video file bytes. |
| `decodeW?` | `number` | Target decode width in pixels. `0` (default) decodes at the pixel-fit size (`termW x cellW` by `termH x cellH`, aspect preserving) so frames render 1:1. |
| `decodeH?` | `number` | Target decode height in pixels. `0` = fit size. |

#### Returns

[`ChafaVideo`](ChafaVideo.md)

A [ChafaVideo](ChafaVideo.md) instance for frame iteration.

***

### render()

```ts
render(data): RenderResult;
```

Defined in: [index.ts:1000](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L1000)

Render any supported image to ANSI terminal art in a single call.

This is the simplest path: decode + draw + build ANSI string.
For repeated renders of the same image, prefer `decode()` then `renderRgba()`.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `data` | `Uint8Array`\<`ArrayBufferLike`\> \| `Buffer`\<`ArrayBufferLike`\> | Encoded image bytes. |

#### Returns

[`RenderResult`](../interfaces/RenderResult.md)

ANSI string and detailed timing/metrics.

***

### renderMatrix()

```ts
renderMatrix(data): MatrixResult;
```

Defined in: [index.ts:1037](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L1037)

Render any supported image to a character cell matrix.

The result is a JSON-encoded 3D array: `[[[charCode, fg, bg], ...], ...]`
where each inner triplet is `[Unicode code point, foreground color, background color]`.
Colors are -1 for transparent, packed 0xRRGGBB otherwise (truecolor mode),
or palette indices 0–255 (indexed modes).

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `data` | `Uint8Array`\<`ArrayBufferLike`\> \| `Buffer`\<`ArrayBufferLike`\> | Encoded image bytes. |

#### Returns

[`MatrixResult`](../interfaces/MatrixResult.md)

JSON matrix string and metrics.

***

### renderMatrixRgba()

```ts
renderMatrixRgba(
   rgba, 
   width, 
   height): MatrixResult;
```

Defined in: [index.ts:1052](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L1052)

Render pre-decoded RGBA pixels to a character cell matrix.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `rgba` | `Uint8Array` | RGBA pixel buffer. |
| `width` | `number` | Image width in pixels. |
| `height` | `number` | Image height in pixels. |

#### Returns

[`MatrixResult`](../interfaces/MatrixResult.md)

JSON matrix string and metrics.

***

### renderRgba()

```ts
renderRgba(
   rgba, 
   width, 
   height): RenderResult;
```

Defined in: [index.ts:1018](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L1018)

Render pre-decoded RGBA pixels to ANSI terminal art.

Bypasses the decode step - use when you already have a `ChafaImage` from `decode()`.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `rgba` | `Uint8Array` | RGBA pixel buffer (8 bits per channel, unassociated alpha). |
| `width` | `number` | Image width in pixels. |
| `height` | `number` | Image height in pixels. |

#### Returns

[`RenderResult`](../interfaces/RenderResult.md)

ANSI string and detailed timing/metrics.

***

### symbolGlyphs()

```ts
symbolGlyphs(charCodes): Uint8Array;
```

Defined in: [index.ts:1134](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L1134)

Coverage bitmaps for glyphs in the active symbol map (8 bytes per
codepoint: 8 rows of 8 bits, LSB = leftmost pixel, 1 = glyph pixel).
Uses the exact symbol map the renderer uses, so the returned bitmaps
rasterize symbol-mode output faithfully (used by the tuning harness).

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `charCodes` | `number`[] \| `Uint32Array`\<`ArrayBufferLike`\> | Codepoints to look up. |

#### Returns

`Uint8Array`

Uint8Array of `charCodes.length * 8` bytes.

***

### updateConfig()

```ts
updateConfig(config): void;
```

Defined in: [index.ts:968](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L968)

Update one or more configuration fields.
Invalidates the internal canvas so the next render picks up new settings.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `config` | `Partial`\<[`ChafaConfig`](../interfaces/ChafaConfig.md)\> | Fields to update. Omitted fields keep their current value. |

#### Returns

`void`

#### Example

```ts
chafa.updateConfig({
    canvasMode: CanvasMode.INDEXED_256,
    ditherMode: DitherMode.DIFFUSION,
    symbols: "block+border+space-wide",
});
```

***

### ansiToConsoleArgs()

```ts
static ansiToConsoleArgs(ansi): string[];
```

Defined in: [index.ts:1349](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L1349)

Convert an ANSI terminal art string to an array of `console.log` arguments.

Returns `[formatString, ...cssStyles]` suitable for `console.log(...)`.
Only the 8 basic ANSI colors + bright variants are mapped (256-color and
truecolor are approximated).

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `ansi` | `string` | Terminal art string from `render()` or `renderFrame()`. |

#### Returns

`string`[]

Array suitable for spread into `console.log(...)`.

***

### ansiToHtml()

```ts
static ansiToHtml(ansi): string;
```

Defined in: [index.ts:1261](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L1261)

Convert an ANSI escape sequence string to HTML with inline styles.

Handles SGR color codes (8-color, 256-color, truecolor), bold,
underline, and inversion. Useful for web-based previews.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `ansi` | `string` | Terminal art string from `render()` or `renderFrame()`. |

#### Returns

`string`

HTML string with `<span style="...">` elements and `<br>` line breaks.

***

### detect()

```ts
static detect(timeoutMs?): Promise<TerminalInfo>;
```

Defined in: [index.ts:1210](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L1210)

Actively probe the connected terminal and return its capabilities:
pixel protocol support (kitty / sixels), cell pixel size, terminal
dimensions, and color mode.

Sends escape-sequence queries to stdout and reads the replies from
stdin. Requires a TTY; falls back to environment detection silently
otherwise (e.g. in tests, pipes, or non-interactive shells).

```ts
const info = await Chafa.detect();
const chafa = new Chafa({
    pixelMode: info.pixelMode,
    cellW: info.cellW || 8,
    cellH: info.cellH || 16,
    canvasMode: info.canvasMode,
    termW: info.termW || 80,
    termH: info.termH || 24,
});
```

#### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `timeoutMs` | `number` | `300` |

#### Returns

`Promise`\<`TerminalInfo`\>

***

### setThreads()

```ts
static setThreads(n): void;
```

Defined in: [index.ts:1185](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L1185)

Set the number of worker threads chafa's internal batch processors
may spawn (per-process global). Defaults to the CPU count. Lower it
when many renderer processes/workers run in parallel to avoid
oversubscription (the tuner uses this).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `n` | `number` |

#### Returns

`void`

***

### supportedFeatures()

```ts
static supportedFeatures(): string;
```

Defined in: [index.ts:1174](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L1174)

Get a human-readable string of supported CPU features
(e.g. "POPCNT"). Requires NAPI or FFI native addon.

#### Returns

`string`
