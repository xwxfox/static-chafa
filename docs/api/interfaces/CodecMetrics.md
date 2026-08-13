# Interface: CodecMetrics

Defined in: [types.ts:232](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L232)

Metrics returned with every render/decode operation.

 All times are in milliseconds on the monotonic clock.

## Properties

| Property | Type | Description | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="buildms"></a> `buildMs` | `number` | Time spent in `chafa_canvas_print` - ANSI string generation (ms) | [types.ts:238](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L238) |
| <a id="canvash"></a> `canvasH` | `number` | Canvas height in character cells | [types.ts:250](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L250) |
| <a id="canvasmode"></a> `canvasMode` | `number` | Active canvas mode. See [CanvasMode](../variables/CanvasMode.md) | [types.ts:264](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L264) |
| <a id="canvasph"></a> `canvasPh` | `number` | Internal canvas pixel height (canvasH × cellH for symbol mode) | [types.ts:254](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L254) |
| <a id="canvaspw"></a> `canvasPw` | `number` | Internal canvas pixel width (canvasW × cellW for symbol mode) | [types.ts:252](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L252) |
| <a id="canvasw"></a> `canvasW` | `number` | Canvas width in character cells | [types.ts:248](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L248) |
| <a id="drawms"></a> `drawMs` | `number` | Time spent in `chafa_canvas_draw_all_pixels` - scaling, symbol matching, color assignment (ms) | [types.ts:236](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L236) |
| <a id="format"></a> `format` | `number` | Image format (0=PNG, 1=JPEG, 2=BMP, 3=GIF, 4=WebP). See [FMT\_NAMES](../variables/FMT_NAMES.md) | [types.ts:262](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L262) |
| <a id="framecount"></a> `frameCount` | `number` | Total frame count (1 for static images, `-1` for unknown-length WebP) | [types.ts:256](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L256) |
| <a id="framedelayms"></a> `frameDelayMs` | `number` | Delay before displaying the next frame (ms) | [types.ts:258](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L258) |
| <a id="havealpha"></a> `haveAlpha` | `number` | Whether the source image contained an alpha channel (1 = yes, 0 = no) | [types.ts:270](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L270) |
| <a id="imgh"></a> `imgH` | `number` | Source image height in pixels | [types.ts:246](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L246) |
| <a id="imgw"></a> `imgW` | `number` | Source image width in pixels | [types.ts:244](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L244) |
| <a id="parsems"></a> `parseMs` | `number` | Image format detection + codec decode time (ms) | [types.ts:234](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L234) |
| <a id="pixelfit"></a> `pixelFit` | `number` | Active pixel fit strategy. See [PixelFit](../variables/PixelFit.md) | [types.ts:268](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L268) |
| <a id="pixelmode"></a> `pixelMode` | `number` | Active pixel mode. See [PixelMode](../variables/PixelMode.md) | [types.ts:266](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L266) |
| <a id="rgbabytes"></a> `rgbaBytes` | `number` | Size of the decoded RGBA buffer in bytes | [types.ts:260](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L260) |
| <a id="scalems"></a> `scaleMs` | `number` | Time spent pre-scaling pixels to the fit box (ms). 0 when no scaling happened (pixelFit NONE or already 1:1) | [types.ts:240](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L240) |
| <a id="totalms"></a> `totalMs` | `number` | `parseMs + scaleMs + drawMs + buildMs` (ms) | [types.ts:242](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L242) |
