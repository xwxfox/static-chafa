/**
 * @file codec.c
 * @brief Unified image decode + chafa render library.
 *
 * Zero-dependency native rendering engine. Links directly against chafa's
 * source tree (compiled verbatim) plus libpng, libjpeg, libwebp, and zlib.
 *
 * ## Architecture
 *
 * A `CodecCtx` holds per-instance state: a cached chafa canvas and up to 16
 * animation handles. All public functions take a `CodecCtx *` as their first
 * parameter. Create with `codec_ctx_new()`, destroy with `codec_ctx_free()`.
 *
 * ## Memory safety
 *
 * Every allocation has a documented ownership path:
 * - Strings returned by `codec_render*` / `codec_render_matrix*` must be
 *   freed by the caller via `codec_free()`.
 * - RGBA buffers returned by `codec_decode_buffer()` must be freed by the
 *   caller via `codec_free()`.
 * - RGBA buffers written by `codec_decode_into()` are caller-owned.
 * - The `CodecCtx` owns all canvas and animation resources; freeing the
 *   context closes any open animations.
 *
 * ## Struct layout
 *
 * `CodecConfig` and `CodecMetrics` are defined identically here and in
 * `addon.c`. Their byte layout must match exactly because they are passed
 * across the FFI boundary as raw pointers. The TypeScript-side `ffi.ts`
 * reads/writes these structs via `Int32Array`/`Float32Array` views.
 *
 * @see https://hpjansson.org/chafa/ Chafa documentation
 */

// codec.c - unified image decode + chafa render library
// Single FFI boundary. No external deps at runtime beyond system libraries.
//
// Memory safety: every allocation has a documented ownership path.
// The CodecCtx owns canvas and animation handles. Caller owns
// returned strings (must free with codec_free). decode_buffer
// returns caller-owned RGBA memory (free with codec_free).
//
// Exports:
//   codec_ctx_new / codec_ctx_free / codec_ctx_configure
//   codec_decode_buffer - raw decode to RGBA
//   codec_render - decode + chafa -> ANSI
//   codec_render_rgba - pre-decoded RGBA -> ANSI
//   codec_render_matrix / codec_render_matrix_rgba - decode -> JSON cell grid
//   codec_anim_open / codec_anim_next / codec_anim_render_frame
//   codec_anim_rewind / codec_anim_close / codec_anim_abort
//   codec_free - free any buffer returned by the above

#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <setjmp.h>
#include <time.h>
#include <math.h>
#include "chafa.h"
#include "internal/chafa-canvas-internal.h"
#include "internal/smolscale/smolscale.h"
#include <zlib.h>

#include <jpeglib.h>
#include <webp/decode.h>
#include <webp/demux.h>
#include <png.h>

/* Symbol export for Windows DLL */
#ifdef _WIN32
#define CODEC_EXPORT __declspec(dllexport)
#else
#define CODEC_EXPORT __attribute__((visibility("default")))
#endif

#define STBI_NO_STDIO
#define STBI_NO_JPEG
#define STBI_NO_PNG
#define STBI_NO_BMP
#define STBI_NO_PSD
#define STBI_NO_TGA
#define STBI_NO_HDR
#define STBI_NO_PIC
#define STBI_NO_PNM
#define STBI_NO_LINEAR
#define STBI_NO_FAILURE_STRINGS
#define STBI_NO_SIMD
#define STB_IMAGE_IMPLEMENTATION
#include "stb_image.h"

/**
 * @name Error codes
 * Returned via the `err` out-parameter on most public API functions.
 * Negative values indicate failure; `ERR_OK` (0) indicates success.
 * @{
 */
#define ERR_OK 0
#define ERR_UNKNOWN_FMT -1   /**< Unrecognized image format */
#define ERR_FILE_OPEN -2     /**< Could not open file (render_path) */
#define ERR_FILE_READ -3     /**< Could not read file */
#define ERR_FILE_EMPTY -4    /**< File or buffer is empty */
#define ERR_MALLOC -5        /**< Memory allocation failed */
#define ERR_UNSUPPORTED -6   /**< Unsupported format or features */
#define ERR_CORRUPT_DATA -7  /**< Corrupt or truncated data */
#define ERR_DIMENSIONS -8    /**< Invalid image dimensions (<1 or >65536) */
#define ERR_DECODE_FAIL -9   /**< Codec-specific decode failure */
#define ERR_INFLATE_FAIL -10 /**< Decompression (zlib) failure */
#define ERR_POOL_FULL -11    /**< Output buffer too small */
#define ERR_BAD_PARAMS -12   /**< Invalid parameters (null, zero length, etc.) */
/** @} */

static const char *err_string(int code)
{
    switch (code)
    {
    case ERR_UNKNOWN_FMT:  return "Unknown image format";
    case ERR_FILE_OPEN:    return "Cannot open file";
    case ERR_FILE_READ:    return "Cannot read file";
    case ERR_FILE_EMPTY:   return "File is empty";
    case ERR_MALLOC:       return "Memory allocation failed";
    case ERR_UNSUPPORTED:  return "Unsupported image format or features";
    case ERR_CORRUPT_DATA: return "Corrupt or truncated image data";
    case ERR_DIMENSIONS:   return "Invalid image dimensions";
    case ERR_DECODE_FAIL:  return "Image decode failed";
    case ERR_INFLATE_FAIL: return "Decompression failed";
    case ERR_POOL_FULL:    return "Output buffer too small";
    case ERR_BAD_PARAMS:   return "Invalid parameters";
    default:               return "Unknown error";
    }
}

#define MAX_DIM (65536)
#define MIN_DIM (1)

#define PIXEL_FIT_NONE 0
#define PIXEL_FIT_SCALE 1

/**
 * @struct CodecConfig
 * @brief Full chafa canvas configuration.
 *
 * Maps 1:1 to chafa's `ChafaCanvasConfig` setters. The first 22 fields
 * are numeric (int32/float); two 128-byte char buffers at the tail hold
 * symbol selector strings. Total struct size: 344 bytes.
 *
 * Must match byte-for-byte with the definition in addon.c.
 */
typedef struct
{
    int32_t term_w, term_h;
    int32_t cell_w, cell_h;
    float work_factor;
    int32_t dither_mode, canvas_mode, preprocessing;
    int32_t color_extractor, color_space, pixel_mode;
    int32_t bg_color, fg_color;
    int32_t alpha_threshold;
    int32_t dither_grain_w, dither_grain_h;
    float dither_intensity;
    int32_t fg_only, optimizations, passthrough;
    int32_t max_frames;
    float speed;
    int32_t pixel_fit;
    char symbols[128];
    char fill_symbols[128];
} CodecConfig;

/**
 * @struct CodecMetrics
 * @brief Per-operation timing and metadata.
 *
 * All times are in milliseconds on the monotonic clock. The struct
 * is 68 bytes (4 floats + 13 int32s). Must match byte-for-byte
 * with addon.c.
 */
typedef struct
{
    float parse_ms, draw_ms, build_ms, total_ms;
    int32_t img_w, img_h;
    int32_t canvas_w, canvas_h, canvas_pw, canvas_ph;
    int32_t frame_count, frame_delay_ms;
    int32_t rgba_bytes;
    int32_t format, canvas_mode, pixel_mode, have_alpha;
    int32_t pixel_fit;
} CodecMetrics;

/* -- decode helpers -- */
static double now_ms(void)
{
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (double)ts.tv_sec * 1000.0 + (double)ts.tv_nsec / 1000000.0;
}
static int32_t abs_i32(int32_t x) { return x < 0 ? -x : x; }

/* -- format detection -- */
#define FMT_PNG  0
#define FMT_JPEG 1
#define FMT_BMP  2
#define FMT_GIF  3
#define FMT_WEBP 4

static int detect_format(const uint8_t *data, int32_t len)
{
    if (len >= 8 && data[0] == 0x89 && data[1] == 'P' && data[2] == 'N' && data[3] == 'G')
        return FMT_PNG;
    if (len >= 3 && data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF)
        return FMT_JPEG;
    if (len >= 2 && data[0] == 'B' && data[1] == 'M')
        return FMT_BMP;
    if (len >= 6 && data[0] == 'G' && data[1] == 'I' && data[2] == 'F')
        return FMT_GIF;
    if (len >= 12 && data[0] == 'R' && data[1] == 'I' && data[2] == 'F' && data[3] == 'F'
        && data[8] == 'W' && data[9] == 'E' && data[10] == 'B' && data[11] == 'P')
        return FMT_WEBP;
    return -1;
}

/* -- PNG decode (libpng simplified API) -- */
static int decode_png(uint8_t **out, int *out_w, int *out_h, const uint8_t *buf, int32_t len)
{
    png_image img;
    memset(&img, 0, sizeof(img));
    img.version = PNG_IMAGE_VERSION;
    if (!png_image_begin_read_from_memory(&img, buf, len))
        return -1;
    img.format = PNG_FORMAT_RGBA;
    int w = (int)img.width, h = (int)img.height;
    uint8_t *rgba = malloc(PNG_IMAGE_SIZE(img));
    if (!rgba) return -1;
    if (!png_image_finish_read(&img, NULL, rgba, 0, NULL))
    {
        free(rgba);
        return -1;
    }
    *out = rgba;
    *out_w = w;
    *out_h = h;
    return 0;
}

/* -- JPEG decode -- */
typedef struct
{
    struct jpeg_source_mgr pub;
    const uint8_t *data;
    size_t len;
} jpg_src;

typedef struct
{
    struct jpeg_error_mgr pub;
    jmp_buf jmp;
} jpg_err;

static void jpg_init(j_decompress_ptr c) { (void)c; }
static boolean jpg_fill(j_decompress_ptr c)
{
    jpg_src *s = (jpg_src *)c->src;
    s->pub.next_input_byte = s->data;
    s->pub.bytes_in_buffer = s->len;
    return 1;
}
static void jpg_skip(j_decompress_ptr c, long n)
{
    jpg_src *s = (jpg_src *)c->src;
    if (n > 0 && (size_t)n <= s->pub.bytes_in_buffer)
    {
        s->pub.next_input_byte += n;
        s->pub.bytes_in_buffer -= n;
    }
}
static void jpg_error_exit(j_common_ptr cinfo)
{
    jpg_err *e = (jpg_err *)cinfo->err;
    longjmp(e->jmp, 1);
}
static int decode_jpeg(uint8_t **out, int *out_w, int *out_h, const uint8_t *buf, int32_t len)
{
    struct jpeg_decompress_struct cinfo;
    jpg_err jerr;
    memset(&cinfo, 0, sizeof(cinfo));
    memset(&jerr, 0, sizeof(jerr));

    cinfo.err = jpeg_std_error(&jerr.pub);
    jerr.pub.error_exit = jpg_error_exit;

    if (setjmp(jerr.jmp))
    {
        jpeg_destroy_decompress(&cinfo);
        return -1;
    }

    jpeg_create_decompress(&cinfo);
    jpg_src src;
    memset(&src, 0, sizeof(src));
    src.data = buf;
    src.len = len;
    src.pub.init_source = jpg_init;
    src.pub.fill_input_buffer = jpg_fill;
    src.pub.skip_input_data = jpg_skip;
    src.pub.resync_to_restart = jpeg_resync_to_restart;
    src.pub.term_source = jpg_init;
    src.pub.next_input_byte = buf;
    src.pub.bytes_in_buffer = len;
    cinfo.src = (struct jpeg_source_mgr *)&src;
    jpeg_read_header(&cinfo, 1);
    jpeg_start_decompress(&cinfo);
    int w = cinfo.output_width, h = cinfo.output_height, rs = w * cinfo.output_components;
    JSAMPARRAY rowbuf = (*cinfo.mem->alloc_sarray)((j_common_ptr)&cinfo, JPOOL_IMAGE, rs, 1);
    uint8_t *rgba = malloc(w * h * 4);
    if (!rgba) { jpeg_destroy_decompress(&cinfo); return -1; }
    for (int y = 0; y < h; y++)
    {
        jpeg_read_scanlines(&cinfo, rowbuf, 1);
        for (int x = 0; x < w; x++)
        {
            int d = (y * w + x) * 4, s = x * cinfo.output_components;
            rgba[d] = rowbuf[0][s];
            rgba[d + 1] = rowbuf[0][s + 1];
            rgba[d + 2] = rowbuf[0][s + 2];
            rgba[d + 3] = 255;
        }
    }
    jpeg_finish_decompress(&cinfo);
    jpeg_destroy_decompress(&cinfo);
    *out = rgba;
    *out_w = w;
    *out_h = h;
    return 0;
}

/* -- BMP decode -- */
static int decode_bmp(uint8_t **out, int *out_w, int *out_h, const uint8_t *buf, int32_t len)
{
    if (len < 30 || buf[0] != 'B' || buf[1] != 'M')
        return -1;
    int32_t off = *(int32_t *)(buf + 10), w = *(int32_t *)(buf + 18), h = *(int32_t *)(buf + 22);
    int32_t ah = h < 0 ? -h : h, td = h < 0;
    int16_t bpp = *(int16_t *)(buf + 28);
    if (off < 30 || off >= len || w <= 0 || ah <= 0 || (bpp != 24 && bpp != 32))
        return -1;
    uint8_t *rgba = malloc(w * ah * 4);
    if (!rgba) return -1;
    int rowBytes = ((bpp == 24 ? w * 3 : w * 4) + 3) & ~3, ch = bpp / 8;
    for (int y = 0; y < ah; y++)
    {
        int sy = td ? y : (ah - 1 - y);
        const uint8_t *src = buf + off + sy * rowBytes;
        uint8_t *dst = rgba + y * w * 4;
        for (int x = 0; x < w; x++)
        {
            dst[x * 4 + 2] = src[x * ch];
            dst[x * 4 + 1] = src[x * ch + 1];
            dst[x * 4] = src[x * ch + 2];
            dst[x * 4 + 3] = bpp == 32 ? src[x * 4 + 3] : 255;
        }
    }
    *out = rgba;
    *out_w = w;
    *out_h = ah;
    return 0;
}

/* -- WebP static decode -- */
static int decode_webp_static(uint8_t **out, int *out_w, int *out_h, const uint8_t *buf, int32_t len)
{
    int w, h;
    if (!WebPGetInfo(buf, len, &w, &h))
        return -1;
    uint8_t *rgba = malloc(w * h * 4);
    if (!rgba) return -1;
    if (WebPDecodeRGBAInto(buf, len, rgba, w * h * 4, w * 4) != rgba)
    {
        free(rgba);
        return -1;
    }
    *out = rgba;
    *out_w = w;
    *out_h = h;
    return 0;
}

/* -- GIF decode (stb_image, returns concatenated frames for animation) -- */
static int decode_gif(uint8_t **out, int *out_w, int *out_h, int *out_frames,
                      const uint8_t *buf, int32_t len)
{
    int w, h, frames, comp, *delays;
    uint8_t *data = stbi_load_gif_from_memory((stbi_uc *)buf, len, &delays, &w, &h, &frames, &comp, 4);
    if (!data)
        return -1;
    free(delays);
    *out = data;
    *out_w = w;
    *out_h = h;
    *out_frames = frames;
    return 0;
}

/* -- Default config -- */
/* Perf: work_factor=0.0 is fastest; chafa CLI defaults to 0.5 for better quality.
   preprocessing=0 skips auto-contrast; chafa CLI defaults to on. */
static void config_init(CodecConfig *cfg)
{
    memset(cfg, 0, sizeof(*cfg));
    cfg->term_w = 80;
    cfg->term_h = 24;
    cfg->cell_w = 8;
    cfg->cell_h = 16;
    cfg->work_factor = 0.0f;
    cfg->alpha_threshold = 127;
    cfg->fg_color = 0xffffff;
    cfg->bg_color = 0x000000;
    cfg->speed = 1.0f;
    cfg->max_frames = -1;
    cfg->optimizations = 0x7fffffff; /* CHAFA_OPTIMIZATION_ALL */
    cfg->pixel_fit = PIXEL_FIT_SCALE;
}

/* ══════════════════════════════════════════════════════════════════════
   Context: holds per-instance canvas and animation state
   ══════════════════════════════════════════════════════════════════════ */

typedef enum
{
    ANIM_GIF,
    ANIM_WEBP
} AnimType;

/* Reusable buffer for pixel-fit pre-scaling (avoids per-frame allocation). */
typedef struct
{
    uint8_t *buf;
    int cap;
} ScaleScratch;

typedef struct
{
    AnimType type;
    uint8_t *rgbabuf;
    int total_frames, frame_size, w, h, idx;
    int *delays;
    int done, aborted, prev_ts;
    WebPAnimDecoder *webp_dec;
    uint8_t *webp_buf;
    int webp_len;
    ChafaCanvas *canvas;
    ChafaCanvasConfig *canvas_cfg;
    ScaleScratch scratch;
    int pixel_fit;
    int kitty_id;               /* 0 = emit without id */
} AnimHandle;

/**
 * @struct CodecCtx
 * @brief Per-instance rendering context.
 *
 * Holds a cached chafa canvas and up to 16 animation handles.
 * Created by `codec_ctx_new()`, destroyed by `codec_ctx_free()`.
 * All rendering functions require a valid context.
 */
typedef struct CodecCtx
{
    ChafaCanvas *canvas;
    ChafaCanvasConfig *canvas_cfg;
    CodecConfig cfg;
    int canvas_valid;       /* 1 when canvas matches cfg and symbols */
    AnimHandle *handles[16];
    void *video_handles[16]; /* VideoHandle* slots (from codec_video.c) */
    ScaleScratch scratch;   /* pre-scale scratch buffer for static renders */
    int next_kitty_id;      /* monotonically increasing id for kitty animations */
} CodecCtx;

/**
 * @name Context lifecycle
 * @{
 */
/** Create a new rendering context with the given config (or defaults if NULL). */
CODEC_EXPORT CodecCtx *codec_ctx_new(CodecConfig *cfg);
/** Free the context and all associated resources (canvas, open animations). */
CODEC_EXPORT void codec_ctx_free(CodecCtx *ctx);
/** Update the context's configuration. Invalidates the cached canvas. */
CODEC_EXPORT void codec_ctx_configure(CodecCtx *ctx, CodecConfig *cfg);
/** @} */

/**
 * @name Decode
 * @{
 */
/** Decode any supported format into a caller-owned RGBA buffer. Free with codec_free(). */
CODEC_EXPORT uint8_t *codec_decode_buffer(char *data, int32_t len,
                                          int32_t *out_w, int32_t *out_h, int32_t *out_stride,
                                          CodecMetrics *out, int32_t *err);
/** Decode into a caller-provided buffer. Returns 0 on success, negative on error. */
CODEC_EXPORT int codec_decode_into(char *data, int32_t len,
                                   uint8_t *rgba_out, int32_t rgba_cap,
                                   int32_t *out_w, int32_t *out_h, int32_t *out_stride,
                                   CodecMetrics *out, int32_t *err);
/** @} */

/**
 * @name Render
 * Decode an image and render it through chafa to a string output.
 * All returned strings must be freed with codec_free().
 * @{
 */
/** Decode any supported format and render to an ANSI terminal art string. */
CODEC_EXPORT char *codec_render(CodecCtx *ctx, char *data, int32_t len,
                                CodecMetrics *out, int32_t *err);
/** Render pre-decoded RGBA pixels to an ANSI terminal art string. */
CODEC_EXPORT char *codec_render_rgba(CodecCtx *ctx, uint8_t *rgba,
                                     int32_t w, int32_t h, int32_t stride,
                                     CodecMetrics *out);
/** Decode any supported format and render to a JSON-encoded cell matrix. */
CODEC_EXPORT char *codec_render_matrix(CodecCtx *ctx, char *data, int32_t len,
                                       CodecMetrics *out, int32_t *err);
/** Render pre-decoded RGBA pixels to a JSON-encoded cell matrix. */
CODEC_EXPORT char *codec_render_matrix_rgba(CodecCtx *ctx, uint8_t *rgba,
                                            int32_t w, int32_t h, int32_t stride,
                                            CodecMetrics *out);
/** @} */

/**
 * @name Animation
 * Frame-by-frame playback of animated GIF and WebP images.
 * Each context supports up to 16 concurrent animation handles.
 * @{
 */
/** Open an animated GIF or WebP image. Returns handle index (>=0) or -1 on error. */
CODEC_EXPORT int32_t codec_anim_open(CodecCtx *ctx, char *data, int32_t len,
                                     CodecMetrics *out, int32_t *err);
/** Advance to the next frame. Returns frame index (>=0) or -1 when ended. */
CODEC_EXPORT int32_t codec_anim_next(CodecCtx *ctx, int32_t handle, CodecMetrics *out);
/** Render a specific frame (by index) to ANSI. Returns allocated string, free with codec_free(). */
CODEC_EXPORT char *codec_anim_render_frame(CodecCtx *ctx, int32_t handle, int32_t frame_idx,
                                           CodecMetrics *out);
/** Rewind playback to the first frame. Returns 0 on success, -1 on error. */
CODEC_EXPORT int32_t codec_anim_rewind(CodecCtx *ctx, int32_t handle);
/** Close the animation handle and free all its resources. */
CODEC_EXPORT void codec_anim_close(CodecCtx *ctx, int32_t handle);
/** Signal early termination. The handle is marked aborted, no further frames advance. */
CODEC_EXPORT void codec_anim_abort(CodecCtx *ctx, int32_t handle);
/** @} */

/** Free any pointer returned by a codec_* function. Safe to call on NULL. */
CODEC_EXPORT void codec_free(void *p);

/** @name Internal helpers for codec_video.c @{ */
CODEC_EXPORT void **codec_ctx_get_video_slots(CodecCtx *ctx) { return (void **)ctx->video_handles; }
CODEC_EXPORT void *codec_ctx_get_video_handle(CodecCtx *ctx, int slot) {
    if (!ctx || slot < 0 || slot >= 16) return NULL;
    return ctx->video_handles[slot];
}
CODEC_EXPORT void codec_ctx_set_video_handle(CodecCtx *ctx, int slot, void *handle) {
    if (!ctx || slot < 0 || slot >= 16) return;
    ctx->video_handles[slot] = handle;
}
CODEC_EXPORT int32_t codec_ctx_get_pixel_fit(CodecCtx *ctx)
{
    return ctx ? ctx->cfg.pixel_fit : 0;
}
/** @} */

/** @name Video (FFmpeg, optional - fails gracefully without FFmpeg installed) @{ */
CODEC_EXPORT int codec_video_open_handle(CodecCtx *ctx, void *vh);
CODEC_EXPORT int32_t codec_video_open(CodecCtx *ctx, char *data, int32_t len,
    int32_t decode_w, int32_t decode_h, CodecMetrics *out, int32_t *err);
CODEC_EXPORT int32_t codec_video_next(CodecCtx *ctx, int32_t handle,
    uint8_t *out_rgba, int32_t out_cap,
    int32_t *out_w, int32_t *out_h, double *out_pts, CodecMetrics *out);
CODEC_EXPORT int32_t codec_video_seek(CodecCtx *ctx, int32_t handle, double target_sec);
CODEC_EXPORT int32_t codec_video_info(CodecCtx *ctx, int32_t handle,
    int32_t *out_w, int32_t *out_h, double *out_duration, double *out_fps,
    int32_t *out_has_audio, char *audio_codec, int32_t *audio_rate, int32_t *audio_ch);
CODEC_EXPORT void codec_video_close(CodecCtx *ctx, int32_t handle);
CODEC_EXPORT const char *codec_video_error(void);
/** @} */

/* -- internal helpers -- */

/* Compute the aspect-preserving fit box for @src_w x @src_h within the
   canvas' pixel area. Used for pixel-fit pre-scaling and video decode
   targeting. Writes src dims back unchanged on any error/invalid input. */
static void compute_fit_box(const ChafaCanvas *canvas, int src_w, int src_h,
                            int *w_out, int *h_out)
{
    *w_out = src_w;
    *h_out = src_h;
    if (!canvas || src_w <= 0 || src_h <= 0)
        return;

    int cw = canvas->width_pixels;
    int ch = canvas->height_pixels;
    if (cw <= 0 || ch <= 0)
        return;

    double s = fmin((double)cw / (double)src_w, (double)ch / (double)src_h);
    int fw = (int)((double)src_w * s);
    int fh = (int)((double)src_h * s);
    if (fw < 1) fw = 1;
    if (fh < 1) fh = 1;
    if (fw > MAX_DIM) fw = MAX_DIM;
    if (fh > MAX_DIM) fh = MAX_DIM;
    *w_out = fw;
    *h_out = fh;
}

/* Exposed for codec_video.c: compute decode target from a config, without
   a canvas. Mirrors compute_fit_box() using cfg geometry. */
CODEC_EXPORT void codec_ctx_pixel_fit_box(const CodecCtx *ctx, int src_w, int src_h,
                                          int *w_out, int *h_out)
{
    *w_out = src_w;
    *h_out = src_h;
    if (!ctx || src_w <= 0 || src_h <= 0)
        return;

    const CodecConfig *cfg = &ctx->cfg;
    if (cfg->pixel_mode == 0 /* SYMBOLS */ || cfg->pixel_fit != PIXEL_FIT_SCALE)
        return;

    int cell_w = cfg->cell_w > 0 ? cfg->cell_w : 8;
    int cell_h = cfg->cell_h > 0 ? cfg->cell_h : 16;
    int cw = cfg->term_w * cell_w;
    int ch = cfg->term_h * cell_h;
    if (cw <= 0 || ch <= 0)
        return;

    double s = fmin((double)cw / (double)src_w, (double)ch / (double)src_h);
    int fw = (int)((double)src_w * s);
    int fh = (int)((double)src_h * s);
    if (fw < 1) fw = 1;
    if (fh < 1) fh = 1;
    if (fw > MAX_DIM) fw = MAX_DIM;
    if (fh > MAX_DIM) fh = MAX_DIM;
    *w_out = fw;
    *h_out = fh;
}

/* Pre-scale src RGBA into @scratch at the canvas fit box. Returns pointer
   to the pixels to draw and their dims/stride. On failure returns original. */
static void prescale_if_needed(const ChafaCanvas *canvas, int pixel_fit,
                               uint8_t *rgba, int w, int h, int stride,
                               ScaleScratch *scratch,
                               uint8_t **draw_out, int *draw_w, int *draw_h, int *draw_stride)
{
    *draw_out = rgba;
    *draw_w = w;
    *draw_h = h;
    *draw_stride = stride > 0 ? stride : w * 4;

    if (!canvas || !rgba || pixel_fit != PIXEL_FIT_SCALE)
        return;

    int fw = w, fh = h;
    compute_fit_box(canvas, w, h, &fw, &fh);
    if (fw == w && fh == h)
        return; /* already 1:1 */

    int need = fw * fh * 4;
    if (!scratch || need <= 0)
        return;

    if (scratch->cap < need)
    {
        free(scratch->buf);
        scratch->buf = malloc((size_t)need);
        if (!scratch->buf)
        {
            scratch->cap = 0;
            return;
        }
        scratch->cap = need;
    }

    if (!smol_scale_simple(rgba, SMOL_PIXEL_RGBA8_UNASSOCIATED,
                           (uint32_t)w, (uint32_t)h,
                           (uint32_t)(stride > 0 ? stride : w * 4),
                           scratch->buf, SMOL_PIXEL_RGBA8_UNASSOCIATED,
                           (uint32_t)fw, (uint32_t)fh, (uint32_t)(fw * 4),
                           SMOL_NO_FLAGS))
        return;

    *draw_out = scratch->buf;
    *draw_w = fw;
    *draw_h = fh;
    *draw_stride = fw * 4;
}

/* Insert "i=<id>," after every kitty image/chunk prefix ("\x1b_G") so
   animations reuse a single kitty image instead of leaking one per frame.
   Returns a new string (caller frees), or NULL on failure. */
static char *inject_kitty_image_id(const char *ansi, int id)
{
    static const char prefix[] = "\x1b_G";
    int n = 0;
    const char *p;

    if (!ansi || id < 1)
        return NULL;

    for (p = ansi; (p = strstr(p, prefix)) != NULL; p += 3)
        n++;
    if (n == 0)
        return NULL;

    char idbuf[16];
    int idlen = snprintf(idbuf, sizeof(idbuf), "i=%d,", id);
    size_t outlen = strlen(ansi) + (size_t)n * (size_t)idlen + 1;
    char *out = malloc(outlen);
    if (!out)
        return NULL;

    const char *src = ansi;
    char *dst = out;
    while ((p = strstr(src, prefix)) != NULL)
    {
        size_t seg = (size_t)(p - src);
        memcpy(dst, src, seg);
        dst += seg;
        memcpy(dst, prefix, 3);
        dst += 3;
        memcpy(dst, idbuf, (size_t)idlen);
        dst += idlen;
        src = p + 3;
    }
    strcpy(dst, src);
    return out;
}

static ChafaCanvasConfig *make_canvas_config(const CodecConfig *cfg)
{
    ChafaCanvasConfig *cc = chafa_canvas_config_new();
    chafa_canvas_config_set_geometry(cc, cfg->term_w, cfg->term_h);
    chafa_canvas_config_set_cell_geometry(cc, cfg->cell_w, cfg->cell_h);
    chafa_canvas_config_set_canvas_mode(cc, cfg->canvas_mode);
    chafa_canvas_config_set_pixel_mode(cc, cfg->pixel_mode);
    chafa_canvas_config_set_color_extractor(cc, cfg->color_extractor);
    chafa_canvas_config_set_color_space(cc, cfg->color_space);
    chafa_canvas_config_set_dither_mode(cc, cfg->dither_mode);
    if (cfg->dither_grain_w > 0 && cfg->dither_grain_h > 0)
        chafa_canvas_config_set_dither_grain_size(cc, cfg->dither_grain_w, cfg->dither_grain_h);
    chafa_canvas_config_set_dither_intensity(cc, cfg->dither_intensity);
    chafa_canvas_config_set_fg_color(cc, cfg->fg_color);
    chafa_canvas_config_set_bg_color(cc, cfg->bg_color);
    chafa_canvas_config_set_transparency_threshold(cc, cfg->alpha_threshold);
    chafa_canvas_config_set_work_factor(cc, cfg->work_factor);
    chafa_canvas_config_set_preprocessing_enabled(cc, cfg->preprocessing);
    chafa_canvas_config_set_fg_only_enabled(cc, cfg->fg_only);
    chafa_canvas_config_set_optimizations(cc, cfg->optimizations);
    chafa_canvas_config_set_passthrough(cc, cfg->passthrough);
    if (cfg->symbols[0])
        chafa_symbol_map_apply_selectors(
            (ChafaSymbolMap *)chafa_canvas_config_peek_symbol_map(cc),
            cfg->symbols, NULL);
    if (cfg->fill_symbols[0])
        chafa_symbol_map_apply_selectors(
            (ChafaSymbolMap *)chafa_canvas_config_peek_fill_symbol_map(cc),
            cfg->fill_symbols, NULL);
    return cc;
}

/* Invalidate the cached canvas so it will be rebuilt on next render */
static void ctx_invalidate_canvas(CodecCtx *ctx)
{
    if (ctx->canvas)
    {
        chafa_canvas_unref(ctx->canvas);
        ctx->canvas = NULL;
    }
    if (ctx->canvas_cfg)
    {
        chafa_canvas_config_unref(ctx->canvas_cfg);
        ctx->canvas_cfg = NULL;
    }
    ctx->canvas_valid = 0;
}

/* Ensure ctx has a valid canvas matching its current config.
   Returns 0 on success, -1 on allocation failure. */
static int ctx_ensure_canvas(CodecCtx *ctx)
{
    if (ctx->canvas_valid)
        return 0;

    ctx_invalidate_canvas(ctx);
    ctx->canvas_cfg = make_canvas_config(&ctx->cfg);
    if (!ctx->canvas_cfg)
        return -1;
    ctx->canvas = chafa_canvas_new(ctx->canvas_cfg);
    if (!ctx->canvas)
    {
        chafa_canvas_config_unref(ctx->canvas_cfg);
        ctx->canvas_cfg = NULL;
        return -1;
    }
    ctx->canvas_valid = 1;
    return 0;
}

/* Extract canvas metadata into metrics struct */
static void fill_canvas_metrics(ChafaCanvas *canvas, CodecMetrics *m)
{
    const ChafaCanvasConfig *ccfg = chafa_canvas_peek_config(canvas);
    gint gw = 0, gh = 0;
    chafa_canvas_config_get_geometry(ccfg, &gw, &gh);
    m->canvas_w = gw;
    m->canvas_h = gh;
    m->canvas_pw = canvas->width_pixels;
    m->canvas_ph = canvas->height_pixels;
    m->canvas_mode = (int32_t)chafa_canvas_config_get_canvas_mode(ccfg);
    m->pixel_mode = (int32_t)chafa_canvas_config_get_pixel_mode(ccfg);
    m->have_alpha = canvas->have_alpha;
}

/* Draw RGBA pixels to canvas, then build ANSI string.
   Fills draw_ms, build_ms, total_ms, img_w, img_h, and canvas metadata in *m.
   When pixel_fit is SCALE, pre-scales source pixels to the canvas fit box
   first so chafa draws 1:1 (using @scratch as a reusable buffer).
   Returns allocated string (caller must codec_free). */
static char *canvas_draw_and_build(ChafaCanvas *canvas, uint8_t *rgba,
                                   int32_t w, int32_t h, int32_t stride,
                                   CodecMetrics *m, int pixel_fit,
                                   ScaleScratch *scratch)
{
    double t0 = now_ms();
    uint8_t *draw_pixels;
    int draw_w, draw_h, draw_stride;
    prescale_if_needed(canvas, pixel_fit, rgba, w, h, stride, scratch,
                       &draw_pixels, &draw_w, &draw_h, &draw_stride);
    chafa_canvas_draw_all_pixels(canvas, CHAFA_PIXEL_RGBA8_UNASSOCIATED,
                                 draw_pixels, draw_w, draw_h, draw_stride);
    double t1 = now_ms();
    GString *gs = chafa_canvas_print(canvas, NULL);
    double t2 = now_ms();

    m->draw_ms = (float)(t1 - t0);
    m->build_ms = (float)(t2 - t1);
    m->total_ms = m->parse_ms + m->draw_ms + m->build_ms;
    m->img_w = w;
    m->img_h = h;
    fill_canvas_metrics(canvas, m);
    m->pixel_fit = pixel_fit;

    char *result = strdup(gs->str);
    g_string_free(gs, 1);
    return result;
}

/* Build a JSON matrix string from canvas cells.
   Format: [[[charCode,fg,fb],[...]], ...]  (row-major 2D array of [char,fg,bg] triples)
   Returns allocated string (caller must codec_free). */
static char *canvas_build_matrix(ChafaCanvas *canvas, CodecMetrics *m)
{
    const ChafaCanvasConfig *ccfg = chafa_canvas_peek_config(canvas);
    gint cw = canvas->config.width;
    gint ch = canvas->config.height;
    fill_canvas_metrics(canvas, m);

    /* Estimate output size: ~25 bytes per cell + delimiters */
    gsize est = (gsize)cw * (gsize)ch * 28 + 256;
    GString *gs = g_string_sized_new(est);
    if (!gs) return NULL;
    g_string_append_c(gs, '[');

    for (gint y = 0; y < ch; y++)
    {
        if (y > 0) g_string_append_c(gs, ',');
        g_string_append_c(gs, '[');
        for (gint x = 0; x < cw; x++)
        {
            gint fg = 0, bg = 0;
            gunichar c = chafa_canvas_get_char_at(canvas, x, y);
            chafa_canvas_get_raw_colors_at(canvas, x, y, &fg, &bg);
            if (x > 0) g_string_append_c(gs, ',');
            g_string_append_printf(gs, "[%u,%d,%d]", (unsigned)c, fg, bg);
        }
        g_string_append_c(gs, ']');
    }
    g_string_append_c(gs, ']');

    char *result = strdup(gs->str);
    g_string_free(gs, 1);
    return result;
}

/* -- Decode a buffer into RGBA pixels -- */
static uint8_t *decode_image(const uint8_t *data, int32_t len,
                             int *out_w, int *out_h, int *out_frames,
                             CodecMetrics *out)
{
    int fmt = detect_format(data, len);
    out->format = fmt;
    if (fmt < 0) return NULL;

    double t0 = now_ms();
    uint8_t *rgba = NULL;
    int w = 0, h = 0, frames = 1;
    int r = -1;

    switch (fmt)
    {
    case FMT_PNG:
        r = decode_png(&rgba, &w, &h, data, len);
        break;
    case FMT_JPEG:
        r = decode_jpeg(&rgba, &w, &h, data, len);
        break;
    case FMT_BMP:
        r = decode_bmp(&rgba, &w, &h, data, len);
        break;
    case FMT_WEBP:
        r = decode_webp_static(&rgba, &w, &h, data, len);
        break;
    case FMT_GIF:
        r = decode_gif(&rgba, &w, &h, &frames, data, len);
        break;
    default:
        return NULL;
    }

    if (r != 0 || !rgba || w < MIN_DIM || w > MAX_DIM || h < MIN_DIM || h > MAX_DIM)
    {
        free(rgba);
        return NULL;
    }

    out->parse_ms = (float)(now_ms() - t0);
    out->img_w = w;
    out->img_h = h;
    out->rgba_bytes = w * h * 4;
    if (out_frames)
        *out_frames = frames;
    *out_w = w;
    *out_h = h;
    return rgba;
}

/* ══════════════════════════════════════════════════════════════════════
   Public API
   ══════════════════════════════════════════════════════════════════════ */

CODEC_EXPORT CodecCtx *codec_ctx_new(CodecConfig *cfg)
{
    CodecCtx *ctx = calloc(1, sizeof(CodecCtx));
    if (!ctx) return NULL;
    if (cfg)
        memcpy(&ctx->cfg, cfg, sizeof(CodecConfig));
    else
        config_init(&ctx->cfg);
    return ctx;
}

CODEC_EXPORT void codec_ctx_free(CodecCtx *ctx)
{
    if (!ctx) return;
    ctx_invalidate_canvas(ctx);
    for (int i = 0; i < 16; i++)
    {
        if (ctx->handles[i])
            codec_anim_close(ctx, i);
    }
    for (int i = 0; i < 16; i++)
    {
        if (ctx->video_handles[i])
            codec_video_close(ctx, i);
    }
    free(ctx->scratch.buf);
    free(ctx);
}

CODEC_EXPORT void codec_ctx_configure(CodecCtx *ctx, CodecConfig *cfg)
{
    if (!ctx || !cfg) return;
    memcpy(&ctx->cfg, cfg, sizeof(CodecConfig));
    ctx->canvas_valid = 0;
}

/* -- decode_buffer: decode any supported format -> RGBA pixels -- */
/* Caller must free the returned buffer with codec_free() */
CODEC_EXPORT uint8_t *codec_decode_buffer(char *data, int32_t len,
                                          int32_t *out_w, int32_t *out_h, int32_t *out_stride,
                                          CodecMetrics *out, int32_t *err)
{
    *err = ERR_OK;
    memset(out, 0, sizeof(CodecMetrics));
    if (!data || len <= 0) { *err = ERR_BAD_PARAMS; return NULL; }

    int w = 0, h = 0;
    uint8_t *rgba = decode_image((uint8_t *)data, len, &w, &h, NULL, out);
    if (!rgba) { *err = ERR_DECODE_FAIL; return NULL; }

    *out_w = w;
    *out_h = h;
    *out_stride = w * 4;
    out->frame_count = 1;
    return rgba;
}

/* -- decode_into: decode -> caller-provided RGBA buffer (for FFI paths) -- */
CODEC_EXPORT int codec_decode_into(char *data, int32_t len,
                                   uint8_t *rgba_out, int32_t rgba_cap,
                                   int32_t *out_w, int32_t *out_h, int32_t *out_stride,
                                   CodecMetrics *out, int32_t *err)
{
    int w = 0, h = 0;
    memset(out, 0, sizeof(CodecMetrics));
    if (!data || len <= 0) { *err = ERR_BAD_PARAMS; return ERR_BAD_PARAMS; }

    uint8_t *rgba = decode_image((uint8_t *)data, len, &w, &h, NULL, out);
    if (!rgba) { *err = ERR_DECODE_FAIL; return ERR_DECODE_FAIL; }

    int needed = h * w * 4;
    if (rgba_out && rgba_cap >= needed)
        memcpy(rgba_out, rgba, needed);
    else if (rgba_out)
        { free(rgba); *err = ERR_POOL_FULL; return ERR_POOL_FULL; }

    free(rgba);

    if (rgba_out)
    {
        *out_w = w;
        *out_h = h;
        *out_stride = w * 4;
    }
    else
    {
        *out_w = w;
        *out_h = h;
        *out_stride = w * 4;
        *err = ERR_OK;
    }
    return ERR_OK;
}

/* -- render: decode + render -> ANSI string -- */
CODEC_EXPORT char *codec_render(CodecCtx *ctx, char *data, int32_t len,
                                CodecMetrics *out, int32_t *err)
{
    *err = ERR_OK;
    memset(out, 0, sizeof(CodecMetrics));
    if (!ctx || !data || len <= 0) { *err = ERR_BAD_PARAMS; return strdup(err_string(ERR_BAD_PARAMS)); }

    int w = 0, h = 0;
    uint8_t *rgba = decode_image((uint8_t *)data, len, &w, &h, NULL, out);
    if (!rgba) { *err = ERR_DECODE_FAIL; return strdup(err_string(ERR_DECODE_FAIL)); }

    out->frame_count = 1;

    if (ctx_ensure_canvas(ctx) != 0)
    {
        free(rgba);
        *err = ERR_MALLOC;
        return strdup(err_string(ERR_MALLOC));
    }

    char *ansi = canvas_draw_and_build(ctx->canvas, rgba, w, h, w * 4, out,
                                       ctx->cfg.pixel_fit, &ctx->scratch);
    free(rgba);
    return ansi;
}

/* -- render_rgba: pre-decoded RGBA -> ANSI string -- */
CODEC_EXPORT char *codec_render_rgba(CodecCtx *ctx, uint8_t *rgba,
                                     int32_t w, int32_t h, int32_t stride,
                                     CodecMetrics *out)
{
    memset(out, 0, sizeof(CodecMetrics));
    if (!ctx || !rgba || w <= 0 || h <= 0) return strdup(err_string(ERR_BAD_PARAMS));

    if (ctx_ensure_canvas(ctx) != 0)
        return strdup(err_string(ERR_MALLOC));

    out->img_w = w;
    out->img_h = h;
    out->frame_count = 1;
    out->rgba_bytes = h * (stride > 0 ? stride : w * 4);
    return canvas_draw_and_build(ctx->canvas, rgba, w, h, stride > 0 ? stride : w * 4,
                                 out, ctx->cfg.pixel_fit, &ctx->scratch);
}

/* -- matrix: decode + render -> JSON cell grid -- */
CODEC_EXPORT char *codec_render_matrix(CodecCtx *ctx, char *data, int32_t len,
                                       CodecMetrics *out, int32_t *err)
{
    *err = ERR_OK;
    memset(out, 0, sizeof(CodecMetrics));
    if (!ctx || !data || len <= 0) { *err = ERR_BAD_PARAMS; return strdup("[]"); }

    int w = 0, h = 0;
    uint8_t *rgba = decode_image((uint8_t *)data, len, &w, &h, NULL, out);
    if (!rgba) { *err = ERR_DECODE_FAIL; return strdup("[]"); }

    out->frame_count = 1;
    out->pixel_fit = ctx->cfg.pixel_fit;

    if (ctx_ensure_canvas(ctx) != 0)
    {
        free(rgba);
        *err = ERR_MALLOC;
        return strdup("[]");
    }

    {
        double t0 = now_ms();
        chafa_canvas_draw_all_pixels(ctx->canvas, CHAFA_PIXEL_RGBA8_UNASSOCIATED,
                                     rgba, w, h, w * 4);
        out->draw_ms = (float)(now_ms() - t0);
    }
    free(rgba);

    char *json = canvas_build_matrix(ctx->canvas, out);
    out->total_ms = out->parse_ms + out->draw_ms;
    return json ? json : strdup("[]");
}

/* -- render_matrix_rgba: pre-decoded RGBA -> JSON cell grid -- */
CODEC_EXPORT char *codec_render_matrix_rgba(CodecCtx *ctx, uint8_t *rgba,
                                            int32_t w, int32_t h, int32_t stride,
                                            CodecMetrics *out)
{
    memset(out, 0, sizeof(CodecMetrics));
    if (!ctx || !rgba || w <= 0 || h <= 0) return strdup("[]");

    if (ctx_ensure_canvas(ctx) != 0)
        return strdup("[]");

    out->img_w = w;
    out->img_h = h;
    out->frame_count = 1;
    out->rgba_bytes = h * (stride > 0 ? stride : w * 4);
    out->pixel_fit = ctx->cfg.pixel_fit;

    {
        double t0 = now_ms();
        chafa_canvas_draw_all_pixels(ctx->canvas, CHAFA_PIXEL_RGBA8_UNASSOCIATED,
                                     rgba, w, h, stride > 0 ? stride : w * 4);
        out->draw_ms = (float)(now_ms() - t0);
    }

    char *json = canvas_build_matrix(ctx->canvas, out);
    out->total_ms = out->parse_ms + out->draw_ms;
    return json ? json : strdup("[]");
}

/* ══════════════════════════════════════════════════════════════════════
   Animation
   ══════════════════════════════════════════════════════════════════════ */

/* Snapshot pixel-fit and assign a kitty image id (when in kitty mode) so
   animation frames update one reusable image instead of leaking one each. */
static void anim_setup_common(CodecCtx *ctx, AnimHandle *ah)
{
    ah->pixel_fit = ctx->cfg.pixel_fit;
    if (ctx->cfg.pixel_mode == CHAFA_PIXEL_MODE_KITTY)
    {
        if (ctx->next_kitty_id < 1 || ctx->next_kitty_id > 255)
            ctx->next_kitty_id = 1;
        ah->kitty_id = ctx->next_kitty_id++;
    }
}

static AnimHandle *anim_create(CodecCtx *ctx, AnimType type, uint8_t *rgba,
                               int frames, int w, int h, uint8_t *raw_buf, int raw_len,
                               CodecConfig *cfg)
{
    /* Destroy existing canvas so make_canvas_config gets fresh symbol maps */
    ctx_invalidate_canvas(ctx);

    AnimHandle *ah = calloc(1, sizeof(AnimHandle));
    if (!ah) return NULL;
    ah->type = type;
    ah->rgbabuf = rgba;
    ah->total_frames = frames;
    ah->frame_size = w * h * 4;
    ah->w = w;
    ah->h = h;
    ah->idx = 0;

    /* Each animation gets its own canvas (not the shared ctx canvas) */
    ah->canvas_cfg = make_canvas_config(cfg);
    if (!ah->canvas_cfg) { free(ah); return NULL; }
    ah->canvas = chafa_canvas_new(ah->canvas_cfg);
    if (!ah->canvas) { chafa_canvas_config_unref(ah->canvas_cfg); free(ah); return NULL; }

    /* Rebuild context canvas with original config */
    ctx->canvas_valid = 0;

    for (int i = 0; i < 16; i++)
    {
        if (!ctx->handles[i])
        {
            ctx->handles[i] = ah;
            return ah;
        }
    }
    chafa_canvas_unref(ah->canvas);
    chafa_canvas_config_unref(ah->canvas_cfg);
    free(ah);
    return NULL;
}

CODEC_EXPORT int32_t codec_anim_open(CodecCtx *ctx, char *data, int32_t len,
                                     CodecMetrics *out, int32_t *err)
{
    *err = ERR_OK;
    memset(out, 0, sizeof(CodecMetrics));
    if (!ctx || !data || len <= 0) { *err = ERR_BAD_PARAMS; return -1; }

    int fmt = detect_format((uint8_t *)data, len);
    out->format = fmt;

    if (fmt == FMT_WEBP)
    {
        WebPData wpd = {(uint8_t *)data, (size_t)len};
        WebPAnimDecoderOptions opts;
        WebPAnimDecoderOptionsInit(&opts);
        opts.color_mode = MODE_RGBA;
        WebPAnimDecoder *dec = WebPAnimDecoderNew(&wpd, &opts);
        if (!dec) { *err = ERR_DECODE_FAIL; return -1; }

        WebPAnimInfo inf;
        WebPAnimDecoderGetInfo(dec, &inf);
        int w = inf.canvas_width, iH = inf.canvas_height, fs = w * iH * 4;
        /* Allocate pool for decoded frames (max 500 frames or 256MB) */
        int pool_cap = fs * 500;
        if (pool_cap > 256 * 1024 * 1024) pool_cap = 256 * 1024 * 1024;
        uint8_t *pool = malloc(pool_cap);
        if (!pool) { WebPAnimDecoderDelete(dec); *err = ERR_MALLOC; return -1; }

        uint8_t *fbuf;
        int ts, prev_ts = 0;
        if (!WebPAnimDecoderGetNext(dec, &fbuf, &ts))
        {
            WebPAnimDecoderDelete(dec);
            free(pool);
            *err = ERR_DECODE_FAIL;
            return -1;
        }
        memcpy(pool, fbuf, fs);
        out->img_w = w;
        out->img_h = iH;
        out->frame_delay_ms = ts;
        out->frame_count = -1;

        AnimHandle *ah = calloc(1, sizeof(AnimHandle));
        if (!ah)
        {
            WebPAnimDecoderDelete(dec);
            free(pool);
            *err = ERR_MALLOC;
            return -1;
        }
        ah->type = ANIM_WEBP;
        ah->rgbabuf = pool;
        ah->w = w;
        ah->h = iH;
        ah->frame_size = fs;
        ah->total_frames = -1;
        ah->idx = 1;
        ah->delays = malloc(sizeof(int) * 1000);
        if (!ah->delays)
        {
            WebPAnimDecoderDelete(dec);
            free(pool);
            free(ah);
            *err = ERR_MALLOC;
            return -1;
        }
        ah->delays[0] = ts;
        ah->webp_dec = dec;
        ah->prev_ts = ts;
        ah->webp_len = len;
        ah->webp_buf = malloc(len);
        if (!ah->webp_buf)
        {
            WebPAnimDecoderDelete(dec);
            free(pool);
            free(ah->delays);
            free(ah);
            *err = ERR_MALLOC;
            return -1;
        }
        memcpy(ah->webp_buf, data, len);

        /* Create animation's own canvas from the current context config */
        ah->canvas_cfg = make_canvas_config(&ctx->cfg);
        if (!ah->canvas_cfg)
        {
            WebPAnimDecoderDelete(dec);
            free(pool);
            free(ah->delays);
            free(ah->webp_buf);
            free(ah);
            *err = ERR_MALLOC;
            return -1;
        }
        ah->canvas = chafa_canvas_new(ah->canvas_cfg);
        if (!ah->canvas)
        {
            chafa_canvas_config_unref(ah->canvas_cfg);
            WebPAnimDecoderDelete(dec);
            free(pool);
            free(ah->delays);
            free(ah->webp_buf);
            free(ah);
            *err = ERR_MALLOC;
            return -1;
        }
        fill_canvas_metrics(ah->canvas, out);
        anim_setup_common(ctx, ah);

        for (int i = 0; i < 16; i++)
            if (!ctx->handles[i])
            {
                ctx->handles[i] = ah;
                return i;
            }

        /* No free slot */
        chafa_canvas_unref(ah->canvas);
        chafa_canvas_config_unref(ah->canvas_cfg);
        WebPAnimDecoderDelete(dec);
        free(pool);
        free(ah->delays);
        free(ah->webp_buf);
        free(ah);
        *err = ERR_POOL_FULL;
        return -1;
    }

    if (fmt == FMT_GIF)
    {
        int iw, ih, frames, comp, *delays;
        uint8_t *data8 = stbi_load_gif_from_memory((stbi_uc *)data, len, &delays, &iw, &ih, &frames, &comp, 4);
        if (!data8 || frames < 2)
        {
            free(data8);
            free(delays);
            *err = ERR_DECODE_FAIL;
            return -1;
        }
        int maxf = ctx->cfg.max_frames > 0 && ctx->cfg.max_frames < frames
                       ? ctx->cfg.max_frames : frames;
        out->img_w = iw;
        out->img_h = ih;
        out->frame_count = maxf;
        out->frame_delay_ms = delays[0];

        AnimHandle *ah = calloc(1, sizeof(AnimHandle));
        if (!ah)
        {
            stbi_image_free(data8);
            stbi_image_free(delays);
            *err = ERR_MALLOC;
            return -1;
        }
        ah->type = ANIM_GIF;
        ah->rgbabuf = data8;
        ah->w = iw;
        ah->h = ih;
        ah->frame_size = iw * ih * 4;
        ah->total_frames = maxf;
        ah->idx = 0;
        ah->delays = delays;

        ah->canvas_cfg = make_canvas_config(&ctx->cfg);
        if (!ah->canvas_cfg)
        {
            stbi_image_free(data8);
            stbi_image_free(delays);
            free(ah);
            *err = ERR_MALLOC;
            return -1;
        }
        ah->canvas = chafa_canvas_new(ah->canvas_cfg);
        if (!ah->canvas)
        {
            chafa_canvas_config_unref(ah->canvas_cfg);
            stbi_image_free(data8);
            stbi_image_free(delays);
            free(ah);
            *err = ERR_MALLOC;
            return -1;
        }
        fill_canvas_metrics(ah->canvas, out);
        anim_setup_common(ctx, ah);

        for (int i = 0; i < 16; i++)
            if (!ctx->handles[i])
            {
                ctx->handles[i] = ah;
                return i;
            }

        chafa_canvas_unref(ah->canvas);
        chafa_canvas_config_unref(ah->canvas_cfg);
        stbi_image_free(data8);
        stbi_image_free(delays);
        free(ah);
        *err = ERR_POOL_FULL;
        return -1;
    }

    *err = ERR_UNSUPPORTED;
    return -1;
}

CODEC_EXPORT int32_t codec_anim_next(CodecCtx *ctx, int32_t handle, CodecMetrics *out)
{
    memset(out, 0, sizeof(CodecMetrics));
    if (!ctx || handle < 0 || handle >= 16 || !ctx->handles[handle])
        return -1;
    AnimHandle *h = ctx->handles[handle];
    if (h->aborted) return -1;
    out->img_w = h->w;
    out->img_h = h->h;

    if (h->type == ANIM_GIF)
    {
        out->format = FMT_GIF;
        if (h->idx >= h->total_frames) return -1;
        out->frame_delay_ms = h->delays ? h->delays[h->idx] : 100;
        return h->idx++;
    }
    if (h->type == ANIM_WEBP)
    {
        out->format = FMT_WEBP;
        if (h->done) return -1;
        uint8_t *fbuf;
        int ts;
        if (!WebPAnimDecoderGetNext(h->webp_dec, &fbuf, &ts))
        {
            h->done = 1;
            return -1;
        }
        /* Check that we don't overflow the pool */
        int offset = h->idx * h->frame_size;
        if (offset + h->frame_size > 256 * 1024 * 1024)
        {
            h->done = 1;
            return -1;
        }
        memcpy(h->rgbabuf + offset, fbuf, h->frame_size);
        int delta = ts - h->prev_ts;
        if (delta < 0) delta = h->delays ? h->delays[0] : 100;
        out->frame_delay_ms = delta;
        h->delays[h->idx] = delta;
        h->prev_ts = ts;
        return h->idx++;
    }
    return -1;
}

CODEC_EXPORT uint8_t *codec_anim_frame_data(CodecCtx *ctx, int32_t handle, int32_t frame_idx)
{
    if (!ctx || handle < 0 || handle >= 16 || !ctx->handles[handle])
        return NULL;
    AnimHandle *h = ctx->handles[handle];
    if (frame_idx < 0 || frame_idx >= h->idx)
        return NULL;
    return h->rgbabuf + frame_idx * h->frame_size;
}

CODEC_EXPORT char *codec_anim_render_frame(CodecCtx *ctx, int32_t handle, int32_t frame_idx,
                                           CodecMetrics *out)
{
    memset(out, 0, sizeof(CodecMetrics));
    if (!ctx || handle < 0 || handle >= 16 || !ctx->handles[handle])
        return strdup("");
    AnimHandle *h = ctx->handles[handle];
    uint8_t *data = codec_anim_frame_data(ctx, handle, frame_idx);
    if (!data) return strdup("");
    out->frame_delay_ms = h->delays ? h->delays[frame_idx] : 100;
    out->frame_count = h->total_frames;
    out->format = (h->type == ANIM_GIF) ? FMT_GIF : FMT_WEBP;
    out->rgba_bytes = h->w * h->h * 4;
    char *ansi = canvas_draw_and_build(h->canvas, data, h->w, h->h, h->w * 4, out,
                                       h->pixel_fit, &h->scratch);
    if (h->kitty_id >= 1)
    {
        const ChafaCanvasConfig *ccfg = chafa_canvas_peek_config(h->canvas);
        if (chafa_canvas_config_get_pixel_mode(ccfg) == CHAFA_PIXEL_MODE_KITTY)
        {
            char *with_id = inject_kitty_image_id(ansi, h->kitty_id);
            if (with_id)
            {
                free(ansi);
                ansi = with_id;
            }
        }
    }
    return ansi;
}

CODEC_EXPORT int32_t codec_anim_rewind(CodecCtx *ctx, int32_t handle)
{
    if (!ctx || handle < 0 || handle >= 16 || !ctx->handles[handle])
        return -1;
    AnimHandle *h = ctx->handles[handle];
    if (h->type == ANIM_GIF) { h->idx = 0; return 0; }
    if (h->type == ANIM_WEBP)
    {
        WebPAnimDecoderDelete(h->webp_dec);
        WebPData wpd = {h->webp_buf, (size_t)h->webp_len};
        WebPAnimDecoderOptions opts;
        WebPAnimDecoderOptionsInit(&opts);
        opts.color_mode = MODE_RGBA;
        h->webp_dec = WebPAnimDecoderNew(&wpd, &opts);
        if (!h->webp_dec) return -1;
        h->idx = 0;
        h->done = 0;
        h->prev_ts = 0;
        return 0;
    }
    return -1;
}

CODEC_EXPORT void codec_anim_close(CodecCtx *ctx, int32_t handle)
{
    if (!ctx || handle < 0 || handle >= 16 || !ctx->handles[handle])
        return;
    AnimHandle *h = ctx->handles[handle];
    if (h->type == ANIM_GIF)
    {
        stbi_image_free(h->rgbabuf);
        stbi_image_free(h->delays);
    }
    if (h->type == ANIM_WEBP)
    {
        WebPAnimDecoderDelete(h->webp_dec);
        free(h->rgbabuf);
        free(h->delays);
        free(h->webp_buf);
    }
    if (h->canvas)       chafa_canvas_unref(h->canvas);
    if (h->canvas_cfg)   chafa_canvas_config_unref(h->canvas_cfg);
    free(h->scratch.buf);
    free(h);
    ctx->handles[handle] = NULL;
}

CODEC_EXPORT void codec_anim_abort(CodecCtx *ctx, int32_t handle)
{
    if (!ctx || handle < 0 || handle >= 16 || !ctx->handles[handle])
        return;
    ctx->handles[handle]->aborted = 1;
}

CODEC_EXPORT void codec_free(void *p)
{
    free(p);
}
