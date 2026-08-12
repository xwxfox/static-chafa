# Interface: ChafaImageData

Defined in: [types.ts:247](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/types.ts#L247)

Raw decoded image data returned by [Chafa.decode](../classes/Chafa.md#decode).

## Properties

| Property | Type | Description | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="height"></a> `height` | `number` | Image height in pixels | [types.ts:253](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/types.ts#L253) |
| <a id="metrics"></a> `metrics` | [`CodecMetrics`](CodecMetrics) | Decode metrics | [types.ts:257](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/types.ts#L257) |
| <a id="rgba"></a> `rgba` | `Uint8Array` | RGBA pixel buffer (8 bits per channel, unassociated alpha) | [types.ts:249](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/types.ts#L249) |
| <a id="stride"></a> `stride` | `number` | Row stride in bytes (width × 4) | [types.ts:255](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/types.ts#L255) |
| <a id="width"></a> `width` | `number` | Image width in pixels | [types.ts:251](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/types.ts#L251) |
