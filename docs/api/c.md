# API Reference

## Classes

| Name | Description |
|------|-------------|
| [`MemIO`](#memio) |  |
| [`CodecCtx`](#codecctx-1) | Per-instance rendering context. |
| [`CodecConfig`](#codecconfig) | Full chafa canvas configuration. |
| [`VideoHandle`](#videohandle-1) |  |
| [`VideoStatus`](#videostatus) |  |
| [`CodecMetrics`](#codecmetrics) | Per-operation timing and metadata. |
| [`FFmpegVTable`](#ffmpegvtable) |  |

## Typedefs

{#codecctx}

### CodecCtx

```cpp
using CodecCtx = struct CodecCtx
```

{#videohandle}

### VideoHandle

```cpp
using VideoHandle = struct VideoHandle
```

{#p_avcodec_send_packet}

### P_avcodec_send_packet

```cpp
using P_avcodec_send_packet = int(*
```

{#p_avcodec_receive_frame}

### P_avcodec_receive_frame

```cpp
using P_avcodec_receive_frame = int(*
```

{#p_avcodec_find_decoder}

### P_avcodec_find_decoder

```cpp
using P_avcodec_find_decoder = AVCodec *(*
```

{#p_avcodec_alloc_context3}

### P_avcodec_alloc_context3

```cpp
using P_avcodec_alloc_context3 = AVCodecContext *(*
```

{#p_avcodec_open2}

### P_avcodec_open2

```cpp
using P_avcodec_open2 = int(*
```

{#p_avcodec_close}

### P_avcodec_close

```cpp
using P_avcodec_close = int(*
```

{#p_avcodec_free_context}

### P_avcodec_free_context

```cpp
using P_avcodec_free_context = void(*
```

{#p_avcodec_flush_buffers}

### P_avcodec_flush_buffers

```cpp
using P_avcodec_flush_buffers = void(*
```

{#p_avcodec_parameters_to_context}

### P_avcodec_parameters_to_context

```cpp
using P_avcodec_parameters_to_context = int(*
```

{#p_avcodec_get_name}

### P_avcodec_get_name

```cpp
using P_avcodec_get_name = char *(*
```

{#p_avcodec_license}

### P_avcodec_license

```cpp
using P_avcodec_license = const char *(*
```

{#p_avformat_open_input}

### P_avformat_open_input

```cpp
using P_avformat_open_input = int(*
```

{#p_avformat_close_input}

### P_avformat_close_input

```cpp
using P_avformat_close_input = void(*
```

{#p_avformat_alloc_context}

### P_avformat_alloc_context

```cpp
using P_avformat_alloc_context = AVFormatContext *(*
```

{#p_avformat_find_stream_info}

### P_avformat_find_stream_info

```cpp
using P_avformat_find_stream_info = int(*
```

{#p_av_read_frame}

### P_av_read_frame

```cpp
using P_av_read_frame = int(*
```

{#p_av_seek_frame}

### P_av_seek_frame

```cpp
using P_av_seek_frame = int(*
```

{#p_avformat_seek_file}

### P_avformat_seek_file

```cpp
using P_avformat_seek_file = int(*
```

{#p_av_packet_unref}

### P_av_packet_unref

```cpp
using P_av_packet_unref = void(*
```

{#p_avformat_network_init}

### P_avformat_network_init

```cpp
using P_avformat_network_init = void(*
```

{#p_av_init_packet}

### P_av_init_packet

```cpp
using P_av_init_packet = void(*
```

{#p_av_frame_alloc}

### P_av_frame_alloc

```cpp
using P_av_frame_alloc = AVFrame *(*
```

{#p_av_frame_unref}

### P_av_frame_unref

```cpp
using P_av_frame_unref = void(*
```

{#p_av_frame_free}

### P_av_frame_free

```cpp
using P_av_frame_free = void(*
```

{#p_avio_context_free}

### P_avio_context_free

```cpp
using P_avio_context_free = void(*
```

{#p_av_malloc}

### P_av_malloc

```cpp
using P_av_malloc = void *(*
```

{#p_av_free}

### P_av_free

```cpp
using P_av_free = void(*
```

{#p_av_freep}

### P_av_freep

```cpp
using P_av_freep = void(*
```

{#p_av_strerror}

### P_av_strerror

```cpp
using P_av_strerror = int(*
```

{#p_av_dict_set}

### P_av_dict_set

```cpp
using P_av_dict_set = int(*
```

{#p_av_dict_free}

### P_av_dict_free

```cpp
using P_av_dict_free = void(*
```

{#p_sws_getcontext}

### P_sws_getContext

```cpp
using P_sws_getContext = struct SwsContext *(*
```

{#p_sws_scale}

### P_sws_scale

```cpp
using P_sws_scale = int(*
```

{#p_sws_freecontext}

### P_sws_freeContext

```cpp
using P_sws_freeContext = void(*
```

{#p_avio_alloc_context}

### P_avio_alloc_context

```cpp
using P_avio_alloc_context = AVIOContext *(*
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

{#codec_video_open}

### codec_video_open

```cpp
int32_t codec_video_open(CodecCtx * ctx, char * data, int32_t len, int32_t decode_w, int32_t decode_h, CodecMetrics * out, int32_t * err)
```

{#codec_video_next}

### codec_video_next

```cpp
int32_t codec_video_next(CodecCtx * ctx, int32_t handle, uint8_t * out_rgba, int32_t out_cap, int32_t * out_w, int32_t * out_h, double * out_pts, CodecMetrics * out)
```

{#codec_video_seek}

### codec_video_seek

```cpp
int32_t codec_video_seek(CodecCtx * ctx, int32_t handle, double target_sec)
```

{#codec_video_info}

### codec_video_info

```cpp
int32_t codec_video_info(CodecCtx * ctx, int32_t handle, int32_t * out_w, int32_t * out_h, double * out_duration, double * out_fps, int32_t * out_has_audio, char * audio_codec, int32_t * audio_rate, int32_t * audio_ch)
```

{#codec_video_close}

### codec_video_close

```cpp
void codec_video_close(CodecCtx * ctx, int32_t handle)
```

{#codec_video_error}

### codec_video_error

```cpp
const char * codec_video_error(void)
```

{#chafa_video_open}

### chafa_video_open

```cpp
static napi_value chafa_video_open(napi_env env, napi_callback_info info)
```

{#chafa_video_next}

### chafa_video_next

```cpp
static napi_value chafa_video_next(napi_env env, napi_callback_info info)
```

{#chafa_video_info}

### chafa_video_info

```cpp
static napi_value chafa_video_info(napi_env env, napi_callback_info info)
```

{#chafa_video_seek}

### chafa_video_seek

```cpp
static napi_value chafa_video_seek(napi_env env, napi_callback_info info)
```

{#chafa_video_close}

### chafa_video_close

```cpp
static napi_value chafa_video_close(napi_env env, napi_callback_info info)
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

{#codec_ctx_get_video_slots}

### codec_ctx_get_video_slots

```cpp
void ** codec_ctx_get_video_slots(CodecCtx * ctx)
```

{#codec_ctx_get_video_handle}

### codec_ctx_get_video_handle

```cpp
void * codec_ctx_get_video_handle(CodecCtx * ctx, int slot)
```

{#codec_ctx_set_video_handle}

### codec_ctx_set_video_handle

```cpp
void codec_ctx_set_video_handle(CodecCtx * ctx, int slot, void * handle)
```

{#codec_video_open_handle}

### codec_video_open_handle

```cpp
int32_t codec_video_open_handle(CodecCtx * ctx, VideoHandle * vh)
```

{#codec_video_close-1}

### codec_video_close

```cpp
void codec_video_close(CodecCtx * ctx, int32_t handle)
```

{#try_open}

### try_open

```cpp
static void * try_open(const char *const * names)
```

{#ff_init}

### ff_init

```cpp
static int ff_init(void)
```

{#rescale_q_inline}

### rescale_q_inline

```cpp
static inline int64_t rescale_q_inline(int64_t a, AVRational bq, AVRational cq)
```

{#memio_read}

### memio_read

```cpp
static int memio_read(void * opaque, uint8_t * buf, int sz)
```

{#memio_seek}

### memio_seek

```cpp
static int64_t memio_seek(void * opaque, int64_t off, int whence)
```

{#codec_video_open-1}

### codec_video_open

```cpp
int codec_video_open(CodecCtx * ctx, char * data, int32_t len, int32_t decode_w, int32_t decode_h, CodecMetrics * out, int32_t * err)
```

{#video_decode_into}

### video_decode_into

```cpp
static int video_decode_into(VideoHandle * vh)
```

{#codec_video_next-1}

### codec_video_next

```cpp
int32_t codec_video_next(CodecCtx * ctx, int32_t handle, uint8_t * out_rgba, int32_t out_cap, int32_t * out_w, int32_t * out_h, double * out_pts, CodecMetrics * out)
```

{#codec_video_info-1}

### codec_video_info

```cpp
int32_t codec_video_info(CodecCtx * ctx, int32_t handle, int32_t * out_w, int32_t * out_h, double * out_duration, double * out_fps, int32_t * out_has_audio, char * audio_codec, int32_t * audio_rate, int32_t * audio_ch)
```

{#codec_video_error-1}

### codec_video_error

```cpp
const char * codec_video_error(void)
```

{#wall_ms}

### wall_ms

```cpp
static double wall_ms(void)
```

{#codec_video_status}

### codec_video_status

```cpp
int32_t codec_video_status(CodecCtx * ctx, int32_t handle, VideoStatus * out)
```

{#codec_video_play}

### codec_video_play

```cpp
void codec_video_play(CodecCtx * ctx, int32_t handle, double speed)
```

{#codec_video_pause}

### codec_video_pause

```cpp
void codec_video_pause(CodecCtx * ctx, int32_t handle)
```

{#codec_video_seek-1}

### codec_video_seek

```cpp
int32_t codec_video_seek(CodecCtx * ctx, int32_t handle, double target_sec)
```

## Variables

{#ff}

### ff

```cpp
FFmpegVTable ff = {0}
```

{#ff_tried}

### ff_tried

```cpp
int ff_tried = 0
```

{#soname_avcodec}

### SONAME_AVCODEC

```cpp
const char * SONAME_AVCODEC                                   = {
    "libavcodec.so.62", "libavcodec.so.61", "libavcodec.so.60",
    "libavcodec.so.59", "libavcodec.so.58", NULL
}
```

{#soname_avformat}

### SONAME_AVFORMAT

```cpp
const char * SONAME_AVFORMAT                                   = {
    "libavformat.so.62", "libavformat.so.61", "libavformat.so.60",
    "libavformat.so.59", "libavformat.so.58", NULL
}
```

{#soname_avutil}

### SONAME_AVUTIL

```cpp
const char * SONAME_AVUTIL                                 = {
    "libavutil.so.60", "libavutil.so.59", "libavutil.so.58",
    "libavutil.so.57", "libavutil.so.56", NULL
}
```

{#soname_swscale}

### SONAME_SWSCALE

```cpp
const char * SONAME_SWSCALE                                  = {
    "libswscale.so.8", "libswscale.so.7", "libswscale.so.6",
    "libswscale.so.5", NULL
}
```

{#memio}

## MemIO

```cpp
struct MemIO
```

Defined in src/codec_video.c:294

### List of all members

| Name | Kind | Owner |
|------|------|-------|
| [`data`](#data) | `variable` | Declared here |
| [`pos`](#pos) | `variable` | Declared here |
| [`len`](#len) | `variable` | Declared here |

### Public Attributes

| Return | Name | Description |
|--------|------|-------------|
| `const uint8_t *` | [`data`](#data)  |  |
| `size_t` | [`pos`](#pos)  |  |
| `size_t` | [`len`](#len)  |  |

---

{#data}

#### data

```cpp
const uint8_t * data
```

Defined in src/codec_video.c:295

---

{#pos}

#### pos

```cpp
size_t pos
```

Defined in src/codec_video.c:296

---

{#len}

#### len

```cpp
size_t len
```

Defined in src/codec_video.c:296

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
| [`video_handles`](#video_handles) | `variable` | Declared here |

### Public Attributes

| Return | Name | Description |
|--------|------|-------------|
| `ChafaCanvas *` | [`canvas`](#canvas)  |  |
| `ChafaCanvasConfig *` | [`canvas_cfg`](#canvas_cfg)  |  |
| `CodecConfig` | [`cfg`](#cfg)  |  |
| `int` | [`canvas_valid`](#canvas_valid)  |  |
| `void *` | [`video_handles`](#video_handles)  |  |

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

---

{#video_handles}

#### video_handles

```cpp
void * video_handles
```

Defined in src/codec.c:451

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
| [`data`](#data-1) | `variable` | Declared here |
| [`len`](#len-1) | `variable` | Declared here |

### Public Attributes

| Return | Name | Description |
|--------|------|-------------|
| `struct jpeg_source_mgr` | [`pub`](#pub-1)  |  |
| `const uint8_t *` | [`data`](#data-1)  |  |
| `size_t` | [`len`](#len-1)  |  |

---

{#pub-1}

#### pub

```cpp
struct jpeg_source_mgr pub
```

Defined in src/codec.c:238

---

{#data-1}

#### data

```cpp
const uint8_t * data
```

Defined in src/codec.c:239

---

{#len-1}

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

{#videohandle-1}

## VideoHandle

```cpp
struct VideoHandle
```

Defined in src/codec_video.c:328

### List of all members

| Name | Kind | Owner |
|------|------|-------|
| [`fmt_ctx`](#fmt_ctx) | `variable` | Declared here |
| [`codec_ctx`](#codec_ctx) | `variable` | Declared here |
| [`video_stream_idx`](#video_stream_idx) | `variable` | Declared here |
| [`audio_stream_idx`](#audio_stream_idx) | `variable` | Declared here |
| [`sws_ctx`](#sws_ctx) | `variable` | Declared here |
| [`frame_buf`](#frame_buf) | `variable` | Declared here |
| [`frame_pts`](#frame_pts) | `variable` | Declared here |
| [`pool_head`](#pool_head) | `variable` | Declared here |
| [`pool_tail`](#pool_tail) | `variable` | Declared here |
| [`pool_count`](#pool_count) | `variable` | Declared here |
| [`frame_stride`](#frame_stride) | `variable` | Declared here |
| [`src_w`](#src_w) | `variable` | Declared here |
| [`src_h`](#src_h) | `variable` | Declared here |
| [`decode_w`](#decode_w) | `variable` | Declared here |
| [`decode_h`](#decode_h) | `variable` | Declared here |
| [`duration_sec`](#duration_sec) | `variable` | Declared here |
| [`fps`](#fps) | `variable` | Declared here |
| [`has_audio`](#has_audio) | `variable` | Declared here |
| [`audio_codec_name`](#audio_codec_name) | `variable` | Declared here |
| [`audio_sample_rate`](#audio_sample_rate) | `variable` | Declared here |
| [`audio_channels`](#audio_channels) | `variable` | Declared here |
| [`eof`](#eof) | `variable` | Declared here |
| [`seeking`](#seeking) | `variable` | Declared here |
| [`time_base`](#time_base) | `variable` | Declared here |
| [`total_frames_decoded`](#total_frames_decoded) | `variable` | Declared here |
| [`playing`](#playing) | `variable` | Declared here |
| [`playback_start_pts`](#playback_start_pts) | `variable` | Declared here |
| [`playback_start_wall_ms`](#playback_start_wall_ms) | `variable` | Declared here |
| [`speed`](#speed-1) | `variable` | Declared here |
| [`owned_data`](#owned_data) | `variable` | Declared here |
| [`memio`](#memio-1) | `variable` | Declared here |
| [`avio`](#avio) | `variable` | Declared here |
| [`avio_buf`](#avio_buf) | `variable` | Declared here |

### Public Attributes

| Return | Name | Description |
|--------|------|-------------|
| `AVFormatContext *` | [`fmt_ctx`](#fmt_ctx)  |  |
| `AVCodecContext *` | [`codec_ctx`](#codec_ctx)  |  |
| `int` | [`video_stream_idx`](#video_stream_idx)  |  |
| `int` | [`audio_stream_idx`](#audio_stream_idx)  |  |
| `struct SwsContext *` | [`sws_ctx`](#sws_ctx)  |  |
| `uint8_t *` | [`frame_buf`](#frame_buf)  |  |
| `double` | [`frame_pts`](#frame_pts)  |  |
| `int` | [`pool_head`](#pool_head)  |  |
| `int` | [`pool_tail`](#pool_tail)  |  |
| `int` | [`pool_count`](#pool_count)  |  |
| `int` | [`frame_stride`](#frame_stride)  |  |
| `int` | [`src_w`](#src_w)  |  |
| `int` | [`src_h`](#src_h)  |  |
| `int` | [`decode_w`](#decode_w)  |  |
| `int` | [`decode_h`](#decode_h)  |  |
| `double` | [`duration_sec`](#duration_sec)  |  |
| `double` | [`fps`](#fps)  |  |
| `int` | [`has_audio`](#has_audio)  |  |
| `char` | [`audio_codec_name`](#audio_codec_name)  |  |
| `int` | [`audio_sample_rate`](#audio_sample_rate)  |  |
| `int` | [`audio_channels`](#audio_channels)  |  |
| `int` | [`eof`](#eof)  |  |
| `int` | [`seeking`](#seeking)  |  |
| `AVRational` | [`time_base`](#time_base)  |  |
| `int64_t` | [`total_frames_decoded`](#total_frames_decoded)  |  |
| `int` | [`playing`](#playing)  |  |
| `double` | [`playback_start_pts`](#playback_start_pts)  |  |
| `double` | [`playback_start_wall_ms`](#playback_start_wall_ms)  |  |
| `double` | [`speed`](#speed-1)  |  |
| `uint8_t *` | [`owned_data`](#owned_data)  |  |
| `MemIO` | [`memio`](#memio-1)  |  |
| `AVIOContext *` | [`avio`](#avio)  |  |
| `unsigned char *` | [`avio_buf`](#avio_buf)  |  |

---

{#fmt_ctx}

#### fmt_ctx

```cpp
AVFormatContext * fmt_ctx
```

Defined in src/codec_video.c:329

---

{#codec_ctx}

#### codec_ctx

```cpp
AVCodecContext * codec_ctx
```

Defined in src/codec_video.c:330

---

{#video_stream_idx}

#### video_stream_idx

```cpp
int video_stream_idx
```

Defined in src/codec_video.c:331

---

{#audio_stream_idx}

#### audio_stream_idx

```cpp
int audio_stream_idx
```

Defined in src/codec_video.c:332

---

{#sws_ctx}

#### sws_ctx

```cpp
struct SwsContext * sws_ctx
```

Defined in src/codec_video.c:333

---

{#frame_buf}

#### frame_buf

```cpp
uint8_t * frame_buf
```

Defined in src/codec_video.c:336

---

{#frame_pts}

#### frame_pts

```cpp
double frame_pts
```

Defined in src/codec_video.c:337

---

{#pool_head}

#### pool_head

```cpp
int pool_head
```

Defined in src/codec_video.c:338

---

{#pool_tail}

#### pool_tail

```cpp
int pool_tail
```

Defined in src/codec_video.c:338

---

{#pool_count}

#### pool_count

```cpp
int pool_count
```

Defined in src/codec_video.c:338

---

{#frame_stride}

#### frame_stride

```cpp
int frame_stride
```

Defined in src/codec_video.c:339

---

{#src_w}

#### src_w

```cpp
int src_w
```

Defined in src/codec_video.c:342

---

{#src_h}

#### src_h

```cpp
int src_h
```

Defined in src/codec_video.c:342

---

{#decode_w}

#### decode_w

```cpp
int decode_w
```

Defined in src/codec_video.c:343

---

{#decode_h}

#### decode_h

```cpp
int decode_h
```

Defined in src/codec_video.c:343

---

{#duration_sec}

#### duration_sec

```cpp
double duration_sec
```

Defined in src/codec_video.c:344

---

{#fps}

#### fps

```cpp
double fps
```

Defined in src/codec_video.c:344

---

{#has_audio}

#### has_audio

```cpp
int has_audio
```

Defined in src/codec_video.c:347

---

{#audio_codec_name}

#### audio_codec_name

```cpp
char audio_codec_name
```

Defined in src/codec_video.c:348

---

{#audio_sample_rate}

#### audio_sample_rate

```cpp
int audio_sample_rate
```

Defined in src/codec_video.c:349

---

{#audio_channels}

#### audio_channels

```cpp
int audio_channels
```

Defined in src/codec_video.c:349

---

{#eof}

#### eof

```cpp
int eof
```

Defined in src/codec_video.c:352

---

{#seeking}

#### seeking

```cpp
int seeking
```

Defined in src/codec_video.c:352

---

{#time_base}

#### time_base

```cpp
AVRational time_base
```

Defined in src/codec_video.c:353

---

{#total_frames_decoded}

#### total_frames_decoded

```cpp
int64_t total_frames_decoded
```

Defined in src/codec_video.c:354

---

{#playing}

#### playing

```cpp
int playing
```

Defined in src/codec_video.c:357

---

{#playback_start_pts}

#### playback_start_pts

```cpp
double playback_start_pts
```

Defined in src/codec_video.c:358

---

{#playback_start_wall_ms}

#### playback_start_wall_ms

```cpp
double playback_start_wall_ms
```

Defined in src/codec_video.c:359

---

{#speed-1}

#### speed

```cpp
double speed
```

Defined in src/codec_video.c:360

---

{#owned_data}

#### owned_data

```cpp
uint8_t * owned_data
```

Defined in src/codec_video.c:363

---

{#memio-1}

#### memio

```cpp
MemIO memio
```

Defined in src/codec_video.c:364

---

{#avio}

#### avio

```cpp
AVIOContext * avio
```

Defined in src/codec_video.c:365

---

{#avio_buf}

#### avio_buf

```cpp
unsigned char * avio_buf
```

Defined in src/codec_video.c:366

{#videostatus}

## VideoStatus

```cpp
struct VideoStatus
```

Defined in src/codec_video.c:683

### List of all members

| Name | Kind | Owner |
|------|------|-------|
| [`frame_index`](#frame_index) | `variable` | Declared here |
| [`pts_sec`](#pts_sec) | `variable` | Declared here |
| [`duration_sec`](#duration_sec-1) | `variable` | Declared here |
| [`playback_elapsed_sec`](#playback_elapsed_sec) | `variable` | Declared here |
| [`progress`](#progress) | `variable` | Declared here |
| [`playing`](#playing-1) | `variable` | Declared here |
| [`eof`](#eof-1) | `variable` | Declared here |
| [`decode_w`](#decode_w-1) | `variable` | Declared here |
| [`decode_h`](#decode_h-1) | `variable` | Declared here |
| [`src_w`](#src_w-1) | `variable` | Declared here |
| [`src_h`](#src_h-1) | `variable` | Declared here |
| [`has_audio`](#has_audio-1) | `variable` | Declared here |
| [`audio_codec`](#audio_codec) | `variable` | Declared here |
| [`audio_sample_rate`](#audio_sample_rate-1) | `variable` | Declared here |
| [`audio_channels`](#audio_channels-1) | `variable` | Declared here |

### Public Attributes

| Return | Name | Description |
|--------|------|-------------|
| `int32_t` | [`frame_index`](#frame_index)  |  |
| `double` | [`pts_sec`](#pts_sec)  |  |
| `double` | [`duration_sec`](#duration_sec-1)  |  |
| `double` | [`playback_elapsed_sec`](#playback_elapsed_sec)  |  |
| `double` | [`progress`](#progress)  |  |
| `int32_t` | [`playing`](#playing-1)  |  |
| `int32_t` | [`eof`](#eof-1)  |  |
| `int32_t` | [`decode_w`](#decode_w-1)  |  |
| `int32_t` | [`decode_h`](#decode_h-1)  |  |
| `int32_t` | [`src_w`](#src_w-1)  |  |
| `int32_t` | [`src_h`](#src_h-1)  |  |
| `int32_t` | [`has_audio`](#has_audio-1)  |  |
| `char` | [`audio_codec`](#audio_codec)  |  |
| `int32_t` | [`audio_sample_rate`](#audio_sample_rate-1)  |  |
| `int32_t` | [`audio_channels`](#audio_channels-1)  |  |

---

{#frame_index}

#### frame_index

```cpp
int32_t frame_index
```

Defined in src/codec_video.c:684

---

{#pts_sec}

#### pts_sec

```cpp
double pts_sec
```

Defined in src/codec_video.c:685

---

{#duration_sec-1}

#### duration_sec

```cpp
double duration_sec
```

Defined in src/codec_video.c:686

---

{#playback_elapsed_sec}

#### playback_elapsed_sec

```cpp
double playback_elapsed_sec
```

Defined in src/codec_video.c:687

---

{#progress}

#### progress

```cpp
double progress
```

Defined in src/codec_video.c:688

---

{#playing-1}

#### playing

```cpp
int32_t playing
```

Defined in src/codec_video.c:689

---

{#eof-1}

#### eof

```cpp
int32_t eof
```

Defined in src/codec_video.c:690

---

{#decode_w-1}

#### decode_w

```cpp
int32_t decode_w
```

Defined in src/codec_video.c:691

---

{#decode_h-1}

#### decode_h

```cpp
int32_t decode_h
```

Defined in src/codec_video.c:691

---

{#src_w-1}

#### src_w

```cpp
int32_t src_w
```

Defined in src/codec_video.c:692

---

{#src_h-1}

#### src_h

```cpp
int32_t src_h
```

Defined in src/codec_video.c:692

---

{#has_audio-1}

#### has_audio

```cpp
int32_t has_audio
```

Defined in src/codec_video.c:693

---

{#audio_codec}

#### audio_codec

```cpp
char audio_codec
```

Defined in src/codec_video.c:694

---

{#audio_sample_rate-1}

#### audio_sample_rate

```cpp
int32_t audio_sample_rate
```

Defined in src/codec_video.c:695

---

{#audio_channels-1}

#### audio_channels

```cpp
int32_t audio_channels
```

Defined in src/codec_video.c:696

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

{#ffmpegvtable}

## FFmpegVTable

```cpp
struct FFmpegVTable
```

Defined in src/codec_video.c:137

### List of all members

| Name | Kind | Owner |
|------|------|-------|
| [`ok`](#ok) | `variable` | Declared here |
| [`avcodec`](#avcodec) | `variable` | Declared here |
| [`avformat`](#avformat) | `variable` | Declared here |
| [`avutil`](#avutil) | `variable` | Declared here |
| [`swscale`](#swscale) | `variable` | Declared here |
| [`avcodec_send_packet`](#avcodec_send_packet) | `variable` | Declared here |
| [`avcodec_receive_frame`](#avcodec_receive_frame) | `variable` | Declared here |
| [`avcodec_find_decoder`](#avcodec_find_decoder) | `variable` | Declared here |
| [`avcodec_alloc_context3`](#avcodec_alloc_context3) | `variable` | Declared here |
| [`avcodec_open2`](#avcodec_open2) | `variable` | Declared here |
| [`avcodec_parameters_to_context`](#avcodec_parameters_to_context) | `variable` | Declared here |
| [`avcodec_free_context`](#avcodec_free_context) | `variable` | Declared here |
| [`avcodec_flush_buffers`](#avcodec_flush_buffers) | `variable` | Declared here |
| [`avcodec_get_name`](#avcodec_get_name) | `variable` | Declared here |
| [`avformat_open_input`](#avformat_open_input) | `variable` | Declared here |
| [`avformat_close_input`](#avformat_close_input) | `variable` | Declared here |
| [`avformat_alloc_context`](#avformat_alloc_context) | `variable` | Declared here |
| [`avformat_find_stream_info`](#avformat_find_stream_info) | `variable` | Declared here |
| [`av_read_frame`](#av_read_frame) | `variable` | Declared here |
| [`av_seek_frame`](#av_seek_frame) | `variable` | Declared here |
| [`avformat_seek_file`](#avformat_seek_file) | `variable` | Declared here |
| [`av_packet_unref`](#av_packet_unref) | `variable` | Declared here |
| [`av_frame_alloc`](#av_frame_alloc) | `variable` | Declared here |
| [`av_frame_unref`](#av_frame_unref) | `variable` | Declared here |
| [`av_frame_free`](#av_frame_free) | `variable` | Declared here |
| [`av_malloc`](#av_malloc) | `variable` | Declared here |
| [`av_free`](#av_free) | `variable` | Declared here |
| [`av_freep`](#av_freep) | `variable` | Declared here |
| [`av_strerror`](#av_strerror) | `variable` | Declared here |
| [`sws_getContext`](#sws_getcontext) | `variable` | Declared here |
| [`sws_scale`](#sws_scale) | `variable` | Declared here |
| [`sws_freeContext`](#sws_freecontext) | `variable` | Declared here |
| [`avio_alloc_context`](#avio_alloc_context) | `variable` | Declared here |
| [`error_msg`](#error_msg) | `variable` | Declared here |

### Public Attributes

| Return | Name | Description |
|--------|------|-------------|
| `int` | [`ok`](#ok)  |  |
| `void *` | [`avcodec`](#avcodec)  |  |
| `void *` | [`avformat`](#avformat)  |  |
| `void *` | [`avutil`](#avutil)  |  |
| `void *` | [`swscale`](#swscale)  |  |
| `P_avcodec_send_packet` | [`avcodec_send_packet`](#avcodec_send_packet)  |  |
| `P_avcodec_receive_frame` | [`avcodec_receive_frame`](#avcodec_receive_frame)  |  |
| `P_avcodec_find_decoder` | [`avcodec_find_decoder`](#avcodec_find_decoder)  |  |
| `P_avcodec_alloc_context3` | [`avcodec_alloc_context3`](#avcodec_alloc_context3)  |  |
| `P_avcodec_open2` | [`avcodec_open2`](#avcodec_open2)  |  |
| `P_avcodec_parameters_to_context` | [`avcodec_parameters_to_context`](#avcodec_parameters_to_context)  |  |
| `P_avcodec_free_context` | [`avcodec_free_context`](#avcodec_free_context)  |  |
| `P_avcodec_flush_buffers` | [`avcodec_flush_buffers`](#avcodec_flush_buffers)  |  |
| `P_avcodec_get_name` | [`avcodec_get_name`](#avcodec_get_name)  |  |
| `P_avformat_open_input` | [`avformat_open_input`](#avformat_open_input)  |  |
| `P_avformat_close_input` | [`avformat_close_input`](#avformat_close_input)  |  |
| `P_avformat_alloc_context` | [`avformat_alloc_context`](#avformat_alloc_context)  |  |
| `P_avformat_find_stream_info` | [`avformat_find_stream_info`](#avformat_find_stream_info)  |  |
| `P_av_read_frame` | [`av_read_frame`](#av_read_frame)  |  |
| `P_av_seek_frame` | [`av_seek_frame`](#av_seek_frame)  |  |
| `P_avformat_seek_file` | [`avformat_seek_file`](#avformat_seek_file)  |  |
| `P_av_packet_unref` | [`av_packet_unref`](#av_packet_unref)  |  |
| `P_av_frame_alloc` | [`av_frame_alloc`](#av_frame_alloc)  |  |
| `P_av_frame_unref` | [`av_frame_unref`](#av_frame_unref)  |  |
| `P_av_frame_free` | [`av_frame_free`](#av_frame_free)  |  |
| `P_av_malloc` | [`av_malloc`](#av_malloc)  |  |
| `P_av_free` | [`av_free`](#av_free)  |  |
| `P_av_freep` | [`av_freep`](#av_freep)  |  |
| `P_av_strerror` | [`av_strerror`](#av_strerror)  |  |
| `P_sws_getContext` | [`sws_getContext`](#sws_getcontext)  |  |
| `P_sws_scale` | [`sws_scale`](#sws_scale)  |  |
| `P_sws_freeContext` | [`sws_freeContext`](#sws_freecontext)  |  |
| `P_avio_alloc_context` | [`avio_alloc_context`](#avio_alloc_context)  |  |
| `char` | [`error_msg`](#error_msg)  |  |

---

{#ok}

#### ok

```cpp
int ok
```

Defined in src/codec_video.c:138

---

{#avcodec}

#### avcodec

```cpp
void * avcodec
```

Defined in src/codec_video.c:139

---

{#avformat}

#### avformat

```cpp
void * avformat
```

Defined in src/codec_video.c:139

---

{#avutil}

#### avutil

```cpp
void * avutil
```

Defined in src/codec_video.c:139

---

{#swscale}

#### swscale

```cpp
void * swscale
```

Defined in src/codec_video.c:139

---

{#avcodec_send_packet}

#### avcodec_send_packet

```cpp
P_avcodec_send_packet avcodec_send_packet
```

Defined in src/codec_video.c:141

---

{#avcodec_receive_frame}

#### avcodec_receive_frame

```cpp
P_avcodec_receive_frame avcodec_receive_frame
```

Defined in src/codec_video.c:142

---

{#avcodec_find_decoder}

#### avcodec_find_decoder

```cpp
P_avcodec_find_decoder avcodec_find_decoder
```

Defined in src/codec_video.c:143

---

{#avcodec_alloc_context3}

#### avcodec_alloc_context3

```cpp
P_avcodec_alloc_context3 avcodec_alloc_context3
```

Defined in src/codec_video.c:144

---

{#avcodec_open2}

#### avcodec_open2

```cpp
P_avcodec_open2 avcodec_open2
```

Defined in src/codec_video.c:145

---

{#avcodec_parameters_to_context}

#### avcodec_parameters_to_context

```cpp
P_avcodec_parameters_to_context avcodec_parameters_to_context
```

Defined in src/codec_video.c:146

---

{#avcodec_free_context}

#### avcodec_free_context

```cpp
P_avcodec_free_context avcodec_free_context
```

Defined in src/codec_video.c:147

---

{#avcodec_flush_buffers}

#### avcodec_flush_buffers

```cpp
P_avcodec_flush_buffers avcodec_flush_buffers
```

Defined in src/codec_video.c:148

---

{#avcodec_get_name}

#### avcodec_get_name

```cpp
P_avcodec_get_name avcodec_get_name
```

Defined in src/codec_video.c:149

---

{#avformat_open_input}

#### avformat_open_input

```cpp
P_avformat_open_input avformat_open_input
```

Defined in src/codec_video.c:151

---

{#avformat_close_input}

#### avformat_close_input

```cpp
P_avformat_close_input avformat_close_input
```

Defined in src/codec_video.c:152

---

{#avformat_alloc_context}

#### avformat_alloc_context

```cpp
P_avformat_alloc_context avformat_alloc_context
```

Defined in src/codec_video.c:153

---

{#avformat_find_stream_info}

#### avformat_find_stream_info

```cpp
P_avformat_find_stream_info avformat_find_stream_info
```

Defined in src/codec_video.c:154

---

{#av_read_frame}

#### av_read_frame

```cpp
P_av_read_frame av_read_frame
```

Defined in src/codec_video.c:155

---

{#av_seek_frame}

#### av_seek_frame

```cpp
P_av_seek_frame av_seek_frame
```

Defined in src/codec_video.c:156

---

{#avformat_seek_file}

#### avformat_seek_file

```cpp
P_avformat_seek_file avformat_seek_file
```

Defined in src/codec_video.c:157

---

{#av_packet_unref}

#### av_packet_unref

```cpp
P_av_packet_unref av_packet_unref
```

Defined in src/codec_video.c:158

---

{#av_frame_alloc}

#### av_frame_alloc

```cpp
P_av_frame_alloc av_frame_alloc
```

Defined in src/codec_video.c:160

---

{#av_frame_unref}

#### av_frame_unref

```cpp
P_av_frame_unref av_frame_unref
```

Defined in src/codec_video.c:161

---

{#av_frame_free}

#### av_frame_free

```cpp
P_av_frame_free av_frame_free
```

Defined in src/codec_video.c:162

---

{#av_malloc}

#### av_malloc

```cpp
P_av_malloc av_malloc
```

Defined in src/codec_video.c:164

---

{#av_free}

#### av_free

```cpp
P_av_free av_free
```

Defined in src/codec_video.c:165

---

{#av_freep}

#### av_freep

```cpp
P_av_freep av_freep
```

Defined in src/codec_video.c:166

---

{#av_strerror}

#### av_strerror

```cpp
P_av_strerror av_strerror
```

Defined in src/codec_video.c:167

---

{#sws_getcontext}

#### sws_getContext

```cpp
P_sws_getContext sws_getContext
```

Defined in src/codec_video.c:169

---

{#sws_scale}

#### sws_scale

```cpp
P_sws_scale sws_scale
```

Defined in src/codec_video.c:170

---

{#sws_freecontext}

#### sws_freeContext

```cpp
P_sws_freeContext sws_freeContext
```

Defined in src/codec_video.c:171

---

{#avio_alloc_context}

#### avio_alloc_context

```cpp
P_avio_alloc_context avio_alloc_context
```

Defined in src/codec_video.c:173

---

{#error_msg}

#### error_msg

```cpp
char error_msg
```

Defined in src/codec_video.c:175

Generated by [Moxygen](https://0state.com/moxygen)