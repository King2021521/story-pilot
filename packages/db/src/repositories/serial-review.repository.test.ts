import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createProjectDatabase,
  PROJECT_DATABASE_FILE,
  ProjectRepository,
  runProjectMigrations,
} from "../index.js";
import { SerialReviewRepository } from "./serial-review.repository.js";

describe("SerialReviewRepository", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("stores adopted serial review reports with structured risks and next actions", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "story-pilot-serial-review-"));
    tempDirs.push(tempDir);
    const projectDatabase = createProjectDatabase(join(tempDir, PROJECT_DATABASE_FILE));

    try {
      await runProjectMigrations(projectDatabase);
      const project = new ProjectRepository(projectDatabase).createProject({
        defaultVolumeId: "volume_1",
        genre: "冰雪末世",
        projectId: "project_1",
        rootPath: tempDir,
        title: "雪境堡垒",
        workId: "work_1",
      });
      const repository = new SerialReviewRepository(projectDatabase);

      const saved = repository.save({
        characterStagnation: [
          {
            characterId: "character_shen_yan",
            evidence: "第 6-10 章都在被动守门，没有主动策略变化。",
            suggestion: "让沈砚主动设计一次假热源钓出追踪者。",
          },
        ],
        endChapterIndex: 10,
        nextActions: [
          {
            actionType: "plot_debt_fix",
            targetId: "plot_debt_heat_source",
            title: "在第 11 章强化炉芯追踪者线索",
          },
        ],
        plotDebtRisks: [
          {
            plotDebtId: "plot_debt_heat_source",
            riskLevel: "high",
            suggestion: "继续延后会削弱第一卷追读钩子。",
          },
        ],
        progressSummary: "前 10 章完成安全屋初建，但外部威胁升级不足。",
        promiseDelivery: [
          {
            evidence: "第 1、5、9 章都有安全屋升级兑现。",
            promise: "安全屋持续升级",
            score: 82,
          },
        ],
        projectId: project.id,
        repetitionRisks: ["连续三章以外部敲门制造压力，冲突形态重复。"],
        reviewId: "serial_review_1",
        rhythmReport: {
          issue: "第 7-9 章信息增量偏低。",
          score: 76,
          suggestion: "插入一次资源账目反转或内部背叛。",
        },
        scope: "chapter_batch",
        sourceArtifactId: "artifact_serial_review_1",
        startChapterIndex: 1,
        status: "applied",
      });

      expect(saved).toMatchObject({
        endChapterIndex: 10,
        id: "serial_review_1",
        progressSummary: "前 10 章完成安全屋初建，但外部威胁升级不足。",
        scope: "chapter_batch",
        sourceArtifactId: "artifact_serial_review_1",
        startChapterIndex: 1,
        status: "applied",
      });
      expect(saved.promiseDelivery).toEqual([
        {
          evidence: "第 1、5、9 章都有安全屋升级兑现。",
          promise: "安全屋持续升级",
          score: 82,
        },
      ]);
      expect(saved.plotDebtRisks).toEqual([
        {
          plotDebtId: "plot_debt_heat_source",
          riskLevel: "high",
          suggestion: "继续延后会削弱第一卷追读钩子。",
        },
      ]);
      expect(repository.listByProject(project.id)).toHaveLength(1);
      expect(repository.getById(project.id, "serial_review_1")).toMatchObject({
        nextActions: [
          {
            actionType: "plot_debt_fix",
            targetId: "plot_debt_heat_source",
            title: "在第 11 章强化炉芯追踪者线索",
          },
        ],
      });
    } finally {
      projectDatabase.close();
    }
  });
});
