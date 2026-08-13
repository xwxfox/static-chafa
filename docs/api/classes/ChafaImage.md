# Class: ChafaImage

Defined in: [index.ts:99](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L99)

Holds a decoded image's raw RGBA pixel data.

Created by `chafa.decode(buffer)`. Can be passed to `chafa.renderRgba()`
to render multiple times without re-decoding.

Supports `using` for automatic cleanup.

## Constructors

### Constructor

```ts
new ChafaImage(data): ChafaImage;
```

Defined in: [index.ts:111](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L111)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `data` | [`ChafaImageData`](../interfaces/ChafaImageData.md) |

#### Returns

`ChafaImage`

## Properties

| Property | Modifier | Type | Description | Defined in |
| ------ | ------ | ------ | ------ | ------ |
| <a id="height"></a> `height` | `readonly` | `number` | Image height in pixels. | [index.ts:105](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L105) |
| <a id="metrics"></a> `metrics` | `readonly` | [`CodecMetrics`](../interfaces/CodecMetrics.md) | Decode metrics (format, decode time, etc.). | [index.ts:109](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L109) |
| <a id="rgba"></a> `rgba` | `readonly` | `Uint8Array` | RGBA pixel buffer (8 bits per channel, unassociated alpha). Read-only for safety. | [index.ts:101](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L101) |
| <a id="stride"></a> `stride` | `readonly` | `number` | Row stride in bytes (always `width * 4`). | [index.ts:107](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L107) |
| <a id="width"></a> `width` | `readonly` | `number` | Image width in pixels. | [index.ts:103](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L103) |

## Accessors

### format

#### Get Signature

```ts
get format(): number;
```

Defined in: [index.ts:120](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L120)

Detected image format (0=PNG, 1=JPEG, 2=BMP, 3=GIF, 4=WebP).

##### Returns

`number`

## Methods

### \[dispose\]()

```ts
dispose: void;
```

Defined in: [index.ts:131](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L131)

#### Returns

`void`

#### Inherit Doc

***

### destroy()

```ts
destroy(): void;
```

Defined in: [index.ts:126](https://github.com/xwxfox/chafa-ts-multirt/blob/a428a579838377f735fcd8486af331bf56b675a8/src/index.ts#L126)

Free the native RGBA buffer.
After calling this the image is unusable.

#### Returns

`void`
