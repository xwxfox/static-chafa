#include <stdio.h>
#include <stdint.h>
#include <string.h>
#include <stdlib.h>

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

int32_t decode_gif_frame(uint8_t* lzw_data, int32_t lzw_len, int32_t min_code_size,
                          uint8_t* indices_out, int32_t pixel_count) {
    lzw_reader r = {0, 0, lzw_data, lzw_len, 0};
    int32_t cc = 1 << min_code_size, eoi = cc + 1;
    int32_t next = eoi + 1, cs = min_code_size + 1;
    static int32_t prefix[4096];
    static uint8_t suffix[4096];
    static uint8_t dbuf[4096];
    int32_t out = 0, prev = -1, code_count = 0;

    while (out < pixel_count) {
        int32_t code = lzw_read_bits(&r, cs);
        code_count++;
        if (code < 0) { printf("EOF at code %d out %d (pos=%d num_bits=%d cs=%d)\n", code_count, out, r.pos, r.num_bits, cs); break; }
        if (code == eoi) { printf("EOI at code %d out %d\n", code_count, out); break; }
        if (code == cc) { next = eoi + 1; cs = min_code_size + 1; prev = -1; continue; }
        if (prev < 0) { indices_out[out++] = (uint8_t)code; prev = code; continue; }
        int32_t stk = 0, cur = code;
        if (cur == next) {
            int32_t fc;
            if (prev < cc) fc = prev;
            else { int32_t c = prev; while (c >= cc) c = prefix[c]; fc = c; }
            dbuf[stk++] = (uint8_t)fc;
            cur = prev;
        }
        if (cur < cc) { dbuf[stk++] = (uint8_t)cur; }
        else {
            int32_t chain = 0;
            while (cur >= cc && chain < 4096) { dbuf[stk++] = suffix[cur]; cur = prefix[cur]; chain++; }
            dbuf[stk++] = (uint8_t)cur;
        }
        for (int32_t i = stk - 1; i >= 0 && out < pixel_count; i--) indices_out[out++] = dbuf[i];
        if (next < 4096 && prev >= 0) {
            prefix[next] = prev;
            suffix[next] = dbuf[0];
            next++;
            if (next > (1 << cs) && cs < 12) cs++;
        }
        prev = code;
    }
    printf("returning out=%d\n", out);
    return out;
}

int main() {
    FILE* f = fopen("fox.gif", "rb");
    fseek(f, 0, SEEK_END); size_t sz = ftell(f); fseek(f, 0, SEEK_SET);
    uint8_t* data = malloc(sz); fread(data, 1, sz, f); fclose(f);

    int p = 6;
    uint8_t pkt = data[p + 4]; p += 7;
    if (pkt & 0x80) p += 3 * (1 << ((pkt & 0x07) + 1));
    while (p < (int)sz && data[p] != 0x2C) {
        if (data[p] == 0x21) { if (data[p+1] == 0xF9) p += 8; else { p += 2; while (p < (int)sz && data[p] != 0) p += 1 + data[p]; p++; } }
        else p++;
    }
    int fw = data[p+5] | (data[p+6] << 8); int fh = data[p+7] | (data[p+8] << 8);
    int fpkt = data[p+9]; p += 10;
    if (fpkt & 0x80) p += 3 * (1 << ((fpkt & 0x07) + 1));
    int minCS = data[p]; p++;

    // Collect LZW data properly
    int lzw_start = p; // remember start for later
    int total = 0;
    while (p < (int)sz) { int bs = data[p]; p++; if (bs == 0) break; total += bs; p += bs; }
    printf("LZW: %d bytes, frame %dx%d, min_code %d\n", total, fw, fh, minCS);
    printf("LZW starts at file offset %d\n", lzw_start);

    // Actually build LZW data array
    uint8_t* lzw = malloc(total);
    p = lzw_start;
    int lzw_pos = 0;
    while (p < (int)sz) { int bs = data[p]; p++; if (bs == 0) break; memcpy(lzw + lzw_pos, data + p, bs); lzw_pos += bs; p += bs; }

    printf("collected LZW: %d bytes\n", lzw_pos);
    printf("first 20 LZW bytes: ");
    for (int i = 0; i < 20; i++) printf("%d ", lzw[i]);
    printf("\n");

    uint8_t* indices = calloc(1, fw * fh);
    int decoded = decode_gif_frame(lzw, lzw_pos, minCS, indices, fw * fh);

    free(data); free(lzw); free(indices);
    return 0;
}
