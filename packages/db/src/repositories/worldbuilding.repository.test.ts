import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createProjectDatabase, runProjectMigrations } from "../project-database.js";
import { ProjectRepository } from "./project.repository.js";
import { WorldbuildingRepository } from "./worldbuilding.repository.js";

describe("WorldbuildingRepository", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("upserts one fixed 12-dimension profile per project", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "story-pilot-worldbuilding-"));
    tempDirs.push(tempDir);
    const projectDatabase = createProjectDatabase(join(tempDir, "project.sqlite"));

    try {
      await runProjectMigrations(projectDatabase);
      new ProjectRepository(projectDatabase).createProject({
        defaultVolumeId: "volume_1",
        genre: "悬疑",
        projectId: "project_1",
        rootPath: tempDir,
        title: "雾都案卷",
        workId: "work_1",
      });

      const repository = new WorldbuildingRepository(projectDatabase);
      const first = repository.saveProfile({
        fields: {
          powerSystem: "角色依靠线索、关系和档案解读能力推进调查。",
          worldBase: "近现代旧城悬疑世界。",
        },
        projectId: "project_1",
        now: 100,
      });
      const second = repository.saveProfile({
        fields: {
          geography: "旧城围绕钟楼向外扩散。",
          worldBase: "近现代旧城悬疑世界，核心舞台是钟楼。",
        },
        projectId: "project_1",
        now: 200,
      });

      const rowCount = projectDatabase.client
        .prepare("select count(*) as count from worldbuilding_profiles where project_id = ?")
        .get("project_1") as { count: number };

      expect(first.fields).toMatchObject({
        powerSystem: "角色依靠线索、关系和档案解读能力推进调查。",
        worldBase: "近现代旧城悬疑世界。",
      });
      expect(second.fields).toMatchObject({
        geography: "旧城围绕钟楼向外扩散。",
        powerSystem: "",
        worldBase: "近现代旧城悬疑世界，核心舞台是钟楼。",
      });
      expect(second.updatedAt).toBe(200);
      expect(rowCount.count).toBe(1);
    } finally {
      projectDatabase.close();
    }
  });

  it("rejects fields longer than the 500 character storage contract", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "story-pilot-worldbuilding-limit-"));
    tempDirs.push(tempDir);
    const projectDatabase = createProjectDatabase(join(tempDir, "project.sqlite"));

    try {
      await runProjectMigrations(projectDatabase);
      new ProjectRepository(projectDatabase).createProject({
        defaultVolumeId: "volume_1",
        genre: "悬疑",
        projectId: "project_1",
        rootPath: tempDir,
        title: "雾都案卷",
        workId: "work_1",
      });

      const repository = new WorldbuildingRepository(projectDatabase);

      expect(() =>
        repository.saveProfile({
          fields: {
            worldBase: "世".repeat(501),
          },
          projectId: "project_1",
          now: 100,
        }),
      ).toThrow("WORLDBUILDING_FIELD_TOO_LONG: worldBase");
    } finally {
      projectDatabase.close();
    }
  });
});
