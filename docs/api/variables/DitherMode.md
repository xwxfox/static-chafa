# Variable: DitherMode

```ts
const DitherMode: {
  DIFFUSION: 2;
  NOISE: 3;
  NONE: 0;
  ORDERED: 1;
};
```

Defined in: [types.ts:66](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/types.ts#L66)

Chafa dithering modes.

 - `NONE` (0) - No dithering.
 - `ORDERED` (1) - Bayer-style ordered dithering. Fast, predictable.
 - `DIFFUSION` (2) - Error-diffusion dithering (Floyd-Steinberg). Smooth, slower.
 - `NOISE` (3) - Blue-noise dithering. Good at low color counts, moderate perf.

## Type Declaration

| Name | Type | Default value | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="property-diffusion"></a> `DIFFUSION` | `2` | `2` | [types.ts:69](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/types.ts#L69) |
| <a id="property-noise"></a> `NOISE` | `3` | `3` | [types.ts:70](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/types.ts#L70) |
| <a id="property-none"></a> `NONE` | `0` | `0` | [types.ts:67](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/types.ts#L67) |
| <a id="property-ordered"></a> `ORDERED` | `1` | `1` | [types.ts:68](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/types.ts#L68) |
