# Interface: MatrixResult

Defined in: [types.ts:231](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/types.ts#L231)

Returned by [Chafa.renderMatrix](../classes/Chafa.md#rendermatrix) and [Chafa.renderMatrixRgba](../classes/Chafa.md#rendermatrixrgba).

## Properties

| Property | Type | Description | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="matrix"></a> `matrix` | `string` | JSON-encoded 2D cell grid: `[[[charCode, fg, bg], ...], ...]` | [types.ts:233](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/types.ts#L233) |
| <a id="metrics"></a> `metrics` | [`CodecMetrics`](CodecMetrics) | Timing and metadata | [types.ts:235](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/types.ts#L235) |
