# Function: defaultConfig()

```ts
function defaultConfig(): ChafaConfig;
```

Defined in: [types.ts:270](https://github.com/xwxfox/chafa-ts-multirt/blob/d8b56995c1cfccf66d00c2bdf2426975f026db0a/src/types.ts#L270)

Returns a fresh default config object.

 Defaults are tuned for speed (workFactor=0.0, no preprocessing).
 For higher quality matching chafa CLI defaults, override:
 `{ workFactor: 0.5, preprocessing: 1 }`.

## Returns

[`ChafaConfig`](../interfaces/ChafaConfig)
