import type { WorkflowDefinition } from "../engine/workflow-registry.js";

export interface ForeshadowingPlanSuggestion {
  readonly action: "seed" | "reinforce" | "payoff" | "delay" | "revise";
  readonly foreshadowingId?: string | undefined;
  readonly chapterId?: string | undefined;
  readonly rationale: string;
  readonly proposedText?: string | undefined;
  readonly priority: number;
}

export interface ForeshadowingPlanOutput {
  readonly summary: string;
  readonly suggestions: readonly ForeshadowingPlanSuggestion[];
}

export interface ForeshadowingPlanWorkflowContext {
  readonly contextPackageId?: string;
  readonly text: string;
}

export interface PersistForeshadowingPlanInput extends ForeshadowingPlanOutput {
  readonly projectId: string;
  readonly workflowRunId: string;
  readonly targetType?: string | undefined;
  readonly targetId?: string | undefined;
  readonly contextPackageId?: string | undefined;
}

export interface PersistForeshadowingPlanResult {
  readonly artifactId: string;
}

export interface ForeshadowingPlanWorkflowDependencies {
  buildContext(input: {
    readonly projectId: string;
    readonly targetType?: string | undefined;
    readonly targetId?: string | undefined;
  }): Promise<ForeshadowingPlanWorkflowContext>;
  planForeshadowing(input: {
    readonly projectId: string;
    readonly targetType?: string | undefined;
    readonly targetId?: string | undefined;
    readonly context: ForeshadowingPlanWorkflowContext;
  }): Promise<ForeshadowingPlanOutput>;
  persistPlan(input: PersistForeshadowingPlanInput): Promise<PersistForeshadowingPlanResult>;
}

export function createForeshadowingPlanWorkflow(
  dependencies: ForeshadowingPlanWorkflowDependencies,
): WorkflowDefinition {
  return {
    name: "foreshadowing_plan",
    steps: [
      {
        name: "build_context",
        execute: async ({ input }) => {
          const projectId = requireString(input.projectId, "projectId");
          const context = await dependencies.buildContext({
            projectId,
            ...optionalString("targetId", input.targetId),
            ...optionalString("targetType", input.targetType),
          });

          return {
            output: {
              contextPackageId: context.contextPackageId,
              contextText: context.text,
            },
            status: "completed",
          };
        },
      },
      {
        name: "call_model",
        execute: async ({ input }) => {
          const context: ForeshadowingPlanWorkflowContext = {
            text: requireString(input.contextText, "contextText"),
            ...optionalString("contextPackageId", input.contextPackageId),
          };
          const output = await dependencies.planForeshadowing({
            context,
            projectId: requireString(input.projectId, "projectId"),
            ...optionalString("targetId", input.targetId),
            ...optionalString("targetType", input.targetType),
          });

          return {
            output: output as unknown as Record<string, unknown>,
            status: "completed",
          };
        },
      },
      {
        name: "persist_plan_artifact",
        execute: async ({ input, runId }) => {
          const projectId = requireString(input.projectId, "projectId");
          const summary = requireString(input.summary, "summary");
          const suggestions = Array.isArray(input.suggestions)
            ? (input.suggestions as readonly ForeshadowingPlanSuggestion[])
            : [];
          const persisted = await dependencies.persistPlan({
            projectId,
            suggestions,
            summary,
            workflowRunId: runId,
            ...optionalString("contextPackageId", input.contextPackageId),
            ...optionalString("targetId", input.targetId),
            ...optionalString("targetType", input.targetType),
          });

          return {
            output: {
              artifactId: persisted.artifactId,
              suggestionCount: suggestions.length,
            },
            status: "completed",
          };
        },
      },
    ],
  };
}

function requireString(value: unknown, field: string): string {
  const stringValue = getString(value);
  if (!stringValue) {
    throw new Error(`INVALID_WORKFLOW_INPUT: ${field}`);
  }

  return stringValue;
}

function optionalString(key: string, value: unknown): Record<string, string> {
  const stringValue = getString(value);
  return stringValue === undefined ? {} : { [key]: stringValue };
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
