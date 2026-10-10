import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// `vite build` produces a single self-contained script (React bundled) that
// registers <stableflowr-checkout>, for partners who don't use a bundler.
export default defineConfig({
  plugins: [react()],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir: "dist/standalone",
    emptyOutDir: true,
    lib: {
      entry: "src/standalone.ts",
      name: "ArcWidget",
      formats: ["es", "iife"],
      fileName: (format) => (format === "es" ? "stableflowr.js" : "stableflowr.iife.js"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.{ts,tsx}"],
  },
});
