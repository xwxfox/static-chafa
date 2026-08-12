# Variable: ColorExtractor

```ts
const ColorExtractor: {
  AVERAGE: 0;
  MEDIAN: 1;
};
```

Defined in: [types.ts:78](https://github.com/xwxfox/chafa-ts-multirt/blob/d8b56995c1cfccf66d00c2bdf2426975f026db0a/src/types.ts#L78)

Chafa color extraction strategies.

 - `AVERAGE` (0) - Average color of each symbol's coverage area. Fast.
 - `MEDIAN` (1) - Median color. Better at handling outliers, slightly slower.

## Type Declaration

| Name | Type | Default value | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="property-average"></a> `AVERAGE` | `0` | `0` | [types.ts:79](https://github.com/xwxfox/chafa-ts-multirt/blob/d8b56995c1cfccf66d00c2bdf2426975f026db0a/src/types.ts#L79) |
| <a id="property-median"></a> `MEDIAN` | `1` | `1` | [types.ts:80](https://github.com/xwxfox/chafa-ts-multirt/blob/d8b56995c1cfccf66d00c2bdf2426975f026db0a/src/types.ts#L80) |
