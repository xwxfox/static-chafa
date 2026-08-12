# Interface: CodecMetrics

Defined in: [types.ts:181](https://github.com/xwxfox/chafa-ts-multirt/blob/d8b56995c1cfccf66d00c2bdf2426975f026db0a/src/types.ts#L181)

Metrics returned with every render/decode operation.

 All times are in milliseconds on the monotonic clock.

## Properties

| Property | Type | Description | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="buildms"></a> `buildMs` | `number` | Time spent in `chafa_canvas_print` - ANSI string generation (ms) | [types.ts:187](https://github.com/xwxfox/chafa-ts-multirt/blob/d8b56995c1cfccf66d00c2bdf2426975f026db0a/src/types.ts#L187) |
| <a id="canvash"></a> `canvasH` | `number` | Canvas height in character cells | [types.ts:197](https://github.com/xwxfox/chafa-ts-multirt/blob/d8b56995c1cfccf66d00c2bdf2426975f026db0a/src/types.ts#L197) |
| <a id="canvasmode"></a> `canvasMode` | `number` | Active canvas mode. See [CanvasMode](../variables/CanvasMode) | [types.ts:211](https://github.com/xwxfox/chafa-ts-multirt/blob/d8b56995c1cfccf66d00c2bdf2426975f026db0a/src/types.ts#L211) |
| <a id="canvasph"></a> `canvasPh` | `number` | Internal canvas pixel height (canvasH × cellH for symbol mode) | [types.ts:201](https://github.com/xwxfox/chafa-ts-multirt/blob/d8b56995c1cfccf66d00c2bdf2426975f026db0a/src/types.ts#L201) |
| <a id="canvaspw"></a> `canvasPw` | `number` | Internal canvas pixel width (canvasW × cellW for symbol mode) | [types.ts:199](https://github.com/xwxfox/chafa-ts-multirt/blob/d8b56995c1cfccf66d00c2bdf2426975f026db0a/src/types.ts#L199) |
| <a id="canvasw"></a> `canvasW` | `number` | Canvas width in character cells | [types.ts:195](https://github.com/xwxfox/chafa-ts-multirt/blob/d8b56995c1cfccf66d00c2bdf2426975f026db0a/src/types.ts#L195) |
| <a id="drawms"></a> `drawMs` | `number` | Time spent in `chafa_canvas_draw_all_pixels` - scaling, symbol matching, color assignment (ms) | [types.ts:185](https://github.com/xwxfox/chafa-ts-multirt/blob/d8b56995c1cfccf66d00c2bdf2426975f026db0a/src/types.ts#L185) |
| <a id="format"></a> `format` | `number` | Image format (0=PNG, 1=JPEG, 2=BMP, 3=GIF, 4=WebP). See [FMT\_NAMES](../variables/FMT_NAMES) | [types.ts:209](https://github.com/xwxfox/chafa-ts-multirt/blob/d8b56995c1cfccf66d00c2bdf2426975f026db0a/src/types.ts#L209) |
| <a id="framecount"></a> `frameCount` | `number` | Total frame count (1 for static images, `-1` for unknown-length WebP) | [types.ts:203](https://github.com/xwxfox/chafa-ts-multirt/blob/d8b56995c1cfccf66d00c2bdf2426975f026db0a/src/types.ts#L203) |
| <a id="framedelayms"></a> `frameDelayMs` | `number` | Delay before displaying the next frame (ms) | [types.ts:205](https://github.com/xwxfox/chafa-ts-multirt/blob/d8b56995c1cfccf66d00c2bdf2426975f026db0a/src/types.ts#L205) |
| <a id="havealpha"></a> `haveAlpha` | `number` | Whether the source image contained an alpha channel (1 = yes, 0 = no) | [types.ts:215](https://github.com/xwxfox/chafa-ts-multirt/blob/d8b56995c1cfccf66d00c2bdf2426975f026db0a/src/types.ts#L215) |
| <a id="imgh"></a> `imgH` | `number` | Source image height in pixels | [types.ts:193](https://github.com/xwxfox/chafa-ts-multirt/blob/d8b56995c1cfccf66d00c2bdf2426975f026db0a/src/types.ts#L193) |
| <a id="imgw"></a> `imgW` | `number` | Source image width in pixels | [types.ts:191](https://github.com/xwxfox/chafa-ts-multirt/blob/d8b56995c1cfccf66d00c2bdf2426975f026db0a/src/types.ts#L191) |
| <a id="parsems"></a> `parseMs` | `number` | Image format detection + codec decode time (ms) | [types.ts:183](https://github.com/xwxfox/chafa-ts-multirt/blob/d8b56995c1cfccf66d00c2bdf2426975f026db0a/src/types.ts#L183) |
| <a id="pixelmode"></a> `pixelMode` | `number` | Active pixel mode. See [PixelMode](../variables/PixelMode) | [types.ts:213](https://github.com/xwxfox/chafa-ts-multirt/blob/d8b56995c1cfccf66d00c2bdf2426975f026db0a/src/types.ts#L213) |
| <a id="rgbabytes"></a> `rgbaBytes` | `number` | Size of the decoded RGBA buffer in bytes | [types.ts:207](https://github.com/xwxfox/chafa-ts-multirt/blob/d8b56995c1cfccf66d00c2bdf2426975f026db0a/src/types.ts#L207) |
| <a id="totalms"></a> `totalMs` | `number` | `parseMs + drawMs + buildMs` (ms) | [types.ts:189](https://github.com/xwxfox/chafa-ts-multirt/blob/d8b56995c1cfccf66d00c2bdf2426975f026db0a/src/types.ts#L189) |
