#include <stdio.h>
#include <stdint.h>
#include <string.h>
#include <stdlib.h>

typedef struct { int32_t bits; int32_t num_bits; const uint8_t* data; int32_t len; int32_t pos; } lzw_reader;

static int32_t lzw_read_bits(lzw_reader* r, int32_t n) {
    int orig_pos = r->pos;
    while (r->num_bits < n) {
        if (r->pos >= r->len) return -1;
        r->bits |= (int32_t)r->data[r->pos++] << r->num_bits;
        r->num_bits += 8;
    }
    int32_t result = r->bits & ((1 << n) - 1);
    r->bits >>= n; r->num_bits -= n;
    return result;
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

    int total = 0, lzw_start = p;
    while (p < (int)sz) { int bs = data[p]; p++; if (bs == 0) break; total += bs; p += bs; }

    uint8_t* lzw = malloc(total);
    p = lzw_start; int lzw_pos = 0;
    while (p < (int)sz) { int bs = data[p]; p++; if (bs == 0) break; memcpy(lzw + lzw_pos, data + p, bs); lzw_pos += bs; p += bs; }

    int cc = 1 << minCS, eoi = cc + 1;
    int next = eoi + 1, cs = minCS + 1, prev = -1;
    int out = 0, code_count = 0;

    lzw_reader r = {0, 0, lzw, lzw_pos, 0};

    while (out < fw*fh) {
        if (code_count >= 455 && code_count <= 465) {
            printf("  before code %d: pos=%d num_bits=%d cs=%d next=%d prev=%d\n",
                   code_count+1, r.pos, r.num_bits, cs, next, prev);
        }

        int code = lzw_read_bits(&r, cs);
        code_count++;

        if (code_count >= 455 && code_count <= 465) {
            printf("  code %d: %d (0x%x)\n", code_count, code, code);
        }

        if (code < 0) { printf("EOF at %d\n", code_count); break; }
        if (code == eoi) { printf("EOI at code %d out %d\n", code_count, out); break; }
        if (code == cc) { next = eoi + 1; cs = minCS + 1; prev = -1; continue; }
        if (prev < 0) { /* out++ */ prev = code; out++; continue; }

        out++; // rough

        if (next < 4096 && prev >= 0) {
            next++;
            if (next > (1 << cs) && cs < 12) cs++;
        }
        prev = code;
    }

    free(data); free(lzw);
    return 0;
}
