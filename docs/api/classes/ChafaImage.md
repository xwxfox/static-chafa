# Class: ChafaImage

Defined in: [index.ts:81](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L81)

Holds a decoded image's raw RGBA pixel data.

Created by `chafa.decode(buffer)`. Can be passed to `chafa.renderRgba()`
to render multiple times without re-decoding.

Supports `using` for automatic cleanup.

## Constructors

### Constructor

```ts
new ChafaImage(data): ChafaImage;
```

Defined in: [index.ts:93](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L93)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `data` | [`ChafaImageData`](../interfaces/ChafaImageData) |

#### Returns

`ChafaImage`

## Properties

| Property | Modifier | Type | Description | Defined in |
| ------ | ------ | ------ | ------ | ------ |
| <a id="height"></a> `height` | `readonly` | `number` | Image height in pixels. | [index.ts:87](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L87) |
| <a id="metrics"></a> `metrics` | `readonly` | [`CodecMetrics`](../interfaces/CodecMetrics) | Decode metrics (format, decode time, etc.). | [index.ts:91](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L91) |
| <a id="rgba"></a> `rgba` | `readonly` | `Uint8Array` | RGBA pixel buffer (8 bits per channel, unassociated alpha). Read-only for safety. | [index.ts:83](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L83) |
| <a id="stride"></a> `stride` | `readonly` | `number` | Row stride in bytes (always `width * 4`). | [index.ts:89](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L89) |
| <a id="width"></a> `width` | `readonly` | `number` | Image width in pixels. | [index.ts:85](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L85) |

## Accessors

### format

#### Get Signature

```ts
get format(): number;
```

Defined in: [index.ts:102](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L102)

Detected image format (0=PNG, 1=JPEG, 2=BMP, 3=GIF, 4=WebP).

##### Returns

`number`

## Methods

### \[dispose\]()

```ts
dispose: void;
```

Defined in: [index.ts:113](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L113)

#### Returns

`void`

#### Inherit Doc

***

### destroy()

```ts
destroy(): void;
```

Defined in: [index.ts:108](https://github.com/xwxfox/chafa-ts-multirt/blob/25c6adb3b7e30df2d3e5f840d38613861ee17005/src/index.ts#L108)

Free the native RGBA buffer.
After calling this the image is unusable.

#### Returns

`void`
