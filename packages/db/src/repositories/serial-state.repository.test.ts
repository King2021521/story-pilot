import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  ChapterRepository,
  CharacterRepository,
  createProjectDatabase,
  PROJECT_DATABASE_FILE,
  ProjectRepository,
  runProjectMigrations,
} from "../index.js";
import { SerialStateRepository } from "./serial-state.repository.js";

describe("SerialStateRepository", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("saves plot debts and updates lifecycle fields without losing arrays", async () => {
    const { projectDatabase, projectId } = await createHarness(tempDirs);
    try {
      const repository = new SerialStateRepository(projectDatabase);

      const saved = repository.savePlotDebt({
        debtId: "plot_debt_1",
        debtType: "reader_promise",
        expectedPayoffChapterIndex: 18,
        lifecycleNotes: ["第 1 章种下安全屋升级承诺"],
        promise: "安全屋每一阶段升级都必须伴随更高代价。",
        projectId,
        relatedCharacterIds: ["character_shen_yan"],
        relatedForeshadowingId: "foreshadowing_furnace",
        relatedPlotlineId: "plotline_safe_house",
        relatedWorldRuleIds: ["world_rule_heat"],
        riskLevel: "high",
        seedChapterIndex: 1,
        status: "open",
        title: "安全屋升级承诺",
      });

      expect(saved).toMatchObject({
        debtType: "reader_promise",
        expectedPayoffChapterIndex: 18,
        relatedCharacterIds: ["character_shen_yan"],
        relatedWorldRuleIds: ["world_rule_heat"],
        riskLevel: "high",
        status: "open",
      });

      const updated = repository.savePlotDebt({
        ...saved,
        actualPayoffChapterIndex: 20,
        lifecycleNotes: [...saved.lifecycleNotes, "第 20 章以炉芯失控兑现升级代价"],
        status: "paid_off",
      });

      expect(updated).toMatchObject({
        actualPayoffChapterIndex: 20,
        id: "plot_debt_1",
        lifecycleNotes: ["第 1 章种下安全屋升级承诺", "第 20 章以炉芯失控兑现升级代价"],
        status: "paid_off",
      });
      expect(repository.listPlotDebts({ projectId, status: ["paid_off"] })).toHaveLength(1);
      expect(repository.listPlotDebts({ projectId, riskLevel: ["high"] })).toHaveLength(1);
    } finally {
      projectDatabase.close();
    }
  });

  it("stores story and character snapshots and returns the latest by chapter index first", async () => {
    const { projectDatabase, projectId } = await createHarness(tempDirs);
    try {
      const repository = new SerialStateRepository(projectDatabase);

      repository.createStorySnapshot({
        activeConflicts: ["外部补给线争夺"],
        chapterId: "chapter_1",
        chapterIndex: 1,
        currentArcPlanId: "arc_plan_1",
        currentVolumeId: "volume_plan_1",
        globalSituation: "冻雨刚刚开始，城市供热崩溃。",
        hiddenInformation: ["冰冠计划仍被封存"],
        locationState: { bunker: "未暴露" },
        openQuestions: ["炉芯信号从何而来"],
        organizationState: { oldOrder: "仍在广播维稳" },
        projectId,
        resourceState: { heat: "短时可用" },
        revealedInformation: ["旧堡垒存在热源接口"],
        storySnapshotId: "state_1",
        storyTime: "极寒第 1 天",
      });
      const latest = repository.createStorySnapshot({
        activeConflicts: ["炉芯所有权争夺"],
        chapterId: "chapter_5",
        chapterIndex: 5,
        globalSituation: "安全屋成为周边幸存者争夺目标。",
        hiddenInformation: ["炉芯追踪信号来源未知"],
        locationState: { bunker: "半暴露" },
        openQuestions: ["谁能远程追踪炉芯"],
        organizationState: { convoy: "开始接近霜脊山" },
        projectId,
        resourceState: { heat: "可维持 12 小时" },
        revealedInformation: ["炉芯会消耗稀缺电池"],
        storySnapshotId: "state_5",
      });

      repository.createCharacterSnapshot({
        characterId: "character_shen_yan",
        chapterId: "chapter_5",
        chapterIndex: 5,
        emotionalState: "警惕但开始承担边界选择。",
        externalGoal: "守住安全屋热源。",
        internalNeed: "学会信任有限的同盟。",
        knowledgeState: "知道炉芯会暴露坐标。",
        physicalState: "低温疲惫。",
        position: "霜脊山旧堡垒",
        projectId,
        relationshipState: { zhou: "条件同盟" },
        resourceState: { battery: "剩余 3 组" },
        riskFlags: ["暴露风险"],
        secrets: ["隐瞒炉芯日志"],
        sourceId: "artifact_delta_1",
        sourceType: "state_delta_artifact",
        stateSnapshotId: "character_state_5",
      });

      expect(repository.getLatestStorySnapshot(projectId)).toMatchObject({
        id: latest.id,
        chapterIndex: 5,
        openQuestions: ["谁能远程追踪炉芯"],
      });
      expect(
        repository.listCharacterSnapshots({
          characterId: "character_shen_yan",
          projectId,
        }),
      ).toEqual([
        expect.objectContaining({
          characterId: "character_shen_yan",
          relationshipState: { zhou: "条件同盟" },
          riskFlags: ["暴露风险"],
        }),
      ]);
    } finally {
      projectDatabase.close();
    }
  });
});

async function createHarness(tempDirs: string[]) {
  const tempDir = mkdtempSync(join(tmpdir(), "story-pilot-serial-state-"));
  tempDirs.push(tempDir);
  const projectDatabase = createProjectDatabase(join(tempDir, PROJECT_DATABASE_FILE));
  await runProjectMigrations(projectDatabase);
  const project = new ProjectRepository(projectDatabase).createProject({
    defaultVolumeId: "volume_1",
    genre: "冰雪末世",
    projectId: "project_1",
    rootPath: tempDir,
    title: "雪境堡垒",
    workId: "work_1",
  });
  new ChapterRepository(projectDatabase).createChapter({
    chapterId: "chapter_1",
    projectId: project.id,
    summary: "沈砚第一次听到炉芯预警。",
    title: "第一章 炉芯预警",
    volumeId: "volume_1",
  });
  new ChapterRepository(projectDatabase).createChapter({
    chapterId: "chapter_5",
    projectId: project.id,
    summary: "安全屋暴露在邻里冲突中。",
    title: "第五章 雪夜敲门",
    volumeId: "volume_1",
  });
  new CharacterRepository(projectDatabase).createCharacter({
    characterId: "character_shen_yan",
    name: "沈砚",
    projectId: project.id,
    role: "protagonist",
    traits: [],
  });

  return { projectDatabase, projectId: project.id };
}
