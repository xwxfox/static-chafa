#!/usr/bin/env bash
# build.sh — Cross-compile codec.so with embedded chafa (zero external deps beyond libc)
# Usage: ./build.sh [native|x86_64-linux|aarch64-linux|x86_64-windows|aarch64-macos]
#
# No runtime dependency on: libchafa, glib, or any image library.
# All deps (png, jpeg, webp, zlib, glib) are compiled from source or built-in.
set -euo pipefail

TARGET="${1:-native}"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
CHAFA_ORIG="/tmp/chafa_src/chafa"
DEPS_SRC="${SRC_DIR}/deps_src"
VENDOR="${SRC_DIR}/chafa_vendor"
export MAKEFLAGS="-j$(nproc)"

# ── Target configuration ───────────────────────────────────────
case "${TARGET}" in
    native)
        ZIG_HOST=""; HOST_TRIPLET=""; ZIG_TARGET=""
        SHARED_EXT="so"; CROSS=false
        ;;
    x86_64-linux)
        ZIG_HOST="-target x86_64-linux-gnu"
        HOST_TRIPLET="x86_64-linux-gnu"; ZIG_TARGET="x86_64-linux-gnu"
        SHARED_EXT="so"; CROSS=true
        ;;
    aarch64-linux)
        ZIG_HOST="-target aarch64-linux-gnu"
        HOST_TRIPLET="aarch64-linux-gnu"; ZIG_TARGET="aarch64-linux-gnu"
        SHARED_EXT="so"; CROSS=true
        ;;
    x86_64-windows)
        ZIG_HOST="-target x86_64-windows-gnu"
        HOST_TRIPLET="x86_64-w64-mingw32"; ZIG_TARGET="x86_64-windows-gnu"
        SHARED_EXT="dll"; CROSS=true
        ;;
    aarch64-macos)
        ZIG_HOST="-target aarch64-macos-none"
        HOST_TRIPLET="aarch64-apple-darwin"; ZIG_TARGET="aarch64-macos-none"
        SHARED_EXT="dylib"; CROSS=true
        ;;
    *) echo "Unknown target: ${TARGET}"; exit 1 ;;
esac

ZIG_CC="zig cc ${ZIG_HOST}"
ZIG_CXX="zig c++ ${ZIG_HOST}"
DEPS_DIR="${SRC_DIR}/deps/${TARGET}"
DEPS_BUILD="/tmp/chafa_deps_build/${TARGET}"
OUTDIR="${SRC_DIR}/out/${TARGET}"
mkdir -p "${DEPS_DIR}/lib" "${DEPS_DIR}/include" "${DEPS_BUILD}" "${OUTDIR}" "${DEPS_SRC}"
OUT_SHARED="codec.${SHARED_EXT}"

# ── Compile flags ──────────────────────────────────────────────
CFLAGS_COMMON="-O3 -fPIC -ffunction-sections -fdata-sections \
  -Wno-unused-parameter -Wno-unused-function -Wno-sign-compare \
  -Wno-missing-field-initializers -Wno-unused-but-set-variable \
  -Wno-cast-qual -Wno-format-security -Wno-deprecated-declarations \
  -Wno-pointer-sign -Wno-incompatible-pointer-types"

# Use our built-in glib replacement ONLY (no system glib needed!)
CF_EXTRA="-I${VENDOR}"
INCLUDES="${CF_EXTRA} -I${CHAFA_ORIG} -I${CHAFA_ORIG}/internal -I${CHAFA_ORIG}/internal/smolscale"

# ── Dependency builder ─────────────────────────────────────────
build_cross_deps() {
    if [ ${CROSS} = false ]; then return 0; fi

    if [ -f "${DEPS_DIR}/lib/libz.a" ] && [ -f "${DEPS_DIR}/lib/libpng16.a" ] && \
       [ -f "${DEPS_DIR}/lib/libjpeg.a" ] && [ -f "${DEPS_DIR}/lib/libwebp.a" ]; then
        echo "Deps already built for ${TARGET}."
        IMG_CFLAGS="-I${DEPS_DIR}/include"
        IMG_LIBS="-L${DEPS_DIR}/lib -lpng16 -ljpeg -lwebp -lwebpdemux -lwebpdsp -lwebputils -lsharpyuv -lz"
        INCLUDES="${INCLUDES} ${IMG_CFLAGS}"
        return 0
    fi

    echo ""; echo "=== Building static deps for ${TARGET} ==="
    export CC="${ZIG_CC} -fPIC -O3"
    export CXX="${ZIG_CXX} -fPIC -O3"
    export AR="zig ar"; export RANLIB="zig ranlib"; export STRIP="zig strip"
    local CFG="--host=${HOST_TRIPLET} --enable-static --disable-shared --prefix=${DEPS_DIR}"

    # zlib
    if [ ! -f "${DEPS_DIR}/lib/libz.a" ]; then
        echo "--- zlib ---"
        [ ! -f "${DEPS_SRC}/zlib-1.3.1.tar.gz" ] && curl -sL -o "${DEPS_SRC}/zlib-1.3.1.tar.gz" "https://github.com/madler/zlib/archive/refs/tags/v1.3.1.tar.gz"
        tar xzf "${DEPS_SRC}/zlib-1.3.1.tar.gz" -C "${DEPS_BUILD}" 2>/dev/null
        cd "${DEPS_BUILD}/zlib-1.3.1"
        ./configure --static --prefix="${DEPS_DIR}" >/dev/null 2>&1
        make >/dev/null 2>&1 && make install >/dev/null 2>&1
        echo "zlib OK"
    fi

    # libpng
    if [ ! -f "${DEPS_DIR}/lib/libpng16.a" ]; then
        echo "--- libpng ---"
        [ ! -f "${DEPS_SRC}/libpng-1.6.43.tar.gz" ] && curl -sL -o "${DEPS_SRC}/libpng-1.6.43.tar.gz" "https://github.com/pnggroup/libpng/archive/refs/tags/v1.6.43.tar.gz"
        rm -rf "${DEPS_BUILD}/libpng-1.6.43"
        tar xzf "${DEPS_SRC}/libpng-1.6.43.tar.gz" -C "${DEPS_BUILD}" 2>/dev/null
        cd "${DEPS_BUILD}/libpng-1.6.43"
        CPPFLAGS="-I${DEPS_DIR}/include" LDFLAGS="-L${DEPS_DIR}/lib" ./configure ${CFG} >/dev/null 2>&1
        make >/dev/null 2>&1 && make install >/dev/null 2>&1
        echo "libpng OK"
    fi

    # libjpeg
    if [ ! -f "${DEPS_DIR}/lib/libjpeg.a" ]; then
        echo "--- libjpeg ---"
        [ ! -f "${DEPS_SRC}/jpegsrc.v9f.tar.gz" ] && curl -sL -o "${DEPS_SRC}/jpegsrc.v9f.tar.gz" "http://www.ijg.org/files/jpegsrc.v9f.tar.gz"
        rm -rf "${DEPS_BUILD}/jpeg-9f"
        tar xzf "${DEPS_SRC}/jpegsrc.v9f.tar.gz" -C "${DEPS_BUILD}" 2>/dev/null
        cd "${DEPS_BUILD}/jpeg-9f"
        ./configure ${CFG} >/dev/null 2>&1
        make >/dev/null 2>&1
        mkdir -p "${DEPS_DIR}/lib" "${DEPS_DIR}/include" "${DEPS_DIR}/bin" "${DEPS_DIR}/share/man/man1"
        cp .libs/libjpeg.a "${DEPS_DIR}/lib/"
        cp *.h "${DEPS_DIR}/include/"
        echo "libjpeg OK"
    fi

    # libwebp
    if [ ! -f "${DEPS_DIR}/lib/libwebp.a" ]; then
        echo "--- libwebp ---"
        [ ! -f "${DEPS_SRC}/libwebp-1.4.0-release.tar.gz" ] && curl -sL -o "${DEPS_SRC}/libwebp-1.4.0-release.tar.gz" "https://storage.googleapis.com/downloads.webmproject.org/releases/webp/libwebp-1.4.0.tar.gz"
        rm -rf "${DEPS_BUILD}/libwebp-1.4.0"
        tar xzf "${DEPS_SRC}/libwebp-1.4.0-release.tar.gz" -C "${DEPS_BUILD}" 2>/dev/null
        cd "${DEPS_BUILD}/libwebp-1.4.0"
        ./configure ${CFG} --disable-gl --disable-sdl --disable-png --disable-jpeg --disable-tiff --disable-gif --disable-wic >/dev/null 2>&1
        make >/dev/null 2>&1
        cp src/.libs/libwebp.a "${DEPS_DIR}/lib/"
        cp src/demux/.libs/libwebpdemux.a "${DEPS_DIR}/lib/"
        cp src/dec/.libs/libwebpdecode.a "${DEPS_DIR}/lib/"
        cp src/dsp/.libs/libwebpdsp.a "${DEPS_DIR}/lib/" 2>/dev/null || true
        cp src/utils/.libs/libwebputils.a "${DEPS_DIR}/lib/" 2>/dev/null || true
        cp sharpyuv/.libs/libsharpyuv.a "${DEPS_DIR}/lib/" 2>/dev/null || true
        mkdir -p "${DEPS_DIR}/include/webp"
        find src -name "*.h" -exec cp {} "${DEPS_DIR}/include/webp/" \; 2>/dev/null || true
        echo "libwebp OK"
    fi
    echo "=== Deps done for ${TARGET} ==="; echo ""
    IMG_CFLAGS="-I${DEPS_DIR}/include"
    IMG_LIBS="-L${DEPS_DIR}/lib -lpng16 -ljpeg -lwebp -lwebpdemux -lwebpdsp -lwebputils -lsharpyuv -lz"
    INCLUDES="${INCLUDES} ${IMG_CFLAGS}"
}

# ── Main build ─────────────────────────────────────────────────
echo "=== Building for ${TARGET} ==="

if ${CROSS}; then build_cross_deps; else
    IMG_LIBS="-lpng16 -ljpeg -lwebp -lwebpdemux -lz"
fi

CHAFA_FILES=(
    chafa-canvas-config.c chafa-canvas.c chafa-symbol-map.c
    chafa-features.c chafa-util.c chafa-frame.c
    chafa-image.c chafa-placement.c chafa-term-info.c
    chafa-term-db.c chafa-term.c
    chafa-parser.c chafa-stream-reader.c chafa-stream-writer.c
    internal/chafa-batch.c internal/chafa-canvas-printer.c
    internal/chafa-color.c internal/chafa-color-hash.c
    internal/chafa-color-table.c internal/chafa-dither.c
    internal/chafa-indexed-image.c internal/chafa-math-util.c
    internal/chafa-noise.c internal/chafa-palette.c
    internal/chafa-pca.c internal/chafa-pixops.c
    internal/chafa-symbol-renderer.c internal/chafa-symbols.c
    internal/chafa-wakeup.c internal/chafa-work-cell.c
    internal/chafa-string-util.c internal/chafa-byte-fifo.c
    internal/chafa-passthrough-encoder.c internal/chafa-base64.c
    internal/chafa-kitty-renderer.c internal/chafa-iterm2-renderer.c
    internal/chafa-sixel-renderer.c
    internal/smolscale/smolscale.c internal/smolscale/smolscale-generic.c
)

echo "Compiling ${#CHAFA_FILES[@]} chafa modules + codec.c..."
OBJ_FILES=""
for f in "${CHAFA_FILES[@]}"; do
    [ -f "${CHAFA_ORIG}/${f}" ] || { echo "WARN: missing ${f}"; continue; }
    OBJ="${OUTDIR}/$(echo "$f" | tr '/' '_').o"
    ${ZIG_CC} -c ${CFLAGS_COMMON} -DCHAFA_COMPILATION ${INCLUDES} "${CHAFA_ORIG}/${f}" -o "${OBJ}"
    [ -f "${OBJ}" ] && OBJ_FILES="${OBJ_FILES} ${OBJ}"
done

${ZIG_CC} -c ${CFLAGS_COMMON} -DCHAFA_COMPILATION ${INCLUDES} "${SRC_DIR}/codec.c" -o "${OUTDIR}/codec.o"

# Quark helper (provides g_option_error_quark, chafa_term_info_error_quark)
${ZIG_CC} -c ${CFLAGS_COMMON} -DCHAFA_COMPILATION ${INCLUDES} "${VENDOR}/chafa_quarks.c" -o "${OUTDIR}/chafa_quarks.o"

OBJ_FILES="${OUTDIR}/codec.o ${OUTDIR}/chafa_quarks.o ${OBJ_FILES}"

echo "Linking -> ${OUT_SHARED} (${OBJ_FILES}) ..."
${ZIG_CC} -shared \
    ${OBJ_FILES} \
    ${IMG_LIBS} \
    -lm -lpthread \
    -o "${OUTDIR}/${OUT_SHARED}"

echo ""; echo "=== Done: ${OUTDIR}/${OUT_SHARED} ==="
ls -lh "${OUTDIR}/${OUT_SHARED}"

if [ "${TARGET}" = "native" ]; then
    echo "Runtime deps:"
    ldd "${OUTDIR}/${OUT_SHARED}" 2>/dev/null | grep -v "linux-vdso\|ld-linux" || true
fi
