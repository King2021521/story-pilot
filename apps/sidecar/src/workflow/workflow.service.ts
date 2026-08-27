import { createHash, randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import {
  ArtifactRepository,
  CharacterRepository,
  ChapterRepository,
  ContextRepository,
  DomainEventRepository,
  MemoryRepository,
  ModelCallRepository,
  PlotRepository,
  ProjectRepository,
  WorkflowRepository,
  WorldRepository,
  type ArtifactRecord,
  type ProjectDatabase,
  type WorkflowRunRecord,
} from "@story-pilot/db";
import {
  buildPromptMessages,
  CapabilityRegistry,
  ContinuityReviewOutputSchema,
  ForeshadowingPlanOutputSchema,
  MemoryExtractOutputSchema,
  type ModelGateway,
} from "@story-pilot/ai";
import {
  WorkflowEngine,
  WorkflowRegistry,
  createContinuityReviewWorkflow,
  createForeshadowingPlanWorkflow,
  createMemoryExtractWorkflow,
  type ContinuityReviewWorkflowContext,
  type ForeshadowingPlanWorkflowContext,
  type MemoryExtractSource,
  type WorkflowRunState,
} from "@story-pilot/workflow-runtime";

import { MODEL_GATEWAY } from "../ai/model-gateway.provider.js";
import { GraphService } from "../graph/graph.service.js";
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
    private readonly graphService: GraphService,
    @Inject(MODEL_GATEWAY) private readonly modelGateway: ModelGateway,
  ) {}

  async run(input: RunWorkflowInput): Promise<WorkflowRunState> {
    if (input.workflowType === "memory_extract") {
      return this.runMemoryExtract(input);
    }
    if (input.workflowType === "review") {
      return this.runContinuityReview(input);
    }
    if (input.workflowType === "foreshadowing_plan") {
      return this.runForeshadowingPlan(input);
    }

    throw new Error(`WORKFLOW_NOT_FOUND: ${input.workflowType}`);
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
      const workOrder = new WorkflowRepository(projectDatabase).getWorkOrder(
        input.projectId,
        input.workOrderId,
      );
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
      const run = new WorkflowRepository(projectDatabase).getWorkflowRun(
        input.projectId,
        input.workflowRunId,
      );
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

  private async runContinuityReview(input: RunWorkflowInput): Promise<WorkflowRunState> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const repository = new WorkflowRepository(projectDatabase);
      const workOrderId =
        input.workOrderId ??
        repository.createWorkOrder({
          projectId: input.projectId,
          title: "连续性审阅",
          type: input.workflowType,
          workOrderId: randomUUID(),
        }).id;
      const runId = randomUUID();
      const capability = CapabilityRegistry.get("continuity.review");
      const artifactRepository = new ArtifactRepository(projectDatabase);
      const contextRepository = new ContextRepository(projectDatabase);
      const domainEventRepository = new DomainEventRepository(projectDatabase);
      const modelCallRepository = new ModelCallRepository(projectDatabase);
      let modelCallId: string | undefined;
      const workflowInput = buildWorkflowInput(input);

      repository.persistWorkflowRun({
        input: workflowInput,
        projectId: input.projectId,
        runId,
        status: "running",
        steps: [],
        workflowName: input.workflowType,
        workOrderId,
      });

      const registry = new WorkflowRegistry().register(
        createContinuityReviewWorkflow({
          buildContext: async ({ projectId, scope, targetId, targetType }) =>
            this.buildWorkflowContext({
              contextRepository,
              projectDatabase,
              projectId,
              purpose: capability.purpose,
              scope,
              targetId,
              targetType,
            }),
          persistReview: async (reviewInput) => {
            const artifact = artifactRepository.createArtifact({
              artifactId: randomUUID(),
              body: formatContinuityReviewArtifact(reviewInput),
              kind: "review_report",
              metadata: JSON.stringify({
                contextPackageId: reviewInput.contextPackageId,
                issues: reviewInput.issues,
                modelCallId,
                summary: reviewInput.summary,
              }),
              projectId: reviewInput.projectId,
              title: "连续性审阅报告",
              workflowRunId: reviewInput.workflowRunId,
              workOrderId,
              ...(reviewInput.targetId === undefined ? {} : { targetId: reviewInput.targetId }),
              ...(reviewInput.targetType === undefined
                ? {}
                : { targetType: reviewInput.targetType }),
            });
            appendArtifactCreatedEvent(domainEventRepository, artifact, reviewInput.projectId);

            return { artifactId: artifact.id };
          },
          reviewContinuity: async ({ context, projectId, scope, targetId, targetType }) => {
            const messages = buildPromptMessages({
              capability: capability.promptCapability ?? "continuity_review",
              context: context.text,
              instruction: buildContinuityReviewInstruction({ scope, targetId, targetType }),
              version: "v1",
            });
            const result = await this.modelGateway.generateObject({
              messages,
              promptVersion: "continuity-review.v1",
              purpose: capability.purpose,
              schema: ContinuityReviewOutputSchema,
              schemaName: "ContinuityReviewOutput",
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
                schemaName: "ContinuityReviewOutput",
                scope,
                targetId,
                targetType,
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
        }),
      );
      const run = await new WorkflowEngine(registry).run({
        input: workflowInput,
        runId,
        workflowName: input.workflowType,
      });
      persistFinishedWorkflowRun(repository, input.projectId, workOrderId, run);

      return run;
    } finally {
      projectDatabase.close();
    }
  }

  private async runForeshadowingPlan(input: RunWorkflowInput): Promise<WorkflowRunState> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const repository = new WorkflowRepository(projectDatabase);
      const workOrderId =
        input.workOrderId ??
        repository.createWorkOrder({
          projectId: input.projectId,
          title: "伏笔规划",
          type: input.workflowType,
          workOrderId: randomUUID(),
        }).id;
      const runId = randomUUID();
      const capability = CapabilityRegistry.get("foreshadowing.plan");
      const artifactRepository = new ArtifactRepository(projectDatabase);
      const contextRepository = new ContextRepository(projectDatabase);
      const domainEventRepository = new DomainEventRepository(projectDatabase);
      const modelCallRepository = new ModelCallRepository(projectDatabase);
      let modelCallId: string | undefined;
      const workflowInput = buildWorkflowInput(input);

      repository.persistWorkflowRun({
        input: workflowInput,
        projectId: input.projectId,
        runId,
        status: "running",
        steps: [],
        workflowName: input.workflowType,
        workOrderId,
      });

      const registry = new WorkflowRegistry().register(
        createForeshadowingPlanWorkflow({
          buildContext: async ({ projectId, targetId, targetType }) =>
            this.buildWorkflowContext({
              contextRepository,
              projectDatabase,
              projectId,
              purpose: capability.purpose,
              targetId,
              targetType,
            }),
          persistPlan: async (planInput) => {
            const artifact = artifactRepository.createArtifact({
              artifactId: randomUUID(),
              body: formatForeshadowingPlanArtifact(planInput),
              kind: "review_report",
              metadata: JSON.stringify({
                contextPackageId: planInput.contextPackageId,
                modelCallId,
                suggestions: planInput.suggestions,
                summary: planInput.summary,
              }),
              projectId: planInput.projectId,
              title: "伏笔规划建议",
              workflowRunId: planInput.workflowRunId,
              workOrderId,
              ...(planInput.targetId === undefined ? {} : { targetId: planInput.targetId }),
              ...(planInput.targetType === undefined ? {} : { targetType: planInput.targetType }),
            });
            appendArtifactCreatedEvent(domainEventRepository, artifact, planInput.projectId);

            return { artifactId: artifact.id };
          },
          planForeshadowing: async ({ context, projectId, targetId, targetType }) => {
            const messages = buildPromptMessages({
              capability: capability.promptCapability ?? "foreshadowing_plan",
              context: context.text,
              instruction: buildForeshadowingPlanInstruction({ targetId, targetType }),
              version: "v1",
            });
            const result = await this.modelGateway.generateObject({
              messages,
              promptVersion: "foreshadowing-plan.v1",
              purpose: capability.purpose,
              schema: ForeshadowingPlanOutputSchema,
              schemaName: "ForeshadowingPlanOutput",
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
                schemaName: "ForeshadowingPlanOutput",
                targetId,
                targetType,
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
        }),
      );
      const run = await new WorkflowEngine(registry).run({
        input: workflowInput,
        runId,
        workflowName: input.workflowType,
      });
      persistFinishedWorkflowRun(repository, input.projectId, workOrderId, run);

      return run;
    } finally {
      projectDatabase.close();
    }
  }

  private async buildWorkflowContext(input: {
    readonly contextRepository: ContextRepository;
    readonly projectDatabase: ProjectDatabase;
    readonly projectId: string;
    readonly purpose: string;
    readonly scope?: string | undefined;
    readonly targetType?: string | undefined;
    readonly targetId?: string | undefined;
  }): Promise<ContinuityReviewWorkflowContext | ForeshadowingPlanWorkflowContext> {
    const items = await buildWorkflowContextItems({
      graphService: this.graphService,
      projectDatabase: input.projectDatabase,
      projectId: input.projectId,
      scope: input.scope,
      targetId: input.targetId,
      targetType: input.targetType,
    });
    const contextRecord = input.contextRepository.createPackage({
      contextPackageId: randomUUID(),
      inputHash: hashWorkflowContextInput({
        projectId: input.projectId,
        purpose: input.purpose,
        scope: input.scope,
        targetId: input.targetId,
        targetType: input.targetType,
      }),
      items: items.map((item) => ({
        content: item.content,
        contextPackageItemId: randomUUID(),
        itemId: item.itemId,
        itemType: item.itemType,
        rank: item.rank,
        ...(item.metadata === undefined ? {} : { metadata: item.metadata }),
      })),
      projectId: input.projectId,
      purpose: input.purpose,
      ...(input.targetId === undefined ? {} : { targetId: input.targetId }),
      ...(input.targetType === undefined ? {} : { targetType: input.targetType }),
    });

    return {
      contextPackageId: contextRecord.id,
      text: items.map((item) => item.content).join("\n\n"),
    };
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
      const domainEventRepository = new DomainEventRepository(projectDatabase);
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
          persistCandidates: async ({ memoryCandidates, projectId, sourceId, sourceType }) => {
            const persist = projectDatabase.client.transaction(() =>
              memoryCandidates.map((candidate) => {
                const record = memoryRepository.createCandidate({
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
                });
                domainEventRepository.append({
                  aggregateId: record.id,
                  aggregateType: "memory_candidate",
                  eventId: randomUUID(),
                  eventType: "memory_candidate.created",
                  payload: {
                    ...(sourceType === "artifact" ? { artifactId: sourceId } : {}),
                    content: record.content,
                    entityId: record.entityId,
                    entityType: record.entityType,
                    kind: record.kind,
                    sourceId,
                    sourceType,
                  },
                  projectId,
                });

                return record.id;
              }),
            );

            return {
              memoryCandidateIds: persist(),
            };
          },
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
        ...(getString(input.input.sourceText) === undefined &&
        getString(input.input.text) !== undefined
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

interface WorkflowContextItem {
  readonly itemType: string;
  readonly itemId: string;
  readonly rank: number;
  readonly content: string;
  readonly metadata?: Record<string, unknown>;
}

interface ContinuityReviewArtifactOutput {
  readonly summary: string;
  readonly issues: readonly {
    readonly issueType: string;
    readonly severity: "info" | "warning" | "error";
    readonly evidence: string;
    readonly suggestion: string;
  }[];
}

interface ForeshadowingPlanArtifactOutput {
  readonly summary: string;
  readonly suggestions: readonly {
    readonly action: "seed" | "reinforce" | "payoff" | "delay" | "revise";
    readonly foreshadowingId?: string | undefined;
    readonly chapterId?: string | undefined;
    readonly rationale: string;
    readonly proposedText?: string | undefined;
    readonly priority: number;
  }[];
}

async function buildWorkflowContextItems(input: {
  readonly graphService: GraphService;
  readonly projectDatabase: ProjectDatabase;
  readonly projectId: string;
  readonly scope?: string | undefined;
  readonly targetType?: string | undefined;
  readonly targetId?: string | undefined;
}): Promise<WorkflowContextItem[]> {
  const projectRepository = new ProjectRepository(input.projectDatabase);
  const chapterRepository = new ChapterRepository(input.projectDatabase);
  const characterRepository = new CharacterRepository(input.projectDatabase);
  const memoryRepository = new MemoryRepository(input.projectDatabase);
  const plotRepository = new PlotRepository(input.projectDatabase);
  const worldRepository = new WorldRepository(input.projectDatabase);
  const project = projectRepository.getOverview(input.projectId);
  const chapters = chapterRepository.listChapters({ projectId: input.projectId });
  const characters = characterRepository.listCharacters(input.projectId);
  const worldRules = worldRepository.listWorldRules(input.projectId);
  const plotlines = plotRepository.listPlotlines(input.projectId);
  const storyEvents = plotRepository.listStoryEvents(input.projectId);
  const foreshadowings = plotRepository.listForeshadowings(input.projectId);
  const memories = memoryRepository.listMemories({
    limit: 120,
    projectId: input.projectId,
    statuses: ["canon", "hypothesis"],
  });
  const graphNeighborhood = input.targetId
    ? await input.graphService
        .getNeighborhood({
          depth: 2,
          entityId: input.targetId,
          projectId: input.projectId,
          ...(input.targetType === undefined ? {} : { nodeType: input.targetType }),
        })
        .catch(() => undefined)
    : undefined;

  const items: Array<WorkflowContextItem | undefined> = [
    project
      ? {
          content: `project: ${project.title}\ngenre: ${project.genre}\nstatus: ${project.status}`,
          itemId: project.id,
          itemType: "project",
          rank: 1,
        }
      : undefined,
    input.scope
      ? {
          content: `review scope: ${input.scope}`,
          itemId: `${input.projectId}:scope`,
          itemType: "scope",
          rank: 2,
        }
      : undefined,
    ...chapters.map((chapter, index) => ({
      content: [
        `chapter: ${chapter.title}`,
        `id: ${chapter.id}`,
        `status: ${chapter.status}`,
        `version: ${chapter.version}`,
        chapter.synopsis ? `summary: ${chapter.synopsis}` : undefined,
        chapter.content ? `content excerpt: ${chapter.content.slice(0, 1200)}` : undefined,
      ]
        .filter((line): line is string => line !== undefined)
        .join("\n"),
      itemId: chapter.id,
      itemType: chapter.id === input.targetId ? "target_chapter" : "chapter",
      rank: chapter.id === input.targetId ? 5 : 20 + index,
    })),
    ...memories.map((memory, index) => ({
      content: `${memory.status} memory [${memory.kind}/${memory.entityType}]: ${memory.content}`,
      itemId: memory.id,
      itemType: `${memory.status}_memory`,
      metadata: {
        entityId: memory.entityId,
        entityType: memory.entityType,
        kind: memory.kind,
        status: memory.status,
      },
      rank: memory.status === "canon" ? 100 + index : 300 + index,
    })),
    ...characters.map((character, index) => ({
      content: [
        `character: ${character.name}`,
        `id: ${character.id}`,
        `role: ${character.role}`,
        character.archetype ? `archetype: ${character.archetype}` : undefined,
        character.motivation ? `motivation: ${character.motivation}` : undefined,
        character.profile ? `profile: ${character.profile}` : undefined,
      ]
        .filter((line): line is string => line !== undefined)
        .join("\n"),
      itemId: character.id,
      itemType: "character",
      rank: 400 + index,
    })),
    ...worldRules.map((rule, index) => ({
      content: `world rule: ${rule.title}\ncategory: ${rule.category}\nstatus: ${rule.status}\nstatement: ${rule.content}`,
      itemId: rule.id,
      itemType: "world_rule",
      rank: 500 + index,
    })),
    ...plotlines.map((plotline, index) => ({
      content: `plotline: ${plotline.name}\ntype: ${plotline.type}\nstatus: ${plotline.status}\nsummary: ${plotline.summary ?? ""}`,
      itemId: plotline.id,
      itemType: "plotline",
      rank: 600 + index,
    })),
    ...storyEvents.map((event, index) => ({
      content: [
        `story event: ${event.title}`,
        `type: ${event.eventType}`,
        `status: ${event.status}`,
        `summary: ${event.summary}`,
        `participants: ${event.participants
          .map(
            (participant) =>
              `${participant.entityType}:${participant.entityId}/${participant.role}`,
          )
          .join(", ")}`,
      ].join("\n"),
      itemId: event.id,
      itemType: "story_event",
      rank: 700 + index,
    })),
    ...foreshadowings.map((foreshadowing, index) => ({
      content: [
        `foreshadowing: ${foreshadowing.title}`,
        `status: ${foreshadowing.status}`,
        foreshadowing.seedText ? `seed: ${foreshadowing.seedText}` : undefined,
        foreshadowing.payoffText ? `payoff: ${foreshadowing.payoffText}` : undefined,
        `links: ${foreshadowing.links.map((link) => `${link.role}:${link.eventId}`).join(", ")}`,
      ]
        .filter((line): line is string => line !== undefined)
        .join("\n"),
      itemId: foreshadowing.id,
      itemType: "foreshadowing",
      rank: 800 + index,
    })),
    graphNeighborhood && graphNeighborhood.nodes.length > 0
      ? {
          content: formatGraphNeighborhood(graphNeighborhood),
          itemId: input.targetId ?? `${input.projectId}:graph`,
          itemType: "graph_neighborhood",
          metadata: {
            edgeCount: graphNeighborhood.edges.length,
            nodeCount: graphNeighborhood.nodes.length,
          },
          rank: 900,
        }
      : undefined,
  ];

  return items.filter(
    (item): item is WorkflowContextItem => item !== undefined && item.content.trim().length > 0,
  );
}

function buildWorkflowInput(input: RunWorkflowInput): Record<string, unknown> {
  return {
    ...input.input,
    projectId: input.projectId,
    ...(input.targetId === undefined ? {} : { targetId: input.targetId }),
    ...(input.targetType === undefined ? {} : { targetType: input.targetType }),
  };
}

function persistFinishedWorkflowRun(
  repository: WorkflowRepository,
  projectId: string,
  workOrderId: string,
  run: WorkflowRunState,
): void {
  repository.persistWorkflowRun({
    input: run.input,
    projectId,
    runId: run.id,
    status: run.status,
    steps: run.steps.map((step) => ({
      name: step.name,
      projectId,
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
  repository.updateWorkOrderStatus(projectId, workOrderId, run.status);
}

function buildContinuityReviewInstruction(input: {
  readonly scope?: string | undefined;
  readonly targetType?: string | undefined;
  readonly targetId?: string | undefined;
}): string {
  return [
    `检查范围：${input.scope ?? input.targetType ?? "project"}`,
    input.targetId ? `目标 ID：${input.targetId}` : undefined,
    "请输出连续性问题、证据、严重等级和可执行修复建议。",
  ]
    .filter((line): line is string => line !== undefined)
    .join("\n");
}

function buildForeshadowingPlanInstruction(input: {
  readonly targetType?: string | undefined;
  readonly targetId?: string | undefined;
}): string {
  return [
    "请基于当前章节、剧情线和伏笔状态输出下一步伏笔行动建议。",
    input.targetType ? `目标类型：${input.targetType}` : undefined,
    input.targetId ? `目标 ID：${input.targetId}` : undefined,
  ]
    .filter((line): line is string => line !== undefined)
    .join("\n");
}

function formatContinuityReviewArtifact(output: ContinuityReviewArtifactOutput): string {
  const issueLines = output.issues.length
    ? output.issues.map(
        (issue, index) =>
          `${index + 1}. [${issue.severity}] ${issue.issueType}\n证据：${issue.evidence}\n建议：${issue.suggestion}`,
      )
    : ["未发现明确连续性问题。"];

  return ["# 连续性审阅报告", "", output.summary, "", "## 问题", ...issueLines].join("\n");
}

function formatForeshadowingPlanArtifact(output: ForeshadowingPlanArtifactOutput): string {
  const suggestionLines = output.suggestions.length
    ? output.suggestions.map((suggestion, index) =>
        [
          `${index + 1}. [${suggestion.action}] priority=${suggestion.priority}`,
          suggestion.foreshadowingId ? `伏笔：${suggestion.foreshadowingId}` : undefined,
          suggestion.chapterId ? `章节：${suggestion.chapterId}` : undefined,
          `原因：${suggestion.rationale}`,
          suggestion.proposedText ? `建议文本：${suggestion.proposedText}` : undefined,
        ]
          .filter((line): line is string => line !== undefined)
          .join("\n"),
      )
    : ["暂无伏笔行动建议。"];

  return ["# 伏笔规划建议", "", output.summary, "", "## 建议", ...suggestionLines].join("\n");
}

function appendArtifactCreatedEvent(
  domainEventRepository: DomainEventRepository,
  artifact: ArtifactRecord,
  projectId: string,
): void {
  domainEventRepository.append({
    aggregateId: artifact.id,
    aggregateType: "artifact",
    eventId: randomUUID(),
    eventType: "artifact.created",
    payload: {
      kind: artifact.kind,
      targetId: artifact.targetId,
      targetType: artifact.targetType,
      title: artifact.title,
      workflowRunId: artifact.workflowRunId,
      workOrderId: artifact.workOrderId,
    },
    projectId,
  });
}

function formatGraphNeighborhood(neighborhood: {
  readonly nodes: readonly { readonly id: string; readonly label: string; readonly type: string }[];
  readonly edges: readonly {
    readonly sourceId: string;
    readonly targetId: string;
    readonly label: string;
  }[];
}): string {
  const labels = new Map(neighborhood.nodes.map((node) => [node.id, node.label]));
  return [
    "graph neighborhood:",
    ...neighborhood.edges.map((edge) => {
      const source = labels.get(edge.sourceId) ?? edge.sourceId;
      const target = labels.get(edge.targetId) ?? edge.targetId;
      return `${source} -[${edge.label}]-> ${target}`;
    }),
  ].join("\n");
}

function hashWorkflowContextInput(input: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
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
