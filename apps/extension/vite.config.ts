import { defineConfig }    from "vite";
import react               from "@vitejs/plugin-react";
import { resolve }         from "path";
import { copyFileSync, cpSync, mkdirSync } from "fs";

export default defineConfig({
  plugins: [
    react(),
    {
      // Copia manifest.json e ícones para dist/ após o build
      name: "copy-ext-assets",
      closeBundle() {
        copyFileSync("manifest.json", "dist/manifest.json");
        mkdirSync("dist/icons", { recursive: true });
        cpSync("icons", "dist/icons", { recursive: true });
      },
    },
  ],
  publicDir: false,
  build: {
    outDir:     "dist",
    emptyOutDir: true,
    target:     "es2022",   // Modern target — sem eval
    minify:     true,
    rollupOptions: {
      input: {
        popup:      resolve(__dirname, "src/popup/index.html"),
        content:    resolve(__dirname, "src/content/content.ts"),
        background: resolve(__dirname, "src/background/service-worker.ts"),
      },
      output: {
        // Content script e service worker precisam de paths fixos no manifest
        entryFileNames: (chunk) => {
          if (chunk.name === "content")    return "content.js";
          if (chunk.name === "background") return "service-worker.js";
          return "popup/assets/[name]-[hash].js";
        },
        chunkFileNames:  "popup/assets/[name]-[hash].js",
        assetFileNames:  "popup/assets/[name]-[hash].[ext]",
      },
    },
  },
});
