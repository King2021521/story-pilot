import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Test, type TestingModule } from "@nestjs/testing";
import { FakeModelProvider, ModelGateway } from "@story-pilot/ai";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MODEL_GATEWAY } from "../ai/model-gateway.provider.js";
import { ChapterModule } from "../chapter/chapter.module.js";
import { ChapterService } from "../chapter/chapter.service.js";
import { CharacterModule } from "../character/character.module.js";
import { CharacterService } from "../character/character.service.js";
import { PlotModule } from "../plot/plot.module.js";
import { ForeshadowingService } from "../plot/foreshadowing.service.js";
import { StoryEventService } from "../plot/story-event.service.js";
import { ProjectModule } from "../project/project.module.js";
import { ProjectService } from "../project/project.service.js";
import { GraphModule } from "./graph.module.js";
import { GraphService } from "./graph.service.js";

describe("GraphService", () => {
  const tempDirs: string[] = [];
  let originalProjectsRoot: string | undefined;
  let moduleRef: TestingModule | undefined;

  beforeEach(() => {
    originalProjectsRoot = process.env.STORY_PILOT_PROJECTS_ROOT;
  });

  afterEach(async () => {
    await moduleRef?.close();
    moduleRef = undefined;

    if (originalProjectsRoot === undefined) {
      delete process.env.STORY_PILOT_PROJECTS_ROOT;
    } else {
      process.env.STORY_PILOT_PROJECTS_ROOT = originalProjectsRoot;
    }

    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("rebuilds graph projections from character relation domain events", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-graph-service-"));
    tempDirs.push(rootDir);
    process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;

    moduleRef = await Test.createTestingModule({
      imports: [ProjectModule, CharacterModule, GraphModule],
    }).compile();
    const projectService = moduleRef.get(ProjectService);
    const characterService = moduleRef.get(CharacterService);
    const graphService = moduleRef.get(GraphService);

    const project = await projectService.createProject({ title: "长夜序章", genre: "悬疑" });
    const protagonist = await characterService.createCharacter({
      projectId: project.id,
      name: "林澈",
      role: "protagonist",
    });
    const antagonist = await characterService.createCharacter({
      projectId: project.id,
      name: "周潜",
      role: "antagonist",
    });
    await characterService.createRelation({
      projectId: project.id,
      sourceEntityType: "character",
      sourceEntityId: protagonist.id,
      relationType: "suspects",
      targetEntityType: "character",
      targetEntityId: antagonist.id,
    });

    const rebuildResult = await graphService.rebuild(project.id);
    expect(rebuildResult.projectedEvents).toBeGreaterThanOrEqual(3);
    await expect(
      graphService.getNeighborhood({
        projectId: project.id,
        entityId: protagonist.id,
      }),
    ).resolves.toMatchObject({
      edges: [
        expect.objectContaining({
          label: "suspects",
          sourceId: protagonist.id,
          targetId: antagonist.id,
        }),
      ],
    });
  });

  it("rebuilds foreshadowing links from story event domain events", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-graph-service-"));
    tempDirs.push(rootDir);
    process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;

    moduleRef = await Test.createTestingModule({
      imports: [ProjectModule, PlotModule, GraphModule],
    }).compile();
    const projectService = moduleRef.get(ProjectService);
    const storyEventService = moduleRef.get(StoryEventService);
    const foreshadowingService = moduleRef.get(ForeshadowingService);
    const graphService = moduleRef.get(GraphService);

    const project = await projectService.createProject({ title: "长夜序章", genre: "悬疑" });
    const seedEvent = await storyEventService.createStoryEvent({
      projectId: project.id,
      title: "旧报纸日期",
      description: "门缝下的旧报纸露出十年前的日期。",
      eventType: "discovery",
    });
    const payoffEvent = await storyEventService.createStoryEvent({
      projectId: project.id,
      title: "火灾真相",
      description: "旧报纸日期对应伪造火灾报告的当天。",
      eventType: "reveal",
    });
    const foreshadowing = await foreshadowingService.createForeshadowing({
      projectId: project.id,
      title: "旧报纸日期",
      description: "用报纸日期埋下旧案时间线矛盾。",
      payoffExpectation: "揭示十年前的火灾不是事故。",
      seedEventId: seedEvent.id,
      payoffEventId: payoffEvent.id,
    });

    await graphService.rebuild(project.id);

    await expect(
      graphService.getNeighborhood({
        projectId: project.id,
        entityId: foreshadowing.id,
      }),
    ).resolves.toMatchObject({
      edges: expect.arrayContaining([
        expect.objectContaining({ label: "seeds", targetId: seedEvent.id }),
        expect.objectContaining({ label: "pays_off", targetId: payoffEvent.id }),
      ]),
    });
  });

  it("rebuilds chapter neighborhoods and artifact-generated memory candidates from service events", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-graph-service-"));
    tempDirs.push(rootDir);
    process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;

    moduleRef = await Test.createTestingModule({
      imports: [ProjectModule, CharacterModule, ChapterModule, PlotModule, GraphModule],
    })
      .overrideProvider(MODEL_GATEWAY)
      .useValue(
        new ModelGateway(
          new FakeModelProvider({
            objectResponses: {
              ChapterDraftOutput: {
                draft: {
                  body: "雨夜里，林鸢从门缝下抽出一封旧信。",
                  summary: "林鸢发现旧信。",
                  title: "雨夜来信",
                },
                memoryCandidates: [
                  {
                    confidence: 0.8,
                    content: "林鸢发现一封来历异常的旧信。",
                    entityId: "char_linyuan",
                    entityType: "character",
                    kind: "event",
                  },
                ],
                reviewNotes: ["旧信来历仍需用户确认。"],
              },
            },
          }),
        ),
      )
      .compile();
    const projectService = moduleRef.get(ProjectService);
    const characterService = moduleRef.get(CharacterService);
    const chapterService = moduleRef.get(ChapterService);
    const storyEventService = moduleRef.get(StoryEventService);
    const foreshadowingService = moduleRef.get(ForeshadowingService);
    const graphService = moduleRef.get(GraphService);

    const project = await projectService.createProject({ title: "长夜序章", genre: "悬疑" });
    const chapter = await chapterService.createChapter({
      projectId: project.id,
      title: "第一章",
      volumeId: project.defaultVolumeId,
    });
    const linyuan = await characterService.createCharacter({
      projectId: project.id,
      name: "林鸢",
      role: "protagonist",
    });
    const guyan = await characterService.createCharacter({
      projectId: project.id,
      name: "顾晏",
      role: "support",
    });
    const zhouqian = await characterService.createCharacter({
      projectId: project.id,
      name: "周潜",
      role: "antagonist",
    });
    await characterService.createRelation({
      projectId: project.id,
      relationType: "knows",
      sourceEntityId: linyuan.id,
      sourceEntityType: "character",
      targetEntityId: guyan.id,
      targetEntityType: "character",
    });
    await characterService.createRelation({
      projectId: project.id,
      relationType: "opposes",
      sourceEntityId: guyan.id,
      sourceEntityType: "character",
      targetEntityId: zhouqian.id,
      targetEntityType: "character",
    });
    const seedEvent = await storyEventService.createStoryEvent({
      chapterId: chapter.id,
      description: "林鸢发现旧报纸日期。",
      eventType: "discovery",
      participants: [{ entityId: linyuan.id, entityType: "character", role: "actor" }],
      projectId: project.id,
      title: "旧报纸日期",
    });
    const foreshadowing = await foreshadowingService.createForeshadowing({
      description: "信纸水印暗示十年前档案。",
      projectId: project.id,
      seedEventId: seedEvent.id,
      title: "水印伏笔",
    });
    const draft = await chapterService.generateDraft({
      chapterId: chapter.id,
      projectId: project.id,
    });

    await graphService.rebuild(project.id);

    await expect(
      graphService.getNeighborhood({
        depth: 2,
        entityId: chapter.id,
        projectId: project.id,
      }),
    ).resolves.toMatchObject({
      nodes: expect.arrayContaining([
        expect.objectContaining({ id: chapter.id, type: "chapter" }),
        expect.objectContaining({ id: seedEvent.id, type: "story_event" }),
        expect.objectContaining({ id: linyuan.id, type: "character" }),
        expect.objectContaining({ id: foreshadowing.id, type: "foreshadowing" }),
      ]),
    });
    await expect(
      graphService.getNeighborhood({
        depth: 2,
        entityId: linyuan.id,
        projectId: project.id,
      }),
    ).resolves.toMatchObject({
      nodes: expect.arrayContaining([
        expect.objectContaining({ id: zhouqian.id, type: "character" }),
      ]),
    });
    await expect(
      graphService.getNeighborhood({
        depth: 1,
        entityId: draft.artifact.id,
        projectId: project.id,
      }),
    ).resolves.toMatchObject({
      nodes: expect.arrayContaining([
        expect.objectContaining({ id: draft.artifact.id, type: "artifact" }),
        expect.objectContaining({ type: "memory_candidate" }),
      ]),
    });
  });
});
