/* addon.c - N-API bindings for static-chafa */
#define NAPI_VERSION 9
#include "node_api.h"
#include <string.h>
#include <stdlib.h>

/* -- Mirrored structs (must match codec.c byte-for-byte) -- */
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

typedef struct CodecCtx CodecCtx;

/* -- C function declarations (provided by codec.o) -- */
extern CodecCtx *codec_ctx_new(CodecConfig *cfg);
extern void codec_ctx_free(CodecCtx *ctx);
extern void codec_ctx_configure(CodecCtx *ctx, CodecConfig *cfg);
extern uint8_t *codec_decode_buffer(char *data, int32_t len,
                                    int32_t *out_w, int32_t *out_h, int32_t *out_stride,
                                    CodecMetrics *out, int32_t *err);
extern char *codec_render(CodecCtx *ctx, char *data, int32_t len,
                          CodecMetrics *out, int32_t *err);
extern char *codec_render_rgba(CodecCtx *ctx, uint8_t *rgba,
                               int32_t w, int32_t h, int32_t stride,
                               CodecMetrics *out);
extern char *codec_render_matrix(CodecCtx *ctx, char *data, int32_t len,
                                 CodecMetrics *out, int32_t *err);
extern char *codec_render_matrix_rgba(CodecCtx *ctx, uint8_t *rgba,
                                      int32_t w, int32_t h, int32_t stride,
                                      CodecMetrics *out);
extern int32_t codec_anim_open(CodecCtx *ctx, char *data, int32_t len,
                               CodecMetrics *out, int32_t *err);
extern int32_t codec_anim_next(CodecCtx *ctx, int32_t handle, CodecMetrics *out);
extern char *codec_anim_render_frame(CodecCtx *ctx, int32_t handle, int32_t frame_idx,
                                     CodecMetrics *out);
extern int32_t codec_anim_rewind(CodecCtx *ctx, int32_t handle);
extern void codec_anim_close(CodecCtx *ctx, int32_t handle);
extern void codec_anim_abort(CodecCtx *ctx, int32_t handle);
extern void codec_free(void *p);

/* -- Windows: resolve N-API functions at runtime from the host process --
   Eagerly importing napi_* from "node.exe" breaks under non-node hosts
   (e.g. Bun): the Windows loader binds the import descriptor to a
   *separate* node.exe found on the DLL search path, whose N-API runtime
   was never initialized, so the first call into it segfaults. Instead,
   look the symbols up in the host executable (node.exe, bun.exe and
   electron.exe all export napi_*), falling back to an already-loaded
   node.exe. This produces no napi imports in the PE at all. */
#if defined(_WIN32)
#include <windows.h>

typedef struct
{
    __typeof__(&napi_create_function) create_function;
    __typeof__(&napi_create_int32) create_int32;
    __typeof__(&napi_create_double) create_double;
    __typeof__(&napi_create_string_utf8) create_string_utf8;
    __typeof__(&napi_create_object) create_object;
    __typeof__(&napi_create_external) create_external;
    __typeof__(&napi_create_external_buffer) create_external_buffer;
    __typeof__(&napi_create_buffer_copy) create_buffer_copy;
    __typeof__(&napi_set_named_property) set_named_property;
    __typeof__(&napi_get_cb_info) get_cb_info;
    __typeof__(&napi_get_buffer_info) get_buffer_info;
    __typeof__(&napi_get_value_external) get_value_external;
    __typeof__(&napi_get_value_int32) get_value_int32;
    __typeof__(&napi_get_value_double) get_value_double;
    __typeof__(&napi_get_value_string_utf8) get_value_string_utf8;
    __typeof__(&napi_get_named_property) get_named_property;
    __typeof__(&napi_get_null) get_null;
    __typeof__(&napi_typeof) typeof_;
    __typeof__(&napi_throw_error) throw_error;
    __typeof__(&napi_throw_type_error) throw_type_error;
} NapiApi;

static NapiApi api;

static void *napi_host_proc(const char *name)
{
    HMODULE host = GetModuleHandleW(NULL);
    FARPROC p = GetProcAddress(host, name);
    if (p)
        return (void *)p;
    HMODULE node = GetModuleHandleW(L"node.exe");
    if (node)
        return (void *)GetProcAddress(node, name);
    return NULL;
}

#define NAPI_BIND(field, sym)                          \
    do {                                               \
        api.field = (__typeof__(api.field))napi_host_proc(sym); \
        if (!api.field) return 0;                      \
    } while (0)

static int napi_api_init(void)
{
    NAPI_BIND(create_function, "napi_create_function");
    NAPI_BIND(create_int32, "napi_create_int32");
    NAPI_BIND(create_double, "napi_create_double");
    NAPI_BIND(create_string_utf8, "napi_create_string_utf8");
    NAPI_BIND(create_object, "napi_create_object");
    NAPI_BIND(create_external, "napi_create_external");
    NAPI_BIND(create_external_buffer, "napi_create_external_buffer");
    NAPI_BIND(create_buffer_copy, "napi_create_buffer_copy");
    NAPI_BIND(set_named_property, "napi_set_named_property");
    NAPI_BIND(get_cb_info, "napi_get_cb_info");
    NAPI_BIND(get_buffer_info, "napi_get_buffer_info");
    NAPI_BIND(get_value_external, "napi_get_value_external");
    NAPI_BIND(get_value_int32, "napi_get_value_int32");
    NAPI_BIND(get_value_double, "napi_get_value_double");
    NAPI_BIND(get_value_string_utf8, "napi_get_value_string_utf8");
    NAPI_BIND(get_named_property, "napi_get_named_property");
    NAPI_BIND(get_null, "napi_get_null");
    NAPI_BIND(typeof_, "napi_typeof");
    NAPI_BIND(throw_error, "napi_throw_error");
    NAPI_BIND(throw_type_error, "napi_throw_type_error");
    return 1;
}

#define napi_create_function api.create_function
#define napi_create_int32 api.create_int32
#define napi_create_double api.create_double
#define napi_create_string_utf8 api.create_string_utf8
#define napi_create_object api.create_object
#define napi_create_external api.create_external
#define napi_create_external_buffer api.create_external_buffer
#define napi_create_buffer_copy api.create_buffer_copy
#define napi_set_named_property api.set_named_property
#define napi_get_cb_info api.get_cb_info
#define napi_get_buffer_info api.get_buffer_info
#define napi_get_value_external api.get_value_external
#define napi_get_value_int32 api.get_value_int32
#define napi_get_value_double api.get_value_double
#define napi_get_value_string_utf8 api.get_value_string_utf8
#define napi_get_named_property api.get_named_property
#define napi_get_null api.get_null
#define napi_typeof api.typeof_
#define napi_throw_error api.throw_error
#define napi_throw_type_error api.throw_type_error
#endif /* _WIN32 */

/* -- NAPI helpers -- */
#define NAPI_CALL(env, call)                                  \
    do { napi_status s = (call);                              \
        if (s != napi_ok) {                                   \
            napi_throw_error(env, NULL, #call " failed");     \
            return NULL;                                      \
        } } while (0)

#define DECLARE_NAPI_METHOD(name, fn) {name, 0, fn, 0, 0, 0, napi_default, 0}

/* -- Context finalizer (called by GC) -- */
static void ctx_finalize(napi_env env, void *data, void *hint)
{
    (void)env; (void)hint;
    codec_ctx_free((CodecCtx *)data);
}

static void rgba_buffer_finalize(napi_env env, void *data, void *hint)
{
    (void)env; (void)hint;
    free(data);
}

/* -- Config helpers -- */
static int read_int32(napi_env env, napi_value obj, const char *name, int32_t *out)
{
    napi_value val;
    napi_valuetype type;
    if (napi_get_named_property(env, obj, name, &val) != napi_ok) return 0;
    if (napi_typeof(env, val, &type) != napi_ok || type != napi_number) return 0;
    return napi_get_value_int32(env, val, out) == napi_ok;
}
static int read_double(napi_env env, napi_value obj, const char *name, double *out)
{
    napi_value val;
    napi_valuetype type;
    if (napi_get_named_property(env, obj, name, &val) != napi_ok) return 0;
    if (napi_typeof(env, val, &type) != napi_ok || type != napi_number) return 0;
    return napi_get_value_double(env, val, out) == napi_ok;
}
static int read_string(napi_env env, napi_value obj, const char *name,
                       char *out, size_t max_len)
{
    napi_value val;
    if (napi_get_named_property(env, obj, name, &val) != napi_ok) return 0;
    size_t len;
    if (napi_get_value_string_utf8(env, val, out, max_len, &len) != napi_ok) return 0;
    return 1;
}

static void read_config(napi_env env, napi_value obj, CodecConfig *cfg)
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
    cfg->optimizations = 0x7fffffff;
    cfg->pixel_fit = 1; /* SCALE */

    int32_t iv;
    double dv;

    if (read_int32(env, obj, "termW", &iv) && iv > 0) cfg->term_w = iv;
    if (read_int32(env, obj, "termH", &iv) && iv > 0) cfg->term_h = iv;
    if (read_int32(env, obj, "cellW", &iv) && iv > 0) cfg->cell_w = iv;
    if (read_int32(env, obj, "cellH", &iv) && iv > 0) cfg->cell_h = iv;
    if (read_double(env, obj, "workFactor", &dv)) cfg->work_factor = (float)dv;
    if (read_int32(env, obj, "ditherMode", &iv)) cfg->dither_mode = iv;
    if (read_int32(env, obj, "canvasMode", &iv)) cfg->canvas_mode = iv;
    if (read_int32(env, obj, "preprocessing", &iv)) cfg->preprocessing = iv;
    if (read_int32(env, obj, "colorExtractor", &iv)) cfg->color_extractor = iv;
    if (read_int32(env, obj, "colorSpace", &iv)) cfg->color_space = iv;
    if (read_int32(env, obj, "pixelMode", &iv)) cfg->pixel_mode = iv;
    if (read_int32(env, obj, "bgColor", &iv)) cfg->bg_color = iv;
    if (read_int32(env, obj, "fgColor", &iv)) cfg->fg_color = iv;
    if (read_int32(env, obj, "alphaThreshold", &iv)) cfg->alpha_threshold = iv;
    if (read_int32(env, obj, "ditherGrainW", &iv) && iv > 0) cfg->dither_grain_w = iv;
    if (read_int32(env, obj, "ditherGrainH", &iv) && iv > 0) cfg->dither_grain_h = iv;
    if (read_double(env, obj, "ditherIntensity", &dv)) cfg->dither_intensity = (float)dv;
    if (read_int32(env, obj, "fgOnly", &iv)) cfg->fg_only = iv;
    if (read_int32(env, obj, "optimizations", &iv)) cfg->optimizations = iv;
    if (read_int32(env, obj, "passthrough", &iv)) cfg->passthrough = iv;
    if (read_int32(env, obj, "maxFrames", &iv)) cfg->max_frames = iv;
    if (read_double(env, obj, "speed", &dv)) cfg->speed = (float)dv;
    if (read_int32(env, obj, "pixelFit", &iv)) cfg->pixel_fit = iv;

    read_string(env, obj, "symbols", cfg->symbols, sizeof(cfg->symbols));
    read_string(env, obj, "fillSymbols", cfg->fill_symbols, sizeof(cfg->fill_symbols));
}

/* -- Metrics -> JS object -- */
static napi_value create_metrics(napi_env env, CodecMetrics *m)
{
    napi_value obj, val;
    napi_create_object(env, &obj);

#define SET_DOUBLE(key, field) \
    napi_create_double(env, (double)m->field, &val); \
    napi_set_named_property(env, obj, key, val);
#define SET_INT(key, field) \
    napi_create_int32(env, m->field, &val); \
    napi_set_named_property(env, obj, key, val);

    SET_DOUBLE("parseMs", parse_ms);
    SET_DOUBLE("drawMs", draw_ms);
    SET_DOUBLE("buildMs", build_ms);
    SET_DOUBLE("totalMs", total_ms);
    SET_INT("imgW", img_w);
    SET_INT("imgH", img_h);
    SET_INT("canvasW", canvas_w);
    SET_INT("canvasH", canvas_h);
    SET_INT("canvasPw", canvas_pw);
    SET_INT("canvasPh", canvas_ph);
    SET_INT("frameCount", frame_count);
    SET_INT("frameDelayMs", frame_delay_ms);
    SET_INT("rgbaBytes", rgba_bytes);
    SET_INT("format", format);
    SET_INT("canvasMode", canvas_mode);
    SET_INT("pixelMode", pixel_mode);
    SET_INT("haveAlpha", have_alpha);
    SET_INT("pixelFit", pixel_fit);

#undef SET_DOUBLE
#undef SET_INT
    return obj;
}

/* Get CodecCtx* from first argument (napi_external) */
static CodecCtx *get_ctx(napi_env env, napi_callback_info info)
{
    size_t argc = 1;
    napi_value argv[1];
    napi_get_cb_info(env, info, &argc, argv, NULL, NULL);
    CodecCtx *ctx = NULL;
    napi_get_value_external(env, argv[0], (void **)&ctx);
    return ctx;
}

/* -- chafaCreate(config?) -> external -- */
static napi_value chafa_create(napi_env env, napi_callback_info info)
{
    size_t argc = 1;
    napi_value argv[1];
    napi_get_cb_info(env, info, &argc, argv, NULL, NULL);

    CodecConfig cfg;
    if (argc >= 1)
        read_config(env, argv[0], &cfg);
    else
        memset(&cfg, 0, sizeof(cfg));

    CodecCtx *ctx = codec_ctx_new(&cfg);
    if (!ctx) { napi_throw_error(env, NULL, "Failed to create chafa context"); return NULL; }

    napi_value result;
    napi_create_external(env, ctx, NULL, NULL, &result);
    return result;
}

/* -- chafaConfigure(ctx, config) -> void -- */
static napi_value chafa_configure(napi_env env, napi_callback_info info)
{
    size_t argc = 2;
    napi_value argv[2];
    napi_get_cb_info(env, info, &argc, argv, NULL, NULL);

    CodecCtx *ctx = NULL;
    if (napi_get_value_external(env, argv[0], (void **)&ctx) != napi_ok || !ctx)
        { napi_throw_error(env, NULL, "Invalid context"); return NULL; }

    CodecConfig cfg;
    read_config(env, argv[1], &cfg);
    codec_ctx_configure(ctx, &cfg);
    return NULL;
}

/* -- chafaDecode(buffer) -> { rgba: Buffer, width, height, stride, metrics } -- */
static napi_value chafa_decode(napi_env env, napi_callback_info info)
{
    size_t argc = 1;
    napi_value argv[1];
    napi_get_cb_info(env, info, &argc, argv, NULL, NULL);

    void *data;
    size_t len;
    if (napi_get_buffer_info(env, argv[0], &data, &len) != napi_ok)
        { napi_throw_type_error(env, NULL, "Expected Buffer"); return NULL; }

    int32_t w = 0, h = 0, stride = 0, err = 0;
    CodecMetrics m;
    uint8_t *rgba = codec_decode_buffer((char *)data, (int32_t)len, &w, &h, &stride, &m, &err);
    if (!rgba)
    {
        napi_throw_error(env, NULL, "Decode failed");
        return NULL;
    }

    napi_value result, rgba_buf, w_val, h_val, stride_val;
    napi_create_object(env, &result);
    napi_create_external_buffer(env, (size_t)w * (size_t)h * 4, rgba,
                                rgba_buffer_finalize, NULL, &rgba_buf);
    napi_set_named_property(env, result, "rgba", rgba_buf);
    napi_create_int32(env, w, &w_val);
    napi_set_named_property(env, result, "width", w_val);
    napi_create_int32(env, h, &h_val);
    napi_set_named_property(env, result, "height", h_val);
    napi_create_int32(env, stride, &stride_val);
    napi_set_named_property(env, result, "stride", stride_val);
    napi_set_named_property(env, result, "metrics", create_metrics(env, &m));
    return result;
}

/* -- chafaRender(ctx, buffer) -> { ansi, metrics } -- */
static napi_value chafa_render(napi_env env, napi_callback_info info)
{
    size_t argc = 2;
    napi_value argv[2];
    napi_get_cb_info(env, info, &argc, argv, NULL, NULL);

    CodecCtx *ctx = NULL;
    if (napi_get_value_external(env, argv[0], (void **)&ctx) != napi_ok || !ctx)
        { napi_throw_error(env, NULL, "Invalid context"); return NULL; }

    void *data;
    size_t len;
    if (napi_get_buffer_info(env, argv[1], &data, &len) != napi_ok)
        { napi_throw_type_error(env, NULL, "Expected Buffer"); return NULL; }

    CodecMetrics m;
    int32_t err = 0;
    char *ansi = codec_render(ctx, (char *)data, (int32_t)len, &m, &err);
    if (err != 0)
    {
        if (ansi) codec_free(ansi);
        napi_throw_error(env, NULL, "Render failed");
        return NULL;
    }

    napi_value result, val;
    napi_create_object(env, &result);
    napi_create_string_utf8(env, ansi, NAPI_AUTO_LENGTH, &val);
    napi_set_named_property(env, result, "ansi", val);
    napi_set_named_property(env, result, "metrics", create_metrics(env, &m));
    codec_free(ansi);
    return result;
}

/* -- chafaRenderRgba(ctx, rgbaBuf, w, h) -> { ansi, metrics } -- */
static napi_value chafa_render_rgba(napi_env env, napi_callback_info info)
{
    size_t argc = 4;
    napi_value argv[4];
    napi_get_cb_info(env, info, &argc, argv, NULL, NULL);

    CodecCtx *ctx = NULL;
    if (napi_get_value_external(env, argv[0], (void **)&ctx) != napi_ok || !ctx)
        { napi_throw_error(env, NULL, "Invalid context"); return NULL; }

    void *data;
    size_t len;
    if (napi_get_buffer_info(env, argv[1], &data, &len) != napi_ok)
        { napi_throw_type_error(env, NULL, "Expected Buffer"); return NULL; }

    int32_t w = 0, h = 0;
    napi_get_value_int32(env, argv[2], &w);
    napi_get_value_int32(env, argv[3], &h);

    CodecMetrics m;
    char *ansi = codec_render_rgba(ctx, (uint8_t *)data, w, h, w * 4, &m);

    napi_value result, val;
    napi_create_object(env, &result);
    napi_create_string_utf8(env, ansi, NAPI_AUTO_LENGTH, &val);
    napi_set_named_property(env, result, "ansi", val);
    napi_set_named_property(env, result, "metrics", create_metrics(env, &m));
    codec_free(ansi);
    return result;
}

/* -- chafaRenderMatrix(ctx, buffer) -> { matrix, metrics } -- */
static napi_value chafa_render_matrix(napi_env env, napi_callback_info info)
{
    size_t argc = 2;
    napi_value argv[2];
    napi_get_cb_info(env, info, &argc, argv, NULL, NULL);

    CodecCtx *ctx = NULL;
    if (napi_get_value_external(env, argv[0], (void **)&ctx) != napi_ok || !ctx)
        { napi_throw_error(env, NULL, "Invalid context"); return NULL; }

    void *data;
    size_t len;
    if (napi_get_buffer_info(env, argv[1], &data, &len) != napi_ok)
        { napi_throw_type_error(env, NULL, "Expected Buffer"); return NULL; }

    CodecMetrics m;
    int32_t err = 0;
    char *json = codec_render_matrix(ctx, (char *)data, (int32_t)len, &m, &err);
    if (err != 0)
    {
        if (json) codec_free(json);
        napi_throw_error(env, NULL, "Render failed");
        return NULL;
    }

    napi_value result, val;
    napi_create_object(env, &result);
    napi_create_string_utf8(env, json, NAPI_AUTO_LENGTH, &val);
    napi_set_named_property(env, result, "matrix", val);
    napi_set_named_property(env, result, "metrics", create_metrics(env, &m));
    codec_free(json);
    return result;
}

/* -- chafaRenderMatrixRgba(ctx, rgbaBuf, w, h) -> { matrix, metrics } -- */
static napi_value chafa_render_matrix_rgba(napi_env env, napi_callback_info info)
{
    size_t argc = 4;
    napi_value argv[4];
    napi_get_cb_info(env, info, &argc, argv, NULL, NULL);

    CodecCtx *ctx = NULL;
    if (napi_get_value_external(env, argv[0], (void **)&ctx) != napi_ok || !ctx)
        { napi_throw_error(env, NULL, "Invalid context"); return NULL; }

    void *data;
    size_t len;
    if (napi_get_buffer_info(env, argv[1], &data, &len) != napi_ok)
        { napi_throw_type_error(env, NULL, "Expected Buffer"); return NULL; }

    int32_t w = 0, h = 0;
    napi_get_value_int32(env, argv[2], &w);
    napi_get_value_int32(env, argv[3], &h);

    CodecMetrics m;
    char *json = codec_render_matrix_rgba(ctx, (uint8_t *)data, w, h, w * 4, &m);

    napi_value result, val;
    napi_create_object(env, &result);
    napi_create_string_utf8(env, json, NAPI_AUTO_LENGTH, &val);
    napi_set_named_property(env, result, "matrix", val);
    napi_set_named_property(env, result, "metrics", create_metrics(env, &m));
    codec_free(json);
    return result;
}

/* -- chafaAnimOpen(ctx, buffer) -> { handle, metrics } -- */
static napi_value chafa_anim_open(napi_env env, napi_callback_info info)
{
    size_t argc = 2;
    napi_value argv[2];
    napi_get_cb_info(env, info, &argc, argv, NULL, NULL);

    CodecCtx *ctx = NULL;
    if (napi_get_value_external(env, argv[0], (void **)&ctx) != napi_ok || !ctx)
        { napi_throw_error(env, NULL, "Invalid context"); return NULL; }

    void *data;
    size_t len;
    if (napi_get_buffer_info(env, argv[1], &data, &len) != napi_ok)
        { napi_throw_type_error(env, NULL, "Expected Buffer"); return NULL; }

    CodecMetrics m;
    int32_t err = 0;
    int32_t handle = codec_anim_open(ctx, (char *)data, (int32_t)len, &m, &err);
    if (handle < 0) { napi_throw_error(env, NULL, "Failed to open animation"); return NULL; }

    napi_value result, h_val;
    napi_create_object(env, &result);
    napi_create_int32(env, handle, &h_val);
    napi_set_named_property(env, result, "handle", h_val);
    napi_set_named_property(env, result, "metrics", create_metrics(env, &m));
    return result;
}

/* -- chafaAnimNext(ctx, handle) -> { frameIndex, metrics } | null -- */
static napi_value chafa_anim_next(napi_env env, napi_callback_info info)
{
    size_t argc = 2;
    napi_value argv[2];
    napi_get_cb_info(env, info, &argc, argv, NULL, NULL);

    CodecCtx *ctx = NULL;
    if (napi_get_value_external(env, argv[0], (void **)&ctx) != napi_ok || !ctx)
        { napi_throw_error(env, NULL, "Invalid context"); return NULL; }
    int32_t handle;
    napi_get_value_int32(env, argv[1], &handle);

    CodecMetrics m;
    int32_t idx = codec_anim_next(ctx, handle, &m);
    if (idx < 0) { napi_value nul; napi_get_null(env, &nul); return nul; }

    napi_value result, val;
    napi_create_object(env, &result);
    napi_create_int32(env, idx, &val);
    napi_set_named_property(env, result, "frameIndex", val);
    napi_set_named_property(env, result, "metrics", create_metrics(env, &m));
    return result;
}

/* -- chafaAnimRenderFrame(ctx, handle, frameIndex) -> { ansi, metrics } -- */
static napi_value chafa_anim_render_frame(napi_env env, napi_callback_info info)
{
    size_t argc = 3;
    napi_value argv[3];
    napi_get_cb_info(env, info, &argc, argv, NULL, NULL);

    CodecCtx *ctx = NULL;
    if (napi_get_value_external(env, argv[0], (void **)&ctx) != napi_ok || !ctx)
        { napi_throw_error(env, NULL, "Invalid context"); return NULL; }
    int32_t handle, frame_idx;
    napi_get_value_int32(env, argv[1], &handle);
    napi_get_value_int32(env, argv[2], &frame_idx);

    CodecMetrics m;
    char *ansi = codec_anim_render_frame(ctx, handle, frame_idx, &m);
    if (!ansi) { napi_throw_error(env, NULL, "Render failed"); return NULL; }

    napi_value result, val;
    napi_create_object(env, &result);
    napi_create_string_utf8(env, ansi, NAPI_AUTO_LENGTH, &val);
    napi_set_named_property(env, result, "ansi", val);
    napi_set_named_property(env, result, "metrics", create_metrics(env, &m));
    codec_free(ansi);
    return result;
}

/* -- chafaAnimRewind(ctx, handle) -- */
static napi_value chafa_anim_rewind(napi_env env, napi_callback_info info)
{
    size_t argc = 2;
    napi_value argv[2];
    napi_get_cb_info(env, info, &argc, argv, NULL, NULL);

    CodecCtx *ctx = NULL;
    if (napi_get_value_external(env, argv[0], (void **)&ctx) != napi_ok || !ctx)
        { napi_throw_error(env, NULL, "Invalid context"); return NULL; }
    int32_t handle;
    napi_get_value_int32(env, argv[1], &handle);
    codec_anim_rewind(ctx, handle);
    return NULL;
}

/* -- chafaAnimClose(ctx, handle) -- */
static napi_value chafa_anim_close(napi_env env, napi_callback_info info)
{
    size_t argc = 2;
    napi_value argv[2];
    napi_get_cb_info(env, info, &argc, argv, NULL, NULL);

    CodecCtx *ctx = NULL;
    if (napi_get_value_external(env, argv[0], (void **)&ctx) != napi_ok || !ctx)
        { napi_throw_error(env, NULL, "Invalid context"); return NULL; }
    int32_t handle;
    napi_get_value_int32(env, argv[1], &handle);
    codec_anim_close(ctx, handle);
    return NULL;
}

/* -- chafaAnimAbort(ctx, handle) -- */
static napi_value chafa_anim_abort(napi_env env, napi_callback_info info)
{
    size_t argc = 2;
    napi_value argv[2];
    napi_get_cb_info(env, info, &argc, argv, NULL, NULL);

    CodecCtx *ctx = NULL;
    if (napi_get_value_external(env, argv[0], (void **)&ctx) != napi_ok || !ctx)
        { napi_throw_error(env, NULL, "Invalid context"); return NULL; }
    int32_t handle;
    napi_get_value_int32(env, argv[1], &handle);
    codec_anim_abort(ctx, handle);
    return NULL;
}

/* -- Video extern declarations (from codec_video.c) -- */
extern int32_t codec_video_open(CodecCtx *ctx, char *data, int32_t len,
    int32_t decode_w, int32_t decode_h, CodecMetrics *out, int32_t *err);
extern int32_t codec_video_next(CodecCtx *ctx, int32_t handle,
    uint8_t *out_rgba, int32_t out_cap, int32_t *out_w, int32_t *out_h,
    double *out_pts, CodecMetrics *out,
    uint8_t **out_frame_ptr, int32_t *out_frame_size);
extern int32_t codec_video_seek(CodecCtx *ctx, int32_t handle, double target_sec);
extern int32_t codec_video_info(CodecCtx *ctx, int32_t handle,
    int32_t *out_w, int32_t *out_h, double *out_duration, double *out_fps,
    int32_t *out_has_audio, char *audio_codec, int32_t *audio_rate, int32_t *audio_ch);
extern void codec_video_close(CodecCtx *ctx, int32_t handle);
extern const char *codec_video_error(void);

/* -- chafaVideoOpen(ctx, buffer, decodeW, decodeH) -> { handle, metrics } -- */
static napi_value chafa_video_open(napi_env env, napi_callback_info info)
{
    size_t argc = 4;
    napi_value argv[4];
    napi_get_cb_info(env, info, &argc, argv, NULL, NULL);

    CodecCtx *ctx = NULL;
    if (napi_get_value_external(env, argv[0], (void **)&ctx) != napi_ok || !ctx)
        { napi_throw_error(env, NULL, "Invalid context"); return NULL; }

    void *data; size_t len;
    if (napi_get_buffer_info(env, argv[1], &data, &len) != napi_ok)
        { napi_throw_type_error(env, NULL, "Expected Buffer"); return NULL; }

    int32_t dw = 0, dh = 0;
    napi_get_value_int32(env, argv[2], &dw);
    napi_get_value_int32(env, argv[3], &dh);

    CodecMetrics m;
    int32_t err = 0;
    int32_t handle = codec_video_open(ctx, (char *)data, (int32_t)len, dw, dh, &m, &err);
    if (handle < 0) {
        const char *msg = codec_video_error();
        napi_throw_error(env, NULL, msg && msg[0] ? msg : "Failed to open video");
        return NULL;
    }

    napi_value result, val;
    napi_create_object(env, &result);
    napi_create_int32(env, handle, &val);
    napi_set_named_property(env, result, "handle", val);
    napi_set_named_property(env, result, "metrics", create_metrics(env, &m));
    return result;
}

/* -- chafaVideoNext(ctx, handle) -> { rgba: Buffer, w, h, ptsSec, frameIndex, metrics } -- */
/* Zero-copy: rgba is a view into the decoder ring buffer. Valid until the
   next videoNext()/seek()/close() call on the same video. */
static napi_value chafa_video_next(napi_env env, napi_callback_info info)
{
    size_t argc = 2;
    napi_value argv[2];
    napi_get_cb_info(env, info, &argc, argv, NULL, NULL);

    CodecCtx *ctx = NULL;
    if (napi_get_value_external(env, argv[0], (void **)&ctx) != napi_ok || !ctx)
        { napi_throw_error(env, NULL, "Invalid context"); return NULL; }
    int32_t handle;
    napi_get_value_int32(env, argv[1], &handle);

    int32_t w = 0, h = 0;
    double pts = 0;
    CodecMetrics m;
    uint8_t *frame_ptr = NULL;
    int32_t frame_size = 0;
    int32_t idx = codec_video_next(ctx, handle, NULL, 0, &w, &h, &pts, &m,
                                   &frame_ptr, &frame_size);
    if (idx < 0) {
        napi_value nul; napi_get_null(env, &nul); return nul;
    }

    napi_value result, val, buf_val;
    napi_create_object(env, &result);

    size_t needed = (size_t)h * (size_t)w * 4;
    if (frame_ptr && frame_size >= (int32_t)needed)
    {
        /* External buffer with no finalizer: the ring buffer owns the memory. */
        napi_create_external_buffer(env, needed, frame_ptr, NULL, NULL, &buf_val);
    }
    else
    {
        /* Defensive fallback (should never happen): owned buffer. */
        uint8_t *copy = malloc(needed);
        if (copy)
            napi_create_external_buffer(env, needed, copy, rgba_buffer_finalize, NULL, &buf_val);
        else
            napi_get_null(env, &buf_val);
    }
    napi_set_named_property(env, result, "rgba", buf_val);

    napi_create_int32(env, w, &val);
    napi_set_named_property(env, result, "width", val);
    napi_create_int32(env, h, &val);
    napi_set_named_property(env, result, "height", val);
    napi_create_double(env, pts, &val);
    napi_set_named_property(env, result, "ptsSec", val);
    napi_create_int32(env, idx, &val);
    napi_set_named_property(env, result, "frameIndex", val);
    napi_set_named_property(env, result, "metrics", create_metrics(env, &m));

    return result;
}

/* -- chafaVideoInfo(ctx, handle) -> metadata -- */
static napi_value chafa_video_info(napi_env env, napi_callback_info info)
{
    size_t argc = 2;
    napi_value argv[2];
    napi_get_cb_info(env, info, &argc, argv, NULL, NULL);

    CodecCtx *ctx = NULL;
    if (napi_get_value_external(env, argv[0], (void **)&ctx) != napi_ok || !ctx)
        { napi_throw_error(env, NULL, "Invalid context"); return NULL; }
    int32_t handle;
    napi_get_value_int32(env, argv[1], &handle);

    int32_t w = 0, h = 0, has_audio = 0, audio_rate = 0, audio_ch = 0;
    double duration = 0, fps = 0;
    char audio_codec[64] = {0};
    codec_video_info(ctx, handle, &w, &h, &duration, &fps, &has_audio,
                     audio_codec, &audio_rate, &audio_ch);

    napi_value result, val;
    napi_create_object(env, &result);
    napi_create_int32(env, w, &val); napi_set_named_property(env, result, "width", val);
    napi_create_int32(env, h, &val); napi_set_named_property(env, result, "height", val);
    napi_create_double(env, duration, &val); napi_set_named_property(env, result, "durationSec", val);
    napi_create_double(env, fps, &val); napi_set_named_property(env, result, "fps", val);
    napi_create_int32(env, has_audio, &val); napi_set_named_property(env, result, "hasAudio", val);
    napi_create_string_utf8(env, audio_codec, NAPI_AUTO_LENGTH, &val);
    napi_set_named_property(env, result, "audioCodec", val);
    napi_create_int32(env, audio_rate, &val); napi_set_named_property(env, result, "audioSampleRate", val);
    napi_create_int32(env, audio_ch, &val); napi_set_named_property(env, result, "audioChannels", val);
    return result;
}

/* -- chafaVideoSeek(ctx, handle, targetSec) -- */
static napi_value chafa_video_seek(napi_env env, napi_callback_info info)
{
    size_t argc = 3;
    napi_value argv[3];
    napi_get_cb_info(env, info, &argc, argv, NULL, NULL);

    CodecCtx *ctx = NULL;
    if (napi_get_value_external(env, argv[0], (void **)&ctx) != napi_ok || !ctx)
        { napi_throw_error(env, NULL, "Invalid context"); return NULL; }
    int32_t handle;
    double target;
    napi_get_value_int32(env, argv[1], &handle);
    napi_get_value_double(env, argv[2], &target);
    codec_video_seek(ctx, handle, target);
    return NULL;
}

/* -- chafaVideoClose(ctx, handle) -- */
static napi_value chafa_video_close(napi_env env, napi_callback_info info)
{
    size_t argc = 2;
    napi_value argv[2];
    napi_get_cb_info(env, info, &argc, argv, NULL, NULL);

    CodecCtx *ctx = NULL;
    if (napi_get_value_external(env, argv[0], (void **)&ctx) != napi_ok || !ctx)
        { napi_throw_error(env, NULL, "Invalid context"); return NULL; }
    int32_t handle;
    napi_get_value_int32(env, argv[1], &handle);
    codec_video_close(ctx, handle);
    return NULL;
}

/* -- chafaFree(ctx) -> void (explicit destruction) -- */
static napi_value chafa_free(napi_env env, napi_callback_info info)
{
    size_t argc = 1;
    napi_value argv[1];
    napi_get_cb_info(env, info, &argc, argv, NULL, NULL);

    CodecCtx *ctx = NULL;
    if (napi_get_value_external(env, argv[0], (void **)&ctx) == napi_ok && ctx)
        codec_ctx_free(ctx);
    return NULL;
}

/* -- Module init -- */
napi_value Init(napi_env env, napi_value exports)
{
#if defined(_WIN32)
    if (!napi_api_init())
        return NULL;
#endif
    napi_value fn;
#define EXPORT(name, func) \
    napi_create_function(env, name, NAPI_AUTO_LENGTH, func, NULL, &fn); \
    napi_set_named_property(env, exports, name, fn);

    EXPORT("chafaCreate", chafa_create);
    EXPORT("chafaFree", chafa_free);
    EXPORT("chafaConfigure", chafa_configure);
    EXPORT("chafaDecode", chafa_decode);
    EXPORT("chafaRender", chafa_render);
    EXPORT("chafaRenderRgba", chafa_render_rgba);
    EXPORT("chafaRenderMatrix", chafa_render_matrix);
    EXPORT("chafaRenderMatrixRgba", chafa_render_matrix_rgba);
    EXPORT("chafaAnimOpen", chafa_anim_open);
    EXPORT("chafaAnimNext", chafa_anim_next);
    EXPORT("chafaAnimRenderFrame", chafa_anim_render_frame);
    EXPORT("chafaAnimRewind", chafa_anim_rewind);
    EXPORT("chafaAnimClose", chafa_anim_close);
    EXPORT("chafaAnimAbort", chafa_anim_abort);
    EXPORT("chafaVideoOpen", chafa_video_open);
    EXPORT("chafaVideoNext", chafa_video_next);
    EXPORT("chafaVideoInfo", chafa_video_info);
    EXPORT("chafaVideoSeek", chafa_video_seek);
    EXPORT("chafaVideoClose", chafa_video_close);
    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
