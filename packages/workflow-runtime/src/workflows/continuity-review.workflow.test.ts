import { describe, expect, it } from "vitest";

import { WorkflowEngine } from "../engine/workflow-engine.js";
import { WorkflowRegistry } from "../engine/workflow-registry.js";
import { createContinuityReviewWorkflow } from "./continuity-review.workflow.js";

describe("createContinuityReviewWorkflow", () => {
  it("builds context, calls reviewer, and persists a review artifact", async () => {
    const workflow = createContinuityReviewWorkflow({
      buildContext: async () => ({ contextPackageId: "context_1", text: "canon memory" }),
      persistReview: async () => ({ artifactId: "artifact_review" }),
      reviewContinuity: async () => ({
        issues: [
          {
            evidence: "违背规则",
            issueType: "world_rule",
            relatedEntityIds: [],
            severity: "error",
            suggestion: "修正规则引用",
          },
        ],
        summary: "发现冲突。",
      }),
    });

    const run = await new WorkflowEngine(new WorkflowRegistry().register(workflow)).run({
      input: { projectId: "project_1", targetId: "chapter_1", targetType: "chapter" },
      runId: "run_1",
      workflowName: "review",
    });

    expect(run.status).toBe("completed");
    expect(run.steps.map((step) => step.name)).toEqual([
      "build_context",
      "call_model",
      "persist_review_artifact",
    ]);
    expect(run.output).toEqual({
      artifactId: "artifact_review",
      issueCount: 1,
    });
  });
});
