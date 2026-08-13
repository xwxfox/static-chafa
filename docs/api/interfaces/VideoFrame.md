# Interface: VideoFrame

Defined in: [types.ts:358](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L358)

A single decoded video frame from [ChafaVideo.nextFrame](../classes/ChafaVideo.md#nextframe).

## Properties

| Property | Type | Description | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="audio"></a> `audio?` | `Float32Array`\<`ArrayBufferLike`\> \| `null` | Interleaved float32 PCM covering this frame's timespan. Only present when the config option `videoIncludeAudio` is enabled. | [types.ts:371](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L371) |
| <a id="audiochannels"></a> `audioChannels?` | `number` | Audio channel count | [types.ts:375](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L375) |
| <a id="audiosamplerate"></a> `audioSampleRate?` | `number` | Audio sample rate in Hz | [types.ts:377](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L377) |
| <a id="audiosamples"></a> `audioSamples?` | `number` | Number of PCM sample frames in `audio` | [types.ts:373](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L373) |
| <a id="frameindex"></a> `frameIndex` | `number` | Frame index (0-based, monotonic within a session) | [types.ts:368](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L368) |
| <a id="height"></a> `height` | `number` | Frame height in pixels (decode target, not native) | [types.ts:364](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L364) |
| <a id="metrics"></a> `metrics` | [`CodecMetrics`](CodecMetrics.md) | Video playback metadata (frame delay, dimensions) | [types.ts:379](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L379) |
| <a id="ptssec"></a> `ptsSec` | `number` | Presentation timestamp in seconds | [types.ts:366](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L366) |
| <a id="rgba"></a> `rgba` | `Uint8Array` | RGBA pixel buffer (copied from the video ring buffer) | [types.ts:360](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L360) |
| <a id="width"></a> `width` | `number` | Frame width in pixels (decode target, not native) | [types.ts:362](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/types.ts#L362) |
