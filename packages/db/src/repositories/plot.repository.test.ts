import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createProjectDatabase, runProjectMigrations } from "../project-database.js";
import {
  type CreatePlotlineRecordInput,
  type PlotlineNodeRecord,
  type PlotlineRecord,
  PlotRepository,
} from "./plot.repository.js";
import { ProjectRepository } from "./project.repository.js";

interface StorylineProfileInput extends CreatePlotlineRecordInput {
  readonly centralQuestion: string;
  readonly driver: string;
  readonly emotionalPromise: string;
  readonly importance: string;
  readonly midEscalation: string;
  readonly narrativeRole: string;
  readonly payoffPlan: string;
  readonly relatedCharacterIds: readonly string[];
  readonly relatedForeshadowingIds: readonly string[];
  readonly relatedStoryEventIds: readonly string[];
  readonly relatedWorldRuleIds: readonly string[];
  readonly startState: string;
  readonly status: string;
}

interface PlotRepositoryWithStorylineProfile {
  createPlotline(input: StorylineProfileInput): PlotlineRecord;
  createPlotlineNode(input: {
    readonly chapterHint?: string;
    readonly description?: string;
    readonly kind: string;
    readonly now?: number;
    readonly plotlineId: string;
    readonly plotlineNodeId: string;
    readonly position?: number;
    readonly projectId: string;
    readonly status?: string;
    readonly targetChapterId?: string;
    readonly title: string;
  }): PlotlineNodeRecord;
  listPlotlines(projectId: string): PlotlineRecord[];
  updatePlotline(input: {
    readonly payoffPlan?: string;
    readonly plotlineId: string;
    readonly projectId: string;
    readonly relatedCharacterIds?: readonly string[];
    readonly status?: string;
  }): PlotlineRecord;
}

describe("PlotRepository", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("stores storyline profile fields and timeline nodes", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "story-pilot-plotline-profile-"));
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

      const repository = new PlotRepository(projectDatabase) as PlotRepositoryWithStorylineProfile;
      const created = repository.createPlotline({
        centralQuestion: "旧信到底是谁寄出的？",
        driver: "每三章投放一条可验证线索，并用一次误导制造新问题。",
        emotionalPromise: "持续悬疑、逼近真相和人物承担代价的爽感。",
        importance: "core",
        kind: "mystery",
        midEscalation: "线索从旧信转向档案伪造和证人追杀。",
        narrativeRole: "secret_reveal",
        now: 1,
        payoffPlan: "在卷末揭示寄信人身份，并回收信纸水印伏笔。",
        plotlineId: "plotline_1",
        priority: 5,
        projectId: "project_1",
        relatedCharacterIds: ["character_1"],
        relatedForeshadowingIds: ["foreshadowing_1"],
        relatedStoryEventIds: ["event_1"],
        relatedWorldRuleIds: ["world_rule_1"],
        startState: "主角只知道旧信存在，不知道背后牵连旧案。",
        status: "planning",
        summary: "围绕旧信来源展开的调查线。",
        title: "旧信谜团",
      });

      expect(created).toMatchObject({
        centralQuestion: "旧信到底是谁寄出的？",
        importance: "core",
        name: "旧信谜团",
        narrativeRole: "secret_reveal",
        nodes: [],
        relatedCharacterIds: ["character_1"],
        relatedWorldRuleIds: ["world_rule_1"],
      });

      const node = repository.createPlotlineNode({
        chapterHint: "第 3 章",
        description: "让读者看到信纸水印，但暂时不解释来源。",
        kind: "seed",
        now: 2,
        plotlineId: "plotline_1",
        plotlineNodeId: "plotline_node_1",
        position: 1,
        projectId: "project_1",
        status: "planned",
        title: "信纸水印出现",
      });

      expect(node).toMatchObject({
        chapterHint: "第 3 章",
        description: "让读者看到信纸水印，但暂时不解释来源。",
        kind: "seed",
        position: 1,
        title: "信纸水印出现",
      });

      expect(repository.listPlotlines("project_1")).toEqual([
        expect.objectContaining({
          emotionalPromise: "持续悬疑、逼近真相和人物承担代价的爽感。",
          nodes: [
            expect.objectContaining({
              chapterHint: "第 3 章",
              title: "信纸水印出现",
            }),
          ],
          payoffPlan: "在卷末揭示寄信人身份，并回收信纸水印伏笔。",
          relatedForeshadowingIds: ["foreshadowing_1"],
        }),
      ]);

      const updated = repository.updatePlotline({
        payoffPlan: "第 20 章揭示寄信人并改变主角目标。",
        plotlineId: "plotline_1",
        projectId: "project_1",
        relatedCharacterIds: [],
        status: "active",
      });

      expect(updated).toMatchObject({
        nodes: [
          expect.objectContaining({
            chapterHint: "第 3 章",
            title: "信纸水印出现",
          }),
        ],
        payoffPlan: "第 20 章揭示寄信人并改变主角目标。",
        relatedCharacterIds: [],
        status: "active",
      });
    } finally {
      projectDatabase.close();
    }
  });
});
