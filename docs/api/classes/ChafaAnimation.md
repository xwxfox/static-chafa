# Class: ChafaAnimation

Defined in: [index.ts:162](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L162)

Plays animated GIF or WebP images frame-by-frame.

Created by `chafa.openAnimation(buffer)`. Supports `using` for
automatic cleanup at end of scope. Works in every pixel mode
(symbols, sixels, kitty, iterm2) - `play()` renders frames with the
owning instance's config (pixel mode, fit, size), so output fills the
terminal out of the box.

```ts
const anim = chafa.openAnimation(gifBuf);
anim.loop = true;
anim.onFrame((frame) => process.stdout.write(frame.ansi!));
anim.play();          // internal timer honors per-frame delays
// ...
anim.pause();         // freeze on the current frame
anim.goto(10);        // jump to frame 10
anim.close();
```

Manual stepping (`next()` + `renderFrame()`) is also fully supported.

## Constructors

### Constructor

```ts
new ChafaAnimation(
   ctx, 
   handle, 
   metrics): ChafaAnimation;
```

Defined in: [index.ts:181](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L181)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `ctx` | `number` |
| `handle` | `number` |
| `metrics` | [`CodecMetrics`](../interfaces/CodecMetrics.md) |

#### Returns

`ChafaAnimation`

## Properties

| Property | Modifier | Type | Description | Defined in |
| ------ | ------ | ------ | ------ | ------ |
| <a id="framecount"></a> `frameCount` | `readonly` | `number` | Total frames in the animation (-1 for unknown-length WebP). | [index.ts:173](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L173) |
| <a id="height"></a> `height` | `readonly` | `number` | Source image height in pixels. | [index.ts:177](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L177) |
| <a id="imageformat"></a> `imageFormat` | `readonly` | `number` | Image format (3=GIF, 4=WebP). | [index.ts:179](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L179) |
| <a id="width"></a> `width` | `readonly` | `number` | Source image width in pixels. | [index.ts:175](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L175) |

## Accessors

### loop

#### Get Signature

```ts
get loop(): boolean;
```

Defined in: [index.ts:194](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L194)

Loop mode. When enabled, playback automatically rewinds and
continues after the last frame instead of stopping.

##### Returns

`boolean`

#### Set Signature

```ts
set loop(value): void;
```

Defined in: [index.ts:197](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L197)

##### Parameters

| Parameter | Type |
| ------ | ------ |
| `value` | `boolean` |

##### Returns

`void`

***

### playing

#### Get Signature

```ts
get playing(): boolean;
```

Defined in: [index.ts:202](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L202)

Whether `play()` is currently running the internal playback timer.

##### Returns

`boolean`

## Methods

### \[dispose\]()

```ts
dispose: void;
```

Defined in: [index.ts:363](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L363)

#### Returns

`void`

#### Inherit Doc

***

### abort()

```ts
abort(): void;
```

Defined in: [index.ts:357](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L357)

Signal early termination (stops async decoders). Does not free resources.

#### Returns

`void`

***

### close()

```ts
close(): void;
```

Defined in: [index.ts:332](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L332)

Close the animation and free native resources. Stops playback.

#### Returns

`void`

***

### frameData()

```ts
frameData(frameIndex): Uint8Array<ArrayBufferLike> | null;
```

Defined in: [index.ts:265](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L265)

Raw RGBA pixels of a decoded frame (zero-copy view into the frame
pool, valid until the next anim call or `close()`). `null` when the
frame hasn't been decoded yet. Used by the tuning harness for
ground-truth comparisons.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `frameIndex` | `number` |

#### Returns

`Uint8Array`\<`ArrayBufferLike`\> \| `null`

***

### goto()

```ts
goto(frameIndex): 
  | {
  ansi: string;
  frameIndex: number;
  metrics: CodecMetrics;
}
  | null;
```

Defined in: [index.ts:278](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L278)

Jump to an absolute frame index. Emits an `onFrame` event with the
rendered frame. Stops `play()` timing (playback resumes from the
new position if still playing).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `frameIndex` | `number` |

#### Returns

  \| \{
  `ansi`: `string`;
  `frameIndex`: `number`;
  `metrics`: [`CodecMetrics`](../interfaces/CodecMetrics.md);
\}
  \| `null`

The jumped-to frame info + ansi, or `null` on invalid index.

***

### info()

```ts
info(): {
  frameCount: number;
  height: number;
  imageFormat: number;
  listeners: number;
  loop: boolean;
  playing: boolean;
  width: number;
};
```

Defined in: [index.ts:344](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L344)

Debug / perf snapshot: format, dimensions, frame count, playback
state, and listener count.

#### Returns

```ts
{
  frameCount: number;
  height: number;
  imageFormat: number;
  listeners: number;
  loop: boolean;
  playing: boolean;
  width: number;
}
```

| Name | Type | Defined in |
| ------ | ------ | ------ |
| `frameCount` | `number` | [index.ts:344](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L344) |
| `height` | `number` | [index.ts:344](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L344) |
| `imageFormat` | `number` | [index.ts:344](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L344) |
| `listeners` | `number` | [index.ts:344](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L344) |
| `loop` | `boolean` | [index.ts:344](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L344) |
| `playing` | `boolean` | [index.ts:344](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L344) |
| `width` | `number` | [index.ts:344](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L344) |

***

### next()

```ts
next(): AnimFrame | null;
```

Defined in: [index.ts:232](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L232)

Advance to the next frame. Emits an `onFrame` event.

#### Returns

[`AnimFrame`](../interfaces/AnimFrame.md) \| `null`

Frame info or `null` when playback ends (or, with `loop`
  enabled, `null` only if rewind fails).

***

### onFrame()

```ts
onFrame(listener): () => void;
```

Defined in: [index.ts:211](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L211)

Register a listener for frame events. Fires whenever a frame
becomes current via `next()`, `play()` ticks, or `goto()`.
Returns an unsubscribe function.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `listener` | (`frame`) => `void` |

#### Returns

() => `void`

***

### pause()

```ts
pause(): void;
```

Defined in: [index.ts:323](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L323)

Pause automatic playback. The current frame stays on screen.

#### Returns

`void`

***

### play()

```ts
play(): void;
```

Defined in: [index.ts:316](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L316)

Start (or resume) automatic playback. Frames advance on an internal
timer honoring each frame's delay and render through the owning
instance's config (pixel mode aware), emitting `onFrame` events.

#### Returns

`void`

***

### renderFrame()

```ts
renderFrame(frameIndex): RenderResult;
```

Defined in: [index.ts:248](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L248)

Render a specific frame to ANSI terminal art.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `frameIndex` | `number` | Zero-based frame index (from `next().frameIndex`). |

#### Returns

[`RenderResult`](../interfaces/RenderResult.md)

***

### rewind()

```ts
rewind(): void;
```

Defined in: [index.ts:254](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L254)

Rewind playback to the first frame.

#### Returns

`void`
