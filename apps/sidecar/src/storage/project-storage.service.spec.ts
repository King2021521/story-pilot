import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ProjectStorageService } from "./project-storage.service.js";

describe("ProjectStorageService runtime home layout", () => {
  const tempDirs: string[] = [];
  let originalHome: string | undefined;
  let originalProjectsRoot: string | undefined;
  let originalGlobalDatabasePath: string | undefined;

  beforeEach(() => {
    originalHome = process.env.STORY_PILOT_HOME;
    originalProjectsRoot = process.env.STORY_PILOT_PROJECTS_ROOT;
    originalGlobalDatabasePath = process.env.STORY_PILOT_GLOBAL_DATABASE_PATH;
  });

  afterEach(() => {
    restoreEnv("STORY_PILOT_HOME", originalHome);
    restoreEnv("STORY_PILOT_PROJECTS_ROOT", originalProjectsRoot);
    restoreEnv("STORY_PILOT_GLOBAL_DATABASE_PATH", originalGlobalDatabasePath);

    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("uses STORY_PILOT_HOME for global data and project workspaces", () => {
    const homePath = mkdtempSync(join(tmpdir(), "story-pilot-storage-home-"));
    tempDirs.push(homePath);
    process.env.STORY_PILOT_HOME = homePath;
    delete process.env.STORY_PILOT_PROJECTS_ROOT;
    delete process.env.STORY_PILOT_GLOBAL_DATABASE_PATH;

    const service = new ProjectStorageService();
    const layout = service.createProjectLayout({ projectId: "project_a" });

    expect(service.getProjectsRootPath()).toBe(join(homePath, "projects"));
    expect(service.getGlobalDatabasePath()).toBe(join(homePath, "global.sqlite"));
    expect(layout).toMatchObject({
      artifactsPath: join(homePath, "projects", "project_a", "artifacts"),
      attachmentsPath: join(homePath, "projects", "project_a", "attachments"),
      backupsPath: join(homePath, "projects", "project_a", "backups"),
      databasePath: join(homePath, "projects", "project_a", "project.sqlite"),
      exportsPath: join(homePath, "projects", "project_a", "exports"),
      graphPath: join(homePath, "projects", "project_a", "graph.kuzu"),
      rootPath: join(homePath, "projects", "project_a"),
    });
    expect(existsSync(join(homePath, "projects", "project_a", "exports"))).toBe(true);
    expect(existsSync(join(homePath, "projects", "project_a", "artifacts"))).toBe(true);
    expect(existsSync(join(homePath, "projects", "project_a", "attachments"))).toBe(true);
  });

  it("migrates a legacy global database from projects into the app home", async () => {
    const homePath = mkdtempSync(join(tmpdir(), "story-pilot-storage-home-"));
    tempDirs.push(homePath);
    const legacyGlobalDatabasePath = join(homePath, "projects", "global.sqlite");
    mkdirSync(join(homePath, "projects"), { recursive: true });
    writeFileSync(legacyGlobalDatabasePath, "");
    process.env.STORY_PILOT_HOME = homePath;
    delete process.env.STORY_PILOT_PROJECTS_ROOT;
    delete process.env.STORY_PILOT_GLOBAL_DATABASE_PATH;

    const service = new ProjectStorageService();
    const globalDatabase = await service.openGlobalDatabase();
    try {
      expect(globalDatabase.path).toBe(join(homePath, "global.sqlite"));
    } finally {
      globalDatabase.close();
    }

    expect(existsSync(join(homePath, "global.sqlite"))).toBe(true);
    expect(existsSync(legacyGlobalDatabasePath)).toBe(false);
  });
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
