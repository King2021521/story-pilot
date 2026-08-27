export type WorkflowRunStatus =
  | "queued"
  | "running"
  | "waiting_user"
  | "completed"
  | "failed"
  | "canceled";

export type WorkflowStepStatus = WorkflowRunStatus;

export interface WorkflowStepExecutionContext {
  readonly input: Record<string, unknown>;
  readonly runId: string;
  readonly workflowName: string;
}

export interface WorkflowStepResult {
  readonly status: "completed" | "waiting_user" | "failed";
  readonly output?: Record<string, unknown>;
  readonly error?: string;
}

export interface WorkflowStepDefinition {
  readonly name: string;
  execute(context: WorkflowStepExecutionContext): Promise<WorkflowStepResult>;
}

export interface WorkflowDefinition {
  readonly name: string;
  readonly steps: readonly WorkflowStepDefinition[];
}

export class WorkflowRegistry {
  private readonly workflows = new Map<string, WorkflowDefinition>();

  register(definition: WorkflowDefinition): this {
    this.workflows.set(definition.name, definition);
    return this;
  }

  get(workflowName: string): WorkflowDefinition {
    const definition = this.workflows.get(workflowName);
    if (!definition) {
      throw new Error(`WORKFLOW_NOT_FOUND: ${workflowName}`);
    }

    return definition;
  }
}
