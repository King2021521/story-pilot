import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Test } from "@nestjs/testing";
import { FakeModelProvider, ModelGateway } from "@story-pilot/ai";
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
