import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Test } from "@nestjs/testing";
import { FakeModelProvider, ModelGateway } from "@story-pilot/ai";
import {
  createProjectDatabase,
  PROJECT_DATABASE_FILE,
  type WorldbuildingFields,
} from "@story-pilot/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MODEL_GATEWAY } from "../ai/model-gateway.provider.js";
import { AppModule } from "../app.module.js";
import { RpcService } from "./rpc.service.js";

function completeWorldbuildingFields(
  overrides: Partial<WorldbuildingFields> = {},
): WorldbuildingFields {
  return {
    coreConflict: "旧秩序与新生力量围绕资源和合法性长期冲突。",
    culture: "民众相信血脉、功绩与契约共同决定身份。",
    economy: "土地、粮草、军械、情报和修行资源决定势力上限。",
    factions: "王朝残部、地方豪强、边境军镇与民间盟会互相牵制。",
    geography: "都城、边郡、河谷粮仓和山中秘境构成主要舞台。",
    history: "旧王朝衰败后，各方借灾年和战乱重塑权力秩序。",
    powerOrder: "皇权名义尚在，实际权力由军功、宗族与资源控制。",
    powerSystem: "角色通过武学、军略、情报网络和资源调度获得优势。",
    rules: "军令、盟约、宗法和地方潜规则共同约束行动。",
    socialStructure: "士族、军户、商帮、流民与修行者拥有不同生存路径。",
    specialMechanism: "星潮周期性影响修行效率和战略窗口。",
    worldBase: "架空古代争霸世界，现实权谋与轻度超凡并存。",
    ...overrides,
  };
}

function coreStoryFormFields(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    antagonistForce: "",
    corePromise: "",
    differentiators: [],
    emotionalAxes: [],
    logline: "",
    mainConflict: "",
    mainGoal: "",
    premise: "",
    protagonistArc: "",
    risks: [],
    stakes: "",
    storyDriver: "growth_reversal",
    ...overrides,
  };
}

describe("RpcService MVP command integration", () => {
  const tempDirs: string[] = [];
  let originalHome: string | undefined;
  let originalGlobalDatabasePath: string | undefined;
  let originalProjectsRoot: string | undefined;
  let originalSettingsPath: string | undefined;

  beforeEach(() => {
    originalHome = process.env.STORY_PILOT_HOME;
    originalGlobalDatabasePath = process.env.STORY_PILOT_GLOBAL_DATABASE_PATH;
    originalProjectsRoot = process.env.STORY_PILOT_PROJECTS_ROOT;
    originalSettingsPath = process.env.STORY_PILOT_SETTINGS_PATH;
  });

  afterEach(() => {
    restoreEnv("STORY_PILOT_HOME", originalHome);
    restoreEnv("STORY_PILOT_GLOBAL_DATABASE_PATH", originalGlobalDatabasePath);
    restoreEnv("STORY_PILOT_PROJECTS_ROOT", originalProjectsRoot);
    restoreEnv("STORY_PILOT_SETTINGS_PATH", originalSettingsPath);

    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("creates a project, creates a chapter, and saves chapter content", async () => {
    const { moduleRef, rpcService } = await createRpcHarness(tempDirs);
    try {
      const project = await expectRpcOk(
        rpcService.handle({
          command: "project.create",
          id: "req_project",
          payload: { genre: "悬疑", title: "长夜序章" },
        }),
      );
      const chapter = await expectRpcOk(
        rpcService.handle({
          command: "chapter.create",
          id: "req_chapter",
          payload: {
            projectId: getString(project, "id"),
            title: "第一章 雨夜来信",
            volumeId: getString(project, "defaultVolumeId"),
          },
        }),
      );
      const saved = await expectRpcOk(
        rpcService.handle({
          command: "chapter.saveContent",
          id: "req_save",
          payload: {
            baseVersion: 0,
            chapterId: getString(chapter, "id"),
            content: "用户写下第一版正文。",
            projectId: getString(project, "id"),
          },
        }),
      );

      expect(saved).toMatchObject({
        content: "用户写下第一版正文。",
        version: 1,
      });
    } finally {
      await moduleRef.close();
    }
  });

  it("exposes runtime settings through RPC and validates missing model configuration", async () => {
    const { moduleRef, rpcService, rootDir } = await createRpcHarness(tempDirs);
    try {
      const settings = await expectRpcOk(
        rpcService.handle({
          command: "settings.get",
          id: "req_settings_get",
          payload: {},
        }),
      );
      expect(settings).toMatchObject({
        model: {
          apiKey: "",
          baseUrl: "",
          model: "gpt-5.5",
          provider: "openai-compatible",
        },
        storage: {
          homeDir: rootDir,
        },
        version: 1,
      });

      const updated = await expectRpcOk(
        rpcService.handle({
          command: "settings.update",
          id: "req_settings_update",
          payload: {
            model: {
              apiKey: "json-api-key",
              baseUrl: "https://api.example.test/v1",
              model: "gpt-test",
            },
            storage: {
              autoBackup: false,
              backupRetention: 10,
            },
          },
        }),
      );
      expect(updated).toMatchObject({
        model: {
          apiKey: "json-api-key",
          baseUrl: "https://api.example.test/v1",
          model: "gpt-test",
        },
        storage: {
          autoBackup: false,
          backupRetention: 10,
        },
      });

      const validation = await expectRpcOk(
        rpcService.handle({
          command: "settings.validateModel",
          id: "req_settings_validate",
          payload: {
            apiKey: "",
            baseUrl: "",
            model: "",
          },
        }),
      );
      expect(validation).toMatchObject({
        errorCode: "AI_MODEL_NOT_CONFIGURED",
        ok: false,
      });
    } finally {
      await moduleRef.close();
    }
  });

  it("runs form completion commands through prompt templates and strict output schemas", async () => {
    const { moduleRef, rpcService } = await createRpcHarness(tempDirs);
    try {
      const project = await expectRpcOk(
        rpcService.handle({
          command: "project.create",
          id: "req_template_project",
          payload: {
            genre: "冰雪末世",
            style: "硬核生存、基地经营",
            title: "雪境堡垒",
          },
        }),
      );
      const projectId = getString(project, "id");
      const rootPath = getString(project, "rootPath");
      const worldbuilding = await expectRpcOk(
        rpcService.handle({
          command: "worldbuilding.completeFields",
          id: "req_template_worldbuilding",
          payload: {
            fields: completeWorldbuildingFields({
              worldBase: "冰雪末世，主角提前打造山顶安全屋。",
            }),
            projectId,
          },
        }),
      );
      const coreStory = await expectRpcOk(
        rpcService.handle({
          command: "blueprint.completeForm",
          id: "req_template_core_story",
          payload: {
            fields: coreStoryFormFields({
              mainGoal: "让雪境堡垒在极寒中长期自给并建立公共秩序。",
              premise: "全球极寒爆发，主角提前占据旧防灾堡垒。",
            }),
            projectId,
          },
        }),
      );

      expect(
        getString(getRecord(worldbuilding, "fields"), "worldBase").length,
      ).toBeGreaterThanOrEqual(300);
      expect(getString(getRecord(coreStory, "fields"), "premise").length).toBeGreaterThanOrEqual(
        200,
      );
      const completedWorldbuildingFields = getRecord(worldbuilding, "fields");
      const completedCoreStoryFields = getRecord(coreStory, "fields");
      const completedStoryDriver = getString(completedCoreStoryFields, "storyDriver");
      const savedWorldbuilding = await expectRpcOk(
        rpcService.handle({
          command: "worldbuilding.saveFields",
          id: "req_template_worldbuilding_save",
          payload: {
            fields: completedWorldbuildingFields,
            projectId,
          },
        }),
      );
      const savedCoreStory = await expectRpcOk(
        rpcService.handle({
          command: "blueprint.saveForm",
          id: "req_template_core_story_save",
          payload: {
            fields: completedCoreStoryFields,
            projectId,
          },
        }),
      );

      expect(
        getString(getRecord(savedWorldbuilding, "fields"), "worldBase").length,
      ).toBeGreaterThanOrEqual(300);
      expect(getString(savedCoreStory, "storyDriver")).toBe(completedStoryDriver);

      const projectDatabase = createProjectDatabase(join(rootPath, PROJECT_DATABASE_FILE));
      try {
        const rows = projectDatabase.client
          .prepare(
            "select purpose, prompt_version, request from model_calls order by created_at asc",
          )
          .all() as Array<{ prompt_version: string; purpose: string; request: string }>;
        expect(rows).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              prompt_version: "worldbuilding.complete.v1",
              purpose: "worldbuilding_generate",
            }),
            expect.objectContaining({
              prompt_version: "core-story.complete.v1",
              purpose: "core_story_complete",
            }),
          ]),
        );
        expect(rows.map((row) => parseJsonRecord(row.request))).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ templateId: "worldbuilding.complete" }),
            expect.objectContaining({ templateId: "core-story.complete" }),
          ]),
        );
        const worldbuildingProfile = projectDatabase.client
          .prepare("select world_base from worldbuilding_profiles where project_id = ?")
          .get(projectId) as { world_base: string } | undefined;
        const storyBlueprint = projectDatabase.client
          .prepare("select premise, story_driver from story_blueprints where project_id = ?")
          .get(projectId) as { premise: string; story_driver: string } | undefined;

        expect(worldbuildingProfile?.world_base.length).toBeGreaterThanOrEqual(300);
        expect(storyBlueprint?.premise.length).toBeGreaterThanOrEqual(200);
        expect(storyBlueprint?.story_driver).toBe(completedStoryDriver);
      } finally {
        projectDatabase.close();
      }
    } finally {
      await moduleRef.close();
    }
  });

  it("exports redacted diagnostics and restores project backups", async () => {
    const { moduleRef, rpcService, rootDir } = await createRpcHarness(tempDirs);
    try {
      await expectRpcOk(
        rpcService.handle({
          command: "settings.update",
          id: "req_diag_settings",
          payload: {
            model: {
              apiKey: "secret-diagnostic-key",
              baseUrl: "https://api.example.test/v1",
              model: "gpt-test",
            },
          },
        }),
      );
      const project = await expectRpcOk(
        rpcService.handle({
          command: "project.create",
          id: "req_diag_project",
          payload: { genre: "悬疑", title: "诊断备份样例" },
        }),
      );
      const backup = await expectRpcOk(
        rpcService.handle({
          command: "backup.createProject",
          id: "req_diag_backup",
          payload: { projectId: getString(project, "id") },
        }),
      );
      await expectRpcOk(
        rpcService.handle({
          command: "chapter.create",
          id: "req_diag_chapter",
          payload: {
            projectId: getString(project, "id"),
            title: "备份后的新章节",
            volumeId: getString(project, "defaultVolumeId"),
          },
        }),
      );
      expect(
        getRecordArray(
          await expectRpcOk(
            rpcService.handle({
              command: "chapter.list",
              id: "req_diag_chapters_before_restore",
              payload: { projectId: getString(project, "id") },
            }),
          ),
          "items",
        ),
      ).toHaveLength(1);

      const restored = await expectRpcOk(
        rpcService.handle({
          command: "backup.restoreProject",
          id: "req_diag_restore",
          payload: {
            backupPath: getString(backup, "backupPath"),
            projectId: getString(project, "id"),
          },
        }),
      );
      const health = await expectRpcOk(
        rpcService.handle({
          command: "diagnostics.getHealth",
          id: "req_diag_health",
          payload: {},
        }),
      );
      const diagnosticBundle = await expectRpcOk(
        rpcService.handle({
          command: "diagnostics.export",
          id: "req_diag_export",
          payload: {},
        }),
      );
      const diagnosticText = readFileSync(getString(diagnosticBundle, "path"), "utf8");

      expect(restored).toMatchObject({
        restoredProjectId: getString(project, "id"),
      });
      expect(
        getRecordArray(
          await expectRpcOk(
            rpcService.handle({
              command: "chapter.list",
              id: "req_diag_chapters_after_restore",
              payload: { projectId: getString(project, "id") },
            }),
          ),
          "items",
        ),
      ).toHaveLength(0);
      expect(health).toMatchObject({
        appHome: rootDir,
        model: "configured",
        projectCount: 1,
        sidecar: "ok",
        storage: "ok",
      });
      expect(diagnosticBundle).toMatchObject({ redacted: true });
      expect(diagnosticText).not.toContain("secret-diagnostic-key");
      expect(diagnosticText).toContain("[redacted]");
    } finally {
      await moduleRef.close();
    }
  });

  it("runs blueprint generation through the unified AI command boundary", async () => {
    const { moduleRef, rpcService } = await createRpcHarness(tempDirs);
    try {
      const project = await expectRpcOk(
        rpcService.handle({
          command: "project.create",
          id: "req_ai_project",
          payload: { genre: "玄幻", title: "统一 AI 入口" },
        }),
      );
      const projectId = getString(project, "id");

      const generated = await expectRpcOk(
        rpcService.handle({
          command: "ai.generate",
          id: "req_ai_generate_blueprint",
          payload: {
            capability: "blueprint.generate",
            instruction: "生成可支撑长篇连载的创作蓝图",
            projectId,
          },
        }),
      );
      const workflowRun = await expectRpcOk(
        rpcService.handle({
          command: "ai.getRun",
          id: "req_ai_get_run",
          payload: {
            projectId,
            workflowRunId: getString(generated, "workflowRunId"),
          },
        }),
      );
      const artifacts = await expectRpcOk(
        rpcService.handle({
          command: "ai.listArtifacts",
          id: "req_ai_artifacts",
          payload: {
            kind: "story_blueprint_draft",
            projectId,
            targetType: "project",
          },
        }),
      );

      expect(generated).toMatchObject({
        capability: "blueprint.generate",
        workOrderId: expect.any(String),
        workflowRunId: expect.any(String),
      });
      expect(workflowRun).toMatchObject({
        id: getString(generated, "workflowRunId"),
        status: "completed",
        workflowName: "blueprint.generate",
        workOrderId: getString(generated, "workOrderId"),
      });
      expect(getRecordArray(artifacts, "items")).toEqual([
        expect.objectContaining({
          kind: "story_blueprint_draft",
          targetType: "project",
          workflowRunId: getString(generated, "workflowRunId"),
          workOrderId: getString(generated, "workOrderId"),
        }),
      ]);
      expect(
        parseJsonRecord(getString(getRecordArray(artifacts, "items")[0], "metadata")),
      ).toMatchObject({
        contextPackageId: expect.any(String),
        modelCallId: expect.any(String),
      });
    } finally {
      await moduleRef.close();
    }
  });

  it("runs outline generation through the unified AI command boundary", async () => {
    const { moduleRef, rpcService } = await createRpcHarness(tempDirs);
    try {
      const project = await expectRpcOk(
        rpcService.handle({
          command: "project.create",
          id: "req_ai_outline_project",
          payload: { genre: "玄幻", title: "统一章纲入口" },
        }),
      );
      const projectId = getString(project, "id");

      const generated = await expectRpcOk(
        rpcService.handle({
          command: "ai.generate",
          id: "req_ai_generate_outline",
          payload: {
            capability: "outline.generate",
            input: {
              chapterCount: 10,
              scope: "chapter_batch",
            },
            instruction: "生成十章高细节章纲，先给章纲不写正文",
            projectId,
            targetType: "project",
          },
        }),
      );
      const workflowRun = await expectRpcOk(
        rpcService.handle({
          command: "ai.getRun",
          id: "req_ai_get_outline_run",
          payload: {
            projectId,
            workflowRunId: getString(generated, "workflowRunId"),
          },
        }),
      );
      const artifacts = await expectRpcOk(
        rpcService.handle({
          command: "ai.listArtifacts",
          id: "req_ai_outline_artifacts",
          payload: {
            kind: "outline_draft",
            projectId,
            targetType: "project",
          },
        }),
      );

      expect(generated).toMatchObject({
        artifactIds: [expect.any(String)],
        capability: "outline.generate",
        status: "completed",
        workOrderId: expect.any(String),
        workflowRunId: expect.any(String),
      });
      expect(workflowRun).toMatchObject({
        id: getString(generated, "workflowRunId"),
        status: "completed",
        workflowName: "outline.generate",
        workOrderId: getString(generated, "workOrderId"),
      });
      expect(getRecordArray(artifacts, "items")).toEqual([
        expect.objectContaining({
          kind: "outline_draft",
          targetType: "project",
          workflowRunId: getString(generated, "workflowRunId"),
          workOrderId: getString(generated, "workOrderId"),
        }),
      ]);
      expect(
        parseJsonRecord(getString(getRecordArray(artifacts, "items")[0], "metadata")),
      ).toMatchObject({
        contextPackageId: expect.any(String),
        modelCallId: expect.any(String),
      });
    } finally {
      await moduleRef.close();
    }
  });

  it("generates and applies layered longform plans before chapter production", async () => {
    const { moduleRef, rpcService } = await createRpcHarness(tempDirs);
    try {
      const project = await createConfirmedBriefAndBlueprint(rpcService, {
        genre: "玄幻",
        title: "星潮纪",
      });
      const projectId = getString(project, "id");

      const bookPlanDraft = await expectRpcOk(
        rpcService.handle({
          command: "plot.generateBookPlan",
          id: "req_longform_book_plan",
          payload: {
            projectId,
            targetWordCount: 3_000_000,
            volumeCount: 2,
          },
        }),
      );
      const bookPlanArtifact = getRecord(bookPlanDraft, "artifact");
      const bookPlanApplied = await expectRpcOk(
        rpcService.handle({
          command: "plot.applyBookPlan",
          id: "req_longform_apply_book_plan",
          payload: {
            artifactId: getString(bookPlanArtifact, "id"),
            projectId,
          },
        }),
      );
      const volumePlan = getRecordArray(bookPlanApplied, "volumePlans")[0];
      const arcPlan = getRecordArray(bookPlanApplied, "arcPlans")[0];

      const rollingDraft = await expectRpcOk(
        rpcService.handle({
          command: "plot.generateRollingOutline",
          id: "req_longform_rolling_outline",
          payload: {
            chapterCount: 10,
            projectId,
            startChapterIndex: 1,
            volumePlanId: getString(volumePlan, "id"),
          },
        }),
      );
      const rollingArtifact = getRecord(rollingDraft, "artifact");
      const rollingBody = parseJsonRecord(getString(rollingArtifact, "body"));
      const firstDraftChapterPlan = getRecordArray(rollingBody, "chapterPlans")[0];
      const appliedChapterPlans = await expectRpcOk(
        rpcService.handle({
          command: "plot.applyChapterPlans",
          id: "req_longform_apply_chapter_plans",
          payload: {
            artifactId: getString(rollingArtifact, "id"),
            projectId,
            selectedChapterPlanIds: [getString(firstDraftChapterPlan, "id")],
          },
        }),
      );
      const chapterPlan = getRecordArray(appliedChapterPlans, "chapterPlans")[0];
      const executionCardDraft = await expectRpcOk(
        rpcService.handle({
          command: "chapterExecutionCard.generate",
          id: "req_longform_execution_card",
          payload: {
            chapterPlanId: getString(chapterPlan, "id"),
            instruction: "强化本章读者回报和章末钩子",
            projectId,
          },
        }),
      );
      const executionCardArtifact = getRecord(executionCardDraft, "artifact");
      const executionCard = await expectRpcOk(
        rpcService.handle({
          command: "chapterExecutionCard.apply",
          id: "req_longform_apply_execution_card",
          payload: {
            artifactId: getString(executionCardArtifact, "id"),
            projectId,
          },
        }),
      );
      expect(executionCard).toMatchObject({
        chapterPlanId: getString(chapterPlan, "id"),
        readerReward: expect.stringContaining("升级爽点"),
        status: "confirmed",
      });
      const draftFromPlan = await expectRpcOk(
        rpcService.handle({
          command: "chapter.generateDraftFromPlan",
          id: "req_longform_draft_from_plan",
          payload: {
            chapterPlanId: getString(chapterPlan, "id"),
            projectId,
          },
        }),
      );
      const draftFromPlanArtifact = getRecord(draftFromPlan, "artifact");
      const impact = await expectRpcOk(
        rpcService.handle({
          command: "plot.analyzeOutlineImpact",
          id: "req_longform_outline_impact",
          payload: {
            patch: { hook: "章末钩子改为旧名单现身。" },
            projectId,
            targetId: getString(chapterPlan, "id"),
            targetType: "chapter_plan",
          },
        }),
      );
      const board = await expectRpcOk(
        rpcService.handle({
          command: "workbench.getBoard",
          id: "req_longform_board",
          payload: { projectId },
        }),
      );
      const boardCreativePath = getRecord(board, "creativePath");

      expect(bookPlanDraft).toMatchObject({
        artifact: {
          kind: "book_plan_draft",
          status: "pending",
          targetType: "project",
        },
        workflowRun: {
          status: "completed",
          workflowName: "book_plan_generate",
        },
      });
      expect(parseJsonRecord(getString(bookPlanArtifact, "metadata"))).toMatchObject({
        contextPackageId: expect.any(String),
        modelCallId: expect.any(String),
        targetWordCount: 3_000_000,
        volumeCount: 2,
      });
      expect(bookPlanApplied).toMatchObject({
        bookPlan: {
          corePromise: expect.stringContaining("每卷"),
          sourceArtifactId: getString(bookPlanArtifact, "id"),
          targetWordCount: 3_000_000,
        },
      });
      expect(getRecordArray(bookPlanApplied, "volumePlans")).toHaveLength(2);
      expect(getRecordArray(bookPlanApplied, "arcPlans")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: getString(arcPlan, "id"),
            volumePlanId: getString(volumePlan, "id"),
          }),
        ]),
      );
      expect(rollingDraft).toMatchObject({
        artifact: {
          kind: "rolling_chapter_plan_draft",
          status: "pending",
          targetId: getString(volumePlan, "id"),
          targetType: "volume_plan",
        },
        workflowRun: {
          status: "completed",
          workflowName: "rolling_chapter_plan_generate",
        },
      });
      expect(getRecordArray(rollingBody, "chapterPlans")).toHaveLength(10);
      expect(appliedChapterPlans).toMatchObject({
        chapterPlans: [
          {
            arcPlanId: getString(arcPlan, "id"),
            chapterIndex: 1,
            sourceArtifactId: getString(rollingArtifact, "id"),
          },
        ],
      });
      expect(getRecordArray(appliedChapterPlans, "scenePlans")).toEqual([
        expect.objectContaining({
          chapterPlanId: getString(chapterPlan, "id"),
          sceneIndex: 1,
        }),
      ]);
      expect(draftFromPlanArtifact).toMatchObject({
        kind: "chapter_draft",
        status: "pending",
        targetType: "chapter",
      });
      expect(getString(draftFromPlanArtifact, "metadata")).toContain(getString(chapterPlan, "id"));
      expect(getRecordArray(impact, "impactedTargets")).toEqual([
        expect.objectContaining({
          severity: "warning",
          targetId: getString(chapterPlan, "id"),
          targetType: "chapter_plan",
        }),
        expect.objectContaining({
          targetType: "scene_plan",
        }),
      ]);
      expect(getRecordArray(boardCreativePath, "bookPlans")).toEqual([
        expect.objectContaining({ id: getString(getRecord(bookPlanApplied, "bookPlan"), "id") }),
      ]);
      expect(getRecordArray(boardCreativePath, "chapterPlans")).toEqual([
        expect.objectContaining({ id: getString(chapterPlan, "id") }),
      ]);
      expect(getRecordArray(boardCreativePath, "chapterExecutionCards")).toEqual([
        expect.objectContaining({
          chapterPlanId: getString(chapterPlan, "id"),
          readerReward: expect.stringContaining("升级爽点"),
          status: "confirmed",
        }),
      ]);
      expect(getRecordArray(boardCreativePath, "scenePlans")).toEqual([
        expect.objectContaining({ chapterPlanId: getString(chapterPlan, "id") }),
      ]);
    } finally {
      await moduleRef.close();
    }
  });

  it("saves editable longform outline plans and exposes full fields on the workbench board", async () => {
    const { moduleRef, rpcService } = await createRpcHarness(tempDirs);
    try {
      const project = await expectRpcOk(
        rpcService.handle({
          command: "project.create",
          id: "req_editable_outline_project",
          payload: {
            genre: "权谋",
            title: "布衣天子",
          },
        }),
      );
      const projectId = getString(project, "id");

      const bookPlan = await expectRpcOk(
        rpcService.handle({
          command: "plot.saveBookPlanDraft",
          id: "req_save_book_plan_draft",
          payload: {
            corePromise: "小人物每卷完成一次权力反转，并付出一次身份代价。",
            endingDirection: "主角放弃旧身份，重建朝堂规则。",
            mainPlotlineId: "plotline_main",
            projectId,
            status: "active",
            targetWordCount: 1_200_000,
            title: "布衣天子全书大纲",
          },
        }),
      );
      const volumePlan = await expectRpcOk(
        rpcService.handle({
          command: "plot.saveVolumePlan",
          id: "req_save_volume_plan",
          payload: {
            bookPlanId: getString(bookPlan, "id"),
            climax: "主角在公堂反杀第一次构陷。",
            majorConflict: "旧贵族封锁上升通道，主角必须借民案撬动权力结构。",
            projectId,
            purpose: "完成身份压迫、入局动机和第一次公开胜利。",
            status: "draft",
            targetWordCount: 280_000,
            title: "第一卷 寒门入局",
            volumeIndex: 1,
          },
        }),
      );
      const arcPlan = await expectRpcOk(
        rpcService.handle({
          command: "plot.saveArcPlan",
          id: "req_save_arc_plan",
          payload: {
            arcIndex: 1,
            endChapterIndex: 24,
            escalation: ["旧案开场", "证人失踪", "公堂反杀"],
            plotlineId: "plotline_main",
            projectId,
            purpose: "用第一阶段让主角从被动受害转为主动查案。",
            startChapterIndex: 1,
            status: "draft",
            title: "旧案破口",
            volumePlanId: getString(volumePlan, "id"),
          },
        }),
      );
      const board = await expectRpcOk(
        rpcService.handle({
          command: "workbench.getBoard",
          id: "req_editable_outline_board",
          payload: { projectId },
        }),
      );
      const boardCreativePath = getRecord(board, "creativePath");

      expect(bookPlan).toMatchObject({
        corePromise: "小人物每卷完成一次权力反转，并付出一次身份代价。",
        endingDirection: "主角放弃旧身份，重建朝堂规则。",
        mainPlotlineId: "plotline_main",
        status: "active",
        targetWordCount: 1_200_000,
        title: "布衣天子全书大纲",
      });
      expect(volumePlan).toMatchObject({
        bookPlanId: getString(bookPlan, "id"),
        climax: "主角在公堂反杀第一次构陷。",
        majorConflict: "旧贵族封锁上升通道，主角必须借民案撬动权力结构。",
        purpose: "完成身份压迫、入局动机和第一次公开胜利。",
        targetWordCount: 280_000,
      });
      expect(arcPlan).toMatchObject({
        endChapterIndex: 24,
        escalation: ["旧案开场", "证人失踪", "公堂反杀"],
        plotlineId: "plotline_main",
        startChapterIndex: 1,
        volumePlanId: getString(volumePlan, "id"),
      });
      expect(getRecordArray(boardCreativePath, "bookPlans")).toEqual([
        expect.objectContaining({
          corePromise: "小人物每卷完成一次权力反转，并付出一次身份代价。",
          id: getString(bookPlan, "id"),
        }),
      ]);
      expect(getRecordArray(boardCreativePath, "volumePlans")).toEqual([
        expect.objectContaining({
          id: getString(volumePlan, "id"),
          majorConflict: "旧贵族封锁上升通道，主角必须借民案撬动权力结构。",
        }),
      ]);
      expect(getRecordArray(boardCreativePath, "arcPlans")).toEqual([
        expect.objectContaining({
          escalation: ["旧案开场", "证人失踪", "公堂反杀"],
          id: getString(arcPlan, "id"),
          purpose: "用第一阶段让主角从被动受害转为主动查案。",
        }),
      ]);

      const deleteArcResult = await expectRpcOk(
        rpcService.handle({
          command: "plot.deleteArcPlan",
          id: "req_delete_arc_plan",
          payload: {
            arcPlanId: getString(arcPlan, "id"),
            projectId,
          },
        }),
      );
      expect(deleteArcResult).toMatchObject({ deleted: true });
      const boardAfterArcDelete = await expectRpcOk(
        rpcService.handle({
          command: "workbench.getBoard",
          id: "req_outline_board_after_arc_delete",
          payload: { projectId },
        }),
      );
      expect(
        getRecordArray(getRecord(boardAfterArcDelete, "creativePath"), "arcPlans"),
      ).toHaveLength(0);

      const deleteVolumeResult = await expectRpcOk(
        rpcService.handle({
          command: "plot.deleteVolumePlan",
          id: "req_delete_volume_plan",
          payload: {
            projectId,
            volumePlanId: getString(volumePlan, "id"),
          },
        }),
      );
      expect(deleteVolumeResult).toMatchObject({ deleted: true });
      const boardAfterVolumeDelete = await expectRpcOk(
        rpcService.handle({
          command: "workbench.getBoard",
          id: "req_outline_board_after_volume_delete",
          payload: { projectId },
        }),
      );
      expect(
        getRecordArray(getRecord(boardAfterVolumeDelete, "creativePath"), "volumePlans"),
      ).toHaveLength(0);

      const deleteBookResult = await expectRpcOk(
        rpcService.handle({
          command: "plot.deleteBookPlan",
          id: "req_delete_book_plan",
          payload: {
            bookPlanId: getString(bookPlan, "id"),
            projectId,
          },
        }),
      );
      expect(deleteBookResult).toMatchObject({ deleted: true });
      const boardAfterBookDelete = await expectRpcOk(
        rpcService.handle({
          command: "workbench.getBoard",
          id: "req_outline_board_after_book_delete",
          payload: { projectId },
        }),
      );
      expect(
        getRecordArray(getRecord(boardAfterBookDelete, "creativePath"), "bookPlans"),
      ).toHaveLength(0);
    } finally {
      await moduleRef.close();
    }
  });

  it("saves manual story planning entities through public RPC and exposes them on the board", async () => {
    const { moduleRef, rpcService } = await createRpcHarness(tempDirs);
    try {
      const project = await expectRpcOk(
        rpcService.handle({
          command: "project.create",
          id: "req_manual_story_project",
          payload: {
            estimatedChapterCount: 1500,
            estimatedWordCount: 5_000_000,
            genre: "冰雪末世安全屋",
            title: "极寒堡垒",
          },
        }),
      );
      const projectId = getString(project, "id");

      const protagonist = await expectRpcOk(
        rpcService.handle({
          command: "character.create",
          id: "req_manual_story_character_protagonist",
          payload: {
            arcEnd: "从只求自保变成能建立秩序的安全屋领袖。",
            goal: "守住安全屋并建立稳定生存共同体。",
            importance: "core",
            name: "陆沉",
            narrativeFunction: "driver",
            projectId,
            role: "protagonist",
            storyTask: "承担安全屋建设、资源分配与秩序重建主线。",
          },
        }),
      );
      const doctor = await expectRpcOk(
        rpcService.handle({
          command: "character.create",
          id: "req_manual_story_character_doctor",
          payload: {
            goal: "用医疗能力换取庇护，同时守住旧医院秘密。",
            importance: "major",
            name: "沈砚秋",
            narrativeFunction: "ally",
            projectId,
            role: "support",
            storyTask: "提供医疗线、信任危机与安全屋内部伦理冲突。",
          },
        }),
      );
      const entityRelation = await expectRpcOk(
        rpcService.handle({
          command: "entityRelation.create",
          id: "req_manual_story_entity_relation_create",
          payload: {
            description: "陆沉用安全屋保护沈砚秋，沈砚秋用医疗能力稳定内部秩序。",
            polarity: 1,
            projectId,
            relationType: "庇护与互信",
            sourceEntityId: getString(protagonist, "id"),
            sourceEntityType: "character",
            status: "confirmed",
            strength: 0.8,
            targetEntityId: getString(doctor, "id"),
            targetEntityType: "character",
          },
        }),
      );
      const updatedEntityRelation = await expectRpcOk(
        rpcService.handle({
          command: "entityRelation.update",
          id: "req_manual_story_entity_relation_update",
          payload: {
            entityRelationId: getString(entityRelation, "id"),
            patch: {
              description: "互信关系会被医疗资源短缺持续考验。",
              strength: 0.95,
            },
            projectId,
          },
        }),
      );

      const plotline = await expectRpcOk(
        rpcService.handle({
          command: "plotline.create",
          id: "req_manual_story_plotline",
          payload: {
            centralQuestion: "安全屋能否从个人避难所升级为末世秩序核心？",
            driver: "极寒、资源、邻里围困和外部势力逐步升级。",
            emotionalPromise: "每次升级都带来更强安全感和更大代价。",
            importance: "core",
            kind: "main",
            narrativeRole: "main_drive",
            payoffPlan: "终局安全屋成为极寒城市的规则中心。",
            priority: 1,
            projectId,
            relatedCharacterIds: [getString(protagonist, "id")],
            status: "active",
            summary: "围绕安全屋建设、扩张、防守和秩序重建推进。",
            title: "安全屋升级主线",
          },
        }),
      );
      const conflict = await expectRpcOk(
        rpcService.handle({
          command: "conflict.create",
          id: "req_manual_story_conflict_create",
          payload: {
            conflictType: "survival",
            escalationPath: ["暴雪断电", "热源暴露", "邻里围门", "掠夺者围攻"],
            opposingForces: ["安全屋小队", "失控幸存者与掠夺联盟"],
            projectId,
            relatedPlotlineId: getString(plotline, "id"),
            stakes: "安全屋一旦失守，主角会失去全部生存优势和秩序试验场。",
            status: "active",
            title: "热源暴露危机",
          },
        }),
      );
      const updatedConflict = await expectRpcOk(
        rpcService.handle({
          command: "conflict.update",
          id: "req_manual_story_conflict_update",
          payload: {
            conflictId: getString(conflict, "id"),
            patch: {
              stakes: "危机升级为整栋楼对安全屋规则的第一次集体挑战。",
              status: "resolved",
            },
            projectId,
          },
        }),
      );

      const warningEvent = await expectRpcOk(
        rpcService.handle({
          command: "storyEvent.create",
          id: "req_manual_story_event_warning",
          payload: {
            description: "气象系统发布极寒红色预警，陆沉抢在断电前完成最后一批囤货。",
            eventType: "discovery",
            outcome: "安全屋建设进入封闭运行，外界秩序开始崩塌。",
            participants: [
              {
                entityId: getString(protagonist, "id"),
                entityType: "character",
                role: "driver",
              },
            ],
            projectId,
            status: "canon",
            storyTime: "第 1 章",
            title: "极寒预警",
          },
        }),
      );
      const siegeEvent = await expectRpcOk(
        rpcService.handle({
          command: "storyEvent.create",
          id: "req_manual_story_event_siege",
          payload: {
            description: "热成像暴露安全屋位置，邻居和掠夺者开始联手试探入口。",
            eventType: "conflict",
            outcome: "主角守住门禁，但第一次公开暴露安全屋的存在。",
            participants: [
              {
                entityId: getString(protagonist, "id"),
                entityType: "character",
                role: "defender",
              },
            ],
            projectId,
            status: "planned",
            storyTime: "第 12 章",
            title: "第一次围门",
          },
        }),
      );
      const updatedWarningEvent = await expectRpcOk(
        rpcService.handle({
          command: "storyEvent.update",
          id: "req_manual_story_event_update",
          payload: {
            patch: {
              outcome: "陆沉完成安全屋封闭启动，也埋下热源被侦测的伏笔。",
              status: "canon",
            },
            projectId,
            storyEventId: getString(warningEvent, "id"),
          },
        }),
      );
      const eventRelation = await expectRpcOk(
        rpcService.handle({
          command: "eventRelation.create",
          id: "req_manual_story_event_relation_create",
          payload: {
            description: "极寒预警导致安全屋封闭，也让后续热源暴露成为必然。",
            projectId,
            relationType: "foreshadows",
            sourceEventId: getString(warningEvent, "id"),
            targetEventId: getString(siegeEvent, "id"),
          },
        }),
      );
      const updatedEventRelation = await expectRpcOk(
        rpcService.handle({
          command: "eventRelation.update",
          id: "req_manual_story_event_relation_update",
          payload: {
            eventRelationId: getString(eventRelation, "id"),
            patch: {
              description: "预警、囤货和热源暴露形成明确因果链。",
              relationType: "causes",
            },
            projectId,
          },
        }),
      );

      const outline = await expectRpcOk(
        rpcService.handle({
          command: "outline.saveDraft",
          id: "req_manual_story_outline_save",
          payload: {
            basis: {
              premise: "冰雪末世，主角提前打造安全屋，在秩序崩坏中不断升级防御和规则。",
              targetWordCount: 5_000_000,
            },
            projectId,
            scope: "full_book",
            status: "draft",
            title: "极寒堡垒全书手工大纲",
          },
        }),
      );
      const volumeOutline = await expectRpcOk(
        rpcService.handle({
          command: "outline.saveVolumeOutline",
          id: "req_manual_story_volume_outline_save",
          payload: {
            climax: "主角用备用能源和外墙防御击退第一次掠夺联盟。",
            majorConflict: "安全屋热源暴露后，周边幸存者持续逼近。",
            outlineId: getString(outline, "id"),
            projectId,
            purpose: "完成极寒降临、安全屋启动、邻里压力和首次攻防。",
            sortOrder: 1,
            status: "draft",
            title: "第一卷 极寒降临",
            wordCountGoal: 600_000,
          },
        }),
      );
      const chapterOutline = await expectRpcOk(
        rpcService.handle({
          command: "outline.saveChapterOutline",
          id: "req_manual_story_chapter_outline_save",
          payload: {
            chapterGoal: "陆沉收到极寒预警并启动安全屋封闭运行。",
            conflict: "陆沉必须在断电前完成安全屋能源切换。",
            emotionalTurn: "从冷静准备转为确认末世已不可逆。",
            hook: "气象预警突然从三天倒计时变成三小时。",
            informationGain: "极寒速度远超官方预估。",
            outlineId: getString(outline, "id"),
            projectId,
            relatedPlotlineNodeIds: [],
            requiredCharacterIds: [getString(protagonist, "id")],
            requiredLocationIds: [],
            sortOrder: 1,
            status: "draft",
            targetWordCount: 3500,
            title: "第 1 章 极寒预警",
            volumeOutlineId: getString(volumeOutline, "id"),
          },
        }),
      );
      const sceneOutline = await expectRpcOk(
        rpcService.handle({
          command: "outline.saveSceneOutline",
          id: "req_manual_story_scene_outline_save",
          payload: {
            beatType: "opening_hook",
            chapterOutlineId: getString(chapterOutline, "id"),
            conflict: "备用电源接入失败，楼道温度开始急降。",
            entryState: "陆沉以为准备已经足够充分。",
            exitState: "陆沉完成切换，也第一次感到安全屋不是单纯避难而是战场。",
            projectId,
            purpose: "展示安全屋系统、末世压迫和主角执行力。",
            sortOrder: 1,
            status: "draft",
            title: "封闭启动",
          },
        }),
      );

      const bookPlan = await expectRpcOk(
        rpcService.handle({
          command: "plot.saveBookPlanDraft",
          id: "req_manual_story_book_plan",
          payload: {
            corePromise: "每一阶段都兑现安全屋升级、危机压迫和规则重建的爽点。",
            endingDirection: "安全屋从个人堡垒升级为极寒城市的新秩序中心。",
            mainPlotlineId: getString(plotline, "id"),
            projectId,
            status: "active",
            targetWordCount: 5_000_000,
            title: "500 万字长篇规划",
          },
        }),
      );
      const volumePlan = await expectRpcOk(
        rpcService.handle({
          command: "plot.saveVolumePlan",
          id: "req_manual_story_volume_plan",
          payload: {
            bookPlanId: getString(bookPlan, "id"),
            climax: "击退第一次成组织围攻。",
            majorConflict: "极寒第一阶段的资源与入口暴露危机。",
            projectId,
            purpose: "搭建安全屋核心机制和第一批人物关系。",
            status: "active",
            targetWordCount: 600_000,
            title: "第一卷 极寒降临",
            volumeIndex: 1,
          },
        }),
      );
      const arcPlan = await expectRpcOk(
        rpcService.handle({
          command: "plot.saveArcPlan",
          id: "req_manual_story_arc_plan",
          payload: {
            arcIndex: 1,
            endChapterIndex: 30,
            escalation: ["预警", "断电", "热源暴露", "围门"],
            plotlineId: getString(plotline, "id"),
            projectId,
            purpose: "用前三十章完成安全屋启动和第一次外部冲突闭环。",
            startChapterIndex: 1,
            status: "draft",
            title: "启动与暴露",
            volumePlanId: getString(volumePlan, "id"),
          },
        }),
      );
      const chapterPlan = await expectRpcOk(
        rpcService.handle({
          command: "plot.saveChapterPlan",
          id: "req_manual_story_chapter_plan",
          payload: {
            arcPlanId: getString(arcPlan, "id"),
            chapterGoal: "陆沉启动安全屋，并第一次面对门外求助压力。",
            chapterIndex: 1,
            conflict: "断电前最后一次能源切换失败。",
            emotionalTurn: "从冷静准备转为意识到末世已经无法逆转。",
            hook: "全城灯光熄灭，安全屋门外响起急促敲门声。",
            informationGain: "极寒速度远超官方预估。",
            projectId,
            relatedCharacterIds: [getString(protagonist, "id")],
            relatedPlotlineIds: [getString(plotline, "id")],
            status: "draft",
            targetWordCount: 3500,
            title: "第 1 章 极寒预警",
          },
        }),
      );
      const scenePlan = await expectRpcOk(
        rpcService.handle({
          command: "plot.saveScenePlan",
          id: "req_manual_story_scene_plan",
          payload: {
            chapterPlanId: getString(chapterPlan, "id"),
            conflictTurn: "门禁和能源不能同时稳定，主角必须手动切换。",
            memoryTargets: ["安全屋能源系统", "极寒首次断电"],
            outcome: "安全屋启动成功，但门外求助者成为下一章压力。",
            projectId,
            sceneGoal: "完成章首危机和安全屋能力展示。",
            sceneIndex: 1,
            status: "draft",
          },
        }),
      );

      const entityRelations = await expectRpcOk(
        rpcService.handle({
          command: "entityRelation.list",
          id: "req_manual_story_entity_relation_list",
          payload: { projectId },
        }),
      );
      const conflicts = await expectRpcOk(
        rpcService.handle({
          command: "conflict.list",
          id: "req_manual_story_conflict_list",
          payload: { projectId },
        }),
      );
      const eventRelations = await expectRpcOk(
        rpcService.handle({
          command: "eventRelation.list",
          id: "req_manual_story_event_relation_list",
          payload: { projectId },
        }),
      );
      const storyEvents = await expectRpcOk(
        rpcService.handle({
          command: "storyEvent.list",
          id: "req_manual_story_event_list",
          payload: { projectId },
        }),
      );
      const board = await expectRpcOk(
        rpcService.handle({
          command: "workbench.getBoard",
          id: "req_manual_story_board",
          payload: { projectId },
        }),
      );
      const boardCreativePath = getRecord(board, "creativePath");

      expect(updatedEntityRelation).toMatchObject({
        description: "互信关系会被医疗资源短缺持续考验。",
        strength: 0.95,
      });
      expect(getRecordArray(entityRelations, "items")).toEqual([
        expect.objectContaining({
          id: getString(entityRelation, "id"),
          sourceEntityId: getString(protagonist, "id"),
          targetEntityId: getString(doctor, "id"),
        }),
      ]);
      expect(updatedConflict).toMatchObject({
        stakes: "危机升级为整栋楼对安全屋规则的第一次集体挑战。",
        status: "resolved",
      });
      expect(getRecordArray(conflicts, "items")).toEqual([
        expect.objectContaining({
          id: getString(conflict, "id"),
          relatedPlotlineId: getString(plotline, "id"),
        }),
      ]);
      expect(updatedWarningEvent).toMatchObject({
        outcome: "陆沉完成安全屋封闭启动，也埋下热源被侦测的伏笔。",
      });
      expect(getRecordArray(storyEvents, "items")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: getString(warningEvent, "id"),
            outcome: "陆沉完成安全屋封闭启动，也埋下热源被侦测的伏笔。",
          }),
        ]),
      );
      expect(updatedEventRelation).toMatchObject({
        description: "预警、囤货和热源暴露形成明确因果链。",
        relationType: "causes",
      });
      expect(getRecordArray(eventRelations, "items")).toEqual([
        expect.objectContaining({
          id: getString(eventRelation, "id"),
          sourceEventId: getString(warningEvent, "id"),
          targetEventId: getString(siegeEvent, "id"),
        }),
      ]);
      expect(outline).toMatchObject({
        scope: "full_book",
        title: "极寒堡垒全书手工大纲",
      });
      expect(volumeOutline).toMatchObject({
        majorConflict: "安全屋热源暴露后，周边幸存者持续逼近。",
        outlineId: getString(outline, "id"),
      });
      expect(chapterOutline).toMatchObject({
        chapterGoal: "陆沉收到极寒预警并启动安全屋封闭运行。",
        conflict: "陆沉必须在断电前完成安全屋能源切换。",
        volumeOutlineId: getString(volumeOutline, "id"),
      });
      expect(sceneOutline).toMatchObject({
        chapterOutlineId: getString(chapterOutline, "id"),
        purpose: "展示安全屋系统、末世压迫和主角执行力。",
      });
      expect(chapterPlan).toMatchObject({
        arcPlanId: getString(arcPlan, "id"),
        chapterIndex: 1,
        title: "第 1 章 极寒预警",
      });
      expect(scenePlan).toMatchObject({
        chapterPlanId: getString(chapterPlan, "id"),
        sceneIndex: 1,
      });
      expect(getRecordArray(board, "entityRelations")).toEqual([
        expect.objectContaining({ id: getString(entityRelation, "id") }),
      ]);
      expect(getRecordArray(board, "conflicts")).toEqual([
        expect.objectContaining({ id: getString(conflict, "id") }),
      ]);
      expect(getRecordArray(board, "eventRelations")).toEqual([
        expect.objectContaining({ id: getString(eventRelation, "id") }),
      ]);
      expect(getRecordArray(boardCreativePath, "outlines")).toEqual([
        expect.objectContaining({ id: getString(outline, "id") }),
      ]);
      expect(getRecordArray(boardCreativePath, "volumeOutlines")).toEqual([
        expect.objectContaining({ id: getString(volumeOutline, "id") }),
      ]);
      expect(getRecordArray(boardCreativePath, "chapterOutlines")).toEqual([
        expect.objectContaining({ id: getString(chapterOutline, "id") }),
      ]);
      expect(getRecordArray(boardCreativePath, "sceneOutlines")).toEqual([
        expect.objectContaining({ id: getString(sceneOutline, "id") }),
      ]);
      expect(getRecordArray(boardCreativePath, "chapterPlans")).toEqual([
        expect.objectContaining({ id: getString(chapterPlan, "id") }),
      ]);
      expect(getRecordArray(boardCreativePath, "scenePlans")).toEqual([
        expect.objectContaining({ id: getString(scenePlan, "id") }),
      ]);
    } finally {
      await moduleRef.close();
    }
  });

  it("initializes the nine-step creative path for new projects", async () => {
    const { moduleRef, rpcService } = await createRpcHarness(tempDirs);
    try {
      const project = await expectRpcOk(
        rpcService.handle({
          command: "project.create",
          id: "req_project_path",
          payload: {
            genre: "玄幻",
            style: "热血",
            title: "万象夜行",
          },
        }),
      );

      const path = await expectRpcOk(
        rpcService.handle({
          command: "creativeStage.getPath",
          id: "req_creative_path",
          payload: { projectId: getString(project, "id") },
        }),
      );
      const stages = getRecordArray(path, "stages");

      expect(stages.map((stage) => getString(stage, "stageKey"))).toEqual([
        "brief",
        "blueprint",
        "worldbuilding",
        "characters",
        "plot_arcs",
        "outline",
        "chapters",
        "memory_review",
        "retrospective",
      ]);
      expect(stages[0]).toMatchObject({
        readinessScore: 10,
        stageKey: "brief",
        status: "available",
      });
      expect(stages[5]).toMatchObject({
        stageKey: "outline",
        status: "locked",
      });
      expect(path).toMatchObject({
        brief: expect.objectContaining({
          genre: "玄幻",
          status: "draft",
        }),
      });
    } finally {
      await moduleRef.close();
    }
  });

  it("backfills creative path stages on workbench board for existing project databases", async () => {
    const { moduleRef, rpcService } = await createRpcHarness(tempDirs);
    try {
      const project = await expectRpcOk(
        rpcService.handle({
          command: "project.create",
          id: "req_project_backfill_path",
          payload: { genre: "悬疑", title: "旧库迁移样例" },
        }),
      );
      const projectId = getString(project, "id");
      const projectDatabase = createProjectDatabase(
        join(getString(project, "rootPath"), PROJECT_DATABASE_FILE),
      );
      try {
        projectDatabase.client
          .prepare("delete from creative_stages where project_id = ?")
          .run(projectId);
      } finally {
        projectDatabase.close();
      }

      const board = await expectRpcOk(
        rpcService.handle({
          command: "workbench.getBoard",
          id: "req_board_backfill_path",
          payload: { projectId },
        }),
      );
      const creativePath = getRecord(board, "creativePath");
      const stages = getRecordArray(creativePath, "stages");

      expect(stages.map((stage) => getString(stage, "stageKey"))).toEqual([
        "brief",
        "blueprint",
        "worldbuilding",
        "characters",
        "plot_arcs",
        "outline",
        "chapters",
        "memory_review",
        "retrospective",
      ]);
      expect(getStage(creativePath, "brief")).toMatchObject({ status: "available" });
    } finally {
      await moduleRef.close();
    }
  });

  it("runs the main creative path through chapter outline before drafting", async () => {
    const { moduleRef, rpcService } = await createRpcHarness(tempDirs);
    try {
      const project = await expectRpcOk(
        rpcService.handle({
          command: "project.create",
          id: "req_path_project",
          payload: {
            genre: "悬疑",
            style: "悬疑推理",
            title: "雾都案卷",
          },
        }),
      );
      const projectId = getString(project, "id");

      const initialPath = await expectRpcOk(
        rpcService.handle({
          command: "creativeStage.getPath",
          id: "req_path_initial",
          payload: { projectId },
        }),
      );
      expect(getStage(initialPath, "brief")).toMatchObject({
        readinessScore: 10,
        status: "available",
      });
      expect(getStage(initialPath, "outline")).toMatchObject({ status: "locked" });

      const savedBrief = await expectRpcOk(
        rpcService.handle({
          command: "brief.save",
          id: "req_path_brief_save",
          payload: {
            emotionalRewards: ["悬疑", "反转"],
            estimatedChapterCount: 260,
            estimatedWordCount: 800_000,
            genre: "悬疑",
            initialIdea: "雨夜旧信把主角拖回十年前的钟楼旧案。",
            lengthProfile: "长篇连载",
            narrativePov: "第三人称",
            platformProfile: "男频",
            projectId,
            subgenres: ["探案单元剧"],
            targetAudience: "悬疑强钩子",
          },
        }),
      );
      expect(savedBrief).toMatchObject({
        estimatedChapterCount: 260,
        estimatedWordCount: 800_000,
      });
      const confirmedBrief = await expectRpcOk(
        rpcService.handle({
          command: "brief.confirm",
          id: "req_path_brief_confirm",
          payload: {
            briefId: getString(savedBrief, "id"),
            projectId,
          },
        }),
      );
      const generatedBlueprint = await expectRpcOk(
        rpcService.handle({
          command: "blueprint.generate",
          id: "req_path_blueprint_generate",
          payload: { projectId },
        }),
      );
      const blueprint = getRecord(generatedBlueprint, "blueprint");
      const appliedBlueprint = await expectRpcOk(
        rpcService.handle({
          command: "blueprint.apply",
          id: "req_path_blueprint_apply",
          payload: {
            blueprintId: getString(blueprint, "id"),
            projectId,
          },
        }),
      );
      const generatedOutline = await expectRpcOk(
        rpcService.handle({
          command: "outline.generate",
          id: "req_path_outline_generate",
          payload: {
            chapterCount: 10,
            projectId,
            scope: "chapter_batch",
          },
        }),
      );
      const firstChapterOutline = getRecordArray(generatedOutline, "chapterOutlines")[0];
      const approvedOutline = await expectRpcOk(
        rpcService.handle({
          command: "outline.approveChapterOutline",
          id: "req_path_outline_approve",
          payload: {
            chapterOutlineId: getString(firstChapterOutline, "id"),
            projectId,
          },
        }),
      );
      const appliedOutline = await expectRpcOk(
        rpcService.handle({
          command: "outline.applyChapterOutline",
          id: "req_path_outline_apply",
          payload: {
            chapterOutlineId: getString(firstChapterOutline, "id"),
            projectId,
          },
        }),
      );
      const chapter = getRecord(appliedOutline, "chapter");
      const draftResult = await expectRpcOk(
        rpcService.handle({
          command: "chapter.generateDraftFromOutline",
          id: "req_path_draft_from_outline",
          payload: {
            chapterOutlineId: getString(firstChapterOutline, "id"),
            projectId,
          },
        }),
      );
      const draftArtifact = getRecord(draftResult, "artifact");
      const appliedArtifact = await expectRpcOk(
        rpcService.handle({
          command: "artifact.apply",
          id: "req_path_artifact_apply",
          payload: {
            applyMode: "replace",
            artifactId: getString(draftArtifact, "id"),
            projectId,
            targetVersion: getNumber(chapter, "version"),
          },
        }),
      );
      const memoryCandidate = getRecordArray(draftResult, "memoryCandidates")[0];
      const confirmedMemory = await expectRpcOk(
        rpcService.handle({
          command: "memory.confirm",
          id: "req_path_memory_confirm",
          payload: {
            candidateId: getString(memoryCandidate, "id"),
            decision: "canon",
            projectId,
          },
        }),
      );
      const board = await expectRpcOk(
        rpcService.handle({
          command: "workbench.getBoard",
          id: "req_path_final_board",
          payload: { projectId },
        }),
      );
      const creativePath = getRecord(board, "creativePath");

      expect(confirmedBrief).toMatchObject({ status: "confirmed" });
      expect(appliedBlueprint).toMatchObject({ status: "confirmed" });
      expect(getRecordArray(generatedOutline, "chapterOutlines")).toHaveLength(10);
      expect(approvedOutline).toMatchObject({ status: "approved" });
      expect(appliedOutline).toMatchObject({
        chapter: {
          title: getString(firstChapterOutline, "title"),
          version: 0,
        },
        chapterOutline: {
          chapterId: getString(chapter, "id"),
          status: "applied",
        },
      });
      expect(draftArtifact).toMatchObject({
        kind: "chapter_draft",
        status: "pending",
        targetId: getString(chapter, "id"),
        targetType: "chapter",
      });
      expect(getString(draftArtifact, "metadata")).toContain(getString(firstChapterOutline, "id"));
      expect(appliedArtifact).toMatchObject({
        artifact: { status: "applied" },
        chapter: {
          content: expect.stringContaining("旧信"),
          version: 1,
        },
      });
      expect(confirmedMemory).toMatchObject({
        memory: { status: "canon" },
      });
      expect(getStage(creativePath, "brief")).toMatchObject({ status: "completed" });
      expect(getStage(creativePath, "blueprint")).toMatchObject({ status: "completed" });
      expect(getStage(creativePath, "outline")).toMatchObject({ status: "completed" });
      expect(getStage(creativePath, "chapters")).toMatchObject({ status: "available" });
      expect(getRecordArray(creativePath, "chapterOutlines")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            chapterId: getString(chapter, "id"),
            status: "applied",
          }),
        ]),
      );
      expect(getRecordArray(board, "chapters")).toEqual([
        expect.objectContaining({
          id: getString(chapter, "id"),
          version: 1,
        }),
      ]);
    } finally {
      await moduleRef.close();
    }
  });

  it("advances middle creative stages after blueprint application", async () => {
    const { moduleRef, rpcService } = await createRpcHarness(tempDirs);
    try {
      const project = await expectRpcOk(
        rpcService.handle({
          command: "project.create",
          id: "req_middle_stage_project",
          payload: {
            genre: "古代争霸",
            title: "布衣天子",
          },
        }),
      );
      const projectId = getString(project, "id");
      const brief = getRecord(
        await expectRpcOk(
          rpcService.handle({
            command: "creativeStage.getPath",
            id: "req_middle_stage_path",
            payload: { projectId },
          }),
        ),
        "brief",
      );
      await expectRpcOk(
        rpcService.handle({
          command: "brief.confirm",
          id: "req_middle_stage_brief_confirm",
          payload: {
            briefId: getString(brief, "id"),
            projectId,
          },
        }),
      );
      const generatedBlueprint = await expectRpcOk(
        rpcService.handle({
          command: "blueprint.generate",
          id: "req_middle_stage_blueprint",
          payload: { projectId },
        }),
      );
      await expectRpcOk(
        rpcService.handle({
          command: "blueprint.apply",
          id: "req_middle_stage_apply_blueprint",
          payload: {
            blueprintId: getString(getRecord(generatedBlueprint, "blueprint"), "id"),
            projectId,
          },
        }),
      );

      const completedWorldbuilding = await expectRpcOk(
        rpcService.handle({
          command: "creativeStage.complete",
          id: "req_middle_stage_worldbuilding",
          payload: {
            projectId,
            stageKey: "worldbuilding",
          },
        }),
      );
      const completedCharacters = await expectRpcOk(
        rpcService.handle({
          command: "creativeStage.complete",
          id: "req_middle_stage_characters",
          payload: {
            projectId,
            stageKey: "characters",
          },
        }),
      );
      const completedPlotArcs = await expectRpcOk(
        rpcService.handle({
          command: "creativeStage.complete",
          id: "req_middle_stage_plot_arcs",
          payload: {
            projectId,
            stageKey: "plot_arcs",
          },
        }),
      );
      const path = await expectRpcOk(
        rpcService.handle({
          command: "creativeStage.getPath",
          id: "req_middle_stage_final_path",
          payload: { projectId },
        }),
      );

      expect(completedWorldbuilding).toMatchObject({
        readinessScore: 100,
        stageKey: "worldbuilding",
        status: "completed",
      });
      expect(completedCharacters).toMatchObject({
        readinessScore: 100,
        stageKey: "characters",
        status: "completed",
      });
      expect(completedPlotArcs).toMatchObject({
        readinessScore: 100,
        stageKey: "plot_arcs",
        status: "completed",
      });
      expect(getStage(path, "outline")).toMatchObject({
        readinessScore: 10,
        status: "available",
      });
    } finally {
      await moduleRef.close();
    }
  });

  it("evaluates creative stage gates and supports strict advance, skip, and reopen", async () => {
    const { moduleRef, rpcService } = await createRpcHarness(tempDirs);
    try {
      const project = await expectRpcOk(
        rpcService.handle({
          command: "project.create",
          id: "req_gate_project",
          payload: {
            genre: "玄幻",
            title: "星潮门徒",
          },
        }),
      );
      const projectId = getString(project, "id");
      const brief = getRecord(
        await expectRpcOk(
          rpcService.handle({
            command: "creativeStage.getPath",
            id: "req_gate_path",
            payload: { projectId },
          }),
        ),
        "brief",
      );
      await expectRpcOk(
        rpcService.handle({
          command: "brief.confirm",
          id: "req_gate_brief_confirm",
          payload: {
            briefId: getString(brief, "id"),
            projectId,
          },
        }),
      );
      const blueprintResult = await expectRpcOk(
        rpcService.handle({
          command: "blueprint.generate",
          id: "req_gate_blueprint_generate",
          payload: { projectId },
        }),
      );
      await expectRpcOk(
        rpcService.handle({
          command: "blueprint.apply",
          id: "req_gate_blueprint_apply",
          payload: {
            blueprintId: getString(getRecord(blueprintResult, "blueprint"), "id"),
            projectId,
          },
        }),
      );

      const missingWorldGate = await expectRpcOk(
        rpcService.handle({
          command: "creativeStage.evaluateGate",
          id: "req_gate_world_missing",
          payload: {
            projectId,
            stageKey: "worldbuilding",
          },
        }),
      );
      const blockedAdvance = await expectRpcOk(
        rpcService.handle({
          command: "creativeStage.advance",
          id: "req_gate_world_blocked",
          payload: {
            mode: "strict",
            projectId,
            stageKey: "worldbuilding",
          },
        }),
      );

      expect(missingWorldGate).toMatchObject({
        gateReport: {
          ok: false,
          requirements: expect.arrayContaining([
            expect.objectContaining({
              current: 0,
              key: "worldbuilding_fields",
              ok: false,
              required: 12,
            }),
          ]),
          stageKey: "worldbuilding",
        },
        stage: {
          status: "available",
        },
      });
      expect(blockedAdvance).toMatchObject({
        advanced: false,
        gateReport: {
          ok: false,
          stageKey: "worldbuilding",
        },
        stage: {
          status: "available",
        },
      });

      await expectRpcOk(
        rpcService.handle({
          command: "worldbuilding.saveFields",
          id: "req_gate_worldbuilding_profile",
          payload: {
            fields: completeWorldbuildingFields(),
            projectId,
          },
        }),
      );
      const advancedWorldbuilding = await expectRpcOk(
        rpcService.handle({
          command: "creativeStage.advance",
          id: "req_gate_world_advance",
          payload: {
            mode: "strict",
            projectId,
            stageKey: "worldbuilding",
          },
        }),
      );
      const skippedCharacters = await expectRpcOk(
        rpcService.handle({
          command: "creativeStage.skip",
          id: "req_gate_characters_skip",
          payload: {
            projectId,
            reason: "角色设定已在外部文档完成",
            stageKey: "characters",
          },
        }),
      );
      const reopenedCharacters = await expectRpcOk(
        rpcService.handle({
          command: "creativeStage.reopen",
          id: "req_gate_characters_reopen",
          payload: {
            projectId,
            reason: "补充人物关系网",
            stageKey: "characters",
          },
        }),
      );

      expect(advancedWorldbuilding).toMatchObject({
        advanced: true,
        gateReport: {
          ok: true,
          stageKey: "worldbuilding",
        },
        stage: {
          readinessScore: 100,
          status: "completed",
        },
      });
      expect(getStage(getRecord(advancedWorldbuilding, "path"), "characters")).toMatchObject({
        status: "available",
      });
      expect(skippedCharacters).toMatchObject({
        path: {
          stages: expect.arrayContaining([
            expect.objectContaining({ stageKey: "plot_arcs", status: "available" }),
          ]),
        },
        skipped: true,
        stage: {
          status: "skipped",
        },
      });
      expect(reopenedCharacters).toMatchObject({
        path: {
          stages: expect.arrayContaining([
            expect.objectContaining({ stageKey: "characters", status: "available" }),
          ]),
        },
        reopened: true,
        stage: {
          status: "available",
        },
      });
    } finally {
      await moduleRef.close();
    }
  });

  it("requires complete worldbuilding fields before advancing a xuanhuan project", async () => {
    const { moduleRef, rpcService } = await createRpcHarness(tempDirs);
    try {
      const project = await createConfirmedBriefAndBlueprint(rpcService, {
        genre: "玄幻",
        title: "星潮纪元",
      });
      const projectId = getString(project, "id");

      await expectRpcOk(
        rpcService.handle({
          command: "worldbuilding.saveFields",
          id: "req_gate_world_partial_profile",
          payload: {
            fields: completeWorldbuildingFields({
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
            }),
            projectId,
          },
        }),
      );

      const incompleteGate = await expectRpcOk(
        rpcService.handle({
          command: "creativeStage.evaluateGate",
          id: "req_gate_world_incomplete_assets",
          payload: {
            projectId,
            stageKey: "worldbuilding",
          },
        }),
      );
      const blockedAdvance = await expectRpcOk(
        rpcService.handle({
          command: "creativeStage.advance",
          id: "req_gate_world_incomplete_advance",
          payload: {
            mode: "strict",
            projectId,
            stageKey: "worldbuilding",
          },
        }),
      );

      expect(incompleteGate).toMatchObject({
        gateReport: {
          ok: false,
          requirements: expect.arrayContaining([
            expect.objectContaining({
              current: 1,
              key: "worldbuilding_fields",
              ok: false,
              required: 12,
            }),
            expect.objectContaining({
              current: 0,
              key: "power_system",
              ok: false,
              required: 1,
            }),
          ]),
          stageKey: "worldbuilding",
        },
      });
      expect(blockedAdvance).toMatchObject({
        advanced: false,
        gateReport: {
          ok: false,
          stageKey: "worldbuilding",
        },
      });

      await expectRpcOk(
        rpcService.handle({
          command: "worldbuilding.saveFields",
          id: "req_gate_world_complete_profile",
          payload: {
            fields: completeWorldbuildingFields({
              powerSystem: "星潮修行按境界、资源和代价分层，越阶会损伤根基。",
              worldBase: "玄幻星潮世界，宗门、王朝与边境军镇争夺天象资源。",
            }),
            projectId,
          },
        }),
      );

      const advanced = await expectRpcOk(
        rpcService.handle({
          command: "creativeStage.advance",
          id: "req_gate_world_complete_advance",
          payload: {
            mode: "strict",
            projectId,
            stageKey: "worldbuilding",
          },
        }),
      );

      expect(advanced).toMatchObject({
        advanced: true,
        gateReport: {
          ok: true,
          requirements: expect.arrayContaining([
            expect.objectContaining({ key: "worldbuilding_fields", ok: true, required: 12 }),
            expect.objectContaining({ key: "power_system", ok: true, required: 1 }),
          ]),
        },
        stage: {
          status: "completed",
        },
      });
    } finally {
      await moduleRef.close();
    }
  });

  it("supports project, workbench, and chapter read commands after local writes", async () => {
    const { moduleRef, rpcService } = await createRpcHarness(tempDirs);
    try {
      const project = await expectRpcOk(
        rpcService.handle({
          command: "project.create",
          id: "req_project_read",
          payload: { genre: "悬疑", title: "长夜序章" },
        }),
      );
      const chapter = await expectRpcOk(
        rpcService.handle({
          command: "chapter.create",
          id: "req_chapter_read",
          payload: {
            projectId: getString(project, "id"),
            summary: "主角收到旧信。",
            title: "第一章 雨夜来信",
            volumeId: getString(project, "defaultVolumeId"),
          },
        }),
      );
      await expectRpcOk(
        rpcService.handle({
          command: "chapter.saveContent",
          id: "req_save_read",
          payload: {
            baseVersion: 0,
            chapterId: getString(chapter, "id"),
            content: "雨夜来信。旧案重新浮出水面。",
            projectId: getString(project, "id"),
          },
        }),
      );

      const versions = await expectRpcData(
        rpcService.handle({
          command: "chapter.listVersions",
          id: "req_versions_read",
          payload: {
            chapterId: getString(chapter, "id"),
            projectId: getString(project, "id"),
          },
        }),
      );
      const firstVersion = getArray(versions)[0];

      await expectRpcOk(
        rpcService.handle({
          command: "chapter.restoreVersion",
          id: "req_restore_read",
          payload: {
            chapterId: getString(chapter, "id"),
            projectId: getString(project, "id"),
            versionId: getString(firstVersion, "id"),
          },
        }),
      );

      const recentProjects = await expectRpcOk(
        rpcService.handle({
          command: "project.listRecent",
          id: "req_recent",
          payload: { limit: 10 },
        }),
      );
      const openedProject = await expectRpcOk(
        rpcService.handle({
          command: "project.open",
          id: "req_open",
          payload: { projectId: getString(project, "id") },
        }),
      );
      const overview = await expectRpcOk(
        rpcService.handle({
          command: "project.getOverview",
          id: "req_overview",
          payload: { projectId: getString(project, "id") },
        }),
      );
      const backup = await expectRpcOk(
        rpcService.handle({
          command: "project.backup",
          id: "req_backup",
          payload: { projectId: getString(project, "id") },
        }),
      );
      const chapters = await expectRpcOk(
        rpcService.handle({
          command: "chapter.list",
          id: "req_chapters",
          payload: { projectId: getString(project, "id") },
        }),
      );
      const snapshot = await expectRpcOk(
        rpcService.handle({
          command: "workbench.getSnapshot",
          id: "req_snapshot",
          payload: { projectId: getString(project, "id") },
        }),
      );
      const board = await expectRpcOk(
        rpcService.handle({
          command: "workbench.getBoard",
          id: "req_board",
          payload: { projectId: getString(project, "id") },
        }),
      );

      expect(getRecordArray(recentProjects, "items")).toEqual([
        expect.objectContaining({ id: getString(project, "id"), title: "长夜序章" }),
      ]);
      expect(openedProject).toMatchObject({ id: getString(project, "id"), title: "长夜序章" });
      expect(overview).toMatchObject({ id: getString(project, "id"), title: "长夜序章" });
      expect(getString(backup, "backupPath")).toContain("project.sqlite");
      expect(getRecordArray(chapters, "items")).toEqual([
        expect.objectContaining({ id: getString(chapter, "id"), title: "第一章 雨夜来信" }),
      ]);
      expect(snapshot).toMatchObject({
        project: { id: getString(project, "id") },
        stats: {
          chapters: 1,
          memories: 0,
        },
      });
      expect(getRecordArray(board, "chapters")).toHaveLength(1);
    } finally {
      await moduleRef.close();
    }
  });

  it("generates a draft artifact and applies it through artifact.apply", async () => {
    const { moduleRef, rpcService } = await createRpcHarness(tempDirs);
    try {
      const { chapter, project } = await createProjectAndChapter(rpcService);
      const saved = await expectRpcOk(
        rpcService.handle({
          command: "chapter.saveContent",
          id: "req_initial_save",
          payload: {
            baseVersion: 0,
            chapterId: getString(chapter, "id"),
            content: "用户正文保持不变。",
            projectId: getString(project, "id"),
          },
        }),
      );
      const draftResult = await expectRpcOk(
        rpcService.handle({
          command: "chapter.generateDraft",
          id: "req_draft",
          payload: {
            chapterId: getString(chapter, "id"),
            instruction: "生成更强钩子的第一章草稿",
            projectId: getString(project, "id"),
          },
        }),
      );
      const applied = await expectRpcOk(
        rpcService.handle({
          command: "artifact.apply",
          id: "req_apply",
          payload: {
            applyMode: "replace",
            artifactId: getString(getRecord(draftResult, "artifact"), "id"),
            projectId: getString(project, "id"),
            targetVersion: getNumber(saved, "version"),
          },
        }),
      );

      expect(draftResult).toMatchObject({
        artifact: {
          kind: "chapter_draft",
          status: "pending",
        },
      });
      expect(applied).toMatchObject({
        chapter: {
          content: expect.stringContaining("旧信"),
          version: 2,
        },
      });
    } finally {
      await moduleRef.close();
    }
  });

  it("confirms a memory candidate and exposes it through graph.getNeighborhood", async () => {
    const { moduleRef, rpcService } = await createRpcHarness(tempDirs);
    try {
      const { chapter, project } = await createProjectAndChapter(rpcService);
      const draftResult = await expectRpcOk(
        rpcService.handle({
          command: "chapter.generateDraft",
          id: "req_draft_for_memory",
          payload: {
            chapterId: getString(chapter, "id"),
            projectId: getString(project, "id"),
          },
        }),
      );
      const candidate = getRecordArray(draftResult, "memoryCandidates")[0];
      const confirmed = await expectRpcOk(
        rpcService.handle({
          command: "memory.confirm",
          id: "req_confirm",
          payload: {
            candidateId: getString(candidate, "id"),
            decision: "canon",
            projectId: getString(project, "id"),
          },
        }),
      );
      const neighborhood = await expectRpcOk(
        rpcService.handle({
          command: "graph.getNeighborhood",
          id: "req_graph",
          payload: {
            depth: 2,
            nodeId: "char_linyuan",
            nodeType: "character",
            projectId: getString(project, "id"),
          },
        }),
      );

      expect(confirmed).toMatchObject({
        memory: {
          status: "canon",
        },
      });
      expect(getRecordArray(neighborhood, "nodes")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            label: "林鸢发现一封来历异常的旧信。",
            type: "memory",
          }),
        ]),
      );
    } finally {
      await moduleRef.close();
    }
  });

  it("supports creative object list, update, and planning commands", async () => {
    const { moduleRef, rpcService } = await createRpcHarness(tempDirs);
    try {
      const { chapter, project } = await createProjectAndChapter(rpcService);
      const character = await expectRpcOk(
        rpcService.handle({
          command: "character.create",
          id: "req_character_create",
          payload: {
            appearance: "旧风衣、随身旧笔记本。",
            arcEnd: "愿意公开旧案证据并承担代价。",
            arcStart: "逃避旧案，只想离开旧城。",
            arcTurn: "发现证人仍被追杀后决定回头。",
            archetype: "调查者",
            biography: "前刑警，因旧案离队。",
            firstAppearance: "第 1 章",
            flaw: "过度自责",
            genderAge: "女，27 岁",
            goal: "查清旧案",
            importance: "core",
            name: "林鸢",
            narrativeFunction: "viewpoint",
            need: "重新学会信任他人",
            projectId: getString(project, "id"),
            relationshipHook: "与钟楼守档人互相试探。",
            role: "protagonist",
            secret: "十年前曾到过案发现场",
            storyTask: "把旧信线索推进成主线调查。",
            voiceProfile: "克制、短句、偏观察细节。",
          },
        }),
      );
      const updatedCharacter = await expectRpcOk(
        rpcService.handle({
          command: "character.update",
          id: "req_character_update",
          payload: {
            characterId: getString(character, "id"),
            patch: {
              arcEnd: "从逃避旧案的人，变成愿意公开档案的人。",
              goal: "保护证人",
              name: "林鸢",
              need: "保护证人",
              secret: "",
              storyTask: "保护证人并揭开档案伪造链条。",
            },
            projectId: getString(project, "id"),
          },
        }),
      );
      expect(getRecordArray(updatedCharacter, "traits")).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: "need", value: "保护证人" })]),
      );
      expect(getRecordArray(updatedCharacter, "traits")).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ name: "secret" })]),
      );
      const generatedNames = await expectRpcOk(
        rpcService.handle({
          command: "character.generateNames",
          id: "req_character_names",
          payload: {
            constraints: ["冷静"],
            count: 3,
            projectId: getString(project, "id"),
            style: "现代悬疑",
          },
        }),
      );
      const worldRule = await expectRpcOk(
        rpcService.handle({
          command: "worldRule.create",
          id: "req_world_create",
          payload: {
            category: "society",
            constraintLevel: "hard",
            projectId: getString(project, "id"),
            statement: "档案馆夜间封闭。",
            title: "档案馆规则",
          },
        }),
      );
      const updatedWorldRule = await expectRpcOk(
        rpcService.handle({
          command: "worldRule.update",
          id: "req_world_update",
          payload: {
            patch: { statement: "档案馆夜间只允许内部人员进入。" },
            projectId: getString(project, "id"),
            worldRuleId: getString(worldRule, "id"),
          },
        }),
      );
      const plotline = await expectRpcOk(
        rpcService.handle({
          command: "plotline.create",
          id: "req_plot_create",
          payload: {
            kind: "main",
            priority: 1,
            projectId: getString(project, "id"),
            summary: "旧案调查线",
            title: "旧案线",
          },
        }),
      );
      const storyEvent = await expectRpcOk(
        rpcService.handle({
          command: "storyEvent.create",
          id: "req_event_create",
          payload: {
            chapterId: getString(chapter, "id"),
            description: "林鸢收到旧信。",
            eventType: "discovery",
            participants: [
              {
                entityId: getString(character, "id"),
                entityType: "character",
                role: "actor",
              },
            ],
            projectId: getString(project, "id"),
            title: "旧信出现",
          },
        }),
      );
      const foreshadowing = await expectRpcOk(
        rpcService.handle({
          command: "foreshadowing.create",
          id: "req_foreshadow_create",
          payload: {
            description: "旧信纸张有档案馆印记。",
            importance: 4,
            projectId: getString(project, "id"),
            seedEventId: getString(storyEvent, "id"),
            title: "档案馆印记",
          },
        }),
      );

      const characterList = await expectRpcOk(
        rpcService.handle({
          command: "character.list",
          id: "req_character_list",
          payload: { projectId: getString(project, "id") },
        }),
      );
      const worldRuleList = await expectRpcOk(
        rpcService.handle({
          command: "worldRule.list",
          id: "req_world_list",
          payload: { projectId: getString(project, "id") },
        }),
      );
      const plotlineList = await expectRpcOk(
        rpcService.handle({
          command: "plotline.list",
          id: "req_plot_list",
          payload: { projectId: getString(project, "id") },
        }),
      );
      const eventList = await expectRpcOk(
        rpcService.handle({
          command: "storyEvent.list",
          id: "req_event_list",
          payload: { projectId: getString(project, "id") },
        }),
      );
      const foreshadowingList = await expectRpcOk(
        rpcService.handle({
          command: "foreshadowing.list",
          id: "req_foreshadow_list",
          payload: { projectId: getString(project, "id") },
        }),
      );
      const reviewRun = await expectRpcOk(
        rpcService.handle({
          command: "chapter.reviewContinuity",
          id: "req_review",
          payload: {
            chapterId: getString(chapter, "id"),
            projectId: getString(project, "id"),
            scope: "chapter",
          },
        }),
      );
      const planRun = await expectRpcOk(
        rpcService.handle({
          command: "foreshadowing.plan",
          id: "req_foreshadow_plan",
          payload: {
            chapterId: getString(chapter, "id"),
            projectId: getString(project, "id"),
          },
        }),
      );
      const boardAfterReview = await expectRpcOk(
        rpcService.handle({
          command: "workbench.getBoard",
          id: "req_review_issue_board",
          payload: {
            projectId: getString(project, "id"),
          },
        }),
      );
      const boardCreativePath = getRecord(boardAfterReview, "creativePath");

      expect(updatedCharacter).toMatchObject({
        arcEnd: "从逃避旧案的人，变成愿意公开档案的人。",
        motivation: "保护证人",
        storyTask: "保护证人并揭开档案伪造链条。",
      });
      expect(getRecordArray(generatedNames, "items")).toHaveLength(3);
      expect(updatedWorldRule).toMatchObject({ content: "档案馆夜间只允许内部人员进入。" });
      expect(getRecordArray(characterList, "items")).toEqual([
        expect.objectContaining({ id: getString(character, "id") }),
      ]);
      expect(getRecordArray(worldRuleList, "items")).toHaveLength(1);
      expect(getRecordArray(plotlineList, "items")).toEqual([
        expect.objectContaining({ id: getString(plotline, "id") }),
      ]);
      expect(getRecordArray(eventList, "items")).toHaveLength(1);
      expect(getRecordArray(foreshadowingList, "items")).toEqual([
        expect.objectContaining({ id: getString(foreshadowing, "id") }),
      ]);
      expect(reviewRun).toMatchObject({
        output: { artifactId: expect.any(String) },
        status: "completed",
        workflowName: "review",
      });
      expect(getRecordArray(boardCreativePath, "reviewIssues")).toEqual([
        expect.objectContaining({
          issueType: "world_rule",
          severity: "warning",
          status: "open",
          targetId: getString(chapter, "id"),
          targetType: "chapter",
        }),
      ]);
      expect(planRun).toMatchObject({
        output: { artifactId: expect.any(String) },
        status: "completed",
        workflowName: "foreshadowing_plan",
      });
    } finally {
      await moduleRef.close();
    }
  });

  it("deletes character and plotline records through RPC", async () => {
    const { moduleRef, rpcService } = await createRpcHarness(tempDirs);
    try {
      const project = await expectRpcOk(
        rpcService.handle({
          command: "project.create",
          id: "req_project_delete_creative_objects",
          payload: { genre: "悬疑", title: "长夜序章" },
        }),
      );
      const projectId = getString(project, "id");
      const character = await expectRpcOk(
        rpcService.handle({
          command: "character.create",
          id: "req_character_delete_create",
          payload: {
            name: "林鸢",
            projectId,
            role: "protagonist",
          },
        }),
      );
      const plotline = await expectRpcOk(
        rpcService.handle({
          command: "plotline.create",
          id: "req_plotline_delete_create",
          payload: {
            kind: "mystery",
            priority: 3,
            projectId,
            title: "旧信谜团",
          },
        }),
      );

      await expectRpcOk(
        rpcService.handle({
          command: "character.delete",
          id: "req_character_delete",
          payload: {
            characterId: getString(character, "id"),
            projectId,
          },
        }),
      );
      await expectRpcOk(
        rpcService.handle({
          command: "plotline.delete",
          id: "req_plotline_delete",
          payload: {
            plotlineId: getString(plotline, "id"),
            projectId,
          },
        }),
      );

      const characters = await expectRpcOk(
        rpcService.handle({
          command: "character.list",
          id: "req_character_delete_list",
          payload: { projectId },
        }),
      );
      const plotlines = await expectRpcOk(
        rpcService.handle({
          command: "plotline.list",
          id: "req_plotline_delete_list",
          payload: { projectId },
        }),
      );

      expect(getRecordArray(characters, "items")).toEqual([]);
      expect(getRecordArray(plotlines, "items")).toEqual([]);
    } finally {
      await moduleRef.close();
    }
  });

  it("includes creative objects on the workbench board after they are created", async () => {
    const { moduleRef, rpcService } = await createRpcHarness(tempDirs);
    try {
      const project = await expectRpcOk(
        rpcService.handle({
          command: "project.create",
          id: "req_project_board_creative",
          payload: { genre: "悬疑", title: "长夜序章" },
        }),
      );

      await expectRpcOk(
        rpcService.handle({
          command: "character.create",
          id: "character_create",
          payload: {
            name: "林鸢",
            projectId: getString(project, "id"),
            role: "protagonist",
          },
        }),
      );
      const worldRule = await expectRpcOk(
        rpcService.handle({
          command: "worldRule.create",
          id: "world_rule_create",
          payload: {
            category: "society",
            projectId: getString(project, "id"),
            statement: "旧城区由钟楼议会管理。",
            title: "旧城区治理",
          },
        }),
      );
      await expectRpcOk(
        rpcService.handle({
          command: "plotline.create",
          id: "plotline_create",
          payload: {
            centralQuestion: "旧信到底是谁寄出的？",
            driver: "每三章投放一条线索，并用一次误导制造新的问题。",
            emotionalPromise: "持续解谜、反转和真相逼近。",
            importance: "core",
            kind: "mystery",
            narrativeRole: "secret_reveal",
            priority: 5,
            projectId: getString(project, "id"),
            relatedCharacterIds: [],
            relatedForeshadowingIds: [],
            relatedStoryEventIds: [],
            relatedWorldRuleIds: [getString(worldRule, "id")],
            summary: "围绕旧信来源展开。",
            title: "旧信谜团",
          },
        }),
      );
      const plotlineList = await expectRpcOk(
        rpcService.handle({
          command: "plotline.list",
          id: "plotline_list_for_node",
          payload: { projectId: getString(project, "id") },
        }),
      );
      const plotline = getRecordArray(plotlineList, "items")[0];
      if (!plotline) {
        throw new Error("Expected plotline created through RPC");
      }
      const updatedPlotline = await expectRpcOk(
        rpcService.handle({
          command: "plotline.update",
          id: "plotline_update",
          payload: {
            patch: {
              payoffPlan: "卷末揭示寄信人，同时回收信纸水印伏笔。",
              status: "active",
            },
            plotlineId: getString(plotline, "id"),
            projectId: getString(project, "id"),
          },
        }),
      );
      const plotlineNode = await expectRpcOk(
        rpcService.handle({
          command: "plotline.createNode",
          id: "plotline_node_create",
          payload: {
            chapterHint: "第 3 章",
            description: "信纸水印第一次出现，但暂时不解释来源。",
            kind: "seed",
            plotlineId: getString(plotline, "id"),
            position: 1,
            projectId: getString(project, "id"),
            status: "planned",
            title: "信纸水印出现",
          },
        }),
      );
      await expectRpcOk(
        rpcService.handle({
          command: "foreshadowing.create",
          id: "foreshadowing_create",
          payload: {
            description: "信纸水印暗示十年前档案。",
            payoffExpectation: "后续揭示档案伪造者。",
            projectId: getString(project, "id"),
            title: "水印伏笔",
          },
        }),
      );

      const board = await expectRpcData(
        rpcService.handle({
          command: "workbench.getBoard",
          id: "board_with_creative_objects",
          payload: { projectId: getString(project, "id") },
        }),
      );

      expect(board).toMatchObject({
        characters: [expect.objectContaining({ name: "林鸢" })],
        foreshadowings: [expect.objectContaining({ title: "水印伏笔" })],
        plotlines: [
          expect.objectContaining({
            centralQuestion: "旧信到底是谁寄出的？",
            name: "旧信谜团",
            nodes: [
              expect.objectContaining({
                chapterHint: "第 3 章",
                id: getString(plotlineNode, "id"),
                title: "信纸水印出现",
              }),
            ],
            payoffPlan: "卷末揭示寄信人，同时回收信纸水印伏笔。",
            status: "active",
          }),
        ],
        worldRules: [expect.objectContaining({ title: "旧城区治理" })],
      });
      expect(updatedPlotline).toMatchObject({
        payoffPlan: "卷末揭示寄信人，同时回收信纸水印伏笔。",
        status: "active",
      });
    } finally {
      await moduleRef.close();
    }
  });

  it("updates plot node workspace records through RPC and returns board-aligned fields", async () => {
    const { moduleRef, rpcService } = await createRpcHarness(tempDirs);
    try {
      const project = await expectRpcOk(
        rpcService.handle({
          command: "project.create",
          id: "req_project_plot_nodes_update",
          payload: { genre: "权谋", title: "布衣天子" },
        }),
      );

      const storyEvent = await expectRpcOk(
        rpcService.handle({
          command: "storyEvent.create",
          id: "req_story_event_create_for_update",
          payload: {
            description: "秦钰收到带水印的旧信。",
            eventType: "discovery",
            projectId: getString(project, "id"),
            status: "draft",
            storyTime: "第 1 章夜雨",
            title: "旧信出现",
          },
        }),
      );
      const payoffEvent = await expectRpcOk(
        rpcService.handle({
          command: "storyEvent.create",
          id: "req_story_event_payoff_for_update",
          payload: {
            description: "秦钰在公堂指出档案被调包。",
            eventType: "reveal",
            projectId: getString(project, "id"),
            title: "档案调包真相",
          },
        }),
      );
      const foreshadowing = await expectRpcOk(
        rpcService.handle({
          command: "foreshadowing.create",
          id: "req_foreshadowing_create_for_update",
          payload: {
            description: "信纸水印第一次出现，暂不解释来源。",
            importance: 4,
            projectId: getString(project, "id"),
            seedEventId: getString(storyEvent, "id"),
            status: "seeded",
            title: "信纸水印",
          },
        }),
      );

      const updatedStoryEvent = await expectRpcOk(
        rpcService.handle({
          command: "storyEvent.update",
          id: "req_story_event_update",
          payload: {
            patch: {
              description: "秦钰确认旧信水印来自官府档案纸。",
              eventType: "reveal",
              status: "canon",
              storyTime: "第 3 章公堂前",
              title: "水印来源暴露",
            },
            projectId: getString(project, "id"),
            storyEventId: getString(storyEvent, "id"),
          },
        }),
      );
      const updatedForeshadowing = await expectRpcOk(
        rpcService.handle({
          command: "foreshadowing.update",
          id: "req_foreshadowing_update",
          payload: {
            foreshadowingId: getString(foreshadowing, "id"),
            patch: {
              description: "水印像是普通纸纹，实则是官府档案纸暗纹。",
              importance: 5,
              payoffEventId: getString(payoffEvent, "id"),
              payoffExpectation: "第 20 章揭示水印证明档案调包。",
              status: "payoff_ready",
              title: "档案纸水印",
            },
            projectId: getString(project, "id"),
          },
        }),
      );
      const board = await expectRpcData(
        rpcService.handle({
          command: "workbench.getBoard",
          id: "req_board_plot_nodes_update",
          payload: { projectId: getString(project, "id") },
        }),
      );

      expect(updatedStoryEvent).toMatchObject({
        eventType: "reveal",
        status: "canon",
        storyTime: "第 3 章公堂前",
        summary: "秦钰确认旧信水印来自官府档案纸。",
        title: "水印来源暴露",
      });
      expect(updatedForeshadowing).toMatchObject({
        importance: 5,
        payoffText: "第 20 章揭示水印证明档案调包。",
        status: "payoff_ready",
      });
      expect(board).toMatchObject({
        foreshadowings: [
          expect.objectContaining({
            importance: 5,
            title: "档案纸水印",
          }),
        ],
        storyEvents: [
          expect.objectContaining({
            storyTime: "第 3 章公堂前",
            title: "水印来源暴露",
          }),
          expect.objectContaining({
            title: "档案调包真相",
          }),
        ],
      });
    } finally {
      await moduleRef.close();
    }
  });

  it("generates AI element candidates and accepts them into creative object stores", async () => {
    const { moduleRef, rpcService } = await createRpcHarness(tempDirs);
    try {
      const project = await expectRpcOk(
        rpcService.handle({
          command: "project.create",
          id: "req_project_elements",
          payload: { genre: "玄幻", style: "热血", title: "万象夜行" },
        }),
      );
      expect(project).toMatchObject({ genre: "玄幻", style: "热血" });

      const worldRule = await expectRpcOk(
        rpcService.handle({
          command: "worldRule.create",
          id: "req_element_rule",
          payload: {
            category: "magic",
            constraintLevel: "hard",
            projectId: getString(project, "id"),
            statement: "所有兵器和功法都必须受星轨潮汐影响。",
            title: "星轨潮汐",
          },
        }),
      );
      const generated = await expectRpcOk(
        rpcService.handle({
          command: "element.generateCandidates",
          id: "req_element_generate",
          payload: {
            count: 5,
            description: "围绕安全屋外部补给线生成可长期博弈的地下势力名称。",
            elementType: "faction",
            projectId: getString(project, "id"),
            style: "热血",
            worldRuleIds: [getString(worldRule, "id")],
          },
        }),
      );
      const generatedItems = getRecordArray(generated, "items");
      expect(generatedItems).toHaveLength(5);
      expect(generatedItems).toEqual([
        expect.objectContaining({
          name: "白线同盟",
          type: "faction",
        }),
        expect.objectContaining({ type: "faction" }),
        expect.objectContaining({ type: "faction" }),
        expect.objectContaining({ type: "faction" }),
        expect.objectContaining({ type: "faction" }),
      ]);

      const accepted = await expectRpcOk(
        rpcService.handle({
          command: "element.acceptCandidates",
          id: "req_element_accept",
          payload: {
            items: [
              {
                description: "身负星轨潮汐异象的少年。",
                name: "沈逐星",
                rationale: "适合作为热血玄幻主角名。",
                tags: ["主角", "星轨"],
                type: "character_name",
              },
              {
                description: "潮汐最高时会显出双月倒影的城池。",
                name: "照潮城",
                rationale: "能承载星轨潮汐规则。",
                tags: ["城市"],
                type: "city",
              },
              {
                description: "掌控星轨历法的古老宗门。",
                name: "司星阁",
                rationale: "能制造修行秩序冲突。",
                tags: ["宗门"],
                type: "sect",
              },
              {
                description: "星轨潮汐最强的古老观星台。",
                name: "落星台",
                rationale: "适合作为关键修行地点。",
                tags: ["地点"],
                type: "location",
              },
              {
                description: "流传星潮传说的荒原。",
                name: "星回原",
                rationale: "可承载远行与遗迹探索。",
                tags: ["地名"],
                type: "place_name",
              },
              generatedItems[0],
              {
                description: "借星轨潮汐淬炼经脉的功法。",
                name: "星潮九转",
                rationale: "适合主角成长线。",
                tags: ["功法"],
                type: "technique",
              },
              {
                description: "可辨识潮汐方向的古旧罗盘。",
                name: "旧星罗盘",
                rationale: "可作为寻找秘境的线索道具。",
                tags: ["道具"],
                type: "item",
              },
            ],
            projectId: getString(project, "id"),
          },
        }),
      );
      const board = await expectRpcOk(
        rpcService.handle({
          command: "workbench.getBoard",
          id: "req_element_board",
          payload: { projectId: getString(project, "id") },
        }),
      );

      expect(getRecordArray(accepted, "accepted")).toEqual([
        expect.objectContaining({ name: "沈逐星", target: "character" }),
        expect.objectContaining({ name: "照潮城", target: "location" }),
        expect.objectContaining({ name: "司星阁", target: "organization" }),
        expect.objectContaining({ name: "落星台", target: "location" }),
        expect.objectContaining({ name: "星回原", target: "location" }),
        expect.objectContaining({ name: "白线同盟", target: "organization" }),
        expect.objectContaining({ name: "星潮九转", target: "item" }),
        expect.objectContaining({ name: "旧星罗盘", target: "item" }),
      ]);
      expect(getRecordArray(board, "characters")).toEqual([
        expect.objectContaining({ name: "沈逐星" }),
      ]);
      const boardLocations = getRecordArray(board, "locations");
      expect(boardLocations).toHaveLength(3);
      expect(boardLocations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "照潮城", type: "city" }),
          expect.objectContaining({ name: "星回原", type: "place" }),
          expect.objectContaining({ name: "落星台", type: "location" }),
        ]),
      );
      expect(getRecordArray(board, "organizations")).toEqual([
        expect.objectContaining({ name: "司星阁", type: "sect" }),
        expect.objectContaining({ name: "白线同盟", type: "faction" }),
      ]);
      const boardItems = getRecordArray(board, "items");
      expect(boardItems).toHaveLength(2);
      expect(boardItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "旧星罗盘", type: "item" }),
          expect.objectContaining({ name: "星潮九转", type: "technique" }),
        ]),
      );

      const projectDatabase = createProjectDatabase(
        join(getString(project, "rootPath"), PROJECT_DATABASE_FILE),
      );
      try {
        const eventTypes = projectDatabase.client
          .prepare("select event_type from domain_events order by created_at asc")
          .all()
          .map((row) => (row as { event_type: string }).event_type);
        expect(eventTypes).toContain("character.created");
        expect(eventTypes).toContain("location.created");
        expect(eventTypes).toContain("organization.created");
        expect(eventTypes).toContain("item.created");
      } finally {
        projectDatabase.close();
      }
    } finally {
      await moduleRef.close();
    }
  });

  it("supports workflow, artifact, memory search, and graph utility commands", async () => {
    const { moduleRef, rpcService } = await createRpcHarness(tempDirs);
    try {
      const { chapter, project } = await createProjectAndChapter(rpcService);
      const firstDraft = await expectRpcOk(
        rpcService.handle({
          command: "chapter.generateDraft",
          id: "req_first_draft",
          payload: {
            chapterId: getString(chapter, "id"),
            projectId: getString(project, "id"),
          },
        }),
      );
      const secondDraft = await expectRpcOk(
        rpcService.handle({
          command: "chapter.generateDraft",
          id: "req_second_draft",
          payload: {
            chapterId: getString(chapter, "id"),
            projectId: getString(project, "id"),
          },
        }),
      );
      const firstArtifact = getRecord(firstDraft, "artifact");
      const secondArtifact = getRecord(secondDraft, "artifact");
      const firstRun = getRecord(firstDraft, "workflowRun");
      const firstCandidate = getRecordArray(firstDraft, "memoryCandidates")[0];
      await expectRpcOk(
        rpcService.handle({
          command: "memory.confirm",
          id: "req_confirm_search",
          payload: {
            candidateId: getString(firstCandidate, "id"),
            decision: "canon",
            projectId: getString(project, "id"),
          },
        }),
      );

      const artifact = await expectRpcOk(
        rpcService.handle({
          command: "artifact.get",
          id: "req_artifact_get",
          payload: {
            artifactId: getString(firstArtifact, "id"),
            projectId: getString(project, "id"),
          },
        }),
      );
      const rejectedArtifact = await expectRpcOk(
        rpcService.handle({
          command: "artifact.reject",
          id: "req_artifact_reject",
          payload: {
            artifactId: getString(secondArtifact, "id"),
            projectId: getString(project, "id"),
          },
        }),
      );
      const workOrders = await expectRpcOk(
        rpcService.handle({
          command: "workOrder.list",
          id: "req_workorders",
          payload: { projectId: getString(project, "id") },
        }),
      );
      const firstWorkOrder = getRecordArray(workOrders, "items")[0];
      const workOrder = await expectRpcOk(
        rpcService.handle({
          command: "workOrder.get",
          id: "req_workorder",
          payload: {
            projectId: getString(project, "id"),
            workOrderId: getString(firstWorkOrder, "id"),
          },
        }),
      );
      const retryRun = await expectRpcOk(
        rpcService.handle({
          command: "workflow.retry",
          id: "req_retry",
          payload: {
            projectId: getString(project, "id"),
            workflowRunId: getString(firstRun, "id"),
          },
        }),
      );
      const memories = await expectRpcOk(
        rpcService.handle({
          command: "memory.search",
          id: "req_memory_search",
          payload: {
            projectId: getString(project, "id"),
            query: "旧信",
          },
        }),
      );
      const contradictions = await expectRpcOk(
        rpcService.handle({
          command: "graph.findContradictions",
          id: "req_contradictions",
          payload: {
            projectId: getString(project, "id"),
            scope: "project",
          },
        }),
      );
      const incrementalProjection = await expectRpcOk(
        rpcService.handle({
          command: "graph.projectSinceCheckpoint",
          id: "req_graph_incremental",
          payload: {
            projectId: getString(project, "id"),
          },
        }),
      );

      expect(artifact).toMatchObject({ id: getString(firstArtifact, "id") });
      expect(rejectedArtifact).toMatchObject({
        id: getString(secondArtifact, "id"),
        status: "rejected",
      });
      expect(workOrder).toMatchObject({ id: getString(firstWorkOrder, "id") });
      expect(retryRun).toMatchObject({
        artifact: { kind: "chapter_draft", status: "pending" },
        workflowRun: { status: "completed" },
      });
      expect(getRecordArray(memories, "items")).toEqual([
        expect.objectContaining({ content: expect.stringContaining("旧信") }),
      ]);
      expect(getRecordArray(contradictions, "items")).toEqual([]);
      expect(incrementalProjection).toMatchObject({
        lastDomainEventId: expect.any(String),
        projectedEvents: expect.any(Number),
        projectionName: "kuzu_main",
      });
    } finally {
      await moduleRef.close();
    }
  });

  it("runs memory extraction through workflow.run and exposes pending candidates", async () => {
    const { moduleRef, rpcService } = await createRpcHarness(tempDirs);
    try {
      const { chapter, project } = await createProjectAndChapter(rpcService);
      const run = await expectRpcOk(
        rpcService.handle({
          command: "workflow.run",
          id: "req_memory_extract",
          payload: {
            input: {
              sourceId: getString(chapter, "id"),
              sourceText: "林鸢发现门缝下有一封旧信。",
              sourceType: "chapter",
            },
            projectId: getString(project, "id"),
            targetId: getString(chapter, "id"),
            targetType: "chapter",
            workflowType: "memory_extract",
          },
        }),
      );

      expect(run).toMatchObject({
        status: "waiting_user",
        workflowName: "memory_extract",
      });

      const candidates = await expectRpcData(
        rpcService.handle({
          command: "memory.listCandidates",
          id: "req_memory_extract_candidates",
          payload: {
            projectId: getString(project, "id"),
            status: "pending",
          },
        }),
      );

      expect(getArray(candidates)).toEqual([
        expect.objectContaining({
          content: "林鸢发现一封来自十年前的旧信。",
          sourceId: getString(chapter, "id"),
          sourceType: "chapter",
          status: "pending",
        }),
      ]);
    } finally {
      await moduleRef.close();
    }
  });
});

async function createRpcHarness(tempDirs: string[]) {
  const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-rpc-"));
  tempDirs.push(rootDir);
  process.env.STORY_PILOT_HOME = rootDir;
  process.env.STORY_PILOT_PROJECTS_ROOT = join(rootDir, "projects");
  delete process.env.STORY_PILOT_GLOBAL_DATABASE_PATH;
  delete process.env.STORY_PILOT_SETTINGS_PATH;
  const generatedCoreStoryText = buildGeneratedCoreStoryText("雪境堡垒");

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MODEL_GATEWAY)
    .useValue(
      new ModelGateway(
        new FakeModelProvider({
          objectResponses: {
            BlueprintGenerateOutput: {
              antagonistForce: "旧城钟楼背后的既得利益者。",
              corePromise: "每三章给出一条硬线索和一次反转。",
              differentiators: ["旧信谜题与人物成长绑定。"],
              emotionalAxes: ["悬疑", "反转"],
              logline: "旧信把主角拖回十年前的钟楼旧案。",
              mainConflict: "主角追查旧案时不断触碰旧城秩序。",
              mainGoal: "查清钟楼旧案并保护仍被旧案威胁的人。",
              premise: "雨夜旧信揭开旧城钟楼案。",
              protagonistArc: "从逃避旧案到主动承担代价。",
              risks: ["线索密度不足会削弱悬疑感。"],
              stakes: "失败会让旧案幸存者再次被清算。",
              storyDriver: "mystery",
            },
            CoreStoryFieldCompletionOutput: {
              fields: {
                antagonistForce: generatedCoreStoryText,
                corePromise: generatedCoreStoryText,
                differentiators: ["安全屋升级与秩序重建绑定", "资源账本推动人物关系变化"],
                emotionalAxes: ["生存压迫", "安全感兑现"],
                logline:
                  "全球极寒爆发后，沈砚把废弃堡垒改造成最后暖源，并在收容、自保与公开技术之间重建秩序。",
                mainConflict: generatedCoreStoryText,
                mainGoal: generatedCoreStoryText,
                premise: generatedCoreStoryText,
                protagonistArc: generatedCoreStoryText,
                risks: ["建设爽点不能脱离代价", "敌对势力不能只靠降智制造压力"],
                stakes: generatedCoreStoryText,
                storyDriver: "survival",
              },
            },
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
              reviewNotes: [],
            },
            ChapterExecutionCardOutput: {
              card: {
                chapterIndex: 1,
                coreConflict:
                  "主角必须在第一次触碰星潮禁令和隐藏自己身份之间做选择，司星阁的追捕会把个人修行欲望推向公开秩序冲突，也会让旧名单背后的家族债务提前暴露，形成升级爽点、身份风险和主线谜题三重压力。",
                emotionalTurn:
                  "主角从只想偷取一次修行机会，转向意识到自己已经进入无法回头的规则战争，并开始主动试探司星阁禁令边界。",
                forbiddenMoves: ["不要提前解释星潮终极来源"],
                hook: "禁令背后的旧名单出现主角父亲名字，并指向一处被删去的观星记录，记录末尾还有一个未签名的处决日期。",
                informationGain:
                  "星潮不是单纯天象，而是被司星阁长期管控的资源，底层越界会触发身份追踪，也会让旧名单中的家族债务重新浮出水面。",
                narrativeGoal:
                  "把第一章从常规入门推进到主线规则冲突，让读者同时获得禁区探索、第一次越界和旧名单悬念，并明确后续会围绕升级收益与身份代价持续推进，避免只写修行开局而没有长期追读牵引。",
                readerReward:
                  "给出主角第一次取得碎星砂的升级爽点，同时留下父亲旧名单和司星阁追踪的双重悬念，让读者既得到即时回报又期待下一章追查。",
                relatedForeshadowingIds: ["foreshadowing_1"],
                relatedPlotDebtIds: ["plot_debt_star_tide"],
                relatedPlotlineIds: ["plotline_1"],
                requiredCharacterIds: ["character_1"],
                requiredLocationIds: [],
                sceneBriefs: [
                  {
                    conflictTurn: "守卫发现禁区有异常灵纹，主角必须在逃离和夺取碎星砂之间抢时间。",
                    memoryTargets: ["碎星砂", "司星阁禁令"],
                    outcome:
                      "主角带走碎星砂，但身份追踪被启动，旧名单悬念进入明线并改变下一章行动目标。",
                    sceneGoal: "展示禁区规则、主角动机和第一次越界代价，并把升级爽点落到具体物件。",
                    sceneIndex: 1,
                  },
                ],
                targetWordCount: 3200,
                title: "第 1 章 星潮禁令",
              },
              riskNotes: ["旧名单真相需要后续分阶段揭示。"],
            },
            ContinuityReviewOutput: {
              issues: [
                {
                  evidence: "角色夜间进入档案馆需要解释通行权限。",
                  issueType: "world_rule",
                  relatedEntityIds: [],
                  severity: "warning",
                  suggestion: "补充内部人员协助或更改进入时间。",
                },
              ],
              summary: "连续性审阅完成。",
            },
            ForeshadowingPlanOutput: {
              suggestions: [
                {
                  action: "reinforce",
                  foreshadowingId: "foreshadowing_1",
                  priority: 2,
                  proposedText: "旧信水印在强光下短暂浮现。",
                  rationale: "当前章节适合强化，不宜直接回收。",
                },
              ],
              summary: "伏笔规划完成。",
            },
            MemoryExtractOutput: {
              conflictNotes: [],
              memoryCandidates: [
                {
                  confidence: 0.86,
                  content: "林鸢发现一封来自十年前的旧信。",
                  entityType: "story_event",
                  kind: "event",
                  sourceQuote: "林鸢发现门缝下有一封旧信。",
                },
              ],
            },
            ElementCandidateOutput: {
              items: [
                {
                  description: "受星轨潮汐影响的刀器，潮声越近锋芒越亮。",
                  name: "潮汐断星刃",
                  rationale: "贴合热血玄幻题材，并能服务星轨潮汐世界规则。",
                  tags: ["武器", "星轨", "潮汐"],
                  type: "weapon",
                },
                {
                  description: "混入的地点候选不应出现在武器生成结果里。",
                  name: "照潮城",
                  rationale: "用于验证服务层按所选类型过滤。",
                  tags: ["城市"],
                  type: "city",
                },
              ],
            },
            WorldbuildingFieldCompletionOutput: {
              fields: {
                coreConflict: buildGeneratedWorldbuildingText("核心矛盾"),
                culture: buildGeneratedWorldbuildingText("文化价值"),
                economy: buildGeneratedWorldbuildingText("资源经济"),
                factions: buildGeneratedWorldbuildingText("势力格局"),
                geography: buildGeneratedWorldbuildingText("空间地理"),
                history: buildGeneratedWorldbuildingText("历史背景"),
                powerOrder: buildGeneratedWorldbuildingText("权力体系"),
                powerSystem: buildGeneratedWorldbuildingText("力量体系"),
                rules: buildGeneratedWorldbuildingText("秩序规则"),
                socialStructure: buildGeneratedWorldbuildingText("社会结构"),
                specialMechanism: buildGeneratedWorldbuildingText("特殊机制"),
                worldBase: buildGeneratedWorldbuildingText("世界基底"),
              },
            },
            BookPlanGenerateOutput: {
              bookPlan: {
                corePromise: "每卷完成一次境界突破和一次关系反转。",
                endingDirection: "主角以失去旧身份为代价重塑天道。",
                targetWordCount: 3_000_000,
                title: "星潮纪全书规划",
              },
              riskNotes: ["前期要避免升级节奏过快。"],
              volumePlans: [
                {
                  arcs: [
                    {
                      arcIndex: 1,
                      endChapterIndex: 20,
                      escalation: ["发现禁令", "第一次越界", "暴露代价"],
                      purpose: "建立修行规则和第一重代价。",
                      startChapterIndex: 1,
                      title: "星潮初醒",
                    },
                  ],
                  climax: "主角公开打破司星阁第一条禁令。",
                  majorConflict: "主角想借星潮修行，司星阁禁止底层接触星潮。",
                  purpose: "完成世界规则展示和主角初次突破。",
                  targetWordCount: 360_000,
                  title: "第一卷 星潮初醒",
                  volumeIndex: 1,
                },
                {
                  arcs: [
                    {
                      arcIndex: 1,
                      endChapterIndex: 40,
                      escalation: ["结盟", "背叛", "夺回观星权"],
                      purpose: "扩大外部势力冲突并引出终局代价。",
                      startChapterIndex: 21,
                      title: "旧盟反噬",
                    },
                  ],
                  climax: "主角夺回一次观星权，但失去旧盟信任。",
                  majorConflict: "旧盟与司星阁同时争夺星潮归属。",
                  purpose: "完成势力扩张和关系反转。",
                  targetWordCount: 420_000,
                  title: "第二卷 旧盟反噬",
                  volumeIndex: 2,
                },
              ],
            },
            OutlineGenerateOutput: {
              chapterOutlines: Array.from({ length: 10 }, (_, index) => {
                const chapterNumber = index + 1;
                return {
                  chapterGoal: `完成第 ${chapterNumber} 章的线索推进。`,
                  conflict: `主角目标与当前阻力在第 ${chapterNumber} 章正面碰撞。`,
                  emotionalTurn:
                    chapterNumber === 1 ? "从平静到被迫卷入。" : "从短暂掌控到新的压力。",
                  hook: chapterNumber === 1 ? "信纸水印指向十年前钟楼。" : "留下一个具体未解问题。",
                  informationGain: `新增第 ${chapterNumber} 条与主冲突相关的信息。`,
                  targetWordCount: 3000,
                  title:
                    chapterNumber === 1 ? "第 1 章：开局钩子" : `第 ${chapterNumber} 章：推进节点`,
                };
              }),
              outline: {
                basis: {},
                scope: "chapter_batch",
                title: "前 10 章章纲",
              },
              riskNotes: [],
            },
            RollingChapterPlanGenerateOutput: {
              chapterPlans: Array.from({ length: 10 }, (_, index) => {
                const chapterNumber = index + 1;
                return {
                  chapterGoal:
                    chapterNumber === 1
                      ? "主角第一次触碰星潮禁令。"
                      : `完成第 ${chapterNumber} 章的弧线推进。`,
                  chapterIndex: chapterNumber,
                  conflict:
                    chapterNumber === 1
                      ? "求生需求与司星阁禁令冲突。"
                      : `第 ${chapterNumber} 章的行动目标与新阻力冲突。`,
                  emotionalTurn: chapterNumber === 1 ? "从压抑到短暂掌控。" : "从推进到更深压力。",
                  hook:
                    chapterNumber === 1
                      ? "禁令背后的旧名单出现主角父亲名字。"
                      : "新的星潮异常暴露。",
                  informationGain:
                    chapterNumber === 1
                      ? "星潮不是天灾，而是被人为管控的资源。"
                      : `新增第 ${chapterNumber} 条星潮规则信息。`,
                  relatedCharacterIds: ["character_1"],
                  relatedForeshadowingIds: ["foreshadowing_1"],
                  relatedPlotlineIds: ["plotline_1"],
                  scenes: [
                    {
                      conflictTurn:
                        chapterNumber === 1
                          ? "守卫发现主角私入禁区。"
                          : `第 ${chapterNumber} 章场景内出现反制。`,
                      memoryTargets: [`第 ${chapterNumber} 章产生的长期事实`],
                      outcome:
                        chapterNumber === 1
                          ? "主角带走一枚碎星砂。"
                          : `第 ${chapterNumber} 章留下后续代价。`,
                      sceneGoal:
                        chapterNumber === 1
                          ? "展示禁区规则和主角动机。"
                          : `推进第 ${chapterNumber} 章目标。`,
                      sceneIndex: 1,
                    },
                  ],
                  targetWordCount: 3200,
                  title:
                    chapterNumber === 1 ? "第 1 章 星潮禁令" : `第 ${chapterNumber} 章 星潮推进`,
                };
              }),
              riskNotes: ["注意第一章不要解释过多设定。"],
            },
          },
        }),
      ),
    )
    .compile();

  return {
    moduleRef,
    rootDir,
    rpcService: moduleRef.get(RpcService),
  };
}

async function createProjectAndChapter(rpcService: RpcService) {
  const project = await expectRpcOk(
    rpcService.handle({
      command: "project.create",
      id: "req_project_setup",
      payload: { genre: "悬疑", title: "长夜序章" },
    }),
  );
  const chapter = await expectRpcOk(
    rpcService.handle({
      command: "chapter.create",
      id: "req_chapter_setup",
      payload: {
        projectId: getString(project, "id"),
        title: "第一章 雨夜来信",
        volumeId: getString(project, "defaultVolumeId"),
      },
    }),
  );

  return { chapter, project };
}

async function createConfirmedBriefAndBlueprint(
  rpcService: RpcService,
  input: { readonly genre: string; readonly title: string },
): Promise<Record<string, unknown>> {
  const project = await expectRpcOk(
    rpcService.handle({
      command: "project.create",
      id: `req_project_${input.title}`,
      payload: { genre: input.genre, title: input.title },
    }),
  );
  const projectId = getString(project, "id");
  const brief = getRecord(
    await expectRpcOk(
      rpcService.handle({
        command: "creativeStage.getPath",
        id: `req_path_${input.title}`,
        payload: { projectId },
      }),
    ),
    "brief",
  );
  await expectRpcOk(
    rpcService.handle({
      command: "brief.confirm",
      id: `req_brief_confirm_${input.title}`,
      payload: {
        briefId: getString(brief, "id"),
        projectId,
      },
    }),
  );
  const blueprintResult = await expectRpcOk(
    rpcService.handle({
      command: "blueprint.generate",
      id: `req_blueprint_generate_${input.title}`,
      payload: { projectId },
    }),
  );
  await expectRpcOk(
    rpcService.handle({
      command: "blueprint.apply",
      id: `req_blueprint_apply_${input.title}`,
      payload: {
        blueprintId: getString(getRecord(blueprintResult, "blueprint"), "id"),
        projectId,
      },
    }),
  );

  return project;
}

function buildGeneratedCoreStoryText(anchor: string): string {
  return [
    `${anchor}的故事契约把主角目标、读者期待和长期阻力绑定在同一条因果链上：主角必须守住安全屋，也必须决定安全屋到底是个人私产、幸存者避难所，还是极寒时代的新秩序样本。`,
    "每一次扩建都会兑现安全感和建设爽点，同时留下更难偿还的代价，包括热源暴露、物资账本失衡、盟友立场变化和外部势力升级。",
    "对抗力量拥有清晰利益逻辑，会用并购、封锁、舆论、间谍和武力持续压迫主角，而不是等待主角触发事件。",
    "阶段胜利必须推动下一阶段目标，让读者持续看到安全屋升级、制度试错、群像羁绊和文明重建的递进。",
  ].join("");
}

function buildGeneratedWorldbuildingText(anchor: string): string {
  return [
    `${anchor}围绕极寒灾变、安全屋工程和幸存者秩序展开：热量、食物、药品、通行权和可信信息都是不可凭空产生的硬资源，任何组织想活下去都必须付出劳动、技术、情报或政治信用。`,
    "运行规则上，每个设定都要改变人物选择，短期收益会留下长期后果，例如热源扩张会暴露位置，收容人口会稀释储备，公开技术会削弱垄断也会引来围攻。",
    "叙事冲突来自自保与公共秩序的拉扯，主角每次破局都要承担资源损耗、关系裂痕、制度反噬或敌方升级。",
    "代价限制保证安全屋不能万能，剧情接口可以连接卷级工程升级、外部势力谈判、内部审议、灾害变异、伏笔回收和终局文明重启，并与其他世界观维度形成闭环。",
    "这些接口会反复回到人物选择，让设定持续变成情节压力。",
    "后续每卷都能围绕该规则升级冲突并回收早期代价。",
  ].join("");
}

async function expectRpcOk(responsePromise: Promise<unknown>): Promise<Record<string, unknown>> {
  const data = await expectRpcData(responsePromise);
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("Expected object RPC data");
  }
  return data as Record<string, unknown>;
}

async function expectRpcData(responsePromise: Promise<unknown>): Promise<unknown> {
  const response = await responsePromise;
  expect(response, JSON.stringify(response, null, 2)).toMatchObject({ ok: true });
  return getField(response, "data");
}

function getArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error("Expected array");
  }
  return value;
}

function getRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Expected object for ${field}`);
  }
  const record = value as Record<string, unknown>;
  const child = record[field];
  if (typeof child !== "object" || child === null || Array.isArray(child)) {
    throw new Error(`Expected object field ${field}`);
  }
  return child as Record<string, unknown>;
}

function getField(value: unknown, field: string): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Expected object for ${field}`);
  }
  const record = value as Record<string, unknown>;
  return record[field];
}

function getRecordArray(value: unknown, field: string): Record<string, unknown>[] {
  const record = value as Record<string, unknown>;
  const child = record[field];
  if (!Array.isArray(child)) {
    throw new Error(`Expected array field ${field}`);
  }
  return child.filter(
    (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
  );
}

function parseJsonRecord(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Expected JSON object");
  }

  return parsed as Record<string, unknown>;
}

function getStage(value: unknown, stageKey: string): Record<string, unknown> {
  const stage = getRecordArray(value, "stages").find(
    (candidate) => candidate.stageKey === stageKey,
  );
  if (!stage) {
    throw new Error(`Expected stage ${stageKey}`);
  }

  return stage;
}

function getString(value: unknown, field: string): string {
  const record = value as Record<string, unknown>;
  const child = record[field];
  if (typeof child !== "string") {
    throw new Error(`Expected string field ${field}`);
  }
  return child;
}

function getNumber(value: unknown, field: string): number {
  const record = value as Record<string, unknown>;
  const child = record[field];
  if (typeof child !== "number") {
    throw new Error(`Expected number field ${field}`);
  }
  return child;
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
