#!/usr/bin/env bash
# build.sh - Build embedded-chafa native library
# Usage (Linux / macOS / Windows via MSYS2, Git Bash or WSL):
#   ./build.sh dev                        -> codec.so for Bun FFI (dev/test)
#   ./build.sh                            -> static_chafa.node for NAPI (npm)
#   ./build.sh x86_64-linux [napi]        -> cross-compile FFI lib or NAPI .node
#   ./build.sh aarch64-linux [napi]       -> cross-compile
#   ./build.sh x86_64-windows [napi]      -> cross-compile
#   ./build.sh aarch64-macos [napi]       -> cross-compile
#
# Everything this script needs is fetched automatically on first use
# (zig toolchain, chafa sources, image-library deps). Only curl (or wget)
# and a POSIX shell are assumed to be present.
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
DEPS_SRC="${SRC_DIR}/deps_src"
TOOLS_DIR="${SRC_DIR}/deps/tools"
VENDOR="${SRC_DIR}/vendor/chafa"
mkdir -p "${DEPS_SRC}" "${TOOLS_DIR}"

# -- Preflight: host OS + arch --
HOST_OS="$(uname -s 2>/dev/null || echo Windows)"
HOST_ARCH="$(uname -m 2>/dev/null || echo x86_64)"
case "${HOST_OS}" in
    MINGW*|MSYS*|CYGWIN*) OS_WINDOWS=true ;;
    *) OS_WINDOWS=false ;;
esac
case "${HOST_ARCH}" in
    aarch64|arm64) ZIG_ARCH="aarch64" ;;
    *) ZIG_ARCH="x86_64" ;;
esac
echo "Host: ${HOST_OS} ${HOST_ARCH}"

# -- fetch helper (curl preferred, wget fallback) --
fetch_url() {
    if command -v curl >/dev/null 2>&1; then curl -fsSL -o "$2" "$1"
    elif command -v wget >/dev/null 2>&1; then wget -q -O "$2" "$1"
    else echo "ERROR: need curl or wget to download: $1" >&2; exit 1; fi
}

# -- Zig: find on system, else fetch a pinned release --
ZIG_VERSION="${ZIG_VERSION:-0.16.0}"
find_zig() {
    local d zd zbin
    if command -v zig >/dev/null 2>&1; then echo "zig: $(command -v zig)"; return 0; fi
    for d in "/c/Users/jay/zig" "${HOME}/zig" "${HOME}/.local/zig" "${TOOLS_DIR}"; do
        for zd in "${d}"/*/; do
            [ -d "${zd}" ] || continue
            for zbin in "${zd}zig" "${zd}zig.exe" "${zd}bin/zig" "${zd}bin/zig.exe"; do
                if [ -x "${zbin}" ]; then
                    export PATH="$(dirname "${zbin}"):${PATH}"
                    echo "zig: ${zbin}"
                    return 0
                fi
            done
        done
    done
    return 1
}

if ! find_zig; then
    case "${HOST_OS}" in
        MINGW*|MSYS*|CYGWIN*) ZIG_ARCHIVE="zig-x86_64-windows-${ZIG_VERSION}.zip" ;;
        Darwin)               ZIG_ARCHIVE="zig-${ZIG_ARCH}-macos-${ZIG_VERSION}.tar.xz" ;;
        *)                    ZIG_ARCHIVE="zig-${ZIG_ARCH}-linux-${ZIG_VERSION}.tar.xz" ;;
    esac
    ZIG_URL="https://ziglang.org/download/${ZIG_VERSION}/${ZIG_ARCHIVE}"
    echo "zig not found - downloading ${ZIG_URL}"
    fetch_url "${ZIG_URL}" "${TOOLS_DIR}/${ZIG_ARCHIVE}"
    echo "Extracting zig..."
    case "${ZIG_ARCHIVE}" in
        *.zip)
            if command -v unzip >/dev/null 2>&1; then
                unzip -o "${TOOLS_DIR}/${ZIG_ARCHIVE}" -d "${TOOLS_DIR}"
            elif [ -f "${SYSTEMROOT:-C:\Windows}/System32/tar.exe" ]; then
                "${SYSTEMROOT:-C:\Windows}/System32/tar.exe" -xf "${TOOLS_DIR}/${ZIG_ARCHIVE}" -C "${TOOLS_DIR}"
            else
                tar -xf "${TOOLS_DIR}/${ZIG_ARCHIVE}" -C "${TOOLS_DIR}"
            fi
            ;;
        *) tar -xf "${TOOLS_DIR}/${ZIG_ARCHIVE}" -C "${TOOLS_DIR}" ;;
    esac
    find_zig || { echo "ERROR: failed to extract zig from ${ZIG_ARCHIVE}" >&2; exit 1; }
fi

# -- Chafa source: env var or default to ./chafa-git --
CHAFA_ORIG="${CHAFA_SRC:-${SRC_DIR}/chafa-git}"
if [ ! -d "${CHAFA_ORIG}" ]; then
    echo "Chafa source not found at ${CHAFA_ORIG} - downloading..."
    fetch_url "https://github.com/hpjansson/chafa/archive/refs/heads/master.tar.gz" \
        "${DEPS_SRC}/chafa-master.tar.gz"
    mkdir -p "${CHAFA_ORIG}"
    tar xzf "${DEPS_SRC}/chafa-master.tar.gz" --strip-components=1 -C "${CHAFA_ORIG}"
fi
# chafa source files live in a chafa/ subdirectory inside the repo
if [ -d "${CHAFA_ORIG}/chafa" ]; then
    CHAFA_ORIG="${CHAFA_ORIG}/chafa"
fi
NPROC=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)
export MAKEFLAGS="-j${NPROC}"

# -- Target config --
case "${TARGET}" in
    native)
        if [ "$(uname -s)" = "Darwin" ]; then
            ZIG_CC="zig cc -target aarch64-macos -isysroot $(xcrun --show-sdk-path)"
            ZIG_CXX="zig c++ -target aarch64-macos -isysroot $(xcrun --show-sdk-path)"
        else
            ZIG_CC="zig cc"; ZIG_CXX="zig c++"
        fi
        HOST_TRIPLET=""; ZIG_TARGET=""
        if ${OS_WINDOWS}; then
            SHARED_EXT="dll"; CROSS=false; PLAT_PKG="win32-x64"
        else
            case "${HOST_OS}" in
                Darwin) SHARED_EXT="dylib"; CROSS=false; PLAT_PKG="darwin-arm64" ;;
                *) SHARED_EXT="so"; CROSS=false; PLAT_PKG="linux-x64" ;;
            esac
        fi
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
    native)  if ${OS_WINDOWS}; then ENABLE_POPCNT=true; \
             else ENABLE_POPCNT=$(grep -qc popcnt /proc/cpuinfo 2>/dev/null && echo true || echo false); fi ;;
    x86_64-linux|x86_64-windows) ENABLE_POPCNT=true ;;
    *) ENABLE_POPCNT=false ;;
esac

if ${OS_WINDOWS} && [ "${TARGET}" = "native" ]; then
    DEPS_DIR="${SRC_DIR}/deps/x86_64-windows"
else
    DEPS_DIR="${SRC_DIR}/deps/${TARGET}"
fi
DEPS_BUILD="/tmp/chafa_deps_build/${TARGET}"
OUTDIR="${SRC_DIR}/out/${TARGET}"
mkdir -p "${DEPS_DIR}/lib" "${DEPS_DIR}/include" "${DEPS_BUILD}" "${OUTDIR}" "${DEPS_SRC}"

# ── Flags ──
# -g0: zig cc emits DWARF by default; the ELF linker keeps it (linux .node
# balloons to ~4.5MB) while Mach-O/PE linkers drop it. Strip at the source.
# Set DEBUG=1 for a debug build.
CFLAGS="-O3 -g0 -fPIC -ffunction-sections -fdata-sections \
  -Wno-unused-parameter -Wno-unused-function -Wno-sign-compare \
  -Wno-missing-field-initializers -Wno-unused-but-set-variable \
  -Wno-cast-qual -Wno-format-security -Wno-deprecated-declarations \
  -Wno-pointer-sign -Wno-incompatible-pointer-types"
# macOS as build host requires extra handling
[ "${TARGET}" = "native" ] && [ "$(uname -s)" = "Darwin" ] && CFLAGS="${CFLAGS} -isysroot $(xcrun --show-sdk-path)"

[ "${DEBUG:-0}" = "1" ] && CFLAGS="${CFLAGS/-g0/-g}"

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

# -- Deps (bundled static image libs for the target) --

# When cross-compiling to a mingw host, autotools' libtool assumes any
# non-cl compiler is MSVC and emits `lib -OUT:$oldlib$oldobjs$old_deplibs`
# archive commands. `lib` doesn't exist outside Windows (so the build dies
# with "lib: command not found" on macOS/Linux). Replace it with GNU ar and
# restore the .a extension so the static archives build on any host.
patch_mingw_libtool() {
    [ -f libtool ] || return 0
    sed -i.bak \
        -e 's|^old_archive_cmds="lib -OUT:\\$oldlib\\$oldobjs\\$old_deplibs"$|old_archive_cmds="zig ar rcs \\$oldlib \\$oldobjs"|' \
        -e 's/^libext=lib$/libext=a/' \
        libtool
}

build_cross_deps() {
    if [ -f "${DEPS_DIR}/lib/libz.a" ] && [ -f "${DEPS_DIR}/lib/libpng16.a" ] && \
       [ -f "${DEPS_DIR}/lib/libjpeg.a" ] && [ -f "${DEPS_DIR}/lib/libwebp.a" ]; then
        echo "Deps already built for ${TARGET}."
        INCLUDES="${INCLUDES} -I${DEPS_DIR}/include"
        IMG_LIBS="-L${DEPS_DIR}/lib -lpng16 -ljpeg -lwebp -lwebpdemux -lwebpdsp -lwebputils -lsharpyuv -lz"
        return 0
    fi
    echo ""; echo "=== Building static deps for ${TARGET} ==="

    if ! command -v make >/dev/null 2>&1; then
        echo "ERROR: 'make' is required to build the bundled deps." >&2
        case "${HOST_OS}" in
            Darwin) echo "On macOS install the command line tools: xcode-select --install" >&2 ;;
        esac
        exit 1
    fi
    export CC="${ZIG_CC} -fPIC -O3 -g0"; export CXX="${ZIG_CXX} -fPIC -O3 -g0"
    export AR="zig ar"; export RANLIB="zig ranlib"; export STRIP="zig strip"
    local CFG="--enable-static --disable-shared --prefix=${DEPS_DIR}"
    [ -n "${HOST_TRIPLET}" ] && CFG="--host=${HOST_TRIPLET} ${CFG}"
    case "${HOST_TRIPLET}" in *mingw*) PATCH_MINGW=true ;; *) PATCH_MINGW=false ;; esac

    if [ ! -f "${DEPS_DIR}/lib/libz.a" ]; then
        echo "--- zlib ---"
        [ ! -f "${DEPS_SRC}/zlib-1.3.1.tar.gz" ] && fetch_url "https://github.com/madler/zlib/archive/refs/tags/v1.3.1.tar.gz" "${DEPS_SRC}/zlib-1.3.1.tar.gz"
        tar xzf "${DEPS_SRC}/zlib-1.3.1.tar.gz" -C "${DEPS_BUILD}"
        cd "${DEPS_BUILD}/zlib-1.3.1"

        CC="${ZIG_CC} -fPIC -O3 -g0" \
        AR="zig ar" \
        RANLIB="zig ranlib" \
        ./configure --static --prefix="${DEPS_DIR}"

        # Patch makefile to use zig ar instead of system ar, and to use 'rcs' flags for ar
        # fixes cross-comp on macos (where it wouldve used system libtool which ofc wouldnt work because cross comp doesnt emit mach-o objects)
        sed -i.bak 's/^AR *=.*/AR = zig ar/' Makefile
        sed -i.bak 's/^ARFLAGS *=.*/ARFLAGS = rcs/' Makefile
        make libz.a
        make install

        echo "zlib OK"
    fi
    if [ ! -f "${DEPS_DIR}/lib/libpng16.a" ]; then
        echo "--- libpng ---"
        [ ! -f "${DEPS_SRC}/libpng-1.6.43.tar.gz" ] && fetch_url "https://github.com/pnggroup/libpng/archive/refs/tags/v1.6.43.tar.gz" "${DEPS_SRC}/libpng-1.6.43.tar.gz"
        rm -rf "${DEPS_BUILD}/libpng-1.6.43"; tar xzf "${DEPS_SRC}/libpng-1.6.43.tar.gz" -C "${DEPS_BUILD}"
        cd "${DEPS_BUILD}/libpng-1.6.43"
        CPPFLAGS="-I${DEPS_DIR}/include" LDFLAGS="-L${DEPS_DIR}/lib" ./configure ${CFG}
        ${PATCH_MINGW} && patch_mingw_libtool
        
        # Patch makefile to use zig ar instead of system ar, and to use 'rcs' flags for ar
        # fixes cross-comp on macos (where it wouldve used system libtool which ofc wouldnt work because cross comp doesnt emit mach-o objects)
        sed -i.bak 's/^AR *=.*/AR = zig ar/' Makefile
        sed -i.bak 's/^ARFLAGS *=.*/ARFLAGS = rcs/' Makefile

        make && make install; echo "libpng OK"
    fi
    if [ ! -f "${DEPS_DIR}/lib/libjpeg.a" ]; then
        echo "--- libjpeg ---"
        [ ! -f "${DEPS_SRC}/jpegsrc.v9f.tar.gz" ] && fetch_url "http://www.ijg.org/files/jpegsrc.v9f.tar.gz" "${DEPS_SRC}/jpegsrc.v9f.tar.gz"
        rm -rf "${DEPS_BUILD}/jpeg-9f"; tar xzf "${DEPS_SRC}/jpegsrc.v9f.tar.gz" -C "${DEPS_BUILD}"
        cd "${DEPS_BUILD}/jpeg-9f"
        ./configure ${CFG}
        ${PATCH_MINGW} && patch_mingw_libtool
        
        # Patch makefile to use zig ar instead of system ar, and to use 'rcs' flags for ar
        # fixes cross-comp on macos (where it wouldve used system libtool which ofc wouldnt work because cross comp doesnt emit mach-o objects)
        sed -i.bak 's/^AR *=.*/AR = zig ar/' Makefile
        sed -i.bak 's/^ARFLAGS *=.*/ARFLAGS = rcs/' Makefile

        make
        mkdir -p "${DEPS_DIR}/lib" "${DEPS_DIR}/include" "${DEPS_DIR}/bin" "${DEPS_DIR}/share/man/man1"
        cp .libs/libjpeg.a "${DEPS_DIR}/lib/"; cp *.h "${DEPS_DIR}/include/"; echo "libjpeg OK"
    fi
    if [ ! -f "${DEPS_DIR}/lib/libwebp.a" ]; then
        echo "--- libwebp ---"
        [ ! -f "${DEPS_SRC}/libwebp-1.4.0-release.tar.gz" ] && fetch_url "https://storage.googleapis.com/downloads.webmproject.org/releases/webp/libwebp-1.4.0.tar.gz" "${DEPS_SRC}/libwebp-1.4.0-release.tar.gz"
        rm -rf "${DEPS_BUILD}/libwebp-1.4.0"; tar xzf "${DEPS_SRC}/libwebp-1.4.0-release.tar.gz" -C "${DEPS_BUILD}"
        cd "${DEPS_BUILD}/libwebp-1.4.0"
        ./configure ${CFG} --disable-gl --disable-sdl --disable-png --disable-jpeg --disable-tiff --disable-gif --disable-wic
        ${PATCH_MINGW} && patch_mingw_libtool
        
        # Patch makefile to use zig ar instead of system ar, and to use 'rcs' flags for ar
        # fixes cross-comp on macos (where it wouldve used system libtool which ofc wouldnt work because cross comp doesnt emit mach-o objects)
        sed -i.bak 's/^AR *=.*/AR = zig ar/' Makefile
        sed -i.bak 's/^ARFLAGS *=.*/ARFLAGS = rcs/' Makefile

        make
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

# -- Build --
echo "=== Building ${MODE} for ${TARGET} ==="

if ${CROSS}; then
    build_cross_deps
elif ${OS_WINDOWS}; then
    # native Windows: bundled static libs (build them if missing)
    if [ ! -f "${DEPS_DIR}/lib/libpng16.a" ]; then
        echo "Bundled deps missing - building them for ${TARGET}..."
        build_cross_deps
    else
        INCLUDES="${INCLUDES} -I${DEPS_DIR}/include"
        IMG_LIBS="-L${DEPS_DIR}/lib -lpng16 -ljpeg -lwebp -lwebpdemux -lwebpdsp -lwebputils -lsharpyuv -lz"
    fi
else
    # native unix: system image libs if present, else bundled
    if printf '#include <zlib.h>\n#include <png.h>\n#include <jpeglib.h>\n#include <webp/decode.h>\n#include <webp/demux.h>\n' | ${ZIG_CC} -E -x c - >/dev/null 2>&1; then
        IMG_LIBS="-lpng16 -ljpeg -lwebp -lwebpdemux -lz"
    else
        echo "System image headers not found - using bundled deps..."
        if [ ! -f "${DEPS_DIR}/lib/libpng16.a" ]; then
            build_cross_deps
        else
            INCLUDES="${INCLUDES} -I${DEPS_DIR}/include"
            IMG_LIBS="-L${DEPS_DIR}/lib -lpng16 -ljpeg -lwebp -lwebpdemux -lwebpdsp -lwebputils -lsharpyuv -lz"
        fi
    fi
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
        elif [ "${TARGET}" != "x86_64-windows" ]; then
            LINK_FLAGS="${LINK_FLAGS} -Wl,--allow-shlib-undefined"
        fi
        IMG_LIBS="${IMG_LIBS} -lpthread"
    elif ${OS_WINDOWS}; then
        IMG_LIBS="${IMG_LIBS} -lpthread"
    else
        LINK_FLAGS="${LINK_FLAGS} -Wl,--allow-shlib-undefined"
        IMG_LIBS="${IMG_LIBS} -lm -lpthread"
    fi
    OUT_FILE="${SRC_DIR}/platforms/${PLAT_PKG}/static_chafa.node"
    mkdir -p "$(dirname "${OUT_FILE}")"
else
    if ${OS_WINDOWS}; then IMG_LIBS="${IMG_LIBS} -lpthread"; else IMG_LIBS="${IMG_LIBS} -lm -lpthread"; fi
    OUT_FILE="${SRC_DIR}/codec.so"
fi

# Windows NAPI needs no napi import lib: addon.c resolves napi_* at runtime
# from the host process (GetProcAddress), so the PE has no napi imports.

echo "Linking -> ${OUT_FILE}..."
${ZIG_CC} ${LINK_FLAGS} ${LINK_EXTRA} ${OBJ_FILES} ${IMG_LIBS} -o "${OUT_FILE}"

echo ""; echo "=== Done: ${OUT_FILE} ($(ls -lh "${OUT_FILE}" | awk '{print $5}')) ==="

if [ "${TARGET}" = "native" ] && ! ${OS_WINDOWS}; then
    ldd "${OUT_FILE}" 2>/dev/null | grep -v "linux-vdso\|ld-linux" || true
fi
