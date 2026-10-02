import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Relative base: works on GitHub Pages under /EveryDay/ and on any static host.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true },
});
