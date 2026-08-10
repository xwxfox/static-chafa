#include <stdint.h>
#include <stdio.h>
#include <zlib.h>
#include <jpeglib.h>
#include <stdlib.h>
#include <string.h>

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

/* ── GIF LZW ── */
typedef struct { int32_t bits; int32_t num_bits; const uint8_t* data; int32_t len; int32_t pos; } lzw_reader;

static int32_t lzw_read_bits(lzw_reader* r, int32_t n) {
    while (r->num_bits < n) {
        if (r->pos >= r->len) return -1;
        r->bits |= (int32_t)r->data[r->pos++] << r->num_bits;
        r->num_bits += 8;
    }
    int32_t result = r->bits & ((1 << n) - 1);
    r->bits >>= n; r->num_bits -= n;
    return result;
}

int32_t decode_gif_frame(uint8_t* lzw_data, int32_t lzw_len,
                          int32_t min_code_size,
                          uint8_t* indices_out, int32_t pixel_count) {
    lzw_reader r = {0, 0, lzw_data, lzw_len, 0};
    int32_t clear_code = 1 << min_code_size, eoi_code = clear_code + 1;
    int32_t next_code = eoi_code + 1, code_size = min_code_size + 1;
    static int32_t prefix[4096];
    static uint8_t suffix[4096];
    static uint8_t decode_buf[4096];
    int32_t out_idx = 0, prev_code = -1;

    while (out_idx < pixel_count) {
        int32_t code = lzw_read_bits(&r, code_size);
        if (code < 0) break;
        if (code == eoi_code) break;
        if (code == clear_code) {
            next_code = eoi_code + 1; code_size = min_code_size + 1; prev_code = -1;
            continue;
        }
        if (prev_code < 0) {
            if (out_idx >= pixel_count) break;
            indices_out[out_idx++] = (uint8_t)code;
            prev_code = code;
            continue;
        }

        int32_t stack_idx = 0, curr = code;
        if (curr == next_code) {
            int32_t fc;
            if (prev_code < clear_code) { fc = prev_code; }
            else { int32_t c = prev_code; while (c >= clear_code) c = prefix[c]; fc = c; }
            decode_buf[stack_idx++] = (uint8_t)fc;
            curr = prev_code;
        }
        if (curr < clear_code) { decode_buf[stack_idx++] = (uint8_t)curr; }
        else {
            int32_t chain = 0;
            while (curr >= clear_code && chain < 4096) {
                decode_buf[stack_idx++] = suffix[curr];
                curr = prefix[curr];
                chain++;
            }
            decode_buf[stack_idx++] = (uint8_t)curr;
        }
        int32_t first_byte = decode_buf[stack_idx - 1];
        for (int32_t i = stack_idx - 1; i >= 0 && out_idx < pixel_count; i--)
            indices_out[out_idx++] = decode_buf[i];

        if (next_code < 4096 && prev_code >= 0) {
            prefix[next_code] = prev_code;
            suffix[next_code] = (uint8_t)first_byte;
            next_code++;
            if (next_code > (1 << code_size) && code_size < 12) code_size++;
        }
        prev_code = code;
    }
    return out_idx;
}

/* ── GIF palette expander ── */
void expand_palette_to_rgba(uint8_t* indices, int32_t pixel_count,
                             uint8_t* palette, int32_t palette_size,
                             uint8_t* rgba_out, int32_t transp_idx) {
    for (int32_t i = 0; i < pixel_count; i++) {
        int32_t d = i * 4, idx = indices[i];
        if (transp_idx >= 0 && idx == transp_idx) {
            rgba_out[d]=0; rgba_out[d+1]=0; rgba_out[d+2]=0; rgba_out[d+3]=0;
        } else if (idx < palette_size) {
            int32_t p = idx * 3;
            rgba_out[d]=palette[p]; rgba_out[d+1]=palette[p+1]; rgba_out[d+2]=palette[p+2]; rgba_out[d+3]=255;
        }
    }
}
