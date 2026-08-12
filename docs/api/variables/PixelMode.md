# Variable: PixelMode

```ts
const PixelMode: {
  ITERM2: 3;
  KITTY: 2;
  SIXELS: 1;
  SYMBOLS: 0;
};
```

Defined in: [types.ts:52](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/types.ts#L52)

Chafa pixel rendering modes.

 - `SYMBOLS` (0) - Unicode block characters (ANSI art). Default.
 - `SIXELS` (1) - Sixel bitmap protocol. Requires sixel-capable terminal.
 - `KITTY` (2) - Kitty terminal graphics protocol.
 - `ITERM2` (3) - iTerm2 inline image protocol.

## Type Declaration

| Name | Type | Default value | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="property-iterm2"></a> `ITERM2` | `3` | `3` | [types.ts:56](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/types.ts#L56) |
| <a id="property-kitty"></a> `KITTY` | `2` | `2` | [types.ts:55](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/types.ts#L55) |
| <a id="property-sixels"></a> `SIXELS` | `1` | `1` | [types.ts:54](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/types.ts#L54) |
| <a id="property-symbols"></a> `SYMBOLS` | `0` | `0` | [types.ts:53](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/types.ts#L53) |
