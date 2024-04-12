import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    svelte(),
    {
      // https://github.com/vitejs/vite/issues/3033#issuecomment-1360691044
      name: "singleHMR",
      handleHotUpdate({ modules }) {
        modules.map((m) => {
          (m as any).importedModules = new Set();
          m.importers = new Set();
        });

        return modules;
      },
    },
  ],
});
