import type { WorkflowDefinition } from "../engine/workflow-registry.js";

export interface ChapterDraftOutput {
  readonly draft: {
    readonly body: string;
    readonly summary: string;
    readonly title: string;
  };
  readonly memoryCandidates: readonly ChapterDraftMemoryCandidate[];
  readonly reviewNotes: readonly string[];
}

export interface ChapterDraftMemoryCandidate {
  readonly confidence: number;
  readonly content: string;
  readonly entityId?: string | undefined;
  readonly entityType: string;
  readonly kind: string;
  readonly proposedRelations?: readonly Record<string, unknown>[] | undefined;
  readonly status?: "pending" | undefined;
}

export interface ChapterDraftWorkflowContext {
  readonly contextPackageId?: string;
  readonly text: string;
}

export interface PersistChapterDraftInput extends ChapterDraftOutput {
  readonly projectId: string;
  readonly chapterId: string;
  readonly contextPackageId?: string;
  readonly workflowRunId: string;
}

export interface PersistChapterDraftResult {
  readonly artifactId: string;
  readonly memoryCandidateIds: readonly string[];
}

export interface ChapterDraftWorkflowDependencies {
  buildContext(input: {
    readonly projectId: string;
    readonly chapterId: string;
    readonly instruction: string;
  }): Promise<ChapterDraftWorkflowContext>;
  generateDraft(input: {
    readonly projectId: string;
    readonly chapterId: string;
    readonly instruction: string;
    readonly context: ChapterDraftWorkflowContext;
  }): Promise<ChapterDraftOutput>;
  persistDraft(input: PersistChapterDraftInput): Promise<PersistChapterDraftResult>;
}

export function createChapterDraftWorkflow(
  dependencies: ChapterDraftWorkflowDependencies,
): WorkflowDefinition {
  return {
    name: "chapter_draft",
    steps: [
      {
        name: "build_context",
        execute: async ({ input }) => {
          const projectId = requireString(input.projectId, "projectId");
          const chapterId = requireString(input.chapterId, "chapterId");
          const instruction = getString(input.instruction) ?? "生成当前章节草稿";
          const context = await dependencies.buildContext({ chapterId, instruction, projectId });

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
          const projectId = requireString(input.projectId, "projectId");
          const chapterId = requireString(input.chapterId, "chapterId");
          const instruction = getString(input.instruction) ?? "生成当前章节草稿";
          const context: ChapterDraftWorkflowContext = {
            text: requireString(input.contextText, "contextText"),
            ...(getString(input.contextPackageId) === undefined
              ? {}
              : { contextPackageId: getString(input.contextPackageId) as string }),
          };
          const output = await dependencies.generateDraft({
            chapterId,
            context,
            instruction,
            projectId,
          });

          return {
            output: output as unknown as Record<string, unknown>,
            status: "completed",
          };
        },
      },
      {
        name: "persist_artifact_and_memory_candidates",
        execute: async ({ input, runId }) => {
          const projectId = requireString(input.projectId, "projectId");
          const chapterId = requireString(input.chapterId, "chapterId");
          const draft = requireRecord(input.draft, "draft") as ChapterDraftOutput["draft"];
          const memoryCandidates = Array.isArray(input.memoryCandidates)
            ? (input.memoryCandidates as ChapterDraftOutput["memoryCandidates"])
            : [];
          const reviewNotes = Array.isArray(input.reviewNotes)
            ? (input.reviewNotes as ChapterDraftOutput["reviewNotes"])
            : [];
          const persisted = await dependencies.persistDraft({
            chapterId,
            draft,
            memoryCandidates,
            projectId,
            reviewNotes,
            workflowRunId: runId,
            ...(getString(input.contextPackageId) === undefined
              ? {}
              : { contextPackageId: getString(input.contextPackageId) as string }),
          });

          return {
            output: {
              artifactId: persisted.artifactId,
              memoryCandidateIds: [...persisted.memoryCandidateIds],
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

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function requireRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`INVALID_WORKFLOW_INPUT: ${field}`);
  }

  return value as Record<string, unknown>;
}
