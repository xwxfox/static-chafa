/**
 * @file codec_video.c
 * @brief FFmpeg-based video decode with streaming ring buffer.
 *
 * Loads FFmpeg (libavcodec + libavformat + libavutil + libswscale) at
 * runtime via dlopen. Falls back gracefully with a descriptive error if
 * FFmpeg is not installed. This module has zero compile-time FFmpeg linkage
 * - all symbols are resolved through function pointers via dlsym.
 *
 * ## Architecture
 *
 * 1. `codec_video_open()` - opens a video from a memory buffer, probes the
 *    container, finds the best video stream, and initialises a YUV→RGBA
 *    scaler. Audio metadata is tracked but audio packets are discarded.
 *
 * 2. `codec_video_next()` - returns the next pre-decoded RGBA frame from a
 *    ring buffer (default 8 frames). If the buffer is not full, the decode
 *    loop pulls more packets and fills ahead. The caller receives a pointer
 *    into the ring buffer (valid until the next call).
 *
 * 3. `codec_video_seek()` - flushes codec state and seeks to the nearest
 *    keyframe before the target timestamp. Ring buffer is cleared.
 *
 * ## Soname fallback
 *
 * Attempted in order: 62 → 61 → 60 → 59 → 58 for each library.
 * This covers FFmpeg 7.x (soname 62) through FFmpeg 4.x (soname 58).
 *
 * @see https://ffmpeg.org/doxygen/trunk/index.html
 */

#ifdef _WIN32
#include <windows.h>
#define RTLD_NOW 0
#define RTLD_LOCAL 0
#define dlopen(path, flags) LoadLibraryA(path)
#define dlsym(handle, name) GetProcAddress((HMODULE)(handle), name)
#define dlclose(handle) FreeLibrary((HMODULE)(handle))
#else
#include <dlfcn.h>
#endif
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

/* Symbol export for Windows DLL */
#ifdef _WIN32
#define CODEC_EXPORT __declspec(dllexport)
#else
#define CODEC_EXPORT __attribute__((visibility("default")))
#endif

#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libavutil/avutil.h>
#include <libavutil/frame.h>
#include <libavutil/imgutils.h>
#include <libavutil/mem.h>
#include <libavutil/pixfmt.h>
#include <libavutil/rational.h>
#include <libavutil/error.h>
#include <libavutil/dict.h>
#include <libavutil/mathematics.h>
#include <libswscale/swscale.h>

/* ---- Forward types (shared with codec.c) --------------------------- */
/* codec_video.c accesses video handles through codec_ctx_get_video_slots() */
typedef struct CodecCtx CodecCtx;

typedef struct {
    float parse_ms, draw_ms, build_ms, total_ms;
    int32_t img_w, img_h;
    int32_t canvas_w, canvas_h, canvas_pw, canvas_ph;
    int32_t frame_count, frame_delay_ms;
    int32_t rgba_bytes;
    int32_t format, canvas_mode, pixel_mode, have_alpha;
} CodecMetrics;

/* Provided by codec.c */
extern void **codec_ctx_get_video_slots(CodecCtx *ctx);
extern void *codec_ctx_get_video_handle(CodecCtx *ctx, int slot);
extern void codec_ctx_set_video_handle(CodecCtx *ctx, int slot, void *handle);

/* Error codes from codec.c */
#define ERR_OK 0
#define ERR_MALLOC -5
#define ERR_DECODE_FAIL -9
#define ERR_POOL_FULL -11
#define ERR_UNSUPPORTED -6
#define ERR_BAD_PARAMS -12
#define ERR_FFMPEG -20

/* Forward declarations within this file */
typedef struct VideoHandle VideoHandle;
CODEC_EXPORT int32_t codec_video_open_handle(CodecCtx *ctx, VideoHandle *vh);
CODEC_EXPORT void codec_video_close(CodecCtx *ctx, int32_t handle);

/* ---- FFmpeg function pointer table ---------------------------------- */

typedef int (*P_avcodec_send_packet)(AVCodecContext *, const AVPacket *);
typedef int (*P_avcodec_receive_frame)(AVCodecContext *, AVFrame *);
typedef AVCodec *(*P_avcodec_find_decoder)(enum AVCodecID);
typedef AVCodecContext *(*P_avcodec_alloc_context3)(const AVCodec *);
typedef int (*P_avcodec_open2)(AVCodecContext *, const AVCodec *, AVDictionary **);
typedef int (*P_avcodec_close)(AVCodecContext *);
typedef void (*P_avcodec_free_context)(AVCodecContext **);
typedef void (*P_avcodec_flush_buffers)(AVCodecContext *);
typedef int (*P_avcodec_parameters_to_context)(AVCodecContext *, const AVCodecParameters *);
typedef char *(*P_avcodec_get_name)(enum AVCodecID);
typedef const char *(*P_avcodec_license)(void);

typedef int (*P_avformat_open_input)(AVFormatContext **, const char *, const AVInputFormat *, AVDictionary **);
typedef void (*P_avformat_close_input)(AVFormatContext **);
typedef AVFormatContext *(*P_avformat_alloc_context)(void);
typedef int (*P_avformat_find_stream_info)(AVFormatContext *, AVDictionary **);
typedef int (*P_av_read_frame)(AVFormatContext *, AVPacket *);
typedef int (*P_av_seek_frame)(AVFormatContext *, int, int64_t, int);
typedef int (*P_avformat_seek_file)(AVFormatContext *, int, int64_t, int64_t, int64_t, int);
typedef void (*P_av_packet_unref)(AVPacket *);
typedef void (*P_avformat_network_init)(void);

typedef void (*P_av_init_packet)(AVPacket *);
typedef AVFrame *(*P_av_frame_alloc)(void);
typedef void (*P_av_frame_unref)(AVFrame *);
typedef void (*P_av_frame_free)(AVFrame **);
typedef void (*P_avio_context_free)(AVIOContext **);

typedef void *(*P_av_malloc)(size_t);
typedef void (*P_av_free)(void *);
typedef void (*P_av_freep)(void *);
typedef int (*P_av_strerror)(int, char *, size_t);
typedef int (*P_av_dict_set)(AVDictionary **, const char *, const char *, int);
typedef void (*P_av_dict_free)(AVDictionary **);

typedef struct SwsContext *(*P_sws_getContext)(int, int, enum AVPixelFormat,
    int, int, enum AVPixelFormat, int, SwsFilter *, SwsFilter *, const double *);
typedef int (*P_sws_scale)(struct SwsContext *, const uint8_t *const *,
    const int *, int, int, uint8_t *const *, const int *);
typedef void (*P_sws_freeContext)(struct SwsContext *);

typedef AVIOContext *(*P_avio_alloc_context)(unsigned char *, int, int, void *,
    int (*)(void *, uint8_t *, int), int (*)(void *, uint8_t *, int),
    int64_t (*)(void *, int64_t, int));

typedef struct {
    int ok;
    void *avcodec, *avformat, *avutil, *swscale;

    P_avcodec_send_packet avcodec_send_packet;
    P_avcodec_receive_frame avcodec_receive_frame;
    P_avcodec_find_decoder avcodec_find_decoder;
    P_avcodec_alloc_context3 avcodec_alloc_context3;
    P_avcodec_open2 avcodec_open2;
    P_avcodec_parameters_to_context avcodec_parameters_to_context;
    P_avcodec_free_context avcodec_free_context;
    P_avcodec_flush_buffers avcodec_flush_buffers;
    P_avcodec_get_name avcodec_get_name;

    P_avformat_open_input avformat_open_input;
    P_avformat_close_input avformat_close_input;
    P_avformat_alloc_context avformat_alloc_context;
    P_avformat_find_stream_info avformat_find_stream_info;
    P_av_read_frame av_read_frame;
    P_av_seek_frame av_seek_frame;
    P_avformat_seek_file avformat_seek_file;
    P_av_packet_unref av_packet_unref;

    P_av_frame_alloc av_frame_alloc;
    P_av_frame_unref av_frame_unref;
    P_av_frame_free av_frame_free;

    P_av_malloc av_malloc;
    P_av_free av_free;
    P_av_freep av_freep;
    P_av_strerror av_strerror;

    P_sws_getContext sws_getContext;
    P_sws_scale sws_scale;
    P_sws_freeContext sws_freeContext;

    P_avio_alloc_context avio_alloc_context;

    char error_msg[512];
} FFmpegVTable;

static FFmpegVTable ff = {0};
static int ff_tried = 0;

/* ---- Soname fallback chains ---------------------------------------- */

static const char *SONAME_AVCODEC[]  = {
#ifdef _WIN32
    "avcodec-63.dll", "avcodec-62.dll", "avcodec-61.dll", "avcodec-60.dll",
    "avcodec-59.dll", "avcodec-58.dll", NULL
#else
    "libavcodec.so.63", "libavcodec.so.62", "libavcodec.so.61", "libavcodec.so.60",
    "libavcodec.so.59", "libavcodec.so.58", NULL
#endif
};
static const char *SONAME_AVFORMAT[] = {
#ifdef _WIN32
    "avformat-63.dll", "avformat-62.dll", "avformat-61.dll", "avformat-60.dll",
    "avformat-59.dll", "avformat-58.dll", NULL
#else
    "libavformat.so.63", "libavformat.so.62", "libavformat.so.61", "libavformat.so.60",
    "libavformat.so.59", "libavformat.so.58", NULL
#endif
};
static const char *SONAME_AVUTIL[] = {
#ifdef _WIN32
    "avutil-61.dll", "avutil-60.dll", "avutil-59.dll", "avutil-58.dll",
    "avutil-57.dll", "avutil-56.dll", NULL
#else
    "libavutil.so.61", "libavutil.so.60", "libavutil.so.59", "libavutil.so.58",
    "libavutil.so.57", "libavutil.so.56", NULL
#endif
};
static const char *SONAME_SWSCALE[] = {
#ifdef _WIN32
    "swscale-10.dll", "swscale-9.dll", "swscale-8.dll", "swscale-7.dll", "swscale-6.dll",
    "swscale-5.dll", NULL
#else
    "libswscale.so.10", "libswscale.so.9", "libswscale.so.8", "libswscale.so.7",
    "libswscale.so.6", "libswscale.so.5", NULL
#endif
};

static void *try_open(const char *const *names)
{
    for (int i = 0; names[i]; i++) {
        void *h = dlopen(names[i], RTLD_NOW | RTLD_LOCAL);
        if (h) return h;
    }
    return NULL;
}

static int ff_init(void)
{
    if (ff_tried) return ff.ok;
    ff_tried = 1;

    ff.avcodec  = try_open(SONAME_AVCODEC);
    ff.avformat = try_open(SONAME_AVFORMAT);
    ff.avutil   = try_open(SONAME_AVUTIL);
    ff.swscale  = try_open(SONAME_SWSCALE);

    if (!ff.avcodec || !ff.avformat || !ff.avutil || !ff.swscale)
        goto fail;

#define LOAD(lib, fn) \
    ff.fn = (typeof(ff.fn))dlsym(ff.lib, "" #fn); \
    if (!ff.fn) { snprintf(ff.error_msg, sizeof(ff.error_msg), \
        "FFmpeg: missing symbol " #fn " in " #lib); goto fail; }

    LOAD(avcodec, avcodec_send_packet);
    LOAD(avcodec, avcodec_receive_frame);
    LOAD(avcodec, avcodec_find_decoder);
    LOAD(avcodec, avcodec_alloc_context3);
    LOAD(avcodec, avcodec_open2);
    LOAD(avcodec, avcodec_parameters_to_context);
    LOAD(avcodec, avcodec_free_context);
    LOAD(avcodec, avcodec_flush_buffers);
    LOAD(avcodec, avcodec_get_name);
    LOAD(avcodec, av_packet_unref);

    LOAD(avformat, avformat_open_input);
    LOAD(avformat, avformat_close_input);
    LOAD(avformat, avformat_alloc_context);
    LOAD(avformat, avformat_find_stream_info);
    LOAD(avformat, av_read_frame);
    LOAD(avformat, av_seek_frame);
    LOAD(avformat, avformat_seek_file);

    LOAD(avutil, av_frame_alloc);
    LOAD(avutil, av_frame_unref);
    LOAD(avutil, av_frame_free);
    LOAD(avutil, av_malloc);        /* ff.av_malloc */
    LOAD(avutil, av_free);          /* ff.av_free */
    LOAD(avutil, av_freep);         /* ff.av_freep */
    LOAD(avutil, av_strerror);      /* ff.av_strerror */

    LOAD(swscale, sws_getContext);
    LOAD(swscale, sws_scale);
    LOAD(swscale, sws_freeContext);

    LOAD(avformat, avio_alloc_context);

#undef LOAD

    ff.ok = 1;
    snprintf(ff.error_msg, sizeof(ff.error_msg),
        "FFmpeg loaded successfully (codec=%s format=%s util=%s swscale=%s)",
        SONAME_AVCODEC[0], SONAME_AVFORMAT[0], SONAME_AVUTIL[0], SONAME_SWSCALE[0]);
    return 1;

fail:
    if (ff.avcodec)  { dlclose(ff.avcodec);  ff.avcodec  = NULL; }
    if (ff.avformat) { dlclose(ff.avformat); ff.avformat = NULL; }
    if (ff.avutil)   { dlclose(ff.avutil);   ff.avutil   = NULL; }
    if (ff.swscale)  { dlclose(ff.swscale);  ff.swscale  = NULL; }
    ff.ok = 0;
    if (ff.error_msg[0] == 0) {
#ifdef _WIN32
        snprintf(ff.error_msg, sizeof(ff.error_msg),
            "FFmpeg shared DLLs not found (avcodec-*.dll, avformat-*.dll, avutil-*.dll, "
            "swscale-*.dll must be on PATH). You need a SHARED FFmpeg build - the static "
            "ffmpeg.exe builds (e.g. gyan.dev 'full_build') ship no DLLs and cannot be used. "
            "Download e.g. ffmpeg-master-latest-win64-gpl-shared.zip from "
            "https://github.com/BtbN/FFmpeg-Builds/releases and add its bin\\ directory to PATH.");
#else
        snprintf(ff.error_msg, sizeof(ff.error_msg),
            "FFmpeg libraries not found. Install: sudo apt install libavcodec62 libavformat62 libavutil60 libswscale8");
#endif
    }
    return 0;
}

/* ---- inline FFmpeg helper (from mathematics.h, we implement since we don't link FFmpeg) ---- */

static inline int64_t rescale_q_inline(int64_t a, AVRational bq, AVRational cq)
{
    int64_t b = bq.num * (int64_t)cq.den;
    int64_t c = cq.num * (int64_t)bq.den;
    int64_t r = a * b;
    if (b < 0) { b = -b; c = -c; }
    return (r + (c >> 1)) / c;
}

/* ---- Custom IO context (reads from memory buffer) ------------------- */

typedef struct {
    const uint8_t *data;
    size_t pos, len;
} MemIO;

static int memio_read(void *opaque, uint8_t *buf, int sz)
{
    MemIO *m = (MemIO *)opaque;
    int avail = (int)(m->len - m->pos);
    if (avail <= 0) return AVERROR_EOF;
    int n = sz < avail ? sz : avail;
    memcpy(buf, m->data + m->pos, n);
    m->pos += n;
    return n;
}

static int64_t memio_seek(void *opaque, int64_t off, int whence)
{
    MemIO *m = (MemIO *)opaque;
    int64_t new_pos;
    if (whence == SEEK_SET)      new_pos = off;
    else if (whence == SEEK_CUR) new_pos = (int64_t)m->pos + off;
    else if (whence == SEEK_END) new_pos = (int64_t)m->len + off;
    else                         return -1;
    if (new_pos < 0 || (size_t)new_pos > m->len) return -1;
    m->pos = (size_t)new_pos;
    return new_pos;
}

/* ---- Video handle --------------------------------------------------- */

#define VIDEO_POOL_SIZE  8         /* ring buffer depth */
#define VIDEO_POOL_MAX_MB 256      /* total pool memory cap in MB */

typedef struct VideoHandle {
    AVFormatContext *fmt_ctx;
    AVCodecContext *codec_ctx;
    int video_stream_idx;
    int audio_stream_idx;
    struct SwsContext *sws_ctx;

    /* Ring buffer */
    uint8_t *frame_buf[VIDEO_POOL_SIZE];
    double frame_pts[VIDEO_POOL_SIZE];
    int pool_head, pool_tail, pool_count;
    int frame_stride;

    /* Metadata */
    int src_w, src_h;
    int decode_w, decode_h;
    double duration_sec, fps;

    /* Audio metadata */
    int has_audio;
    char audio_codec_name[32];
    int audio_sample_rate, audio_channels;

    /* State */
    int eof, seeking;
    AVRational time_base;
    int64_t total_frames_decoded; /* accurate count, never resets */

    /* Playback clock */
    int playing;
    double playback_start_pts;
    double playback_start_wall_ms;
    double speed;

    /* Memory IO */
    uint8_t *owned_data;    /* C-heap copy of input buffer (JS GC can move the original) */
    MemIO memio;
    AVIOContext *avio;
    unsigned char *avio_buf;
} VideoHandle;

/* ---- Video open ---------------------------------------------------- */

CODEC_EXPORT int codec_video_open(CodecCtx *ctx, char *data, int32_t len,
                     int32_t decode_w, int32_t decode_h,
                     CodecMetrics *out, int32_t *err)
{
    *err = 0;
    memset(out, 0, sizeof(CodecMetrics));

    if (!ff_init()) {
        *err = ERR_FFMPEG;
        return -1;
    }

    /* Allocate handle */
    VideoHandle *vh = calloc(1, sizeof(VideoHandle));
    if (!vh) { *err = ERR_MALLOC; return -1; }
    vh->video_stream_idx = -1;
    vh->audio_stream_idx = -1;

    /* Memory IO context */
    vh->owned_data = malloc((size_t)len);
    if (!vh->owned_data) { free(vh); *err = ERR_MALLOC; return -1; }
    memcpy(vh->owned_data, data, (size_t)len);
    vh->memio.data = vh->owned_data;
    vh->memio.len = (size_t)len;

    size_t avio_buf_sz = 4096;
    vh->avio_buf = ff.av_malloc(avio_buf_sz);
    if (!vh->avio_buf) { free(vh); *err = ERR_MALLOC; return -1; }

    vh->avio = ff.avio_alloc_context(
        vh->avio_buf, (int)avio_buf_sz, 0,
        &vh->memio, memio_read, NULL, memio_seek);
    if (!vh->avio) {
        ff.av_free(vh->avio_buf);
        free(vh);
        *err = ERR_MALLOC;
        return -1;
    }

    /* Open container */
    vh->fmt_ctx = ff.avformat_alloc_context();
    if (!vh->fmt_ctx) { goto err; }
    vh->fmt_ctx->pb = vh->avio;

    if (ff.avformat_open_input(&vh->fmt_ctx, NULL, NULL, NULL) < 0) goto err;
    if (ff.avformat_find_stream_info(vh->fmt_ctx, NULL) < 0) goto err;

    /* Find video + audio streams */
    for (unsigned i = 0; i < vh->fmt_ctx->nb_streams; i++) {
        AVCodecParameters *par = vh->fmt_ctx->streams[i]->codecpar;
        if (par->codec_type == AVMEDIA_TYPE_VIDEO && vh->video_stream_idx < 0)
            vh->video_stream_idx = (int)i;
        else if (par->codec_type == AVMEDIA_TYPE_AUDIO && vh->audio_stream_idx < 0)
            vh->audio_stream_idx = (int)i;
    }

    if (vh->video_stream_idx < 0) goto err;

    /* Open video codec */
    AVCodecParameters *vpar = vh->fmt_ctx->streams[vh->video_stream_idx]->codecpar;
    const AVCodec *codec = ff.avcodec_find_decoder(vpar->codec_id);
    if (!codec) goto err;

    vh->codec_ctx = ff.avcodec_alloc_context3(codec);
    if (!vh->codec_ctx) goto err;

    if (ff.avcodec_parameters_to_context(vh->codec_ctx, vpar) < 0) goto err;
    if (ff.avcodec_open2(vh->codec_ctx, codec, NULL) < 0) goto err;

    /* Dimensions */
    vh->src_w = vpar->width;
    vh->src_h = vpar->height;
    vh->decode_w = (decode_w > 0 && decode_w < vh->src_w) ? decode_w : vh->src_w;
    vh->decode_h = (decode_h > 0 && decode_h < vh->src_h) ? decode_h : vh->src_h;

    /* Ensure even dimensions for YUV subsampling */
    if (vh->decode_w & 1) vh->decode_w++;
    if (vh->decode_h & 1) vh->decode_h++;

    /* Duration / FPS */
    AVStream *vstr = vh->fmt_ctx->streams[vh->video_stream_idx];
    vh->time_base = vstr->time_base;
    if (vstr->duration > 0)
        vh->duration_sec = (double)vstr->duration * av_q2d(vstr->time_base);
    else if (vh->fmt_ctx->duration > 0)
        vh->duration_sec = (double)vh->fmt_ctx->duration / (double)AV_TIME_BASE;

    if (vstr->avg_frame_rate.den > 0)
        vh->fps = av_q2d(vstr->avg_frame_rate);
    else if (vstr->r_frame_rate.den > 0)
        vh->fps = av_q2d(vstr->r_frame_rate);

    if (vh->fps <= 0 && vh->duration_sec > 0)
        vh->fps = (double)vstr->nb_frames / vh->duration_sec;
    if (vh->fps <= 0) vh->fps = 30.0;

    /* SwsContext for YUV→RGBA + optional downscale */
    vh->sws_ctx = ff.sws_getContext(
        vh->src_w, vh->src_h, vpar->format,
        vh->decode_w, vh->decode_h, AV_PIX_FMT_RGBA,
        SWS_BILINEAR, NULL, NULL, NULL);
    if (!vh->sws_ctx) goto err;

    vh->frame_stride = vh->decode_w * 4;
    if (vh->frame_stride > (int)(VIDEO_POOL_MAX_MB * 1024 * 1024 / VIDEO_POOL_SIZE)) {
        vh->frame_stride = (int)(VIDEO_POOL_MAX_MB * 1024 * 1024 / VIDEO_POOL_SIZE);
    }

    /* Audio metadata */
    if (vh->audio_stream_idx >= 0) {
        AVCodecParameters *apar = vh->fmt_ctx->streams[vh->audio_stream_idx]->codecpar;
        vh->has_audio = 1;
        const char *aname = ff.avcodec_get_name(apar->codec_id);
        if (aname) snprintf(vh->audio_codec_name, sizeof(vh->audio_codec_name), "%s", aname);
        vh->audio_sample_rate = apar->sample_rate;
        vh->audio_channels = apar->ch_layout.nb_channels;
    }

    /* Populate metrics */
    out->img_w = vh->src_w;
    out->img_h = vh->src_h;
    out->frame_count = -1; /* unknown total frames */

    *err = codec_video_open_handle(ctx, vh);
    return *err;

err:
    if (vh->sws_ctx) ff.sws_freeContext(vh->sws_ctx);
    if (vh->codec_ctx) ff.avcodec_free_context(&vh->codec_ctx);
    if (vh->fmt_ctx) ff.avformat_close_input(&vh->fmt_ctx);
    free(vh->owned_data);
    /* avio_buf is owned by AVIOContext, freed by avformat_close_input */
    free(vh);
    *err = ERR_DECODE_FAIL;
    return -1;
}

/* ---- Ring buffer decode -------------------------------------------- */

static int video_decode_into(VideoHandle *vh)
{
    if (vh->eof) return 0;
    if (vh->pool_count >= VIDEO_POOL_SIZE) return 0;

    AVFrame *frame = ff.av_frame_alloc();
    if (!frame) { vh->eof = 1; return 0; }
    AVPacket pkt;

    int decoded = 0;
    while (!vh->eof && vh->pool_count < VIDEO_POOL_SIZE) {
        int r = ff.av_read_frame(vh->fmt_ctx, &pkt);
        if (r < 0) {
            if (r == AVERROR_EOF) {
                /* Flush decoder with null packet */
                memset(&pkt, 0, sizeof(pkt));
                pkt.data = NULL;
                pkt.size = 0;
                pkt.stream_index = vh->video_stream_idx;
                vh->eof = 1;
            } else {
                continue; /* skip corrupt packets */
            }
        }

        if (pkt.stream_index != vh->video_stream_idx) {
            ff.av_packet_unref(&pkt);
            continue;
        }

        r = ff.avcodec_send_packet(vh->codec_ctx, &pkt);
        ff.av_packet_unref(&pkt);
        if (r < 0) continue;

        r = ff.avcodec_receive_frame(vh->codec_ctx, frame);
        if (r < 0) {
            if (r == AVERROR(EAGAIN)) continue;
            continue;
        }

        /* YUV → RGBA + downscale */
        int idx = vh->pool_head;
        if (!vh->frame_buf[idx]) {
            vh->frame_buf[idx] = ff.av_malloc(vh->decode_h * vh->frame_stride);
            if (!vh->frame_buf[idx]) { ff.av_frame_free(&frame); vh->eof = 1; return decoded; }
        }

        uint8_t *dst[1] = { vh->frame_buf[idx] };
        int dst_stride[1] = { vh->frame_stride };
        ff.sws_scale(vh->sws_ctx,
            (const uint8_t *const *)frame->data, frame->linesize,
            0, vh->src_h, dst, dst_stride);

        vh->frame_pts[idx] = (double)frame->best_effort_timestamp * av_q2d(vh->time_base);
        vh->pool_head = (vh->pool_head + 1) % VIDEO_POOL_SIZE;
        vh->pool_count++;
        decoded++;

        if (vh->eof) {
            ff.av_frame_free(&frame);
            break;
        }
    }

    ff.av_frame_free(&frame);
    return decoded;
}

/* ---- Public API ---------------------------------------------------- */

CODEC_EXPORT int32_t codec_video_next(CodecCtx *ctx, int32_t handle,
                         uint8_t *out_rgba, int32_t out_cap,
                         int32_t *out_w, int32_t *out_h,
                         double *out_pts, CodecMetrics *out)
{
    memset(out, 0, sizeof(CodecMetrics));
    if (!ctx || handle < 0 || handle >= 16 || !codec_ctx_get_video_handle(ctx, handle))
    {
        if (out_w) *out_w = 0;
        if (out_h) *out_h = 0;
        return -1;
    }

    VideoHandle *vh = codec_ctx_get_video_handle(ctx, handle);
    if (vh->eof && vh->pool_count == 0) return -1;

    /* Fill buffer if needed */
    if (vh->pool_count == 0)
        video_decode_into(vh);
    if (vh->pool_count == 0) return -1;

    /* Pop head */
    if (out_rgba && out_cap >= vh->decode_h * vh->frame_stride)
        memcpy(out_rgba, vh->frame_buf[vh->pool_tail], vh->decode_h * vh->frame_stride);
    *out_w = vh->decode_w;
    *out_h = vh->decode_h;
    *out_pts = vh->frame_pts[vh->pool_tail];
    out->img_w = vh->decode_w;
    out->img_h = vh->decode_h;
    out->frame_delay_ms = (int32_t)(1000.0 / vh->fps);

    /* Advance tail */
    vh->pool_tail = (vh->pool_tail + 1) % VIDEO_POOL_SIZE;
    vh->pool_count--;

    /* Refill */
    video_decode_into(vh);

    return vh->total_frames_decoded++;
}

CODEC_EXPORT int32_t codec_video_info(CodecCtx *ctx, int32_t handle,
                         int32_t *out_w, int32_t *out_h,
                         double *out_duration, double *out_fps,
                         int32_t *out_has_audio,
                         char *audio_codec, int32_t *audio_rate, int32_t *audio_ch)
{
    if (!ctx || handle < 0 || handle >= 16 || !codec_ctx_get_video_handle(ctx, handle))
        return -1;

    VideoHandle *vh = codec_ctx_get_video_handle(ctx, handle);
    *out_w = vh->src_w;
    *out_h = vh->src_h;
    *out_duration = vh->duration_sec;
    *out_fps = vh->fps;
    *out_has_audio = vh->has_audio;

    if (audio_codec && vh->has_audio)
        snprintf(audio_codec, 64, "%s", vh->audio_codec_name);
    if (audio_rate) *audio_rate = vh->audio_sample_rate;
    if (audio_ch) *audio_ch = vh->audio_channels;
    return 0;
}

CODEC_EXPORT int32_t codec_video_open_handle(CodecCtx *ctx, VideoHandle *vh)
{
    void **slots = codec_ctx_get_video_slots(ctx);
    for (int i = 0; i < 16; i++) {
        if (!slots[i]) {
            slots[i] = vh;
            return i;
        }
    }
    return -1;
}

CODEC_EXPORT void codec_video_close(CodecCtx *ctx, int32_t handle)
{
    if (!ctx || handle < 0 || handle >= 16 || !codec_ctx_get_video_handle(ctx, handle))
        return;

    VideoHandle *vh = codec_ctx_get_video_handle(ctx, handle);
    for (int i = 0; i < VIDEO_POOL_SIZE; i++) {
        if (vh->frame_buf[i]) ff.av_free(vh->frame_buf[i]);
    }
    if (vh->sws_ctx) ff.sws_freeContext(vh->sws_ctx);
    if (vh->codec_ctx) ff.avcodec_free_context(&vh->codec_ctx);
    if (vh->fmt_ctx) ff.avformat_close_input(&vh->fmt_ctx);
    free(vh->owned_data);
    /* avio_buf is owned by AVIOContext, freed by avformat_close_input */
    free(vh);
    codec_ctx_set_video_handle(ctx, handle, NULL);
}

CODEC_EXPORT const char *codec_video_error(void)
{
    return ff.error_msg[0] ? ff.error_msg : "Unknown error";
}

/* -- VideoStatus struct and query -- */

static double wall_ms(void);

typedef struct {
    int32_t frame_index;
    double pts_sec;
    double duration_sec;
    double playback_elapsed_sec;
    double progress;
    int32_t playing;
    int32_t eof;
    int32_t decode_w, decode_h;
    int32_t src_w, src_h;
    int32_t has_audio;
    char audio_codec[32];
    int32_t audio_sample_rate;
    int32_t audio_channels;
} VideoStatus;

CODEC_EXPORT int32_t codec_video_status(CodecCtx *ctx, int32_t handle, VideoStatus *out)
{
    memset(out, 0, sizeof(VideoStatus));
    if (!ctx || handle < 0 || handle >= 16) return -1;
    VideoHandle *vh = codec_ctx_get_video_handle(ctx, handle);
    if (!vh) return -1;

    out->frame_index = (int32_t)vh->total_frames_decoded;
    out->pts_sec = vh->pool_count > 0 ? vh->frame_pts[vh->pool_tail] : 0.0;
    out->duration_sec = vh->duration_sec;
    out->decode_w = vh->decode_w;
    out->decode_h = vh->decode_h;
    out->src_w = vh->src_w;
    out->src_h = vh->src_h;

    if (vh->playing && vh->playback_start_wall_ms > 0) {
        double wms = wall_ms();
        out->playback_elapsed_sec = (wms - vh->playback_start_wall_ms) / 1000.0;
    }
    out->progress = vh->duration_sec > 0 ? vh->frame_pts[vh->pool_tail] / vh->duration_sec : 0.0;
    out->playing = vh->playing;
    out->eof = vh->eof && vh->pool_count == 0;

    out->has_audio = vh->has_audio;
    if (vh->has_audio) {
        snprintf(out->audio_codec, sizeof(out->audio_codec), "%s", vh->audio_codec_name);
        out->audio_sample_rate = vh->audio_sample_rate;
        out->audio_channels = vh->audio_channels;
    }
    return 0;
}

/* -- Wallclock helpers -- */

static double wall_ms(void)
{
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (double)ts.tv_sec * 1000.0 + (double)ts.tv_nsec / 1000000.0;
}

/* -- Playback control -- */

CODEC_EXPORT void codec_video_play(CodecCtx *ctx, int32_t handle, double speed)
{
    if (!ctx || handle < 0 || handle >= 16) return;
    VideoHandle *vh = codec_ctx_get_video_handle(ctx, handle);
    if (!vh) return;
    vh->playing = 1;
    vh->speed = speed > 0 ? speed : 1.0;
    vh->playback_start_wall_ms = wall_ms();
    if (vh->pool_count > 0)
        vh->playback_start_pts = vh->frame_pts[vh->pool_tail];
    else
        vh->playback_start_pts = 0.0;
}

CODEC_EXPORT void codec_video_pause(CodecCtx *ctx, int32_t handle)
{
    if (!ctx || handle < 0 || handle >= 16) return;
    VideoHandle *vh = codec_ctx_get_video_handle(ctx, handle);
    if (!vh) return;
    vh->playing = 0;
}

/* -- Seek with guard against rapid re-entry -- */

CODEC_EXPORT int32_t codec_video_seek(CodecCtx *ctx, int32_t handle, double target_sec)
{
    if (!ctx || handle < 0 || handle >= 16) return -1;
    VideoHandle *vh = codec_ctx_get_video_handle(ctx, handle);
    if (!vh) return -1;

    /* Guard: if a seek is already in progress, skip */
    if (vh->seeking) return 0;
    vh->seeking = 1;

    AVStream *vstr = vh->fmt_ctx->streams[vh->video_stream_idx];

    ff.avcodec_flush_buffers(vh->codec_ctx);

    int64_t target_ts = rescale_q_inline(
        target_sec < 0 ? 0 : (int64_t)(target_sec * AV_TIME_BASE),
        (AVRational){1, AV_TIME_BASE},
        vstr->time_base);

    int r = ff.avformat_seek_file(vh->fmt_ctx, vh->video_stream_idx,
                                    INT64_MIN, target_ts, target_ts, AVSEEK_FLAG_BACKWARD);
    if (r < 0)
        r = ff.av_seek_frame(vh->fmt_ctx, vh->video_stream_idx,
                              target_ts, AVSEEK_FLAG_BACKWARD);
    vh->seeking = 0;
    if (r < 0) return -1;

    /* Clear ring buffer */
    for (int i = 0; i < VIDEO_POOL_SIZE; i++) {
        if (vh->frame_buf[i]) {
            ff.av_free(vh->frame_buf[i]);
            vh->frame_buf[i] = NULL;
        }
    }
    vh->pool_head = vh->pool_tail = vh->pool_count = 0;
    vh->eof = 0;

    /* Resume playback from new position */
    if (vh->playing) {
        vh->playback_start_wall_ms = wall_ms();
        vh->playback_start_pts = target_sec;
    }

    video_decode_into(vh);
    return 0;
}
