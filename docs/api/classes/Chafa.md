# Class: Chafa

Defined in: [index.ts:316](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L316)

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

Defined in: [index.ts:329](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L329)

Create a new chafa instance.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `config?` | `Partial`\<[`ChafaConfig`](../interfaces/ChafaConfig)\> | Partial config overrides. Unspecified fields use [defaultConfig](../functions/defaultConfig). |

#### Returns

`Chafa`

## Accessors

### config

#### Get Signature

```ts
get config(): Readonly<ChafaConfig>;
```

Defined in: [index.ts:340](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L340)

Read-only snapshot of the current effective configuration.
Use `updateConfig()` to change settings.

##### Returns

`Readonly`\<[`ChafaConfig`](../interfaces/ChafaConfig)\>

## Methods

### \[dispose\]()

```ts
dispose: void;
```

Defined in: [index.ts:499](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L499)

#### Returns

`void`

#### Inherit Doc

***

### decode()

```ts
decode(data): ChafaImage;
```

Defined in: [index.ts:375](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L375)

Decode any supported image format to raw RGBA pixels.

Useful for pre-decoding an image once then rendering multiple times
with different configs via `renderRgba()`.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `data` | `Uint8Array`\<`ArrayBufferLike`\> \| `Buffer`\<`ArrayBufferLike`\> | Encoded image bytes (PNG, JPEG, BMP, GIF, WebP). |

#### Returns

[`ChafaImage`](ChafaImage)

A [ChafaImage](ChafaImage) holding the decoded pixels and metadata.

***

### destroy()

```ts
destroy(): void;
```

Defined in: [index.ts:492](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L492)

Free all native resources (canvas, pending animations).
After calling this, the instance is permanently unusable.

Called automatically when the instance is garbage collected (NAPI path)
or at end of `using` scope.

#### Returns

`void`

***

### openAnimation()

```ts
openAnimation(data): ChafaAnimation;
```

Defined in: [index.ts:457](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L457)

Open an animated GIF or WebP image for frame-by-frame playback.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `data` | `Uint8Array`\<`ArrayBufferLike`\> \| `Buffer`\<`ArrayBufferLike`\> | Encoded image bytes. |

#### Returns

[`ChafaAnimation`](ChafaAnimation)

A [ChafaAnimation](ChafaAnimation) instance for controlling playback.

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

Defined in: [index.ts:474](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L474)

Open a video file (MP4, MKV, WebM, AVI, etc.) for frame-by-frame decode.

Requires FFmpeg shared libraries installed on the system.
Throws a descriptive error if FFmpeg is not found.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `data` | `Uint8Array`\<`ArrayBufferLike`\> \| `Buffer`\<`ArrayBufferLike`\> | Video file bytes. |
| `decodeW?` | `number` | Target decode width (0 = native resolution). |
| `decodeH?` | `number` | Target decode height (0 = native resolution). |

#### Returns

[`ChafaVideo`](ChafaVideo)

A [ChafaVideo](ChafaVideo) instance for frame iteration.

***

### render()

```ts
render(data): RenderResult;
```

Defined in: [index.ts:389](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L389)

Render any supported image to ANSI terminal art in a single call.

This is the simplest path: decode + draw + build ANSI string.
For repeated renders of the same image, prefer `decode()` then `renderRgba()`.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `data` | `Uint8Array`\<`ArrayBufferLike`\> \| `Buffer`\<`ArrayBufferLike`\> | Encoded image bytes. |

#### Returns

[`RenderResult`](../interfaces/RenderResult)

ANSI string and detailed timing/metrics.

***

### renderMatrix()

```ts
renderMatrix(data): MatrixResult;
```

Defined in: [index.ts:420](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L420)

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

[`MatrixResult`](../interfaces/MatrixResult)

JSON matrix string and metrics.

***

### renderMatrixRgba()

```ts
renderMatrixRgba(
   rgba, 
   width, 
   height): MatrixResult;
```

Defined in: [index.ts:432](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L432)

Render pre-decoded RGBA pixels to a character cell matrix.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `rgba` | `Uint8Array` | RGBA pixel buffer. |
| `width` | `number` | Image width in pixels. |
| `height` | `number` | Image height in pixels. |

#### Returns

[`MatrixResult`](../interfaces/MatrixResult)

JSON matrix string and metrics.

***

### renderRgba()

```ts
renderRgba(
   rgba, 
   width, 
   height): RenderResult;
```

Defined in: [index.ts:404](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L404)

Render pre-decoded RGBA pixels to ANSI terminal art.

Bypasses the decode step - use when you already have a `ChafaImage` from `decode()`.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `rgba` | `Uint8Array` | RGBA pixel buffer (8 bits per channel, unassociated alpha). |
| `width` | `number` | Image width in pixels. |
| `height` | `number` | Image height in pixels. |

#### Returns

[`RenderResult`](../interfaces/RenderResult)

ANSI string and detailed timing/metrics.

***

### updateConfig()

```ts
updateConfig(config): void;
```

Defined in: [index.ts:359](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L359)

Update one or more configuration fields.
Invalidates the internal canvas so the next render picks up new settings.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `config` | `Partial`\<[`ChafaConfig`](../interfaces/ChafaConfig)\> | Fields to update. Omitted fields keep their current value. |

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

Defined in: [index.ts:602](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L602)

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

Defined in: [index.ts:528](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L528)

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

### supportedFeatures()

```ts
static supportedFeatures(): string;
```

Defined in: [index.ts:514](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L514)

Get a human-readable string of supported CPU features
(e.g. "POPCNT"). Requires NAPI or FFI native addon.

#### Returns

`string`
