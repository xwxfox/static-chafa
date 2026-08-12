# Interface: ChafaConfig

Defined in: [types.ts:115](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/types.ts#L115)

Full chafa canvas configuration.

 Maps directly to chafa's `ChafaCanvasConfig` setters.
 All fields are optional when passed to the `Chafa` constructor or
 `updateConfig()` - unspecified fields retain their current value.

## Properties

| Property | Type | Description | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="alphathreshold"></a> `alphaThreshold` | `number` | Alpha threshold (0–255). Pixels with alpha below this are transparent. Default: 127 | [types.ts:144](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/types.ts#L144) |
| <a id="bgcolor"></a> `bgColor` | `number` | Background color (0xRRGGBB). -1 for transparent. Default: 0x000000 | [types.ts:140](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/types.ts#L140) |
| <a id="canvasmode"></a> `canvasMode` | `number` | Color mode for output. See [CanvasMode](../variables/CanvasMode). Default: TRUECOLOR | [types.ts:130](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/types.ts#L130) |
| <a id="cellh"></a> `cellH` | `number` | Character cell height in pixels. Controls font aspect ratio. Default: 8 | [types.ts:123](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/types.ts#L123) |
| <a id="cellw"></a> `cellW` | `number` | Character cell width in pixels. Controls font aspect ratio. Default: 8 | [types.ts:121](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/types.ts#L121) |
| <a id="colorextractor"></a> `colorExtractor` | `number` | Color extraction method. See [ColorExtractor](../variables/ColorExtractor). Default: AVERAGE | [types.ts:134](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/types.ts#L134) |
| <a id="colorspace"></a> `colorSpace` | `number` | Color distance space. See [ColorSpace](../variables/ColorSpace). Default: RGB | [types.ts:136](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/types.ts#L136) |
| <a id="dithergrainh"></a> `ditherGrainH` | `number` | Dither grain height in pixels. Default: 4 | [types.ts:148](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/types.ts#L148) |
| <a id="dithergrainw"></a> `ditherGrainW` | `number` | Dither grain width in pixels. Default: 4 | [types.ts:146](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/types.ts#L146) |
| <a id="ditherintensity"></a> `ditherIntensity` | `number` | Dither intensity multiplier. Typical range 0.0–2.0. Default: 1.0 | [types.ts:150](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/types.ts#L150) |
| <a id="dithermode"></a> `ditherMode` | `number` | Dithering mode. See [DitherMode](../variables/DitherMode). Default: NONE | [types.ts:128](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/types.ts#L128) |
| <a id="fgcolor"></a> `fgColor` | `number` | Foreground color (0xRRGGBB). -1 for transparent. Default: 0xFFFFFF | [types.ts:142](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/types.ts#L142) |
| <a id="fgonly"></a> `fgOnly` | `number` | Foreground-only mode. When 1, only foreground color is drawn. Default: 0 | [types.ts:152](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/types.ts#L152) |
| <a id="fillsymbols"></a> `fillSymbols` | `string` | Chafa CLI selector string for the fill symbol map (used for solid areas). Empty string = chafa defaults. | [types.ts:167](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/types.ts#L167) |
| <a id="maxframes"></a> `maxFrames` | `number` | Max animation frames to decode. -1 = all frames. Default: -1 | [types.ts:158](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/types.ts#L158) |
| <a id="optimizations"></a> `optimizations` | `number` | Output optimization flags bitmask. 0x7fffffff = all optimizations enabled. Default: 0x7fffffff | [types.ts:154](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/types.ts#L154) |
| <a id="passthrough"></a> `passthrough` | `number` | Passthrough guard for multiplexers. See [Passthrough](../variables/Passthrough). Default: NONE | [types.ts:156](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/types.ts#L156) |
| <a id="pixelmode"></a> `pixelMode` | `number` | Pixel rendering mode. See [PixelMode](../variables/PixelMode). Default: SYMBOLS | [types.ts:138](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/types.ts#L138) |
| <a id="preprocessing"></a> `preprocessing` | `number` | Enable auto contrast/brightness preprocessing. 0=off, 1=on. Default: 0 | [types.ts:132](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/types.ts#L132) |
| <a id="speed"></a> `speed` | `number` | Animation playback speed multiplier. 1.0 = native speed. Default: 1.0 | [types.ts:160](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/types.ts#L160) |
| <a id="symbols"></a> `symbols` | `string` | Chafa CLI selector string for the primary symbol map. Example: `"block+border+space-wide"`. Empty string = chafa defaults. See chafa man page for tag names. | [types.ts:164](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/types.ts#L164) |
| <a id="termh"></a> `termH` | `number` | Canvas height in character cells (rows). Default: 24 | [types.ts:119](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/types.ts#L119) |
| <a id="termw"></a> `termW` | `number` | Canvas width in character cells (columns). Default: 80 | [types.ts:117](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/types.ts#L117) |
| <a id="workfactor"></a> `workFactor` | `number` | Quality/speed tradeoff (0.0–1.0). 0.0 = fastest, 1.0 = best quality. Chafa CLI defaults to 0.5; our default is 0.0 for speed. | [types.ts:126](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/types.ts#L126) |
