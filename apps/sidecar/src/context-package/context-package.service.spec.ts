import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Test } from "@nestjs/testing";
import {
  CharacterRepository,
  ChapterRepository,
  createProjectDatabase,
  CreativePathRepository,
  LongformPlanRepository,
  PlotRepository,
  PROJECT_DATABASE_FILE,
  WorldbuildingRepository,
  type WorldbuildingFields,
} from "@story-pilot/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ProjectModule } from "../project/project.module.js";
import { ProjectService } from "../project/project.service.js";
import { ContextPackageModule } from "./context-package.module.js";
import { ContextPackageService } from "./context-package.service.js";

describe("ContextPackageService", () => {
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

  it("builds and persists a prioritized context package without full chapter text", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-context-service-"));
    tempDirs.push(rootDir);
    process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;

    const moduleRef = await Test.createTestingModule({
      imports: [ProjectModule, ContextPackageModule],
    }).compile();

    try {
      const projectService = moduleRef.get(ProjectService);
      const contextPackageService = moduleRef.get(ContextPackageService);
      const project = await projectService.createProject({
        genre: "冰雪末世",
        logline: "极寒降临，沈砚提前抢占霜脊山旧堡垒打造安全屋。",
        style: "硬核生存、基地经营、群像博弈",
        title: "雪境堡垒",
        wordCountGoal: 5_000_000,
      });

      const projectDatabase = createProjectDatabase(join(project.rootPath, PROJECT_DATABASE_FILE));
      try {
        seedContext(projectDatabase, project.id, project.defaultVolumeId);
      } finally {
        projectDatabase.close();
      }

      const contextPackage = await contextPackageService.buildPackage({
        projectId: project.id,
        purpose: "execution_card_generate",
        targetId: "chapter_plan_1",
        targetType: "chapter_plan",
        tokenBudget: 4000,
      });

      expect(contextPackage).toMatchObject({
        projectId: project.id,
        purpose: "execution_card_generate",
        strategy: "priority_budget_v1",
        targetId: "chapter_plan_1",
        targetType: "chapter_plan",
        tokenBudget: 4000,
      });
      expect(contextPackage.estimatedTokens).toBeLessThanOrEqual(4000);
      expect(contextPackage.items.map((item) => item.itemType)).toEqual(
        expect.arrayContaining([
          "project",
          "project_brief",
          "worldbuilding_profile",
          "story_blueprint",
          "character",
          "plotline",
          "conflict",
          "chapter_plan",
          "scene_plan",
          "recent_chapter_summary",
        ]),
      );
      expect(contextPackage.items.map((item) => item.content).join("\n")).toContain("雪境堡垒");
      expect(contextPackage.items.map((item) => item.content).join("\n")).toContain("沈砚");
      expect(contextPackage.items.map((item) => item.content).join("\n")).toContain(
        "安全屋热源争夺",
      );
      expect(contextPackage.items.map((item) => item.content).join("\n")).not.toContain(
        "FULL_TEXT_SHOULD_NOT_ENTER_CONTEXT",
      );

      const readBackProjectDatabase = createProjectDatabase(
        join(project.rootPath, PROJECT_DATABASE_FILE),
      );
      try {
        const row = readBackProjectDatabase.client
          .prepare("select * from generation_context_packages where project_id = ?")
          .get(project.id) as { items_json: string; omitted_items_json: string } | undefined;
        expect(row).toBeDefined();
        expect(JSON.parse(row?.items_json ?? "[]")).toHaveLength(contextPackage.items.length);
        expect(JSON.parse(row?.omitted_items_json ?? "[]")).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              sourceId: "chapter_1",
              sourceType: "chapter_full_text",
            }),
          ]),
        );
      } finally {
        readBackProjectDatabase.close();
      }
    } finally {
      await moduleRef.close();
    }
  });
});

function seedContext(
  projectDatabase: ReturnType<typeof createProjectDatabase>,
  projectId: string,
  volumeId: string,
) {
  const creativePathRepository = new CreativePathRepository(projectDatabase);
  creativePathRepository.saveBrief({
    briefId: "brief_1",
    emotionalRewards: ["安全屋升级", "极寒压迫", "资源博弈"],
    estimatedChapterCount: 1500,
    estimatedWordCount: 5_000_000,
    genre: "冰雪末世",
    initialIdea: "沈砚提前收到三小时预警，抢先占据霜脊山旧堡垒。",
    lengthProfile: "500 万字长篇连载",
    narrativePov: "第三人称限知",
    projectId,
    subgenres: ["安全屋", "基地经营"],
  });
  creativePathRepository.saveBlueprintForm({
    blueprintId: "blueprint_1",
    fields: {
      antagonistForce: "财团残部、冻港黑市和掌握冰冠旧资料的地下组织。",
      corePromise: "每一阶段都完成一次安全屋升级，同时引出更高层级的资源争夺和旧计划真相。",
      differentiators: ["安全屋升级和人心秩序绑定", "冰冠计划作为长期谜题"],
      emotionalAxes: ["压迫", "爽点", "背叛", "秩序重建"],
      logline: "极寒降临，防灾工程师沈砚把旧堡垒升级成安全屋。",
      mainConflict: "沈砚要守住安全屋并建立秩序，外部势力和内部人性不断消耗他的底线。",
      mainGoal: "建立一套能让普通人延续文明的暖源秩序。",
      premise: "冰雪末世临近，主角凭借旧工程经验和三小时预警抢占旧堡垒。",
      protagonistArc: "从只保护自己到承担秩序代价。",
      risks: ["只写升级会变流水账，需要剧情债和人心冲突持续加压"],
      stakes: "失败意味着安全屋被夺，幸存者重新跌回极寒和暴力。",
      storyDriver: "survival",
    },
    projectId,
  });
  new WorldbuildingRepository(projectDatabase).saveProfile({
    fields: worldbuildingFields({
      coreConflict: "热源、秩序和真相不能同时低成本获得，每次扩张都会制造新的权力冲突。",
      economy: "燃料、电池、药品、净水芯和通行权成为核心交换物。",
      worldBase: "太阳活动异常后，北半球进入不可逆极寒。",
    }),
    projectId,
  });
  new CharacterRepository(projectDatabase).createCharacter({
    characterId: "character_shen_yan",
    genderAge: "男，32 岁，防灾工程师",
    importance: "core",
    name: "沈砚",
    narrativeFunction: "viewpoint",
    projectId,
    role: "protagonist",
    storyTask: "用工程能力把旧堡垒升级为安全屋，并在扩张中承担秩序代价。",
    traits: [],
  });
  const plotRepository = new PlotRepository(projectDatabase);
  plotRepository.createPlotline({
    centralQuestion: "安全屋能否从私人避难所变成可持续城邦？",
    driver: "每次扩张都需要新的热源、人员和规则。",
    emotionalPromise: "安全屋升级爽点和人性选择同时推进。",
    importance: "core",
    kind: "main",
    narrativeRole: "main_drive",
    payoffPlan: "最终公开冰冠计划真相，并重建热源秩序。",
    plotlineId: "plotline_main",
    priority: 1,
    projectId,
    startState: "旧堡垒只是一处废弃防灾工程。",
    summary: "主线：雪境堡垒从私人安全屋升级为北境城邦。",
    title: "安全屋热源争夺",
  });
  plotRepository.createConflict({
    conflictId: "conflict_heat",
    conflictType: "resource",
    escalationPath: ["柴油争夺", "热泵芯片", "地下热源"],
    opposingForces: ["沈砚", "冻港黑市"],
    projectId,
    relatedPlotlineId: "plotline_main",
    stakes: "失去热源意味着安全屋无法扩容。",
    title: "安全屋热源争夺",
  });
  const longformRepository = new LongformPlanRepository(projectDatabase);
  const bookPlan = longformRepository.saveBookPlanDraft({
    bookPlanId: "book_plan_1",
    corePromise: "500 万字中持续交替兑现安全屋升级、秩序博弈和冰冠真相。",
    endingDirection: "沈砚建立北境暖源联盟，但必须牺牲旧身份。",
    mainPlotlineId: "plotline_main",
    projectId,
    status: "active",
    targetWordCount: 5_000_000,
    title: "雪境堡垒 500 万字全书计划",
  });
  const volumePlan = longformRepository.saveVolumePlan({
    bookPlanId: bookPlan.id,
    climax: "旧堡垒第一次公开抵抗外部夺取。",
    majorConflict: "主角要完成安全屋初建，外部幸存者和黑市开始盯上热源。",
    projectId,
    purpose: "建立灾变压力、安全屋爽点和第一阶段资源规则。",
    status: "active",
    targetWordCount: 500_000,
    title: "第一卷 白灾入屋",
    volumeIndex: 1,
    volumePlanId: "volume_plan_1",
  });
  const arcPlan = longformRepository.saveArcPlan({
    arcIndex: 1,
    arcPlanId: "arc_plan_1",
    characterArcId: null,
    endChapterIndex: 20,
    escalation: ["三小时预警", "抢占旧堡垒", "热泵短启"],
    plotlineId: "plotline_main",
    projectId,
    purpose: "让安全屋第一次成立，但留下燃料和真相压力。",
    startChapterIndex: 1,
    status: "active",
    title: "旧堡垒启动",
    volumePlanId: volumePlan.id,
  });
  longformRepository.createChapterPlans({
    chapterPlans: [
      {
        arcPlanId: arcPlan.id,
        chapterGoal: "沈砚抢先进入旧堡垒，启动第一条热源回路。",
        chapterIndex: 1,
        chapterPlanId: "chapter_plan_1",
        conflict: "临时管委会和冻港黑市都想掌控旧堡垒仓库。",
        emotionalTurn: "沈砚从独自求生转向有限选择盟友。",
        hook: "热泵日志出现三小时前的冰冠预警编号。",
        informationGain: "极寒不是普通天灾，旧堡垒与冰冠计划有关。",
        relatedCharacterIds: ["character_shen_yan"],
        relatedForeshadowingIds: [],
        relatedPlotlineIds: ["plotline_main"],
        scenes: [
          {
            conflictTurn: "仓库钥匙被管委会扣下。",
            memoryTargets: ["沈砚知道旧堡垒备用热泵位置"],
            outcome: "备用热泵短暂启动。",
            sceneGoal: "进入旧堡垒并确认热源入口。",
            sceneIndex: 1,
            scenePlanId: "scene_plan_1",
          },
        ],
        targetWordCount: 6000,
        title: "第一章 白灾入屋",
      },
    ],
    defaultArcPlanId: arcPlan.id,
    projectId,
  });
  const chapterRepository = new ChapterRepository(projectDatabase);
  const chapter = chapterRepository.createChapter({
    chapterId: "chapter_1",
    projectId,
    summary: "沈砚启动旧堡垒备用热泵，并发现冰冠预警编号。",
    title: "第一章 白灾入屋",
    volumeId,
  });
  chapterRepository.saveContent({
    baseVersion: 0,
    chapterId: chapter.id,
    content: "FULL_TEXT_SHOULD_NOT_ENTER_CONTEXT ".repeat(500),
    nextVersion: 1,
    projectId,
    source: "user",
    versionId: "chapter_version_1",
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
