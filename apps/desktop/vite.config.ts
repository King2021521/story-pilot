import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

const isTauriDebugBuild = process.env.TAURI_ENV_DEBUG === "true";

export default defineConfig({
  base: "./",
  build: {
    minify: isTauriDebugBuild ? false : "esbuild",
    sourcemap: isTauriDebugBuild,
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
  },
  clearScreen: false,
  envPrefix: ["VITE_", "TAURI_"],
  plugins: [react(), stripCrossoriginForTauriPackagedHtml()],
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
  },
});

export function stripCrossoriginForTauriPackagedHtml(): Plugin {
  return {
    name: "story-pilot-strip-crossorigin-for-tauri",
    transformIndexHtml(html) {
      return stripCrossoriginAttributes(html);
    },
  };
}

export function stripCrossoriginAttributes(html: string): string {
  return html.replaceAll(/\s+crossorigin(="[^"]*")?/g, "");
}
