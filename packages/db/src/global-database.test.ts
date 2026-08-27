import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createGlobalDatabase, runGlobalMigrations } from "./global-database.js";
import { GlobalProjectIndexRepository } from "./repositories/global-project-index.repository.js";

describe("global project index database", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("stores recent project metadata and updates opened time", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-global-db-"));
    tempDirs.push(rootDir);
    const globalDatabase = createGlobalDatabase(join(rootDir, "global.sqlite"));
    await runGlobalMigrations(globalDatabase);

    try {
      const repository = new GlobalProjectIndexRepository(globalDatabase);

      repository.upsertProject({
        createdAt: 10,
        databasePath: join(rootDir, "project_a", "project.sqlite"),
        defaultVolumeId: "volume_a",
        genre: "悬疑",
        graphPath: join(rootDir, "project_a", "graph.kuzu"),
        openedAt: 10,
        projectId: "project_a",
        rootPath: join(rootDir, "project_a"),
        status: "planning",
        title: "第一部",
        updatedAt: 10,
        workId: "work_a",
      });
      repository.upsertProject({
        createdAt: 20,
        databasePath: join(rootDir, "project_b", "project.sqlite"),
        defaultVolumeId: "volume_b",
        genre: "科幻",
        graphPath: join(rootDir, "project_b", "graph.kuzu"),
        openedAt: 20,
        projectId: "project_b",
        rootPath: join(rootDir, "project_b"),
        status: "planning",
        title: "第二部",
        updatedAt: 20,
        workId: "work_b",
      });

      repository.touchOpenedAt("project_a", 30);

      expect(repository.listRecent({ limit: 2 }).map((project) => project.id)).toEqual([
        "project_a",
        "project_b",
      ]);
      expect(repository.getByRootPath(join(rootDir, "project_a"))).toMatchObject({
        defaultVolumeId: "volume_a",
        genre: "悬疑",
        id: "project_a",
        rootPath: join(rootDir, "project_a"),
        workId: "work_a",
      });
    } finally {
      globalDatabase.close();
    }
  });
});
