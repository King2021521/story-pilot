import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ProjectModule } from "../project/project.module.js";
import { ProjectService } from "../project/project.service.js";
import { PlotModule } from "./plot.module.js";
import { type CreatePlotlineInput, PlotlineService } from "./plotline.service.js";

interface PlotlineServiceWithStorylineProfile {
  createNode(input: {
    readonly chapterHint?: string;
    readonly description?: string;
    readonly kind: string;
    readonly plotlineId: string;
    readonly position?: number;
    readonly projectId: string;
    readonly status?: string;
    readonly targetChapterId?: string;
    readonly title: string;
  }): Promise<Record<string, unknown>>;
  createPlotline(
    input: CreatePlotlineInput & {
      readonly centralQuestion?: string;
      readonly driver?: string;
      readonly emotionalPromise?: string;
      readonly importance?: string;
      readonly midEscalation?: string;
      readonly narrativeRole?: string;
      readonly payoffPlan?: string;
      readonly relatedCharacterIds?: readonly string[];
      readonly relatedForeshadowingIds?: readonly string[];
      readonly relatedStoryEventIds?: readonly string[];
      readonly relatedWorldRuleIds?: readonly string[];
      readonly startState?: string;
      readonly status?: string;
    },
  ): Promise<Record<string, unknown>>;
  listPlotlines(projectId: string): Promise<Array<Record<string, unknown>>>;
  updatePlotline(input: {
    readonly patch: Record<string, unknown>;
    readonly plotlineId: string;
    readonly projectId: string;
  }): Promise<Record<string, unknown>>;
}

describe("PlotlineService", () => {
  const tempDirs: string[] = [];
  let originalProjectsRoot: string | undefined;

  beforeEach(() => {
    originalProjectsRoot = process.env.STORY_PILOT_PROJECTS_ROOT;
  });

  afterEach(() => {
    if (originalProjectsRoot === undefined) {
      delete process.env.STORY_PILOT_PROJECTS_ROOT;
    } else {
      process.env.STORY_PILOT_PROJECTS_ROOT = originalProjectsRoot;
    }

    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("creates plotlines for organizing story threads", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-plotlines-"));
    tempDirs.push(rootDir);
    process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;

    const moduleRef = await Test.createTestingModule({
      imports: [ProjectModule, PlotModule],
    }).compile();
    const projectService = moduleRef.get(ProjectService);
    const plotlineService = moduleRef.get(PlotlineService) as PlotlineServiceWithStorylineProfile;

    const project = await projectService.createProject({ title: "长夜序章", genre: "悬疑" });
    const plotline = await plotlineService.createPlotline({
      centralQuestion: "旧案真凶是谁？",
      driver: "每三章给出一条线索，并用误导制造新的选择压力。",
      emotionalPromise: "让读者持续获得解谜、反转和真相逼近的期待。",
      importance: "core",
      projectId: project.id,
      title: "旧案主线",
      kind: "main",
      midEscalation: "主角从查信件来源转向查档案伪造链。",
      narrativeRole: "main_drive",
      payoffPlan: "卷末揭露旧案真凶，同时打开更大的保护伞。",
      summary: "围绕十年前火灾旧案展开。",
      priority: 10,
      relatedCharacterIds: ["character_1"],
      startState: "主角只收到旧信，没有证据。",
      status: "planning",
    });

    expect(plotline).toMatchObject({
      centralQuestion: "旧案真凶是谁？",
      importance: "core",
      name: "旧案主线",
      narrativeRole: "main_drive",
      priority: 10,
      status: "planning",
      type: "main",
    });

    const updated = await plotlineService.updatePlotline({
      patch: {
        payoffPlan: "第 20 章揭露旧案真凶，并让主角承担公开证据的代价。",
        relatedCharacterIds: [],
        status: "active",
      },
      plotlineId: plotline.id as string,
      projectId: project.id,
    });
    const node = await plotlineService.createNode({
      chapterHint: "第 3 章",
      description: "信纸水印第一次出现，但暂时不解释。",
      kind: "seed",
      plotlineId: plotline.id as string,
      position: 1,
      projectId: project.id,
      status: "planned",
      title: "信纸水印出现",
    });
    const plotlines = await plotlineService.listPlotlines(project.id);

    expect(updated).toMatchObject({
      payoffPlan: "第 20 章揭露旧案真凶，并让主角承担公开证据的代价。",
      relatedCharacterIds: [],
      status: "active",
    });
    expect(node).toMatchObject({
      chapterHint: "第 3 章",
      kind: "seed",
      title: "信纸水印出现",
    });
    expect(plotlines).toEqual([
      expect.objectContaining({
        nodes: [
          expect.objectContaining({
            chapterHint: "第 3 章",
            title: "信纸水印出现",
          }),
        ],
      }),
    ]);
  });
});
