import { TERMINAL_WORK_ORDER_STATUSES } from "../work-orders/work-order-state.js";
import type {
  WorkflowDefinition,
  WorkflowRegistry,
  WorkflowRunStatus,
  WorkflowStepDefinition,
  WorkflowStepStatus,
} from "./workflow-registry.js";

export interface WorkflowRunStep {
  readonly name: string;
  readonly status: WorkflowStepStatus;
  readonly output?: Record<string, unknown>;
  readonly error?: string;
}

export interface WorkflowRunState {
  readonly id: string;
  readonly workflowName: string;
  readonly status: WorkflowRunStatus;
  readonly input: Record<string, unknown>;
  readonly output?: Record<string, unknown>;
  readonly steps: readonly WorkflowRunStep[];
}

export interface WorkflowEngineOptions {
  readonly onRunUpdated?: (run: WorkflowRunState) => void;
}

export interface RunWorkflowInput {
  readonly runId: string;
  readonly workflowName: string;
  readonly input: Record<string, unknown>;
}

export interface ResumeWorkflowInput {
  readonly run: WorkflowRunState;
  readonly input: Record<string, unknown>;
}

export class WorkflowEngine {
  constructor(
    private readonly registry: WorkflowRegistry,
    private readonly options: WorkflowEngineOptions = {},
  ) {}

  async run(input: RunWorkflowInput): Promise<WorkflowRunState> {
    const definition = this.registry.get(input.workflowName);
    const initialRun: WorkflowRunState = {
      id: input.runId,
      input: input.input,
      status: "queued",
      steps: definition.steps.map((step) => ({ name: step.name, status: "queued" })),
      workflowName: input.workflowName,
    };

    this.emit(initialRun);
    return this.executeFrom(initialRun, definition, 0, input.input);
  }

  async resume(input: ResumeWorkflowInput): Promise<WorkflowRunState> {
    if (input.run.status !== "waiting_user") {
      throw new Error(`WORKFLOW_NOT_WAITING_USER: ${input.run.id}`);
    }

    const definition = this.registry.get(input.run.workflowName);
    const waitingStepIndex = input.run.steps.findIndex((step) => step.status === "waiting_user");
    if (waitingStepIndex < 0) {
      throw new Error(`WORKFLOW_WAITING_STEP_NOT_FOUND: ${input.run.id}`);
    }

    return this.executeFrom(
      {
        ...input.run,
        input: {
          ...input.run.input,
          ...input.input,
        },
      },
      definition,
      waitingStepIndex,
      {
        ...input.run.input,
        ...input.input,
      },
    );
  }

  cancel(run: WorkflowRunState): WorkflowRunState {
    if (TERMINAL_WORK_ORDER_STATUSES.has(run.status)) {
      return run;
    }

    const canceled = {
      ...run,
      status: "canceled" as const,
    };
    this.emit(canceled);
    return canceled;
  }

  private async executeFrom(
    run: WorkflowRunState,
    definition: WorkflowDefinition,
    startIndex: number,
    input: Record<string, unknown>,
  ): Promise<WorkflowRunState> {
    let currentRun = this.updateRun(run, { status: "running" });
    let stepInput = input;

    for (let index = startIndex; index < definition.steps.length; index += 1) {
      const stepDefinition = definition.steps[index];
      if (!stepDefinition) {
        continue;
      }

      const stepResult = await this.executeStep(stepDefinition, {
        input: stepInput,
        runId: currentRun.id,
        workflowName: currentRun.workflowName,
      });
      currentRun = this.replaceStep(currentRun, index, {
        name: stepDefinition.name,
        status: stepResult.status,
        ...(stepResult.error === undefined ? {} : { error: stepResult.error }),
        ...(stepResult.output === undefined ? {} : { output: stepResult.output }),
      });

      if (stepResult.status === "waiting_user") {
        return this.updateRun(currentRun, { status: "waiting_user" });
      }
      if (stepResult.status === "failed") {
        return this.updateRun(currentRun, { status: "failed" });
      }
      if (stepResult.output !== undefined) {
        stepInput = {
          ...stepInput,
          ...stepResult.output,
        };
      }
    }

    const output = currentRun.steps.at(-1)?.output;
    return this.updateRun(currentRun, {
      status: "completed",
      ...(output === undefined ? {} : { output }),
    });
  }

  private async executeStep(
    stepDefinition: WorkflowStepDefinition,
    context: { readonly input: Record<string, unknown>; readonly runId: string; readonly workflowName: string },
  ) {
    try {
      return await stepDefinition.execute(context);
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
        status: "failed" as const,
      };
    }
  }

  private replaceStep(
    run: WorkflowRunState,
    index: number,
    step: WorkflowRunStep,
  ): WorkflowRunState {
    const steps = run.steps.map((existingStep, existingIndex) =>
      existingIndex === index ? stripUndefinedStepFields(step) : existingStep,
    );

    return {
      ...run,
      steps,
    };
  }

  private updateRun(
    run: WorkflowRunState,
    patch: Partial<Pick<WorkflowRunState, "output" | "status">>,
  ): WorkflowRunState {
    const updated = {
      ...run,
      ...patch,
    };
    this.emit(updated);
    return updated;
  }

  private emit(run: WorkflowRunState): void {
    this.options.onRunUpdated?.(run);
  }
}

function stripUndefinedStepFields(step: WorkflowRunStep): WorkflowRunStep {
  return {
    name: step.name,
    status: step.status,
    ...(step.error === undefined ? {} : { error: step.error }),
    ...(step.output === undefined ? {} : { output: step.output }),
  };
}
