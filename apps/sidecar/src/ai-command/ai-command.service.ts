import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import type { CommandPayload } from "@story-pilot/contracts";
import {
  ArtifactRepository,
  WorkflowRepository,
  type ArtifactRecord,
  type WorkflowRunRecord,
} from "@story-pilot/db";
import { CapabilityRegistry, type AiCapabilityName } from "@story-pilot/ai";
import type { WorkflowRunState } from "@story-pilot/workflow-runtime";

import { ChapterService } from "../chapter/chapter.service.js";
import { CreativePathService } from "../creative-path/creative-path.service.js";
import { OutlineService } from "../outline/outline.service.js";
import { ProjectStorageService } from "../storage/project-storage.service.js";
import { WorkflowService } from "../workflow/workflow.service.js";

type AiGenerateInput = CommandPayload<"ai.generate">;
type AiGetRunInput = CommandPayload<"ai.getRun">;
type AiCancelRunInput = CommandPayload<"ai.cancelRun">;
type AiListArtifactsInput = CommandPayload<"ai.listArtifacts">;

export interface AiGenerateResult {
  readonly artifactIds: readonly string[];
  readonly capability: AiCapabilityName;
  readonly status: string;
  readonly workflowRunId: string;
  readonly workOrderId: string;
}

interface StartedAiRun {
  readonly input: Record<string, unknown>;
  readonly workflowRunId: string;
  readonly workOrderId: string;
}

@Injectable()
export class AiCommandService {
  constructor(
    private readonly chapterService: ChapterService,
    private readonly creativePathService: CreativePathService,
    private readonly outlineService: OutlineService,
    private readonly projectStorage: ProjectStorageService,
    private readonly workflowService: WorkflowService,
  ) {}

  async generate(input: AiGenerateInput): Promise<AiGenerateResult> {
    const capability = input.capability as AiCapabilityName;
    if (capability === "blueprint.generate") {
      return this.generateBlueprint(input, capability);
    }
    if (capability === "outline.generate") {
      return this.generateOutline(input, capability);
    }
    if (capability === "chapter.draft") {
      return this.generateChapterDraft(input, capability);
    }
    if (capability === "continuity.review") {
      return this.runWorkflowBackedCapability(input, capability, "review", buildReviewInput(input));
    }
    if (capability === "foreshadowing.plan") {
      return this.runWorkflowBackedCapability(input, capability, "foreshadowing_plan", {});
    }
    if (capability === "memory.extract") {
      return this.runWorkflowBackedCapability(
        input,
        capability,
        "memory_extract",
        buildMemoryExtractInput(input),
      );
    }

    throw new Error(`AI_CAPABILITY_NOT_IMPLEMENTED: ${capability}`);
  }

  getRun(input: AiGetRunInput): Promise<WorkflowRunRecord> {
    return this.workflowService.getWorkflowRun(input);
  }

  cancelRun(input: AiCancelRunInput): Promise<WorkflowRunRecord> {
    return this.workflowService.cancel(input);
  }

  async listArtifacts(input: AiListArtifactsInput): Promise<{ readonly items: ArtifactRecord[] }> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const items = new ArtifactRepository(projectDatabase)
        .listByProject({ projectId: input.projectId, limit: 200 })
        .filter((artifact) => matchesArtifactFilter(artifact, input));

      return { items };
    } finally {
      projectDatabase.close();
    }
  }

  private async generateBlueprint(
    input: AiGenerateInput,
    capability: AiCapabilityName,
  ): Promise<AiGenerateResult> {
    const run = await this.startTrackedGeneration(input, capability);
    try {
      const result = await this.creativePathService.generateBlueprint({
        projectId: input.projectId,
        workflowRunId: run.workflowRunId,
        workOrderId: run.workOrderId,
        ...(input.instruction === undefined ? {} : { instruction: input.instruction }),
        ...(input.options?.temperature === undefined
          ? {}
          : { temperature: input.options.temperature }),
      });
      const artifactIds = [result.artifact.id];
      await this.completeTrackedGeneration(run, input.projectId, capability, {
        artifactIds,
        blueprintId: result.blueprint.id,
      });

      return {
        artifactIds,
        capability,
        status: "completed",
        workflowRunId: run.workflowRunId,
        workOrderId: run.workOrderId,
      };
    } catch (error) {
      await this.failTrackedGeneration(run, input.projectId, capability, error);
      throw error;
    }
  }

  private async generateOutline(
    input: AiGenerateInput,
    capability: AiCapabilityName,
  ): Promise<AiGenerateResult> {
    const run = await this.startTrackedGeneration(input, capability);
    try {
      const result = await this.outlineService.generate({
        chapterCount: getChapterCount(input.input),
        projectId: input.projectId,
        scope: getOutlineScope(input.input),
        workflowRunId: run.workflowRunId,
        workOrderId: run.workOrderId,
        ...(input.instruction === undefined ? {} : { instruction: input.instruction }),
        ...(input.options?.temperature === undefined
          ? {}
          : { temperature: input.options.temperature }),
      });
      const artifactIds = [result.artifact.id];
      await this.completeTrackedGeneration(run, input.projectId, capability, {
        artifactIds,
        chapterOutlineIds: result.chapterOutlines.map((chapter) => chapter.id),
        outlineId: result.outline.id,
      });

      return {
        artifactIds,
        capability,
        status: "completed",
        workflowRunId: run.workflowRunId,
        workOrderId: run.workOrderId,
      };
    } catch (error) {
      await this.failTrackedGeneration(run, input.projectId, capability, error);
      throw error;
    }
  }

  private async generateChapterDraft(
    input: AiGenerateInput,
    capability: AiCapabilityName,
  ): Promise<AiGenerateResult> {
    if (input.targetType !== "chapter" || !input.targetId) {
      throw new Error("AI_TARGET_REQUIRED: chapter.draft requires targetType=chapter and targetId");
    }

    const workOrderId = await this.createWorkOrder(input, capability);
    try {
      const result = await this.chapterService.generateDraft({
        chapterId: input.targetId,
        projectId: input.projectId,
        workflowRunId: randomUUID(),
        workOrderId,
        ...(input.instruction === undefined ? {} : { instruction: input.instruction }),
      });

      return {
        artifactIds: [result.artifact.id],
        capability,
        status: result.workflowRun.status,
        workflowRunId: result.workflowRun.id,
        workOrderId,
      };
    } catch (error) {
      await this.failWorkOrder(input.projectId, workOrderId);
      throw error;
    }
  }

  private async runWorkflowBackedCapability(
    input: AiGenerateInput,
    capability: AiCapabilityName,
    workflowType: string,
    workflowInput: Record<string, unknown>,
  ): Promise<AiGenerateResult> {
    const workOrderId = await this.createWorkOrder(input, capability);
    const run = await this.workflowService.run({
      input: workflowInput,
      projectId: input.projectId,
      workflowType,
      workOrderId,
      ...(input.targetId === undefined ? {} : { targetId: input.targetId }),
      ...(input.targetType === undefined ? {} : { targetType: input.targetType }),
    });

    return {
      artifactIds: getArtifactIdsFromWorkflowRun(run),
      capability,
      status: run.status,
      workflowRunId: run.id,
      workOrderId,
    };
  }

  private async startTrackedGeneration(
    input: AiGenerateInput,
    capability: AiCapabilityName,
  ): Promise<StartedAiRun> {
    const workflowRunId = randomUUID();
    const workOrderId = await this.createWorkOrder(input, capability);
    const workflowInput = buildAiWorkflowInput(input);
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const repository = new WorkflowRepository(projectDatabase);
      repository.persistWorkflowRun({
        input: workflowInput,
        projectId: input.projectId,
        runId: workflowRunId,
        status: "running",
        steps: [
          createPersistedStep(input.projectId, workflowRunId, "prepare_context", "completed"),
          createPersistedStep(input.projectId, workflowRunId, "call_model", "running"),
        ],
        workflowName: capability,
        workOrderId,
      });
      repository.updateWorkOrderStatus(input.projectId, workOrderId, "running");

      return { input: workflowInput, workflowRunId, workOrderId };
    } finally {
      projectDatabase.close();
    }
  }

  private async completeTrackedGeneration(
    run: StartedAiRun,
    projectId: string,
    capability: AiCapabilityName,
    output: Record<string, unknown>,
  ): Promise<void> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(projectId);
    try {
      const repository = new WorkflowRepository(projectDatabase);
      repository.persistWorkflowRun({
        input: run.input,
        output,
        projectId,
        runId: run.workflowRunId,
        status: "completed",
        steps: [
          createPersistedStep(projectId, run.workflowRunId, "prepare_context", "completed"),
          createPersistedStep(projectId, run.workflowRunId, "call_model", "completed"),
          createPersistedStep(projectId, run.workflowRunId, "validate_output", "completed"),
          createPersistedStep(projectId, run.workflowRunId, "persist_artifact", "completed"),
          createPersistedStep(projectId, run.workflowRunId, "await_user_review", "completed"),
        ],
        workflowName: capability,
        workOrderId: run.workOrderId,
      });
      repository.updateWorkOrderStatus(projectId, run.workOrderId, "completed");
    } finally {
      projectDatabase.close();
    }
  }

  private async failTrackedGeneration(
    run: StartedAiRun,
    projectId: string,
    capability: AiCapabilityName,
    error: unknown,
  ): Promise<void> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(projectId);
    try {
      const repository = new WorkflowRepository(projectDatabase);
      repository.persistWorkflowRun({
        input: run.input,
        output: { error: serializeErrorMessage(error) },
        projectId,
        runId: run.workflowRunId,
        status: "failed",
        steps: [
          createPersistedStep(projectId, run.workflowRunId, "prepare_context", "completed"),
          createPersistedStep(projectId, run.workflowRunId, "call_model", "failed", error),
        ],
        workflowName: capability,
        workOrderId: run.workOrderId,
      });
      repository.updateWorkOrderStatus(projectId, run.workOrderId, "failed");
    } finally {
      projectDatabase.close();
    }
  }

  private async createWorkOrder(
    input: AiGenerateInput,
    capabilityName: AiCapabilityName,
  ): Promise<string> {
    const capability = CapabilityRegistry.get(capabilityName);
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const workOrder = new WorkflowRepository(projectDatabase).createWorkOrder({
        projectId: input.projectId,
        title: capability.displayName,
        type: capability.name,
        workOrderId: randomUUID(),
        ...(input.instruction === undefined ? {} : { description: input.instruction }),
      });

      return workOrder.id;
    } finally {
      projectDatabase.close();
    }
  }

  private async failWorkOrder(projectId: string, workOrderId: string): Promise<void> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(projectId);
    try {
      new WorkflowRepository(projectDatabase).updateWorkOrderStatus(
        projectId,
        workOrderId,
        "failed",
      );
    } finally {
      projectDatabase.close();
    }
  }
}

function buildAiWorkflowInput(input: AiGenerateInput): Record<string, unknown> {
  return {
    capability: input.capability,
    projectId: input.projectId,
    ...(input.input === undefined ? {} : { input: input.input }),
    ...(input.instruction === undefined ? {} : { instruction: input.instruction }),
    ...(input.options === undefined ? {} : { options: input.options }),
    ...(input.targetId === undefined ? {} : { targetId: input.targetId }),
    ...(input.targetType === undefined ? {} : { targetType: input.targetType }),
  };
}

function buildReviewInput(input: AiGenerateInput): Record<string, unknown> {
  return {
    scope: getString(input.input?.scope) ?? input.targetType ?? "project",
    ...(input.instruction === undefined ? {} : { instruction: input.instruction }),
  };
}

function buildMemoryExtractInput(input: AiGenerateInput): Record<string, unknown> {
  return {
    ...(input.instruction === undefined ? {} : { sourceText: input.instruction }),
    ...(input.targetId === undefined ? {} : { sourceId: input.targetId }),
    ...(input.targetType === undefined ? {} : { sourceType: input.targetType }),
    ...(input.input === undefined ? {} : input.input),
  };
}

function getOutlineScope(
  input: Record<string, unknown> | undefined,
): "full_book" | "volume" | "arc" | "chapter_batch" {
  const value = getString(input?.scope);
  return value === "full_book" || value === "volume" || value === "arc" || value === "chapter_batch"
    ? value
    : "chapter_batch";
}

function getChapterCount(input: Record<string, unknown> | undefined): 3 | 5 | 10 {
  const value = input?.chapterCount;
  return value === 3 || value === 5 || value === 10 ? value : 10;
}

function getArtifactIdsFromWorkflowRun(run: WorkflowRunState): string[] {
  const artifactId = getString(run.output?.artifactId);
  if (artifactId) {
    return [artifactId];
  }
  const artifactIds = run.output?.artifactIds;
  return Array.isArray(artifactIds)
    ? artifactIds.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function createPersistedStep(
  projectId: string,
  workflowRunId: string,
  name: string,
  status: string,
  error?: unknown,
) {
  return {
    name,
    projectId,
    status,
    stepId: randomUUID(),
    workflowRunId,
    ...(error === undefined ? {} : { error: serializeErrorMessage(error) }),
  };
}

function matchesArtifactFilter(artifact: ArtifactRecord, input: AiListArtifactsInput): boolean {
  if (input.kind !== undefined && artifact.kind !== input.kind) {
    return false;
  }
  if (input.targetType !== undefined && artifact.targetType !== input.targetType) {
    return false;
  }
  if (input.targetId !== undefined && artifact.targetId !== input.targetId) {
    return false;
  }

  return true;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function serializeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
