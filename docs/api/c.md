# API Reference

## Classes

| Name | Description |
|------|-------------|
| [`CodecCtx`](#codecctx-1) | Per-instance rendering context. |
| [`CodecConfig`](#codecconfig) | Full chafa canvas configuration. |
| [`CodecMetrics`](#codecmetrics) | Per-operation timing and metadata. |

## Typedefs

{#codecctx}

### CodecCtx

```cpp
using CodecCtx = struct CodecCtx
```

## Functions

{#codec_ctx_new}

### codec_ctx_new

```cpp
CodecCtx * codec_ctx_new(CodecConfig * cfg)
```

Create a new rendering context with the given config (or defaults if NULL).

{#codec_ctx_free}

### codec_ctx_free

```cpp
void codec_ctx_free(CodecCtx * ctx)
```

Free the context and all associated resources (canvas, open animations).

{#codec_ctx_configure}

### codec_ctx_configure

```cpp
void codec_ctx_configure(CodecCtx * ctx, CodecConfig * cfg)
```

Update the context's configuration. Invalidates the cached canvas.

{#codec_decode_buffer}

### codec_decode_buffer

```cpp
uint8_t * codec_decode_buffer(char * data, int32_t len, int32_t * out_w, int32_t * out_h, int32_t * out_stride, CodecMetrics * out, int32_t * err)
```

Decode any supported format into a caller-owned RGBA buffer. Free with [codec_free()](#codec_free-1).

{#codec_render}

### codec_render

```cpp
char * codec_render(CodecCtx * ctx, char * data, int32_t len, CodecMetrics * out, int32_t * err)
```

Decode any supported format and render to an ANSI terminal art string.

{#codec_render_rgba}

### codec_render_rgba

```cpp
char * codec_render_rgba(CodecCtx * ctx, uint8_t * rgba, int32_t w, int32_t h, int32_t stride, CodecMetrics * out)
```

Render pre-decoded RGBA pixels to an ANSI terminal art string.

{#codec_render_matrix}

### codec_render_matrix

```cpp
char * codec_render_matrix(CodecCtx * ctx, char * data, int32_t len, CodecMetrics * out, int32_t * err)
```

Decode any supported format and render to a JSON-encoded cell matrix.

{#codec_render_matrix_rgba}

### codec_render_matrix_rgba

```cpp
char * codec_render_matrix_rgba(CodecCtx * ctx, uint8_t * rgba, int32_t w, int32_t h, int32_t stride, CodecMetrics * out)
```

Render pre-decoded RGBA pixels to a JSON-encoded cell matrix.

{#codec_anim_open}

### codec_anim_open

```cpp
int32_t codec_anim_open(CodecCtx * ctx, char * data, int32_t len, CodecMetrics * out, int32_t * err)
```

Open an animated GIF or WebP image. Returns handle index (>=0) or -1 on error.

{#codec_anim_next}

### codec_anim_next

```cpp
int32_t codec_anim_next(CodecCtx * ctx, int32_t handle, CodecMetrics * out)
```

Advance to the next frame. Returns frame index (>=0) or -1 when ended.

{#codec_anim_render_frame}

### codec_anim_render_frame

```cpp
char * codec_anim_render_frame(CodecCtx * ctx, int32_t handle, int32_t frame_idx, CodecMetrics * out)
```

Render a specific frame (by index) to ANSI. Returns allocated string, free with [codec_free()](#codec_free-1).

{#codec_anim_rewind}

### codec_anim_rewind

```cpp
int32_t codec_anim_rewind(CodecCtx * ctx, int32_t handle)
```

Rewind playback to the first frame. Returns 0 on success, -1 on error.

{#codec_anim_close}

### codec_anim_close

```cpp
void codec_anim_close(CodecCtx * ctx, int32_t handle)
```

Close the animation handle and free all its resources.

{#codec_anim_abort}

### codec_anim_abort

```cpp
void codec_anim_abort(CodecCtx * ctx, int32_t handle)
```

Signal early termination. The handle is marked aborted, no further frames advance.

{#codec_free}

### codec_free

```cpp
void codec_free(void * p)
```

Free any pointer returned by a codec_* function. Safe to call on NULL.

{#ctx_finalize}

### ctx_finalize

```cpp
static void ctx_finalize(napi_env env, void * data, void * hint)
```

{#rgba_buffer_finalize}

### rgba_buffer_finalize

```cpp
static void rgba_buffer_finalize(napi_env env, void * data, void * hint)
```

{#read_int32}

### read_int32

```cpp
static int read_int32(napi_env env, napi_value obj, const char * name, int32_t * out)
```

{#read_double}

### read_double

```cpp
static int read_double(napi_env env, napi_value obj, const char * name, double * out)
```

{#read_string}

### read_string

```cpp
static int read_string(napi_env env, napi_value obj, const char * name, char * out, size_t max_len)
```

{#read_config}

### read_config

```cpp
static void read_config(napi_env env, napi_value obj, CodecConfig * cfg)
```

{#create_metrics}

### create_metrics

```cpp
static napi_value create_metrics(napi_env env, CodecMetrics * m)
```

{#get_ctx}

### get_ctx

```cpp
static CodecCtx * get_ctx(napi_env env, napi_callback_info info)
```

{#chafa_create}

### chafa_create

```cpp
static napi_value chafa_create(napi_env env, napi_callback_info info)
```

{#chafa_configure}

### chafa_configure

```cpp
static napi_value chafa_configure(napi_env env, napi_callback_info info)
```

{#chafa_decode}

### chafa_decode

```cpp
static napi_value chafa_decode(napi_env env, napi_callback_info info)
```

{#chafa_render}

### chafa_render

```cpp
static napi_value chafa_render(napi_env env, napi_callback_info info)
```

{#chafa_render_rgba}

### chafa_render_rgba

```cpp
static napi_value chafa_render_rgba(napi_env env, napi_callback_info info)
```

{#chafa_render_matrix}

### chafa_render_matrix

```cpp
static napi_value chafa_render_matrix(napi_env env, napi_callback_info info)
```

{#chafa_render_matrix_rgba}

### chafa_render_matrix_rgba

```cpp
static napi_value chafa_render_matrix_rgba(napi_env env, napi_callback_info info)
```

{#chafa_anim_open}

### chafa_anim_open

```cpp
static napi_value chafa_anim_open(napi_env env, napi_callback_info info)
```

{#chafa_anim_next}

### chafa_anim_next

```cpp
static napi_value chafa_anim_next(napi_env env, napi_callback_info info)
```

{#chafa_anim_render_frame}

### chafa_anim_render_frame

```cpp
static napi_value chafa_anim_render_frame(napi_env env, napi_callback_info info)
```

{#chafa_anim_rewind}

### chafa_anim_rewind

```cpp
static napi_value chafa_anim_rewind(napi_env env, napi_callback_info info)
```

{#chafa_anim_close}

### chafa_anim_close

```cpp
static napi_value chafa_anim_close(napi_env env, napi_callback_info info)
```

{#chafa_anim_abort}

### chafa_anim_abort

```cpp
static napi_value chafa_anim_abort(napi_env env, napi_callback_info info)
```

{#chafa_free}

### chafa_free

```cpp
static napi_value chafa_free(napi_env env, napi_callback_info info)
```

{#init}

### Init

```cpp
napi_value Init(napi_env env, napi_value exports)
```

{#err_string}

### err_string

```cpp
static const char * err_string(int code)
```

{#now_ms}

### now_ms

```cpp
static double now_ms(void)
```

{#abs_i32}

### abs_i32

```cpp
static int32_t abs_i32(int32_t x)
```

{#detect_format}

### detect_format

```cpp
static int detect_format(const uint8_t * data, int32_t len)
```

{#decode_png}

### decode_png

```cpp
static int decode_png(uint8_t ** out, int * out_w, int * out_h, const uint8_t * buf, int32_t len)
```

{#jpg_init}

### jpg_init

```cpp
static void jpg_init(j_decompress_ptr c)
```

{#jpg_fill}

### jpg_fill

```cpp
static boolean jpg_fill(j_decompress_ptr c)
```

{#jpg_skip}

### jpg_skip

```cpp
static void jpg_skip(j_decompress_ptr c, long n)
```

{#jpg_error_exit}

### decode_jpeg

```cpp
static int decode_jpeg(uint8_t ** out, int * out_w, int * out_h, const uint8_t * buf, int32_t len)
```

{#decode_bmp}

### decode_bmp

```cpp
static int decode_bmp(uint8_t ** out, int * out_w, int * out_h, const uint8_t * buf, int32_t len)
```

{#decode_webp_static}

### decode_webp_static

```cpp
static int decode_webp_static(uint8_t ** out, int * out_w, int * out_h, const uint8_t * buf, int32_t len)
```

{#decode_gif}

### decode_gif

```cpp
static int decode_gif(uint8_t ** out, int * out_w, int * out_h, int * out_frames, const uint8_t * buf, int32_t len)
```

{#config_init}

### config_init

```cpp
static void config_init(CodecConfig * cfg)
```

{#codec_free-1}

### codec_free

```cpp
void codec_free(void * p)
```

Free any pointer returned by a codec_* function. Safe to call on NULL.

{#make_canvas_config}

### make_canvas_config

```cpp
static ChafaCanvasConfig * make_canvas_config(const CodecConfig * cfg)
```

{#ctx_invalidate_canvas}

### ctx_invalidate_canvas

```cpp
static void ctx_invalidate_canvas(CodecCtx * ctx)
```

{#ctx_ensure_canvas}

### ctx_ensure_canvas

```cpp
static int ctx_ensure_canvas(CodecCtx * ctx)
```

{#fill_canvas_metrics}

### fill_canvas_metrics

```cpp
static void fill_canvas_metrics(ChafaCanvas * canvas, CodecMetrics * m)
```

{#canvas_draw_and_build}

### canvas_draw_and_build

```cpp
static char * canvas_draw_and_build(ChafaCanvas * canvas, uint8_t * rgba, int32_t w, int32_t h, int32_t stride, CodecMetrics * m)
```

{#canvas_build_matrix}

### canvas_build_matrix

```cpp
static char * canvas_build_matrix(ChafaCanvas * canvas, CodecMetrics * m)
```

{#decode_image}

### decode_image

```cpp
static uint8_t * decode_image(const uint8_t * data, int32_t len, int * out_w, int * out_h, int * out_frames, CodecMetrics * out)
```

{#anim_create}

### anim_create

```cpp
static AnimHandle * anim_create(CodecCtx * ctx, AnimType type, uint8_t * rgba, int frames, int w, int h, uint8_t * raw_buf, int raw_len, CodecConfig * cfg)
```

{#codec_anim_frame_data}

### codec_anim_frame_data

```cpp
uint8_t * codec_anim_frame_data(CodecCtx * ctx, int32_t handle, int32_t frame_idx)
```

{#codecctx-1}

## CodecCtx

```cpp
struct CodecCtx
```

Defined in src/codec.c:444

Per-instance rendering context.

Holds a cached chafa canvas and up to 16 animation handles. Created by `[codec_ctx_new()](#codec_8c_1a8d3329a06afa0b1be7a15f4008b934bd)`, destroyed by `[codec_ctx_free()](#codec_8c_1a1cb8609c53a27f7993e70e3c927bf31b)`. All rendering functions require a valid context.

### List of all members

| Name | Kind | Owner |
|------|------|-------|
| [`canvas`](#canvas) | `variable` | Declared here |
| [`canvas_cfg`](#canvas_cfg) | `variable` | Declared here |
| [`cfg`](#cfg) | `variable` | Declared here |
| [`canvas_valid`](#canvas_valid) | `variable` | Declared here |
| [`handles`](#handles) | `variable` | Declared here |

### Public Attributes

| Return | Name | Description |
|--------|------|-------------|
| `ChafaCanvas *` | [`canvas`](#canvas)  |  |
| `ChafaCanvasConfig *` | [`canvas_cfg`](#canvas_cfg)  |  |
| `CodecConfig` | [`cfg`](#cfg)  |  |
| `int` | [`canvas_valid`](#canvas_valid)  |  |

---

{#canvas}

#### canvas

```cpp
ChafaCanvas * canvas
```

Defined in src/codec.c:446

---

{#canvas_cfg}

#### canvas_cfg

```cpp
ChafaCanvasConfig * canvas_cfg
```

Defined in src/codec.c:447

---

{#cfg}

#### cfg

```cpp
CodecConfig cfg
```

Defined in src/codec.c:448

---

{#canvas_valid}

#### canvas_valid

```cpp
int canvas_valid
```

Defined in src/codec.c:449

---

{#handles}

#### handles

```cpp
AnimHandle * handles
```

Defined in src/codec.c:450

{#jpg_err}

## jpg_err

```cpp
struct jpg_err
```

Defined in src/codec.c:243

### List of all members

| Name | Kind | Owner |
|------|------|-------|
| [`pub`](#pub) | `variable` | Declared here |
| [`jmp`](#jmp) | `variable` | Declared here |

### Public Attributes

| Return | Name | Description |
|--------|------|-------------|
| `struct jpeg_error_mgr` | [`pub`](#pub)  |  |
| `jmp_buf` | [`jmp`](#jmp)  |  |

---

{#pub}

#### pub

```cpp
struct jpeg_error_mgr pub
```

Defined in src/codec.c:245

---

{#jmp}

#### jmp

```cpp
jmp_buf jmp
```

Defined in src/codec.c:246

{#jpg_src}

## jpg_src

```cpp
struct jpg_src
```

Defined in src/codec.c:236

### List of all members

| Name | Kind | Owner |
|------|------|-------|
| [`pub`](#pub-1) | `variable` | Declared here |
| [`data`](#data) | `variable` | Declared here |
| [`len`](#len) | `variable` | Declared here |

### Public Attributes

| Return | Name | Description |
|--------|------|-------------|
| `struct jpeg_source_mgr` | [`pub`](#pub-1)  |  |
| `const uint8_t *` | [`data`](#data)  |  |
| `size_t` | [`len`](#len)  |  |

---

{#pub-1}

#### pub

```cpp
struct jpeg_source_mgr pub
```

Defined in src/codec.c:238

---

{#data}

#### data

```cpp
const uint8_t * data
```

Defined in src/codec.c:239

---

{#len}

#### len

```cpp
size_t len
```

Defined in src/codec.c:240

{#animhandle}

## AnimHandle

```cpp
struct AnimHandle
```

Defined in src/codec.c:422

### List of all members

| Name | Kind | Owner |
|------|------|-------|
| [`type`](#type) | `variable` | Declared here |
| [`rgbabuf`](#rgbabuf) | `variable` | Declared here |
| [`total_frames`](#total_frames) | `variable` | Declared here |
| [`frame_size`](#frame_size) | `variable` | Declared here |
| [`w`](#w) | `variable` | Declared here |
| [`h`](#h) | `variable` | Declared here |
| [`idx`](#idx) | `variable` | Declared here |
| [`delays`](#delays) | `variable` | Declared here |
| [`done`](#done) | `variable` | Declared here |
| [`aborted`](#aborted) | `variable` | Declared here |
| [`prev_ts`](#prev_ts) | `variable` | Declared here |
| [`webp_dec`](#webp_dec) | `variable` | Declared here |
| [`webp_buf`](#webp_buf) | `variable` | Declared here |
| [`webp_len`](#webp_len) | `variable` | Declared here |
| [`canvas`](#canvas-1) | `variable` | Declared here |
| [`canvas_cfg`](#canvas_cfg-1) | `variable` | Declared here |

### Public Attributes

| Return | Name | Description |
|--------|------|-------------|
| `AnimType` | [`type`](#type)  |  |
| `uint8_t *` | [`rgbabuf`](#rgbabuf)  |  |
| `int` | [`total_frames`](#total_frames)  |  |
| `int` | [`frame_size`](#frame_size)  |  |
| `int` | [`w`](#w)  |  |
| `int` | [`h`](#h)  |  |
| `int` | [`idx`](#idx)  |  |
| `int *` | [`delays`](#delays)  |  |
| `int` | [`done`](#done)  |  |
| `int` | [`aborted`](#aborted)  |  |
| `int` | [`prev_ts`](#prev_ts)  |  |
| `WebPAnimDecoder *` | [`webp_dec`](#webp_dec)  |  |
| `uint8_t *` | [`webp_buf`](#webp_buf)  |  |
| `int` | [`webp_len`](#webp_len)  |  |
| `ChafaCanvas *` | [`canvas`](#canvas-1)  |  |
| `ChafaCanvasConfig *` | [`canvas_cfg`](#canvas_cfg-1)  |  |

---

{#type}

#### type

```cpp
AnimType type
```

Defined in src/codec.c:424

---

{#rgbabuf}

#### rgbabuf

```cpp
uint8_t * rgbabuf
```

Defined in src/codec.c:425

---

{#total_frames}

#### total_frames

```cpp
int total_frames
```

Defined in src/codec.c:426

---

{#frame_size}

#### frame_size

```cpp
int frame_size
```

Defined in src/codec.c:426

---

{#w}

#### w

```cpp
int w
```

Defined in src/codec.c:426

---

{#h}

#### h

```cpp
int h
```

Defined in src/codec.c:426

---

{#idx}

#### idx

```cpp
int idx
```

Defined in src/codec.c:426

---

{#delays}

#### delays

```cpp
int * delays
```

Defined in src/codec.c:427

---

{#done}

#### done

```cpp
int done
```

Defined in src/codec.c:428

---

{#aborted}

#### aborted

```cpp
int aborted
```

Defined in src/codec.c:428

---

{#prev_ts}

#### prev_ts

```cpp
int prev_ts
```

Defined in src/codec.c:428

---

{#webp_dec}

#### webp_dec

```cpp
WebPAnimDecoder * webp_dec
```

Defined in src/codec.c:429

---

{#webp_buf}

#### webp_buf

```cpp
uint8_t * webp_buf
```

Defined in src/codec.c:430

---

{#webp_len}

#### webp_len

```cpp
int webp_len
```

Defined in src/codec.c:431

---

{#canvas-1}

#### canvas

```cpp
ChafaCanvas * canvas
```

Defined in src/codec.c:432

---

{#canvas_cfg-1}

#### canvas_cfg

```cpp
ChafaCanvasConfig * canvas_cfg
```

Defined in src/codec.c:433

{#codecconfig}

## CodecConfig

```cpp
struct CodecConfig
```

Defined in src/codec.c:144

Full chafa canvas configuration.

Maps 1:1 to chafa's `ChafaCanvasConfig` setters. The first 22 fields are numeric (int32/float); two 128-byte char buffers at the tail hold symbol selector strings. Total struct size: 344 bytes.

Must match byte-for-byte with the definition in [addon.c](#addonc).

### List of all members

| Name | Kind | Owner |
|------|------|-------|
| [`term_w`](#term_w) | `variable` | Declared here |
| [`term_h`](#term_h) | `variable` | Declared here |
| [`cell_w`](#cell_w) | `variable` | Declared here |
| [`cell_h`](#cell_h) | `variable` | Declared here |
| [`work_factor`](#work_factor) | `variable` | Declared here |
| [`dither_mode`](#dither_mode) | `variable` | Declared here |
| [`canvas_mode`](#canvas_mode) | `variable` | Declared here |
| [`preprocessing`](#preprocessing) | `variable` | Declared here |
| [`color_extractor`](#color_extractor) | `variable` | Declared here |
| [`color_space`](#color_space) | `variable` | Declared here |
| [`pixel_mode`](#pixel_mode) | `variable` | Declared here |
| [`bg_color`](#bg_color) | `variable` | Declared here |
| [`fg_color`](#fg_color) | `variable` | Declared here |
| [`alpha_threshold`](#alpha_threshold) | `variable` | Declared here |
| [`dither_grain_w`](#dither_grain_w) | `variable` | Declared here |
| [`dither_grain_h`](#dither_grain_h) | `variable` | Declared here |
| [`dither_intensity`](#dither_intensity) | `variable` | Declared here |
| [`fg_only`](#fg_only) | `variable` | Declared here |
| [`optimizations`](#optimizations) | `variable` | Declared here |
| [`passthrough`](#passthrough) | `variable` | Declared here |
| [`max_frames`](#max_frames) | `variable` | Declared here |
| [`speed`](#speed) | `variable` | Declared here |
| [`symbols`](#symbols) | `variable` | Declared here |
| [`fill_symbols`](#fill_symbols) | `variable` | Declared here |

### Public Attributes

| Return | Name | Description |
|--------|------|-------------|
| `int32_t` | [`term_w`](#term_w)  |  |
| `int32_t` | [`term_h`](#term_h)  |  |
| `int32_t` | [`cell_w`](#cell_w)  |  |
| `int32_t` | [`cell_h`](#cell_h)  |  |
| `float` | [`work_factor`](#work_factor)  |  |
| `int32_t` | [`dither_mode`](#dither_mode)  |  |
| `int32_t` | [`canvas_mode`](#canvas_mode)  |  |
| `int32_t` | [`preprocessing`](#preprocessing)  |  |
| `int32_t` | [`color_extractor`](#color_extractor)  |  |
| `int32_t` | [`color_space`](#color_space)  |  |
| `int32_t` | [`pixel_mode`](#pixel_mode)  |  |
| `int32_t` | [`bg_color`](#bg_color)  |  |
| `int32_t` | [`fg_color`](#fg_color)  |  |
| `int32_t` | [`alpha_threshold`](#alpha_threshold)  |  |
| `int32_t` | [`dither_grain_w`](#dither_grain_w)  |  |
| `int32_t` | [`dither_grain_h`](#dither_grain_h)  |  |
| `float` | [`dither_intensity`](#dither_intensity)  |  |
| `int32_t` | [`fg_only`](#fg_only)  |  |
| `int32_t` | [`optimizations`](#optimizations)  |  |
| `int32_t` | [`passthrough`](#passthrough)  |  |
| `int32_t` | [`max_frames`](#max_frames)  |  |
| `float` | [`speed`](#speed)  |  |
| `char` | [`symbols`](#symbols)  |  |
| `char` | [`fill_symbols`](#fill_symbols)  |  |

---

{#term_w}

#### term_w

```cpp
int32_t term_w
```

Defined in src/codec.c:146

---

{#term_h}

#### term_h

```cpp
int32_t term_h
```

Defined in src/codec.c:146

---

{#cell_w}

#### cell_w

```cpp
int32_t cell_w
```

Defined in src/codec.c:147

---

{#cell_h}

#### cell_h

```cpp
int32_t cell_h
```

Defined in src/codec.c:147

---

{#work_factor}

#### work_factor

```cpp
float work_factor
```

Defined in src/codec.c:148

---

{#dither_mode}

#### dither_mode

```cpp
int32_t dither_mode
```

Defined in src/codec.c:149

---

{#canvas_mode}

#### canvas_mode

```cpp
int32_t canvas_mode
```

Defined in src/codec.c:149

---

{#preprocessing}

#### preprocessing

```cpp
int32_t preprocessing
```

Defined in src/codec.c:149

---

{#color_extractor}

#### color_extractor

```cpp
int32_t color_extractor
```

Defined in src/codec.c:150

---

{#color_space}

#### color_space

```cpp
int32_t color_space
```

Defined in src/codec.c:150

---

{#pixel_mode}

#### pixel_mode

```cpp
int32_t pixel_mode
```

Defined in src/codec.c:150

---

{#bg_color}

#### bg_color

```cpp
int32_t bg_color
```

Defined in src/codec.c:151

---

{#fg_color}

#### fg_color

```cpp
int32_t fg_color
```

Defined in src/codec.c:151

---

{#alpha_threshold}

#### alpha_threshold

```cpp
int32_t alpha_threshold
```

Defined in src/codec.c:152

---

{#dither_grain_w}

#### dither_grain_w

```cpp
int32_t dither_grain_w
```

Defined in src/codec.c:153

---

{#dither_grain_h}

#### dither_grain_h

```cpp
int32_t dither_grain_h
```

Defined in src/codec.c:153

---

{#dither_intensity}

#### dither_intensity

```cpp
float dither_intensity
```

Defined in src/codec.c:154

---

{#fg_only}

#### fg_only

```cpp
int32_t fg_only
```

Defined in src/codec.c:155

---

{#optimizations}

#### optimizations

```cpp
int32_t optimizations
```

Defined in src/codec.c:155

---

{#passthrough}

#### passthrough

```cpp
int32_t passthrough
```

Defined in src/codec.c:155

---

{#max_frames}

#### max_frames

```cpp
int32_t max_frames
```

Defined in src/codec.c:156

---

{#speed}

#### speed

```cpp
float speed
```

Defined in src/codec.c:157

---

{#symbols}

#### symbols

```cpp
char symbols
```

Defined in src/codec.c:158

---

{#fill_symbols}

#### fill_symbols

```cpp
char fill_symbols
```

Defined in src/codec.c:159

{#codecmetrics}

## CodecMetrics

```cpp
struct CodecMetrics
```

Defined in src/codec.c:170

Per-operation timing and metadata.

All times are in milliseconds on the monotonic clock. The struct is 68 bytes (4 floats + 13 int32s). Must match byte-for-byte with [addon.c](#addonc).

### List of all members

| Name | Kind | Owner |
|------|------|-------|
| [`parse_ms`](#parse_ms) | `variable` | Declared here |
| [`draw_ms`](#draw_ms) | `variable` | Declared here |
| [`build_ms`](#build_ms) | `variable` | Declared here |
| [`total_ms`](#total_ms) | `variable` | Declared here |
| [`img_w`](#img_w) | `variable` | Declared here |
| [`img_h`](#img_h) | `variable` | Declared here |
| [`canvas_w`](#canvas_w) | `variable` | Declared here |
| [`canvas_h`](#canvas_h) | `variable` | Declared here |
| [`canvas_pw`](#canvas_pw) | `variable` | Declared here |
| [`canvas_ph`](#canvas_ph) | `variable` | Declared here |
| [`frame_count`](#frame_count) | `variable` | Declared here |
| [`frame_delay_ms`](#frame_delay_ms) | `variable` | Declared here |
| [`rgba_bytes`](#rgba_bytes) | `variable` | Declared here |
| [`format`](#format) | `variable` | Declared here |
| [`canvas_mode`](#canvas_mode-1) | `variable` | Declared here |
| [`pixel_mode`](#pixel_mode-1) | `variable` | Declared here |
| [`have_alpha`](#have_alpha) | `variable` | Declared here |

### Public Attributes

| Return | Name | Description |
|--------|------|-------------|
| `float` | [`parse_ms`](#parse_ms)  |  |
| `float` | [`draw_ms`](#draw_ms)  |  |
| `float` | [`build_ms`](#build_ms)  |  |
| `float` | [`total_ms`](#total_ms)  |  |
| `int32_t` | [`img_w`](#img_w)  |  |
| `int32_t` | [`img_h`](#img_h)  |  |
| `int32_t` | [`canvas_w`](#canvas_w)  |  |
| `int32_t` | [`canvas_h`](#canvas_h)  |  |
| `int32_t` | [`canvas_pw`](#canvas_pw)  |  |
| `int32_t` | [`canvas_ph`](#canvas_ph)  |  |
| `int32_t` | [`frame_count`](#frame_count)  |  |
| `int32_t` | [`frame_delay_ms`](#frame_delay_ms)  |  |
| `int32_t` | [`rgba_bytes`](#rgba_bytes)  |  |
| `int32_t` | [`format`](#format)  |  |
| `int32_t` | [`canvas_mode`](#canvas_mode-1)  |  |
| `int32_t` | [`pixel_mode`](#pixel_mode-1)  |  |
| `int32_t` | [`have_alpha`](#have_alpha)  |  |

---

{#parse_ms}

#### parse_ms

```cpp
float parse_ms
```

Defined in src/codec.c:172

---

{#draw_ms}

#### draw_ms

```cpp
float draw_ms
```

Defined in src/codec.c:172

---

{#build_ms}

#### build_ms

```cpp
float build_ms
```

Defined in src/codec.c:172

---

{#total_ms}

#### total_ms

```cpp
float total_ms
```

Defined in src/codec.c:172

---

{#img_w}

#### img_w

```cpp
int32_t img_w
```

Defined in src/codec.c:173

---

{#img_h}

#### img_h

```cpp
int32_t img_h
```

Defined in src/codec.c:173

---

{#canvas_w}

#### canvas_w

```cpp
int32_t canvas_w
```

Defined in src/codec.c:174

---

{#canvas_h}

#### canvas_h

```cpp
int32_t canvas_h
```

Defined in src/codec.c:174

---

{#canvas_pw}

#### canvas_pw

```cpp
int32_t canvas_pw
```

Defined in src/codec.c:174

---

{#canvas_ph}

#### canvas_ph

```cpp
int32_t canvas_ph
```

Defined in src/codec.c:174

---

{#frame_count}

#### frame_count

```cpp
int32_t frame_count
```

Defined in src/codec.c:175

---

{#frame_delay_ms}

#### frame_delay_ms

```cpp
int32_t frame_delay_ms
```

Defined in src/codec.c:175

---

{#rgba_bytes}

#### rgba_bytes

```cpp
int32_t rgba_bytes
```

Defined in src/codec.c:176

---

{#format}

#### format

```cpp
int32_t format
```

Defined in src/codec.c:177

---

{#canvas_mode-1}

#### canvas_mode

```cpp
int32_t canvas_mode
```

Defined in src/codec.c:177

---

{#pixel_mode-1}

#### pixel_mode

```cpp
int32_t pixel_mode
```

Defined in src/codec.c:177

---

{#have_alpha}

#### have_alpha

```cpp
int32_t have_alpha
```

Defined in src/codec.c:177

Generated by [Moxygen](https://0state.com/moxygen)