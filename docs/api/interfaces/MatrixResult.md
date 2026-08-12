# Interface: MatrixResult

Defined in: [types.ts:231](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/types.ts#L231)

Returned by [Chafa.renderMatrix](../classes/Chafa.md#rendermatrix) and [Chafa.renderMatrixRgba](../classes/Chafa.md#rendermatrixrgba).

## Properties

| Property | Type | Description | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="matrix"></a> `matrix` | `string` | JSON-encoded 2D cell grid: `[[[charCode, fg, bg], ...], ...]` | [types.ts:233](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/types.ts#L233) |
| <a id="metrics"></a> `metrics` | [`CodecMetrics`](CodecMetrics) | Timing and metadata | [types.ts:235](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/types.ts#L235) |
