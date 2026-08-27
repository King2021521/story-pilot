import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { WorkflowRepository, type WorkflowRunRecord } from "@story-pilot/db";
import { WorkflowEngine, WorkflowRegistry, type WorkflowRunState } from "@story-pilot/workflow-runtime";

import { ProjectStorageService } from "../storage/project-storage.service.js";

export interface RunWorkflowInput {
  readonly projectId: string;
  readonly workflowType: string;
  readonly targetType?: string;
  readonly targetId?: string;
  readonly input: Record<string, unknown>;
  readonly workOrderId?: string;
}

export interface CancelWorkflowInput {
  readonly projectId: string;
  readonly workflowRunId: string;
}

export interface ListWorkOrdersInput {
  readonly projectId: string;
  readonly status?: string;
}

export interface GetWorkOrderInput {
  readonly projectId: string;
  readonly workOrderId: string;
}

export interface RetryWorkflowInput {
  readonly projectId: string;
  readonly workflowRunId: string;
}

@Injectable()
export class WorkflowService {
  async run(input: RunWorkflowInput): Promise<WorkflowRunState> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const repository = new WorkflowRepository(projectDatabase);
      const workOrderId =
        input.workOrderId ??
        repository.createWorkOrder({
          projectId: input.projectId,
          title: input.workflowType,
          type: input.workflowType,
          workOrderId: randomUUID(),
        }).id;
      const engine = new WorkflowEngine(createDefaultWorkflowRegistry());
      const run = await engine.run({
        input: {
          ...input.input,
          ...(input.targetId === undefined ? {} : { targetId: input.targetId }),
          ...(input.targetType === undefined ? {} : { targetType: input.targetType }),
        },
        runId: randomUUID(),
        workflowName: input.workflowType,
      });

      repository.persistWorkflowRun({
        input: run.input,
        projectId: input.projectId,
        runId: run.id,
        status: run.status,
        steps: run.steps.map((step) => ({
          name: step.name,
          projectId: input.projectId,
          status: step.status,
          stepId: randomUUID(),
          workflowRunId: run.id,
          ...(step.error === undefined ? {} : { error: step.error }),
          ...(step.output === undefined ? {} : { output: step.output }),
        })),
        workflowName: run.workflowName,
        workOrderId,
        ...(run.output === undefined ? {} : { output: run.output }),
      });
      repository.updateWorkOrderStatus(input.projectId, workOrderId, run.status);

      return run;
    } finally {
      projectDatabase.close();
    }
  }

  async cancel(input: CancelWorkflowInput): Promise<WorkflowRunRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      return new WorkflowRepository(projectDatabase).cancelWorkflowRun(
        input.projectId,
        input.workflowRunId,
      );
    } finally {
      projectDatabase.close();
    }
  }

  async listWorkOrders(input: ListWorkOrdersInput) {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      return new WorkflowRepository(projectDatabase).listWorkOrders({
        projectId: input.projectId,
        ...(input.status === undefined ? {} : { status: input.status }),
      });
    } finally {
      projectDatabase.close();
    }
  }

  async getWorkOrder(input: GetWorkOrderInput) {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const workOrder = new WorkflowRepository(projectDatabase).getWorkOrder(input.projectId, input.workOrderId);
      if (!workOrder) {
        throw new Error(`WORK_ORDER_NOT_FOUND: ${input.workOrderId}`);
      }

      return workOrder;
    } finally {
      projectDatabase.close();
    }
  }

  async getWorkflowRun(input: RetryWorkflowInput): Promise<WorkflowRunRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const run = new WorkflowRepository(projectDatabase).getWorkflowRun(input.projectId, input.workflowRunId);
      if (!run) {
        throw new Error(`WORKFLOW_RUN_NOT_FOUND: ${input.workflowRunId}`);
      }

      return run;
    } finally {
      projectDatabase.close();
    }
  }

  async retry(input: RetryWorkflowInput): Promise<WorkflowRunState> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    let previousRun: WorkflowRunRecord;
    try {
      const repository = new WorkflowRepository(projectDatabase);
      const persistedRun = repository.getWorkflowRun(input.projectId, input.workflowRunId);
      if (!persistedRun) {
        throw new Error(`WORKFLOW_RUN_NOT_FOUND: ${input.workflowRunId}`);
      }
      previousRun = persistedRun;
    } finally {
      projectDatabase.close();
    }

    return this.run({
      input: {
        ...previousRun.input,
        retriedFromRunId: input.workflowRunId,
      },
      projectId: input.projectId,
      workflowType: previousRun.workflowName,
      ...(previousRun.workOrderId === null ? {} : { workOrderId: previousRun.workOrderId }),
    });
  }

  constructor(private readonly projectStorage: ProjectStorageService) {}
}

function createDefaultWorkflowRegistry(): WorkflowRegistry {
  return new WorkflowRegistry()
    .register({
      name: "review",
      steps: [
        {
          name: "prepare_review",
          execute: async () => ({ status: "completed", output: { ready: true } }),
        },
      ],
    })
    .register({
      name: "memory_extract",
      steps: [
        {
          name: "wait_for_memory_confirmation",
          execute: async () => ({ status: "waiting_user", output: { reason: "needs_memory_review" } }),
        },
      ],
    })
    .register({
      name: "foreshadowing_plan",
      steps: [
        {
          name: "prepare_foreshadowing_plan",
          execute: async () => ({ status: "completed", output: { ready: true } }),
        },
      ],
    });
}
