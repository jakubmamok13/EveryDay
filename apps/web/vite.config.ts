import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Relative base: works on GitHub Pages under /EveryDay/ and on any static host.
export default defineConfig({
  base: "./",
  plugins: [react()],
  // One offline chunk (~140 kB gzip) on purpose: the whole app must work without a network.
  build: { outDir: "dist", emptyOutDir: true, chunkSizeWarningLimit: 800 },
});
