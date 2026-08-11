# chafa-ts-multirt

GPU-less terminal image rendering. Decodes PNG/JPEG/BMP/WebP/GIF (static + animated) in native C, renders to ANSI half-block characters via libchafa, returns ANSI strings to JS/TS via Bun FFI. Single `codec.so` shared library.

## Files

| File | Purpose |
|---|---|
| `codec.c` | Unified C library — all decoders + chafa renderer + animation streaming |
| `codec.so` | Compiled shared library (build with `gcc`) |
| `codec.ts` | Bun FFI bindings — typed config, metrics, `renderBuffer()`, `openAnim()` |
| `stb_image.h` | Header-only GIF decoder (Sean Barrett, public domain) |
| `img3.ts` | Interactive benchmark — 4 sections with static, animated, max-speed tests |
| `img2.ts` | Simple benchmark — all formats at fixed terminal size |
| `play2.ts` | Animated WebP/GIF player with speed control |

## Pipeline

```
JS (img3.ts / play2.ts)
  │
  ├─ renderBuffer(buf, config)  ──→  codec.so:codec_render_buffer()
  │     │                                │
  │     │  detect format (magic bytes)   │
  │     │  decode → RGBA                 │
  │     │  chafa draw_all_pixels         │
  │     │  chafa build_ansi → GString    │
  │     │  GString → char*               │
  │     │  JS reads via CString          │
  │     │  free char* via codec_free_string
  │     │  return { ansi, metrics }
  │
  └─ openAnim(buf, config)  ──→  codec.so:codec_anim_open_buffer()
        │                              │
        │  player.next()       ←──  codec_anim_next()
        │  player.renderFrame() ←──  codec_anim_render_frame()
        │  player.rewind()      ←──  codec_anim_rewind()
        │  player.close()       ←──  codec_anim_close()
        │
        └─ GIF: stbi_load_gif_from_memory → pre-decode all frames
           WebP: WebPAnimDecoderNew → frame-by-frame decode on next()
```

## C codec overview (`codec.c`)

### Format detection
`detect_format()` — checks magic bytes (PNG 89 P N G, JPEG FF D8 FF, BMP BM, GIF G I F, WebP R I F F / W E B P)

### Decoders
- **PNG** — libpng simplified API (`png_image_begin_read_from_memory` + `png_image_finish_read`), RGBA output
- **JPEG** — libjpeg memory source manager, decompress to RGBA
- **BMP** — custom raw parser (24/32-bit, top-down/bottom-up, BGR→RGB swap), no lib needed
- **WebP** — libwebp `WebPDecodeRGBAInto` (static), `WebPAnimDecoder` API (animated, frame-by-frame)
- **GIF** — stb_image `stbi_load_gif_from_memory` (all frames upfront, stores delays)

### Chafa rendering
`ensure_canvas()` — creates/reuses a chafa canvas with config (term dimensions, work_factor=0, dither=off, preprocessing=off)
`chafa_render_to()` — `draw_all_pixels` + `build_ansi` → GString → strdup'd char*

### Animation streaming
`AnimHandle` — holds frame data, decoder state, per-handle chafa canvas (isolation from static rendering)
- **GIF**: all frames pre-decoded by stb_image, rewind sets idx=0
- **WebP**: `WebPAnimDecoder` sequential, rewind re-creates decoder from saved buffer

### Error handling
All public functions return an `int32_t* err` code + descriptive error string.
Error codes: unknown format, file errors, decode failures, bad dimensions, pool overflow, etc.

### Metrics
`CodecMetrics` struct: parse_ms, inflate_ms, defilter_ms, render_ms, img_w, img_h, frame_count, frame_delay_ms, format

## Build

```sh
gcc -O3 -fPIC -shared -o codec.so codec.c \
    $(pkg-config --cflags chafa libpng16) \
    -lchafa -lpng16 -ljpeg -lwebp -lwebpdemux -lz -lm
```

## Static linking (cross-platform bundling)

For a self-contained shared library with no runtime deps, these need to be linked statically:

| Library | Why static-link | Approach |
|---|---|---|
| **libchafa** | Terminal renderer, not on Windows, optional on macOS | Build from source with `-fPIC` or keep dynamic (simplifies GLib dependency) |
| **libglib-2.0** | Chafa's dependency | Only needed if chafa is static-linked; large/complex dependency chain (pcre, ffi, etc.) |
| **libwebp / libwebpdemux** | Not guaranteed on Windows | Build from source with `-fPIC`, ~200KB |
| **libjpeg / libjpeg-turbo** | Not guaranteed on Windows, but common | Build from source with `-fPIC` for portability |
| **libpng** | PNG decode, common but not universal | Build from source with `-fPIC` |
| **libz** | zlib inflate (used by PNG/libpng) | Available everywhere, dynamic OK |
| **stb_image.h** | GIF/BMP decode | Header-only, compiled in — no external dep |
| **libm / libpthread** | System libs | Always available, no static-link needed |

**Recommended approach**: keep chafa+glib dynamic (system packages), static-link the image decoders (webp, jpeg, png, z) by building from source with `-fPIC`. System static libs lack `-fPIC` and can't go into shared libraries. Platform-specific CI builds handle the rest.

## Run

```sh
# Interactive benchmark with 4 sections
bun run img3.ts

# Simple benchmark (all formats, 80x35)
bun run img2.ts

# Animated playback (WebP, 10x speed)
bun run play2.ts
```
