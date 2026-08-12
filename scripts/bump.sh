#!/usr/bin/env bash
# bump.sh - Bump semver across main package + all platform packages + optionalDeps
# Usage: ./scripts/bump.sh <major|minor|patch|1.2.3>
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
NEXT="${1:-patch}"

get_version() {
    bun -e "
        const fs = require('fs');
        const path = require('path');

        const pkgPath = path.resolve(process.argv[1]);
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

        process.stdout.write(pkg.version);
    " "${DIR}/package.json"
}

bump3() {
    # $1 = "major|minor|patch" or "x.y.z"
    local v="$1"
    local current
    current="$(get_version)"

    case "$v" in
        major)
            bun -e "
                const [a] = process.argv[1].split('.').map(Number);
                process.stdout.write([a + 1, 0, 0].join('.'));
            " "$current"
            ;;
        minor)
            bun -e "
                const [a, b] = process.argv[1].split('.').map(Number);
                process.stdout.write([a, b + 1, 0].join('.'));
            " "$current"
            ;;
        patch)
            bun -e "
                const [a, b, c] = process.argv[1].split('.').map(Number);
                process.stdout.write([a, b, c + 1].join('.'));
            " "$current"
            ;;
        *.*.*)
            echo "$v"
            ;;
        *)
            echo "Usage: bump.sh <major|minor|patch|x.y.z>" >&2
            exit 1
            ;;
    esac
}

CURRENT="$(get_version)"
NEW="$(bump3 "$NEXT")"

echo "Bumping ${CURRENT} -> ${NEW} (${NEXT})"

# Update main package.json
bun -e "
    const fs = require('fs');
    const path = require('path');

    const pkgPath = path.resolve(process.argv[1]);
    const p = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    p.version = process.argv[2];

    for (const k of Object.keys(p.optionalDependencies ?? {})) {
        p.optionalDependencies[k] = process.argv[2];
    }

    fs.writeFileSync(pkgPath, JSON.stringify(p, null, 2) + '\n');
" "${DIR}/package.json" "$NEW"

# Update all platform packages
for p in linux-x64 linux-arm64 darwin-arm64 win32-x64; do
    pk="${DIR}/platforms/${p}/package.json"

    if [ -f "$pk" ]; then
        bun -e "
            const fs = require('fs');
            const path = require('path');

            const pkgPath = path.resolve(process.argv[1]);
            const p = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

            p.version = process.argv[2];

            fs.writeFileSync(pkgPath, JSON.stringify(p, null, 2) + '\n');
        " "$pk" "$NEW"
    fi
done

echo "Bumped to ${NEW}. Run 'bun run build:platforms' to rebuild."