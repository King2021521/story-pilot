import type { WorkflowDefinition } from "../engine/workflow-registry.js";

export interface MemoryExtractCandidate {
  readonly confidence: number;
  readonly content: string;
  readonly entityId?: string | undefined;
  readonly entityType: string;
  readonly kind: string;
  readonly proposedRelations?: readonly Record<string, unknown>[] | undefined;
  readonly sourceQuote?: string | undefined;
  readonly sourceSummary?: string | undefined;
  readonly status?: "pending" | undefined;
}

export interface MemoryExtractOutput {
  readonly conflictNotes: readonly string[];
  readonly memoryCandidates: readonly MemoryExtractCandidate[];
}

export interface MemoryExtractSource {
  readonly sourceId: string;
  readonly sourceText: string;
  readonly sourceType: string;
}

export interface PersistMemoryExtractInput extends MemoryExtractOutput, MemoryExtractSource {
  readonly projectId: string;
  readonly workflowRunId: string;
}

export interface PersistMemoryExtractResult {
  readonly memoryCandidateIds: readonly string[];
}

export interface MemoryExtractWorkflowDependencies {
  prepareSource(input: {
    readonly projectId: string;
    readonly sourceId?: string;
    readonly sourceText?: string;
    readonly sourceType?: string;
    readonly targetId?: string;
    readonly targetType?: string;
  }): Promise<MemoryExtractSource>;
  extractMemories(input: {
    readonly projectId: string;
    readonly source: MemoryExtractSource;
  }): Promise<MemoryExtractOutput>;
  persistCandidates(input: PersistMemoryExtractInput): Promise<PersistMemoryExtractResult>;
}

export function createMemoryExtractWorkflow(
  dependencies: MemoryExtractWorkflowDependencies,
): WorkflowDefinition {
  return {
    name: "memory_extract",
    steps: [
      {
        name: "prepare_source",
        execute: async ({ input }) => {
          const projectId = requireString(input.projectId, "projectId");
          const source = await dependencies.prepareSource({
            projectId,
            ...optionalString("sourceId", input.sourceId),
            ...optionalString("sourceText", input.sourceText),
            ...optionalString("sourceType", input.sourceType),
            ...optionalString("targetId", input.targetId),
            ...optionalString("targetType", input.targetType),
          });

          return {
            output: source as unknown as Record<string, unknown>,
            status: "completed",
          };
        },
      },
      {
        name: "call_model",
        execute: async ({ input }) => {
          const projectId = requireString(input.projectId, "projectId");
          const source = {
            sourceId: requireString(input.sourceId, "sourceId"),
            sourceText: requireString(input.sourceText, "sourceText"),
            sourceType: requireString(input.sourceType, "sourceType"),
          };
          const output = await dependencies.extractMemories({
            projectId,
            source,
          });

          return {
            output: output as unknown as Record<string, unknown>,
            status: "completed",
          };
        },
      },
      {
        name: "persist_memory_candidates",
        execute: async ({ input, runId }) => {
          const projectId = requireString(input.projectId, "projectId");
          const source = {
            sourceId: requireString(input.sourceId, "sourceId"),
            sourceText: requireString(input.sourceText, "sourceText"),
            sourceType: requireString(input.sourceType, "sourceType"),
          };
          const memoryCandidates = Array.isArray(input.memoryCandidates)
            ? (input.memoryCandidates as readonly MemoryExtractCandidate[])
            : [];
          const conflictNotes = Array.isArray(input.conflictNotes)
            ? (input.conflictNotes as readonly string[])
            : [];
          const persisted = await dependencies.persistCandidates({
            conflictNotes,
            memoryCandidates,
            projectId,
            sourceId: source.sourceId,
            sourceText: source.sourceText,
            sourceType: source.sourceType,
            workflowRunId: runId,
          });

          return {
            output: {
              conflictNotes,
              memoryCandidateIds: [...persisted.memoryCandidateIds],
            },
            status: "completed",
          };
        },
      },
      {
        name: "wait_for_user_confirmation",
        execute: async ({ input }) => ({
          output: {
            conflictNotes: Array.isArray(input.conflictNotes) ? input.conflictNotes : [],
            memoryCandidateIds: Array.isArray(input.memoryCandidateIds) ? input.memoryCandidateIds : [],
          },
          status: "waiting_user",
        }),
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

function optionalString(key: string, value: unknown): Record<string, string> {
  const stringValue = getString(value);
  return stringValue === undefined ? {} : { [key]: stringValue };
}
