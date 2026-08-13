#!/usr/bin/env bun
/**
 * @file scripts/docs.ts
 * @brief Generates combined API documentation from TypeScript (typedoc) and C (doxygen comments).
 *
 * Output structure:
 *   docs/
 *   ├-- index.md              - Main docs landing page
 *   ├-- guide.md              - Usage guide with examples
 *   ├-- api/
 *   │   ├-- c.md              - C API reference (from Doxygen comments in codec.c / addon.c)
 *   │   ├-- classes/          - Typedoc-generated class docs
 *   │   ├-- interfaces/       - Typedoc-generated interface docs
 *   │   └-- README.md         - Typedoc index
 *   └-- README.md             - Symlink/copy of index.md
 *
 * Usage: bun run docs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const DOCS_DIR = "docs";
const API_DIR = join(DOCS_DIR, "api");

// Clean output dirs but preserve Doxyfile.c
if (existsSync(API_DIR)) rmSync(API_DIR, { recursive: true, force: true });
if (existsSync(join(DOCS_DIR, "c_api_xml"))) rmSync(join(DOCS_DIR, "c_api_xml"), { recursive: true, force: true });
for (const f of ["index.md", "guide.md"]) {
    const p = join(DOCS_DIR, f);
    if (existsSync(p)) rmSync(p);
}
mkdirSync(API_DIR, { recursive: true });
mkdirSync(DOCS_DIR, { recursive: true });

// Step 1: Generate TypeScript API docs via typedoc
console.log("-> Generating TypeScript API docs...");
const tr = Bun.spawnSync(["bunx", "typedoc"], { stdio: ["ignore", "ignore", "pipe"] });
if (tr.exitCode !== 0) throw new Error("typedoc failed");

// Step 2: Generate C API reference via doxygen -> moxygen
console.log("-> Generating C API reference...");
const dr = Bun.spawnSync(["doxygen", "docs/Doxyfile.c"], { stdio: ["ignore", "ignore", "pipe"] });
if (dr.exitCode !== 0) throw new Error("doxygen failed");
const mr = Bun.spawnSync(["bunx", "moxygen", "--anchors", "--quiet", "--language", "cpp", "docs/c_api_xml", "-o", join(DOCS_DIR, "api", "c.md")], { stdio: ["ignore", "ignore", "pipe"] });
if (mr.exitCode !== 0) throw new Error("moxygen failed");

// Post-process: remove internal types not part of the public API
let cContent = readFileSync(join(DOCS_DIR, "api", "c.md"), "utf8");
// Remove internal type rows from tables (markdown backtick-formatted links)
for (const name of ["jpg_err", "jpg_src", "AnimHandle"]) {
    cContent = cContent.replace(new RegExp(`^\\|.*${name}.*\\|.*\\n`, "gm"), "");
}
// Remove internal type body sections (### heading blocks)
for (const name of ["jpg_err", "jpg_src", "AnimHandle", "AnimType"]) {
    cContent = cContent.replace(
        new RegExp(`\\n### \\x60?${name}\\x60?[\\s\\S]*?(?=\\n## |\\n### |\\n---|\\n\\z)`, "g"),
        ""
    );
}
cContent = cContent.replace(/\n{3,}/g, "\n\n");
// Remove empty Enumerations section
cContent = cContent.replace(/## Enumerations\n+{#[^}]*}\n{2,}/g, "");
writeFileSync(join(DOCS_DIR, "api", "c.md"), cContent);

// Clean up doxygen XML intermediate files
const xmlDir = join(DOCS_DIR, "c_api_xml");
if (existsSync(xmlDir)) rmSync(xmlDir, { recursive: true, force: true });

// Step 3: Write guide
const guide = buildGuide();
writeFileSync(join(DOCS_DIR, "guide.md"), guide);

// Step 4: Write main index
const index = buildIndex();
writeFileSync(join(DOCS_DIR, "index.md"), index);

// Step 5: Fix cross-links in typedoc output
fixTypedocLinks(API_DIR);

console.log(`-> Docs generated in ${DOCS_DIR}/`);
console.log(`  ${DOCS_DIR}/index.md       - Landing page`);
console.log(`  ${DOCS_DIR}/guide.md       - Usage guide with examples`);
console.log(`  ${DOCS_DIR}/api/c.md        - C API reference`);
console.log(`  ${DOCS_DIR}/api/            - TypeScript API docs (typedoc)`);

/* -- Helpers -- */

function buildIndex(): string {
    return `# static-chafa

**Zero-dependency terminal image rendering.** Renders PNG, JPEG, BMP, GIF, and WebP images
to ANSI terminal art using the [chafa](https://hpjansson.org/chafa/) engine compiled directly
into the native addon.

## Quick Start

\`\`\`ts
import Chafa from "static-chafa";

const chafa = new Chafa({ termW: 80, termH: 24 });
const { ansi } = chafa.render(imageBuffer);
process.stdout.write(ansi);
chafa.destroy();
\`\`\`

## Documentation

- **[Usage Guide](guide.md)** - Getting started, configuration, animation, advanced usage
- **[C API Reference](api/c.md)** - Native C API (context lifecycle, decode, render, animation)
- **[TypeScript API](api/README.md)** - Auto-generated class/interface reference
`;
}

function buildGuide(): string {
    return `# Usage Guide

## Installation

\`\`\`bash
npm install static-chafa
\`\`\`

No external dependencies required. The package bundles platform-specific native addons
for linux-x64, linux-arm64, darwin-arm64, and win32-x64.

## Basic Rendering

\`\`\`ts
import Chafa from "static-chafa";

// Create an instance with default settings
const chafa = new Chafa({ termW: 80, termH: 24 });

// Render an image from a Buffer
const { ansi, metrics } = chafa.render(imageBuffer);
process.stdout.write(ansi);

// metrics gives you detailed timing:
//   parseMs  - time spent decoding the image
//   drawMs   - time in chafa_canvas_draw_all_pixels (scaling + symbol matching)
//   buildMs  - time in chafa_canvas_print (ANSI string generation)
//   totalMs  - sum of all three
console.log(metrics);

chafa.destroy();
\`\`\`

## Configuration

\`\`\`ts
import Chafa, { CanvasMode, DitherMode, PixelMode } from "static-chafa";

const chafa = new Chafa({
    termW: 80,          // width in character cells
    termH: 24,          // height in character cells
    cellW: 8,           // cell width in pixels (font ratio)
    cellH: 8,           // cell height in pixels
    workFactor: 0.0,    // 0.0 = fastest, 1.0 = best quality
    canvasMode: CanvasMode.TRUECOLOR,
    ditherMode: DitherMode.NONE,
    pixelMode: PixelMode.SYMBOLS,
    bgColor: 0x000000,  // background (0xRRGGBB, -1 for transparent)
    fgColor: 0xFFFFFF,  // foreground
    preprocessing: 0,   // enable auto-contrast/brightness
});

// Update config at any time (invalidates internal canvas)
chafa.updateConfig({
    canvasMode: CanvasMode.INDEXED_256,
    ditherMode: DitherMode.DIFFUSION,
    symbols: "block+border+space-wide",  // chafa CLI selector syntax
});
\`\`\`

## Decode Once, Render Many

\`\`\`ts
import Chafa from "static-chafa";

const chafa = new Chafa({ termW: 80, termH: 24 });

// Decode once - returns raw RGBA pixels
const img = chafa.decode(imageBuffer);
console.log(img.width, img.height, img.metrics.format);

// Render the same decoded image with different configs
chafa.updateConfig({ canvasMode: CanvasMode.TRUECOLOR });
const { ansi: fullColor } = chafa.renderRgba(img.rgba, img.width, img.height);

chafa.updateConfig({ canvasMode: CanvasMode.INDEXED_16 });
const { ansi: indexed } = chafa.renderRgba(img.rgba, img.width, img.height);
\`\`\`

## Cell Matrix

\`\`\`ts
// Get the raw cell grid as a JSON-encoded 3D array
const { matrix } = chafa.renderMatrix(imageBuffer);
const cells: [number, number, number][][] = JSON.parse(matrix);

// Each cell is [charCode, fgColor, bgColor]
// Colors: -1 = transparent, 0xRRGGBB = truecolor, 0-255 = palette index
for (const row of cells) {
    for (const [code, fg, bg] of row) {
        console.log(String.fromCodePoint(code), fg.toString(16), bg.toString(16));
    }
}
\`\`\`

## Animation

\`\`\`ts
import Chafa from "static-chafa";

const chafa = new Chafa({ termW: 80, termH: 24 });
const anim = chafa.openAnimation(gifBuffer);

while (true) {
    const frame = anim.next();
    if (!frame) break;  // playback ended

    const { ansi, metrics } = anim.renderFrame(frame.frameIndex);
    process.stdout.write("\\x1b[H" + ansi);

    // Wait for frame delay
    await new Promise(r => setTimeout(r, metrics.frameDelayMs));
}

anim.close();
\`\`\`

## Using \`using\` for Auto-Cleanup

\`\`\`ts
// TypeScript 5.2+ - auto-cleanup at end of scope
{
    using chafa = new Chafa({ termW: 80, termH: 24 });
    const { ansi } = chafa.render(buf);
    // chafa.destroy() called here
}
\`\`\`

## Complete ChafaConfig Reference

All configuration fields map 1:1 to chafa's \`ChafaCanvasConfig\` setters.
See the [chafa man page](https://hpjansson.org/chafa/man/) for detailed descriptions
of each option.

### Canvas geometry
| Field | Default | Description |
|-------|---------|-------------|
| \`termW\` | 80 | Width in character cells |
| \`termH\` | 24 | Height in character cells |
| \`cellW\` | 8 | Cell width in pixels (font ratio) |
| \`cellH\` | 8 | Cell height in pixels (font ratio) |

### Quality
| Field | Default | Description |
|-------|---------|-------------|
| \`workFactor\` | 0.0 | 0.0 (fastest) to 1.0 (best quality) |
| \`preprocessing\` | 0 | Auto contrast/brightness (0=off, 1=on) |

### Color
| Field | Default | Description |
|-------|---------|-------------|
| \`canvasMode\` | 0 | One of \`CanvasMode\` (TRUECOLOR, INDEXED_256, ...) |
| \`colorExtractor\` | 0 | AVERAGE (0) or MEDIAN (1) |
| \`colorSpace\` | 0 | RGB (0) or DIN99D (1) |
| \`bgColor\` | 0x000000 | Background 0xRRGGBB, -1 = transparent |
| \`fgColor\` | 0xFFFFFF | Foreground 0xRRGGBB, -1 = transparent |
| \`alphaThreshold\` | 127 | 0-255, lower = less transparent |
| \`fgOnly\` | 0 | Foreground-only mode |

### Dithering
| Field | Default | Description |
|-------|---------|-------------|
| \`ditherMode\` | 0 | NONE, ORDERED, DIFFUSION, or NOISE |
| \`ditherGrainW\` | 4 | Grain width in pixels |
| \`ditherGrainH\` | 4 | Grain height in pixels |
| \`ditherIntensity\` | 1.0 | Multiplier (0.0-2.0 typical) |

### Pixel mode
| Field | Default | Description |
|-------|---------|-------------|
| \`pixelMode\` | 0 | SYMBOLS, SIXELS, KITTY, or ITERM2 |
| \`pixelFit\` | 1 | NONE (0): hand pixels to chafa unchanged. SCALE (1): pre-scale pixels to the target area (\`termW × cellW\` by \`termH × cellH\`, aspect-preserving, centered) so chafa draws 1:1 |
| \`cellW\` | 8 | Cell width in pixels (pixel modes only) |
| \`cellH\` | 16 | Cell height in pixels (pixel modes only); 16 matches a typical 1:2 font aspect so output fills the same area as symbol mode |

### Video
| Field | Default | Description |
|-------|---------|-------------|
| \`videoIncludeAudio\` | 0 | Decode audio into per-frame interleaved float PCM. 0 discards audio entirely (saves CPU/memory), 1 exposes \`frame.audio\` |

### Output
| Field | Default | Description |
|-------|---------|-------------|
| \`optimizations\` | 0x7fffffff | Bitmask of \`ChafaOptimizations\` |
| \`passthrough\` | 0 | NONE, SCREEN, or TMUX |
| \`symbols\` | "" | Chafa CLI selector string |
| \`fillSymbols\` | "" | Chafa CLI fill selector string |

### Animation
| Field | Default | Description |
|-------|---------|-------------|
| \`maxFrames\` | -1 | Max frames (-1 = all) |
| \`speed\` | 1.0 | Playback speed multiplier |
`;
}

function buildCRef(): string {
    return `# C API Reference

The native C API is exposed via \`codec.so\` / \`static_chafa.node\`.
All functions are declared in \`src/codec.c\` with Doxygen-style documentation.

## Context

### \`CodecCtx\`

Per-instance rendering context. Holds a cached chafa canvas and up to 16
animation handles. Created by \`codec_ctx_new()\`, destroyed by \`codec_ctx_free()\`.

\`\`\`c
CodecCtx *codec_ctx_new(CodecConfig *cfg);
void codec_ctx_free(CodecCtx *ctx);
void codec_ctx_configure(CodecCtx *ctx, CodecConfig *cfg);
\`\`\`

## Configuration

### \`CodecConfig\`

344-byte struct mapping 1:1 to chafa's \`ChafaCanvasConfig\` setters.
Contains 22 numeric fields (int32/float) and two 128-byte symbol selector strings.

## Metrics

### \`CodecMetrics\`

68-byte struct (4 floats + 13 int32s) returned with every operation:

| Field | Type | Description |
|-------|------|-------------|
| \`parse_ms\` | float | Total decode time (ms) |
| \`draw_ms\` | float | \`chafa_canvas_draw_all_pixels\` time (ms) |
| \`build_ms\` | float | \`chafa_canvas_print\` time (ms) |
| \`total_ms\` | float | parse + draw + build |
| \`img_w\`, \`img_h\` | int32 | Source image dimensions (pixels) |
| \`canvas_w\`, \`canvas_h\` | int32 | Cell grid dimensions |
| \`canvas_pw\`, \`canvas_ph\` | int32 | Internal pixel canvas size |
| \`frame_count\` | int32 | Total frames (-1 = unknown) |
| \`frame_delay_ms\` | int32 | Delay before next frame |
| \`rgba_bytes\` | int32 | Decoded RGBA buffer size |
| \`format\` | int32 | Image format (0=PNG, 1=JPEG, 2=BMP, 3=GIF, 4=WebP) |
| \`canvas_mode\` | int32 | Active \`ChafaCanvasMode\` |
| \`pixel_mode\` | int32 | Active \`ChafaPixelMode\` |
| \`have_alpha\` | int32 | Source had alpha channel |

## Decode

\`\`\`c
// Decode to caller-owned buffer (free with codec_free)
uint8_t *codec_decode_buffer(char *data, int32_t len,
    int32_t *out_w, int32_t *out_h, int32_t *out_stride,
    CodecMetrics *out, int32_t *err);

// Decode into caller-provided buffer (returns 0 on success)
int codec_decode_into(char *data, int32_t len,
    uint8_t *rgba_out, int32_t rgba_cap,
    int32_t *out_w, int32_t *out_h, int32_t *out_stride,
    CodecMetrics *out, int32_t *err);
\`\`\`

## Render

\`\`\`c
// Decode + render -> ANSI string
char *codec_render(CodecCtx *ctx, char *data, int32_t len,
    CodecMetrics *out, int32_t *err);

// Pre-decoded RGBA -> ANSI string
char *codec_render_rgba(CodecCtx *ctx, uint8_t *rgba,
    int32_t w, int32_t h, int32_t stride, CodecMetrics *out);

// Decode + render -> JSON cell matrix
char *codec_render_matrix(CodecCtx *ctx, char *data, int32_t len,
    CodecMetrics *out, int32_t *err);

// Pre-decoded RGBA -> JSON cell matrix
char *codec_render_matrix_rgba(CodecCtx *ctx, uint8_t *rgba,
    int32_t w, int32_t h, int32_t stride, CodecMetrics *out);
\`\`\`

All returned strings must be freed with \`codec_free()\`.

## Animation

\`\`\`c
int32_t codec_anim_open(CodecCtx *ctx, char *data, int32_t len,
    CodecMetrics *out, int32_t *err);
int32_t codec_anim_next(CodecCtx *ctx, int32_t handle, CodecMetrics *out);
char *codec_anim_render_frame(CodecCtx *ctx, int32_t handle, int32_t frame_idx,
    CodecMetrics *out);
int32_t codec_anim_rewind(CodecCtx *ctx, int32_t handle);
void codec_anim_close(CodecCtx *ctx, int32_t handle);
void codec_anim_abort(CodecCtx *ctx, int32_t handle);
\`\`\`

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| 0 | \`ERR_OK\` | Success |
| -1 | \`ERR_UNKNOWN_FMT\` | Unrecognized image format |
| -4 | \`ERR_FILE_EMPTY\` | Empty buffer |
| -5 | \`ERR_MALLOC\` | Memory allocation failed |
| -8 | \`ERR_DIMENSIONS\` | Invalid image dimensions |
| -9 | \`ERR_DECODE_FAIL\` | Codec-specific decode failure |
| -12 | \`ERR_BAD_PARAMS\` | Invalid parameters |

## Memory

\`\`\`c
void codec_free(void *p);  // Free any pointer from codec_* functions
\`\`\`
`;
}

/** Fix relative links in typedoc markdown output to point to correct paths. */
function fixTypedocLinks(dir: string): void {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) {
            fixTypedocLinks(p);
        } else if (entry.name.endsWith(".md")) {
            let content = readFileSync(p, "utf8");
            // Fix links to other typedoc pages (remove .md extension for GitHub)
            content = content.replace(/\]\(([^)]+)\.md\)/g, "]($1)");
            writeFileSync(p, content);
        }
    }
}
