import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createProjectDatabase, PROJECT_DATABASE_FILE, runProjectMigrations } from "../index.js";
import { LongformPlanRepository } from "./longform-plan.repository.js";
import { ProjectRepository } from "./project.repository.js";

describe("LongformPlanRepository", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("creates a layered book, volume, and arc plan hierarchy", async () => {
    const projectDatabase = await createProjectDatabaseWithProject(tempDirs);
    try {
      const repository = new LongformPlanRepository(projectDatabase);
      const result = repository.createBookPlanHierarchy({
        bookPlanId: "book_plan_1",
        corePromise: "每卷完成一次境界突破和一次关系反转。",
        endingDirection: "主角以失去旧身份为代价重塑天道。",
        projectId: "project_1",
        sourceArtifactId: "artifact_book_plan_1",
        targetWordCount: 3_000_000,
        title: "全书规划",
        volumes: [
          {
            arcs: [
              {
                arcIndex: 1,
                arcPlanId: "arc_plan_1",
                endChapterIndex: 20,
                escalation: ["发现禁令", "第一次越界", "暴露代价"],
                purpose: "建立修行规则和第一重代价。",
                startChapterIndex: 1,
                title: "星潮初醒",
              },
            ],
            climax: "主角公开打破司星阁第一条禁令。",
            majorConflict: "主角想借星潮修行，司星阁禁止底层接触星潮。",
            purpose: "完成世界规则展示和主角初次突破。",
            targetWordCount: 360_000,
            title: "第一卷 星潮初醒",
            volumeIndex: 1,
            volumePlanId: "volume_plan_1",
          },
        ],
      });

      expect(result.bookPlan).toMatchObject({
        corePromise: "每卷完成一次境界突破和一次关系反转。",
        id: "book_plan_1",
        projectId: "project_1",
        sourceArtifactId: "artifact_book_plan_1",
        status: "draft",
        targetWordCount: 3_000_000,
      });
      expect(result.volumePlans).toHaveLength(1);
      expect(result.arcPlans).toEqual([
        expect.objectContaining({
          endChapterIndex: 20,
          escalation: ["发现禁令", "第一次越界", "暴露代价"],
          id: "arc_plan_1",
          startChapterIndex: 1,
          volumePlanId: "volume_plan_1",
        }),
      ]);
      expect(repository.listBookPlans("project_1")).toHaveLength(1);
      expect(repository.listVolumePlans("project_1", "book_plan_1")).toHaveLength(1);
      expect(repository.listArcPlans("project_1", "volume_plan_1")).toHaveLength(1);
    } finally {
      projectDatabase.close();
    }
  });

  it("saves editable book, volume, and arc plan drafts", async () => {
    const projectDatabase = await createProjectDatabaseWithProject(tempDirs);
    try {
      const repository = new LongformPlanRepository(projectDatabase);

      const bookPlan = repository.saveBookPlanDraft({
        bookPlanId: "book_plan_draft_1",
        corePromise: "每卷完成一次权力反转和一次代价兑现。",
        endingDirection: "主角放弃旧身份重建星潮秩序。",
        mainPlotlineId: "plotline_1",
        now: 10,
        projectId: "project_1",
        status: "active",
        targetWordCount: 2_400_000,
        title: "星潮纪全书大纲",
      });
      const volumePlan = repository.saveVolumePlan({
        bookPlanId: bookPlan.id,
        climax: "主角公开违反司星阁禁令。",
        majorConflict: "主角需要星潮救人，司星阁垄断星潮。",
        now: 20,
        projectId: "project_1",
        purpose: "建立世界压迫、修行规则和主角第一次破局。",
        status: "draft",
        targetWordCount: 360_000,
        title: "第一卷 星潮初醒",
        volumeIndex: 1,
        volumePlanId: "volume_plan_draft_1",
      });
      const arcPlan = repository.saveArcPlan({
        arcIndex: 1,
        arcPlanId: "arc_plan_draft_1",
        characterArcId: "character_arc_1",
        endChapterIndex: 20,
        escalation: ["发现禁令", "第一次越界", "暴露代价"],
        now: 30,
        plotlineId: "plotline_1",
        projectId: "project_1",
        purpose: "用二十章完成主角从被动求生到主动越界。",
        startChapterIndex: 1,
        status: "draft",
        title: "禁令破口",
        volumePlanId: volumePlan.id,
      });

      expect(bookPlan).toMatchObject({
        corePromise: "每卷完成一次权力反转和一次代价兑现。",
        endingDirection: "主角放弃旧身份重建星潮秩序。",
        id: "book_plan_draft_1",
        mainPlotlineId: "plotline_1",
        status: "active",
        targetWordCount: 2_400_000,
      });
      expect(volumePlan).toMatchObject({
        bookPlanId: "book_plan_draft_1",
        majorConflict: "主角需要星潮救人，司星阁垄断星潮。",
        purpose: "建立世界压迫、修行规则和主角第一次破局。",
        targetWordCount: 360_000,
      });
      expect(arcPlan).toMatchObject({
        characterArcId: "character_arc_1",
        endChapterIndex: 20,
        escalation: ["发现禁令", "第一次越界", "暴露代价"],
        plotlineId: "plotline_1",
        startChapterIndex: 1,
      });

      const updatedBookPlan = repository.saveBookPlanDraft({
        bookPlanId: bookPlan.id,
        corePromise: "主线承诺改为每卷一次公开胜利和一次隐藏损失。",
        endingDirection: null,
        mainPlotlineId: null,
        now: 40,
        projectId: "project_1",
        status: "draft",
        targetWordCount: 2_600_000,
        title: "星潮纪全书大纲二版",
      });
      const updatedVolumePlan = repository.saveVolumePlan({
        bookPlanId: bookPlan.id,
        climax: null,
        majorConflict: "司星阁追捕主角，主角反向追查旧案。",
        now: 50,
        projectId: "project_1",
        purpose: "强化侦查线和第一次反击。",
        status: "active",
        targetWordCount: 420_000,
        title: "第一卷 旧信入局",
        volumeIndex: 1,
        volumePlanId: volumePlan.id,
      });
      const updatedArcPlan = repository.saveArcPlan({
        arcIndex: 2,
        arcPlanId: arcPlan.id,
        characterArcId: null,
        endChapterIndex: null,
        escalation: ["旧信出现", "线索误导"],
        now: 60,
        plotlineId: null,
        projectId: "project_1",
        purpose: "改为调查旧信来源。",
        startChapterIndex: null,
        status: "active",
        title: "旧信追查",
        volumePlanId: volumePlan.id,
      });

      expect(updatedBookPlan).toMatchObject({
        corePromise: "主线承诺改为每卷一次公开胜利和一次隐藏损失。",
        endingDirection: null,
        mainPlotlineId: null,
        targetWordCount: 2_600_000,
        title: "星潮纪全书大纲二版",
        version: 2,
      });
      expect(updatedVolumePlan).toMatchObject({
        climax: null,
        majorConflict: "司星阁追捕主角，主角反向追查旧案。",
        status: "active",
        targetWordCount: 420_000,
      });
      expect(updatedArcPlan).toMatchObject({
        arcIndex: 2,
        characterArcId: null,
        endChapterIndex: null,
        escalation: ["旧信出现", "线索误导"],
        plotlineId: null,
        startChapterIndex: null,
        status: "active",
      });
      expect(repository.listBookPlans("project_1")).toHaveLength(1);
      expect(repository.listVolumePlans("project_1", bookPlan.id)).toHaveLength(1);
      expect(repository.listArcPlans("project_1", volumePlan.id)).toHaveLength(1);
    } finally {
      projectDatabase.close();
    }
  });

  it("creates rolling chapter plans with scene plans and explicit references", async () => {
    const projectDatabase = await createProjectDatabaseWithProject(tempDirs);
    try {
      const repository = new LongformPlanRepository(projectDatabase);
      repository.createBookPlanHierarchy({
        bookPlanId: "book_plan_1",
        corePromise: "每十章完成一次冲突升级。",
        projectId: "project_1",
        targetWordCount: 3_000_000,
        title: "全书规划",
        volumes: [
          {
            arcs: [
              {
                arcIndex: 1,
                arcPlanId: "arc_plan_1",
                escalation: [],
                purpose: "启动主线。",
                title: "第一弧",
              },
            ],
            majorConflict: "主角与司星阁的第一轮正面冲突。",
            purpose: "启动主线。",
            targetWordCount: 300_000,
            title: "第一卷",
            volumeIndex: 1,
            volumePlanId: "volume_plan_1",
          },
        ],
      });

      const result = repository.createChapterPlans({
        chapterPlans: [
          {
            chapterGoal: "主角第一次触碰星潮禁令。",
            chapterIndex: 1,
            chapterPlanId: "chapter_plan_1",
            conflict: "求生需求与司星阁禁令冲突。",
            emotionalTurn: "从压抑到短暂掌控。",
            hook: "禁令背后的旧名单出现主角父亲名字。",
            informationGain: "星潮不是天灾，而是被人为管控的资源。",
            relatedCharacterIds: ["character_1"],
            relatedForeshadowingIds: ["foreshadowing_1"],
            relatedPlotlineIds: ["plotline_1"],
            scenes: [
              {
                conflictTurn: "守卫发现主角私入禁区。",
                memoryTargets: ["主角触碰星潮禁令"],
                outcome: "主角带走一枚碎星砂。",
                sceneGoal: "展示禁区规则和主角动机。",
                sceneIndex: 1,
                scenePlanId: "scene_plan_1",
              },
            ],
            targetWordCount: 3200,
            title: "第 1 章 星潮禁令",
          },
        ],
        defaultArcPlanId: "arc_plan_1",
        projectId: "project_1",
        sourceArtifactId: "artifact_rolling_1",
      });

      expect(result.chapterPlans).toEqual([
        expect.objectContaining({
          arcPlanId: "arc_plan_1",
          chapterGoal: "主角第一次触碰星潮禁令。",
          chapterIndex: 1,
          relatedCharacterIds: ["character_1"],
          relatedForeshadowingIds: ["foreshadowing_1"],
          relatedPlotlineIds: ["plotline_1"],
          sourceArtifactId: "artifact_rolling_1",
        }),
      ]);
      expect(result.scenePlans).toEqual([
        expect.objectContaining({
          chapterPlanId: "chapter_plan_1",
          conflictTurn: "守卫发现主角私入禁区。",
          memoryTargets: ["主角触碰星潮禁令"],
          sceneIndex: 1,
        }),
      ]);
      expect(repository.listChapterPlans("project_1")).toHaveLength(1);
      expect(repository.listScenePlans("project_1", "chapter_plan_1")).toHaveLength(1);
    } finally {
      projectDatabase.close();
    }
  });
});

async function createProjectDatabaseWithProject(tempDirs: string[]) {
  const tempDir = mkdtempSync(join(tmpdir(), "story-pilot-longform-plan-"));
  tempDirs.push(tempDir);
  const projectDatabase = createProjectDatabase(join(tempDir, PROJECT_DATABASE_FILE));
  await runProjectMigrations(projectDatabase);
  new ProjectRepository(projectDatabase).createProject({
    defaultVolumeId: "volume_1",
    genre: "玄幻",
    projectId: "project_1",
    rootPath: join(tempDir, "project_1"),
    title: "星潮纪",
    workId: "work_1",
  });

  return projectDatabase;
}
