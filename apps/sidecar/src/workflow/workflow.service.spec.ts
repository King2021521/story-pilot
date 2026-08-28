import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Test } from "@nestjs/testing";
import { FakeModelProvider, ModelGateway } from "@story-pilot/ai";
import { createProjectDatabase, PROJECT_DATABASE_FILE } from "@story-pilot/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MODEL_GATEWAY } from "../ai/model-gateway.provider.js";
import { ProjectModule } from "../project/project.module.js";
import { ProjectService } from "../project/project.service.js";
import { WorkflowModule } from "./workflow.module.js";
import { WorkOrderService } from "./work-order.service.js";
import { WorkflowService } from "./workflow.service.js";

describe("WorkflowService", () => {
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

  it("creates work orders and persists completed workflow runs", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-workflows-"));
    tempDirs.push(rootDir);
    process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;

    const moduleRef = await Test.createTestingModule({
      imports: [ProjectModule, WorkflowModule],
    })
      .overrideProvider(MODEL_GATEWAY)
      .useValue(
        new ModelGateway(
          new FakeModelProvider({
            objectResponses: {
              ContinuityReviewOutput: {
                issues: [
                  {
                    evidence: "草稿违反了档案馆夜间规则。",
                    issueType: "world_rule",
                    relatedEntityIds: ["rule_1"],
                    severity: "error",
                    suggestion: "补充内部通行权限。",
                  },
                ],
                summary: "发现世界规则冲突。",
              },
            },
          }),
        ),
      )
      .compile();
    const projectService = moduleRef.get(ProjectService);
    const workOrderService = moduleRef.get(WorkOrderService);
    const workflowService = moduleRef.get(WorkflowService);

    const project = await projectService.createProject({ title: "长夜序章", genre: "悬疑" });
    const workOrder = await workOrderService.create({
      projectId: project.id,
      title: "连续性检查",
      type: "review",
    });
    const run = await workflowService.run({
      input: { scope: "chapter" },
      projectId: project.id,
      targetType: "project",
      workflowType: "review",
      workOrderId: workOrder.id,
    });

    expect(run.status).toBe("completed");
    expect(run.steps).toEqual([
      expect.objectContaining({ name: "build_context", status: "completed" }),
      expect.objectContaining({ name: "call_model", status: "completed" }),
      expect.objectContaining({ name: "persist_review_artifact", status: "completed" }),
    ]);

    const projectDatabase = createProjectDatabase(join(project.rootPath, PROJECT_DATABASE_FILE));
    try {
      expect(
        projectDatabase.client
          .prepare("select status from work_orders where id = ?")
          .get(workOrder.id),
      ).toMatchObject({ status: "completed" });
      expect(
        projectDatabase.client
          .prepare("select workflow_name, status from workflow_runs where id = ?")
          .get(run.id),
      ).toMatchObject({ status: "completed", workflow_name: "review" });
      expect(
        projectDatabase.client
          .prepare("select name, status from workflow_steps where workflow_run_id = ?")
          .all(run.id),
      ).toEqual([
        expect.objectContaining({ name: "build_context", status: "completed" }),
        expect.objectContaining({ name: "call_model", status: "completed" }),
        expect.objectContaining({ name: "persist_review_artifact", status: "completed" }),
      ]);
      expect(
        projectDatabase.client
          .prepare("select purpose, prompt_version, status from model_calls")
          .get(),
      ).toMatchObject({
        prompt_version: "continuity-review.v1",
        purpose: "continuity_review",
        status: "completed",
      });
      expect(
        projectDatabase.client.prepare("select kind, title, body, status from artifacts").get(),
      ).toMatchObject({
        body: expect.stringContaining("世界规则冲突"),
        kind: "review_report",
        status: "pending",
        title: "连续性审阅报告",
      });
      expect(
        projectDatabase.client
          .prepare("select issue_type, severity, message, target_type, status from review_issues")
          .get(),
      ).toMatchObject({
        issue_type: "world_rule",
        message: "补充内部通行权限。",
        severity: "error",
        status: "open",
        target_type: "project",
      });
    } finally {
      projectDatabase.close();
    }
  });

  it("runs foreshadowing planning through the model gateway and persists an artifact", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-workflows-"));
    tempDirs.push(rootDir);
    process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;

    const moduleRef = await Test.createTestingModule({
      imports: [ProjectModule, WorkflowModule],
    })
      .overrideProvider(MODEL_GATEWAY)
      .useValue(
        new ModelGateway(
          new FakeModelProvider({
            objectResponses: {
              ForeshadowingPlanOutput: {
                suggestions: [
                  {
                    action: "payoff",
                    chapterId: "chapter_6",
                    foreshadowingId: "foreshadowing_1",
                    priority: 1,
                    proposedText: "旧信水印指向真正的寄信人。",
                    rationale: "第六章适合回收旧信主线伏笔。",
                  },
                ],
                summary: "建议第六章回收旧信水印。",
              },
            },
          }),
        ),
      )
      .compile();
    const projectService = moduleRef.get(ProjectService);
    const workflowService = moduleRef.get(WorkflowService);

    const project = await projectService.createProject({ title: "长夜序章", genre: "悬疑" });
    const run = await workflowService.run({
      input: {},
      projectId: project.id,
      targetId: "chapter_6",
      targetType: "chapter",
      workflowType: "foreshadowing_plan",
    });

    expect(run).toMatchObject({
      output: { artifactId: expect.any(String) },
      status: "completed",
      workflowName: "foreshadowing_plan",
    });

    const projectDatabase = createProjectDatabase(join(project.rootPath, PROJECT_DATABASE_FILE));
    try {
      expect(
        projectDatabase.client
          .prepare("select purpose, prompt_version, status from model_calls")
          .get(),
      ).toMatchObject({
        prompt_version: "foreshadowing-plan.v1",
        purpose: "foreshadowing_plan",
        status: "completed",
      });
      expect(
        projectDatabase.client.prepare("select kind, title, body, status from artifacts").get(),
      ).toMatchObject({
        body: expect.stringContaining("旧信水印"),
        kind: "review_report",
        status: "pending",
        title: "伏笔规划建议",
      });
    } finally {
      projectDatabase.close();
    }
  });

  it("persists workflow cancellation", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-workflows-"));
    tempDirs.push(rootDir);
    process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;

    const moduleRef = await Test.createTestingModule({
      imports: [ProjectModule, WorkflowModule],
    })
      .overrideProvider(MODEL_GATEWAY)
      .useValue(
        new ModelGateway(
          new FakeModelProvider({
            objectResponses: {
              MemoryExtractOutput: {
                conflictNotes: [],
                memoryCandidates: [],
              },
            },
          }),
        ),
      )
      .compile();
    const projectService = moduleRef.get(ProjectService);
    const workflowService = moduleRef.get(WorkflowService);

    const project = await projectService.createProject({ title: "长夜序章", genre: "悬疑" });
    const run = await workflowService.run({
      input: {
        sourceId: "chapter_cancel",
        sourceText: "仅用于触发待确认状态的正文。",
        sourceType: "chapter",
      },
      projectId: project.id,
      targetId: "chapter_cancel",
      targetType: "chapter",
      workflowType: "memory_extract",
    });

    expect(run.status).toBe("waiting_user");
    await expect(
      workflowService.cancel({
        projectId: project.id,
        workflowRunId: run.id,
      }),
    ).resolves.toMatchObject({
      status: "canceled",
    });
  });

  it("extracts memory candidates through the model gateway and leaves them pending", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "story-pilot-workflows-"));
    tempDirs.push(rootDir);
    process.env.STORY_PILOT_PROJECTS_ROOT = rootDir;

    const moduleRef = await Test.createTestingModule({
      imports: [ProjectModule, WorkflowModule],
    })
      .overrideProvider(MODEL_GATEWAY)
      .useValue(
        new ModelGateway(
          new FakeModelProvider({
            objectResponses: {
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
    const projectService = moduleRef.get(ProjectService);
    const workflowService = moduleRef.get(WorkflowService);

    const project = await projectService.createProject({ title: "长夜序章", genre: "悬疑" });
    const run = await workflowService.run({
      input: {
        sourceId: "chapter_1",
        sourceText: "林鸢发现门缝下有一封旧信。",
        sourceType: "chapter",
      },
      projectId: project.id,
      targetId: "chapter_1",
      targetType: "chapter",
      workflowType: "memory_extract",
    });

    expect(run.status).toBe("waiting_user");

    const projectDatabase = createProjectDatabase(join(project.rootPath, PROJECT_DATABASE_FILE));
    try {
      expect(
        projectDatabase.client
          .prepare(
            "select content, status, source_type, source_id, model_call_id from memory_candidates",
          )
          .all(),
      ).toEqual([
        expect.objectContaining({
          content: "林鸢发现一封来自十年前的旧信。",
          source_id: "chapter_1",
          source_type: "chapter",
          status: "pending",
        }),
      ]);
      expect(
        projectDatabase.client
          .prepare("select purpose, prompt_version, status from model_calls")
          .get(),
      ).toMatchObject({
        prompt_version: "memory-extract.v1",
        purpose: "memory_extract",
        status: "completed",
      });
      expect(
        projectDatabase.client
          .prepare(
            "select aggregate_type, event_type, payload from domain_events where event_type = ?",
          )
          .get("memory_candidate.created"),
      ).toMatchObject({
        aggregate_type: "memory_candidate",
        event_type: "memory_candidate.created",
        payload: expect.stringContaining("chapter_1"),
      });
    } finally {
      projectDatabase.close();
    }
  });
});
