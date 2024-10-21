import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import wasm from "vite-plugin-wasm";
import { visualizer } from "rollup-plugin-visualizer";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
  plugins: [
    svelte(),
    wasm(),
    topLevelAwait({
      promiseExportName: "__tla",
      promiseImportName: (i) => `__tla_${i}`,
    }),
    visualizer({
      emitFile: true,
      gzipSize: true,
      filename: "stats.html",
    }),
  ],
});
