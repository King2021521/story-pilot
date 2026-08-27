import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadLocalEnv } from "./env-loader.js";

describe("loadLocalEnv", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("loads the first .env found while walking up from the sidecar working directory", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-env-"));
    tempDirs.push(rootDir);
    const sidecarDir = join(rootDir, "apps", "sidecar");
    writeFileSync(
      join(rootDir, ".env"),
      [
        "STORY_PILOT_LLM_MODEL=gpt-test",
        "STORY_PILOT_LLM_BASE_URL=https://api.example.test/v1",
        "STORY_PILOT_LLM_API_KEY=test-secret",
      ].join("\n"),
    );

    const env: NodeJS.ProcessEnv = {};
    const result = loadLocalEnv({ cwd: sidecarDir, env });

    expect(result).toEqual({
      loaded: true,
      path: join(rootDir, ".env"),
    });
    expect(env.STORY_PILOT_LLM_MODEL).toBe("gpt-test");
    expect(env.STORY_PILOT_LLM_BASE_URL).toBe("https://api.example.test/v1");
    expect(env.STORY_PILOT_LLM_API_KEY).toBe("test-secret");
  });

  it("keeps explicit process environment values over .env defaults", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-env-"));
    tempDirs.push(rootDir);
    writeFileSync(join(rootDir, ".env"), "STORY_PILOT_LLM_MODEL=from-file\n");

    const env: NodeJS.ProcessEnv = {
      STORY_PILOT_LLM_MODEL: "from-shell",
    };
    loadLocalEnv({ cwd: rootDir, env });

    expect(env.STORY_PILOT_LLM_MODEL).toBe("from-shell");
  });
});
