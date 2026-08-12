# Class: ChafaAnimation

Defined in: [index.ts:140](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L140)

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

Defined in: [index.ts:154](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L154)

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
| <a id="framecount"></a> `frameCount` | `readonly` | `number` | Total frames in the animation (-1 for unknown-length WebP). | [index.ts:146](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L146) |
| <a id="height"></a> `height` | `readonly` | `number` | Source image height in pixels. | [index.ts:150](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L150) |
| <a id="imageformat"></a> `imageFormat` | `readonly` | `number` | Image format (3=GIF, 4=WebP). | [index.ts:152](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L152) |
| <a id="width"></a> `width` | `readonly` | `number` | Source image width in pixels. | [index.ts:148](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L148) |

## Methods

### \[dispose\]()

```ts
dispose: void;
```

Defined in: [index.ts:201](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L201)

#### Returns

`void`

#### Inherit Doc

***

### abort()

```ts
abort(): void;
```

Defined in: [index.ts:195](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L195)

Signal early termination (stops async decoders). Does not free resources.

#### Returns

`void`

***

### close()

```ts
close(): void;
```

Defined in: [index.ts:188](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L188)

Close the animation and free native resources.

#### Returns

`void`

***

### next()

```ts
next(): AnimFrame | null;
```

Defined in: [index.ts:167](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L167)

Advance to the next frame.

#### Returns

[`AnimFrame`](../interfaces/AnimFrame) \| `null`

Frame info or `null` when playback ends.

***

### renderFrame()

```ts
renderFrame(frameIndex): RenderResult;
```

Defined in: [index.ts:176](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L176)

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

Defined in: [index.ts:182](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L182)

Rewind playback to the first frame.

#### Returns

`void`
