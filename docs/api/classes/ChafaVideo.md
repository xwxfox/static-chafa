# Class: ChafaVideo

Defined in: [index.ts:220](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L220)

Decodes and plays MP4/MKV/WebM/AVI videos frame-by-frame via FFmpeg.

Created by `chafa.openVideo(buffer)`. Requires FFmpeg shared libraries
installed on the system (throws a descriptive error if not found).

Videos are decoded to RGBA at a configurable target resolution and
stored in an 8-frame ring buffer for smooth playback. Audio metadata
is tracked but audio is not decoded (future feature).

## Constructors

### Constructor

```ts
new ChafaVideo(
   ctx, 
   handle, 
   info): ChafaVideo;
```

Defined in: [index.ts:242](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L242)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `ctx` | `number` |
| `handle` | `number` |
| `info` | `any` |

#### Returns

`ChafaVideo`

## Properties

| Property | Modifier | Type | Description | Defined in |
| ------ | ------ | ------ | ------ | ------ |
| <a id="audiochannels"></a> `audioChannels` | `readonly` | `number` | Audio channel count. 0 if no audio. | [index.ts:240](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L240) |
| <a id="audiocodec"></a> `audioCodec` | `readonly` | `string` | Audio codec name (e.g. "aac", "mp3"). Empty if no audio. | [index.ts:236](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L236) |
| <a id="audiosamplerate"></a> `audioSampleRate` | `readonly` | `number` | Audio sample rate in Hz. 0 if no audio. | [index.ts:238](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L238) |
| <a id="durationsec"></a> `durationSec` | `readonly` | `number` | Duration in seconds. | [index.ts:230](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L230) |
| <a id="fps"></a> `fps` | `readonly` | `number` | Frames per second. | [index.ts:232](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L232) |
| <a id="hasaudio"></a> `hasAudio` | `readonly` | `boolean` | Whether the video contains an audio track. | [index.ts:234](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L234) |
| <a id="height"></a> `height` | `readonly` | `number` | Native video height in pixels. | [index.ts:228](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L228) |
| <a id="width"></a> `width` | `readonly` | `number` | Native video width in pixels. | [index.ts:226](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L226) |

## Methods

### \[dispose\]()

```ts
dispose: void;
```

Defined in: [index.ts:275](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L275)

#### Returns

`void`

#### Inherit Doc

***

### close()

```ts
close(): void;
```

Defined in: [index.ts:268](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L268)

Close the video and free all resources.

#### Returns

`void`

***

### nextFrame()

```ts
nextFrame(): VideoFrame | null;
```

Defined in: [index.ts:256](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L256)

Returns the next decoded RGBA frame, or null at end of video.

#### Returns

[`VideoFrame`](../interfaces/VideoFrame) \| `null`

***

### seek()

```ts
seek(timeSec): void;
```

Defined in: [index.ts:262](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L262)

Seek to the given time in seconds (nearest keyframe).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `timeSec` | `number` |

#### Returns

`void`
