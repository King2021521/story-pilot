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
  ArtifactRepository,
  ChapterExecutionCardRepository,
  createProjectDatabase,
  CreativePathRepository,
  LongformPlanRepository,
  PROJECT_DATABASE_FILE,
  WorldbuildingRepository,
  type WorldbuildingFields,
} from "@story-pilot/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MODEL_GATEWAY } from "../ai/model-gateway.provider.js";
import { ContextPackageModule } from "../context-package/context-package.module.js";
import { ProjectModule } from "../project/project.module.js";
import { ProjectService } from "../project/project.service.js";
import { ChapterExecutionCardService } from "./chapter-execution-card.service.js";
import { ChapterModule } from "./chapter.module.js";

describe("ChapterExecutionCardService", () => {
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

  it("generates an artifact from a chapter plan and only writes the card after apply", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-execution-card-service-"));
    tempDirs.push(rootDir);
    process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;
    const provider = new CapturingObjectProvider({
      card: {
        chapterIndex: 1,
        coreConflict:
          "沈砚必须在验证安全屋供热闭环和隐藏安全屋坐标之间作出选择，外部求援会把他的堡垒暴露给更大的秩序争夺，而他一旦拒绝救援又会失去未来建立秩序的第一批见证者，这个选择必须让安全屋收益、道德成本和外部窥探同时升级。",
        emotionalTurn:
          "他从只想独自囤积求生，转向承认任何安全屋都无法完全脱离人群和规则压力，也第一次意识到边界本身就是权力。",
        forbiddenMoves: ["不要让炉芯永久稳定", "不要提前揭示冰冠计划真相"],
        hook: "炉芯日志里出现了三小时前不可能存在的极寒预警，指向旧堡垒地下第二层，而那里本应在十年前就被永久封死。",
        informationGain:
          "地下热源接口确实存在，但第一次启动只能维持短时供热，并会留下可被追踪的热信号，这会把堡垒从隐蔽资产推向争夺中心。",
        narrativeGoal:
          "把第一章从单纯囤货推进到安全屋秩序诞生，让读者看到堡垒第一次升级、第一次暴露风险和主角第一次边界选择，并明确后续连载会围绕升级回报与外部代价持续拉扯，同时让冰雪末世的压迫感从环境灾害转向人群秩序。",
        povCharacterId: "character_shen_yan",
        readerReward:
          "完成安全屋供热闭环的首次兑现，让读者获得实用升级爽点，同时用热源来源和不可能预警制造继续追读的双重悬念。",
        relatedForeshadowingIds: ["foreshadowing_furnace_signal"],
        relatedPlotDebtIds: ["plot_debt_heat_source"],
        relatedPlotlineIds: ["plotline_safe_house"],
        requiredCharacterIds: ["character_shen_yan"],
        requiredLocationIds: ["location_old_bunker"],
        sceneBriefs: [
          {
            conflictTurn: "外部敲门声迫使沈砚关闭照明，热源启动和位置保密形成直接冲突。",
            memoryTargets: ["炉芯日志", "安全屋外部暴露风险"],
            outcome: "热源短时启动成功，但堡垒坐标可能已被北墙哨点捕捉，后续会引来第一轮资源窥探。",
            sceneGoal: "验证旧堡垒供热闭环并制造第一次安全边界选择，让升级回报和暴露代价同章出现。",
            sceneIndex: 1,
          },
        ],
        targetWordCount: 3500,
        title: "第一章 炉芯预警",
      },
      riskNotes: ["热源来源仍需在后续章节逐步揭示。"],
    });

    const moduleRef = await Test.createTestingModule({
      imports: [ProjectModule, ContextPackageModule, ChapterModule],
    })
      .overrideProvider(MODEL_GATEWAY)
      .useValue(new ModelGateway(provider))
      .compile();

    try {
      const projectService = moduleRef.get(ProjectService);
      const executionCardService = moduleRef.get(ChapterExecutionCardService);
      const project = await projectService.createProject({
        genre: "冰雪末世",
        style: "硬核生存、基地经营",
        title: "雪境堡垒",
        wordCountGoal: 5_000_000,
      });
      const projectDatabase = createProjectDatabase(join(project.rootPath, PROJECT_DATABASE_FILE));
      try {
        seedExecutionCardContext(projectDatabase, project.id);
      } finally {
        projectDatabase.close();
      }

      const generated = await executionCardService.generate({
        chapterPlanId: "chapter_plan_1",
        instruction: "强化安全屋升级兑现和章末钩子",
        projectId: project.id,
      });

      expect(generated.artifact).toMatchObject({
        kind: "chapter_execution_card_draft",
        status: "pending",
        targetId: "chapter_plan_1",
        targetType: "chapter_plan",
        title: "第一章 炉芯预警",
      });
      expect(provider.calls).toHaveLength(1);
      const [firstCall] = provider.calls;
      if (!firstCall) {
        throw new Error("expected model provider to receive an execution card call");
      }
      expect(firstCall).toMatchObject({
        maxOutputTokens: 7000,
        promptVersion: "chapter-execution-card.generate@v1",
        purpose: "chapter_execution_card_generate",
        schemaName: "ChapterExecutionCardOutput",
        temperature: 0.45,
      });
      const promptText = firstCall.messages.map((message) => message.content).join("\n");
      expect(promptText).toContain("模板：chapter-execution-card.generate@v1");
      expect(promptText).toContain("<chapterPlan>");
      expect(promptText).toContain("<contextPackage>");
      expect(promptText).toContain("安全屋热源争夺");
      expect(promptText).toContain("强化安全屋升级兑现和章末钩子");

      const afterGenerateDatabase = createProjectDatabase(
        join(project.rootPath, PROJECT_DATABASE_FILE),
      );
      try {
        expect(
          new ChapterExecutionCardRepository(afterGenerateDatabase).listByChapterPlan(
            project.id,
            "chapter_plan_1",
          ),
        ).toHaveLength(0);
        expect(
          new ArtifactRepository(afterGenerateDatabase).getById(project.id, generated.artifact.id),
        ).toMatchObject({ status: "pending" });
      } finally {
        afterGenerateDatabase.close();
      }

      const applied = await executionCardService.apply({
        artifactId: generated.artifact.id,
        projectId: project.id,
      });

      expect(applied).toMatchObject({
        chapterPlanId: "chapter_plan_1",
        readerReward:
          "完成安全屋供热闭环的首次兑现，让读者获得实用升级爽点，同时用热源来源和不可能预警制造继续追读的双重悬念。",
        relatedPlotDebtIds: ["plot_debt_heat_source"],
        sourceArtifactId: generated.artifact.id,
        status: "confirmed",
      });
      const afterApplyDatabase = createProjectDatabase(
        join(project.rootPath, PROJECT_DATABASE_FILE),
      );
      try {
        expect(
          new ChapterExecutionCardRepository(afterApplyDatabase).listByChapterPlan(
            project.id,
            "chapter_plan_1",
          ),
        ).toHaveLength(1);
        expect(
          new ArtifactRepository(afterApplyDatabase).getById(project.id, generated.artifact.id),
        ).toMatchObject({ status: "applied" });
      } finally {
        afterApplyDatabase.close();
      }
    } finally {
      await moduleRef.close();
    }
  });
});

function seedExecutionCardContext(
  projectDatabase: ReturnType<typeof createProjectDatabase>,
  projectId: string,
): void {
  new CreativePathRepository(projectDatabase).saveBrief({
    briefId: "brief_1",
    emotionalRewards: ["安全屋升级", "秩序争夺", "极寒压迫"],
    estimatedChapterCount: 1400,
    estimatedWordCount: 5_000_000,
    genre: "冰雪末世",
    initialIdea: "冰冠灾变前三小时，沈砚抢占霜脊山旧堡垒打造安全屋。",
    lengthProfile: "500 万字长篇连载",
    narrativePov: "第三人称限知",
    projectId,
    subgenres: ["安全屋", "基地经营"],
  });
  new CreativePathRepository(projectDatabase).saveBlueprintForm({
    fields: {
      antagonistForce: "北墙哨点、燃料票号和试图独占旧堡垒技术的财团残部。",
      corePromise: "每一阶段给出安全屋明确升级，同时制造更高层级的资源、人心和技术争夺。",
      differentiators: ["安全屋升级和群像秩序互相牵制"],
      emotionalAxes: ["生存压迫", "基地成长"],
      logline: "冰雪末世降临前，沈砚抢占旧堡垒打造安全屋。",
      mainConflict: "安全屋越强，越会吸引外部秩序和幸存者欲望。",
      mainGoal: "建立能延续文明火种的雪境堡垒。",
      premise: "极寒灾变不是单纯天灾，而是冰冠计划失败后的长期文明倒退。",
      protagonistArc: "从私人避难者转为新秩序的承担者。",
      risks: ["升级重复会变流水账，需要剧情债和人心冲突持续加压"],
      stakes: "失败意味着堡垒沦陷、热源被夺和幸存者秩序瓦解。",
      storyDriver: "survival_escalation",
    },
    projectId,
  });
  new WorldbuildingRepository(projectDatabase).saveProfile({
    fields: worldbuildingFields({
      coreConflict: "安全屋热源争夺决定谁能活过极寒阶段。",
      economy: "燃料、电池、药品和通行权成为硬通货。",
      rules: "热源启动会留下热信号，越稳定越容易被追踪。",
      worldBase: "太阳异常后，北半球进入不可逆极寒。",
    }),
    projectId,
  });
  new LongformPlanRepository(projectDatabase).saveChapterPlan({
    arcPlanId: null,
    chapterGoal: "沈砚第一次验证安全屋供热闭环。",
    chapterIndex: 1,
    chapterPlanId: "chapter_plan_1",
    conflict: "外部冻雨和邻居求援同时压来。",
    emotionalTurn: "从谨慎囤积转向承担边界选择。",
    hook: "炉芯短暂启动后记录到三小时前的未知预警。",
    informationGain: "旧堡垒地下有被封存的热源接口。",
    projectId,
    relatedCharacterIds: ["character_shen_yan"],
    relatedForeshadowingIds: ["foreshadowing_furnace_signal"],
    relatedPlotlineIds: ["plotline_safe_house"],
    status: "draft",
    targetWordCount: 3500,
    title: "第一章 炉芯预警",
  });
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
