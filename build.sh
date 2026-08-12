#!/usr/bin/env bash
# build.sh - Build embedded-chafa native library
# Usage:
#   ./build.sh dev                        -> codec.so for Bun FFI (dev/test)
#   ./build.sh                            -> static_chafa.node for NAPI (npm)
#   ./build.sh x86_64-linux [napi]        -> cross-compile FFI lib or NAPI .node
#   ./build.sh aarch64-linux [napi]       -> cross-compile
#   ./build.sh x86_64-windows [napi]      -> cross-compile
#   ./build.sh aarch64-macos [napi]       -> cross-compile
set -euo pipefail

MODE="ffi"
TARGET="native"

for arg in "$@"; do
    case "$arg" in
        dev) MODE="ffi" ;;
        napi|node) MODE="napi" ;;
        native|x86_64-linux|aarch64-linux|x86_64-windows|aarch64-macos) TARGET="$arg" ;;
    esac
done

SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

# If zig not in PATH, try common locations
if ! command -v zig >/dev/null 2>&1; then
    for d in "/c/Users/jay/zig"/*/; do
        [ -x "$d/zig" ] && { export PATH="$d:$PATH"; break; }
    done
fi

# ── Chafa source: env var or default to ./chafa-git ──
CHAFA_ORIG="${CHAFA_SRC:-${SRC_DIR}/chafa-git}"
if [ ! -d "${CHAFA_ORIG}" ]; then
    echo "Chafa source not found at ${CHAFA_ORIG}"
    echo "Cloning from https://github.com/hpjansson/chafa ..."
    git clone https://github.com/hpjansson/chafa.git "${CHAFA_ORIG}" --depth 1
    rm -rf "${CHAFA_ORIG}/.git"
    echo "Cloned to ${CHAFA_ORIG}"
fi
# chafa source files live in a chafa/ subdirectory inside the repo
if [ -d "${CHAFA_ORIG}/chafa" ]; then
    CHAFA_ORIG="${CHAFA_ORIG}/chafa"
fi
DEPS_SRC="${SRC_DIR}/deps_src"
VENDOR="${SRC_DIR}/vendor/chafa"
export MAKEFLAGS="-j$(nproc)"

# ── Target config ──
case "${TARGET}" in
    native)
        ZIG_CC="zig cc"; ZIG_CXX="zig c++"
        HOST_TRIPLET=""; ZIG_TARGET=""
        SHARED_EXT="so"; CROSS=false
        PLAT_PKG="linux-x64"
        ;;
    x86_64-linux)
        ZIG_CC="zig cc -target x86_64-linux-gnu"; ZIG_CXX="zig c++ -target x86_64-linux-gnu"
        HOST_TRIPLET="x86_64-linux-gnu"
        SHARED_EXT="so"; CROSS=true; PLAT_PKG="linux-x64"
        ;;
    aarch64-linux)
        ZIG_CC="zig cc -target aarch64-linux-gnu"; ZIG_CXX="zig c++ -target aarch64-linux-gnu"
        HOST_TRIPLET="aarch64-linux-gnu"
        SHARED_EXT="so"; CROSS=true; PLAT_PKG="linux-arm64"
        ;;
    x86_64-windows)
        ZIG_CC="zig cc -target x86_64-windows-gnu"; ZIG_CXX="zig c++ -target x86_64-windows-gnu"
        HOST_TRIPLET="x86_64-w64-mingw32"
        SHARED_EXT="dll"; CROSS=true; PLAT_PKG="win32-x64"
        ;;
    aarch64-macos)
        ZIG_CC="zig cc -target aarch64-macos-none"; ZIG_CXX="zig c++ -target aarch64-macos-none"
        HOST_TRIPLET="aarch64-apple-darwin"
        SHARED_EXT="dylib"; CROSS=true; PLAT_PKG="darwin-arm64"
        ;;
    *) echo "Unknown: ${TARGET}"; exit 1 ;;
esac

# POPCNT: available on all x86_64 CPUs since ~2008 - safe default for x64 targets
case "${TARGET}" in
    native)  ENABLE_POPCNT=$(grep -qc popcnt /proc/cpuinfo 2>/dev/null && echo true || echo false) ;;
    x86_64-linux|x86_64-windows) ENABLE_POPCNT=true ;;
    *) ENABLE_POPCNT=false ;;
esac

DEPS_DIR="${SRC_DIR}/deps/${TARGET}"
DEPS_BUILD="/tmp/chafa_deps_build/${TARGET}"
OUTDIR="${SRC_DIR}/out/${TARGET}"
mkdir -p "${DEPS_DIR}/lib" "${DEPS_DIR}/include" "${DEPS_BUILD}" "${OUTDIR}" "${DEPS_SRC}"

# ── Flags ──
CFLAGS="-O3 -fPIC -ffunction-sections -fdata-sections \
  -Wno-unused-parameter -Wno-unused-function -Wno-sign-compare \
  -Wno-missing-field-initializers -Wno-unused-but-set-variable \
  -Wno-cast-qual -Wno-format-security -Wno-deprecated-declarations \
  -Wno-pointer-sign -Wno-incompatible-pointer-types"

INCLUDES="-I${VENDOR} -I${SRC_DIR}/vendor/ffmpeg -I${CHAFA_ORIG} -I${CHAFA_ORIG}/internal -I${CHAFA_ORIG}/internal/smolscale"

if [ "$MODE" = "napi" ]; then
    INCLUDES="${INCLUDES} -I${SRC_DIR}/src -I${SRC_DIR}/vendor/napi"
    CFLAGS="${CFLAGS} -DBUILDING_NODE_EXTENSION -DNAPI_VERSION=9 -DNODE_GYP_MODULE_NAME=static_chafa"
fi

if ${ENABLE_POPCNT}; then
    CFLAGS="${CFLAGS} -DHAVE_POPCNT64_INTRINSICS"
    echo "POPCNT: enabled"
else
    echo "POPCNT: disabled"
fi

# ── Deps (cross-compile only, unless MSYS2 detected) ──
build_cross_deps() {
    if [ ${CROSS} = false ]; then return 0; fi
    if [ -f "${DEPS_DIR}/lib/libz.a" ] && [ -f "${DEPS_DIR}/lib/libpng16.a" ] && \
       [ -f "${DEPS_DIR}/lib/libjpeg.a" ] && [ -f "${DEPS_DIR}/lib/libwebp.a" ]; then
        echo "Deps already built for ${TARGET}."
        INCLUDES="${INCLUDES} -I${DEPS_DIR}/include"
        IMG_LIBS="-L${DEPS_DIR}/lib -lpng16 -ljpeg -lwebp -lwebpdemux -lwebpdsp -lwebputils -lsharpyuv -lz"
        return 0
    fi
    echo ""; echo "=== Building static deps for ${TARGET} ==="
    export CC="${ZIG_CC} -fPIC -O3"; export CXX="${ZIG_CXX} -fPIC -O3"
    export AR="zig ar"; export RANLIB="zig ranlib"; export STRIP="zig strip"
    local CFG="--host=${HOST_TRIPLET} --enable-static --disable-shared --prefix=${DEPS_DIR}"

    if [ ! -f "${DEPS_DIR}/lib/libz.a" ]; then
        echo "--- zlib ---"
        [ ! -f "${DEPS_SRC}/zlib-1.3.1.tar.gz" ] && curl -sL -o "${DEPS_SRC}/zlib-1.3.1.tar.gz" "https://github.com/madler/zlib/archive/refs/tags/v1.3.1.tar.gz"
        tar xzf "${DEPS_SRC}/zlib-1.3.1.tar.gz" -C "${DEPS_BUILD}" 2>/dev/null
        cd "${DEPS_BUILD}/zlib-1.3.1"; ./configure --static --prefix="${DEPS_DIR}" >/dev/null 2>&1
        make >/dev/null 2>&1 && make install >/dev/null 2>&1; echo "zlib OK"
    fi
    if [ ! -f "${DEPS_DIR}/lib/libpng16.a" ]; then
        echo "--- libpng ---"
        [ ! -f "${DEPS_SRC}/libpng-1.6.43.tar.gz" ] && curl -sL -o "${DEPS_SRC}/libpng-1.6.43.tar.gz" "https://github.com/pnggroup/libpng/archive/refs/tags/v1.6.43.tar.gz"
        rm -rf "${DEPS_BUILD}/libpng-1.6.43"; tar xzf "${DEPS_SRC}/libpng-1.6.43.tar.gz" -C "${DEPS_BUILD}" 2>/dev/null
        cd "${DEPS_BUILD}/libpng-1.6.43"
        CPPFLAGS="-I${DEPS_DIR}/include" LDFLAGS="-L${DEPS_DIR}/lib" ./configure ${CFG} >/dev/null 2>&1
        make >/dev/null 2>&1 && make install >/dev/null 2>&1; echo "libpng OK"
    fi
    if [ ! -f "${DEPS_DIR}/lib/libjpeg.a" ]; then
        echo "--- libjpeg ---"
        [ ! -f "${DEPS_SRC}/jpegsrc.v9f.tar.gz" ] && curl -sL -o "${DEPS_SRC}/jpegsrc.v9f.tar.gz" "http://www.ijg.org/files/jpegsrc.v9f.tar.gz"
        rm -rf "${DEPS_BUILD}/jpeg-9f"; tar xzf "${DEPS_SRC}/jpegsrc.v9f.tar.gz" -C "${DEPS_BUILD}" 2>/dev/null
        cd "${DEPS_BUILD}/jpeg-9f"; ./configure ${CFG} >/dev/null 2>&1; make >/dev/null 2>&1
        mkdir -p "${DEPS_DIR}/lib" "${DEPS_DIR}/include" "${DEPS_DIR}/bin" "${DEPS_DIR}/share/man/man1"
        cp .libs/libjpeg.a "${DEPS_DIR}/lib/"; cp *.h "${DEPS_DIR}/include/"; echo "libjpeg OK"
    fi
    if [ ! -f "${DEPS_DIR}/lib/libwebp.a" ]; then
        echo "--- libwebp ---"
        [ ! -f "${DEPS_SRC}/libwebp-1.4.0-release.tar.gz" ] && curl -sL -o "${DEPS_SRC}/libwebp-1.4.0-release.tar.gz" "https://storage.googleapis.com/downloads.webmproject.org/releases/webp/libwebp-1.4.0.tar.gz"
        rm -rf "${DEPS_BUILD}/libwebp-1.4.0"; tar xzf "${DEPS_SRC}/libwebp-1.4.0-release.tar.gz" -C "${DEPS_BUILD}" 2>/dev/null
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
        find src -name "*.h" -exec cp {} "${DEPS_DIR}/include/webp/" \; 2>/dev/null || true; echo "libwebp OK"
    fi
    INCLUDES="${INCLUDES} -I${DEPS_DIR}/include"
    IMG_LIBS="-L${DEPS_DIR}/lib -lpng16 -ljpeg -lwebp -lwebpdemux -lwebpdsp -lwebputils -lsharpyuv -lz"
}

# ── Build ──
echo "=== Building ${MODE} for ${TARGET} ==="

if ${CROSS}; then build_cross_deps; else IMG_LIBS="-lpng16 -ljpeg -lwebp -lwebpdemux -lz"; fi

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

echo "Compiling ${#CHAFA_FILES[@]} chafa modules..."
OBJ_FILES=""
for f in "${CHAFA_FILES[@]}"; do
    [ -f "${CHAFA_ORIG}/${f}" ] || { echo "WARN: missing ${f}"; continue; }
    OBJ="${OUTDIR}/$(echo "$f" | tr '/' '_').o"
    ${ZIG_CC} -c ${CFLAGS} -DCHAFA_COMPILATION ${INCLUDES} "${CHAFA_ORIG}/${f}" -o "${OBJ}"
    OBJ_FILES="${OBJ_FILES} ${OBJ}"
done

# codec.c
${ZIG_CC} -c ${CFLAGS} -DCHAFA_COMPILATION ${INCLUDES} "${SRC_DIR}/src/codec.c" -o "${OUTDIR}/codec.o"
OBJ_FILES="${OUTDIR}/codec.o ${OBJ_FILES}"

# codec_video.c (FFmpeg - dlopen at runtime, headers vendored for all targets)
${ZIG_CC} -c ${CFLAGS} -DCHAFA_COMPILATION ${INCLUDES} "${SRC_DIR}/src/codec_video.c" -o "${OUTDIR}/codec_video.o"
OBJ_FILES="${OUTDIR}/codec_video.o ${OBJ_FILES}"

# quarks
${ZIG_CC} -c ${CFLAGS} -DCHAFA_COMPILATION ${INCLUDES} "${VENDOR}/chafa_quarks.c" -o "${OUTDIR}/quarks.o"
OBJ_FILES="${OUTDIR}/quarks.o ${OBJ_FILES}"

# POPCNT (compiled with -mpopcnt; only for x64 targets)
if ${ENABLE_POPCNT}; then
    ${ZIG_CC} -c ${CFLAGS} -DCHAFA_COMPILATION -mpopcnt ${INCLUDES} \
        "${CHAFA_ORIG}/internal/chafa-popcnt.c" -o "${OUTDIR}/chafa-popcnt.o"
    OBJ_FILES="${OUTDIR}/chafa-popcnt.o ${OBJ_FILES}"
fi

# NAPI addon (only for napi mode)
LINK_FLAGS="-shared"
LINK_EXTRA="${LINK_EXTRA:-}"
if [ "$MODE" = "napi" ]; then
    echo "Compiling addon.c (NAPI)..."
    ${ZIG_CC} -c ${CFLAGS} ${INCLUDES} "${SRC_DIR}/src/addon.c" -o "${OUTDIR}/addon.o"
    OBJ_FILES="${OUTDIR}/addon.o ${OBJ_FILES}"

    if ${CROSS}; then
        if [ "${TARGET}" = "aarch64-macos" ]; then
            LINK_FLAGS="${LINK_FLAGS} -undefined dynamic_lookup"
        else
            LINK_FLAGS="${LINK_FLAGS} -Wl,--allow-shlib-undefined"
        fi
        IMG_LIBS="${IMG_LIBS} -lpthread"
    else
        LINK_FLAGS="${LINK_FLAGS} -Wl,--allow-shlib-undefined"
        IMG_LIBS="${IMG_LIBS} -lm -lpthread"
    fi
    OUT_FILE="${SRC_DIR}/platforms/${PLAT_PKG}/static_chafa.node"
    mkdir -p "$(dirname "${OUT_FILE}")"
else
    IMG_LIBS="${IMG_LIBS} -lm -lpthread"
    OUT_FILE="${SRC_DIR}/codec.so"
fi

# For Windows .node builds, generate import lib from napi.def
# to avoid weak-undefined IAT entries that crash on Windows Insider builds
if [ "$MODE" = "napi" ] && [ "${PLAT_PKG}" = "win32-x64" ]; then
    echo "Generating napi import lib for Windows..."
    NAPI_LIB_DIR="${OUTDIR}/napi_lib"
    mkdir -p "${NAPI_LIB_DIR}"
    if [ -f "${SRC_DIR}/napi.def" ]; then
        dlltool -d "${SRC_DIR}/napi.def" -l "${NAPI_LIB_DIR}/libnapi.a" 2>/dev/null || true
        if [ -f "${NAPI_LIB_DIR}/libnapi.a" ]; then
            LINK_FLAGS="${LINK_FLAGS/-Wl,--allow-shlib-undefined/}"
            IMG_LIBS="${IMG_LIBS} -L${NAPI_LIB_DIR} -lnapi"
        fi
    fi
fi

echo "Linking -> ${OUT_FILE}..."
${ZIG_CC} ${LINK_FLAGS} ${LINK_EXTRA} ${OBJ_FILES} ${IMG_LIBS} -o "${OUT_FILE}"

echo ""; echo "=== Done: ${OUT_FILE} ($(ls -lh "${OUT_FILE}" | awk '{print $5}')) ==="

if [ "${TARGET}" = "native" ]; then
    ldd "${OUT_FILE}" 2>/dev/null | grep -v "linux-vdso\|ld-linux" || true
fi
