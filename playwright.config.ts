import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { height: 900, width: 1440 } },
    },
  ],
  testDir: "apps/desktop/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:1420",
    trace: "on-first-retry",
  },
  webServer: {
    command:
      "pnpm --filter @story-pilot/contracts build && pnpm --filter @story-pilot/presets build && pnpm --filter @story-pilot/desktop dev:web",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    url: "http://127.0.0.1:1420",
  },
});
