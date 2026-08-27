import type { ProjectDatabase } from "../project-database.js";

export interface CreateModelCallRecordInput {
  readonly modelCallId: string;
  readonly projectId: string;
  readonly workflowRunId?: string;
  readonly stepId?: string;
  readonly provider: string;
  readonly model: string;
  readonly purpose: string;
  readonly promptVersion?: string;
  readonly request: unknown;
  readonly response?: unknown;
  readonly usage?: unknown;
  readonly status: "completed" | "failed";
  readonly error?: string;
  readonly latencyMs?: number;
  readonly now?: number;
}

export class ModelCallRepository {
  constructor(private readonly projectDatabase: ProjectDatabase) {}

  create(input: CreateModelCallRecordInput): void {
    const now = input.now ?? Date.now();
    this.projectDatabase.client
      .prepare(`
        insert into model_calls (
          id, project_id, workflow_run_id, step_id, provider, model, purpose,
          prompt_version, request, response, usage, status, error, latency_ms, created_at
        )
        values (
          @modelCallId, @projectId, @workflowRunId, @stepId, @provider, @model, @purpose,
          @promptVersion, @request, @response, @usage, @status, @error, @latencyMs, @now
        )
      `)
      .run({
        error: input.error ?? null,
        latencyMs: input.latencyMs ?? null,
        model: input.model,
        modelCallId: input.modelCallId,
        now,
        projectId: input.projectId,
        promptVersion: input.promptVersion ?? null,
        provider: input.provider,
        purpose: input.purpose,
        request: JSON.stringify(input.request),
        response: input.response === undefined ? null : JSON.stringify(input.response),
        status: input.status,
        stepId: input.stepId ?? null,
        usage: input.usage === undefined ? null : JSON.stringify(input.usage),
        workflowRunId: input.workflowRunId ?? null,
      });
  }
}
