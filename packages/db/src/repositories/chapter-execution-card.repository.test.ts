import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createProjectDatabase,
  ChapterRepository,
  PROJECT_DATABASE_FILE,
  ProjectRepository,
  runProjectMigrations,
} from "../index.js";
import { LongformPlanRepository } from "./longform-plan.repository.js";
import { ChapterExecutionCardRepository } from "./chapter-execution-card.repository.js";

describe("ChapterExecutionCardRepository", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("saves execution cards with scene briefs and increments version on edit", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "story-pilot-execution-card-"));
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
      const chapterPlan = new LongformPlanRepository(projectDatabase).saveChapterPlan({
        arcPlanId: null,
        chapterGoal: "沈砚第一次验证安全屋供热闭环。",
        chapterIndex: 1,
        chapterPlanId: "chapter_plan_1",
        conflict: "外部冻雨和邻居求援同时压来。",
        emotionalTurn: "从谨慎囤积转向承担边界选择。",
        hook: "炉芯短暂启动后记录到三小时前的未知预警。",
        informationGain: "旧堡垒地下有被封存的热源接口。",
        projectId: project.id,
        relatedCharacterIds: ["character_shen_yan"],
        relatedForeshadowingIds: ["foreshadowing_furnace_signal"],
        relatedPlotlineIds: ["plotline_safe_house"],
        status: "draft",
        targetWordCount: 3500,
        title: "第一章 炉芯预警",
      });
      new ChapterRepository(projectDatabase).createChapter({
        chapterId: "chapter_1",
        projectId: project.id,
        summary: "沈砚第一次验证安全屋供热闭环。",
        title: "第一章 炉芯预警",
        volumeId: project.defaultVolumeId,
      });
      const repository = new ChapterExecutionCardRepository(projectDatabase);

      const saved = repository.save({
        cardId: "card_1",
        chapterIndex: 1,
        chapterId: "chapter_1",
        chapterPlanId: chapterPlan.id,
        coreConflict: "沈砚必须在验证热源闭环和暴露安全屋位置之间作出选择。",
        emotionalTurn: "他意识到安全屋不是孤立堡垒，而是会吸引所有幸存者欲望的坐标。",
        forbiddenMoves: ["不要让热源永久稳定", "不要提前揭示冰冠计划真相"],
        hook: "炉芯日志里出现了三小时前不可能存在的预警。",
        informationGain: "地下热源接口确实存在，但需要消耗稀缺电池完成短时启动。",
        narrativeGoal: "让读者看到安全屋第一次从囤货空间转为末世秩序核心。",
        povCharacterId: "character_shen_yan",
        projectId: project.id,
        readerReward: "给出安全屋升级的即时回报，同时留下热源来源谜题。",
        relatedForeshadowingIds: ["foreshadowing_furnace_signal"],
        relatedPlotDebtIds: ["plot_debt_heat_source"],
        relatedPlotlineIds: ["plotline_safe_house"],
        requiredCharacterIds: ["character_shen_yan"],
        requiredLocationIds: ["location_old_bunker"],
        sceneBriefs: [
          {
            conflictTurn: "邻居敲门声迫使他关掉外部照明。",
            memoryTargets: ["炉芯日志", "安全屋外部暴露风险"],
            outcome: "热源短时启动成功，但位置风险上升。",
            sceneGoal: "验证安全屋供热闭环。",
            sceneIndex: 1,
          },
        ],
        sourceArtifactId: "artifact_card_draft_1",
        status: "draft",
        targetWordCount: 3500,
        title: "第一章 炉芯预警",
      });

      expect(saved).toMatchObject({
        chapterPlanId: chapterPlan.id,
        hook: "炉芯日志里出现了三小时前不可能存在的预警。",
        relatedPlotDebtIds: ["plot_debt_heat_source"],
        requiredLocationIds: ["location_old_bunker"],
        sourceArtifactId: "artifact_card_draft_1",
        status: "draft",
        version: 1,
      });
      expect(saved.sceneBriefs).toEqual([
        {
          conflictTurn: "邻居敲门声迫使他关掉外部照明。",
          memoryTargets: ["炉芯日志", "安全屋外部暴露风险"],
          outcome: "热源短时启动成功，但位置风险上升。",
          sceneGoal: "验证安全屋供热闭环。",
          sceneIndex: 1,
        },
      ]);

      const updated = repository.save({
        ...saved,
        coreConflict: "沈砚必须决定是否用第一次炉芯启动换取外部幸存者的信任。",
        status: "confirmed",
      });

      expect(updated).toMatchObject({
        coreConflict: "沈砚必须决定是否用第一次炉芯启动换取外部幸存者的信任。",
        id: "card_1",
        status: "confirmed",
        version: 2,
      });
      expect(repository.listByChapterPlan(project.id, chapterPlan.id)).toHaveLength(1);
      expect(repository.getById(project.id, "card_1")).toMatchObject({
        readerReward: "给出安全屋升级的即时回报，同时留下热源来源谜题。",
      });
      expect(repository.getLatestByChapter(project.id, "chapter_1")).toMatchObject({
        id: "card_1",
        status: "confirmed",
      });
    } finally {
      projectDatabase.close();
    }
  });
});
