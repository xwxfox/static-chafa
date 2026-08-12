# Variable: Passthrough

```ts
const Passthrough: {
  NONE: 0;
  SCREEN: 1;
  TMUX: 2;
};
```

Defined in: [types.ts:99](https://github.com/xwxfox/chafa-ts-multirt/blob/d8b56995c1cfccf66d00c2bdf2426975f026db0a/src/types.ts#L99)

Protocol passthrough guards for multiplexers.

 - `NONE` (0) - No wrapping. Works in most terminals.
 - `SCREEN` (1) - Wrap output for GNU Screen compatibility.
 - `TMUX` (2) - Wrap output for tmux compatibility.

## Type Declaration

| Name | Type | Default value | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="property-none"></a> `NONE` | `0` | `0` | [types.ts:100](https://github.com/xwxfox/chafa-ts-multirt/blob/d8b56995c1cfccf66d00c2bdf2426975f026db0a/src/types.ts#L100) |
| <a id="property-screen"></a> `SCREEN` | `1` | `1` | [types.ts:101](https://github.com/xwxfox/chafa-ts-multirt/blob/d8b56995c1cfccf66d00c2bdf2426975f026db0a/src/types.ts#L101) |
| <a id="property-tmux"></a> `TMUX` | `2` | `2` | [types.ts:102](https://github.com/xwxfox/chafa-ts-multirt/blob/d8b56995c1cfccf66d00c2bdf2426975f026db0a/src/types.ts#L102) |
