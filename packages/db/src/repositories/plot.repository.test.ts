import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createProjectDatabase, runProjectMigrations } from "../project-database.js";
import {
  type CreatePlotlineRecordInput,
  type ForeshadowingRecord,
  type PlotlineNodeRecord,
  type PlotlineRecord,
  PlotRepository,
  type StoryEventRecord,
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
  deletePlotline(input: { readonly plotlineId: string; readonly projectId: string }): void;
  listPlotlines(projectId: string): PlotlineRecord[];
  updatePlotline(input: {
    readonly payoffPlan?: string;
    readonly plotlineId: string;
    readonly projectId: string;
    readonly relatedCharacterIds?: readonly string[];
    readonly status?: string;
  }): PlotlineRecord;
}

interface StoryEventWithWorkspaceFields extends StoryEventRecord {
  readonly chapterId: string | null;
  readonly sceneId: string | null;
  readonly storyTime: string | null;
}

interface ForeshadowingWithWorkspaceFields extends ForeshadowingRecord {
  readonly importance: number;
}

interface PlotRepositoryWithPlotNodeWorkspace {
  createStoryEvent(input: {
    readonly eventId: string;
    readonly eventType: string;
    readonly chapterId?: string;
    readonly description: string;
    readonly now?: number;
    readonly participants: readonly {
      readonly participantId: string;
      readonly entityId: string;
      readonly entityType: string;
      readonly role: string;
    }[];
    readonly projectId: string;
    readonly status?: string;
    readonly storyTime?: string;
    readonly title: string;
  }): StoryEventWithWorkspaceFields;
  updateStoryEvent(input: {
    readonly chapterId?: string | null;
    readonly description?: string;
    readonly eventType?: string;
    readonly now?: number;
    readonly participants?: readonly {
      readonly participantId: string;
      readonly entityId: string;
      readonly entityType: string;
      readonly role: string;
    }[];
    readonly projectId: string;
    readonly status?: string;
    readonly storyEventId: string;
    readonly storyTime?: string | null;
    readonly title?: string;
  }): StoryEventWithWorkspaceFields;
  createForeshadowing(input: {
    readonly description: string;
    readonly foreshadowingId: string;
    readonly importance?: number;
    readonly now?: number;
    readonly payoffExpectation?: string;
    readonly projectId: string;
    readonly seedEventId?: string;
    readonly seedEventLinkId?: string;
    readonly status?: string;
    readonly title: string;
  }): ForeshadowingWithWorkspaceFields;
  updateForeshadowing(input: {
    readonly description?: string;
    readonly foreshadowingId: string;
    readonly importance?: number;
    readonly now?: number;
    readonly payoffEventId?: string | null;
    readonly payoffEventLinkId?: string;
    readonly payoffExpectation?: string | null;
    readonly projectId: string;
    readonly seedEventId?: string | null;
    readonly seedEventLinkId?: string;
    readonly status?: string;
    readonly title?: string;
  }): ForeshadowingWithWorkspaceFields;
  listForeshadowings(projectId: string): ForeshadowingWithWorkspaceFields[];
  listStoryEvents(projectId: string): StoryEventWithWorkspaceFields[];
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

      repository.deletePlotline({
        plotlineId: "plotline_1",
        projectId: "project_1",
      });
      expect(repository.listPlotlines("project_1")).toEqual([]);
    } finally {
      projectDatabase.close();
    }
  });

  it("persists editable plot node and foreshadowing workspace fields", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "story-pilot-plot-nodes-"));
    tempDirs.push(tempDir);
    const projectDatabase = createProjectDatabase(join(tempDir, "project.sqlite"));

    try {
      await runProjectMigrations(projectDatabase);
      new ProjectRepository(projectDatabase).createProject({
        defaultVolumeId: "volume_1",
        genre: "权谋",
        projectId: "project_1",
        rootPath: tempDir,
        title: "布衣天子",
        workId: "work_1",
      });

      const repository = new PlotRepository(projectDatabase) as PlotRepositoryWithPlotNodeWorkspace;
      const seedEvent = repository.createStoryEvent({
        description: "秦钰收到带水印的旧信。",
        eventId: "event_seed",
        eventType: "discovery",
        now: 1,
        participants: [],
        projectId: "project_1",
        status: "draft",
        storyTime: "第 1 章夜雨",
        title: "旧信出现",
      });
      repository.createStoryEvent({
        description: "秦钰在公堂指出档案被调包。",
        eventId: "event_payoff",
        eventType: "reveal",
        now: 2,
        participants: [],
        projectId: "project_1",
        title: "档案调包真相",
      });

      expect(seedEvent).toMatchObject({
        status: "draft",
        storyTime: "第 1 章夜雨",
      });

      const updatedEvent = repository.updateStoryEvent({
        description: "秦钰确认旧信水印来自官府档案纸。",
        eventType: "reveal",
        now: 3,
        participants: [
          {
            entityId: "character_qinyu",
            entityType: "character",
            participantId: "participant_1",
            role: "actor",
          },
        ],
        projectId: "project_1",
        status: "canon",
        storyEventId: "event_seed",
        storyTime: "第 3 章公堂前",
        title: "水印来源暴露",
      });

      expect(updatedEvent).toMatchObject({
        eventType: "reveal",
        participants: [expect.objectContaining({ entityId: "character_qinyu", role: "actor" })],
        status: "canon",
        storyTime: "第 3 章公堂前",
        summary: "秦钰确认旧信水印来自官府档案纸。",
        title: "水印来源暴露",
      });

      const createdForeshadowing = repository.createForeshadowing({
        description: "信纸水印第一次出现，暂不解释来源。",
        foreshadowingId: "foreshadowing_1",
        importance: 4,
        now: 4,
        projectId: "project_1",
        seedEventId: "event_seed",
        seedEventLinkId: "seed_link_1",
        status: "seeded",
        title: "信纸水印",
      });

      expect(createdForeshadowing).toMatchObject({
        importance: 4,
        links: [expect.objectContaining({ eventId: "event_seed", role: "seed" })],
        status: "seeded",
      });

      const updatedForeshadowing = repository.updateForeshadowing({
        description: "水印像是普通纸纹，实则是官府档案纸暗纹。",
        foreshadowingId: "foreshadowing_1",
        importance: 5,
        now: 5,
        payoffEventId: "event_payoff",
        payoffEventLinkId: "payoff_link_1",
        payoffExpectation: "第 20 章揭示水印证明档案调包。",
        projectId: "project_1",
        status: "payoff_ready",
        title: "档案纸水印",
      });

      expect(updatedForeshadowing).toMatchObject({
        importance: 5,
        links: expect.arrayContaining([
          expect.objectContaining({ eventId: "event_seed", role: "seed" }),
          expect.objectContaining({ eventId: "event_payoff", role: "payoff" }),
        ]),
        payoffText: "第 20 章揭示水印证明档案调包。",
        seedText: "水印像是普通纸纹，实则是官府档案纸暗纹。",
        status: "payoff_ready",
        title: "档案纸水印",
      });
      expect(repository.listForeshadowings("project_1")).toEqual([
        expect.objectContaining({ importance: 5, title: "档案纸水印" }),
      ]);
      expect(repository.listStoryEvents("project_1")[0]).toMatchObject({
        storyTime: "第 3 章公堂前",
        title: "水印来源暴露",
      });
    } finally {
      projectDatabase.close();
    }
  });
});
