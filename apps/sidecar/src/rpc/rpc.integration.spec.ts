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
  const response = await responsePromise;
  expect(response).toMatchObject({ ok: true });
  const data = getRecord(response, "data");
  return data;
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

function getRecordArray(value: unknown, field: string): Record<string, unknown>[] {
  const record = value as Record<string, unknown>;
  const child = record[field];
  if (!Array.isArray(child)) {
    throw new Error(`Expected array field ${field}`);
  }
  return child.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null);
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
