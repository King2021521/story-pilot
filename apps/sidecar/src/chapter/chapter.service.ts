import { randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import {
  ArtifactRepository,
  ChapterRepository,
  ContextRepository,
  DomainEventRepository,
  LongformPlanRepository,
  MemoryRepository,
  ModelCallRepository,
  OutlineRepository,
  ProjectRepository,
  WorkflowRepository,
  type ArtifactRecord,
  type ChapterRecord,
  type ChapterVersionRecord,
  type MemoryCandidateRecord,
} from "@story-pilot/db";
import {
  buildPromptMessages,
  ChapterDraftOutputSchema,
  ContextBuilder,
  type ModelGateway,
  type ContextPackageItem,
} from "@story-pilot/ai";
import { createNextChapterVersion } from "@story-pilot/domain";
import {
  WorkflowEngine,
  WorkflowRegistry,
  createChapterDraftWorkflow,
  type WorkflowRunState,
} from "@story-pilot/workflow-runtime";

import { MODEL_GATEWAY } from "../ai/model-gateway.provider.js";
import { GraphService } from "../graph/graph.service.js";
import { ProjectStorageService } from "../storage/project-storage.service.js";

export interface CreateChapterInput {
  readonly projectId: string;
  readonly volumeId: string;
  readonly title: string;
  readonly summary?: string;
  readonly sortOrder?: number;
}

export interface SaveChapterContentInput {
  readonly projectId: string;
  readonly chapterId: string;
  readonly content: string;
  readonly baseVersion: number;
}

export interface ListChapterVersionsInput {
  readonly projectId: string;
  readonly chapterId: string;
}

export interface ListChaptersInput {
  readonly projectId: string;
  readonly volumeId?: string;
}

export interface RestoreChapterVersionInput {
  readonly projectId: string;
  readonly chapterId: string;
  readonly versionId: string;
}

export interface GenerateChapterDraftInput {
  readonly projectId: string;
  readonly chapterId: string;
  readonly instruction?: string;
  readonly relatedEntityIds?: readonly string[];
  readonly workflowRunId?: string;
  readonly workOrderId?: string;
  readonly additionalContextItems?: readonly ContextPackageItem[];
}

export interface GenerateChapterDraftFromOutlineInput {
  readonly projectId: string;
  readonly chapterOutlineId: string;
  readonly instruction?: string;
}

export interface GenerateChapterDraftFromPlanInput {
  readonly projectId: string;
  readonly chapterPlanId: string;
  readonly instruction?: string;
}

export interface GenerateChapterDraftResult {
  readonly artifact: ArtifactRecord;
  readonly memoryCandidates: readonly MemoryCandidateRecord[];
  readonly workflowRun: WorkflowRunState;
}

@Injectable()
export class ChapterService {
  constructor(
    private readonly projectStorage: ProjectStorageService,
    private readonly graphService: GraphService,
    @Inject(MODEL_GATEWAY) private readonly modelGateway: ModelGateway,
  ) {}

  async createChapter(input: CreateChapterInput): Promise<ChapterRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const chapter = new ChapterRepository(projectDatabase).createChapter({
        chapterId: randomUUID(),
        projectId: input.projectId,
        title: input.title,
        volumeId: input.volumeId,
        ...(input.sortOrder === undefined ? {} : { position: input.sortOrder }),
        ...(input.summary === undefined ? {} : { summary: input.summary }),
      });

      new DomainEventRepository(projectDatabase).append({
        aggregateId: chapter.id,
        aggregateType: "chapter",
        eventId: randomUUID(),
        eventType: "chapter.created",
        payload: {
          title: chapter.title,
          volumeId: chapter.volumeId,
          workId: chapter.workId,
        },
        projectId: input.projectId,
      });

      return chapter;
    } finally {
      projectDatabase.close();
    }
  }

  async getChapter(projectId: string, chapterId: string): Promise<ChapterRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(projectId);
    try {
      const chapter = new ChapterRepository(projectDatabase).getById(projectId, chapterId);
      if (!chapter) {
        throw new Error(`CHAPTER_NOT_FOUND: ${chapterId}`);
      }

      return chapter;
    } finally {
      projectDatabase.close();
    }
  }

  async listChapters(input: ListChaptersInput): Promise<ChapterRecord[]> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      return new ChapterRepository(projectDatabase).listChapters({
        projectId: input.projectId,
        ...(input.volumeId === undefined ? {} : { volumeId: input.volumeId }),
      });
    } finally {
      projectDatabase.close();
    }
  }

  async saveContent(input: SaveChapterContentInput): Promise<ChapterRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const repository = new ChapterRepository(projectDatabase);
      const chapter = repository.getById(input.projectId, input.chapterId);
      if (!chapter) {
        throw new Error(`CHAPTER_NOT_FOUND: ${input.chapterId}`);
      }

      return repository.saveContent({
        baseVersion: input.baseVersion,
        chapterId: input.chapterId,
        content: input.content,
        nextVersion: createNextChapterVersion(chapter.version),
        projectId: input.projectId,
        source: "user",
        versionId: randomUUID(),
      });
    } finally {
      projectDatabase.close();
    }
  }

  async listVersions(input: ListChapterVersionsInput): Promise<ChapterVersionRecord[]> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      return new ChapterRepository(projectDatabase).listVersions(input.projectId, input.chapterId);
    } finally {
      projectDatabase.close();
    }
  }

  async restoreVersion(input: RestoreChapterVersionInput): Promise<ChapterRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const repository = new ChapterRepository(projectDatabase);
      const chapter = repository.getById(input.projectId, input.chapterId);
      if (!chapter) {
        throw new Error(`CHAPTER_NOT_FOUND: ${input.chapterId}`);
      }
      const version = repository.getVersionById(input.projectId, input.versionId);
      if (!version || version.chapterId !== input.chapterId) {
        throw new Error(`CHAPTER_VERSION_NOT_FOUND: ${input.versionId}`);
      }

      return repository.saveContent({
        baseVersion: chapter.version,
        chapterId: input.chapterId,
        content: version.content,
        nextVersion: createNextChapterVersion(chapter.version),
        projectId: input.projectId,
        source: "restore",
        versionId: randomUUID(),
      });
    } finally {
      projectDatabase.close();
    }
  }

  async generateDraft(input: GenerateChapterDraftInput): Promise<GenerateChapterDraftResult> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const chapterRepository = new ChapterRepository(projectDatabase);
      const chapter = chapterRepository.getById(input.projectId, input.chapterId);
      if (!chapter) {
        throw new Error(`CHAPTER_NOT_FOUND: ${input.chapterId}`);
      }

      const instruction = input.instruction?.trim() || "生成当前章节草稿";
      const workflowRepository = new WorkflowRepository(projectDatabase);
      const workOrderId =
        input.workOrderId ??
        workflowRepository.createWorkOrder({
          projectId: input.projectId,
          title: `生成章节草稿：${chapter.title}`,
          type: "chapter_draft",
          workOrderId: randomUUID(),
        }).id;
      const runId = input.workflowRunId ?? randomUUID();
      const workflowInput = {
        chapterId: input.chapterId,
        instruction,
        projectId: input.projectId,
        relatedEntityIds: [...(input.relatedEntityIds ?? [])],
      };
      workflowRepository.persistWorkflowRun({
        input: workflowInput,
        projectId: input.projectId,
        runId,
        status: "running",
        steps: [],
        workflowName: "chapter_draft",
        workOrderId,
      });

      let artifact: ArtifactRecord | undefined;
      let memoryCandidates: MemoryCandidateRecord[] = [];
      let modelCallId: string | undefined;
      const contextRepository = new ContextRepository(projectDatabase);
      const memoryRepository = new MemoryRepository(projectDatabase);
      const artifactRepository = new ArtifactRepository(projectDatabase);
      const modelCallRepository = new ModelCallRepository(projectDatabase);
      const domainEventRepository = new DomainEventRepository(projectDatabase);

      const registry = new WorkflowRegistry().register(
        createChapterDraftWorkflow({
          buildContext: async ({ chapterId, instruction: taskInstruction, projectId }) => {
            const context = await new ContextBuilder({
              getChapter: async (contextProjectId, contextChapterId) => {
                const contextChapter = chapterRepository.getById(
                  contextProjectId,
                  contextChapterId,
                );
                if (!contextChapter) {
                  throw new Error(`CHAPTER_NOT_FOUND: ${contextChapterId}`);
                }

                return {
                  content: contextChapter.content,
                  id: contextChapter.id,
                  summary: contextChapter.synopsis,
                  title: contextChapter.title,
                  version: contextChapter.version,
                };
              },
              getGraphNeighborhood: async ({ entityId, projectId: graphProjectId }) =>
                this.graphService.getNeighborhood({
                  entityId,
                  projectId: graphProjectId,
                }),
              listMemories: async ({ limit, projectId: memoryProjectId, statuses }) =>
                memoryRepository.listMemories({
                  limit,
                  projectId: memoryProjectId,
                  statuses,
                }),
            }).buildChapterDraftContext({
              additionalItems: input.additionalContextItems ?? [],
              chapterId,
              instruction: taskInstruction,
              projectId,
              relatedEntityIds: input.relatedEntityIds ?? [],
            });

            const contextRecord = contextRepository.createPackage({
              contextPackageId: randomUUID(),
              inputHash: context.package.inputHash,
              items: context.items.map((item) => ({
                content: item.content,
                contextPackageItemId: randomUUID(),
                itemId: item.itemId,
                itemType: item.itemType,
                rank: item.rank,
                ...(item.metadata === undefined ? {} : { metadata: item.metadata }),
              })),
              projectId,
              purpose: context.package.purpose,
              targetId: context.package.targetId,
              targetType: context.package.targetType,
            });

            return {
              contextPackageId: contextRecord.id,
              text: context.text,
            };
          },
          generateDraft: async ({
            chapterId,
            context,
            instruction: taskInstruction,
            projectId,
          }) => {
            const messages = buildPromptMessages({
              capability: "chapter_draft",
              context: context.text,
              instruction: taskInstruction,
              version: "v1",
            });
            const result = await this.modelGateway.generateObject({
              messages,
              promptVersion: "chapter-draft.v1",
              purpose: "chapter_draft",
              schema: ChapterDraftOutputSchema,
              schemaName: "ChapterDraftOutput",
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
                chapterId,
                messages,
                schemaName: "ChapterDraftOutput",
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
          persistDraft: async (draftInput) => {
            const persist = projectDatabase.client.transaction(() => {
              artifact = artifactRepository.createArtifact({
                artifactId: randomUUID(),
                body: draftInput.draft.body,
                kind: "chapter_draft",
                metadata: JSON.stringify({
                  contextPackageId: draftInput.contextPackageId,
                  reviewNotes: draftInput.reviewNotes,
                  summary: draftInput.draft.summary,
                }),
                projectId: draftInput.projectId,
                targetId: draftInput.chapterId,
                targetType: "chapter",
                workflowRunId: draftInput.workflowRunId,
                workOrderId,
                title: draftInput.draft.title,
              });
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
                projectId: draftInput.projectId,
              });

              memoryCandidates = draftInput.memoryCandidates.map((candidate) =>
                memoryRepository.createCandidate({
                  candidateId: randomUUID(),
                  confidence: candidate.confidence,
                  content: candidate.content,
                  entityType: candidate.entityType,
                  kind: candidate.kind,
                  projectId: draftInput.projectId,
                  sourceId: artifact?.id ?? "",
                  sourceType: "artifact",
                  ...(candidate.entityId === undefined ? {} : { entityId: candidate.entityId }),
                  ...(modelCallId === undefined ? {} : { modelCallId }),
                  ...(candidate.proposedRelations === undefined
                    ? {}
                    : { proposedRelations: candidate.proposedRelations }),
                }),
              );
              for (const candidate of memoryCandidates) {
                domainEventRepository.append({
                  aggregateId: candidate.id,
                  aggregateType: "memory_candidate",
                  eventId: randomUUID(),
                  eventType: "memory_candidate.created",
                  payload: {
                    artifactId: artifact.id,
                    content: candidate.content,
                    entityId: candidate.entityId,
                    entityType: candidate.entityType,
                    kind: candidate.kind,
                    sourceId: candidate.sourceId,
                    sourceType: candidate.sourceType,
                  },
                  projectId: draftInput.projectId,
                });
              }
            });
            persist();

            if (!artifact) {
              throw new Error("CHAPTER_DRAFT_ARTIFACT_NOT_CREATED");
            }

            return {
              artifactId: artifact.id,
              memoryCandidateIds: memoryCandidates.map((candidate) => candidate.id),
            };
          },
        }),
      );
      const run = await new WorkflowEngine(registry).run({
        input: workflowInput,
        runId,
        workflowName: "chapter_draft",
      });
      workflowRepository.persistWorkflowRun({
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
      workflowRepository.updateWorkOrderStatus(input.projectId, workOrderId, run.status);

      if (run.status !== "completed") {
        throw new Error(`CHAPTER_DRAFT_WORKFLOW_${run.status.toUpperCase()}`);
      }
      if (!artifact) {
        throw new Error("CHAPTER_DRAFT_ARTIFACT_NOT_CREATED");
      }

      return {
        artifact,
        memoryCandidates,
        workflowRun: run,
      };
    } finally {
      projectDatabase.close();
    }
  }

  async generateDraftFromOutline(
    input: GenerateChapterDraftFromOutlineInput,
  ): Promise<GenerateChapterDraftResult> {
    let chapterId: string;
    let outlineInstruction: string;
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const outlineRepository = new OutlineRepository(projectDatabase);
      const chapterOutline = outlineRepository.getChapterOutline(
        input.projectId,
        input.chapterOutlineId,
      );
      if (!chapterOutline) {
        throw new Error(`CHAPTER_OUTLINE_REQUIRED: ${input.chapterOutlineId}`);
      }
      if (chapterOutline.status !== "approved" && chapterOutline.status !== "applied") {
        throw new Error(`CHAPTER_OUTLINE_REQUIRED: ${input.chapterOutlineId}`);
      }

      if (chapterOutline.chapterId) {
        chapterId = chapterOutline.chapterId;
      } else {
        chapterId = outlineRepository.applyChapterOutline({
          chapterId: randomUUID(),
          chapterOutlineId: input.chapterOutlineId,
          projectId: input.projectId,
        }).chapter.id;
      }

      outlineInstruction = [
        `基于章纲生成正文：${chapterOutline.title}`,
        `本章目标：${chapterOutline.chapterGoal}`,
        chapterOutline.conflict ? `本章冲突：${chapterOutline.conflict}` : "",
        chapterOutline.informationGain ? `信息增量：${chapterOutline.informationGain}` : "",
        chapterOutline.hook ? `章节钩子：${chapterOutline.hook}` : "",
        input.instruction ?? "",
      ]
        .filter(Boolean)
        .join("\n");
    } finally {
      projectDatabase.close();
    }

    const result = await this.generateDraft({
      chapterId,
      instruction: outlineInstruction,
      projectId: input.projectId,
    });

    const metadataDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const existingMetadata = parseJsonRecord(result.artifact.metadata);
      metadataDatabase.client
        .prepare(
          "update artifacts set metadata = ?, updated_at = ? where project_id = ? and id = ?",
        )
        .run(
          JSON.stringify({
            ...existingMetadata,
            chapterOutlineId: input.chapterOutlineId,
          }),
          Date.now(),
          input.projectId,
          result.artifact.id,
        );
      new DomainEventRepository(metadataDatabase).append({
        aggregateId: result.artifact.id,
        aggregateType: "artifact",
        eventId: randomUUID(),
        eventType: "chapter_draft.generated_from_outline",
        payload: {
          chapterId,
          chapterOutlineId: input.chapterOutlineId,
        },
        projectId: input.projectId,
      });
    } finally {
      metadataDatabase.close();
    }

    return {
      ...result,
      artifact: {
        ...result.artifact,
        metadata: JSON.stringify({
          ...parseJsonRecord(result.artifact.metadata),
          chapterOutlineId: input.chapterOutlineId,
        }),
      },
    };
  }

  async generateDraftFromPlan(
    input: GenerateChapterDraftFromPlanInput,
  ): Promise<GenerateChapterDraftResult> {
    let chapterId: string;
    let chapterPlanContextItems: ContextPackageItem[];
    let instruction: string;
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const project = new ProjectRepository(projectDatabase).getOverview(input.projectId);
      if (!project) {
        throw new Error(`PROJECT_NOT_FOUND: ${input.projectId}`);
      }

      const chapterRepository = new ChapterRepository(projectDatabase);
      const longformPlanRepository = new LongformPlanRepository(projectDatabase);
      const chapterPlan = longformPlanRepository.getChapterPlan(
        input.projectId,
        input.chapterPlanId,
      );
      if (!chapterPlan) {
        throw new Error(`CHAPTER_PLAN_REQUIRED: ${input.chapterPlanId}`);
      }
      const scenePlans = longformPlanRepository.listScenePlans(input.projectId, chapterPlan.id);

      if (chapterPlan.chapterId) {
        chapterId = chapterPlan.chapterId;
      } else {
        const chapter = chapterRepository.createChapter({
          chapterId: randomUUID(),
          position: chapterPlan.chapterIndex,
          projectId: input.projectId,
          summary: chapterPlan.chapterGoal,
          title: chapterPlan.title,
          volumeId: project.defaultVolumeId,
        });
        chapterId = chapter.id;
        longformPlanRepository.linkChapterPlanToChapter({
          chapterId,
          chapterPlanId: chapterPlan.id,
          projectId: input.projectId,
        });
        new DomainEventRepository(projectDatabase).append({
          aggregateId: chapterPlan.id,
          aggregateType: "chapter_plan",
          eventId: randomUUID(),
          eventType: "chapter_plan.applied_to_chapter",
          payload: {
            chapterId,
            chapterIndex: chapterPlan.chapterIndex,
            title: chapterPlan.title,
          },
          projectId: input.projectId,
        });
      }

      chapterPlanContextItems = [
        {
          content: formatChapterPlanContext(chapterPlan),
          itemId: chapterPlan.id,
          itemType: "chapter_plan",
          metadata: {
            chapterIndex: chapterPlan.chapterIndex,
            sourceArtifactId: chapterPlan.sourceArtifactId,
            status: chapterPlan.status,
          },
          rank: 2,
        },
        ...scenePlans.map((scenePlan, index) => ({
          content: formatScenePlanContext(scenePlan),
          itemId: scenePlan.id,
          itemType: "scene_plan",
          metadata: {
            chapterPlanId: scenePlan.chapterPlanId,
            sceneIndex: scenePlan.sceneIndex,
            status: scenePlan.status,
          },
          rank: 3 + index,
        })),
      ];
      instruction = [
        `基于结构章纲生成正文：${chapterPlan.title}`,
        `章节目标：${chapterPlan.chapterGoal}`,
        `本章冲突：${chapterPlan.conflict}`,
        `信息增量：${chapterPlan.informationGain}`,
        `情绪转折：${chapterPlan.emotionalTurn}`,
        `章末钩子：${chapterPlan.hook}`,
        `目标字数：${chapterPlan.targetWordCount}`,
        input.instruction ?? "",
      ]
        .filter(Boolean)
        .join("\n");
    } finally {
      projectDatabase.close();
    }

    const result = await this.generateDraft({
      additionalContextItems: chapterPlanContextItems,
      chapterId,
      instruction,
      projectId: input.projectId,
    });

    const metadataDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const existingMetadata = parseJsonRecord(result.artifact.metadata);
      metadataDatabase.client
        .prepare(
          "update artifacts set metadata = ?, updated_at = ? where project_id = ? and id = ?",
        )
        .run(
          JSON.stringify({
            ...existingMetadata,
            chapterPlanId: input.chapterPlanId,
          }),
          Date.now(),
          input.projectId,
          result.artifact.id,
        );
      new DomainEventRepository(metadataDatabase).append({
        aggregateId: result.artifact.id,
        aggregateType: "artifact",
        eventId: randomUUID(),
        eventType: "chapter_draft.generated_from_plan",
        payload: {
          chapterId,
          chapterPlanId: input.chapterPlanId,
        },
        projectId: input.projectId,
      });
    } finally {
      metadataDatabase.close();
    }

    return {
      ...result,
      artifact: {
        ...result.artifact,
        metadata: JSON.stringify({
          ...parseJsonRecord(result.artifact.metadata),
          chapterPlanId: input.chapterPlanId,
        }),
      },
    };
  }
}

function formatChapterPlanContext(chapterPlan: {
  readonly chapterGoal: string;
  readonly chapterIndex: number;
  readonly conflict: string;
  readonly emotionalTurn: string;
  readonly hook: string;
  readonly informationGain: string;
  readonly targetWordCount: number;
  readonly title: string;
}): string {
  return [
    `chapter plan: ${chapterPlan.title}`,
    `chapter index: ${chapterPlan.chapterIndex}`,
    `goal: ${chapterPlan.chapterGoal}`,
    `conflict: ${chapterPlan.conflict}`,
    `information gain: ${chapterPlan.informationGain}`,
    `emotional turn: ${chapterPlan.emotionalTurn}`,
    `hook: ${chapterPlan.hook}`,
    `target word count: ${chapterPlan.targetWordCount}`,
  ].join("\n");
}

function formatScenePlanContext(scenePlan: {
  readonly conflictTurn: string;
  readonly memoryTargets: readonly string[];
  readonly outcome: string;
  readonly sceneGoal: string;
  readonly sceneIndex: number;
}): string {
  return [
    `scene plan ${scenePlan.sceneIndex}: ${scenePlan.sceneGoal}`,
    `conflict turn: ${scenePlan.conflictTurn}`,
    `outcome: ${scenePlan.outcome}`,
    `memory targets: ${scenePlan.memoryTargets.join(", ")}`,
  ].join("\n");
}

function parseJsonRecord(value: string | null): Record<string, unknown> {
  if (!value) {
    return {};
  }
  const parsed: unknown = JSON.parse(value);
  return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}
