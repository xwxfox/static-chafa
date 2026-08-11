#!/usr/bin/env bash
# build-platforms.sh - Build .node NAPI addons for ALL platforms + dist artifacts
# Output: platforms/*/static_chafa.node + dist/ (via tsdown)
# After build, syncs version from main package.json to all platform packages.
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"

VERSION=$(node -e "process.stdout.write(require('${DIR}/package.json').version)")

# 1. Build .node for each platform
for t in native aarch64-linux aarch64-macos x86_64-windows; do
    echo ""; echo "=== ${t} ==="
    "${DIR}/build.sh" "${t}" napi
done

# 2. Build JS dist
echo ""; echo "=== tsdown ==="
cd "${DIR}" && npx tsdown

# 3. Sync version to all platform package.json files
echo ""; echo "=== syncing version ${VERSION} ==="
for p in linux-x64 linux-arm64 darwin-arm64 win32-x64; do
    pk="${DIR}/platforms/${p}/package.json"
    if [ -f "$pk" ]; then
        node -e "
            const p = require('${pk}');
            p.version = '${VERSION}';
            require('fs').writeFileSync('${pk}', JSON.stringify(p) + '\n');
        "
        echo "  platforms/${p}: ${VERSION}"
    fi
done

# 4. Sync version in main optionalDependencies too
echo ""; echo "=== syncing optionalDeps ==="
node -e "
    const p = require('${DIR}/package.json');
    for (const k of Object.keys(p.optionalDependencies)) {
        p.optionalDependencies[k] = '${VERSION}';
    }
    require('fs').writeFileSync('${DIR}/package.json', JSON.stringify(p, null, 2) + '\n');
"
echo "  optionalDependencies → ${VERSION}"

echo ""; echo "=== native module sizes ==="
find "${DIR}/platforms" -type f -name '*.node' -print0 |
while IFS= read -r -d '' file; do
    size=$(du -h "$file" | cut -f1)
    rel="${file#"${DIR}/"}"
    printf "  %-50s %8s\n" "$rel" "$size"
done

echo ""; echo "All platforms built. Publish with:"
echo "  npm publish      # main package (static-chafa)"
echo "  npm publish -ws  # all 4 platform packages"
