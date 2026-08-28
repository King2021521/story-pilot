import { describe, expect, it } from "vitest";

import { WorkflowEngine } from "./workflow-engine.js";
import { WorkflowRegistry } from "./workflow-registry.js";

describe("WorkflowEngine", () => {
  it("runs workflows from queued to running, waits for user, then completes on resume", async () => {
    const observedStatuses: string[] = [];
    const registry = new WorkflowRegistry().register({
      name: "chapter_draft",
      steps: [
        {
          name: "build_context",
          execute: async () => ({ status: "completed", output: { contextPackageId: "ctx_1" } }),
        },
        {
          name: "user_gate",
          execute: async ({ input }) =>
            input.approved === true
              ? { status: "completed", output: { approved: true } }
              : { status: "waiting_user", output: { reason: "needs_artifact_review" } },
        },
        {
          name: "persist_artifact",
          execute: async () => ({ status: "completed", output: { artifactId: "artifact_1" } }),
        },
      ],
    });
    const engine = new WorkflowEngine(registry, {
      onRunUpdated: (run) => observedStatuses.push(run.status),
    });

    const waitingRun = await engine.run({
      input: {},
      runId: "run_1",
      workflowName: "chapter_draft",
    });

    expect(waitingRun.status).toBe("waiting_user");
    expect(waitingRun.steps.map((step) => step.status)).toEqual([
      "completed",
      "waiting_user",
      "queued",
    ]);
    expect(observedStatuses).toEqual(["queued", "running", "waiting_user"]);

    const completedRun = await engine.resume({
      input: { approved: true },
      run: waitingRun,
    });

    expect(completedRun.status).toBe("completed");
    expect(completedRun.steps.map((step) => step.status)).toEqual([
      "completed",
      "completed",
      "completed",
    ]);
    expect(observedStatuses).toEqual(["queued", "running", "waiting_user", "running", "completed"]);
  });

  it("cancels non-terminal workflow runs", async () => {
    const registry = new WorkflowRegistry().register({
      name: "review",
      steps: [
        {
          name: "wait",
          execute: async () => ({ status: "waiting_user" }),
        },
      ],
    });
    const engine = new WorkflowEngine(registry);
    const waitingRun = await engine.run({
      input: {},
      runId: "run_2",
      workflowName: "review",
    });

    expect(engine.cancel(waitingRun).status).toBe("canceled");
  });
});
