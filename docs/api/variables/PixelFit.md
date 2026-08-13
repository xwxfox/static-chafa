# Variable: PixelFit

```ts
const PixelFit: {
  NONE: 0;
  SCALE: 1;
};
```

Defined in: [types.ts:139](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L139)

Pixel-mode size fitting strategy.

 Controls how source pixels are matched to the terminal area in
 pixel modes (SIXELS, KITTY, ITERM2). Ignored in symbol mode.

 In pixel modes the target pixel area is `termW × cellW` by
 `termH × cellH` (default cells 8×16, matching a typical 1:2 font
 aspect, so the output fills the same area as symbol mode).

 - `NONE` (0) - Hand source pixels to chafa unchanged. Chafa's
   internal scaler fills the target area. Equivalent to letting
   chafa do everything (its CLI behavior).
 - `SCALE` (1) - Pre-scale the source pixels to the target area
   (aspect-preserving fit, centered) before handing them to chafa.
   Chafa then draws 1:1 with no resampling work. Default.
   For video, frames are decoded directly at the target size,
   making this effectively free.

## Type Declaration

| Name | Type | Default value | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="property-none"></a> `NONE` | `0` | `0` | [types.ts:140](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L140) |
| <a id="property-scale"></a> `SCALE` | `1` | `1` | [types.ts:141](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L141) |
