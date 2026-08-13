# static-chafa

**Zero-dependency terminal image rendering.** Decodes PNG, JPEG, BMP, GIF, and WebP (static + animated) in native C, renders to ANSI terminal art using the [chafa](https://hpjansson.org/chafa/) engine, and returns strings to JavaScript. Ships as a Node.js NAPI native addon with platform-specific binaries.

```ts
import Chafa, { CanvasMode, DitherMode } from "static-chafa";

const chafa = new Chafa({ termW: 80, termH: 24 });
const { ansi, metrics } = chafa.render(imageBuffer);
process.stdout.write(ansi);
// metrics: { parseMs, drawMs, buildMs, totalMs, imgW/H, canvasW/H, ... }
chafa.destroy();
```

## Features

- **5 image formats** - PNG, JPEG, BMP, GIF, WebP (all decoded in C via libpng/libjpeg/libwebp/stb_image)
- **Animation** - GIF and WebP frame-by-frame playback with `openAnimation()` / `next()` / `renderFrame()`
- **Full chafa config** - 22 config fields covering canvas mode, pixel mode, dithering, color space, symbol selectors, and more
- **Rich metrics** - per-operation timing (parse/draw/build/total), image dimensions, canvas dimensions, RGBA buffer size
- **Decode once, render many** - pre-decode to raw RGBA with `decode()`, render with multiple configs via `renderRgba()`
- **Cell matrix** - access the raw character grid as JSON with `renderMatrix()`
- **Using keyword** - `Symbol.dispose` on Chafa, ChafaImage, and ChafaAnimation
- **Zero runtime deps** - chafa is compiled verbatim with a complete GLib replacement layer (`vendor/chafa/glib_mini.h`)
- **Cross-platform** - linux-x64, linux-arm64, darwin-arm64, win32-x64 via `zig cc`

## Quick Start

```bash
bun install static-chafa
```

```ts
import Chafa from "static-chafa";

// Create an instance with your terminal dimensions
const chafa = new Chafa({ termW: 80, termH: 24 });

// Render any supported image
const { ansi, metrics } = chafa.render(fs.readFileSync("cat.png"));
process.stdout.write(ansi);

console.log(metrics);
// {
//   parseMs: 5.4,    // image decode time
//   scaleMs: 0.0,    // pixel-fit pre-scale time (0 when no scaling)
//   drawMs: 2.6,     // chafa symbol matching
//   buildMs: 0.1,    // ANSI string generation
//   totalMs: 8.1,    // sum
//   imgW: 641, imgH: 641,
//   canvasW: 80, canvasH: 24,
//   canvasPw: 640, canvasPh: 192,
//   format: 0, canvasMode: 0, pixelMode: 0, pixelFit: 1
// }

chafa.destroy();
```

## API

### `new Chafa(config?: Partial<ChafaConfig>)`

Creates a rendering instance. Each instance holds its own configuration and caches a single chafa canvas.

```ts
import Chafa, { CanvasMode, DitherMode } from "static-chafa";

const chafa = new Chafa({
    termW: 80,          // width in cells
    termH: 24,          // height in cells
    canvasMode: CanvasMode.TRUECOLOR,
    ditherMode: DitherMode.NONE,
    // ...see ChafaConfig for all options
});
```

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `render(buffer)` | `{ ansi, metrics }` | Decode + render to ANSI string |
| `renderPath(path)` | `{ ansi, metrics }` | Read file + render to ANSI string |
| `decode(buffer)` | `ChafaImage` | Decode to raw RGBA pixels |
| `renderRgba(rgba, w, h)` | `{ ansi, metrics }` | Render pre-decoded RGBA |
| `renderMatrix(buffer)` | `{ matrix, metrics }` | Decode + render to JSON cell grid (symbol mode only) |
| `renderMatrixRgba(rgba, w, h)` | `{ matrix, metrics }` | Render pre-decoded RGBA to cell grid (symbol mode only) |
| `openAnimation(buffer)` | `ChafaAnimation` | Open animated GIF/WebP |
| `openVideo(buffer, decodeW?, decodeH?)` | `ChafaVideo` | Open video file (MP4/MKV/WebM/AVI) |
| `updateConfig(partial)` | `void` | Update config (invalidates canvas) |
| `autoDetect(timeoutMs?)` | `Promise<TerminalInfo>` | Probe the terminal and apply capabilities |
| `info()` | `{ config, features, lastMetrics }` | Debug / perf snapshot |
| `destroy()` | `void` | Free all native resources |

Static utilities:

| Method | Returns | Description |
|--------|---------|-------------|
| `Chafa.detect(timeoutMs?)` | `Promise<TerminalInfo>` | Probe terminal: pixel protocols, cell size, colors |
| `Chafa.supportedFeatures()` | `string` | CPU features (e.g. "POPCNT") |
| `Chafa.ansiToHtml(ansi)` | `string` | ANSI art to HTML |

### `ChafaImage`

Holds decoded RGBA pixels. Created by `chafa.decode(buffer)`.

```ts
const img = chafa.decode(buffer);
img.width;      // 641
img.height;     // 641
img.rgba;       // Uint8Array of RGBA pixels
img.stride;     // row stride in bytes (width * 4)
img.format;     // 0=PNG, 1=JPEG, 2=BMP, 3=GIF, 4=WebP
img.metrics;    // CodecMetrics from decode

// Re-render with different configs
chafa.updateConfig({ canvasMode: CanvasMode.INDEXED_256 });
chafa.renderRgba(img.rgba, img.width, img.height);
```

### `ChafaAnimation`

Plays animated GIF/WebP with an integrated player: `play()` / `pause()` /
`goto()` plus `onFrame()` events. Works in every pixel mode - `play()`
renders frames with the owning instance's config (sixels, kitty, symbols),
sized to fill the terminal.

```ts
const anim = chafa.openAnimation(gifBuffer);
anim.loop = true;
anim.onFrame((frame) => process.stdout.write(`\x1b[H${frame.ansi}`));
anim.play();          // internal timer honors per-frame delays
// ...
anim.pause();         // freeze on the current frame
anim.goto(10);        // jump to frame 10 (emits an onFrame event)
anim.close();
```

Manual stepping (`next()` + `renderFrame()`) is also supported - `next()`
emits `onFrame` events too. In kitty mode, animation frames reuse a single
kitty image id (no per-frame image leak).

### ChafaVideo

Plays MP4, MKV, WebM, AVI, and any other container FFmpeg supports. Requires
FFmpeg shared libraries on the system (throws a descriptive error if missing).
Frames are zero-copy views into the decoder ring buffer.

```ts
const video = chafa.openVideo(fs.readFileSync("clip.mp4"));
// Metadata
video.width; video.height; video.durationSec; video.fps;
video.hasAudio; video.audioCodec; video.audioSampleRate; video.audioChannels;

// Integrated player: paced playback + onFrame events
video.onFrame((frame) => {
    process.stdout.write(`\x1b[H${chafa.renderRgba(frame.rgba, frame.width, frame.height).ansi}`);
    // frame.audio is Float32Array PCM (needs videoIncludeAudio: 1)
});
video.play();         // paced to presentation timestamps
video.pause();
video.goto(42);       // seek + return the frame there
const poster = video.thumbnail();  // first frame rendered via current config

// Or iterate:
for await (const frame of video) { /* ... */ }

video.close();
```

With `videoIncludeAudio: 1` in the config, each frame carries `frame.audio`
(interleaved float32 PCM covering the frame's timespan), `audioSamples`,
`audioChannels`, and `audioSampleRate`. Audio decoding is off by default
to save CPU and memory.

### Terminal detection

The constructor auto-detects capabilities from the environment (`$TERM`,
`$KITTY_WINDOW_ID`, `$TERM_PROGRAM`, `$COLORTERM`) - kitty terminals get
kitty pixel mode, truecolor terminals get truecolor, etc. Explicit config
always wins. For a full active probe (pixel protocols, cell size, terminal
dimensions), use `Chafa.detect()` or `chafa.autoDetect()`.

```ts
const info = await Chafa.detect();   // probes via escape sequences
// { pixelMode: 2, cellW: 10, cellH: 20, termW: 120, termH: 40, ... }
```

### Using `using` (TypeScript 5.2+)

```ts
{
    using chafa = new Chafa({ termW: 80, termH: 24 });
    const { ansi } = chafa.render(buf);
    // chafa.destroy() called automatically here
}
```

### `ChafaConfig`

See [typedoc docs](docs/api/interfaces/ChafaConfig.md) for full config reference, or the [chafa man page](https://hpjansson.org/chafa/man/).

Key config fields:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `termW`, `termH` | number | 80, 24 | Cell grid dimensions |
| `cellW`, `cellH` | number | 8, 16 | Cell pixel size (pixel modes only; ignored in symbol mode) |
| `workFactor` | number | 0.0 | Quality/speed (0=fast, 1=best) |
| `canvasMode` | number | 0 | `CanvasMode.TRUECOLOR` / `INDEXED_256` / ... |
| `pixelMode` | number | 0 | `PixelMode.SYMBOLS` / `SIXELS` / `KITTY` / `ITERM2` |
| `pixelFit` | number | 1 | `PixelFit.NONE` (hand pixels to chafa) / `SCALE` (pre-scale to fill `termW × cellW` × `termH × cellH`, default) |
| `videoIncludeAudio` | number | 0 | Decode video audio into per-frame PCM (1 = on) |
| `videoThreads` | number | 0 | FFmpeg decoder thread count (0 = auto) |
| `swsScale` | number | 0 | FFmpeg scaler: `SwsScale.AUTO` / `BILINEAR` / `POINT` / `AREA` / `FAST_BILINEAR` |
| `ditherMode` | number | 0 | `DitherMode.NONE` / `ORDERED` / `DIFFUSION` / `NOISE` |
| `symbols` | string | "" | Chafa CLI selector string (e.g. `"block+border+space-wide"`) |
| `fillSymbols` | string | "" | Fill symbol map selector string |

In pixel modes the output occupies `termW × cellW` by `termH × cellH` screen pixels
(640×384 by default), filling the same terminal area as symbol mode. With
`pixelFit: SCALE` (default) source pixels are pre-scaled to that area, so chafa
draws 1:1; video frames are decoded directly at the fit size, making this free.

## CodecMetrics

Returned with every render/decode operation:

| Field | Description |
|-------|-------------|
| `parseMs` | Image format detection + codec decode time |
| `drawMs` | `chafa_canvas_draw_all_pixels` - scaling, symbol matching |
| `buildMs` | `chafa_canvas_print` - ANSI string generation |
| `totalMs` | `parseMs + drawMs + buildMs` |
| `imgW`, `imgH` | Source image pixels |
| `canvasW`, `canvasH` | Cell grid dimensions |
| `canvasPw`, `canvasPh` | Internal pixel canvas size |
| `rgbaBytes` | Decoded RGBA buffer size |
| `format` | 0=PNG, 1=JPEG, 2=BMP, 3=GIF, 4=WebP |
| `canvasMode`, `pixelMode` | Active rendering mode enums |
| `pixelFit` | Active pixel fit strategy |
| `haveAlpha` | Source had alpha channel |

## Architecture

Chafa's source tree (39 `.c` files) is compiled verbatim into the native addon. A vendor layer at `vendor/chafa/` replaces GLib entirely with a custom implementation (~750 lines of `glib_mini.h`), provides a fake autotools config, and supplies stub headers. The include path `-I vendor/chafa` is placed first so chafa's `#include <glib.h>` resolves to our replacement.

```
chafa source           vendor layer          our code
-------------          ------------          --------
internal/*.c           vendor/chafa/         src/codec.c
chafa-*.c   -includes-> config.h   -includes-> src/addon.c
smolscale/*.c           glib_mini.h           src/index.ts
                        chafa_quarks.c
```

Image decode is handled by our own code in `codec.c` using libpng, libjpeg (IJG), libwebp, and stb_image (GIF). Chafa receives decoded RGBA pixels via `chafa_canvas_draw_all_pixels()`.

## Development

```bash
bun run build:dev     # Build codec.so for Bun FFI
bun run build:napi    # Build .node addon
bun run test          # Run 38 tests
bun run bench         # Run comprehensive benchmark
bun run docs          # Generate API docs
bun run playground    # Interactive test suite
```

### Tuning harness

`playground/harness.ts` renders media frames with full per-stage timings and
pixel-compares every output against ground truth (PSNR/SSIM), emitting PNGs
(ground truth, reference, symbols raster, decoded sixel/kitty) plus
`metrics.json`:

```bash
bun run playground/harness.ts render fox.png --mode all --frames 10
bun run playground/harness.ts tune fox.png --frames 5        # ranked 1-D sweep
```

`playground/tuner.ts` runs a long-horizon automatic optimizer: 15 concurrent
processes (5 terminal sizes x symbols/sixel/kitty) continuously sampling the
full chafa + FFmpeg config space (workFactor, dithering, color space,
canvas mode, symbol maps, alpha/bg handling, pixelFit, decode scale, decoder
threads, swscale filter, ...) with a TPE (Bayesian) sampler. It scores
`SSIM*100 - lambda*ms`, checkpoints state (resumable), shows a live status
page, and finally writes `best_configs.json` per size/mode plus
`formulas.json` (term-size -> config-value fits):

```bash
bun run playground/tuner.ts            # 8h budget, live status page
bun run playground/tuner.ts --resume   # continue from checkpoint
bun run playground/tuner.ts --silent --hours 0.01   # quick smoke test
```

### Maintenance

When chafa updates, only the vendor layer needs expansion (see [VENDOR.md](VENDOR.md)):
- New `.c` files -> add to `CHAFA_FILES` in `build.sh`
- New GLib includes -> create stub headers
- New GLib functions -> implement in `glib_mini.h`

## License

MIT
