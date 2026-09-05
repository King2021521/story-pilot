import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Test } from "@nestjs/testing";
import {
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
  LongformPlanRepository,
  PlotRepository,
  PROJECT_DATABASE_FILE,
  WorldbuildingRepository,
  type WorldbuildingFields,
} from "@story-pilot/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MODEL_GATEWAY } from "../ai/model-gateway.provider.js";
import { ProjectModule } from "../project/project.module.js";
import { ProjectService } from "../project/project.service.js";
import { PlotModule } from "./plot.module.js";
import { LongformPlanService } from "./longform-plan.service.js";

describe("LongformPlanService AI context", () => {
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

  it("builds book-plan prompts from the full creative context, not just brief and blueprint", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-longform-context-"));
    tempDirs.push(rootDir);
    process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;
    const provider = new CapturingObjectProvider({
      bookPlan: {
        corePromise: "每一卷都推进钟楼旧案真相和主角身份选择。",
        endingDirection: "主角公开旧案真相，同时付出关系代价。",
        targetWordCount: 800000,
        title: "钟楼旧案全书规划",
      },
      riskNotes: [],
      volumePlans: [
        {
          arcs: [
            {
              arcIndex: 1,
              endChapterIndex: 30,
              escalation: ["旧信出现", "档案缺页", "主角被盯上"],
              purpose: "完成入局和第一个强反转。",
              startChapterIndex: 1,
              title: "旧信入局",
            },
          ],
          climax: "主角发现旧信编号对应失踪档案。",
          majorConflict: "主角追查旧案时被钟楼议会压制。",
          purpose: "建立世界规则、主线谜题和追读承诺。",
          targetWordCount: 200000,
          title: "第一卷：雨夜旧信",
          volumeIndex: 1,
        },
      ],
    });

    const moduleRef = await Test.createTestingModule({
      imports: [ProjectModule, PlotModule],
    })
      .overrideProvider(MODEL_GATEWAY)
      .useValue(new ModelGateway(provider))
      .compile();
    try {
      const projectService = moduleRef.get(ProjectService);
      const longformPlanService = moduleRef.get(LongformPlanService);
      const project = await projectService.createProject({
        genre: "悬疑",
        style: "旧城推理",
        title: "长夜序章",
      });
      const projectDatabase = createProjectDatabase(join(project.rootPath, PROJECT_DATABASE_FILE));
      try {
        seedCreativeContext(projectDatabase, project.id);
      } finally {
        projectDatabase.close();
      }

      await longformPlanService.generateBookPlan({
        projectId: project.id,
        targetWordCount: 800000,
        volumeCount: 4,
      });

      expect(provider.calls).toHaveLength(1);
      const [firstCall] = provider.calls;
      if (!firstCall) {
        throw new Error("expected model provider to receive a book plan generation call");
      }
      expect(firstCall).toMatchObject({
        maxOutputTokens: 12000,
        promptVersion: "book-plan.generate@v1",
        purpose: "book_plan_generate",
        temperature: 0.5,
      });
      const promptText = firstCall.messages.map((message) => message.content).join("\n");
      expect(promptText).toContain("模板：book-plan.generate@v1");
      expect(promptText).toContain("<worldbuildingProfile>");
      expect(promptText).toContain("<blueprint>");
      expect(promptText).toContain("近现代旧城悬疑世界");
      expect(promptText).toContain("顾砚");
      expect(promptText).toContain("谁烧毁了钟楼档案");
      expect(promptText).toContain("第一封旧信出现");
      expect(promptText).toContain("旧信编号");
      expect(promptText).toContain("estimatedWordCount");
      expect(promptText).toContain("800000");
    } finally {
      await moduleRef.close();
    }
  });

  it("builds rolling chapter prompts from registered templates and longform plans", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-rolling-context-"));
    tempDirs.push(rootDir);
    process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;
    const provider = new CapturingObjectProvider({
      chapterPlans: [
        {
          chapterGoal: "顾砚把旧信编号和卷内主线绑定，决定重查钟楼地窖。",
          chapterIndex: 11,
          conflict: "钟楼议会放出假线索，诱导顾砚离开真正的档案入口。",
          emotionalTurn: "顾砚从被动追查转为主动设局。",
          hook: "地窖墙面出现了与旧信相同的编号。",
          id: "draft_chapter_11",
          informationGain: "旧信编号并非寄信人自创，而是钟楼档案的内部索引。",
          relatedCharacterIds: ["character_gu_yan"],
          relatedForeshadowingIds: ["foreshadowing_letter_code"],
          relatedPlotlineIds: ["plotline_clocktower_case"],
          scenes: [
            {
              conflictTurn: "议会线人抢先烧掉公开档案，逼顾砚转向地窖暗格。",
              id: "draft_scene_11_1",
              memoryTargets: ["旧信编号", "钟楼地窖入口"],
              outcome: "顾砚确认旧信编号可指向被删档案。",
              povCharacterId: "character_gu_yan",
              sceneGoal: "验证旧信编号的真实来源。",
              sceneIndex: 1,
            },
          ],
          targetWordCount: 3500,
          title: "第十一章 地窖索引",
        },
      ],
      riskNotes: [],
    });

    const moduleRef = await Test.createTestingModule({
      imports: [ProjectModule, PlotModule],
    })
      .overrideProvider(MODEL_GATEWAY)
      .useValue(new ModelGateway(provider))
      .compile();
    try {
      const projectService = moduleRef.get(ProjectService);
      const longformPlanService = moduleRef.get(LongformPlanService);
      const project = await projectService.createProject({
        genre: "悬疑",
        style: "旧城推理",
        title: "长夜序章",
      });
      const projectDatabase = createProjectDatabase(join(project.rootPath, PROJECT_DATABASE_FILE));
      let volumePlanId = "";
      try {
        seedCreativeContext(projectDatabase, project.id);
        const seededPlan = seedLongformPlan(projectDatabase, project.id);
        volumePlanId = seededPlan.volumePlanId;
      } finally {
        projectDatabase.close();
      }

      await longformPlanService.generateRollingOutline({
        chapterCount: 10,
        projectId: project.id,
        startChapterIndex: 11,
        volumePlanId,
      });

      expect(provider.calls).toHaveLength(1);
      const [firstCall] = provider.calls;
      if (!firstCall) {
        throw new Error("expected model provider to receive a rolling chapter plan call");
      }
      expect(firstCall).toMatchObject({
        maxOutputTokens: 12000,
        promptVersion: "rolling-chapter-plan.generate@v1",
        purpose: "rolling_chapter_plan_generate",
        temperature: 0.45,
      });
      const promptText = firstCall.messages.map((message) => message.content).join("\n");
      expect(promptText).toContain("模板：rolling-chapter-plan.generate@v1");
      expect(promptText).toContain("<longformPlans>");
      expect(promptText).toContain("钟楼旧案全书规划");
      expect(promptText).toContain("第一卷：雨夜旧信");
      expect(promptText).toContain("第 11 章开始生成未来 10 章");
      expect(promptText).toContain("旧信编号");
    } finally {
      await moduleRef.close();
    }
  });
});

function seedCreativeContext(
  projectDatabase: ReturnType<typeof createProjectDatabase>,
  projectId: string,
): void {
  const creativePathRepository = new CreativePathRepository(projectDatabase);
  creativePathRepository.saveBrief({
    briefId: "brief_1",
    emotionalRewards: ["旧案反转", "真相逼近"],
    estimatedChapterCount: 260,
    estimatedWordCount: 800000,
    genre: "悬疑",
    initialIdea: "雨夜旧信把主角拖回十年前钟楼火灾。",
    lengthProfile: "长篇连载",
    narrativePov: "第三人称限知",
    projectId,
    subgenres: ["旧城推理"],
  });
  creativePathRepository.saveBlueprintForm({
    blueprintId: "blueprint_1",
    fields: {
      antagonistForce: "钟楼议会和被旧案保护的既得利益者。",
      corePromise: "每个单元推进一条硬线索，并以身份反转收束。",
      differentiators: ["旧信编号与档案缺页形成线索网"],
      emotionalAxes: ["悬疑", "反转"],
      logline: "雨夜旧信把主角拖回十年前钟楼旧案。",
      mainConflict: "主角追查真相时不断触碰旧城秩序。",
      mainGoal: "找出钟楼火灾真相。",
      premise: "旧城钟楼火灾十年后，主角收到一封不该存在的旧信。",
      protagonistArc: "从逃避旧案到主动承担真相代价。",
      risks: ["线索密度不足会削弱追读"],
      stakes: "失败会让旧案幸存者再次被清算。",
      storyDriver: "mystery",
    },
    projectId,
  });
  new WorldbuildingRepository(projectDatabase).saveProfile({
    fields: worldbuildingFields({
      coreConflict: "旧城秩序依靠隐藏真相维持，主角追查旧案必然破坏平衡。",
      history: "十年前钟楼火灾改变了旧城权力结构。",
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
    traits: [
      {
        name: "secret",
        traitId: randomUUID(),
        value: "顾砚手里有一页被烧焦的钟楼档案。",
      },
    ],
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
        participantId: randomUUID(),
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
    seedEventLinkId: randomUUID(),
    status: "seeded",
    title: "旧信编号",
  });
  const plotline = plotRepository.createPlotline({
    centralQuestion: "谁烧毁了钟楼档案？",
    driver: "每封旧信揭开一个旧案矛盾。",
    emotionalPromise: "线索逼近真相时持续给出身份反转。",
    kind: "main",
    midEscalation: "顾砚发现寄信人可能是旧案凶手。",
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
}

function seedLongformPlan(
  projectDatabase: ReturnType<typeof createProjectDatabase>,
  projectId: string,
): { readonly volumePlanId: string; readonly arcPlanId: string } {
  const result = new LongformPlanRepository(projectDatabase).createBookPlanHierarchy({
    bookPlanId: "book_plan_clocktower",
    corePromise: "每一卷都推进旧信、档案和身份代价三条压力线。",
    endingDirection: "顾砚公开钟楼真相，但必须承担旧城秩序崩塌后的选择。",
    projectId,
    targetWordCount: 800000,
    title: "钟楼旧案全书规划",
    volumes: [
      {
        arcs: [
          {
            arcIndex: 1,
            arcPlanId: "arc_plan_old_letter",
            endChapterIndex: 40,
            escalation: ["旧信编号", "档案缺页", "地窖入口"],
            purpose: "完成旧信主谜题的首次升级。",
            startChapterIndex: 1,
            title: "旧信入局",
          },
        ],
        climax: "顾砚发现旧信编号来自钟楼内部档案系统。",
        majorConflict: "顾砚追查旧信时被钟楼议会压制。",
        purpose: "建立追读承诺、主线谜题和旧城秩序压力。",
        targetWordCount: 200000,
        title: "第一卷：雨夜旧信",
        volumeIndex: 1,
        volumePlanId: "volume_plan_rain_letter",
      },
    ],
  });

  return {
    arcPlanId: result.arcPlans[0]?.id ?? "arc_plan_old_letter",
    volumePlanId: result.volumePlans[0]?.id ?? "volume_plan_rain_letter",
  };
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
