#!/usr/bin/env bash
# build-platforms.sh - Build .node NAPI addons for ALL platforms + dist artifacts
# Output: platforms/*/static_chafa.node + dist/ (via tsdown)
# After build, syncs version from main package.json to all platform packages.
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"

# ── Bun preflight ──
# Required for version sync + tsdown. On Windows (MSYS2) bun is often not
# on PATH; install it and fix PATH manually, because the installer's
# ~/.bashrc changes are not sourced in non-interactive shells.
find_bun() {
    if command -v bun >/dev/null 2>&1; then
        BUN="$(command -v bun)"
        return 0
    fi
    local cand bun_install_posix
    if [ -n "${BUN_INSTALL:-}" ]; then
        bun_install_posix="$(cygpath -u "${BUN_INSTALL}" 2>/dev/null || printf '%s' "${BUN_INSTALL}")"
        for cand in "${bun_install_posix}/bin/bun" "${bun_install_posix}/bin/bun.exe"; do
            if [ -x "${cand}" ]; then
                BUN="${cand}"
                export PATH="$(dirname "${cand}"):${PATH}"
                return 0
            fi
        done
    fi
    # MSYS-style install (~/.bun) and PowerShell-style install
    # (%USERPROFILE%\.bun, visible as /c/Users/<name>/.bun in MSYS)
    for cand in \
        "${HOME}/.bun/bin/bun" "${HOME}/.bun/bin/bun.exe" \
        "/c/Users/${USERNAME}/.bun/bin/bun" "/c/Users/${USERNAME}/.bun/bin/bun.exe"; do
        if [ -x "${cand}" ]; then
            BUN="${cand}"
            export PATH="$(dirname "${cand}"):${PATH}"
            return 0
        fi
    done
    return 1
}
if ! find_bun; then
    echo "bun not found - installing via https://bun.com/install ..."
    if ! command -v curl >/dev/null 2>&1; then
        echo "ERROR: curl is required to install bun (or install bun manually)" >&2
        exit 1
    fi
    curl -fsSL https://bun.com/install | bash || true
    if ! find_bun; then
        # The bash installer delegates to powershell on the MSYS subsystem;
        # run the official powershell installer directly as a fallback.
        PS="$(command -v powershell 2>/dev/null || command -v powershell.exe 2>/dev/null || printf '%s' '/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe')"
        if [ -x "${PS}" ]; then
            "${PS}" -NoProfile -c "irm bun.sh/install.ps1|iex"
        else
            echo "ERROR: bun install failed and powershell was not found" >&2
            exit 1
        fi
    fi
    find_bun || { echo "ERROR: bun install failed (no ~/.bun/bin/bun)" >&2; exit 1; }
fi
echo "bun: ${BUN} ($("${BUN}" --version))"

VERSION=$("${BUN}" -e "process.stdout.write(require(process.cwd() + '/package.json').version)")

# 1. Build .node for each platform
#    On Windows hosts build.sh "native" == win32-x64, so linux-x64 must be
#    cross-compiled explicitly; on unix hosts "native" covers linux-x64.
case "$(uname -s 2>/dev/null)" in
    MINGW*|MSYS*|CYGWIN*) TARGETS="x86_64-linux aarch64-linux aarch64-macos x86_64-windows" ;;
    *) TARGETS="native aarch64-linux aarch64-macos x86_64-windows" ;;
esac
for t in ${TARGETS}; do
    echo ""; echo "=== ${t} ==="
    "${DIR}/build.sh" "${t}" napi
done

# 2. Build JS dist
echo ""; echo "=== tsdown ==="
cd "${DIR}" && "${BUN}" x tsdown

# 3. Sync version to all platform package.json files
#    (paths built from process.cwd() so MSYS-style /c/... paths are not
#     passed to the native Windows bun binary)
echo ""; echo "=== syncing version ${VERSION} ==="
for p in linux-x64 linux-arm64 darwin-arm64 win32-x64; do
    pk="${DIR}/platforms/${p}/package.json"
    if [ -f "$pk" ]; then
        (
            cd "${DIR}"
            "${BUN}" -e "
                const rel = 'platforms/${p}/package.json';
                const p = require(process.cwd() + '/' + rel);
                p.version = '${VERSION}';
                require('fs').writeFileSync(process.cwd() + '/' + rel, JSON.stringify(p) + '\n');
            "
        )
        echo "  platforms/${p}: ${VERSION}"
    fi
done

# 4. Sync version in main optionalDependencies too
echo ""; echo "=== syncing optionalDeps ==="
(
    cd "${DIR}"
    "${BUN}" -e "
        const p = require(process.cwd() + '/package.json');
        for (const k of Object.keys(p.optionalDependencies)) {
            p.optionalDependencies[k] = '${VERSION}';
        }
        require('fs').writeFileSync(process.cwd() + '/package.json', JSON.stringify(p, null, 2) + '\n');
    "
)
echo "  optionalDependencies -> ${VERSION}"

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
