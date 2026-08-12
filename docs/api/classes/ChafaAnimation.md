# Class: ChafaAnimation

Defined in: [index.ts:139](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/index.ts#L139)

Plays animated GIF or WebP images frame-by-frame.

Created by `chafa.openAnimation(buffer)`. Supports `using` for
automatic cleanup at end of scope.

```ts
const anim = chafa.openAnimation(gifBuf);
while (true) {
    const frame = anim.next();
    if (!frame) break;
    const { ansi, metrics } = anim.renderFrame(frame.frameIndex);
    process.stdout.write(ansi);
    await sleep(metrics.frameDelayMs);
}
anim.close();
```

## Constructors

### Constructor

```ts
new ChafaAnimation(
   ctx, 
   handle, 
   metrics): ChafaAnimation;
```

Defined in: [index.ts:153](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/index.ts#L153)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `ctx` | `number` |
| `handle` | `number` |
| `metrics` | [`CodecMetrics`](../interfaces/CodecMetrics) |

#### Returns

`ChafaAnimation`

## Properties

| Property | Modifier | Type | Description | Defined in |
| ------ | ------ | ------ | ------ | ------ |
| <a id="framecount"></a> `frameCount` | `readonly` | `number` | Total frames in the animation (-1 for unknown-length WebP). | [index.ts:145](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/index.ts#L145) |
| <a id="height"></a> `height` | `readonly` | `number` | Source image height in pixels. | [index.ts:149](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/index.ts#L149) |
| <a id="imageformat"></a> `imageFormat` | `readonly` | `number` | Image format (3=GIF, 4=WebP). | [index.ts:151](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/index.ts#L151) |
| <a id="width"></a> `width` | `readonly` | `number` | Source image width in pixels. | [index.ts:147](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/index.ts#L147) |

## Methods

### \[dispose\]()

```ts
dispose: void;
```

Defined in: [index.ts:200](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/index.ts#L200)

#### Returns

`void`

#### Inherit Doc

***

### abort()

```ts
abort(): void;
```

Defined in: [index.ts:194](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/index.ts#L194)

Signal early termination (stops async decoders). Does not free resources.

#### Returns

`void`

***

### close()

```ts
close(): void;
```

Defined in: [index.ts:187](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/index.ts#L187)

Close the animation and free native resources.

#### Returns

`void`

***

### next()

```ts
next(): AnimFrame | null;
```

Defined in: [index.ts:166](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/index.ts#L166)

Advance to the next frame.

#### Returns

[`AnimFrame`](../interfaces/AnimFrame) \| `null`

Frame info or `null` when playback ends.

***

### renderFrame()

```ts
renderFrame(frameIndex): RenderResult;
```

Defined in: [index.ts:175](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/index.ts#L175)

Render a specific frame to ANSI terminal art.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `frameIndex` | `number` | Zero-based frame index (from `next().frameIndex`). |

#### Returns

[`RenderResult`](../interfaces/RenderResult)

***

### rewind()

```ts
rewind(): void;
```

Defined in: [index.ts:181](https://github.com/xwxfox/chafa-ts-multirt/blob/18c481ec51b788385334241066516efe490b9d18/src/index.ts#L181)

Rewind playback to the first frame.

#### Returns

`void`
