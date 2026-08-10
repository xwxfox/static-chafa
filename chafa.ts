import { CString, dlopen, FFIType, ptr, read } from "bun:ffi";

const glib = dlopen("libglib-2.0.so.0", {
    g_string_free: {
        args: [FFIType.ptr, FFIType.i32],
        returns: FFIType.ptr,
    },
});

// 1. Locate the native library path based on OS platform
const libPath = process.platform === "darwin"
    ? "libchafa.dylib"
    : "libchafa.so.0"; // Ubuntu/Debian default shared object name

// 2. Map the C ABI symbols from the Chafa Library
const lib = dlopen(libPath, {
    chafa_canvas_config_new: {
        args: [],
        returns: FFIType.ptr,
    },

    chafa_canvas_config_set_geometry: {
        args: [
            FFIType.ptr, // ChafaCanvasConfig*
            FFIType.i32, // width
            FFIType.i32, // height
        ],
        returns: FFIType.void,
    },

    chafa_canvas_config_set_canvas_mode: {
        args: [
            FFIType.ptr, // ChafaCanvasConfig*
            FFIType.i32, // ChafaCanvasMode
        ],
        returns: FFIType.void,
    },

    chafa_canvas_config_set_pixel_mode: {
        args: [
            FFIType.ptr, // ChafaCanvasConfig*
            FFIType.i32, // ChafaPixelMode
        ],
        returns: FFIType.void,
    },

    chafa_canvas_config_set_bg_color: {
        args: [
            FFIType.ptr, // ChafaCanvasConfig*
            FFIType.u32, // guint32 packed RGB
        ],
        returns: FFIType.void,
    },

    chafa_canvas_config_set_work_factor: {
        args: [
            FFIType.ptr,
            FFIType.f32,
        ],
        returns: FFIType.void,
    },

    chafa_canvas_config_set_dither_mode: {
        args: [
            FFIType.ptr,
            FFIType.i32,
        ],
        returns: FFIType.void,
    },

    chafa_canvas_config_set_preprocessing_enabled: {
        args: [
            FFIType.ptr,
            FFIType.i32,
        ],
        returns: FFIType.void,
    },

    chafa_canvas_new: {
        args: [FFIType.ptr],
        returns: FFIType.ptr,
    },

    chafa_canvas_draw_all_pixels: {
        args: [
            FFIType.ptr, // ChafaCanvas*
            FFIType.i32, // ChafaPixelType
            FFIType.ptr, // const guint8*
            FFIType.i32, // width
            FFIType.i32, // height
            FFIType.i32, // rowstride
        ],
        returns: FFIType.void,
    },

    chafa_canvas_build_ansi: {
        args: [FFIType.ptr],
        returns: FFIType.ptr,
    },

    chafa_canvas_unref: {
        args: [FFIType.ptr],
        returns: FFIType.void,
    },

    chafa_canvas_config_unref: {
        args: [FFIType.ptr],
        returns: FFIType.void,
    },
});

// Extract bound methods for usability
const { symbols } = lib;

/**
 * Converts a raw RGBA Uint8Array buffer into ASCII/Unicode terminal graphics.
 */
export function renderImageToTerminal(
    rgbaBuffer: Uint8Array,
    imgWidth: number,
    imgHeight: number,
    termColumns: number,
    termRows: number,
): string {
    const config = symbols.chafa_canvas_config_new();

    try {
        symbols.chafa_canvas_config_set_geometry(
            config,
            termColumns,
            termRows,
        );

        // 24-bit ANSI truecolor.
        const CHAFA_CANVAS_MODE_TRUECOLOR = 0;

        symbols.chafa_canvas_config_set_canvas_mode(
            config,
            CHAFA_CANVAS_MODE_TRUECOLOR,
        );

        // Render as terminal symbols rather than Kitty/Sixel/etc.
        const CHAFA_PIXEL_MODE_SYMBOLS = 0;

        symbols.chafa_canvas_config_set_pixel_mode(
            config,
            CHAFA_PIXEL_MODE_SYMBOLS,
        );

        // Black assumed terminal background.
        symbols.chafa_canvas_config_set_bg_color(
            config,
            0x000000,
        );

        // Speed/quality tradeoff: 0.0 = max speed
        symbols.chafa_canvas_config_set_work_factor(
            config,
            0.0,
        );

        // No dithering = faster
        const CHAFA_DITHER_MODE_NONE = 0;
        symbols.chafa_canvas_config_set_dither_mode(
            config,
            CHAFA_DITHER_MODE_NONE,
        );

        // Disable image preprocessing (sharpening, etc.) = faster
        symbols.chafa_canvas_config_set_preprocessing_enabled(
            config,
            0,
        );

        const canvas = symbols.chafa_canvas_new(config);

        try {
            /*
             * Sharp's .ensureAlpha().raw() gives us:
             *
             * R G B A R G B A R G B A ...
             *
             * This is UNASSOCIATED / straight alpha,
             * not premultiplied alpha.
             */
            const CHAFA_PIXEL_RGBA8_UNASSOCIATED = 4;

            const rowstride = imgWidth * 4;

            symbols.chafa_canvas_draw_all_pixels(
                canvas,
                CHAFA_PIXEL_RGBA8_UNASSOCIATED,
                ptr(rgbaBuffer),
                imgWidth,
                imgHeight,
                rowstride,
            );

            const gStringPtr =
                symbols.chafa_canvas_build_ansi(canvas);

            if (!gStringPtr) {
                throw new Error(
                    "Chafa failed to build terminal graphics layout.",
                );
            }

            const rawStringPtr = read.ptr(gStringPtr, 0);
            const result = new CString(rawStringPtr).toString();
            glib.symbols.g_string_free(gStringPtr, 1);
            return result;
        } finally {
            symbols.chafa_canvas_unref(canvas);
        }
    } finally {
        symbols.chafa_canvas_config_unref(config);
    }
}

// Utility to handle safe scalar memory address arithmetic casting
