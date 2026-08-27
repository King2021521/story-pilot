import { describe, expect, it } from "vitest";

import { WorkflowEngine } from "../engine/workflow-engine.js";
import { WorkflowRegistry } from "../engine/workflow-registry.js";
import {
  createChapterDraftWorkflow,
  type PersistChapterDraftInput,
} from "./chapter-draft.workflow.js";

describe("chapter draft workflow", () => {
  it("builds context, generates a draft, and persists artifact plus memory candidates", async () => {
    const persisted: PersistChapterDraftInput[] = [];
    const registry = new WorkflowRegistry().register(
      createChapterDraftWorkflow({
        buildContext: async () => ({
          contextPackageId: "ctx_1",
          text: "canon memory: 林鸢隐瞒了周砚。",
        }),
        generateDraft: async () => ({
          draft: {
            body: "雨夜里，林鸢发现门缝下有一封信。",
            summary: "发现来信。",
            title: "雨夜来信",
          },
          memoryCandidates: [
            {
              confidence: 0.7,
              content: "林鸢发现一封信。",
              entityType: "story_event",
              kind: "event",
              status: "pending",
            },
          ],
          reviewNotes: [],
        }),
        persistDraft: async (input) => {
          persisted.push(input);
          return {
            artifactId: "artifact_1",
            memoryCandidateIds: ["candidate_1"],
          };
        },
      }),
    );

    const run = await new WorkflowEngine(registry).run({
      input: {
        chapterId: "chapter_1",
        instruction: "生成第一章草稿",
        projectId: "project_1",
      },
      runId: "run_1",
      workflowName: "chapter_draft",
    });

    expect(run.status).toBe("completed");
    expect(run.output).toEqual({
      artifactId: "artifact_1",
      memoryCandidateIds: ["candidate_1"],
    });
    expect(run.steps.map((step) => step.name)).toEqual([
      "build_context",
      "call_model",
      "persist_artifact_and_memory_candidates",
    ]);
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({
      contextPackageId: "ctx_1",
      draft: {
        body: expect.stringContaining("门缝"),
      },
      projectId: "project_1",
    });
  });
});
