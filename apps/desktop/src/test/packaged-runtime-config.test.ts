import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import viteConfig, { stripCrossoriginAttributes } from "../../vite.config";

describe("packaged desktop runtime config", () => {
  it("keeps an HTML boot fallback for packaged WebView diagnostics", () => {
    const indexHtml = readFileSync(join(process.cwd(), "index.html"), "utf8");

    expect(indexHtml).toContain("Story Pilot 正在启动");
    expect(indexHtml).toContain('window.addEventListener("error", showBootError)');
    expect(indexHtml).toContain('window.addEventListener("unhandledrejection", showBootError)');
  });

  it("does not replace the mounted React app for post-startup async errors", () => {
    const indexHtml = readFileSync(join(process.cwd(), "index.html"), "utf8");

    expect(indexHtml).toContain('window.__STORY_PILOT_BOOT_STAGE === "after-react-render"');
  });

  it("uses relative asset paths for packaged file-protocol loading", () => {
    expect(viteConfig).toMatchObject({
      base: "./",
    });
  });

  it("removes crossorigin attributes from packaged HTML asset tags", () => {
    const result = stripCrossoriginAttributes(
      '<script type="module" crossorigin src="./assets/index.js"></script><link rel="stylesheet" crossorigin href="./assets/index.css">',
    );

    expect(result).toBe(
      '<script type="module" src="./assets/index.js"></script><link rel="stylesheet" href="./assets/index.css">',
    );
  });

  it("targets the macOS WebView runtime for production bundles", () => {
    expect(viteConfig).toMatchObject({
      build: {
        target: "safari13",
      },
    });
  });

  it("centers the main window on launch so it cannot restore offscreen", () => {
    const config = JSON.parse(
      readFileSync(join(process.cwd(), "src-tauri", "tauri.conf.json"), "utf8"),
    ) as {
      app?: {
        windows?: { center?: boolean; title?: string }[];
      };
    };
    const mainWindow = config.app?.windows?.find((window) => window.title === "Story Pilot");

    expect(mainWindow).toMatchObject({
      center: true,
    });
  });
});
