import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { initializeRuntimeConfig } from "./runtime-settings.js";

describe("runtime settings", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("creates a local app home with settings and top-level storage paths", () => {
    const homePath = createTempHome();
    const env: NodeJS.ProcessEnv = { STORY_PILOT_HOME: homePath };

    const config = initializeRuntimeConfig({ env });

    expect(config).toMatchObject({
      globalDatabasePath: join(homePath, "global.sqlite"),
      homePath,
      projectsRoot: join(homePath, "projects"),
      settingsPath: join(homePath, "settings.json"),
    });
    expect(existsSync(join(homePath, "settings.json"))).toBe(true);
    expect(existsSync(join(homePath, "projects"))).toBe(true);
    expect(existsSync(join(homePath, "logs"))).toBe(true);
    expect(env.STORY_PILOT_PROJECTS_ROOT).toBe(join(homePath, "projects"));
    expect(env.STORY_PILOT_GLOBAL_DATABASE_PATH).toBe(join(homePath, "global.sqlite"));

    const settings = JSON.parse(readFileSync(join(homePath, "settings.json"), "utf8"));
    expect(settings).toMatchObject({
      llm: {
        defaultProviderId: "default-openai-compatible",
        providers: [
          {
            apiKey: "",
            baseUrl: "",
            id: "default-openai-compatible",
            model: "gpt-5.5",
            type: "openai-compatible",
          },
        ],
      },
      storage: {
        globalDatabasePath: join(homePath, "global.sqlite"),
        homePath,
        projectsRoot: join(homePath, "projects"),
      },
      version: 1,
    });
  });

  it("applies the user configured model provider from settings.json", () => {
    const homePath = createTempHome();
    const env: NodeJS.ProcessEnv = { STORY_PILOT_HOME: homePath };
    writeFileSync(
      join(homePath, "settings.json"),
      JSON.stringify(
        {
          llm: {
            defaultProviderId: "main",
            providers: [
              {
                apiKey: "json-api-key",
                baseUrl: "https://api.example.test/v1",
                id: "main",
                model: "gpt-test",
                name: "Main",
                type: "openai-compatible",
              },
            ],
          },
          storage: {
            globalDatabasePath: join(homePath, "global.sqlite"),
            homePath,
            projectsRoot: join(homePath, "projects"),
          },
          version: 1,
        },
        null,
        2,
      ),
    );

    initializeRuntimeConfig({ env });

    expect(env.STORY_PILOT_LLM_API_KEY).toBe("json-api-key");
    expect(env.STORY_PILOT_LLM_BASE_URL).toBe("https://api.example.test/v1");
    expect(env.STORY_PILOT_LLM_MODEL).toBe("gpt-test");
  });

  function createTempHome(): string {
    const homePath = mkdtempSync(join(tmpdir(), "story-pilot-home-"));
    tempDirs.push(homePath);
    return homePath;
  }
});
