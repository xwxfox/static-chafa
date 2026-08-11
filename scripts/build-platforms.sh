#!/usr/bin/env bash
# build-platforms.sh — Build .node NAPI addons for ALL platforms
# Calls build.sh with napi mode for each target.
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"

for t in native aarch64-linux aarch64-macos x86_64-windows; do
    echo ""; echo "=== ${t} ==="
    "${DIR}/build.sh" "${t}" napi
done
echo ""; echo "All platforms done."
