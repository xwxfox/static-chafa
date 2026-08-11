#!/usr/bin/env bash
# build-platforms.sh — Cross-compile .node NAPI addons for all platforms
# Requires: zig, bash, curl, tar
set -euo pipefail

SRC_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
PKG_DIR="${SRC_DIR}/pkg/static-chafa"
PLAT_DIR="${SRC_DIR}/pkg/platforms"
CHAFA_ORIG="/tmp/chafa_src/chafa"
NODE_INCLUDE="${PKG_DIR}/native/node"

CFLAGS_BASE="-O3 -fPIC -ffunction-sections -fdata-sections -DNAPI_VERSION=9 -DCHAFA_COMPILATION -DNODE_GYP_MODULE_NAME=static_chafa"
CFLAGS_WARN="-Wno-unused-parameter -Wno-unused-function -Wno-sign-compare -Wno-missing-field-initializers -Wno-unused-but-set-variable -Wno-cast-qual -Wno-format-security -Wno-deprecated-declarations -Wno-pointer-sign -Wno-incompatible-pointer-types"

GLIB_INCLUDES="-I${SRC_DIR}/chafa_vendor"
CHAFA_INCLUDES="-I${CHAFA_ORIG} -I${CHAFA_ORIG}/internal -I${CHAFA_ORIG}/internal/smolscale"
NODE_INCLUDES="-I${PKG_DIR} -I${NODE_INCLUDE}"

ANDROID_CFLAGS="${CFLAGS_BASE} ${CFLAGS_WARN} ${GLIB_INCLUDES} ${CHAFA_INCLUDES} ${NODE_INCLUDES}"

export MAKEFLAGS="-j$(nproc)"

build_native() {
    echo "=== Building native .node ==="
    local OUT="${PLAT_DIR}/linux-x64"
    mkdir -p "${OUT}"

    # Compile addon.c
    zig cc -c ${CFLAGS_BASE} -fPIC ${GLIB_INCLUDES} ${CHAFA_INCLUDES} ${NODE_INCLUDES} \
        "${PKG_DIR}/addon.c" -o "${OUT}/addon.o"

    # Collect all chafa + codec .o files from native build
    local NDIR="${SRC_DIR}/out/native"
    if [ ! -d "${NDIR}" ]; then
        echo "Need native build first — building..."
        cd "${SRC_DIR}" && bash build.sh native >/dev/null 2>&1
    fi

    local OBJS="${OUT}/addon.o ${NDIR}/codec.o ${NDIR}/chafa_quarks.o"
    for f in "${NDIR}"/*.o; do
        [[ "$f" == */codec.o ]] && continue
        [[ "$f" == */chafa_quarks.o ]] && continue
        OBJS="$OBJS $f"
    done

    zig cc -shared -Wl,--allow-shlib-undefined ${OBJS} \
        -lpng16 -ljpeg -lwebp -lwebpdemux -lz -lm -lpthread \
        -o "${OUT}/static_chafa.node"

    echo "  → ${OUT}/static_chafa.node ($(ls -lh "${OUT}/static_chafa.node" | awk '{print $5}'))"
}

build_cross() {
    local TARGET="$1"
    local ZIG_TARGET="$2"
    local PLAT_NAME="$3"
    local ZIG_LINK_FLAGS="$4"

    echo "=== Building ${PLAT_NAME} .node ==="
    local OUT="${PLAT_DIR}/${PLAT_NAME}"
    mkdir -p "${OUT}"

    local ZIG="zig cc -target ${ZIG_TARGET}"

    # Compile addon.c
    ${ZIG} -c ${CFLAGS_BASE} ${GLIB_INCLUDES} ${CHAFA_INCLUDES} ${NODE_INCLUDES} \
        "${PKG_DIR}/addon.c" -o "${OUT}/addon.o"

    # Collect all chafa + codec .o files from cross build
    local CDIR="${SRC_DIR}/out/${TARGET}"
    if [ ! -d "${CDIR}" ]; then
        echo "Need ${TARGET} cross build first — building..."
        cd "${SRC_DIR}" && bash build.sh "${TARGET}" >/dev/null 2>&1
    fi

    local OBJS="${OUT}/addon.o ${CDIR}/codec.o ${CDIR}/chafa_quarks.o"
    for f in "${CDIR}"/*.o; do
        [[ "$f" == */codec.o ]] && continue
        [[ "$f" == */chafa_quarks.o ]] && continue
        OBJS="$OBJS $f"
    done

    local IMG_LIBS="-L${SRC_DIR}/deps/${TARGET}/lib -lpng16 -ljpeg -lwebp -lwebpdemux -lwebpdsp -lwebputils -lsharpyuv -lz -lm"

    ${ZIG} -shared ${ZIG_LINK_FLAGS} ${OBJS} ${IMG_LIBS} -lpthread \
        -o "${OUT}/static_chafa.node"

    echo "  → ${OUT}/static_chafa.node ($(ls -lh "${OUT}/static_chafa.node" | awk '{print $5}'))"
}

case "${1:-all}" in
    native|linux-x64) build_native ;;
    linux-arm64)   build_cross aarch64-linux aarch64-linux-gnu linux-arm64 "-Wl,--allow-shlib-undefined" ;;
    darwin-arm64)  build_cross aarch64-macos aarch64-macos-none darwin-arm64 "-undefined dynamic_lookup" ;;
    win32-x64)     build_cross x86_64-windows x86_64-windows-gnu win32-x64 "" ;;
    all)
        build_native
        build_cross aarch64-linux aarch64-linux-gnu linux-arm64 "-Wl,--allow-shlib-undefined"
        build_cross aarch64-macos aarch64-macos-none darwin-arm64 "-undefined dynamic_lookup"
        build_cross x86_64-windows x86_64-windows-gnu win32-x64 ""
        ;;
    *)
        echo "Usage: $0 [native|linux-x64|linux-arm64|darwin-arm64|win32-x64|all]"
        exit 1
        ;;
esac
