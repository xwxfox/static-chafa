# Interface: VideoFrame

Defined in: [types.ts:261](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/types.ts#L261)

A single decoded video frame from [ChafaVideo.nextFrame](../classes/ChafaVideo.md#nextframe).

## Properties

| Property | Type | Description | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="frameindex"></a> `frameIndex` | `number` | Frame index (0-based, monotonic within a session) | [types.ts:271](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/types.ts#L271) |
| <a id="height"></a> `height` | `number` | Frame height in pixels (decode target, not native) | [types.ts:267](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/types.ts#L267) |
| <a id="metrics"></a> `metrics` | [`CodecMetrics`](CodecMetrics) | Video playback metadata (frame delay, dimensions) | [types.ts:273](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/types.ts#L273) |
| <a id="ptssec"></a> `ptsSec` | `number` | Presentation timestamp in seconds | [types.ts:269](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/types.ts#L269) |
| <a id="rgba"></a> `rgba` | `Uint8Array` | RGBA pixel buffer (copied from the video ring buffer) | [types.ts:263](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/types.ts#L263) |
| <a id="width"></a> `width` | `number` | Frame width in pixels (decode target, not native) | [types.ts:265](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/types.ts#L265) |
