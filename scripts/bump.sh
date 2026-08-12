#!/usr/bin/env bash
# bump.sh - Bump semver across main package + all platform packages + optionalDeps
# Usage: ./scripts/bump.sh <major|minor|patch|1.2.3>
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"

NEXT="${1:-patch}"

bump3() {
    # $1 = "major|minor|patch" or "x.y.z"
    local v="$1"
    case "$v" in
        major)   node -e "const [a,b,c]=process.argv[1].split('.').map(Number);process.stdout.write([a+1,0,0].join('.'))" "$(node -e "process.stdout.write(require('${DIR}/package.json').version)")" ;;
        minor)   node -e "const [a,b,c]=process.argv[1].split('.').map(Number);process.stdout.write([a,b+1,0].join('.'))" "$(node -e "process.stdout.write(require('${DIR}/package.json').version)")" ;;
        patch)   node -e "const [a,b,c]=process.argv[1].split('.').map(Number);process.stdout.write([a,b,c+1].join('.'))" "$(node -e "process.stdout.write(require('${DIR}/package.json').version)")" ;;
        *.*.*)   echo "$v" ;;  # already x.y.z
        *)       echo "Usage: bump.sh <major|minor|patch|x.y.z>" >&2; exit 1 ;;
    esac
}

NEW=$(bump3 "$NEXT")
echo "Bumping 1.0.0 -> ${NEW} (${NEXT})" | sed "s/1.0.0/$(node -e "process.stdout.write(require('${DIR}/package.json').version)")/"

# Update main package.json
node -e "
    const p = require('${DIR}/package.json');
    p.version = '${NEW}';
    for (const k of Object.keys(p.optionalDependencies)) {
        p.optionalDependencies[k] = '${NEW}';
    }
    require('fs').writeFileSync('${DIR}/package.json', JSON.stringify(p, null, 2) + '\n');
"

# Update all platform packages
for p in linux-x64 linux-arm64 darwin-arm64 win32-x64; do
    pk="${DIR}/platforms/${p}/package.json"
    if [ -f "$pk" ]; then
        node -e "
            const p = require('${pk}');
            p.version = '${NEW}';
            require('fs').writeFileSync('${pk}', JSON.stringify(p) + '\n');
        "
    fi
done

echo "Bumped to ${NEW}. Run 'bun run build:platforms' to rebuild."
