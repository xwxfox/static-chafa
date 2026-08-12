# static-chafa

**Zero-dependency terminal image rendering.** Renders PNG, JPEG, BMP, GIF, and WebP images
to ANSI terminal art using the [chafa](https://hpjansson.org/chafa/) engine compiled directly
into the native addon.

## Quick Start

```ts
import Chafa from "static-chafa";

const chafa = new Chafa({ termW: 80, termH: 24 });
const { ansi } = chafa.render(imageBuffer);
process.stdout.write(ansi);
chafa.destroy();
```

## Documentation

- **[Usage Guide](guide.md)** - Getting started, configuration, animation, advanced usage
- **[C API Reference](api/c.md)** - Native C API (context lifecycle, decode, render, animation)
- **[TypeScript API](api/README.md)** - Auto-generated class/interface reference
