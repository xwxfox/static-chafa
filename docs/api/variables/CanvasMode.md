# Variable: CanvasMode

```ts
const CanvasMode: {
  FGBG: 5;
  FGBG_BGFG: 4;
  INDEXED_16: 3;
  INDEXED_16_8: 7;
  INDEXED_240: 2;
  INDEXED_256: 1;
  INDEXED_8: 6;
  TRUECOLOR: 0;
};
```

Defined in: [types.ts:34](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/types.ts#L34)

Chafa canvas color modes.

 - `TRUECOLOR` (0) - 24-bit direct color. Best quality, no dithering.
 - `INDEXED_256` (1) - 256-color palette.
 - `INDEXED_240` (2) - 256-color palette minus the 16 aixterm codes (safer cross-terminal).
 - `INDEXED_16` (3) - 16 aixterm colors.
 - `FGBG_BGFG` (4) - Default FG/BG colors plus inversion.
 - `FGBG` (5) - Default FG/BG colors only. No ANSI codes emitted.
 - `INDEXED_8` (6) - 8 basic ANSI colors.
 - `INDEXED_16_8` (7) - 16 FG colors (8 via bold) and 8 BG colors.

## Type Declaration

| Name | Type | Default value | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="property-fgbg"></a> `FGBG` | `5` | `5` | [types.ts:40](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/types.ts#L40) |
| <a id="property-fgbg_bgfg"></a> `FGBG_BGFG` | `4` | `4` | [types.ts:39](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/types.ts#L39) |
| <a id="property-indexed_16"></a> `INDEXED_16` | `3` | `3` | [types.ts:38](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/types.ts#L38) |
| <a id="property-indexed_16_8"></a> `INDEXED_16_8` | `7` | `7` | [types.ts:42](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/types.ts#L42) |
| <a id="property-indexed_240"></a> `INDEXED_240` | `2` | `2` | [types.ts:37](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/types.ts#L37) |
| <a id="property-indexed_256"></a> `INDEXED_256` | `1` | `1` | [types.ts:36](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/types.ts#L36) |
| <a id="property-indexed_8"></a> `INDEXED_8` | `6` | `6` | [types.ts:41](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/types.ts#L41) |
| <a id="property-truecolor"></a> `TRUECOLOR` | `0` | `0` | [types.ts:35](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/types.ts#L35) |
