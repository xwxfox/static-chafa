# Function: defaultConfig()

```ts
function defaultConfig(): ChafaConfig;
```

Defined in: [types.ts:396](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L396)

Returns a fresh default config object.

 Defaults are tuned for speed (workFactor=0.0, no preprocessing).
 For higher quality matching chafa CLI defaults, override:
 `{ workFactor: 0.5, preprocessing: 1 }`.

 In pixel modes the canvas pixel area is `termW × cellW` by
 `termH × cellH` (80×24 -> 640×384 by default), so output fills
 the same terminal area as symbol mode.

## Returns

[`ChafaConfig`](../interfaces/ChafaConfig.md)
