import { randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import {
  buildPromptTemplateMessages,
  ChapterExecutionCardOutputSchema,
  type ModelGateway,
} from "@story-pilot/ai";
import type { CommandPayload } from "@story-pilot/contracts";
import {
  ArtifactRepository,
  ChapterExecutionCardRepository,
  CreativePathRepository,
  DomainEventRepository,
  LongformPlanRepository,
  ModelCallRepository,
  ProjectRepository,
  type ArtifactRecord,
  type ChapterExecutionCardRecord,
  type GenerationContextPackageRecord,
  type ProjectDatabase,
  type ProjectOverviewRecord,
  type SaveChapterExecutionCardInput,
  WorldbuildingRepository,
} from "@story-pilot/db";

import { MODEL_GATEWAY } from "../ai/model-gateway.provider.js";
import { ContextPackageService } from "../context-package/context-package.service.js";
import { ProjectStorageService } from "../storage/project-storage.service.js";

export type GenerateChapterExecutionCardInput = CommandPayload<"chapterExecutionCard.generate">;
export type ApplyChapterExecutionCardInput = CommandPayload<"chapterExecutionCard.apply">;
export type SaveChapterExecutionCardCommandInput = CommandPayload<"chapterExecutionCard.save">;

export interface GenerateChapterExecutionCardResult {
  readonly artifact: ArtifactRecord;
  readonly contextPackage: GenerationContextPackageRecord;
}

const CHAPTER_EXECUTION_CARD_PROMPT_VERSION = "chapter-execution-card.generate@v1";

@Injectable()
export class ChapterExecutionCardService {
  constructor(
    private readonly projectStorage: ProjectStorageService,
    private readonly contextPackageService: ContextPackageService,
    @Inject(MODEL_GATEWAY) private readonly modelGateway: ModelGateway,
  ) {}

  async generate(
    input: GenerateChapterExecutionCardInput,
  ): Promise<GenerateChapterExecutionCardResult> {
    const contextPackage = await this.contextPackageService.buildPackage({
      projectId: input.projectId,
      purpose: "execution_card_generate",
      targetId: input.chapterPlanId,
      targetType: "chapter_plan",
    });
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const project = getProjectOrThrow(projectDatabase, input.projectId);
      const longformRepository = new LongformPlanRepository(projectDatabase);
      const chapterPlan = longformRepository.getChapterPlan(input.projectId, input.chapterPlanId);
      if (!chapterPlan) {
        throw new Error(`CHAPTER_PLAN_NOT_FOUND: ${input.chapterPlanId}`);
      }

      const messages = buildPromptTemplateMessages({
        templateId: "chapter-execution-card.generate",
        variables: buildExecutionCardTemplateVariables({
          contextPackage,
          input,
          project,
          projectDatabase,
        }),
        ...(input.instruction === undefined ? {} : { instruction: input.instruction }),
      });
      const modelResult = await this.modelGateway.generateObject({
        messages,
        promptVersion: CHAPTER_EXECUTION_CARD_PROMPT_VERSION,
        purpose: "chapter_execution_card_generate",
        schema: ChapterExecutionCardOutputSchema,
        schemaName: "ChapterExecutionCardOutput",
      });
      const modelCallId = randomUUID();
      const now = Date.now();
      const artifact = projectDatabase.client.transaction(() => {
        new ModelCallRepository(projectDatabase).create({
          latencyMs: modelResult.modelCall.latencyMs,
          model: modelResult.modelCall.model,
          modelCallId,
          projectId: input.projectId,
          promptVersion:
            modelResult.modelCall.promptVersion ?? CHAPTER_EXECUTION_CARD_PROMPT_VERSION,
          provider: modelResult.modelCall.provider,
          purpose: modelResult.modelCall.purpose,
          request: {
            chapterPlanId: input.chapterPlanId,
            contextPackageId: contextPackage.id,
            messages,
            schemaName: "ChapterExecutionCardOutput",
            templateId: "chapter-execution-card.generate",
          },
          response: modelResult.raw,
          status: modelResult.modelCall.status,
          ...(modelResult.modelCall.usage === undefined
            ? {}
            : { usage: modelResult.modelCall.usage }),
          now,
        });
        const createdArtifact = new ArtifactRepository(projectDatabase).createArtifact({
          artifactId: randomUUID(),
          body: JSON.stringify(modelResult.object, null, 2),
          kind: "chapter_execution_card_draft",
          metadata: JSON.stringify({
            chapterPlanId: chapterPlan.id,
            contextPackageId: contextPackage.id,
            modelCallId,
            promptVersion: CHAPTER_EXECUTION_CARD_PROMPT_VERSION,
          }),
          projectId: input.projectId,
          targetId: chapterPlan.id,
          targetType: "chapter_plan",
          title: modelResult.object.card.title,
          now,
        });
        new DomainEventRepository(projectDatabase).append({
          aggregateId: createdArtifact.id,
          aggregateType: "artifact",
          eventId: randomUUID(),
          eventType: "chapter_execution_card.artifact_created",
          payload: {
            chapterPlanId: chapterPlan.id,
            contextPackageId: contextPackage.id,
          },
          projectId: input.projectId,
          now,
        });

        return createdArtifact;
      })();

      return { artifact, contextPackage };
    } finally {
      projectDatabase.close();
    }
  }

  async apply(input: ApplyChapterExecutionCardInput): Promise<ChapterExecutionCardRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const artifactRepository = new ArtifactRepository(projectDatabase);
      const artifact = getPendingArtifactOrThrow(
        artifactRepository,
        input.projectId,
        input.artifactId,
      );
      if (artifact.targetType !== "chapter_plan" || !artifact.targetId) {
        throw new Error(`CHAPTER_EXECUTION_CARD_ARTIFACT_TARGET_INVALID: ${artifact.id}`);
      }
      const chapterPlanId = artifact.targetId;
      const body = ChapterExecutionCardOutputSchema.parse(JSON.parse(artifact.body));
      const now = Date.now();

      return projectDatabase.client.transaction(() => {
        const card = new ChapterExecutionCardRepository(projectDatabase).save({
          cardId: randomUUID(),
          chapterId: null,
          chapterIndex: body.card.chapterIndex,
          chapterPlanId,
          coreConflict: body.card.coreConflict,
          emotionalTurn: body.card.emotionalTurn,
          forbiddenMoves: body.card.forbiddenMoves,
          hook: body.card.hook,
          informationGain: body.card.informationGain,
          narrativeGoal: body.card.narrativeGoal,
          povCharacterId: body.card.povCharacterId ?? null,
          projectId: input.projectId,
          readerReward: body.card.readerReward,
          relatedForeshadowingIds: body.card.relatedForeshadowingIds,
          relatedPlotDebtIds: body.card.relatedPlotDebtIds,
          relatedPlotlineIds: body.card.relatedPlotlineIds,
          requiredCharacterIds: body.card.requiredCharacterIds,
          requiredLocationIds: body.card.requiredLocationIds,
          sceneBriefs: body.card.sceneBriefs,
          sourceArtifactId: artifact.id,
          status: "confirmed",
          targetWordCount: body.card.targetWordCount,
          title: body.card.title,
          now,
        });
        artifactRepository.markApplied(input.projectId, artifact.id, now);
        new DomainEventRepository(projectDatabase).append({
          aggregateId: card.id,
          aggregateType: "chapter_execution_card",
          eventId: randomUUID(),
          eventType: "chapter_execution_card.applied",
          payload: {
            artifactId: artifact.id,
            chapterIndex: card.chapterIndex,
            chapterPlanId: card.chapterPlanId,
          },
          projectId: input.projectId,
          now,
        });

        return card;
      })();
    } finally {
      projectDatabase.close();
    }
  }

  async save(input: SaveChapterExecutionCardCommandInput): Promise<ChapterExecutionCardRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      getProjectOrThrow(projectDatabase, input.projectId);

      const values = input.values;
      const saveInput: SaveChapterExecutionCardInput = {
        chapterIndex: values.chapterIndex,
        chapterPlanId: values.chapterPlanId,
        coreConflict: values.coreConflict,
        emotionalTurn: values.emotionalTurn,
        forbiddenMoves: values.forbiddenMoves,
        hook: values.hook,
        informationGain: values.informationGain,
        narrativeGoal: values.narrativeGoal,
        ...(input.cardId === undefined ? {} : { cardId: input.cardId }),
        projectId: input.projectId,
        readerReward: values.readerReward,
        relatedForeshadowingIds: values.relatedForeshadowingIds,
        relatedPlotDebtIds: values.relatedPlotDebtIds,
        relatedPlotlineIds: values.relatedPlotlineIds,
        requiredCharacterIds: values.requiredCharacterIds,
        requiredLocationIds: values.requiredLocationIds,
        sceneBriefs: values.sceneBriefs,
        status: values.status,
        targetWordCount: values.targetWordCount,
        title: values.title,
        ...(values.chapterId === undefined ? {} : { chapterId: values.chapterId }),
        ...(values.povCharacterId === undefined ? {} : { povCharacterId: values.povCharacterId }),
        ...(values.sourceArtifactId === undefined
          ? {}
          : { sourceArtifactId: values.sourceArtifactId }),
      };

      return new ChapterExecutionCardRepository(projectDatabase).save(saveInput);
    } finally {
      projectDatabase.close();
    }
  }
}

function buildExecutionCardTemplateVariables(input: {
  readonly contextPackage: GenerationContextPackageRecord;
  readonly input: GenerateChapterExecutionCardInput;
  readonly project: ProjectOverviewRecord;
  readonly projectDatabase: ProjectDatabase;
}): Record<string, unknown> {
  const creativePathRepository = new CreativePathRepository(input.projectDatabase);
  const longformRepository = new LongformPlanRepository(input.projectDatabase);
  const chapterPlan = longformRepository.getChapterPlan(
    input.input.projectId,
    input.input.chapterPlanId,
  );
  if (!chapterPlan) {
    throw new Error(`CHAPTER_PLAN_NOT_FOUND: ${input.input.chapterPlanId}`);
  }
  const worldbuildingProfile = new WorldbuildingRepository(input.projectDatabase).getProfile(
    input.input.projectId,
  );

  return {
    project: {
      genre: input.project.genre,
      id: input.project.id,
      status: input.project.status,
      style: input.project.style ?? "通用",
      title: input.project.title,
    },
    chapterPlan,
    contextPackage: {
      estimatedTokens: input.contextPackage.estimatedTokens,
      id: input.contextPackage.id,
      items: input.contextPackage.items,
      omittedItems: input.contextPackage.omittedItems,
      strategy: input.contextPackage.strategy,
      tokenBudget: input.contextPackage.tokenBudget,
    },
    brief: creativePathRepository.getLatestBrief(input.input.projectId),
    worldbuildingProfile: worldbuildingProfile?.fields ?? null,
    blueprint: creativePathRepository.getActiveBlueprint(input.input.projectId),
    scenePlans: longformRepository.listScenePlans(input.input.projectId, chapterPlan.id),
    userInstruction: input.input.instruction ?? null,
  };
}

function getProjectOrThrow(
  projectDatabase: ProjectDatabase,
  projectId: string,
): ProjectOverviewRecord {
  const project = new ProjectRepository(projectDatabase).getOverview(projectId);
  if (!project) {
    throw new Error(`PROJECT_NOT_FOUND: ${projectId}`);
  }

  return project;
}

function getPendingArtifactOrThrow(
  repository: ArtifactRepository,
  projectId: string,
  artifactId: string,
): ArtifactRecord {
  const artifact = repository.getById(projectId, artifactId);
  if (!artifact) {
    throw new Error(`ARTIFACT_NOT_FOUND: ${artifactId}`);
  }
  if (artifact.kind !== "chapter_execution_card_draft") {
    throw new Error(`ARTIFACT_KIND_MISMATCH: ${artifact.kind}`);
  }
  if (artifact.status !== "pending") {
    throw new Error(`ARTIFACT_NOT_PENDING: ${artifactId}`);
  }

  return artifact;
}
