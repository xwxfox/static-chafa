# Interface: ChafaConfig

Defined in: [types.ts:154](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L154)

Full chafa canvas configuration.

 Maps directly to chafa's `ChafaCanvasConfig` setters.
 All fields are optional when passed to the `Chafa` constructor or
 `updateConfig()` - unspecified fields retain their current value.

## Properties

| Property | Type | Description | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="alphathreshold"></a> `alphaThreshold` | `number` | Alpha threshold (0–255). Pixels with alpha below this are transparent. Default: 127 | [types.ts:185](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L185) |
| <a id="bgcolor"></a> `bgColor` | `number` | Background color (0xRRGGBB). -1 for transparent. Default: 0x000000 | [types.ts:181](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L181) |
| <a id="canvasmode"></a> `canvasMode` | `number` | Color mode for output. See [CanvasMode](../variables/CanvasMode.md). Default: TRUECOLOR | [types.ts:171](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L171) |
| <a id="cellh"></a> `cellH` | `number` | Character cell height in pixels. Used for pixel-mode canvas sizing (ignored in symbol mode). Default: 16 (typical 1:2 font aspect) | [types.ts:164](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L164) |
| <a id="cellw"></a> `cellW` | `number` | Character cell width in pixels. Used for pixel-mode canvas sizing (ignored in symbol mode). Default: 8 | [types.ts:161](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L161) |
| <a id="colorextractor"></a> `colorExtractor` | `number` | Color extraction method. See [ColorExtractor](../variables/ColorExtractor.md). Default: AVERAGE | [types.ts:175](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L175) |
| <a id="colorspace"></a> `colorSpace` | `number` | Color distance space. See [ColorSpace](../variables/ColorSpace.md). Default: RGB | [types.ts:177](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L177) |
| <a id="dithergrainh"></a> `ditherGrainH` | `number` | Dither grain height in pixels. Default: 4 | [types.ts:189](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L189) |
| <a id="dithergrainw"></a> `ditherGrainW` | `number` | Dither grain width in pixels. Default: 4 | [types.ts:187](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L187) |
| <a id="ditherintensity"></a> `ditherIntensity` | `number` | Dither intensity multiplier. Typical range 0.0–2.0. Default: 1.0 | [types.ts:191](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L191) |
| <a id="dithermode"></a> `ditherMode` | `number` | Dithering mode. See [DitherMode](../variables/DitherMode.md). Default: NONE | [types.ts:169](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L169) |
| <a id="fgcolor"></a> `fgColor` | `number` | Foreground color (0xRRGGBB). -1 for transparent. Default: 0xFFFFFF | [types.ts:183](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L183) |
| <a id="fgonly"></a> `fgOnly` | `number` | Foreground-only mode. When 1, only foreground color is drawn. Default: 0 | [types.ts:193](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L193) |
| <a id="fillsymbols"></a> `fillSymbols` | `string` | Chafa CLI selector string for the fill symbol map (used for solid areas). Empty string = chafa defaults. | [types.ts:218](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L218) |
| <a id="maxframes"></a> `maxFrames` | `number` | Max animation frames to decode. -1 = all frames. Default: -1 | [types.ts:209](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L209) |
| <a id="optimizations"></a> `optimizations` | `number` | Output optimization flags bitmask. 0x7fffffff = all optimizations enabled. Default: 0x7fffffff | [types.ts:195](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L195) |
| <a id="passthrough"></a> `passthrough` | `number` | Passthrough guard for multiplexers. See [Passthrough](../variables/Passthrough.md). Default: NONE | [types.ts:197](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L197) |
| <a id="pixelfit"></a> `pixelFit` | `number` | Pixel-mode fit strategy. See [PixelFit](../variables/PixelFit.md). Default: SCALE | [types.ts:199](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L199) |
| <a id="pixelmode"></a> `pixelMode` | `number` | Pixel rendering mode. See [PixelMode](../variables/PixelMode.md). Default: SYMBOLS | [types.ts:179](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L179) |
| <a id="preprocessing"></a> `preprocessing` | `number` | Enable auto contrast/brightness preprocessing. 0=off, 1=on. Default: 0 | [types.ts:173](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L173) |
| <a id="speed"></a> `speed` | `number` | Animation playback speed multiplier. 1.0 = native speed. Default: 1.0 | [types.ts:211](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L211) |
| <a id="swsscale"></a> `swsScale` | `number` | FFmpeg swscale filter for YUV->RGBA video decode. See [SwsScale](../variables/SwsScale.md). Default: AUTO | [types.ts:207](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L207) |
| <a id="symbols"></a> `symbols` | `string` | Chafa CLI selector string for the primary symbol map. Example: `"block+border+space-wide"`. Empty string = chafa defaults. See chafa man page for tag names. | [types.ts:215](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L215) |
| <a id="termh"></a> `termH` | `number` | Canvas height in character cells (rows). Default: 24 | [types.ts:158](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L158) |
| <a id="termw"></a> `termW` | `number` | Canvas width in character cells (columns). Default: 80 | [types.ts:156](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L156) |
| <a id="videoincludeaudio"></a> `videoIncludeAudio` | `number` | Decode video audio into per-frame PCM samples (interleaved float). 0 = discard audio entirely (default, saves CPU/memory). 1 = decode audio; `video.nextFrame().audio` returns the frame's samples. | [types.ts:203](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L203) |
| <a id="videothreads"></a> `videoThreads` | `number` | FFmpeg video decoder thread count. 0 = auto (FFmpeg picks). Default: 0 | [types.ts:205](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L205) |
| <a id="workfactor"></a> `workFactor` | `number` | Quality/speed tradeoff (0.0–1.0). 0.0 = fastest, 1.0 = best quality. Chafa CLI defaults to 0.5; our default is 0.0 for speed. | [types.ts:167](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L167) |
