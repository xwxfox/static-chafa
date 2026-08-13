# Function: pixelCanvasSize()

```ts
function pixelCanvasSize(config): {
  height: number;
  width: number;
};
```

Defined in: [types.ts:431](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L431)

Target pixel dimensions for a pixel-mode config.

 Returns `{ width: termW × cellW, height: termH × cellH }` - the
 pixel area the rendered image will occupy on screen. In symbol
 mode returns the cell counts unchanged.

## Parameters

| Parameter | Type |
| ------ | ------ |
| `config` | [`ChafaConfig`](../interfaces/ChafaConfig.md) |

## Returns

```ts
{
  height: number;
  width: number;
}
```

| Name | Type | Defined in |
| ------ | ------ | ------ |
| `height` | `number` | [types.ts:431](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L431) |
| `width` | `number` | [types.ts:431](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L431) |
