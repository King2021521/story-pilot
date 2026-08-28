import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Test } from "@nestjs/testing";
import { FakeModelProvider, ModelGateway } from "@story-pilot/ai";
import { createProjectDatabase, PROJECT_DATABASE_FILE } from "@story-pilot/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MODEL_GATEWAY } from "../ai/model-gateway.provider.js";
import { AppModule } from "../app.module.js";
import { RpcService } from "./rpc.service.js";

describe("RpcService MVP command integration", () => {
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
            archetype: "调查者",
            goal: "查清旧案",
            name: "林鸢",
            projectId: getString(project, "id"),
            role: "protagonist",
          },
        }),
      );
      const updatedCharacter = await expectRpcOk(
        rpcService.handle({
          command: "character.update",
          id: "req_character_update",
          payload: {
            characterId: getString(character, "id"),
            patch: { goal: "保护证人", name: "林鸢" },
            projectId: getString(project, "id"),
          },
        }),
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

      expect(updatedCharacter).toMatchObject({ motivation: "保护证人" });
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
      expect(planRun).toMatchObject({
        output: { artifactId: expect.any(String) },
        status: "completed",
        workflowName: "foreshadowing_plan",
      });
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
      await expectRpcOk(
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
            kind: "mystery",
            priority: 5,
            projectId: getString(project, "id"),
            summary: "围绕旧信来源展开。",
            title: "旧信谜团",
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
        plotlines: [expect.objectContaining({ name: "旧信谜团" })],
        worldRules: [expect.objectContaining({ title: "旧城区治理" })],
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
            elementType: "weapon",
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
          name: "潮汐断星刃",
          type: "weapon",
        }),
        expect.objectContaining({ type: "weapon" }),
        expect.objectContaining({ type: "weapon" }),
        expect.objectContaining({ type: "weapon" }),
        expect.objectContaining({ type: "weapon" }),
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
                type: "organization",
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
        expect.objectContaining({ name: "潮汐断星刃", target: "item" }),
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
        expect.objectContaining({ name: "司星阁", type: "organization" }),
      ]);
      const boardItems = getRecordArray(board, "items");
      expect(boardItems).toHaveLength(3);
      expect(boardItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "潮汐断星刃", type: "weapon" }),
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
  process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
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
              reviewNotes: [],
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
          },
        }),
      ),
    )
    .compile();

  return {
    moduleRef,
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

async function expectRpcOk(responsePromise: Promise<unknown>): Promise<Record<string, unknown>> {
  const data = await expectRpcData(responsePromise);
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("Expected object RPC data");
  }
  return data as Record<string, unknown>;
}

async function expectRpcData(responsePromise: Promise<unknown>): Promise<unknown> {
  const response = await responsePromise;
  expect(response).toMatchObject({ ok: true });
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
