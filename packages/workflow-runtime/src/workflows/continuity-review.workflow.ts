import type { WorkflowDefinition } from "../engine/workflow-registry.js";

export interface ContinuityReviewIssue {
  readonly issueType: string;
  readonly severity: "info" | "warning" | "error";
  readonly evidence: string;
  readonly suggestion: string;
  readonly relatedEntityIds?: readonly string[] | undefined;
}

export interface ContinuityReviewOutput {
  readonly summary: string;
  readonly issues: readonly ContinuityReviewIssue[];
}

export interface ContinuityReviewWorkflowContext {
  readonly contextPackageId?: string;
  readonly text: string;
}

export interface PersistContinuityReviewInput extends ContinuityReviewOutput {
  readonly projectId: string;
  readonly workflowRunId: string;
  readonly targetType?: string | undefined;
  readonly targetId?: string | undefined;
  readonly contextPackageId?: string | undefined;
}

export interface PersistContinuityReviewResult {
  readonly artifactId: string;
}

export interface ContinuityReviewWorkflowDependencies {
  buildContext(input: {
    readonly projectId: string;
    readonly scope?: string | undefined;
    readonly targetType?: string | undefined;
    readonly targetId?: string | undefined;
  }): Promise<ContinuityReviewWorkflowContext>;
  reviewContinuity(input: {
    readonly projectId: string;
    readonly scope?: string | undefined;
    readonly targetType?: string | undefined;
    readonly targetId?: string | undefined;
    readonly context: ContinuityReviewWorkflowContext;
  }): Promise<ContinuityReviewOutput>;
  persistReview(input: PersistContinuityReviewInput): Promise<PersistContinuityReviewResult>;
}

export function createContinuityReviewWorkflow(
  dependencies: ContinuityReviewWorkflowDependencies,
): WorkflowDefinition {
  return {
    name: "review",
    steps: [
      {
        name: "build_context",
        execute: async ({ input }) => {
          const projectId = requireString(input.projectId, "projectId");
          const context = await dependencies.buildContext({
            projectId,
            ...optionalString("scope", input.scope),
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
          const context: ContinuityReviewWorkflowContext = {
            text: requireString(input.contextText, "contextText"),
            ...optionalString("contextPackageId", input.contextPackageId),
          };
          const output = await dependencies.reviewContinuity({
            context,
            projectId: requireString(input.projectId, "projectId"),
            ...optionalString("scope", input.scope),
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
        name: "persist_review_artifact",
        execute: async ({ input, runId }) => {
          const projectId = requireString(input.projectId, "projectId");
          const summary = requireString(input.summary, "summary");
          const issues = Array.isArray(input.issues)
            ? (input.issues as readonly ContinuityReviewIssue[])
            : [];
          const persisted = await dependencies.persistReview({
            issues,
            projectId,
            summary,
            workflowRunId: runId,
            ...optionalString("contextPackageId", input.contextPackageId),
            ...optionalString("targetId", input.targetId),
            ...optionalString("targetType", input.targetType),
          });

          return {
            output: {
              artifactId: persisted.artifactId,
              issueCount: issues.length,
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
