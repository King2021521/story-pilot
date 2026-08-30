import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Test } from "@nestjs/testing";
import {
  FakeModelProvider,
  ModelGateway,
  type ModelProvider,
  type ProviderEmbedInput,
  type ProviderEmbedResult,
  type ProviderGenerateObjectInput,
  type ProviderObjectResult,
  type ProviderStreamTextInput,
} from "@story-pilot/ai";
import {
  CharacterRepository,
  createProjectDatabase,
  CreativePathRepository,
  PlotRepository,
  PROJECT_DATABASE_FILE,
  WorldbuildingRepository,
  type WorldbuildingFields,
} from "@story-pilot/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AiModule } from "../ai/ai.module.js";
import { MODEL_GATEWAY } from "../ai/model-gateway.provider.js";
import { ProjectModule } from "../project/project.module.js";
import { ProjectService } from "../project/project.service.js";
import { ChapterModule } from "./chapter.module.js";
import { ChapterService } from "./chapter.service.js";

describe("ChapterService.generateDraft", () => {
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

  it("creates a draft artifact and pending memory candidates without mutating chapter content", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-draft-"));
    tempDirs.push(rootDir);
    process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;

    const moduleRef = await Test.createTestingModule({
      imports: [ProjectModule, AiModule, ChapterModule],
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
                    entityType: "story_event",
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
    const chapterService = moduleRef.get(ChapterService);

    const project = await projectService.createProject({
      genre: "悬疑",
      title: "长夜序章",
    });
    const chapter = await chapterService.createChapter({
      projectId: project.id,
      title: "第一章",
      volumeId: project.defaultVolumeId,
    });
    const saved = await chapterService.saveContent({
      baseVersion: 0,
      chapterId: chapter.id,
      content: "用户正文保持不变。",
      projectId: project.id,
    });

    const result = await chapterService.generateDraft({
      chapterId: chapter.id,
      instruction: "生成更强钩子的第一章草稿",
      projectId: project.id,
    });

    expect(result.artifact).toMatchObject({
      body: expect.stringContaining("旧信"),
      kind: "chapter_draft",
      status: "pending",
      targetId: chapter.id,
      targetType: "chapter",
    });
    expect(result.memoryCandidates).toEqual([
      expect.objectContaining({
        content: "林鸢发现一封来历异常的旧信。",
        status: "pending",
      }),
    ]);

    const projectDatabase = createProjectDatabase(join(project.rootPath, PROJECT_DATABASE_FILE));
    try {
      expect(
        projectDatabase.client
          .prepare("select content, version from chapters where id = ?")
          .get(chapter.id),
      ).toEqual({
        content: "用户正文保持不变。",
        version: saved.version,
      });
      expect(
        projectDatabase.client
          .prepare("select kind, status, target_id from artifacts where id = ?")
          .get(result.artifact.id),
      ).toMatchObject({
        kind: "chapter_draft",
        status: "pending",
        target_id: chapter.id,
      });
      expect(
        projectDatabase.client
          .prepare("select content, status from memory_candidates where source_id = ?")
          .all(result.artifact.id),
      ).toEqual([
        expect.objectContaining({
          content: "林鸢发现一封来历异常的旧信。",
          status: "pending",
        }),
      ]);
    } finally {
      projectDatabase.close();
    }
  });

  it("includes project inspiration and planning assets when generating a chapter draft", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-draft-context-"));
    tempDirs.push(rootDir);
    process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;
    const provider = new CapturingObjectProvider({
      draft: {
        body: "顾砚在雨夜拆开第一封旧信。",
        summary: "顾砚发现旧信编号和钟楼档案缺页有关。",
        title: "雨夜旧信",
      },
      memoryCandidates: [],
      reviewNotes: [],
    });

    const moduleRef = await Test.createTestingModule({
      imports: [ProjectModule, AiModule, ChapterModule],
    })
      .overrideProvider(MODEL_GATEWAY)
      .useValue(new ModelGateway(provider))
      .compile();
    const projectService = moduleRef.get(ProjectService);
    const chapterService = moduleRef.get(ChapterService);

    try {
      const project = await projectService.createProject({
        genre: "悬疑",
        style: "旧城推理",
        title: "长夜序章",
      });
      seedChapterCreativeContext(project.rootPath, project.id);
      const chapter = await chapterService.createChapter({
        projectId: project.id,
        title: "第一章",
        volumeId: project.defaultVolumeId,
      });

      await chapterService.generateDraft({
        chapterId: chapter.id,
        instruction: "根据已有故事线写出第一章草稿",
        projectId: project.id,
      });

      expect(provider.calls).toHaveLength(1);
      const [firstCall] = provider.calls;
      if (!firstCall) {
        throw new Error("expected model provider to receive a chapter draft call");
      }
      expect(firstCall).toMatchObject({
        maxOutputTokens: 12000,
        purpose: "chapter_draft",
        temperature: 0.82,
      });
      const promptText = firstCall.messages.map((message) => message.content).join("\n");
      expect(promptText).toContain("近现代旧城悬疑世界");
      expect(promptText).toContain("顾砚");
      expect(promptText).toContain("谁烧毁了钟楼档案");
      expect(promptText).toContain("第一封旧信出现");
      expect(promptText).toContain("旧信编号");
      expect(promptText).toContain("雨夜旧信把主角拖回十年前钟楼火灾");
    } finally {
      await moduleRef.close();
    }
  });
});

function seedChapterCreativeContext(rootPath: string, projectId: string): void {
  const projectDatabase = createProjectDatabase(join(rootPath, PROJECT_DATABASE_FILE));
  try {
    new CreativePathRepository(projectDatabase).saveBrief({
      briefId: "brief_1",
      emotionalRewards: ["旧案反转"],
      estimatedChapterCount: 260,
      estimatedWordCount: 800000,
      genre: "悬疑",
      initialIdea: "雨夜旧信把主角拖回十年前钟楼火灾。",
      lengthProfile: "长篇连载",
      projectId,
      subgenres: ["旧城推理"],
    });
    new WorldbuildingRepository(projectDatabase).saveProfile({
      fields: worldbuildingFields({
        coreConflict: "旧城秩序依靠隐藏真相维持。",
        rules: "任何人不得私自带走钟楼档案。",
        worldBase: "近现代旧城悬疑世界。",
      }),
      projectId,
    });
    const character = new CharacterRepository(projectDatabase).createCharacter({
      archetype: "旧案幸存者",
      characterId: "character_gu_yan",
      importance: "core",
      motivation: "查清父亲失踪和钟楼火灾的关系。",
      name: "顾砚",
      projectId,
      role: "protagonist",
      storyTask: "推动旧案调查并承担真相代价。",
      traits: [],
    });
    const plotRepository = new PlotRepository(projectDatabase);
    const event = plotRepository.createStoryEvent({
      description: "第一封旧信出现，信纸编号指向钟楼档案缺页。",
      eventId: "event_first_letter",
      eventType: "discovery",
      participants: [
        {
          entityId: character.id,
          entityType: "character",
          participantId: "participant_gu_yan",
          role: "finder",
        },
      ],
      projectId,
      status: "planned",
      storyTime: "第 1 章雨夜",
      title: "第一封旧信出现",
    });
    const foreshadowing = plotRepository.createForeshadowing({
      description: "旧信编号每次出现都对应一段被删改档案。",
      foreshadowingId: "foreshadowing_letter_code",
      importance: 5,
      payoffExpectation: "中卷揭示编号来自钟楼议会内部。",
      projectId,
      seedEventId: event.id,
      seedEventLinkId: "foreshadowing_seed_link",
      status: "seeded",
      title: "旧信编号",
    });
    const plotline = plotRepository.createPlotline({
      centralQuestion: "谁烧毁了钟楼档案？",
      driver: "每封旧信揭开一个旧案矛盾。",
      emotionalPromise: "线索逼近真相时持续给出身份反转。",
      kind: "main",
      payoffPlan: "终卷公开钟楼档案真相。",
      plotlineId: "plotline_clocktower_case",
      priority: 10,
      projectId,
      relatedCharacterIds: [character.id],
      relatedForeshadowingIds: [foreshadowing.id],
      relatedStoryEventIds: [event.id],
      startState: "顾砚只想远离旧城。",
      summary: "顾砚追查钟楼火灾与旧信来源。",
      title: "钟楼旧案主线",
    });
    plotRepository.createPlotlineNode({
      chapterHint: "第 1-3 章",
      description: "顾砚发现第一封旧信和档案缺页之间的对应关系。",
      kind: "discovery",
      plotlineId: plotline.id,
      plotlineNodeId: "node_first_letter",
      position: 1,
      projectId,
      status: "planned",
      title: "旧信与缺页对应",
    });
  } finally {
    projectDatabase.close();
  }
}

function worldbuildingFields(overrides: Partial<WorldbuildingFields>): WorldbuildingFields {
  return {
    coreConflict: "",
    culture: "",
    economy: "",
    factions: "",
    geography: "",
    history: "",
    powerOrder: "",
    powerSystem: "",
    rules: "",
    socialStructure: "",
    specialMechanism: "",
    worldBase: "",
    ...overrides,
  };
}

class CapturingObjectProvider implements ModelProvider {
  readonly calls: ProviderGenerateObjectInput[] = [];
  readonly model = "capture-model";
  readonly name = "capture";

  constructor(private readonly object: unknown) {}

  async generateObject(input: ProviderGenerateObjectInput): Promise<ProviderObjectResult> {
    this.calls.push(input);

    return {
      object: this.object,
      raw: { object: this.object },
    };
  }

  streamText(_input: ProviderStreamTextInput): AsyncIterable<string> {
    void _input;
    return (async function* emptyStream() {})();
  }

  async embed(_input: ProviderEmbedInput): Promise<ProviderEmbedResult> {
    void _input;
    return { embedding: [] };
  }
}
