import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

// Stubs raw .svg imports so tests that load the built @vc-shell/framework
// (e.g. via vi.mock importOriginal) don't fail on Node's ERR_UNKNOWN_FILE_EXTENSION.
const svgStub = {
  name: "svg-stub",
  enforce: "pre" as const,
  load(id: string) {
    if (id.split("?")[0].endsWith(".svg")) {
      return `export default ${JSON.stringify(id)};`;
    }
    return null;
  },
};

// Standalone vitest config — intentionally does NOT merge with vite.config.mts,
// which is the Module Federation build (federation plugin, plugins/ outDir).
export default defineConfig({
  plugins: [svgStub, vue()],
  test: {
    globals: true,
    environment: "jsdom",
    // A closed port, so a stray request can't be answered by whatever is running locally.
    environmentOptions: { jsdom: { url: "http://localhost:59999/" } },
    setupFiles: "src/test/setup.ts",
    include: ["src/**/*.test.ts"],
    server: {
      deps: {
        inline: [/@vc-shell\/framework/],
      },
    },
    coverage: {
      provider: "v8",
      include: ["src/modules/**/*.{ts,vue}"],
      exclude: ["src/modules/**/index.ts", "src/modules/**/locales/**"],
    },
  },
});
