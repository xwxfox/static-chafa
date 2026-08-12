# C API Reference

The native C API is exposed via `codec.so` / `static_chafa.node`.
All functions are declared in `src/codec.c` with Doxygen-style documentation.

## Context

### `CodecCtx`

Per-instance rendering context. Holds a cached chafa canvas and up to 16
animation handles. Created by `codec_ctx_new()`, destroyed by `codec_ctx_free()`.

```c
CodecCtx *codec_ctx_new(CodecConfig *cfg);
void codec_ctx_free(CodecCtx *ctx);
void codec_ctx_configure(CodecCtx *ctx, CodecConfig *cfg);
```

## Configuration

### `CodecConfig`

344-byte struct mapping 1:1 to chafa's `ChafaCanvasConfig` setters.
Contains 22 numeric fields (int32/float) and two 128-byte symbol selector strings.

## Metrics

### `CodecMetrics`

68-byte struct (4 floats + 13 int32s) returned with every operation:

| Field | Type | Description |
|-------|------|-------------|
| `parse_ms` | float | Total decode time (ms) |
| `draw_ms` | float | `chafa_canvas_draw_all_pixels` time (ms) |
| `build_ms` | float | `chafa_canvas_print` time (ms) |
| `total_ms` | float | parse + draw + build |
| `img_w`, `img_h` | int32 | Source image dimensions (pixels) |
| `canvas_w`, `canvas_h` | int32 | Cell grid dimensions |
| `canvas_pw`, `canvas_ph` | int32 | Internal pixel canvas size |
| `frame_count` | int32 | Total frames (-1 = unknown) |
| `frame_delay_ms` | int32 | Delay before next frame |
| `rgba_bytes` | int32 | Decoded RGBA buffer size |
| `format` | int32 | Image format (0=PNG, 1=JPEG, 2=BMP, 3=GIF, 4=WebP) |
| `canvas_mode` | int32 | Active `ChafaCanvasMode` |
| `pixel_mode` | int32 | Active `ChafaPixelMode` |
| `have_alpha` | int32 | Source had alpha channel |

## Decode

```c
// Decode to caller-owned buffer (free with codec_free)
uint8_t *codec_decode_buffer(char *data, int32_t len,
    int32_t *out_w, int32_t *out_h, int32_t *out_stride,
    CodecMetrics *out, int32_t *err);

// Decode into caller-provided buffer (returns 0 on success)
int codec_decode_into(char *data, int32_t len,
    uint8_t *rgba_out, int32_t rgba_cap,
    int32_t *out_w, int32_t *out_h, int32_t *out_stride,
    CodecMetrics *out, int32_t *err);
```

## Render

```c
// Decode + render -> ANSI string
char *codec_render(CodecCtx *ctx, char *data, int32_t len,
    CodecMetrics *out, int32_t *err);

// Pre-decoded RGBA -> ANSI string
char *codec_render_rgba(CodecCtx *ctx, uint8_t *rgba,
    int32_t w, int32_t h, int32_t stride, CodecMetrics *out);

// Decode + render -> JSON cell matrix
char *codec_render_matrix(CodecCtx *ctx, char *data, int32_t len,
    CodecMetrics *out, int32_t *err);

// Pre-decoded RGBA -> JSON cell matrix
char *codec_render_matrix_rgba(CodecCtx *ctx, uint8_t *rgba,
    int32_t w, int32_t h, int32_t stride, CodecMetrics *out);
```

All returned strings must be freed with `codec_free()`.

## Animation

```c
int32_t codec_anim_open(CodecCtx *ctx, char *data, int32_t len,
    CodecMetrics *out, int32_t *err);
int32_t codec_anim_next(CodecCtx *ctx, int32_t handle, CodecMetrics *out);
char *codec_anim_render_frame(CodecCtx *ctx, int32_t handle, int32_t frame_idx,
    CodecMetrics *out);
int32_t codec_anim_rewind(CodecCtx *ctx, int32_t handle);
void codec_anim_close(CodecCtx *ctx, int32_t handle);
void codec_anim_abort(CodecCtx *ctx, int32_t handle);
```

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| 0 | `ERR_OK` | Success |
| -1 | `ERR_UNKNOWN_FMT` | Unrecognized image format |
| -4 | `ERR_FILE_EMPTY` | Empty buffer |
| -5 | `ERR_MALLOC` | Memory allocation failed |
| -8 | `ERR_DIMENSIONS` | Invalid image dimensions |
| -9 | `ERR_DECODE_FAIL` | Codec-specific decode failure |
| -12 | `ERR_BAD_PARAMS` | Invalid parameters |

## Memory

```c
void codec_free(void *p);  // Free any pointer from codec_* functions
```
