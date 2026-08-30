import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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

  it("creates a local app home with setting.json and production storage paths", () => {
    const homePath = createTempHome();
    const env: NodeJS.ProcessEnv = { STORY_PILOT_HOME: homePath };

    const config = initializeRuntimeConfig({ env });

    expect(config).toMatchObject({
      globalDatabasePath: join(homePath, "global.sqlite"),
      homePath,
      projectsRoot: join(homePath, "projects"),
      settingsPath: join(homePath, "setting.json"),
    });
    expect(existsSync(join(homePath, "setting.json"))).toBe(true);
    expect(existsSync(join(homePath, "projects"))).toBe(true);
    expect(existsSync(join(homePath, "logs"))).toBe(true);
    expect(existsSync(join(homePath, "diagnostics"))).toBe(true);
    expect(existsSync(join(homePath, "temp"))).toBe(true);
    expect(env.STORY_PILOT_PROJECTS_ROOT).toBe(join(homePath, "projects"));
    expect(env.STORY_PILOT_GLOBAL_DATABASE_PATH).toBe(join(homePath, "global.sqlite"));

    const settings = JSON.parse(readFileSync(join(homePath, "setting.json"), "utf8"));
    expect(settings).toMatchObject({
      model: {
        apiKey: "",
        baseUrl: "",
        embeddingModel: "",
        maxRetries: 2,
        model: "gpt-5.5",
        provider: "openai-compatible",
        timeoutMs: 120000,
      },
      privacy: {
        allowDiagnosticsExport: true,
        redactApiKeyInLogs: true,
      },
      storage: {
        autoBackup: true,
        backupRetention: 20,
        homeDir: homePath,
      },
      version: 1,
    });
  });

  it("applies the user configured model provider from setting.json", () => {
    const homePath = createTempHome();
    const env: NodeJS.ProcessEnv = { STORY_PILOT_HOME: homePath };
    writeFileSync(
      join(homePath, "setting.json"),
      JSON.stringify(
        {
          model: {
            apiKey: "json-api-key",
            baseUrl: "https://api.example.test/v1",
            embeddingModel: "text-embedding-test",
            maxRetries: 4,
            model: "gpt-test",
            provider: "openai-compatible",
            timeoutMs: 90000,
          },
          storage: {
            homeDir: homePath,
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
    expect(env.STORY_PILOT_LLM_EMBEDDING_MODEL).toBe("text-embedding-test");
    expect(env.STORY_PILOT_LLM_MAX_RETRIES).toBe("4");
    expect(env.STORY_PILOT_LLM_MODEL).toBe("gpt-test");
    expect(env.STORY_PILOT_LLM_TIMEOUT_MS).toBe("90000");
  });

  it("treats setting.json as authoritative over local LLM environment values", () => {
    const homePath = createTempHome();
    const env: NodeJS.ProcessEnv = {
      STORY_PILOT_HOME: homePath,
      STORY_PILOT_LLM_API_KEY: "env-api-key",
      STORY_PILOT_LLM_BASE_URL: "https://api.env.test/v1",
      STORY_PILOT_LLM_MODEL: "env-model",
    };

    initializeRuntimeConfig({ env });

    expect(env.STORY_PILOT_LLM_API_KEY).toBeUndefined();
    expect(env.STORY_PILOT_LLM_BASE_URL).toBeUndefined();
    expect(env.STORY_PILOT_LLM_MODEL).toBe("gpt-5.5");
  });

  it("renames invalid setting.json before recreating defaults", () => {
    const homePath = createTempHome();
    const env: NodeJS.ProcessEnv = { STORY_PILOT_HOME: homePath };
    writeFileSync(join(homePath, "setting.json"), "{bad json");

    const config = initializeRuntimeConfig({ env });

    expect(config.settingsPath).toBe(join(homePath, "setting.json"));
    expect(JSON.parse(readFileSync(join(homePath, "setting.json"), "utf8"))).toMatchObject({
      version: 1,
    });
    expect(
      existsSync(
        join(
          homePath,
          readdirSync(homePath).find((name) => name.startsWith("setting.invalid.")) ?? "",
        ),
      ),
    ).toBe(true);
  });

  function createTempHome(): string {
    const homePath = mkdtempSync(join(tmpdir(), "story-pilot-home-"));
    tempDirs.push(homePath);
    return homePath;
  }
});
