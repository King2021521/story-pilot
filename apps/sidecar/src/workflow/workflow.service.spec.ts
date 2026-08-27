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
    }).compile();
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
      expect.objectContaining({
        name: "prepare_review",
        status: "completed",
      }),
    ]);

    const projectDatabase = createProjectDatabase(join(project.rootPath, PROJECT_DATABASE_FILE));
    try {
      expect(
        projectDatabase.client.prepare("select status from work_orders where id = ?").get(workOrder.id),
      ).toMatchObject({ status: "completed" });
      expect(
        projectDatabase.client.prepare("select workflow_name, status from workflow_runs where id = ?").get(run.id),
      ).toMatchObject({ status: "completed", workflow_name: "review" });
      expect(
        projectDatabase.client
          .prepare("select name, status from workflow_steps where workflow_run_id = ?")
          .all(run.id),
      ).toEqual([expect.objectContaining({ name: "prepare_review", status: "completed" })]);
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
          .prepare("select content, status, source_type, source_id, model_call_id from memory_candidates")
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
    } finally {
      projectDatabase.close();
    }
  });
});
