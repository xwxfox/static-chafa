#!/usr/bin/env bash
set -euo pipefail

SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPS_SRC="${SRC_DIR}/deps_src"
OUT="${SRC_DIR}/licenses"

# The build script uses:
#
#   CHAFA_SRC="${CHAFA_SRC:-${SRC_DIR}/chafa-git}"
#
# and then, if necessary, descends into a chafa/ subdirectory.
CHAFA_ORIG="${CHAFA_SRC:-${SRC_DIR}/chafa-git}"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

die() {
    echo "ERROR: $*" >&2
    exit 1
}

find_archive_member() {
    local archive="$1"
    shift

    local pattern
    local member

    for pattern in "$@"; do
        member="$(
            tar -tzf "$archive" |
            grep -Ei "(^|/)$pattern$" |
            head -n 1 || true
        )"

        if [ -n "$member" ]; then
            printf '%s\n' "$member"
            return 0
        fi
    done

    return 1
}

extract_archive_member() {
    local archive="$1"
    local member="$2"
    local destination="$3"

    echo "  ${archive##*/}: ${member} -> ${destination}"

    tar -xOzf "$archive" "$member" > "$destination"
}

# ---------------------------------------------------------------------------
# Prepare output
# ---------------------------------------------------------------------------

rm -rf "${OUT}"

mkdir -p \
    "${OUT}/chafa" \
    "${OUT}/zlib" \
    "${OUT}/libpng" \
    "${OUT}/ijg-jpeg" \
    "${OUT}/libwebp" \
    "${OUT}/stb" \
    "${OUT}/ffmpeg" \
    "${OUT}/node"
    
echo "Third-party license extraction"
echo "==============================="
echo

# ---------------------------------------------------------------------------
# Chafa
# ---------------------------------------------------------------------------
echo "== Chafa =="

CHAFA_DIR="${CHAFA_SRC:-${SRC_DIR}/chafa-git}"

if [ ! -d "${CHAFA_DIR}" ]; then
    die "Chafa source not found at ${CHAFA_DIR}"
fi

# Chafa source files may live in chafa-git/chafa, while the
# repository-level license files live in chafa-git/.
if [ -d "${CHAFA_DIR}/chafa" ]; then
    CHAFA_SOURCE_ROOT="${CHAFA_DIR}/chafa"
    CHAFA_REPO_ROOT="${CHAFA_DIR}"
else
    CHAFA_SOURCE_ROOT="${CHAFA_DIR}"
    CHAFA_REPO_ROOT="${CHAFA_DIR}"
fi

echo "  repository: ${CHAFA_REPO_ROOT}"
echo "  source:     ${CHAFA_SOURCE_ROOT}"

# Repository-level Chafa licensing/provenance files.
for file in COPYING COPYING.LESSER AUTHORS README; do
    if [ -f "${CHAFA_REPO_ROOT}/${file}" ]; then
        cp "${CHAFA_REPO_ROOT}/${file}" \
           "${OUT}/chafa/${file}"

        echo "  copied ${file}"
    else
        echo "WARNING: Chafa is missing ${file}" >&2
    fi
done

# Record provenance.
cat > "${OUT}/chafa/SOURCE.txt" <<EOF
Chafa
=====

Project:
Chafa

Upstream:
https://github.com/hpjansson/chafa

Local source directory:
${CHAFA_SOURCE_ROOT}

Local repository directory:
${CHAFA_REPO_ROOT}

The source was obtained by extracting a Chafa source archive.

The build currently obtains Chafa from the GitHub master branch unless
CHAFA_SRC is explicitly provided.

IMPORTANT:
The exact upstream Git commit MUST be recorded before making a release.
EOF

echo

# ---------------------------------------------------------------------------
# zlib 1.3.1
# ---------------------------------------------------------------------------

echo "== zlib 1.3.1 =="

archive="${DEPS_SRC}/zlib-1.3.1.tar.gz"
[ -f "${archive}" ] || die "missing ${archive}"

member="$(
    find_archive_member "${archive}" \
        "LICENSE" \
        "README"
)" || die "could not find zlib license/notice"

extract_archive_member \
    "${archive}" \
    "${member}" \
    "${OUT}/zlib/LICENSE.txt"

echo

# ---------------------------------------------------------------------------
# libpng 1.6.43
# ---------------------------------------------------------------------------

echo "== libpng 1.6.43 =="

archive="${DEPS_SRC}/libpng-1.6.43.tar.gz"
[ -f "${archive}" ] || die "missing ${archive}"

member="$(
    find_archive_member "${archive}" \
        "LICENSE" \
        "LICENSE.txt" \
        "README"
)" || die "could not find libpng license/notice"

extract_archive_member \
    "${archive}" \
    "${member}" \
    "${OUT}/libpng/LICENSE.txt"

echo

# ---------------------------------------------------------------------------
# Independent JPEG Group JPEG 9f
# ---------------------------------------------------------------------------

echo "== IJG JPEG 9f =="

archive="${DEPS_SRC}/jpegsrc.v9f.tar.gz"
[ -f "${archive}" ] || die "missing ${archive}"

member="$(
    find_archive_member "${archive}" \
        "README.ijg" \
        "README" \
        "COPYRIGHT"
)" || die "could not find IJG JPEG license/notice"

extract_archive_member \
    "${archive}" \
    "${member}" \
    "${OUT}/ijg-jpeg/README.txt"

echo

# ---------------------------------------------------------------------------
# libwebp 1.4.0
# ---------------------------------------------------------------------------

echo "== libwebp 1.4.0 =="

archive="${DEPS_SRC}/libwebp-1.4.0.tar.gz"
[ -f "${archive}" ] || die "missing ${archive}"

member="$(
    find_archive_member "${archive}" \
        "COPYING" \
        "LICENSE" \
        "COPYING.txt" \
        "LICENSE.txt"
)" || die "could not find libwebp license"

extract_archive_member \
    "${archive}" \
    "${member}" \
    "${OUT}/libwebp/COPYING.txt"

echo

# ---------------------------------------------------------------------------
# stb_image
# ---------------------------------------------------------------------------

echo "== stb_image =="

STB="${SRC_DIR}/src/stb_image.h"

if [ -f "${STB}" ]; then
    # Keep the upstream licensing block from the actual header.
    #
    # We deliberately copy the header's license text rather than inventing
    # our own SPDX/license summary.
    awk '
        BEGIN { p=0 }
        /Do this./ { p=1 }
        p { print }
        /THE SOFTWARE IS PROVIDED/ { exit }
    ' "${STB}" > "${OUT}/stb/stb_image-license.txt" || true

    echo "  extracted licensing text from ${STB}"
else
    echo "WARNING: ${STB} not found; skipping stb_image"
fi

echo

# ---------------------------------------------------------------------------
# FFmpeg
# ---------------------------------------------------------------------------

echo "== FFmpeg headers =="

FFMPEG="${SRC_DIR}/vendor/ffmpeg"

if [ -d "${FFMPEG}" ]; then
    echo "  FFmpeg headers found at ${FFMPEG}"

    # Preserve FFmpeg's version/license metadata where available.
    for file in \
        "${FFMPEG}/COPYING.LGPLv2.1" \
        "${FFMPEG}/COPYING.GPLv2" \
        "${FFMPEG}/LICENSE.md" \
        "${FFMPEG}/README.md"
    do
        if [ -f "${file}" ]; then
            cp "${file}" "${OUT}/ffmpeg/"
            echo "  copied ${file##*/}"
        fi
    done

    cat > "${OUT}/ffmpeg/SOURCE.txt" <<EOF
FFmpeg headers

Upstream:
https://ffmpeg.org/
https://github.com/FFmpeg/FFmpeg

This repository distributes FFmpeg API headers but does not distribute
FFmpeg runtime libraries.

The runtime FFmpeg libraries are loaded dynamically from the user's
environment. Their licensing depends on the particular FFmpeg build
provided by the user.
EOF
else
    echo "WARNING: ${FFMPEG} not found"
fi

echo

# ---------------------------------------------------------------------------
# Node.js / N-API
# ---------------------------------------------------------------------------

echo "== Node.js / N-API =="

NAPI="${SRC_DIR}/vendor/napi"

if [ -d "${NAPI}" ]; then
    echo "  N-API headers found at ${NAPI}"

    cat > "${OUT}/node/SOURCE.txt" <<EOF
Node.js / Node-API headers

Vendored headers:
  js_native_api.h
  js_native_api_types.h
  node_api.h
  node_api_types.h

Upstream:
https://github.com/nodejs/node

These files are Node.js / Node-API headers used to implement the native
Node.js addon interface.

The exact Node.js source revision from which these headers were obtained
should be recorded before release.
EOF

    echo "  wrote N-API provenance note"
else
    echo "WARNING: ${NAPI} not found"
fi

echo
echo "== Complete =="

find "${OUT}" -type f -print | sort