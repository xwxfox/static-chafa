# static-chafa

**Zero-dependency terminal image rendering.** Decodes PNG, JPEG, BMP, GIF, and WebP (static + animated) in native C, renders to ANSI half-block characters, and returns ANSI strings to JavaScript/TypeScript. Available as a Node.js NAPI native addon (`static-chafa`) and as a Bun FFI shared library (`codec.so`).

## What this is

A best-effort static embedding of [chafa](https://github.com/hpjansson/chafa) (`v1.19.0`) - a terminal graphics renderer - into a single portable C library with zero runtime dependencies beyond libc. Every other dependency (glib, libpng, libjpeg, libwebp, zlib) is either entirely replaced in a vendor layer or cross-compiled into the binary at build time. The result is a native addon that works identically across Linux x64, Linux arm64, macOS arm64, and Windows x64.

## Chafa surface area

**Supported:** The full TRUECOLOR + SYMBOLS rendering pipeline - 24-bit ANSI truecolor output using Unicode half-block characters (`▀`, `▄`, `▌`, etc.). This covers `chafa_canvas_config_new`, `chafa_canvas_draw_all_pixels` (CHAFA_PIXEL_RGBA8_UNASSOCIATED → CHAFA_PIXEL_MODE_SYMBOLS), and `chafa_canvas_build_ansi`. All 39 chafa source files are compiled verbatim with no patches.

**Not supported:** Indexed-color modes (256-color, 16-color), Sixel, iTerm2, and Kitty protocols. These are compiled in for symbol resolution but never activated by our configuration. Dithering and preprocessing are disabled by default (configurable).

## How we eliminated glib

Chafa depends heavily on GLib. We provide a complete replacement in `vendor/chafa/glib_mini.h` (~750 lines) that implements every GLib type, macro, and function chafa references:

- **Data structures:** GString, GHashTable, GArray, GQueue (full implementations)
- **Threading:** GMutex, GCond, GThread, GThreadPool (pthread on POSIX, Win32 API on Windows)
- **Memory:** g_malloc, g_free, g_slice, g_new, etc.
- **Unicode:** g_unichar_isprint/iszerowidth/iswide, g_utf8_get_char, g_unichar_to_utf8
- **Logging/assertions:** g_assert, g_return_if_fail, g_warning, g_error
- **Platform abstractions:** g_poll, g_unix_open_pipe, g_unix_set_fd_nonblocking

An include-path trick places `vendor/chafa/` first on the compiler's search path, so chafa's `#include <glib.h>` resolves to our replacement rather than the system's real GLib.

## Cross-platform build system

A single `build.sh` script handles everything using `zig cc` for cross-compilation:

```
./build.sh dev           → codec.so for Bun FFI (native only)
./build.sh napi          → static_chafa.node for Node.js (native only)
./build.sh <target> napi → cross-compile .node for target
```

Targets: `native`, `x86_64-linux`, `aarch64-linux`, `x86_64-windows`, `aarch64-macos`.

For cross-compilation, the script auto-fetches and builds static libraries for libpng, libjpeg (IJG), libwebp, and zlib from source tarballs using `zig cc`. These are cached in `deps/<target>/`.

**SIMD:** POPCNT is enabled on all x64 targets. The `chafa-popcnt.c` file is compiled with `-mpopcnt` and the inline dispatchers in chafa's symbol matching code use the hardware popcount instruction automatically.

## C API (imported via FFI/NAPI)

All functions use C calling convention, exported via `CODEC_EXPORT`:

| Function | Signature | Purpose |
|---|---|---|
| `codec_render_buffer` | `(uint8_t* data, int32_t len, Config*, Metrics*, int32_t* err) → char*` | Render image buffer to ANSI string |
| `codec_render_path` | `(const char* path, Config*, Metrics*, int32_t* err) → char*` | Render file at path to ANSI string |
| `codec_anim_open_buffer` | `(uint8_t* data, int32_t len, Config*, Metrics*, int32_t* err) → int32_t` | Open animation, returns handle |
| `codec_anim_next` | `(int32_t handle, Metrics*) → int32_t` | Get next frame index (returns < 0 when done) |
| `codec_anim_render_frame` | `(int32_t handle, int32_t frameIdx, Metrics*) → char*` | Render specific frame |
| `codec_anim_rewind` | `(int32_t handle) → int32_t` | Reset to frame 0 |
| `codec_anim_close` | `(int32_t handle)` | Free animation resources |
| `codec_anim_abort` | `(int32_t handle)` | Immediate abort |
| `codec_free_string` | `(char* s)` | Free ANSI string returned by render functions |

**Config struct** (36 bytes):
```
term_w, term_h (int32)  |  work_factor (float)  |  dither_mode, canvas_mode,
preprocessing, bg_color (int32)  |  max_frames (int32)  |  speed (float)
```

**Metrics struct** (36 bytes):
```
parse_ms, inflate_ms, defilter_ms, render_ms (float32)
img_w, img_h, frame_count, frame_delay_ms, format (int32)
```

## Node.js API

```ts
npm install static-chafa
```

```js
import { renderBuffer, animOpenBuffer, animNext, animRenderFrame, animClose } from "static-chafa";
import { readFileSync } from "fs";

const { ansi, metrics } = renderBuffer(readFileSync("cat.png"), { termW: 80, termH: 24 });
process.stdout.write(ansi);

const gif = animOpenBuffer(readFileSync("cat.gif"), { termW: 80, termH: 35 });
let frame;
while ((frame = animNext(gif.handle))) {
    process.stdout.write(animRenderFrame(gif.handle, frame.frameIndex).ansi);
}
animClose(gif.handle);
```

**Exports:** `renderBuffer`, `renderPath`, `animOpenBuffer`, `animNext`, `animRenderFrame`, `animRewind`, `animClose`, `animAbort`

**Types:** `RenderConfig` (all optional - `termW`, `termH`, `workFactor`, `ditherMode`, `canvasMode`, `preprocessing`, `bgColor`, `speed`, `maxFrames`), `RenderResult` (`{ ansi, metrics }`), `RenderMetrics` (parsing/rendering timings + image dimensions)

The main `static-chafa` package contains only JS/TS (the `dist/` directory produced by tsdown). Platform-specific `.node` binaries live in separate packages (`@static-chafa/linux-x64`, `@static-chafa/darwin-arm64`, etc.) that npm selects automatically via `os`/`cpu` constraints in `optionalDependencies`.

## Bun FFI (development)

```sh
bun run build:dev        # produces codec.so
bun run playground        # interactive benchmark
```

```ts
import { renderBuffer, openAnim } from "./src/ffi.ts";
```

## Project structure

```
src/          codec.c  ffi.ts  addon.c  index.ts  types.ts  stb_image.h
vendor/       chafa/ (glib shim, config, quarks)  napi/ (NAPI headers)
playground/   benchmark/player/validation scripts + test media
platforms/    linux-x64/  linux-arm64/  darwin-arm64/  win32-x64/ (package.json + .node)
dist/         index.cjs  index.mjs  index.d.cts  index.d.mts (tsdown output)
deps_src/     source tarballs for image codecs (auto-fetched)
deps/         built static libs per target (auto-generated)
build.sh      single build script for all targets
scripts/      build-platforms.sh  bump.sh
```

## Development commands

| Command | Does |
|---|---|
| `bun run build:dev` | Build `codec.so` for Bun FFI |
| `bun run build:napi` | Build native `.node` addon |
| `bun run build:platforms` | Cross-compile all `.node` files + tsdown + sync versions |
| `bun run build` | tsdown (JS dist only) |
| `bun run bump` | Bump version (patch/minor/major/x.y.z) across all packages |
| `bun run playground` | Interactive 4-section benchmark |

## Publish flow

```sh
bun run bump patch
bun run build:platforms
npm publish                                # main package (static-chafa)
cd platforms/linux-x64   && npm publish
cd platforms/linux-arm64 && npm publish
cd platforms/darwin-arm64 && npm publish
cd platforms/win32-x64   && npm publish
```
