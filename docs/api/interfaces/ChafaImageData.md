# Interface: ChafaImageData

Defined in: [types.ts:344](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L344)

Raw decoded image data returned by [Chafa.decode](../classes/Chafa.md#decode).

## Properties

| Property | Type | Description | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="height"></a> `height` | `number` | Image height in pixels | [types.ts:350](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L350) |
| <a id="metrics"></a> `metrics` | [`CodecMetrics`](CodecMetrics.md) | Decode metrics | [types.ts:354](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L354) |
| <a id="rgba"></a> `rgba` | `Uint8Array` | RGBA pixel buffer (8 bits per channel, unassociated alpha) | [types.ts:346](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L346) |
| <a id="stride"></a> `stride` | `number` | Row stride in bytes (width × 4) | [types.ts:352](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L352) |
| <a id="width"></a> `width` | `number` | Image width in pixels | [types.ts:348](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L348) |
