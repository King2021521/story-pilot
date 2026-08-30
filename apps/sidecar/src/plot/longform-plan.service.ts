import { createHash, randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import {
  ArtifactRepository,
  ContextRepository,
  DomainEventRepository,
  LongformPlanRepository,
  ModelCallRepository,
  ProjectRepository,
  WorkflowRepository,
  type ArcPlanRecord,
  type ArtifactRecord,
  type BookPlanRecord,
  type ChapterPlanRecord,
  type ProjectDatabase,
  type ScenePlanRecord,
  type VolumePlanRecord,
  type WorkflowRunRecord,
} from "@story-pilot/db";
import {
  BookPlanGenerateOutputSchema,
  buildPromptMessages,
  RollingChapterPlanGenerateOutputSchema,
  type BookPlanGenerateOutput,
  type ModelGateway,
  type RollingChapterPlanGenerateOutput,
} from "@story-pilot/ai";
import type { CommandPayload } from "@story-pilot/contracts";

import { buildCreativeContextItems, creativeContextText } from "../ai/creative-context.js";
import { MODEL_GATEWAY } from "../ai/model-gateway.provider.js";
import { ProjectStorageService } from "../storage/project-storage.service.js";

export interface GenerateBookPlanResult {
  readonly artifact: ArtifactRecord;
  readonly workflowRun: WorkflowRunRecord;
  readonly workOrderId: string;
}

export interface ApplyBookPlanResult {
  readonly artifact: ArtifactRecord;
  readonly bookPlan: BookPlanRecord;
  readonly volumePlans: readonly VolumePlanRecord[];
  readonly arcPlans: readonly ArcPlanRecord[];
}

export interface GenerateRollingOutlineResult {
  readonly artifact: ArtifactRecord;
  readonly workflowRun: WorkflowRunRecord;
  readonly workOrderId: string;
}

export interface ApplyChapterPlansResult {
  readonly artifact: ArtifactRecord;
  readonly chapterPlans: readonly ChapterPlanRecord[];
  readonly scenePlans: readonly ScenePlanRecord[];
}

export interface OutlineImpactTarget {
  readonly targetType: string;
  readonly targetId: string;
  readonly reason: string;
  readonly severity: "info" | "warning" | "error";
}

export interface AnalyzeOutlineImpactResult {
  readonly impactedTargets: readonly OutlineImpactTarget[];
}

type GenerateBookPlanInput = CommandPayload<"plot.generateBookPlan">;
type ApplyBookPlanInput = CommandPayload<"plot.applyBookPlan">;
type SaveBookPlanDraftInput = CommandPayload<"plot.saveBookPlanDraft">;
type SaveVolumePlanInput = CommandPayload<"plot.saveVolumePlan">;
type SaveArcPlanInput = CommandPayload<"plot.saveArcPlan">;
type SaveChapterPlanInput = CommandPayload<"plot.saveChapterPlan">;
type SaveScenePlanInput = CommandPayload<"plot.saveScenePlan">;
type GenerateRollingOutlineInput = CommandPayload<"plot.generateRollingOutline">;
type ApplyChapterPlansInput = CommandPayload<"plot.applyChapterPlans">;
type AnalyzeOutlineImpactInput = CommandPayload<"plot.analyzeOutlineImpact">;

@Injectable()
export class LongformPlanService {
  constructor(
    private readonly projectStorage: ProjectStorageService,
    @Inject(MODEL_GATEWAY) private readonly modelGateway: ModelGateway,
  ) {}

  async generateBookPlan(input: GenerateBookPlanInput): Promise<GenerateBookPlanResult> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const project = getProjectOrThrow(projectDatabase, input.projectId);
      const { contextPackageId, contextText } = createPlanningContext(projectDatabase, {
        input: {
          targetWordCount: input.targetWordCount,
          volumeCount: input.volumeCount,
        },
        projectId: input.projectId,
        purpose: "book_plan_generate",
        targetId: input.projectId,
        targetType: "project",
      });
      const workOrderId = createWorkOrder(projectDatabase, input.projectId, {
        title: "全书规划生成",
        type: "book_plan_generate",
      });
      const workflowRunId = randomUUID();
      persistWorkflow(projectDatabase, {
        input: {
          contextPackageId,
          targetWordCount: input.targetWordCount,
          volumeCount: input.volumeCount,
        },
        projectId: input.projectId,
        status: "running",
        workflowName: "book_plan_generate",
        workflowRunId,
        workOrderId,
      });

      const messages = buildPromptMessages({
        capability: "book_plan_generate",
        context: contextText,
        instruction: `生成目标 ${input.targetWordCount} 字、${input.volumeCount} 卷的长篇 Book Plan。`,
        version: "v1",
      });
      const modelResult = await this.modelGateway.generateObject({
        messages,
        promptVersion: "book-plan-generate.v1",
        purpose: "book_plan_generate",
        schema: BookPlanGenerateOutputSchema,
        schemaName: "BookPlanGenerateOutput",
      });
      const now = Date.now();
      const modelCallId = randomUUID();
      const normalized = normalizeBookPlanOutput(
        modelResult.object,
        input.targetWordCount,
        input.volumeCount,
      );
      const artifact = projectDatabase.client.transaction(() => {
        new ModelCallRepository(projectDatabase).create({
          latencyMs: modelResult.modelCall.latencyMs,
          model: modelResult.modelCall.model,
          modelCallId,
          projectId: input.projectId,
          promptVersion: modelResult.modelCall.promptVersion ?? "book-plan-generate.v1",
          provider: modelResult.modelCall.provider,
          purpose: "book_plan_generate",
          request: {
            contextPackageId,
            messages,
            schemaName: "BookPlanGenerateOutput",
            targetWordCount: input.targetWordCount,
            volumeCount: input.volumeCount,
          },
          response: modelResult.raw,
          status: modelResult.modelCall.status,
          workflowRunId,
          ...(modelResult.modelCall.usage === undefined
            ? {}
            : { usage: modelResult.modelCall.usage }),
        });

        const createdArtifact = new ArtifactRepository(projectDatabase).createArtifact({
          artifactId: randomUUID(),
          body: JSON.stringify(normalized, null, 2),
          kind: "book_plan_draft",
          metadata: JSON.stringify({
            contextPackageId,
            modelCallId,
            targetWordCount: input.targetWordCount,
            volumeCount: input.volumeCount,
          }),
          projectId: input.projectId,
          targetId: project.id,
          targetType: "project",
          title: normalized.bookPlan.title,
          workflowRunId,
          workOrderId,
          now,
        });
        persistWorkflow(projectDatabase, {
          input: {
            contextPackageId,
            targetWordCount: input.targetWordCount,
            volumeCount: input.volumeCount,
          },
          output: { artifactId: createdArtifact.id },
          projectId: input.projectId,
          status: "completed",
          workflowName: "book_plan_generate",
          workflowRunId,
          workOrderId,
        });
        new WorkflowRepository(projectDatabase).updateWorkOrderStatus(
          input.projectId,
          workOrderId,
          "completed",
        );

        return createdArtifact;
      })();
      const workflowRun = getWorkflowRunOrThrow(projectDatabase, input.projectId, workflowRunId);

      return { artifact, workflowRun, workOrderId };
    } finally {
      projectDatabase.close();
    }
  }

  async applyBookPlan(input: ApplyBookPlanInput): Promise<ApplyBookPlanResult> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const artifactRepository = new ArtifactRepository(projectDatabase);
      const artifact = getPendingArtifactOrThrow(
        artifactRepository,
        input.projectId,
        input.artifactId,
        "book_plan_draft",
      );
      const body = BookPlanGenerateOutputSchema.parse(JSON.parse(artifact.body));
      const created = new LongformPlanRepository(projectDatabase).createBookPlanHierarchy({
        bookPlanId: randomUUID(),
        corePromise: body.bookPlan.corePromise,
        projectId: input.projectId,
        sourceArtifactId: artifact.id,
        targetWordCount: body.bookPlan.targetWordCount,
        title: body.bookPlan.title,
        volumes: body.volumePlans.map((volume) => ({
          arcs: volume.arcs.map((arc) => ({
            arcIndex: arc.arcIndex,
            arcPlanId: randomUUID(),
            escalation: arc.escalation,
            purpose: arc.purpose,
            title: arc.title,
            ...(arc.characterArcId === undefined ? {} : { characterArcId: arc.characterArcId }),
            ...(arc.endChapterIndex === undefined ? {} : { endChapterIndex: arc.endChapterIndex }),
            ...(arc.plotlineId === undefined ? {} : { plotlineId: arc.plotlineId }),
            ...(arc.startChapterIndex === undefined
              ? {}
              : { startChapterIndex: arc.startChapterIndex }),
          })),
          majorConflict: volume.majorConflict,
          purpose: volume.purpose,
          targetWordCount: volume.targetWordCount,
          title: volume.title,
          volumeIndex: volume.volumeIndex,
          volumePlanId: randomUUID(),
          ...(volume.climax === undefined ? {} : { climax: volume.climax }),
        })),
        ...(body.bookPlan.endingDirection === undefined
          ? {}
          : { endingDirection: body.bookPlan.endingDirection }),
        ...(body.bookPlan.mainPlotlineId === undefined
          ? {}
          : { mainPlotlineId: body.bookPlan.mainPlotlineId }),
      });
      const appliedAt = Date.now();
      const appliedArtifact = projectDatabase.client.transaction(() => {
        const updatedArtifact = artifactRepository.markApplied(
          input.projectId,
          artifact.id,
          appliedAt,
        );
        new DomainEventRepository(projectDatabase).append({
          aggregateId: created.bookPlan.id,
          aggregateType: "book_plan",
          eventId: randomUUID(),
          eventType: "book_plan.applied",
          now: appliedAt,
          payload: {
            artifactId: artifact.id,
            volumePlanIds: created.volumePlans.map((volume) => volume.id),
          },
          projectId: input.projectId,
        });

        return updatedArtifact;
      })();

      return { artifact: appliedArtifact, ...created };
    } finally {
      projectDatabase.close();
    }
  }

  async saveBookPlanDraft(input: SaveBookPlanDraftInput): Promise<BookPlanRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const bookPlanId = input.bookPlanId ?? randomUUID();
      const now = Date.now();
      return projectDatabase.client.transaction(() => {
        const bookPlan = new LongformPlanRepository(projectDatabase).saveBookPlanDraft({
          bookPlanId,
          corePromise: input.corePromise,
          endingDirection: normalizeNullableText(input.endingDirection),
          mainPlotlineId: normalizeNullableText(input.mainPlotlineId),
          now,
          projectId: input.projectId,
          status: input.status,
          targetWordCount: input.targetWordCount,
          title: input.title,
        });
        new DomainEventRepository(projectDatabase).append({
          aggregateId: bookPlan.id,
          aggregateType: "book_plan",
          eventId: randomUUID(),
          eventType: "book_plan.saved",
          now,
          payload: {
            status: bookPlan.status,
            targetWordCount: bookPlan.targetWordCount,
          },
          projectId: input.projectId,
        });

        return bookPlan;
      })();
    } finally {
      projectDatabase.close();
    }
  }

  async saveVolumePlan(input: SaveVolumePlanInput): Promise<VolumePlanRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const volumePlanId = input.volumePlanId ?? randomUUID();
      const now = Date.now();
      return projectDatabase.client.transaction(() => {
        const volumePlan = new LongformPlanRepository(projectDatabase).saveVolumePlan({
          bookPlanId: input.bookPlanId,
          climax: normalizeNullableText(input.climax),
          majorConflict: input.majorConflict,
          now,
          projectId: input.projectId,
          purpose: input.purpose,
          status: input.status,
          targetWordCount: input.targetWordCount,
          title: input.title,
          volumeIndex: input.volumeIndex,
          volumePlanId,
        });
        new DomainEventRepository(projectDatabase).append({
          aggregateId: volumePlan.id,
          aggregateType: "volume_plan",
          eventId: randomUUID(),
          eventType: "volume_plan.saved",
          now,
          payload: {
            bookPlanId: volumePlan.bookPlanId,
            status: volumePlan.status,
            volumeIndex: volumePlan.volumeIndex,
          },
          projectId: input.projectId,
        });

        return volumePlan;
      })();
    } finally {
      projectDatabase.close();
    }
  }

  async saveArcPlan(input: SaveArcPlanInput): Promise<ArcPlanRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const arcPlanId = input.arcPlanId ?? randomUUID();
      const now = Date.now();
      return projectDatabase.client.transaction(() => {
        const arcPlan = new LongformPlanRepository(projectDatabase).saveArcPlan({
          arcIndex: input.arcIndex,
          arcPlanId,
          characterArcId: normalizeNullableText(input.characterArcId),
          endChapterIndex: normalizeNullableNumber(input.endChapterIndex),
          escalation: input.escalation,
          now,
          plotlineId: normalizeNullableText(input.plotlineId),
          projectId: input.projectId,
          purpose: input.purpose,
          startChapterIndex: normalizeNullableNumber(input.startChapterIndex),
          status: input.status,
          title: input.title,
          volumePlanId: input.volumePlanId,
        });
        new DomainEventRepository(projectDatabase).append({
          aggregateId: arcPlan.id,
          aggregateType: "arc_plan",
          eventId: randomUUID(),
          eventType: "arc_plan.saved",
          now,
          payload: {
            arcIndex: arcPlan.arcIndex,
            status: arcPlan.status,
            volumePlanId: arcPlan.volumePlanId,
          },
          projectId: input.projectId,
        });

        return arcPlan;
      })();
    } finally {
      projectDatabase.close();
    }
  }

  async saveChapterPlan(input: SaveChapterPlanInput): Promise<ChapterPlanRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const chapterPlanId = input.chapterPlanId ?? randomUUID();
      const now = Date.now();
      return projectDatabase.client.transaction(() => {
        const chapterPlan = new LongformPlanRepository(projectDatabase).saveChapterPlan({
          arcPlanId: normalizeNullableText(input.arcPlanId),
          chapterGoal: input.chapterGoal,
          chapterId: normalizeNullableText(input.chapterId),
          chapterIndex: input.chapterIndex,
          chapterPlanId,
          conflict: input.conflict,
          emotionalTurn: input.emotionalTurn,
          hook: input.hook,
          informationGain: input.informationGain,
          now,
          projectId: input.projectId,
          relatedCharacterIds: input.relatedCharacterIds,
          relatedForeshadowingIds: input.relatedForeshadowingIds,
          relatedPlotlineIds: input.relatedPlotlineIds,
          status: input.status,
          targetWordCount: input.targetWordCount,
          title: input.title,
        });
        new DomainEventRepository(projectDatabase).append({
          aggregateId: chapterPlan.id,
          aggregateType: "chapter_plan",
          eventId: randomUUID(),
          eventType: "chapter_plan.saved",
          now,
          payload: {
            arcPlanId: chapterPlan.arcPlanId,
            chapterIndex: chapterPlan.chapterIndex,
            status: chapterPlan.status,
          },
          projectId: input.projectId,
        });

        return chapterPlan;
      })();
    } finally {
      projectDatabase.close();
    }
  }

  async saveScenePlan(input: SaveScenePlanInput): Promise<ScenePlanRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const scenePlanId = input.scenePlanId ?? randomUUID();
      const now = Date.now();
      return projectDatabase.client.transaction(() => {
        const scenePlan = new LongformPlanRepository(projectDatabase).saveScenePlan({
          chapterPlanId: input.chapterPlanId,
          conflictTurn: input.conflictTurn,
          locationId: normalizeNullableText(input.locationId),
          memoryTargets: input.memoryTargets,
          now,
          outcome: input.outcome,
          povCharacterId: normalizeNullableText(input.povCharacterId),
          projectId: input.projectId,
          sceneGoal: input.sceneGoal,
          sceneIndex: input.sceneIndex,
          scenePlanId,
          status: input.status,
        });
        new DomainEventRepository(projectDatabase).append({
          aggregateId: scenePlan.id,
          aggregateType: "scene_plan",
          eventId: randomUUID(),
          eventType: "scene_plan.saved",
          now,
          payload: {
            chapterPlanId: scenePlan.chapterPlanId,
            sceneIndex: scenePlan.sceneIndex,
            status: scenePlan.status,
          },
          projectId: input.projectId,
        });

        return scenePlan;
      })();
    } finally {
      projectDatabase.close();
    }
  }

  async generateRollingOutline(
    input: GenerateRollingOutlineInput,
  ): Promise<GenerateRollingOutlineResult> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const target = resolveRollingOutlineTarget(projectDatabase, input);
      const { contextPackageId, contextText } = createPlanningContext(projectDatabase, {
        input: {
          arcPlanId: target.arcPlan?.id ?? null,
          chapterCount: input.chapterCount,
          startChapterIndex: input.startChapterIndex,
          volumePlanId: target.volumePlan?.id ?? null,
        },
        projectId: input.projectId,
        purpose: "rolling_chapter_plan_generate",
        targetId: target.targetId,
        targetType: target.targetType,
      });
      const workOrderId = createWorkOrder(projectDatabase, input.projectId, {
        title: "滚动章节规划",
        type: "rolling_chapter_plan_generate",
      });
      const workflowRunId = randomUUID();
      persistWorkflow(projectDatabase, {
        input: {
          contextPackageId,
          chapterCount: input.chapterCount,
          startChapterIndex: input.startChapterIndex,
          targetId: target.targetId,
          targetType: target.targetType,
        },
        projectId: input.projectId,
        status: "running",
        workflowName: "rolling_chapter_plan_generate",
        workflowRunId,
        workOrderId,
      });

      const messages = buildPromptMessages({
        capability: "rolling_chapter_plan_generate",
        context: contextText,
        instruction: `从第 ${input.startChapterIndex} 章开始生成未来 ${input.chapterCount} 章 Chapter Plan 和 Scene Plan。`,
        version: "v1",
      });
      const modelResult = await this.modelGateway.generateObject({
        messages,
        promptVersion: "rolling-chapter-plan-generate.v1",
        purpose: "rolling_chapter_plan_generate",
        schema: RollingChapterPlanGenerateOutputSchema,
        schemaName: "RollingChapterPlanGenerateOutput",
      });
      const now = Date.now();
      const modelCallId = randomUUID();
      const normalized = normalizeRollingChapterPlans(
        modelResult.object,
        input.startChapterIndex,
        input.chapterCount,
        target.arcPlan?.id,
      );
      const artifact = projectDatabase.client.transaction(() => {
        new ModelCallRepository(projectDatabase).create({
          latencyMs: modelResult.modelCall.latencyMs,
          model: modelResult.modelCall.model,
          modelCallId,
          projectId: input.projectId,
          promptVersion: modelResult.modelCall.promptVersion ?? "rolling-chapter-plan-generate.v1",
          provider: modelResult.modelCall.provider,
          purpose: "rolling_chapter_plan_generate",
          request: {
            contextPackageId,
            messages,
            schemaName: "RollingChapterPlanGenerateOutput",
            targetId: target.targetId,
            targetType: target.targetType,
          },
          response: modelResult.raw,
          status: modelResult.modelCall.status,
          workflowRunId,
          ...(modelResult.modelCall.usage === undefined
            ? {}
            : { usage: modelResult.modelCall.usage }),
        });

        const createdArtifact = new ArtifactRepository(projectDatabase).createArtifact({
          artifactId: randomUUID(),
          body: JSON.stringify(normalized, null, 2),
          kind: "rolling_chapter_plan_draft",
          metadata: JSON.stringify({
            arcPlanId: target.arcPlan?.id ?? null,
            contextPackageId,
            modelCallId,
            startChapterIndex: input.startChapterIndex,
            volumePlanId: target.volumePlan?.id ?? null,
          }),
          projectId: input.projectId,
          targetId: target.targetId,
          targetType: target.targetType,
          title: `第 ${input.startChapterIndex} 章起滚动章纲`,
          workflowRunId,
          workOrderId,
          now,
        });
        persistWorkflow(projectDatabase, {
          input: {
            contextPackageId,
            chapterCount: input.chapterCount,
            startChapterIndex: input.startChapterIndex,
            targetId: target.targetId,
            targetType: target.targetType,
          },
          output: { artifactId: createdArtifact.id },
          projectId: input.projectId,
          status: "completed",
          workflowName: "rolling_chapter_plan_generate",
          workflowRunId,
          workOrderId,
        });
        new WorkflowRepository(projectDatabase).updateWorkOrderStatus(
          input.projectId,
          workOrderId,
          "completed",
        );

        return createdArtifact;
      })();
      const workflowRun = getWorkflowRunOrThrow(projectDatabase, input.projectId, workflowRunId);

      return { artifact, workflowRun, workOrderId };
    } finally {
      projectDatabase.close();
    }
  }

  async applyChapterPlans(input: ApplyChapterPlansInput): Promise<ApplyChapterPlansResult> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const artifactRepository = new ArtifactRepository(projectDatabase);
      const artifact = getPendingArtifactOrThrow(
        artifactRepository,
        input.projectId,
        input.artifactId,
        "rolling_chapter_plan_draft",
      );
      const body = RollingChapterPlanGenerateOutputSchema.parse(JSON.parse(artifact.body));
      const selectedIds = new Set(input.selectedChapterPlanIds);
      const selectedChapterPlans = body.chapterPlans.filter(
        (chapterPlan) => chapterPlan.id && selectedIds.has(chapterPlan.id),
      );
      if (selectedChapterPlans.length === 0) {
        throw new Error("CHAPTER_PLAN_SELECTION_EMPTY");
      }
      const defaultArcPlanId = selectedChapterPlans.find(
        (chapterPlan) => chapterPlan.arcPlanId,
      )?.arcPlanId;
      const created = new LongformPlanRepository(projectDatabase).createChapterPlans({
        chapterPlans: selectedChapterPlans.map((chapterPlan) => ({
          chapterGoal: chapterPlan.chapterGoal,
          chapterIndex: chapterPlan.chapterIndex,
          chapterPlanId: requireDraftId(chapterPlan.id, "chapter_plan"),
          conflict: chapterPlan.conflict,
          emotionalTurn: chapterPlan.emotionalTurn,
          hook: chapterPlan.hook,
          informationGain: chapterPlan.informationGain,
          relatedCharacterIds: chapterPlan.relatedCharacterIds,
          relatedForeshadowingIds: chapterPlan.relatedForeshadowingIds,
          relatedPlotlineIds: chapterPlan.relatedPlotlineIds,
          scenes: chapterPlan.scenes.map((scene) => ({
            conflictTurn: scene.conflictTurn,
            memoryTargets: scene.memoryTargets,
            outcome: scene.outcome,
            sceneGoal: scene.sceneGoal,
            sceneIndex: scene.sceneIndex,
            scenePlanId: requireDraftId(scene.id, "scene_plan"),
            ...(scene.locationId === undefined ? {} : { locationId: scene.locationId }),
            ...(scene.povCharacterId === undefined ? {} : { povCharacterId: scene.povCharacterId }),
          })),
          targetWordCount: chapterPlan.targetWordCount,
          title: chapterPlan.title,
          ...(chapterPlan.arcPlanId === undefined ? {} : { arcPlanId: chapterPlan.arcPlanId }),
        })),
        projectId: input.projectId,
        sourceArtifactId: artifact.id,
        ...(defaultArcPlanId === undefined ? {} : { defaultArcPlanId }),
      });
      const appliedAt = Date.now();
      const appliedArtifact = projectDatabase.client.transaction(() => {
        const updatedArtifact = artifactRepository.markApplied(
          input.projectId,
          artifact.id,
          appliedAt,
        );
        new DomainEventRepository(projectDatabase).append({
          aggregateId: artifact.id,
          aggregateType: "rolling_chapter_plan",
          eventId: randomUUID(),
          eventType: "chapter_plans.applied",
          now: appliedAt,
          payload: {
            chapterPlanIds: created.chapterPlans.map((chapterPlan) => chapterPlan.id),
            scenePlanIds: created.scenePlans.map((scenePlan) => scenePlan.id),
          },
          projectId: input.projectId,
        });

        return updatedArtifact;
      })();

      return { artifact: appliedArtifact, ...created };
    } finally {
      projectDatabase.close();
    }
  }

  async analyzeOutlineImpact(
    input: AnalyzeOutlineImpactInput,
  ): Promise<AnalyzeOutlineImpactResult> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const repository = new LongformPlanRepository(projectDatabase);
      const severity = resolveImpactSeverity(input.patch);
      const impactedTargets: OutlineImpactTarget[] = [
        {
          reason: "当前规划节点被修改，需要重新确认自身内容。",
          severity,
          targetId: input.targetId,
          targetType: input.targetType,
        },
      ];

      if (input.targetType === "chapter_plan") {
        for (const scenePlan of repository.listScenePlans(input.projectId, input.targetId)) {
          impactedTargets.push({
            reason: "章节规划变化会影响下属场景目标和记忆提取点。",
            severity: "info",
            targetId: scenePlan.id,
            targetType: "scene_plan",
          });
        }
      }
      if (input.targetType === "arc_plan") {
        for (const chapterPlan of repository
          .listChapterPlans(input.projectId)
          .filter((chapterPlan) => chapterPlan.arcPlanId === input.targetId)) {
          impactedTargets.push({
            reason: "剧情弧线变化会影响所属章节规划。",
            severity,
            targetId: chapterPlan.id,
            targetType: "chapter_plan",
          });
        }
      }
      if (input.targetType === "volume_plan") {
        for (const arcPlan of repository
          .listArcPlans(input.projectId)
          .filter((arcPlan) => arcPlan.volumePlanId === input.targetId)) {
          impactedTargets.push({
            reason: "分卷目标变化会影响卷内剧情弧线。",
            severity,
            targetId: arcPlan.id,
            targetType: "arc_plan",
          });
        }
      }
      if (input.targetType === "book_plan") {
        for (const volumePlan of repository
          .listVolumePlans(input.projectId)
          .filter((volumePlan) => volumePlan.bookPlanId === input.targetId)) {
          impactedTargets.push({
            reason: "全书承诺变化会影响分卷规划。",
            severity,
            targetId: volumePlan.id,
            targetType: "volume_plan",
          });
        }
      }

      return { impactedTargets };
    } finally {
      projectDatabase.close();
    }
  }
}

function createPlanningContext(
  projectDatabase: ProjectDatabase,
  input: {
    readonly projectId: string;
    readonly purpose: string;
    readonly targetType: string;
    readonly targetId: string;
    readonly input: Record<string, unknown>;
  },
): { readonly contextPackageId: string; readonly contextText: string } {
  const project = getProjectOrThrow(projectDatabase, input.projectId);
  const contextItems = buildCreativeContextItems({
    includeLongformPlans: true,
    projectDatabase,
    projectId: project.id,
  });
  const contextPackageId = randomUUID();
  new ContextRepository(projectDatabase).createPackage({
    contextPackageId,
    inputHash: hashGenerationContextInput({
      ...input.input,
      projectId: input.projectId,
      purpose: input.purpose,
      targetId: input.targetId,
      targetType: input.targetType,
    }),
    items: contextItems,
    projectId: input.projectId,
    purpose: input.purpose,
    targetId: input.targetId,
    targetType: input.targetType,
  });

  return {
    contextPackageId,
    contextText: creativeContextText(contextItems),
  };
}

function normalizeBookPlanOutput(
  output: BookPlanGenerateOutput,
  targetWordCount: number,
  volumeCount: number,
): BookPlanGenerateOutput {
  const volumePlans = output.volumePlans.slice(0, volumeCount).map((volume, index) => ({
    ...volume,
    targetWordCount:
      volume.targetWordCount > 0
        ? volume.targetWordCount
        : Math.floor(targetWordCount / Math.max(volumeCount, 1)),
    volumeIndex: index + 1,
  }));

  return {
    bookPlan: {
      ...output.bookPlan,
      targetWordCount,
    },
    riskNotes: output.riskNotes,
    volumePlans,
  };
}

function normalizeRollingChapterPlans(
  output: RollingChapterPlanGenerateOutput,
  startChapterIndex: number,
  chapterCount: 10 | 20,
  defaultArcPlanId: string | undefined,
) {
  return {
    chapterPlans: output.chapterPlans.slice(0, chapterCount).map((chapterPlan, index) => ({
      ...chapterPlan,
      arcPlanId: chapterPlan.arcPlanId ?? defaultArcPlanId,
      chapterIndex: startChapterIndex + index,
      id: chapterPlan.id ?? randomUUID(),
      scenes: chapterPlan.scenes.map((scene) => ({
        ...scene,
        id: scene.id ?? randomUUID(),
      })),
    })),
    riskNotes: output.riskNotes,
  };
}

function normalizeNullableText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeNullableNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : null;
}

function resolveRollingOutlineTarget(
  projectDatabase: ProjectDatabase,
  input: GenerateRollingOutlineInput,
): {
  readonly arcPlan: ArcPlanRecord | undefined;
  readonly targetId: string;
  readonly targetType: "project" | "volume_plan" | "arc_plan";
  readonly volumePlan: VolumePlanRecord | undefined;
} {
  const repository = new LongformPlanRepository(projectDatabase);
  const volumePlan = input.volumePlanId
    ? repository
        .listVolumePlans(input.projectId)
        .find((candidate) => candidate.id === input.volumePlanId)
    : undefined;
  if (input.volumePlanId && !volumePlan) {
    throw new Error(`VOLUME_PLAN_NOT_FOUND: ${input.volumePlanId}`);
  }

  const arcPlan = input.arcPlanId
    ? repository.listArcPlans(input.projectId).find((candidate) => candidate.id === input.arcPlanId)
    : volumePlan
      ? repository.listArcPlans(input.projectId, volumePlan.id)[0]
      : undefined;
  if (input.arcPlanId && !arcPlan) {
    throw new Error(`ARC_PLAN_NOT_FOUND: ${input.arcPlanId}`);
  }

  if (input.arcPlanId && arcPlan) {
    return { arcPlan, targetId: arcPlan.id, targetType: "arc_plan", volumePlan };
  }
  if (volumePlan) {
    return { arcPlan, targetId: volumePlan.id, targetType: "volume_plan", volumePlan };
  }

  return {
    arcPlan,
    targetId: input.projectId,
    targetType: "project",
    volumePlan,
  };
}

function createWorkOrder(
  projectDatabase: ProjectDatabase,
  projectId: string,
  input: { readonly title: string; readonly type: string },
): string {
  return new WorkflowRepository(projectDatabase).createWorkOrder({
    projectId,
    title: input.title,
    type: input.type,
    workOrderId: randomUUID(),
  }).id;
}

function persistWorkflow(
  projectDatabase: ProjectDatabase,
  input: {
    readonly projectId: string;
    readonly workOrderId: string;
    readonly workflowRunId: string;
    readonly workflowName: string;
    readonly status: string;
    readonly input: Record<string, unknown>;
    readonly output?: Record<string, unknown>;
  },
): void {
  const persistedRun = {
    ...(input.output === undefined ? {} : { output: input.output }),
    input: input.input,
    projectId: input.projectId,
    runId: input.workflowRunId,
    status: input.status,
    steps: [
      createPersistedStep(input.projectId, input.workflowRunId, "prepare_context", "completed"),
      createPersistedStep(
        input.projectId,
        input.workflowRunId,
        "call_model",
        input.status === "completed" ? "completed" : "running",
      ),
      ...(input.status === "completed"
        ? [
            createPersistedStep(
              input.projectId,
              input.workflowRunId,
              "validate_output",
              "completed",
            ),
            createPersistedStep(
              input.projectId,
              input.workflowRunId,
              "persist_artifact",
              "completed",
            ),
          ]
        : []),
    ],
    workflowName: input.workflowName,
    workOrderId: input.workOrderId,
  };

  new WorkflowRepository(projectDatabase).persistWorkflowRun({
    ...persistedRun,
  });
}

function createPersistedStep(
  projectId: string,
  workflowRunId: string,
  name: string,
  status: string,
) {
  return {
    name,
    projectId,
    status,
    stepId: randomUUID(),
    workflowRunId,
  };
}

function getProjectOrThrow(projectDatabase: ProjectDatabase, projectId: string) {
  const project = new ProjectRepository(projectDatabase).getOverview(projectId);
  if (!project) {
    throw new Error(`PROJECT_NOT_FOUND: ${projectId}`);
  }

  return project;
}

function getWorkflowRunOrThrow(
  projectDatabase: ProjectDatabase,
  projectId: string,
  workflowRunId: string,
): WorkflowRunRecord {
  const workflowRun = new WorkflowRepository(projectDatabase).getWorkflowRun(
    projectId,
    workflowRunId,
  );
  if (!workflowRun) {
    throw new Error(`WORKFLOW_RUN_NOT_FOUND: ${workflowRunId}`);
  }

  return workflowRun;
}

function getPendingArtifactOrThrow(
  repository: ArtifactRepository,
  projectId: string,
  artifactId: string,
  kind: string,
): ArtifactRecord {
  const artifact = repository.getById(projectId, artifactId);
  if (!artifact) {
    throw new Error(`ARTIFACT_NOT_FOUND: ${artifactId}`);
  }
  if (artifact.kind !== kind) {
    throw new Error(`ARTIFACT_KIND_MISMATCH: ${artifact.kind}`);
  }
  if (artifact.status !== "pending") {
    throw new Error(`ARTIFACT_NOT_PENDING: ${artifactId}`);
  }

  return artifact;
}

function requireDraftId(value: string | undefined, targetType: string): string {
  if (!value) {
    throw new Error(`DRAFT_ID_REQUIRED: ${targetType}`);
  }

  return value;
}

function resolveImpactSeverity(patch: Record<string, unknown>): "info" | "warning" {
  const warningKeys = new Set([
    "chapterGoal",
    "conflict",
    "corePromise",
    "endingDirection",
    "hook",
    "majorConflict",
  ]);
  return Object.keys(patch).some((key) => warningKeys.has(key)) ? "warning" : "info";
}

function hashGenerationContextInput(input: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}
