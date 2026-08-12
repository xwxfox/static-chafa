# static-chafa v1.0.3

static-chafa - Zero-dependency terminal image rendering.

Renders PNG, JPEG, BMP, GIF, and WebP images to ANSI terminal art
using the chafa engine compiled directly into the native addon.

```ts
import Chafa from "static-chafa";

const chafa = new Chafa({ termW: 80, termH: 24 });
const { ansi, metrics } = chafa.render(imageBuffer);
process.stdout.write(ansi);
chafa.destroy();
```

## Classes

| Class | Description |
| ------ | ------ |
| [Chafa](classes/Chafa) | The main entry point for rendering images with chafa. |
| [ChafaAnimation](classes/ChafaAnimation) | Plays animated GIF or WebP images frame-by-frame. |
| [ChafaImage](classes/ChafaImage) | Holds a decoded image's raw RGBA pixel data. |

## Interfaces

| Interface | Description |
| ------ | ------ |
| [AnimFrame](interfaces/AnimFrame) | Returned by [ChafaAnimation.next](classes/ChafaAnimation.md#next). |
| [ChafaConfig](interfaces/ChafaConfig) | Full chafa canvas configuration. |
| [ChafaImageData](interfaces/ChafaImageData) | Raw decoded image data returned by [Chafa.decode](classes/Chafa.md#decode). |
| [CodecMetrics](interfaces/CodecMetrics) | Metrics returned with every render/decode operation. |
| [MatrixResult](interfaces/MatrixResult) | Returned by [Chafa.renderMatrix](classes/Chafa.md#rendermatrix) and [Chafa.renderMatrixRgba](classes/Chafa.md#rendermatrixrgba). |
| [RenderResult](interfaces/RenderResult) | Returned by [Chafa.render](classes/Chafa.md#render) and [Chafa.renderRgba](classes/Chafa.md#renderrgba). |

## Type Aliases

| Type Alias | Description |
| ------ | ------ |
| [ChafaConfigPartial](type-aliases/ChafaConfigPartial) | Partial config, for constructor and `updateConfig()`. |
| [ChafaFormat](type-aliases/ChafaFormat) | Image format detected by the decoder. |

## Variables

| Variable | Description |
| ------ | ------ |
| [CanvasMode](variables/CanvasMode) | Chafa canvas color modes. |
| [ColorExtractor](variables/ColorExtractor) | Chafa color extraction strategies. |
| [ColorSpace](variables/ColorSpace) | Chafa color spaces for distance calculations. |
| [DitherMode](variables/DitherMode) | Chafa dithering modes. |
| [FMT\_NAMES](variables/FMT_NAMES) | - |
| [Passthrough](variables/Passthrough) | Protocol passthrough guards for multiplexers. |
| [PixelMode](variables/PixelMode) | Chafa pixel rendering modes. |

## Functions

| Function | Description |
| ------ | ------ |
| [defaultConfig](functions/defaultConfig) | Returns a fresh default config object. |

## References

### default

Renames and re-exports [Chafa](classes/Chafa)
