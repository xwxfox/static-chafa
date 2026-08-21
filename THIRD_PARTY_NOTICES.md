# Third-Party Notices

This file identifies third-party software incorporated into, derived from,
or otherwise distributed with this project.

The original code of this project is licensed under the MIT License.
Third-party components remain subject to their respective licenses.

Where a component is statically linked into a native binary, its license
continues to apply to that component.

---

## Chafa

**Project:** Chafa
**Copyright:** Hans Petter Jansson and Chafa contributors
**License:** GNU Lesser General Public License, version 3 or later
**SPDX:** `LGPL-3.0-or-later`
**Upstream:** https://github.com/hpjansson/chafa

This project incorporates and modifies/adapts portions of Chafa.

The Chafa-derived portions of this project remain licensed under
LGPL-3.0-or-later.

The exact Chafa source revision used to produce a release should be recorded
in that release's source bundle and build metadata.

### Chafa modifications

This project adapts Chafa for use as a native Node.js/N-API component and
adds project-specific native bindings, portability support, and additional
functionality.

Changes to Chafa-derived code remain subject to the LGPL-3.0-or-later.

See `COPYING.LESSER` for the full license text.

---

## chafa-wasm

**Project:** chafa-wasm
**Author:** Héctor Molinero Fernández
**License:** GNU Lesser General Public License, version 3
**SPDX:** `LGPL-3.0`
**Upstream:** https://github.com/hectorm/chafa-wasm

This project was developed with reference to chafa-wasm's JavaScript/TypeScript
API and may contain API/type material derived from that project.

Where material is actually derived from chafa-wasm, it remains subject to the
LGPL-3.0 license.

No claim is made that API names, public interfaces, or independently written
equivalent types are themselves copied source code.

---

## zlib

**Project:** zlib
**Version:** 1.3.1
**Copyright:** Jean-loup Gailly and Mark Adler
**License:** zlib License
**SPDX:** `Zlib`
**Upstream:** https://zlib.net/

zlib is used as part of the native image-processing stack.

The zlib license permits redistribution and use in source and binary forms,
subject to its license conditions.

The applicable license text is provided in `licenses/zlib.txt`.

---

## libpng

**Project:** libpng
**Version:** 1.6.43
**Copyright:** PNG Reference Library authors and contributors
**License:** libpng License / PNG Reference Library License
**SPDX:** `Libpng`
**Upstream:** https://libpng.org/

libpng is used for PNG image decoding.

The applicable license and copyright notices are provided in
`licenses/libpng.txt`.

---

## Independent JPEG Group (IJG) JPEG

**Project:** Independent JPEG Group JPEG
**Version:** 9f
**Copyright:** Thomas G. Lane and contributors / Independent JPEG Group
**License:** Independent JPEG Group license
**SPDX:** `IJG`
**Upstream:** https://www.ijg.org/

The Independent JPEG Group implementation is used for JPEG image decoding.

The applicable license and copyright notices are provided in
`licenses/ijg-jpeg.txt`.

---

## WebP

**Project:** WebP
**Version:** 1.4.0
**Copyright:** Google and contributors
**License:** BSD-style license
**SPDX:** `BSD-3-Clause`
**Upstream:** https://chromium.googlesource.com/webm/libwebp/

WebP and its associated image-processing libraries are used by the native
image-processing stack.

The applicable license text is provided in `licenses/libwebp.txt`.

---

### stb_image

**Project:** stb_image  
**Version:** 2.30  
**Author:** Sean Barrett / stb contributors  
**License:** Public domain  
**Source:** https://github.com/nothings/stb/blob/master/stb_image.h

This project includes `stb_image.h` v2.30. The upstream header
identifies stb_image as a public-domain image loader and contains the
complete applicable licensing information.

---

## Node.js N-API

**Project:** Node.js / Node-API headers
**Copyright:** Node.js contributors
**License:** MIT
**SPDX:** `MIT`
**Upstream:** https://github.com/nodejs/node

This project includes and/or uses Node-API headers to implement its native
Node.js addon interface.

The applicable Node.js license and copyright notices are provided in
`licenses/nodejs.txt`.

---

## FFmpeg

**Project:** FFmpeg
**Version of vendored headers:** n8.1.2

**Upstream:** https://ffmpeg.org/
**Source:** https://github.com/FFmpeg/FFmpeg

This project uses FFmpeg's public API for optional video functionality and
loads FFmpeg libraries dynamically at runtime.

The FFmpeg runtime libraries are not distributed as part of this project.
Users are responsible for obtaining an appropriately licensed FFmpeg build.

FFmpeg's licensing depends on how FFmpeg is configured and which components
are enabled. In particular, FFmpeg builds containing GPL or non-free
components can have licensing requirements different from a standard LGPL
build.

The vendored FFmpeg headers are subject to FFmpeg's applicable licensing and
copyright notices.

No statement is made that every possible FFmpeg runtime configuration is
licensed under LGPL.

---

## GLib / libc compatibility code

This project contains a small portability/compatibility layer implementing
functionality needed by the native build on platforms where the expected
system functionality is unavailable.

This compatibility layer is intended to be independently implemented and is
not a copy of glibc.

Where a file contains third-party code or is subsequently determined to be
derived from a third-party implementation, that file's original license and
copyright notices take precedence over this statement.

---

## Fonts, sample data, and media

Any media, images, videos, fonts, or other test assets distributed with a
release are separately licensed.

Only assets whose redistribution rights have been verified should be included
in source or binary releases.

If an asset is removed from a release because its provenance cannot be
verified, it is not considered part of the distributed software.

---

## License texts

Copies of the applicable third-party license texts are provided under
`licenses/`.

The full GNU LGPLv3 license is provided as `COPYING.LESSER`.
