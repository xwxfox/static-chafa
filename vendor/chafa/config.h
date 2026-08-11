/* config.h - Minimal config for embedded chafa build */
#ifndef CHAFA_CONFIG_H
#define CHAFA_CONFIG_H

#define CHAFA_MAJOR_VERSION 1
#define CHAFA_MINOR_VERSION 19
#define CHAFA_MICRO_VERSION 0
#define CHAFA_VERSION "1.19.0"

#undef HAVE_GLIB

#define HAVE_STDLIB_H 1
#define HAVE_STRING_H 1
#define HAVE_STDIO_H 1
#define HAVE_MATH_H 1
#define HAVE_STDINT_H 1

#define WORDS_BIGENDIAN 0

/* Disable SIMD (enabled per-target from build.sh when appropriate) */
#undef HAVE_MMX_INTRINSICS
#undef HAVE_SSE41_INTRINSICS
#undef HAVE_AVX2_INTRINSICS
#undef HAVE_NEON_INTRINSICS
#undef HAVE_ARM_NEON_H
/* POPCNT: controlled by build.sh -DHAVE_POPCNT64_INTRINSICS */

/* Threading */
#define HAVE_PTHREAD 1

/* Package info */
#define PACKAGE "chafa"
#define PACKAGE_VERSION "1.19.0"
#define VERSION "1.19.0"

#endif /* CHAFA_CONFIG_H */
