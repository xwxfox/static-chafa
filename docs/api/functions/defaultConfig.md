# Function: defaultConfig()

```ts
function defaultConfig(): ChafaConfig;
```

Defined in: [types.ts:286](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/types.ts#L286)

Returns a fresh default config object.

 Defaults are tuned for speed (workFactor=0.0, no preprocessing).
 For higher quality matching chafa CLI defaults, override:
 `{ workFactor: 0.5, preprocessing: 1 }`.

## Returns

[`ChafaConfig`](../interfaces/ChafaConfig)
