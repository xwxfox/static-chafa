/* addon.c - N-API bindings for static-chafa */
#define NAPI_VERSION 9
#include "node_api.h"
#include <string.h>
#include <stdlib.h>

/* ── codec.c types (mirrored from codec.c) ── */
typedef struct
{
    int32_t term_w, term_h;
    float work_factor;
    int32_t dither_mode, canvas_mode, preprocessing, bg_color;
    int32_t max_frames;
    float speed;
} CodecConfig;

typedef struct
{
    float parse_ms, inflate_ms, defilter_ms, render_ms;
    int32_t img_w, img_h, frame_count, frame_delay_ms, format;
} CodecMetrics;

/* ── Forward declarations (provided by codec.o) ── */
extern char *codec_render_buffer(char *data, int32_t len, CodecConfig *cfg, CodecMetrics *out, int32_t *err);
extern char *codec_render_path(const char *path, CodecConfig *cfg, CodecMetrics *out, int32_t *err);
extern int32_t codec_anim_open_buffer(char *data, int32_t len, CodecConfig *cfg, CodecMetrics *out, int32_t *err);
extern int32_t codec_anim_next(int32_t handle, CodecMetrics *out);
extern int32_t codec_anim_rewind(int32_t handle);
extern uint8_t *codec_anim_frame_data(int32_t handle, int32_t frame_idx);
extern char *codec_anim_render_frame(int32_t handle, int32_t frame_idx, CodecMetrics *out);
extern void codec_anim_close(int32_t handle);
extern void codec_anim_abort(int32_t handle);
extern void codec_free_string(char *s);

/* ── Helpers ── */

#define NAPI_CALL(env, call)                              \
    do                                                    \
    {                                                     \
        napi_status s = (call);                           \
        if (s != napi_ok)                                 \
        {                                                 \
            napi_throw_error(env, NULL, #call " failed"); \
            return NULL;                                  \
        }                                                 \
    } while (0)
#define DECLARE_NAPI_METHOD(name, fn) {name, 0, fn, 0, 0, 0, napi_default, 0}

static int read_int32(napi_env env, napi_value obj, const char *name, int32_t *out)
{
    napi_value val;
    napi_valuetype type;
    if (napi_get_named_property(env, obj, name, &val) != napi_ok)
        return 0;
    if (napi_typeof(env, val, &type) != napi_ok || type != napi_number)
        return 0;
    return napi_get_value_int32(env, val, out) == napi_ok;
}
static int read_double(napi_env env, napi_value obj, const char *name, double *out)
{
    napi_value val;
    napi_valuetype type;
    if (napi_get_named_property(env, obj, name, &val) != napi_ok)
        return 0;
    if (napi_typeof(env, val, &type) != napi_ok || type != napi_number)
        return 0;
    return napi_get_value_double(env, val, out) == napi_ok;
}

static void read_config(napi_env env, napi_value obj, CodecConfig *cfg)
{
    memset(cfg, 0, sizeof(*cfg));
    cfg->term_w = 80;
    cfg->term_h = 24;
    cfg->speed = 1.0f;
    int32_t iv;
    double dv;
    if (read_int32(env, obj, "termW", &iv) && iv > 0)
        cfg->term_w = iv;
    if (read_int32(env, obj, "termH", &iv) && iv > 0)
        cfg->term_h = iv;
    if (read_double(env, obj, "workFactor", &dv))
        cfg->work_factor = (float)dv;
    if (read_int32(env, obj, "ditherMode", &iv))
        cfg->dither_mode = iv;
    if (read_int32(env, obj, "canvasMode", &iv))
        cfg->canvas_mode = iv;
    if (read_int32(env, obj, "preprocessing", &iv))
        cfg->preprocessing = iv;
    if (read_int32(env, obj, "bgColor", &iv))
        cfg->bg_color = iv;
    if (read_int32(env, obj, "maxFrames", &iv))
        cfg->max_frames = iv;
    if (read_double(env, obj, "speed", &dv))
        cfg->speed = (float)dv;
}

static napi_value create_metrics_object(napi_env env, CodecMetrics *m)
{
    napi_value obj, val;
    napi_create_object(env, &obj);
    napi_create_double(env, (double)m->parse_ms, &val);
    napi_set_named_property(env, obj, "parseMs", val);
    napi_create_double(env, (double)m->inflate_ms, &val);
    napi_set_named_property(env, obj, "inflateMs", val);
    napi_create_double(env, (double)m->defilter_ms, &val);
    napi_set_named_property(env, obj, "defilterMs", val);
    napi_create_double(env, (double)m->render_ms, &val);
    napi_set_named_property(env, obj, "renderMs", val);
    napi_create_int32(env, m->img_w, &val);
    napi_set_named_property(env, obj, "imgW", val);
    napi_create_int32(env, m->img_h, &val);
    napi_set_named_property(env, obj, "imgH", val);
    napi_create_int32(env, m->frame_count, &val);
    napi_set_named_property(env, obj, "frameCount", val);
    napi_create_int32(env, m->frame_delay_ms, &val);
    napi_set_named_property(env, obj, "frameDelayMs", val);
    napi_create_int32(env, m->format, &val);
    napi_set_named_property(env, obj, "format", val);
    return obj;
}

/* ── renderBuffer(data: Buffer, cfg?: object) → { ansi: string, metrics: object } ── */
static napi_value render_buffer(napi_env env, napi_callback_info info)
{
    size_t argc = 2;
    napi_value argv[2];
    napi_get_cb_info(env, info, &argc, argv, NULL, NULL);

    void *data;
    size_t len;
    if (napi_get_buffer_info(env, argv[0], &data, &len) != napi_ok)
    {
        napi_throw_type_error(env, NULL, "Expected Buffer as first argument");
        return NULL;
    }

    CodecConfig cfg;
    if (argc >= 2)
        read_config(env, argv[1], &cfg);
    else
    {
        memset(&cfg, 0, sizeof(cfg));
        cfg.term_w = 80;
        cfg.term_h = 24;
        cfg.speed = 1.0f;
    }

    CodecMetrics m;
    int32_t err = 0;
    char *ansi = codec_render_buffer((char *)data, (int32_t)len, &cfg, &m, &err);

    if (err != 0)
    {
        napi_throw_error(env, NULL, ansi ? ansi : "render failed");
        if (ansi)
            codec_free_string(ansi);
        return NULL;
    }

    napi_value result, ansi_val;
    napi_create_object(env, &result);
    napi_create_string_utf8(env, ansi, NAPI_AUTO_LENGTH, &ansi_val);
    napi_set_named_property(env, result, "ansi", ansi_val);
    napi_set_named_property(env, result, "metrics", create_metrics_object(env, &m));
    codec_free_string(ansi);
    return result;
}

/* ── renderPath(path: string, cfg?: object) → { ansi: string, metrics: object } ── */
static napi_value render_path(napi_env env, napi_callback_info info)
{
    size_t argc = 2;
    napi_value argv[2];
    napi_get_cb_info(env, info, &argc, argv, NULL, NULL);

    char path[4096];
    size_t plen;
    if (napi_get_value_string_utf8(env, argv[0], path, sizeof(path), &plen) != napi_ok)
    {
        napi_throw_type_error(env, NULL, "Expected string as first argument");
        return NULL;
    }

    CodecConfig cfg;
    if (argc >= 2)
        read_config(env, argv[1], &cfg);
    else
    {
        memset(&cfg, 0, sizeof(cfg));
        cfg.term_w = 80;
        cfg.term_h = 24;
        cfg.speed = 1.0f;
    }

    CodecMetrics m;
    int32_t err = 0;
    char *ansi = codec_render_path(path, &cfg, &m, &err);

    if (err != 0)
    {
        napi_throw_error(env, NULL, ansi ? ansi : "render failed");
        if (ansi)
            codec_free_string(ansi);
        return NULL;
    }

    napi_value result, ansi_val;
    napi_create_object(env, &result);
    napi_create_string_utf8(env, ansi, NAPI_AUTO_LENGTH, &ansi_val);
    napi_set_named_property(env, result, "ansi", ansi_val);
    napi_set_named_property(env, result, "metrics", create_metrics_object(env, &m));
    codec_free_string(ansi);
    return result;
}

/* ── Animation handle storage ── */
#define MAX_HANDLES 16

/* ── animOpenBuffer(data: Buffer, cfg?: object) → AnimHandle ── */
static napi_value anim_open_buffer(napi_env env, napi_callback_info info)
{
    size_t argc = 2;
    napi_value argv[2];
    napi_get_cb_info(env, info, &argc, argv, NULL, NULL);

    void *data;
    size_t len;
    if (napi_get_buffer_info(env, argv[0], &data, &len) != napi_ok)
    {
        napi_throw_type_error(env, NULL, "Expected Buffer as first argument");
        return NULL;
    }

    CodecConfig cfg;
    memset(&cfg, 0, sizeof(cfg));
    cfg.term_w = 80;
    cfg.term_h = 24;
    cfg.speed = 1.0f;
    if (argc >= 2)
        read_config(env, argv[1], &cfg);

    CodecMetrics m;
    int32_t err = 0;
    int32_t handle = codec_anim_open_buffer((char *)data, (int32_t)len, &cfg, &m, &err);

    if (err != 0 || handle < 0)
    {
        napi_throw_error(env, NULL, "Failed to open animation");
        return NULL;
    }

    napi_value result, handle_val, metrics_val;
    napi_create_object(env, &result);
    napi_create_int32(env, handle, &handle_val);
    napi_set_named_property(env, result, "handle", handle_val);
    napi_set_named_property(env, result, "metrics", create_metrics_object(env, &m));
    return result;
}

/* ── animNext(handle: number) → { frameIndex: number, metrics: object } | null ── */
static napi_value anim_next(napi_env env, napi_callback_info info)
{
    size_t argc = 1;
    napi_value argv[1];
    napi_get_cb_info(env, info, &argc, argv, NULL, NULL);

    int32_t handle;
    if (napi_get_value_int32(env, argv[0], &handle) != napi_ok)
    {
        napi_throw_type_error(env, NULL, "Expected handle number");
        return NULL;
    }

    CodecMetrics m;
    int32_t idx = codec_anim_next(handle, &m);
    if (idx < 0)
    {
        napi_value nul;
        napi_get_null(env, &nul);
        return nul;
    }

    napi_value result, idx_val;
    napi_create_object(env, &result);
    napi_create_int32(env, idx, &idx_val);
    napi_set_named_property(env, result, "frameIndex", idx_val);
    napi_set_named_property(env, result, "metrics", create_metrics_object(env, &m));
    return result;
}

/* ── animRenderFrame(handle: number, frameIndex: number) → { ansi: string, metrics: object } ── */
static napi_value anim_render_frame(napi_env env, napi_callback_info info)
{
    size_t argc = 2;
    napi_value argv[2];
    napi_get_cb_info(env, info, &argc, argv, NULL, NULL);

    int32_t handle, frame_idx;
    napi_get_value_int32(env, argv[0], &handle);
    napi_get_value_int32(env, argv[1], &frame_idx);

    CodecMetrics m;
    char *ansi = codec_anim_render_frame(handle, frame_idx, &m);
    if (!ansi)
    {
        napi_throw_error(env, NULL, "Render failed");
        return NULL;
    }

    napi_value result, ansi_val;
    napi_create_object(env, &result);
    napi_create_string_utf8(env, ansi, NAPI_AUTO_LENGTH, &ansi_val);
    napi_set_named_property(env, result, "ansi", ansi_val);
    napi_set_named_property(env, result, "metrics", create_metrics_object(env, &m));
    codec_free_string(ansi);
    return result;
}

/* ── animRewind(handle: number) ── */
static napi_value anim_rewind(napi_env env, napi_callback_info info)
{
    size_t argc = 1;
    napi_value argv[1];
    napi_get_cb_info(env, info, &argc, argv, NULL, NULL);
    int32_t handle;
    napi_get_value_int32(env, argv[0], &handle);
    codec_anim_rewind(handle);
    return NULL;
}

/* ── animClose(handle: number) ── */
static napi_value anim_close(napi_env env, napi_callback_info info)
{
    size_t argc = 1;
    napi_value argv[1];
    napi_get_cb_info(env, info, &argc, argv, NULL, NULL);
    int32_t handle;
    napi_get_value_int32(env, argv[0], &handle);
    codec_anim_close(handle);
    return NULL;
}

/* ── animAbort(handle: number) ── */
static napi_value anim_abort(napi_env env, napi_callback_info info)
{
    size_t argc = 1;
    napi_value argv[1];
    napi_get_cb_info(env, info, &argc, argv, NULL, NULL);
    int32_t handle;
    napi_get_value_int32(env, argv[0], &handle);
    codec_anim_abort(handle);
    return NULL;
}

/* ── Module init ── */
napi_value Init(napi_env env, napi_value exports)
{
    napi_value fn;
#define EXPORT(name, func)                                              \
    napi_create_function(env, name, NAPI_AUTO_LENGTH, func, NULL, &fn); \
    napi_set_named_property(env, exports, name, fn);

    EXPORT("renderBuffer", render_buffer);
    EXPORT("renderPath", render_path);
    EXPORT("animOpenBuffer", anim_open_buffer);
    EXPORT("animNext", anim_next);
    EXPORT("animRenderFrame", anim_render_frame);
    EXPORT("animRewind", anim_rewind);
    EXPORT("animClose", anim_close);
    EXPORT("animAbort", anim_abort);
    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
