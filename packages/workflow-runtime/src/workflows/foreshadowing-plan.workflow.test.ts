import { describe, expect, it } from "vitest";

import { WorkflowEngine } from "../engine/workflow-engine.js";
import { WorkflowRegistry } from "../engine/workflow-registry.js";
import { createForeshadowingPlanWorkflow } from "./foreshadowing-plan.workflow.js";

describe("createForeshadowingPlanWorkflow", () => {
  it("builds context, calls planner, and persists a planning artifact", async () => {
    const workflow = createForeshadowingPlanWorkflow({
      buildContext: async () => ({ contextPackageId: "context_1", text: "open foreshadowings" }),
      persistPlan: async () => ({ artifactId: "artifact_plan" }),
      planForeshadowing: async () => ({
        suggestions: [
          {
            action: "reinforce",
            foreshadowingId: "foreshadowing_1",
            priority: 1,
            rationale: "还不到回收时机。",
          },
        ],
        summary: "建议强化伏笔。",
      }),
    });

    const run = await new WorkflowEngine(new WorkflowRegistry().register(workflow)).run({
      input: { projectId: "project_1", targetId: "chapter_3", targetType: "chapter" },
      runId: "run_1",
      workflowName: "foreshadowing_plan",
    });

    expect(run.status).toBe("completed");
    expect(run.steps.map((step) => step.name)).toEqual([
      "build_context",
      "call_model",
      "persist_plan_artifact",
    ]);
    expect(run.output).toEqual({
      artifactId: "artifact_plan",
      suggestionCount: 1,
    });
  });
});
