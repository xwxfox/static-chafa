# Class: ChafaVideo

Defined in: [index.ts:386](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L386)

Decodes and plays MP4/MKV/WebM/AVI videos frame-by-frame via FFmpeg.

Created by `chafa.openVideo(buffer)`. Requires FFmpeg shared libraries
installed on the system (throws a descriptive error if not found).

Videos are decoded to RGBA at a configurable target resolution (the
pixel-fit size by default) and stored in an 8-frame ring buffer for
smooth playback. Frames are zero-copy views into the ring buffer
(valid until the next call).

Set `videoIncludeAudio: 1` in the config to also decode audio - each
frame then carries interleaved float32 PCM covering its timespan.

## Constructors

### Constructor

```ts
new ChafaVideo(
   ctx, 
   handle, 
   info, 
   owner): ChafaVideo;
```

Defined in: [index.ts:411](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L411)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `ctx` | `number` |
| `handle` | `number` |
| `info` | `any` |
| `owner` | [`Chafa`](Chafa.md) |

#### Returns

`ChafaVideo`

## Properties

| Property | Modifier | Type | Description | Defined in |
| ------ | ------ | ------ | ------ | ------ |
| <a id="audiochannels"></a> `audioChannels` | `readonly` | `number` | Audio channel count. 0 if no audio. | [index.ts:409](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L409) |
| <a id="audiocodec"></a> `audioCodec` | `readonly` | `string` | Audio codec name (e.g. "aac", "mp3"). Empty if no audio. | [index.ts:405](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L405) |
| <a id="audiosamplerate"></a> `audioSampleRate` | `readonly` | `number` | Audio sample rate in Hz. 0 if no audio. | [index.ts:407](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L407) |
| <a id="durationsec"></a> `durationSec` | `readonly` | `number` | Duration in seconds. | [index.ts:399](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L399) |
| <a id="fps"></a> `fps` | `readonly` | `number` | Frames per second. | [index.ts:401](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L401) |
| <a id="hasaudio"></a> `hasAudio` | `readonly` | `boolean` | Whether the video contains an audio track. | [index.ts:403](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L403) |
| <a id="height"></a> `height` | `readonly` | `number` | Native video height in pixels. | [index.ts:397](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L397) |
| <a id="width"></a> `width` | `readonly` | `number` | Native video width in pixels. | [index.ts:395](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L395) |

## Accessors

### playing

#### Get Signature

```ts
get playing(): boolean;
```

Defined in: [index.ts:426](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L426)

Whether `play()` is running the internal playback loop.

##### Returns

`boolean`

## Methods

### \[asyncIterator\]()

```ts
asyncIterator: AsyncGenerator<VideoFrame>;
```

Defined in: [index.ts:491](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L491)

Async iterator over decoded frames (yields as fast as decode
allows). Each yielded frame is the same object as `nextFrame()`
would return (zero-copy, valid until the next call).

```ts
for await (const frame of video) {
    process.stdout.write(chafa.renderRgba(frame.rgba, frame.width, frame.height).ansi);
}
```

#### Returns

`AsyncGenerator`\<[`VideoFrame`](../interfaces/VideoFrame.md)\>

***

### \[dispose\]()

```ts
dispose: void;
```

Defined in: [index.ts:601](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L601)

#### Returns

`void`

#### Inherit Doc

***

### close()

```ts
close(): void;
```

Defined in: [index.ts:565](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L565)

Close the video and free all resources. Stops playback.

#### Returns

`void`

***

### goto()

```ts
goto(timeSec): VideoFrame | null;
```

Defined in: [index.ts:510](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L510)

Jump to the given time and return the first decoded frame at/after
it. Emits an `onFrame` event.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `timeSec` | `number` |

#### Returns

[`VideoFrame`](../interfaces/VideoFrame.md) \| `null`

***

### info()

```ts
info(): {
  audioChannels: number;
  audioCodec: string;
  audioSampleRate: number;
  durationSec: number;
  fps: number;
  hasAudio: boolean;
  height: number;
  listeners: number;
  playing: boolean;
  status: any;
  width: number;
};
```

Defined in: [index.ts:577](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L577)

Debug / perf snapshot: dimensions, duration, fps, audio track info,
playback state, and native decoder status (decode size, progress).

#### Returns

```ts
{
  audioChannels: number;
  audioCodec: string;
  audioSampleRate: number;
  durationSec: number;
  fps: number;
  hasAudio: boolean;
  height: number;
  listeners: number;
  playing: boolean;
  status: any;
  width: number;
}
```

| Name | Type | Defined in |
| ------ | ------ | ------ |
| `audioChannels` | `number` | [index.ts:579](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L579) |
| `audioCodec` | `string` | [index.ts:579](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L579) |
| `audioSampleRate` | `number` | [index.ts:579](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L579) |
| `durationSec` | `number` | [index.ts:578](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L578) |
| `fps` | `number` | [index.ts:578](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L578) |
| `hasAudio` | `boolean` | [index.ts:579](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L579) |
| `height` | `number` | [index.ts:578](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L578) |
| `listeners` | `number` | [index.ts:580](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L580) |
| `playing` | `boolean` | [index.ts:580](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L580) |
| `status` | `any` | [index.ts:581](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L581) |
| `width` | `number` | [index.ts:578](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L578) |

***

### nextFrame()

```ts
nextFrame(): VideoFrame | null;
```

Defined in: [index.ts:471](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L471)

Returns the next decoded RGBA frame, or null at end of video.
Emits an `onFrame` event.

Zero-copy: `frame.rgba` (and `frame.audio`) are views into
decoder-owned buffers. They are only valid until the next
`nextFrame()` / `seek()` / `close()` call on this video.
Copy them if you need them longer.

#### Returns

[`VideoFrame`](../interfaces/VideoFrame.md) \| `null`

***

### onFrame()

```ts
onFrame(listener): () => void;
```

Defined in: [index.ts:435](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L435)

Register a listener for frame events. Fires on every frame that
becomes current via `nextFrame()`, `play()` ticks or `goto()`.
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

Defined in: [index.ts:541](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L541)

Pause automatic playback. The current frame stays on screen.

#### Returns

`void`

***

### play()

```ts
play(speed?): void;
```

Defined in: [index.ts:533](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L533)

Start automatic playback: decodes and emits frames paced to their
presentation timestamps. Stops at the end of the video.

#### Parameters

| Parameter | Type | Default value | Description |
| ------ | ------ | ------ | ------ |
| `speed` | `number` | `1.0` | Playback speed multiplier (1.0 = native). |

#### Returns

`void`

***

### seek()

```ts
seek(timeSec): void;
```

Defined in: [index.ts:501](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L501)

Seek to the given time in seconds (nearest keyframe, clamped to
 `[0, duration]`). Equivalent to `goto()` without fetching a frame.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `timeSec` | `number` |

#### Returns

`void`

***

### thumbnail()

```ts
thumbnail(): {
  ansi: string;
  height: number;
  metrics: CodecMetrics;
  width: number;
};
```

Defined in: [index.ts:521](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L521)

Render the video's first frame (cached at open time) with the
owning instance's current config - pixel mode aware.
Useful for a poster frame / preview.

#### Returns

```ts
{
  ansi: string;
  height: number;
  metrics: CodecMetrics;
  width: number;
}
```

| Name | Type | Defined in |
| ------ | ------ | ------ |
| `ansi` | `string` | [index.ts:521](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L521) |
| `height` | `number` | [index.ts:521](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L521) |
| `metrics` | [`CodecMetrics`](../interfaces/CodecMetrics.md) | [index.ts:521](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L521) |
| `width` | `number` | [index.ts:521](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L521) |
