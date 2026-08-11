#include <stdint.h>
#include <stdio.h>
#include <zlib.h>
#include <jpeglib.h>
#include <stdlib.h>
#include <string.h>
#include <webp/decode.h>
#include <webp/demux.h>

#define STBI_NO_STDIO
#define STBI_NO_JPEG
#define STBI_NO_PNG
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

static int32_t abs_i32(int32_t x) { return x < 0 ? -x : x; }

static uint8_t paeth_u8(uint8_t a, uint8_t b, uint8_t c) {
    int32_t p = (int32_t)a + (int32_t)b - (int32_t)c;
    int32_t pa = abs_i32(p - (int32_t)a);
    int32_t pb = abs_i32(p - (int32_t)b);
    int32_t pc = abs_i32(p - (int32_t)c);
    if (pa <= pb && pa <= pc) return a;
    return pb <= pc ? b : c;
}

/* ── Generic defilter (source color space) ── */
void defilter(uint8_t* raw, int32_t channels, int32_t scanline,
              int32_t stride, int32_t height,
              uint8_t* prev_buf, uint8_t* out) {
    int32_t y, i;
    for (y = 0; y < height; y++) {
        int32_t srcRow = y * stride;
        int32_t dstRow = y * scanline;
        uint8_t ft = raw[srcRow];
        uint8_t* si = raw + srcRow + 1;
        uint8_t* di = out + dstRow;
        uint8_t* prev = prev_buf;
        switch (ft) {
            case 0: for (i = 0; i < scanline; i++) di[i] = si[i]; break;
            case 1:
                for (i = 0; i < channels; i++) di[i] = si[i];
                for (i = channels; i < scanline; i++) di[i] = si[i] + di[i - channels];
                break;
            case 2:
                for (i = 0; i < scanline; i++) di[i] = si[i] + prev[i];
                break;
            case 3:
                for (i = 0; i < channels; i++) di[i] = si[i] + (prev[i] >> 1);
                for (i = channels; i < scanline; i++) di[i] = si[i] + ((di[i - channels] + prev[i]) >> 1);
                break;
            case 4:
                for (i = 0; i < channels; i++) di[i] = si[i] + paeth_u8(0, prev[i], 0);
                for (i = channels; i < scanline; i++)
                    di[i] = si[i] + paeth_u8(di[i - channels], prev[i], prev[i - channels]);
                break;
        }
        for (i = 0; i < scanline; i++) prev[i] = di[i];
    }
}

/* ── RGB defilter → RGBA (combined pass) ── */
void defilter_rgb_to_rgba(uint8_t* raw, int32_t width, int32_t height,
                           uint8_t* prev_buf, uint8_t* rgba_out) {
    int32_t scanline = width * 3, stride = scanline + 1, y, p;
    for (y = 0; y < height; y++) {
        int32_t srcRow = y * stride;
        uint8_t ft = raw[srcRow];
        uint8_t* si = raw + srcRow + 1;
        uint8_t* di = rgba_out + y * width * 4;
        uint8_t* prev = prev_buf;
        switch (ft) {
            case 0:
                for (p = 0; p < width; p++) {
                    di[p*4] = si[p*3]; di[p*4+1] = si[p*3+1]; di[p*4+2] = si[p*3+2]; di[p*4+3] = 255;
                }
                break;
            case 1:
                di[0] = si[0]; di[1] = si[1]; di[2] = si[2]; di[3] = 255;
                for (p = 1; p < width; p++) {
                    int32_t o = p * 4, s = p * 3;
                    di[o] = si[s] + di[o-4]; di[o+1] = si[s+1] + di[o-3];
                    di[o+2] = si[s+2] + di[o-2]; di[o+3] = 255;
                }
                break;
            case 2:
                for (p = 0; p < width; p++) {
                    di[p*4] = si[p*3] + prev[p*3]; di[p*4+1] = si[p*3+1] + prev[p*3+1];
                    di[p*4+2] = si[p*3+2] + prev[p*3+2]; di[p*4+3] = 255;
                }
                break;
            case 3:
                di[0] = si[0] + (prev[0] >> 1); di[1] = si[1] + (prev[1] >> 1);
                di[2] = si[2] + (prev[2] >> 1); di[3] = 255;
                for (p = 1; p < width; p++) {
                    int32_t o = p * 4, s = p * 3;
                    di[o] = si[s] + ((di[o-4] + prev[s]) >> 1);
                    di[o+1] = si[s+1] + ((di[o-3] + prev[s+1]) >> 1);
                    di[o+2] = si[s+2] + ((di[o-2] + prev[s+2]) >> 1);
                    di[o+3] = 255;
                }
                break;
            case 4:
                di[0] = si[0] + paeth_u8(0, prev[0], 0); di[1] = si[1] + paeth_u8(0, prev[1], 0);
                di[2] = si[2] + paeth_u8(0, prev[2], 0); di[3] = 255;
                for (p = 1; p < width; p++) {
                    int32_t o = p * 4, s = p * 3;
                    di[o] = si[s] + paeth_u8(di[o-4], prev[s], prev[s-3]);
                    di[o+1] = si[s+1] + paeth_u8(di[o-3], prev[s+1], prev[s-2]);
                    di[o+2] = si[s+2] + paeth_u8(di[o-2], prev[s+2], prev[s-1]);
                    di[o+3] = 255;
                }
                break;
        }
        for (p = 0; p < width; p++) {
            prev[p*3] = di[p*4]; prev[p*3+1] = di[p*4+1]; prev[p*3+2] = di[p*4+2];
        }
    }
}

/* ── zlib inflate ── */
int32_t inflate_zlib(uint8_t* input, int32_t input_len,
                     uint8_t* output, int32_t output_capacity) {
    uLongf destLen = (uLongf)output_capacity;
    int ret = uncompress(output, &destLen, input, (uLong)input_len);
    return ret == Z_OK ? (int32_t)destLen : -1;
}

/* ── JPEG decoder ── */
typedef struct { struct jpeg_source_mgr pub; const uint8_t* data; size_t len; } mem_source_mgr;
static void jpeg_init(j_decompress_ptr c) { (void)c; }
static boolean jpeg_fill(j_decompress_ptr c) {
    mem_source_mgr* s = (mem_source_mgr*)c->src;
    s->pub.next_input_byte = s->data; s->pub.bytes_in_buffer = s->len; return TRUE;
}
static void jpeg_skip(j_decompress_ptr c, long n) {
    mem_source_mgr* s = (mem_source_mgr*)c->src;
    if (n > 0 && (size_t)n <= s->pub.bytes_in_buffer) {
        s->pub.next_input_byte += n; s->pub.bytes_in_buffer -= n;
    }
}

int32_t decode_jpeg_to_rgba(uint8_t* input, int32_t input_len,
                             uint8_t* rgba_out, int32_t* width_out, int32_t* height_out) {
    struct jpeg_decompress_struct cinfo; struct jpeg_error_mgr jerr; mem_source_mgr src;
    cinfo.err = jpeg_std_error(&jerr); jpeg_create_decompress(&cinfo);
    src.data = input; src.len = (size_t)input_len;
    src.pub.init_source = jpeg_init; src.pub.fill_input_buffer = jpeg_fill;
    src.pub.skip_input_data = jpeg_skip; src.pub.resync_to_restart = jpeg_resync_to_restart;
    src.pub.term_source = jpeg_init;
    src.pub.next_input_byte = input; src.pub.bytes_in_buffer = input_len;
    cinfo.src = (struct jpeg_source_mgr*)&src;
    jpeg_read_header(&cinfo, TRUE); jpeg_start_decompress(&cinfo);
    int32_t w = (int32_t)cinfo.output_width, h = (int32_t)cinfo.output_height;
    int32_t rs = w * cinfo.output_components;
    JSAMPARRAY buf = (*cinfo.mem->alloc_sarray)((j_common_ptr)&cinfo, JPOOL_IMAGE, rs, 1);
    for (int32_t y = 0; y < h; y++) {
        jpeg_read_scanlines(&cinfo, buf, 1);
        for (int32_t x = 0; x < w; x++) {
            int32_t d = (y*w+x)*4, s = x*cinfo.output_components;
            rgba_out[d]=buf[0][s]; rgba_out[d+1]=buf[0][s+1]; rgba_out[d+2]=buf[0][s+2]; rgba_out[d+3]=255;
        }
    }
    *width_out = w; *height_out = h;
    jpeg_finish_decompress(&cinfo); jpeg_destroy_decompress(&cinfo);
    return 0;
}

/* ── GIF decoder (stb_image) ── */

int32_t decode_gif_to_rgba(uint8_t* input, int32_t input_len,
                            uint8_t* rgba_pool, int32_t pool_capacity,
                            int32_t* frame_delays, int32_t max_frames,
                            int32_t* width_out, int32_t* height_out,
                            int32_t* frame_count_out) {
    int w, h, frames, comp;
    int* delays;
    uint8_t* data = stbi_load_gif_from_memory(input, input_len, &delays, &w, &h, &frames, &comp, 4);
    if (!data) return -1;

    *width_out = w;
    *height_out = h;
    int count = frames < max_frames ? frames : max_frames;
    *frame_count_out = count;

    int32_t frame_size = w * h * 4;
    int32_t needed = frame_size * count;
    if (needed > pool_capacity) {
        stbi_image_free(data);
        stbi_image_free(delays);
        return -2;
    }

    memcpy(rgba_pool, data, needed);
    for (int i = 0; i < count; i++) {
        frame_delays[i] = delays[i];
    }

    stbi_image_free(data);
    stbi_image_free(delays);
    return count;
}

/* ── GIF info only (fast, no decompress) ── */
int32_t gif_get_info(uint8_t* input, int32_t input_len,
                     int32_t* width_out, int32_t* height_out,
                     int32_t* frame_count_out,
                     int32_t* delays_out, int32_t max_delays) {
    int w, h, frames, comp;
    int* delays;
    uint8_t* data = stbi_load_gif_from_memory(input, input_len, &delays, &w, &h, &frames, &comp, 4);
    if (!data) return -1;

    *width_out = w;
    *height_out = h;
    *frame_count_out = frames;
    int count = frames < max_delays ? frames : max_delays;
    for (int i = 0; i < count; i++) delays_out[i] = delays[i];

    stbi_image_free(data);
    stbi_image_free(delays);
    return frames;
}

/* ── WebP decoder ── */
int32_t decode_webp_to_rgba(uint8_t* input, int32_t input_len,
                             uint8_t* rgba_out, int32_t capacity,
                             int32_t* width_out, int32_t* height_out) {
    int w, h;
    if (!WebPGetInfo(input, input_len, &w, &h)) return -1;
    *width_out = w; *height_out = h;
    int32_t needed = w * h * 4;
    if (needed > capacity) return -2;
    uint8_t* result = WebPDecodeRGBAInto(input, input_len, rgba_out, needed, w * 4);
    return (result == rgba_out) ? 0 : -1;
}

int32_t decode_animated_webp_to_rgba(uint8_t* input, int32_t input_len,
                                      uint8_t* rgba_pool, int32_t pool_capacity,
                                      int32_t* frame_delays, int32_t max_frames,
                                      int32_t* width_out, int32_t* height_out,
                                      int32_t* frame_count_out) {
    WebPData webp_data = {input, (size_t)input_len};
    WebPAnimDecoderOptions dec_opts;
    WebPAnimDecoderOptionsInit(&dec_opts);
    dec_opts.color_mode = MODE_RGBA;
    WebPAnimDecoder* dec = WebPAnimDecoderNew(&webp_data, &dec_opts);
    if (!dec) return -1;

    WebPAnimInfo anim_info;
    WebPAnimDecoderGetInfo(dec, &anim_info);
    int32_t w = anim_info.canvas_width, h = anim_info.canvas_height;
    *width_out = w; *height_out = h;

    int32_t frame_size = w * h * 4;
    int32_t count = 0, pool_pos = 0;

    while (WebPAnimDecoderHasMoreFrames(dec) && count < max_frames) {
        uint8_t* buf;
        int timestamp;
        if (pool_pos + frame_size > pool_capacity) break;
        if (!WebPAnimDecoderGetNext(dec, &buf, &timestamp)) break;
        memcpy(rgba_pool + pool_pos, buf, frame_size);
        frame_delays[count] = timestamp;
        pool_pos += frame_size;
        count++;
    }

    *frame_count_out = count;
    WebPAnimDecoderDelete(dec);
    return count;
}

/* ── Streaming animated WebP ── */
#define MAX_STREAMS 8
typedef struct { WebPAnimDecoder* dec; uint8_t* pool; int32_t cap; int32_t pos; int32_t w; int32_t h; int32_t fs; int32_t active; } webp_stream;
static webp_stream _streams[MAX_STREAMS];

int32_t webp_anim_open(uint8_t* input, int32_t input_len, uint8_t* rgba_pool, int32_t pool_capacity,
                        int32_t* width_out, int32_t* height_out, int32_t* delay_out) {
    for (int k = 0; k < MAX_STREAMS; k++) {
        if (!_streams[k].active) {
            WebPData wpd = {input, (size_t)input_len};
            WebPAnimDecoderOptions opts;
            WebPAnimDecoderOptionsInit(&opts);
            opts.color_mode = MODE_RGBA;
            WebPAnimDecoder* dec = WebPAnimDecoderNew(&wpd, &opts);
            if (!dec) return -1;
            WebPAnimInfo info;
            WebPAnimDecoderGetInfo(dec, &info);
            _streams[k].dec = dec;
            _streams[k].pool = rgba_pool;
            _streams[k].cap = pool_capacity;
            _streams[k].pos = 0;
            _streams[k].w = info.canvas_width;
            _streams[k].h = info.canvas_height;
            _streams[k].fs = info.canvas_width * info.canvas_height * 4;
            _streams[k].active = 1;
            *width_out = info.canvas_width;
            *height_out = info.canvas_height;
            // decode first frame
            uint8_t* buf; int ts;
            if (WebPAnimDecoderGetNext(dec, &buf, &ts)) {
                memcpy(rgba_pool, buf, _streams[k].fs);
                *delay_out = ts;
                _streams[k].pos = _streams[k].fs;
                return k;
            }
            _streams[k].active = 0;
            WebPAnimDecoderDelete(dec);
            return -1;
        }
    }
    return -1;
}

int32_t webp_anim_next(int32_t handle, int32_t count, int32_t* delays_out, int32_t* out_count) {
    if (handle < 0 || handle >= MAX_STREAMS || !_streams[handle].active) return -1;
    webp_stream* s = &_streams[handle];
    int32_t decCount = 0;
    while (decCount < count && WebPAnimDecoderHasMoreFrames(s->dec)) {
        if (s->pos + s->fs > s->cap) break;
        uint8_t* buf; int ts;
        if (!WebPAnimDecoderGetNext(s->dec, &buf, &ts)) break;
        memcpy(s->pool + s->pos, buf, s->fs);
        delays_out[decCount] = ts;
        s->pos += s->fs;
        decCount++;
    }
    *out_count = decCount;
    return decCount > 0 ? 0 : -1;
}

int32_t webp_anim_count(int32_t handle) {
    if (handle < 0 || handle >= MAX_STREAMS || !_streams[handle].active) return -1;
    return _streams[handle].pos / _streams[handle].fs;
}

void webp_anim_close(int32_t handle) {
    if (handle < 0 || handle >= MAX_STREAMS || !_streams[handle].active) return;
    WebPAnimDecoderDelete(_streams[handle].dec);
    _streams[handle].active = 0;
}

/* ── BMP decoder ── */
int32_t decode_bmp_to_rgba(uint8_t* input, int32_t input_len,
                            uint8_t* rgba_out, int32_t capacity,
                            int32_t* width_out, int32_t* height_out) {
    int w, h, comp;
    uint8_t* data = stbi_load_from_memory(input, input_len, &w, &h, &comp, 4);
    if (!data) return -1;
    *width_out = w; *height_out = h;
    int32_t needed = w * h * 4;
    if (needed > capacity) { stbi_image_free(data); return -2; }
    memcpy(rgba_out, data, needed);
    stbi_image_free(data);
    return 0;
}
