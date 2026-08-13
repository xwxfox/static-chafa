# static-chafa v1.0.8

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
| [Chafa](classes/Chafa.md) | The main entry point for rendering images with chafa. |
| [ChafaAnimation](classes/ChafaAnimation.md) | Plays animated GIF or WebP images frame-by-frame. |
| [ChafaImage](classes/ChafaImage.md) | Holds a decoded image's raw RGBA pixel data. |
| [ChafaVideo](classes/ChafaVideo.md) | Decodes and plays MP4/MKV/WebM/AVI videos frame-by-frame via FFmpeg. |

## Interfaces

| Interface | Description |
| ------ | ------ |
| [AnimFrame](interfaces/AnimFrame.md) | Returned by [ChafaAnimation.next](classes/ChafaAnimation.md#next). |
| [ChafaConfig](interfaces/ChafaConfig.md) | Full chafa canvas configuration. |
| [ChafaImageData](interfaces/ChafaImageData.md) | Raw decoded image data returned by [Chafa.decode](classes/Chafa.md#decode). |
| [CodecMetrics](interfaces/CodecMetrics.md) | Metrics returned with every render/decode operation. |
| [MatrixResult](interfaces/MatrixResult.md) | Returned by [Chafa.renderMatrix](classes/Chafa.md#rendermatrix) and [Chafa.renderMatrixRgba](classes/Chafa.md#rendermatrixrgba). |
| [RenderResult](interfaces/RenderResult.md) | Returned by [Chafa.render](classes/Chafa.md#render) and [Chafa.renderRgba](classes/Chafa.md#renderrgba). |
| [VideoFrame](interfaces/VideoFrame.md) | A single decoded video frame from [ChafaVideo.nextFrame](classes/ChafaVideo.md#nextframe). |

## Type Aliases

| Type Alias | Description |
| ------ | ------ |
| [ChafaConfigPartial](type-aliases/ChafaConfigPartial.md) | Partial config, for constructor and `updateConfig()`. |
| [ChafaFormat](type-aliases/ChafaFormat.md) | Image format detected by the decoder. |

## Variables

| Variable | Description |
| ------ | ------ |
| [CanvasMode](variables/CanvasMode.md) | Chafa canvas color modes. |
| [ColorExtractor](variables/ColorExtractor.md) | Chafa color extraction strategies. |
| [ColorSpace](variables/ColorSpace.md) | Chafa color spaces for distance calculations. |
| [DitherMode](variables/DitherMode.md) | Chafa dithering modes. |
| [FMT\_NAMES](variables/FMT_NAMES.md) | - |
| [Passthrough](variables/Passthrough.md) | Protocol passthrough guards for multiplexers. |
| [PixelFit](variables/PixelFit.md) | Pixel-mode size fitting strategy. |
| [PixelMode](variables/PixelMode.md) | Chafa pixel rendering modes. |
| [SwsScale](variables/SwsScale.md) | FFmpeg swscale conversion flags for video decode. |

## Functions

| Function | Description |
| ------ | ------ |
| [defaultConfig](functions/defaultConfig.md) | Returns a fresh default config object. |
| [pixelCanvasSize](functions/pixelCanvasSize.md) | Target pixel dimensions for a pixel-mode config. |

## References

### default

Renames and re-exports [Chafa](classes/Chafa.md)
