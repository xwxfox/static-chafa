# Class: ChafaImage

Defined in: [index.ts:80](https://github.com/xwxfox/chafa-ts-multirt/blob/d8b56995c1cfccf66d00c2bdf2426975f026db0a/src/index.ts#L80)

Holds a decoded image's raw RGBA pixel data.

Created by `chafa.decode(buffer)`. Can be passed to `chafa.renderRgba()`
to render multiple times without re-decoding.

Supports `using` for automatic cleanup.

## Constructors

### Constructor

```ts
new ChafaImage(data): ChafaImage;
```

Defined in: [index.ts:92](https://github.com/xwxfox/chafa-ts-multirt/blob/d8b56995c1cfccf66d00c2bdf2426975f026db0a/src/index.ts#L92)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `data` | [`ChafaImageData`](../interfaces/ChafaImageData) |

#### Returns

`ChafaImage`

## Properties

| Property | Modifier | Type | Description | Defined in |
| ------ | ------ | ------ | ------ | ------ |
| <a id="height"></a> `height` | `readonly` | `number` | Image height in pixels. | [index.ts:86](https://github.com/xwxfox/chafa-ts-multirt/blob/d8b56995c1cfccf66d00c2bdf2426975f026db0a/src/index.ts#L86) |
| <a id="metrics"></a> `metrics` | `readonly` | [`CodecMetrics`](../interfaces/CodecMetrics) | Decode metrics (format, decode time, etc.). | [index.ts:90](https://github.com/xwxfox/chafa-ts-multirt/blob/d8b56995c1cfccf66d00c2bdf2426975f026db0a/src/index.ts#L90) |
| <a id="rgba"></a> `rgba` | `readonly` | `Uint8Array` | RGBA pixel buffer (8 bits per channel, unassociated alpha). Read-only for safety. | [index.ts:82](https://github.com/xwxfox/chafa-ts-multirt/blob/d8b56995c1cfccf66d00c2bdf2426975f026db0a/src/index.ts#L82) |
| <a id="stride"></a> `stride` | `readonly` | `number` | Row stride in bytes (always `width * 4`). | [index.ts:88](https://github.com/xwxfox/chafa-ts-multirt/blob/d8b56995c1cfccf66d00c2bdf2426975f026db0a/src/index.ts#L88) |
| <a id="width"></a> `width` | `readonly` | `number` | Image width in pixels. | [index.ts:84](https://github.com/xwxfox/chafa-ts-multirt/blob/d8b56995c1cfccf66d00c2bdf2426975f026db0a/src/index.ts#L84) |

## Accessors

### format

#### Get Signature

```ts
get format(): number;
```

Defined in: [index.ts:101](https://github.com/xwxfox/chafa-ts-multirt/blob/d8b56995c1cfccf66d00c2bdf2426975f026db0a/src/index.ts#L101)

Detected image format (0=PNG, 1=JPEG, 2=BMP, 3=GIF, 4=WebP).

##### Returns

`number`

## Methods

### \[dispose\]()

```ts
dispose: void;
```

Defined in: [index.ts:112](https://github.com/xwxfox/chafa-ts-multirt/blob/d8b56995c1cfccf66d00c2bdf2426975f026db0a/src/index.ts#L112)

#### Returns

`void`

#### Inherit Doc

***

### destroy()

```ts
destroy(): void;
```

Defined in: [index.ts:107](https://github.com/xwxfox/chafa-ts-multirt/blob/d8b56995c1cfccf66d00c2bdf2426975f026db0a/src/index.ts#L107)

Free the native RGBA buffer.
After calling this the image is unusable.

#### Returns

`void`
