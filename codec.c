// codec.c — unified image decode + chafa render library
// Single FFI boundary. No external deps at runtime beyond system libraries.
// Links: -ljpeg -lwebp -lwebpdemux -lchafa -lglib-2.0 -lz -lm
//
// Exports:
//   codec_render_path / codec_render_buffer — static images → ANSI string + metrics
//   codec_anim_open_path / codec_anim_open_buffer — start animated playback
//   codec_anim_next — get next frame as ANSI string
//   codec_anim_close / codec_anim_abort — cleanup / cancel

#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include "chafa.h"
#include <zlib.h>
#include <jpeglib.h>
#include <webp/decode.h>
#include <webp/demux.h>
#include <png.h>

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

/* ── error codes ── */
#define ERR_OK             0
#define ERR_UNKNOWN_FMT   -1
#define ERR_FILE_OPEN     -2
#define ERR_FILE_READ     -3
#define ERR_FILE_EMPTY    -4
#define ERR_MALLOC        -5
#define ERR_UNSUPPORTED   -6
#define ERR_CORRUPT_DATA  -7
#define ERR_DIMENSIONS    -8
#define ERR_DECODE_FAIL   -9
#define ERR_INFLATE_FAIL  -10
#define ERR_POOL_FULL     -11
#define ERR_BAD_PARAMS    -12

static const char* err_string(int code) {
    switch(code) {
        case ERR_UNKNOWN_FMT: return "Unknown image format";
        case ERR_FILE_OPEN:   return "Cannot open file";
        case ERR_FILE_READ:   return "Cannot read file";
        case ERR_FILE_EMPTY:  return "File is empty";
        case ERR_MALLOC:      return "Memory allocation failed";
        case ERR_UNSUPPORTED: return "Unsupported image format or features";
        case ERR_CORRUPT_DATA:return "Corrupt or truncated image data";
        case ERR_DIMENSIONS:  return "Invalid image dimensions";
        case ERR_DECODE_FAIL: return "Image decode failed";
        case ERR_INFLATE_FAIL:return "Decompression failed";
        case ERR_POOL_FULL:   return "Output buffer too small";
        case ERR_BAD_PARAMS:  return "Invalid parameters";
        default: return "Unknown error";
    }
}

#define MAX_DIM (65536)
#define MIN_DIM (1)
typedef struct {
    int32_t term_w, term_h;
    float work_factor;
    int32_t dither_mode, canvas_mode, preprocessing, bg_color;
    int32_t max_frames;
    float speed;
} CodecConfig;

typedef struct {
    float parse_ms, inflate_ms, defilter_ms, render_ms;
    int32_t img_w, img_h, frame_count, frame_delay_ms, format;
} CodecMetrics;

/* ── helpers ── */
static double now_ms(void) {
    struct timespec ts; clock_gettime(CLOCK_MONOTONIC, &ts);
    return (double)ts.tv_sec * 1000.0 + (double)ts.tv_nsec / 1000000.0;
}
static int32_t read_u32be(const uint8_t* b) { return (b[0]<<24)|(b[1]<<16)|(b[2]<<8)|b[3]; }
static int32_t read_u32le(const uint8_t* b) { return b[0]|(b[1]<<8)|(b[2]<<16)|(b[3]<<24); }
static int32_t read_u16le(const uint8_t* b) { return b[0]|(b[1]<<8); }
static int32_t abs_i32(int32_t x) { return x<0 ? -x : x; }
static uint8_t paeth_u8(uint8_t a, uint8_t b, uint8_t c) {
    int32_t p=(int32_t)a+(int32_t)b-(int32_t)c;
    int32_t pa=abs_i32(p-(int32_t)a), pb=abs_i32(p-(int32_t)b), pc=abs_i32(p-(int32_t)c);
    if (pa<=pb && pa<=pc) return a; return pb<=pc ? b : c;
}

/* ── format detection ── */
#define FMT_PNG  0
#define FMT_JPEG 1
#define FMT_BMP  2
#define FMT_GIF  3
#define FMT_WEBP 4

static int detect_format(const uint8_t* data, int32_t len) {
    if (len >= 8 && data[0]==0x89 && data[1]=='P' && data[2]=='N' && data[3]=='G') return FMT_PNG;
    if (len >= 3 && data[0]==0xFF && data[1]==0xD8 && data[2]==0xFF) return FMT_JPEG;
    if (len >= 2 && data[0]=='B' && data[1]=='M') return FMT_BMP;
    if (len >= 6 && data[0]=='G' && data[1]=='I' && data[2]=='F') return FMT_GIF;
    if (len >= 12 && data[0]=='R' && data[1]=='I' && data[2]=='F' && data[3]=='F' && data[8]=='W' && data[9]=='E' && data[10]=='B' && data[11]=='P') return FMT_WEBP;
    return -1;
}

typedef struct { uint8_t* raw; uint8_t* uncomp; uint8_t* rgba; CodecMetrics m; int w, h; int is_anim; int fmt; } DecodeCtx;

/* ── PNG decode (libpng simplified API) ── */
static int decode_png(DecodeCtx* c, const uint8_t* buf, int32_t len) {
    png_image img; memset(&img, 0, sizeof(img));
    img.version = PNG_IMAGE_VERSION;
    if (!png_image_begin_read_from_memory(&img, buf, len)) return -1;
    img.format = PNG_FORMAT_RGBA;
    c->w = (int)img.width; c->h = (int)img.height;
    c->rgba = malloc(PNG_IMAGE_SIZE(img));
    if (!png_image_finish_read(&img, NULL, c->rgba, 0, NULL)) { free(c->rgba); return -1; }
    return 0;
}

/* ── JPEG decode ── */
typedef struct { struct jpeg_source_mgr pub; const uint8_t* data; size_t len; } jpg_src;
static void jpg_init(j_decompress_ptr c) { (void)c; }
static boolean jpg_fill(j_decompress_ptr c) { jpg_src* s=(jpg_src*)c->src; s->pub.next_input_byte=s->data; s->pub.bytes_in_buffer=s->len; return 1; }
static void jpg_skip(j_decompress_ptr c, long n) { jpg_src* s=(jpg_src*)c->src; if(n>0&&(size_t)n<=s->pub.bytes_in_buffer){s->pub.next_input_byte+=n;s->pub.bytes_in_buffer-=n;} }

static int decode_jpeg(DecodeCtx* c, const uint8_t* buf, int32_t len) {
    struct jpeg_decompress_struct cinfo; struct jpeg_error_mgr jerr; cinfo.err=jpeg_std_error(&jerr);
    jpeg_create_decompress(&cinfo); jpg_src src; src.data=buf; src.len=len;
    src.pub.init_source=jpg_init; src.pub.fill_input_buffer=jpg_fill; src.pub.skip_input_data=jpg_skip;
    src.pub.resync_to_restart=jpeg_resync_to_restart; src.pub.term_source=jpg_init;
    src.pub.next_input_byte=buf; src.pub.bytes_in_buffer=len; cinfo.src=(struct jpeg_source_mgr*)&src;
    jpeg_read_header(&cinfo,1); jpeg_start_decompress(&cinfo);
    int w=cinfo.output_width, h=cinfo.output_height, rs=w*cinfo.output_components;
    JSAMPARRAY rowbuf=(*cinfo.mem->alloc_sarray)((j_common_ptr)&cinfo,JPOOL_IMAGE,rs,1);
    c->rgba=malloc(w*h*4);
    for (int y=0; y<h; y++) {
        jpeg_read_scanlines(&cinfo,rowbuf,1);
        for (int x=0; x<w; x++) {
            int d=(y*w+x)*4, s=x*cinfo.output_components;
            c->rgba[d]=rowbuf[0][s]; c->rgba[d+1]=rowbuf[0][s+1]; c->rgba[d+2]=rowbuf[0][s+2]; c->rgba[d+3]=255;
        }
    }
    jpeg_finish_decompress(&cinfo); jpeg_destroy_decompress(&cinfo);
    c->w=w; c->h=h; return 0;
}

/* ── BMP decode ── */
static int decode_bmp(DecodeCtx* c, const uint8_t* buf, int32_t len) {
    if (len<30||buf[0]!='B'||buf[1]!='M') return -1;
    int32_t off=*(int32_t*)(buf+10), w=*(int32_t*)(buf+18), h=*(int32_t*)(buf+22);
    int32_t ah=h<0?-h:h, td=h<0; int16_t bpp=*(int16_t*)(buf+28);
    if (off<30||off>=len||w<=0||ah<=0||(bpp!=24&&bpp!=32)) return -1;
    c->rgba=malloc(w*ah*4); c->w=w; c->h=ah;
    int rowBytes=((bpp==24?w*3:w*4)+3)&~3, ch=bpp/8;
    for (int y=0; y<ah; y++) {
        int sy=td?y:(ah-1-y);
        const uint8_t* src=buf+off+sy*rowBytes; uint8_t* dst=c->rgba+y*w*4;
        for (int x=0; x<w; x++) { dst[x*4+2]=src[x*ch]; dst[x*4+1]=src[x*ch+1]; dst[x*4]=src[x*ch+2]; dst[x*4+3]=bpp==32?src[x*4+3]:255; }
    }
    return 0;
}

/* ── WebP static ── */
static int decode_webp_static(DecodeCtx* c, const uint8_t* buf, int32_t len) {
    int w,h; if (!WebPGetInfo(buf,len,&w,&h)) return -1;
    c->rgba=malloc(w*h*4); c->w=w; c->h=h;
    return (WebPDecodeRGBAInto(buf,len,c->rgba,w*h*4,w*4)==c->rgba) ? 0 : -1;
}

/* ── GIF decode (stb_image, pre-decoded) ── */
static int decode_gif(DecodeCtx* c, const uint8_t* buf, int32_t len) {
    int w,h,frames,comp,*delays;
    uint8_t* data=stbi_load_gif_from_memory((stbi_uc*)buf,len,&delays,&w,&h,&frames,&comp,4);
    if (!data) return -1;
    c->rgba=data; c->w=w; c->h=h;
    c->is_anim=(frames>1);
    // store frame count in an unused field
    free(delays);
    return 0;
}

/* ── defaults ── */
static void init_config(CodecConfig* cfg) {
    cfg->term_w=80; cfg->term_h=35; cfg->work_factor=0.0f;
    cfg->dither_mode=0; cfg->canvas_mode=0; cfg->preprocessing=0; cfg->bg_color=0;
    cfg->speed=1.0f; cfg->max_frames=-1;
}

/* ── pooled buffers for decode output ── */
static uint8_t* _pool_rgba = NULL;
static int32_t _pool_rgba_cap = 0;
static uint8_t* _pool_raw = NULL;
static int32_t _pool_raw_cap = 0;
static uint8_t* _pool_idat = NULL;
static int32_t _pool_idat_cap = 0;

/* ── shared chafa canvas ── */
static ChafaCanvas* _canvas = NULL;
static ChafaCanvasConfig* _canvas_cfg = NULL;
static CodecConfig _last_cfg;
static int _canvas_ok = 0;

static void ensure_canvas(CodecConfig* cfg) {
    if (_canvas_ok && !memcmp(&_last_cfg, cfg, sizeof(CodecConfig))) return;
    if (_canvas) chafa_canvas_unref(_canvas);
    if (_canvas_cfg) chafa_canvas_config_unref(_canvas_cfg);
    _canvas_cfg = chafa_canvas_config_new();
    chafa_canvas_config_set_geometry(_canvas_cfg, cfg->term_w, cfg->term_h);
    chafa_canvas_config_set_canvas_mode(_canvas_cfg, cfg->canvas_mode);
    chafa_canvas_config_set_pixel_mode(_canvas_cfg, CHAFA_PIXEL_MODE_SYMBOLS);
    chafa_canvas_config_set_bg_color(_canvas_cfg, cfg->bg_color);
    chafa_canvas_config_set_work_factor(_canvas_cfg, cfg->work_factor);
    chafa_canvas_config_set_dither_mode(_canvas_cfg, cfg->dither_mode);
    chafa_canvas_config_set_preprocessing_enabled(_canvas_cfg, cfg->preprocessing);
    _canvas = chafa_canvas_new(_canvas_cfg);
    memcpy(&_last_cfg, cfg, sizeof(CodecConfig));
    _canvas_ok = 1;
}

static char* chafa_render_to(uint8_t* rgba, int w, int h, ChafaCanvas* canvas) {
    chafa_canvas_draw_all_pixels(canvas, CHAFA_PIXEL_RGBA8_UNASSOCIATED, rgba, w, h, w*4);
    GString* gs = chafa_canvas_build_ansi(canvas);
    char* result = strdup(gs->str);
    g_string_free(gs, 1);
    return result;
}

static ChafaCanvas* make_anim_canvas(CodecConfig* cfg, ChafaCanvasConfig** out_cfg) {
    ChafaCanvasConfig* cc = chafa_canvas_config_new();
    chafa_canvas_config_set_geometry(cc, cfg->term_w, cfg->term_h);
    chafa_canvas_config_set_canvas_mode(cc, cfg->canvas_mode);
    chafa_canvas_config_set_pixel_mode(cc, CHAFA_PIXEL_MODE_SYMBOLS);
    chafa_canvas_config_set_bg_color(cc, cfg->bg_color);
    chafa_canvas_config_set_work_factor(cc, cfg->work_factor);
    chafa_canvas_config_set_dither_mode(cc, cfg->dither_mode);
    chafa_canvas_config_set_preprocessing_enabled(cc, cfg->preprocessing);
    ChafaCanvas* cv = chafa_canvas_new(cc);
    *out_cfg = cc;
    return cv;
}

/* ── animation handle ── */
typedef enum { ANIM_GIF, ANIM_WEBP } AnimType;
typedef struct {
    AnimType type;
    uint8_t* rgbabuf; int total_frames, frame_size, w, h, idx;
    int* delays; int done, aborted, prev_ts;
    WebPAnimDecoder* webp_dec;
    uint8_t* webp_buf; int webp_len;
    ChafaCanvas* canvas;
    ChafaCanvasConfig* canvas_cfg;
} AnimHandle;
static AnimHandle* _handles[16];

static void create_anim_handle(AnimType t, uint8_t* rgba, int frames, int w, int h, uint8_t* buf, int blen) {
    for (int i=0; i<16; i++) { if (!_handles[i]) { _handles[i]=calloc(1,sizeof(AnimHandle)); _handles[i]->type=t; _handles[i]->rgbabuf=rgba; _handles[i]->total_frames=frames; _handles[i]->frame_size=w*h*4; _handles[i]->w=w; _handles[i]->h=h; _handles[i]->idx=0; _handles[i]->webp_buf=buf; _handles[i]->webp_len=blen; return; } }
}

/* ── public API ── */

char* codec_render_buffer(char* data, int32_t len, CodecConfig* cfg, CodecMetrics* out, int32_t* err);

char* codec_render_path(const char* path, CodecConfig* in_cfg, CodecMetrics* out, int32_t* err) {
    *err = ERR_OK;
    if (!path) { *err = ERR_BAD_PARAMS; return strdup(err_string(ERR_BAD_PARAMS)); }
    FILE* f=fopen(path,"rb"); if(!f) { *err = ERR_FILE_OPEN; return strdup(err_string(ERR_FILE_OPEN)); }
    fseek(f,0,SEEK_END); long sz=ftell(f); fseek(f,0,SEEK_SET);
    if (sz <= 0) { fclose(f); *err = ERR_FILE_EMPTY; return strdup(err_string(ERR_FILE_EMPTY)); }
    uint8_t* buf=malloc(sz); if(!buf){fclose(f);*err=ERR_MALLOC;return strdup(err_string(ERR_MALLOC));}
    if (fread(buf,1,sz,f) != (size_t)sz) { free(buf); fclose(f); *err = ERR_FILE_READ; return strdup(err_string(ERR_FILE_READ)); }
    fclose(f);
    CodecConfig cfg; memcpy(&cfg, in_cfg, sizeof(CodecConfig));
    char* result = codec_render_buffer((char*)buf, sz, &cfg, out, err);
    free(buf);
    return result;
}

char* codec_render_buffer(char* data, int32_t len, CodecConfig* cfg, CodecMetrics* out, int32_t* err) {
    *err = ERR_OK;
    memset(out, 0, sizeof(CodecMetrics));
    DecodeCtx dctx={0};

    if (!data || len <= 0) { *err = ERR_BAD_PARAMS; return strdup(err_string(ERR_BAD_PARAMS)); }
    if (len < 8) { *err = ERR_FILE_EMPTY; return strdup(err_string(ERR_FILE_EMPTY)); }

    int fmt=detect_format((uint8_t*)data, len);
    out->format=fmt;
    if (fmt<0) { *err = ERR_UNKNOWN_FMT; return strdup(err_string(ERR_UNKNOWN_FMT)); }
    if (cfg->term_w < 1 || cfg->term_h < 1) { *err = ERR_BAD_PARAMS; return strdup("ERROR: terminal dimensions must be positive"); }

    double t0=now_ms(), t1;
    int decode_err = 0;
    switch(fmt) {
        case FMT_PNG:  decode_err = decode_png(&dctx, (uint8_t*)data, len); break;
        case FMT_JPEG: decode_err = decode_jpeg(&dctx, (uint8_t*)data, len); break;
        case FMT_BMP:  decode_err = decode_bmp(&dctx, (uint8_t*)data, len); break;
        case FMT_WEBP: decode_err = decode_webp_static(&dctx, (uint8_t*)data, len); break;
        case FMT_GIF:  decode_err = decode_gif(&dctx, (uint8_t*)data, len); break;
        default: *err = ERR_UNSUPPORTED; return strdup(err_string(ERR_UNSUPPORTED));
    }
    if (decode_err) { *err = ERR_DECODE_FAIL; return strdup(err_string(ERR_DECODE_FAIL)); }

    if (dctx.w < MIN_DIM || dctx.w > MAX_DIM || dctx.h < MIN_DIM || dctx.h > MAX_DIM) {
        *err = ERR_DIMENSIONS; free(dctx.rgba); return strdup(err_string(ERR_DIMENSIONS));
    }

    t1=now_ms();
    out->parse_ms = (float)(t1-t0);
    out->img_w=dctx.w; out->img_h=dctx.h; out->frame_count=1;

    ensure_canvas(cfg);
    char* ansi=chafa_render_to(dctx.rgba, dctx.w, dctx.h, _canvas);
    out->render_ms = (float)(now_ms()-t1);
    free(dctx.rgba);
    return ansi;
}

int32_t codec_anim_open_buffer(char* data, int32_t len, CodecConfig* cfg, CodecMetrics* out, int32_t* err) {
    *err = ERR_OK;
    memset(out, 0, sizeof(CodecMetrics));
    if (!data || len <= 0) { *err = ERR_BAD_PARAMS; return -1; }
    if (cfg->term_w < 1 || cfg->term_h < 1) { *err = ERR_BAD_PARAMS; return -1; }
    int fmt=detect_format((uint8_t*)data, len);
    out->format=fmt;

    if (fmt==FMT_WEBP) {
        WebPData wpd={(uint8_t*)data, (size_t)len};
        WebPAnimDecoderOptions opts; WebPAnimDecoderOptionsInit(&opts); opts.color_mode=MODE_RGBA;
        WebPAnimDecoder* dec=WebPAnimDecoderNew(&wpd,&opts);
        if (!dec) return -1;
        WebPAnimInfo inf; WebPAnimDecoderGetInfo(dec,&inf);
        int w=inf.canvas_width, iH=inf.canvas_height, fs=w*iH*4;
        uint8_t* pool=malloc(fs*500 > 256*1024*1024 ? 256*1024*1024 : fs*500);
        uint8_t* fbuf; int ts, prev_ts = 0;
        if (!WebPAnimDecoderGetNext(dec,&fbuf,&ts)) { WebPAnimDecoderDelete(dec); free(pool); *err=ERR_DECODE_FAIL; return -1; }
        memcpy(pool, fbuf, fs);
        out->img_w=w; out->img_h=iH; out->frame_delay_ms=ts; out->frame_count=-1;
        AnimHandle* ah=calloc(1,sizeof(AnimHandle)); ah->type=ANIM_WEBP; ah->rgbabuf=pool; ah->w=w; ah->h=iH;
        ah->frame_size=fs; ah->total_frames=-1; ah->idx=1; ah->delays=malloc(sizeof(int)*1000);
        ah->delays[0]=ts; ah->webp_dec=dec; ah->prev_ts=ts;
        ah->webp_len = len;
        ah->webp_buf = malloc(len);
        memcpy(ah->webp_buf, data, len);
        ah->canvas = make_anim_canvas(cfg, &ah->canvas_cfg);
        for (int i=0; i<16; i++) if(!_handles[i]) { _handles[i]=ah; return i; }
        WebPAnimDecoderDelete(dec); free(pool); free(ah); return -1;
    }

    if (fmt==FMT_GIF) {
        int iw,ih,frames,comp,*delays;
        uint8_t* data8=stbi_load_gif_from_memory((stbi_uc*)data,len,&delays,&iw,&ih,&frames,&comp,4);
        if (!data8||frames<2) return -1;
        int maxf=cfg->max_frames>0 && cfg->max_frames<frames ? cfg->max_frames : frames;
        out->img_w=iw; out->img_h=ih; out->frame_count=maxf; out->frame_delay_ms=delays[0];
        AnimHandle* ah=calloc(1,sizeof(AnimHandle)); ah->type=ANIM_GIF; ah->rgbabuf=data8;
        ah->w=iw; ah->h=ih; ah->frame_size=iw*ih*4; ah->total_frames=maxf; ah->idx=0; ah->delays=delays;
        ah->canvas = make_anim_canvas(cfg, &ah->canvas_cfg);
        for (int i=0; i<16; i++) if(!_handles[i]) { _handles[i]=ah; return i; }
        stbi_image_free(data8); stbi_image_free(delays); free(ah); return -1;
    }
    return -1;
}

int32_t codec_anim_next(int32_t handle, CodecMetrics* out) {
    if (handle<0||handle>=16||!_handles[handle]) return -1;
    AnimHandle* h=_handles[handle];
    if (h->aborted) return -1;
    memset(out,0,sizeof(CodecMetrics));
    out->img_w=h->w; out->img_h=h->h;

    if (h->type==ANIM_GIF) {
        if (h->idx >= h->total_frames) return -1;
        out->frame_delay_ms=h->delays ? h->delays[h->idx] : 100;
        return h->idx++;
    }
    if (h->type==ANIM_WEBP) {
        if (h->done) return -1;
        uint8_t* fbuf; int ts;
        if (!WebPAnimDecoderGetNext(h->webp_dec,&fbuf,&ts)) { h->done=1; return -1; }
        memcpy(h->rgbabuf+h->idx*h->frame_size, fbuf, h->frame_size);
        int delta = ts - h->prev_ts;
        if (delta < 0) delta = h->delays ? h->delays[0] : 100;
        out->frame_delay_ms=delta;
        h->delays[h->idx] = delta;
        h->prev_ts = ts;
        return h->idx++;
    }
    return -1;
}

int32_t codec_anim_rewind(int32_t handle) {
    if (handle<0||handle>=16||!_handles[handle]) return -1;
    AnimHandle* h=_handles[handle];
    if (h->type==ANIM_GIF) { h->idx = 0; return 0; }
    if (h->type==ANIM_WEBP) {
        WebPAnimDecoderDelete(h->webp_dec);
        WebPData wpd = {h->webp_buf, (size_t)h->webp_len};
        WebPAnimDecoderOptions opts; WebPAnimDecoderOptionsInit(&opts); opts.color_mode=MODE_RGBA;
        h->webp_dec = WebPAnimDecoderNew(&wpd, &opts);
        if (!h->webp_dec) return -1;
        h->idx = 0; h->done = 0; h->prev_ts = 0;
        return 0;
    }
    return -1;
}

uint8_t* codec_anim_frame_data(int32_t handle, int32_t frame_idx) {
    if (handle<0||handle>=16||!_handles[handle]) return NULL;
    AnimHandle* h=_handles[handle];
    if (frame_idx<0||frame_idx>=h->idx) return NULL;
    return h->rgbabuf + frame_idx*h->frame_size;
}

char* codec_anim_render_frame(int32_t handle, int32_t frame_idx, CodecMetrics* out) {
    if (handle<0||handle>=16||!_handles[handle]) return strdup("ERROR: invalid handle");
    AnimHandle* h=_handles[handle];
    uint8_t* data=codec_anim_frame_data(handle, frame_idx);
    if (!data) return strdup("");
    out->frame_delay_ms=h->delays ? h->delays[frame_idx] : 100;
    return chafa_render_to(data, h->w, h->h, h->canvas);
}

void codec_anim_close(int32_t handle) {
    if (handle<0||handle>=16||!_handles[handle]) return;
    AnimHandle* h=_handles[handle];
    if (h->type==ANIM_GIF) { stbi_image_free(h->rgbabuf); stbi_image_free(h->delays); }
    if (h->type==ANIM_WEBP) { WebPAnimDecoderDelete(h->webp_dec); free(h->rgbabuf); free(h->delays); free(h->webp_buf); }
    if (h->canvas) chafa_canvas_unref(h->canvas);
    if (h->canvas_cfg) chafa_canvas_config_unref(h->canvas_cfg);
    free(h); _handles[handle]=NULL;
}

void codec_anim_abort(int32_t handle) {
    if (handle<0||handle>=16||!_handles[handle]) return;
    _handles[handle]->aborted=1;
}

void codec_free_string(char* s) { if (s) free(s); }
