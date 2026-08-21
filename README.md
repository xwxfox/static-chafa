# static-chafa

**Fast native terminal image rendering for Node.js.**

`static-chafa` brings the [Chafa](https://hpjansson.org/chafa/) terminal
graphics engine to Node.js through a native N-API addon.

It decodes PNG, JPEG, BMP, GIF, and WebP images in native code, renders them
using Chafa's terminal graphics algorithms, and returns ANSI/terminal escape
sequences directly to JavaScript.

It also provides animated GIF/WebP playback, optional FFmpeg-backed video
playback, terminal capability detection, raw RGBA access, rendering metrics,
and a high-level TypeScript API.

> **Licensing note:** `static-chafa` combines original MIT-licensed code with
> third-party components under their own licenses. In particular, Chafa
> remains licensed under LGPL-3.0-or-later. See
> [Attribution & Licensing](#attribution--licensing) and
> [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).


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
- **Rich metrics** - per-operation timing (parse/draw/build/total), image dimensions, canvas dimensions, RGBA buffer size
- **Decode once, render many** - pre-decode to raw RGBA with `decode()`, render with multiple configs via `renderRgba()`
- **Optional video playback** through dynamically loaded FFmpeg libraries.
- **Cell matrix** - access the raw character grid as JSON with `renderMatrix()`
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
| `videoDecodeScale` | number | 1.0 | Video decode target as a fraction of the fit size (lower = faster decode, lower quality) |
| `tuned` | number | 1 | Apply tuned per-mode/size defaults (see below). 0 = off |
| `ditherMode` | number | 0 | `DitherMode.NONE` / `ORDERED` / `DIFFUSION` / `NOISE` |
| `symbols` | string | "" | Chafa CLI selector string (e.g. `"block+border+space-wide"`) |
| `fillSymbols` | string | "" | Fill symbol map selector string |

### Tuned defaults

`playground/tuner.ts` (a multi-hour Bayesian optimizer scoring
`SSIM*100 - lambda*ms` across terminal sizes and media) found per-(pixel
mode, terminal size) optimal configs, which are baked into the library as
defaults. On construction - and whenever you switch `pixelMode`, `termW`,
or `termH` via `updateConfig()` - fields you haven't set explicitly are
filled from these tuned values (numeric fields interpolate smoothly between
probed terminal sizes; categorical fields follow the nearest size):

```ts
const chafa = new Chafa({ termW: 120, termH: 40 });   // tuned symbol defaults
chafa.updateConfig({ pixelMode: PixelMode.KITTY });    // re-tunes for kitty
chafa.updateConfig({ termW: 240, termH: 72 });         // re-tunes for the size

// Opt out - anything you pass explicitly always wins, and you can disable
// the whole mechanism:
new Chafa({ tuned: 0 });
```

Inspect or reuse the logic yourself with `tunedDefaults(pixelMode, termW, termH)`.

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

## Attribution & Licensing

This project is built on the work of several excellent open-source projects. Huge thanks to their authors and contributors.

### Chafa

The core terminal graphics functionality is derived from **Chafa**, by Hans Petter Jansson and contributors.

Chafa is licensed under the **GNU Lesser General Public License, version 3 or later (LGPL-3.0-or-later)**.

This project contains modified and/or adapted Chafa code. Those portions remain available under the LGPL-3.0-or-later.

* Upstream: https://github.com/hpjansson/chafa
* License: LGPL-3.0-or-later
* Copyright: Hans Petter Jansson and Chafa contributors

### chafa-wasm

This project also takes inspiration from and, where applicable, incorporates TypeScript API/type definitions from **chafa-wasm**, maintained by Héctor Molinero Fernández.

chafa-wasm is licensed under the **LGPL-3.0**.

* Upstream: https://github.com/hectorm/chafa-wasm
* License: LGPL-3.0
* Copyright: Héctor Molinero Fernández and contributors

Where this project contains material derived from chafa-wasm, the applicable upstream license and copyright notices are preserved.

### Other third-party software

This project also incorporates or uses software from:

* zlib
* libpng
* Independent JPEG Group (IJG) JPEG
* WebP
* stb_image
* Node.js / N-API
* FFmpeg headers

Each component remains subject to its respective license.

See [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) for the complete attribution and licensing information.

### License for this project

Original code written for this project is released under the **MIT License**.

Third-party and derivative portions are **not** relicensed under MIT and remain under their respective upstream licenses.

See:

* [`LICENSE.md`](./LICENSE.md) - MIT License for original project code
* [`COPYING.LESSER`](./COPYING.LESSER) - GNU LGPLv3
* [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) - third-party attribution and license information
* [`licenses/`](./licenses/) - copies of applicable third-party license texts
