import { randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import {
  ArtifactRepository,
  ChapterRepository,
  MemoryRepository,
  ModelCallRepository,
  WorkflowRepository,
  type WorkflowRunRecord,
} from "@story-pilot/db";
import {
  buildPromptMessages,
  CapabilityRegistry,
  MemoryExtractOutputSchema,
  type ModelGateway,
} from "@story-pilot/ai";
import {
  WorkflowEngine,
  WorkflowRegistry,
  createMemoryExtractWorkflow,
  type MemoryExtractSource,
  type WorkflowRunState,
} from "@story-pilot/workflow-runtime";

import { MODEL_GATEWAY } from "../ai/model-gateway.provider.js";
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
  constructor(
    private readonly projectStorage: ProjectStorageService,
    @Inject(MODEL_GATEWAY) private readonly modelGateway: ModelGateway,
  ) {}

  async run(input: RunWorkflowInput): Promise<WorkflowRunState> {
    if (input.workflowType === "memory_extract") {
      return this.runMemoryExtract(input);
    }

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

  private async runMemoryExtract(input: RunWorkflowInput): Promise<WorkflowRunState> {
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
      const runId = randomUUID();
      let modelCallId: string | undefined;
      const artifactRepository = new ArtifactRepository(projectDatabase);
      const chapterRepository = new ChapterRepository(projectDatabase);
      const memoryRepository = new MemoryRepository(projectDatabase);
      const modelCallRepository = new ModelCallRepository(projectDatabase);
      const capability = CapabilityRegistry.get("memory.extract");
      const registry = new WorkflowRegistry().register(
        createMemoryExtractWorkflow({
          extractMemories: async ({ projectId, source }) => {
            const messages = buildPromptMessages({
              capability: capability.promptCapability ?? "memory_extract",
              context: `来源类型：${source.sourceType}\n来源 ID：${source.sourceId}\n\n${source.sourceText}`,
              instruction: "从来源文本中提取候选记忆，所有结果必须等待用户确认。",
              version: "v1",
            });
            const result = await this.modelGateway.generateObject({
              messages,
              promptVersion: "memory-extract.v1",
              purpose: capability.purpose,
              schema: MemoryExtractOutputSchema,
              schemaName: "MemoryExtractOutput",
            });
            modelCallId = randomUUID();
            modelCallRepository.create({
              latencyMs: result.modelCall.latencyMs,
              model: result.modelCall.model,
              modelCallId,
              projectId,
              provider: result.modelCall.provider,
              purpose: result.modelCall.purpose,
              request: {
                messages,
                schemaName: "MemoryExtractOutput",
                sourceId: source.sourceId,
                sourceType: source.sourceType,
              },
              response: result.raw,
              status: result.modelCall.status,
              workflowRunId: runId,
              ...(result.modelCall.promptVersion === undefined
                ? {}
                : { promptVersion: result.modelCall.promptVersion }),
              ...(result.modelCall.usage === undefined ? {} : { usage: result.modelCall.usage }),
            });

            return result.object;
          },
          persistCandidates: async ({ memoryCandidates, projectId, sourceId, sourceType }) => ({
            memoryCandidateIds: memoryCandidates.map((candidate) =>
              memoryRepository.createCandidate({
                candidateId: randomUUID(),
                confidence: candidate.confidence,
                content: candidate.content,
                entityType: candidate.entityType,
                kind: candidate.kind,
                projectId,
                sourceId,
                sourceType,
                ...(candidate.entityId === undefined ? {} : { entityId: candidate.entityId }),
                ...(modelCallId === undefined ? {} : { modelCallId }),
                ...(candidate.proposedRelations === undefined
                  ? {}
                  : { proposedRelations: candidate.proposedRelations }),
              }).id,
            ),
          }),
          prepareSource: async (sourceInput) =>
            resolveMemoryExtractSource({
              artifactRepository,
              chapterRepository,
              input: sourceInput,
            }),
        }),
      );
      const workflowInput = {
        ...input.input,
        ...(getString(input.input.sourceText) === undefined && getString(input.input.text) !== undefined
          ? { sourceText: getString(input.input.text) }
          : {}),
        ...(input.targetId === undefined ? {} : { targetId: input.targetId }),
        ...(input.targetType === undefined ? {} : { targetType: input.targetType }),
        projectId: input.projectId,
      };
      repository.persistWorkflowRun({
        input: workflowInput,
        projectId: input.projectId,
        runId,
        status: "running",
        steps: [],
        workflowName: input.workflowType,
        workOrderId,
      });
      const run = await new WorkflowEngine(registry).run({
        input: workflowInput,
        runId,
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

function resolveMemoryExtractSource(input: {
  readonly artifactRepository: ArtifactRepository;
  readonly chapterRepository: ChapterRepository;
  readonly input: {
    readonly projectId: string;
    readonly sourceId?: string;
    readonly sourceText?: string;
    readonly sourceType?: string;
    readonly targetId?: string;
    readonly targetType?: string;
  };
}): MemoryExtractSource {
  const sourceType = input.input.sourceType ?? input.input.targetType ?? "text";
  const sourceId = input.input.sourceId ?? input.input.targetId ?? "inline";
  const sourceText = input.input.sourceText?.trim();
  if (sourceText) {
    return {
      sourceId,
      sourceText,
      sourceType,
    };
  }

  if (sourceType === "artifact") {
    const artifact = input.artifactRepository.getById(input.input.projectId, sourceId);
    if (!artifact) {
      throw new Error(`ARTIFACT_NOT_FOUND: ${sourceId}`);
    }

    return {
      sourceId,
      sourceText: artifact.body,
      sourceType,
    };
  }

  if (sourceType === "chapter") {
    const chapter = input.chapterRepository.getById(input.input.projectId, sourceId);
    if (!chapter) {
      throw new Error(`CHAPTER_NOT_FOUND: ${sourceId}`);
    }

    return {
      sourceId,
      sourceText: chapter.content,
      sourceType,
    };
  }

  throw new Error(`MEMORY_EXTRACT_SOURCE_TEXT_REQUIRED: ${sourceType}:${sourceId}`);
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
