# Interface: MatrixResult

Defined in: [types.ts:286](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L286)

Returned by [Chafa.renderMatrix](../classes/Chafa.md#rendermatrix) and [Chafa.renderMatrixRgba](../classes/Chafa.md#rendermatrixrgba).

## Properties

| Property | Type | Description | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="matrix"></a> `matrix` | `string` | JSON-encoded 2D cell grid: `[[[charCode, fg, bg], ...], ...]` | [types.ts:288](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L288) |
| <a id="metrics"></a> `metrics` | [`CodecMetrics`](CodecMetrics.md) | Timing and metadata | [types.ts:290](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L290) |
