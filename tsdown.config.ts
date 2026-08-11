import { defineConfig } from "tsdown";

export default defineConfig({
    entry: ["src/index.ts"],
    outDir: "dist",
    format: ["cjs", "esm"],
    dts: true,
    sourcemap: false,
    external: [/^@static-chafa\//],
    platform: "node",
    target: "es2022",
});
