# Variable: SwsScale

```ts
const SwsScale: {
  AREA: 3;
  AUTO: 0;
  BILINEAR: 1;
  FAST_BILINEAR: 4;
  POINT: 2;
};
```

Defined in: [types.ts:113](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L113)

FFmpeg swscale conversion flags for video decode.

 - `AUTO` (0) - FAST_BILINEAR when downscaling, BILINEAR otherwise (default)
 - `BILINEAR` (1) - Quality bilinear filtering
 - `POINT` (2) - Nearest-neighbor. Fastest, blocky
 - `AREA` (3) - Area averaging. Good for large downscales, slower
 - `FAST_BILINEAR` (4) - Faster bilinear approximation

## Type Declaration

| Name | Type | Default value | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="property-area"></a> `AREA` | `3` | `3` | [types.ts:117](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L117) |
| <a id="property-auto"></a> `AUTO` | `0` | `0` | [types.ts:114](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L114) |
| <a id="property-bilinear"></a> `BILINEAR` | `1` | `1` | [types.ts:115](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L115) |
| <a id="property-fast_bilinear"></a> `FAST_BILINEAR` | `4` | `4` | [types.ts:118](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L118) |
| <a id="property-point"></a> `POINT` | `2` | `2` | [types.ts:116](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L116) |
