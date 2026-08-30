import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createProjectDatabase, runProjectMigrations } from "../project-database.js";
import { CreativePathRepository } from "./creative-path.repository.js";
import { ProjectRepository } from "./project.repository.js";

describe("CreativePathRepository", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("stores estimated length fields on project briefs", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "story-pilot-brief-length-"));
    tempDirs.push(tempDir);
    const projectDatabase = createProjectDatabase(join(tempDir, "project.sqlite"));

    try {
      await runProjectMigrations(projectDatabase);
      new ProjectRepository(projectDatabase).createProject({
        defaultVolumeId: "volume_1",
        genre: "玄幻",
        projectId: "project_1",
        rootPath: tempDir,
        title: "旧都遗物",
        workId: "work_1",
      });

      const repository = new CreativePathRepository(projectDatabase);
      const brief = repository.saveBrief({
        briefId: "brief_1",
        emotionalRewards: ["爽点"],
        estimatedChapterCount: 260,
        estimatedWordCount: 800_000,
        genre: "玄幻",
        lengthProfile: "长篇连载",
        projectId: "project_1",
        subgenres: ["废柴逆袭"],
      });

      expect(brief).toMatchObject({
        estimatedChapterCount: 260,
        estimatedWordCount: 800_000,
        genre: "玄幻",
      });
      expect(repository.getLatestBrief("project_1")).toMatchObject({
        estimatedChapterCount: 260,
        estimatedWordCount: 800_000,
      });
    } finally {
      projectDatabase.close();
    }
  });

  it("saves editable core story fields into the current blueprint", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "story-pilot-core-story-"));
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

      const repository = new CreativePathRepository(projectDatabase);
      const first = repository.saveBlueprintForm({
        fields: {
          antagonistForce: "旧城钟楼背后的既得利益者。",
          corePromise: "每个单元都给出硬线索和情绪反转。",
          differentiators: ["旧信谜题和人物成长绑定"],
          emotionalAxes: ["悬疑", "反转"],
          logline: "雨夜旧信把主角拖回十年前钟楼旧案。",
          mainConflict: "主角追查真相时不断触碰旧城秩序。",
          mainGoal: "找出钟楼火灾真相并保护仍被旧案威胁的人。",
          premise: "旧城钟楼火灾十年后，主角收到一封不该存在的旧信。",
          protagonistArc: "从逃避旧案到主动承担代价。",
          risks: ["线索密度不足会削弱追读"],
          stakes: "失败会让旧案幸存者再次被清算。",
          storyDriver: "mystery",
        },
        projectId: "project_1",
        now: 100,
      });
      const second = repository.saveBlueprintForm({
        fields: {
          antagonistForce: "旧警署、钟楼议会和被旧案保护的幸存者。",
          corePromise: "每个单元都给出硬线索、人物反转和旧案真相推进。",
          differentiators: ["旧信谜题和人物成长绑定", "钟楼档案构成连续线索网"],
          emotionalAxes: ["悬疑", "压迫感"],
          logline: "雨夜旧信把主角拖回十年前钟楼旧案。",
          mainConflict: "主角追查真相时不断触碰旧城秩序。",
          mainGoal: "找出钟楼火灾真相并迫使旧城公开档案。",
          premise: "旧城钟楼火灾十年后，主角收到一封不该存在的旧信。",
          protagonistArc: "从逃避旧案到主动承担代价。",
          risks: ["旧案反转不能只靠隐瞒信息"],
          stakes: "失败会让旧案幸存者再次被清算，主角也会失去替亲人翻案的机会。",
          storyDriver: "mystery",
        },
        projectId: "project_1",
        now: 200,
      });

      const rowCount = projectDatabase.client
        .prepare("select count(*) as count from story_blueprints where project_id = ?")
        .get("project_1") as { count: number };

      expect(first).toMatchObject({
        mainGoal: "找出钟楼火灾真相并保护仍被旧案威胁的人。",
        status: "draft",
        storyDriver: "mystery",
      });
      expect(second).toMatchObject({
        emotionalAxes: ["悬疑", "压迫感"],
        id: first.id,
        mainGoal: "找出钟楼火灾真相并迫使旧城公开档案。",
        stakes: "失败会让旧案幸存者再次被清算，主角也会失去替亲人翻案的机会。",
        updatedAt: 200,
      });
      expect(rowCount.count).toBe(1);
    } finally {
      projectDatabase.close();
    }
  });
});
