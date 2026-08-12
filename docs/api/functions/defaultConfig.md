# Function: defaultConfig()

```ts
function defaultConfig(): ChafaConfig;
```

Defined in: [types.ts:270](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/types.ts#L270)

Returns a fresh default config object.

 Defaults are tuned for speed (workFactor=0.0, no preprocessing).
 For higher quality matching chafa CLI defaults, override:
 `{ workFactor: 0.5, preprocessing: 1 }`.

## Returns

[`ChafaConfig`](../interfaces/ChafaConfig)
