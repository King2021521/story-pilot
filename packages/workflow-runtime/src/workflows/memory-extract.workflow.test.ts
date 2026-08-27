import { describe, expect, it } from "vitest";

import { WorkflowEngine } from "../engine/workflow-engine.js";
import { WorkflowRegistry } from "../engine/workflow-registry.js";
import {
  createMemoryExtractWorkflow,
  type PersistMemoryExtractInput,
} from "./memory-extract.workflow.js";

describe("memory extract workflow", () => {
  it("extracts candidate memories, persists them, and waits for user confirmation", async () => {
    const persisted: PersistMemoryExtractInput[] = [];
    const registry = new WorkflowRegistry().register(
      createMemoryExtractWorkflow({
        extractMemories: async () => ({
          conflictNotes: [],
          memoryCandidates: [
            {
              confidence: 0.82,
              content: "林鸢发现一封来自十年前的旧信。",
              entityType: "story_event",
              kind: "event",
              sourceQuote: "林鸢发现门缝下有一封旧信。",
              status: "pending",
            },
          ],
        }),
        persistCandidates: async (input) => {
          persisted.push(input);
          return { memoryCandidateIds: ["candidate_1"] };
        },
        prepareSource: async () => ({
          sourceId: "chapter_1",
          sourceText: "林鸢发现门缝下有一封旧信。",
          sourceType: "chapter",
        }),
      }),
    );

    const run = await new WorkflowEngine(registry).run({
      input: {
        projectId: "project_1",
        sourceId: "chapter_1",
        sourceType: "chapter",
      },
      runId: "run_1",
      workflowName: "memory_extract",
    });

    expect(run.status).toBe("waiting_user");
    expect(run.steps.map((step) => step.name)).toEqual([
      "prepare_source",
      "call_model",
      "persist_memory_candidates",
      "wait_for_user_confirmation",
    ]);
    expect(persisted).toEqual([
      expect.objectContaining({
        memoryCandidates: [
          expect.objectContaining({
            content: "林鸢发现一封来自十年前的旧信。",
            status: "pending",
          }),
        ],
        projectId: "project_1",
        sourceId: "chapter_1",
        sourceType: "chapter",
        workflowRunId: "run_1",
      }),
    ]);
    expect(run.steps.at(-1)).toMatchObject({
      output: { memoryCandidateIds: ["candidate_1"] },
      status: "waiting_user",
    });
  });
});
