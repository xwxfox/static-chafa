# Usage Guide

## Installation

```bash
npm install static-chafa
```

No external dependencies required. The package bundles platform-specific native addons
for linux-x64, linux-arm64, darwin-arm64, and win32-x64.

## Basic Rendering

```ts
import Chafa from "static-chafa";

// Create an instance with default settings
const chafa = new Chafa({ termW: 80, termH: 24 });

// Render an image from a Buffer
const { ansi, metrics } = chafa.render(imageBuffer);
process.stdout.write(ansi);

// metrics gives you detailed timing:
//   parseMs  - time spent decoding the image
//   drawMs   - time in chafa_canvas_draw_all_pixels (scaling + symbol matching)
//   buildMs  - time in chafa_canvas_print (ANSI string generation)
//   totalMs  - sum of all three
console.log(metrics);

chafa.destroy();
```

## Configuration

```ts
import Chafa, { CanvasMode, DitherMode, PixelMode } from "static-chafa";

const chafa = new Chafa({
    termW: 80,          // width in character cells
    termH: 24,          // height in character cells
    cellW: 8,           // cell width in pixels (font ratio)
    cellH: 8,           // cell height in pixels
    workFactor: 0.0,    // 0.0 = fastest, 1.0 = best quality
    canvasMode: CanvasMode.TRUECOLOR,
    ditherMode: DitherMode.NONE,
    pixelMode: PixelMode.SYMBOLS,
    bgColor: 0x000000,  // background (0xRRGGBB, -1 for transparent)
    fgColor: 0xFFFFFF,  // foreground
    preprocessing: 0,   // enable auto-contrast/brightness
});

// Update config at any time (invalidates internal canvas)
chafa.updateConfig({
    canvasMode: CanvasMode.INDEXED_256,
    ditherMode: DitherMode.DIFFUSION,
    symbols: "block+border+space-wide",  // chafa CLI selector syntax
});
```

## Decode Once, Render Many

```ts
import Chafa from "static-chafa";

const chafa = new Chafa({ termW: 80, termH: 24 });

// Decode once - returns raw RGBA pixels
const img = chafa.decode(imageBuffer);
console.log(img.width, img.height, img.metrics.format);

// Render the same decoded image with different configs
chafa.updateConfig({ canvasMode: CanvasMode.TRUECOLOR });
const { ansi: fullColor } = chafa.renderRgba(img.rgba, img.width, img.height);

chafa.updateConfig({ canvasMode: CanvasMode.INDEXED_16 });
const { ansi: indexed } = chafa.renderRgba(img.rgba, img.width, img.height);
```

## Cell Matrix

```ts
// Get the raw cell grid as a JSON-encoded 3D array
const { matrix } = chafa.renderMatrix(imageBuffer);
const cells: [number, number, number][][] = JSON.parse(matrix);

// Each cell is [charCode, fgColor, bgColor]
// Colors: -1 = transparent, 0xRRGGBB = truecolor, 0-255 = palette index
for (const row of cells) {
    for (const [code, fg, bg] of row) {
        console.log(String.fromCodePoint(code), fg.toString(16), bg.toString(16));
    }
}
```

## Animation

```ts
import Chafa from "static-chafa";

const chafa = new Chafa({ termW: 80, termH: 24 });
const anim = chafa.openAnimation(gifBuffer);

while (true) {
    const frame = anim.next();
    if (!frame) break;  // playback ended

    const { ansi, metrics } = anim.renderFrame(frame.frameIndex);
    process.stdout.write("\x1b[H" + ansi);

    // Wait for frame delay
    await new Promise(r => setTimeout(r, metrics.frameDelayMs));
}

anim.close();
```

## Using `using` for Auto-Cleanup

```ts
// TypeScript 5.2+ - auto-cleanup at end of scope
{
    using chafa = new Chafa({ termW: 80, termH: 24 });
    const { ansi } = chafa.render(buf);
    // chafa.destroy() called here
}
```

## Complete ChafaConfig Reference

All configuration fields map 1:1 to chafa's `ChafaCanvasConfig` setters.
See the [chafa man page](https://hpjansson.org/chafa/man/) for detailed descriptions
of each option.

### Canvas geometry
| Field | Default | Description |
|-------|---------|-------------|
| `termW` | 80 | Width in character cells |
| `termH` | 24 | Height in character cells |
| `cellW` | 8 | Cell width in pixels (font ratio) |
| `cellH` | 8 | Cell height in pixels (font ratio) |

### Quality
| Field | Default | Description |
|-------|---------|-------------|
| `workFactor` | 0.0 | 0.0 (fastest) to 1.0 (best quality) |
| `preprocessing` | 0 | Auto contrast/brightness (0=off, 1=on) |

### Color
| Field | Default | Description |
|-------|---------|-------------|
| `canvasMode` | 0 | One of `CanvasMode` (TRUECOLOR, INDEXED_256, ...) |
| `colorExtractor` | 0 | AVERAGE (0) or MEDIAN (1) |
| `colorSpace` | 0 | RGB (0) or DIN99D (1) |
| `bgColor` | 0x000000 | Background 0xRRGGBB, -1 = transparent |
| `fgColor` | 0xFFFFFF | Foreground 0xRRGGBB, -1 = transparent |
| `alphaThreshold` | 127 | 0-255, lower = less transparent |
| `fgOnly` | 0 | Foreground-only mode |

### Dithering
| Field | Default | Description |
|-------|---------|-------------|
| `ditherMode` | 0 | NONE, ORDERED, DIFFUSION, or NOISE |
| `ditherGrainW` | 4 | Grain width in pixels |
| `ditherGrainH` | 4 | Grain height in pixels |
| `ditherIntensity` | 1.0 | Multiplier (0.0-2.0 typical) |

### Pixel mode
| Field | Default | Description |
|-------|---------|-------------|
| `pixelMode` | 0 | SYMBOLS, SIXELS, KITTY, or ITERM2 |

### Output
| Field | Default | Description |
|-------|---------|-------------|
| `optimizations` | 0x7fffffff | Bitmask of `ChafaOptimizations` |
| `passthrough` | 0 | NONE, SCREEN, or TMUX |
| `symbols` | "" | Chafa CLI selector string |
| `fillSymbols` | "" | Chafa CLI fill selector string |

### Animation
| Field | Default | Description |
|-------|---------|-------------|
| `maxFrames` | -1 | Max frames (-1 = all) |
| `speed` | 1.0 | Playback speed multiplier |
