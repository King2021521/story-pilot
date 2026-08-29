import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { SettingsService } from "./settings.service.js";

describe("SettingsService", () => {
  const originalEnv = { ...process.env };
  const tempDirs: string[] = [];

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("checks the model endpoint and reports auth failures", async () => {
    const homePath = mkdtempSync(join(tmpdir(), "story-pilot-settings-"));
    tempDirs.push(homePath);
    process.env.STORY_PILOT_HOME = homePath;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 })),
    );

    const result = await new SettingsService().validateModel({
      apiKey: "bad-key",
      baseUrl: "https://api.example.test/v1",
      model: "gpt-test",
    });

    expect(result).toMatchObject({
      endpoint: "https://api.example.test/v1",
      errorCode: "AI_MODEL_AUTH_FAILED",
      model: "gpt-test",
      ok: false,
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.test/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer bad-key",
          "content-type": "application/json",
        }),
        method: "POST",
      }),
    );
  });
});
