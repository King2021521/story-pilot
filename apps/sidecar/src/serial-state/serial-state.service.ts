import { randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import {
  buildPromptTemplateMessages,
  StoryStateDeltaOutputSchema,
  type ModelGateway,
  type StoryStateDeltaOutput,
} from "@story-pilot/ai";
import type { CommandPayload } from "@story-pilot/contracts";
import {
  ArtifactRepository,
  ChapterRepository,
  CharacterRepository,
  DomainEventRepository,
  ModelCallRepository,
  ProjectRepository,
  SerialStateRepository,
  type ArtifactRecord,
  type CharacterStateSnapshotRecord,
  type GenerationContextPackageRecord,
  type PlotDebtRecord,
  type ProjectDatabase,
  type StoryStateSnapshotRecord,
} from "@story-pilot/db";

import { MODEL_GATEWAY } from "../ai/model-gateway.provider.js";
import { ContextPackageService } from "../context-package/context-package.service.js";
import { ProjectStorageService } from "../storage/project-storage.service.js";

export type ListPlotDebtsInput = CommandPayload<"plotDebt.list">;
export type SavePlotDebtCommandInput = CommandPayload<"plotDebt.save">;
export type ExtractStoryStateDeltaInput = CommandPayload<"storyState.extractDelta">;
export type ApplyStoryStateDeltaInput = CommandPayload<"storyState.applyDelta">;

export interface ExtractStoryStateDeltaResult {
  readonly artifact: ArtifactRecord;
  readonly contextPackage: GenerationContextPackageRecord;
}

export interface ApplyStoryStateDeltaResult {
  readonly storySnapshot: StoryStateSnapshotRecord;
  readonly characterSnapshots: readonly CharacterStateSnapshotRecord[];
  readonly plotDebtChanges: readonly PlotDebtRecord[];
}

const STORY_STATE_DELTA_PROMPT_VERSION = "story-state-delta.extract@v1";

@Injectable()
export class SerialStateService {
  constructor(
    private readonly projectStorage: ProjectStorageService,
    private readonly contextPackageService: ContextPackageService,
    @Inject(MODEL_GATEWAY) private readonly modelGateway: ModelGateway,
  ) {}

  async listPlotDebts(input: ListPlotDebtsInput): Promise<{ readonly items: PlotDebtRecord[] }> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      return {
        items: new SerialStateRepository(projectDatabase).listPlotDebts({
          projectId: input.projectId,
          ...(input.riskLevel === undefined ? {} : { riskLevel: input.riskLevel }),
          ...(input.status === undefined ? {} : { status: input.status }),
        }),
      };
    } finally {
      projectDatabase.close();
    }
  }

  async savePlotDebt(input: SavePlotDebtCommandInput): Promise<PlotDebtRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const values = input.values;
      return new SerialStateRepository(projectDatabase).savePlotDebt({
        debtType: values.debtType,
        lifecycleNotes: values.lifecycleNotes,
        promise: values.promise,
        projectId: input.projectId,
        relatedCharacterIds: values.relatedCharacterIds,
        relatedWorldRuleIds: values.relatedWorldRuleIds,
        riskLevel: values.riskLevel,
        status: values.status,
        title: values.title,
        ...(input.debtId === undefined ? {} : { debtId: input.debtId }),
        ...(values.actualPayoffChapterIndex === undefined
          ? {}
          : { actualPayoffChapterIndex: values.actualPayoffChapterIndex }),
        ...(values.expectedPayoffChapterIndex === undefined
          ? {}
          : { expectedPayoffChapterIndex: values.expectedPayoffChapterIndex }),
        ...(values.relatedForeshadowingId === undefined
          ? {}
          : { relatedForeshadowingId: values.relatedForeshadowingId }),
        ...(values.relatedPlotlineId === undefined
          ? {}
          : { relatedPlotlineId: values.relatedPlotlineId }),
        ...(values.seedChapterIndex === undefined
          ? {}
          : { seedChapterIndex: values.seedChapterIndex }),
      });
    } finally {
      projectDatabase.close();
    }
  }

  async extractDelta(input: ExtractStoryStateDeltaInput): Promise<ExtractStoryStateDeltaResult> {
    const contextPackage = await this.contextPackageService.buildPackage({
      projectId: input.projectId,
      purpose: "story_state_delta_extract",
      targetId: input.chapterId,
      targetType: "chapter",
    });
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const project = getProjectOrThrow(projectDatabase, input.projectId);
      const chapterRepository = new ChapterRepository(projectDatabase);
      const chapter = chapterRepository.getById(input.projectId, input.chapterId);
      if (!chapter) {
        throw new Error(`CHAPTER_NOT_FOUND: ${input.chapterId}`);
      }
      const chapterVersion = chapterRepository
        .listVersions(input.projectId, input.chapterId)
        .find((version) => version.version === input.chapterVersion);
      if (!chapterVersion) {
        throw new Error(`CHAPTER_VERSION_NOT_FOUND: ${input.chapterVersion}`);
      }

      const messages = buildPromptTemplateMessages({
        templateId: "story-state-delta.extract",
        variables: {
          chapter: {
            content: chapterVersion.content,
            id: chapter.id,
            summary: chapterVersion.summary,
            title: chapter.title,
            version: chapterVersion.version,
          },
          contextPackage,
          project,
        },
      });
      const modelResult = await this.modelGateway.generateObject({
        messages,
        promptVersion: STORY_STATE_DELTA_PROMPT_VERSION,
        purpose: "story_state_delta_extract",
        schema: StoryStateDeltaOutputSchema,
        schemaName: "StoryStateDeltaOutput",
      });
      const modelCallId = randomUUID();
      const now = Date.now();
      const artifact = projectDatabase.client.transaction(() => {
        new ModelCallRepository(projectDatabase).create({
          latencyMs: modelResult.modelCall.latencyMs,
          model: modelResult.modelCall.model,
          modelCallId,
          projectId: input.projectId,
          promptVersion: modelResult.modelCall.promptVersion ?? STORY_STATE_DELTA_PROMPT_VERSION,
          provider: modelResult.modelCall.provider,
          purpose: modelResult.modelCall.purpose,
          request: {
            chapterId: input.chapterId,
            chapterVersion: input.chapterVersion,
            contextPackageId: contextPackage.id,
            messages,
            schemaName: "StoryStateDeltaOutput",
            templateId: "story-state-delta.extract",
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
          kind: "story_state_delta_draft",
          metadata: JSON.stringify({
            chapterId: chapter.id,
            chapterIndex: chapter.position,
            chapterVersion: input.chapterVersion,
            contextPackageId: contextPackage.id,
            modelCallId,
            promptVersion: STORY_STATE_DELTA_PROMPT_VERSION,
          }),
          projectId: input.projectId,
          targetId: chapter.id,
          targetType: "chapter",
          title: `${chapter.title} 状态变化`,
          now,
        });
        new DomainEventRepository(projectDatabase).append({
          aggregateId: createdArtifact.id,
          aggregateType: "artifact",
          eventId: randomUUID(),
          eventType: "story_state_delta.artifact_created",
          payload: {
            chapterId: chapter.id,
            chapterVersion: input.chapterVersion,
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

  async applyDelta(input: ApplyStoryStateDeltaInput): Promise<ApplyStoryStateDeltaResult> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const artifactRepository = new ArtifactRepository(projectDatabase);
      const artifact = getPendingStateArtifactOrThrow(
        artifactRepository,
        input.projectId,
        input.artifactId,
      );
      const body = StoryStateDeltaOutputSchema.parse(JSON.parse(artifact.body));
      const chapter = new ChapterRepository(projectDatabase).getById(
        input.projectId,
        artifact.targetId ?? "",
      );
      if (!chapter) {
        throw new Error(`CHAPTER_NOT_FOUND: ${artifact.targetId ?? ""}`);
      }
      const metadata = parseRecord(artifact.metadata);
      const chapterVersion = toOptionalNumber(metadata.chapterVersion);
      const now = Date.now();

      return projectDatabase.client.transaction(() => {
        const repository = new SerialStateRepository(projectDatabase);
        const storySnapshot = repository.createStorySnapshot({
          activeConflicts: [],
          chapterId: chapter.id,
          chapterIndex: chapter.position,
          globalSituation: body.storyDelta.globalSituationChange,
          hiddenInformation: body.storyDelta.hiddenInformation,
          locationState: { changes: body.storyDelta.locationChanges },
          openQuestions: [],
          organizationState: { changes: body.storyDelta.organizationChanges },
          projectId: input.projectId,
          resourceState: { changes: body.storyDelta.resourceChanges },
          revealedInformation: body.storyDelta.revealedInformation,
          sourceChapterVersion: chapterVersion,
          storySnapshotId: randomUUID(),
          now,
        });
        const existingCharacterIds = new Set(
          new CharacterRepository(projectDatabase)
            .listCharacters(input.projectId)
            .map((character) => character.id),
        );
        const characterSnapshots = body.characterDeltas
          .filter((delta) => existingCharacterIds.has(delta.characterId))
          .map((delta) =>
            repository.createCharacterSnapshot({
              characterId: delta.characterId,
              chapterId: chapter.id,
              chapterIndex: chapter.position,
              emotionalState: delta.emotionalState ?? "",
              externalGoal: delta.externalGoal ?? "",
              internalNeed: delta.internalNeed ?? "",
              knowledgeState: delta.knowledgeState ?? "",
              physicalState: delta.physicalState ?? "",
              projectId: input.projectId,
              relationshipState: { changes: delta.relationshipChanges },
              resourceState: { changes: delta.resourceChanges },
              riskFlags: delta.riskFlags,
              sourceId: artifact.id,
              sourceType: "state_delta_artifact",
              stateSnapshotId: randomUUID(),
              now,
            }),
          );
        const plotDebtChanges = applyPlotDebtDeltas(repository, input.projectId, body, now);
        const appliedArtifact = artifactRepository.markApplied(input.projectId, artifact.id, now);
        new DomainEventRepository(projectDatabase).append({
          aggregateId: storySnapshot.id,
          aggregateType: "story_state_snapshot",
          eventId: randomUUID(),
          eventType: "story_state_delta.applied",
          payload: {
            artifactId: appliedArtifact.id,
            characterSnapshotIds: characterSnapshots.map((snapshot) => snapshot.id),
            plotDebtIds: plotDebtChanges.map((debt) => debt.id),
          },
          projectId: input.projectId,
          now,
        });

        return { characterSnapshots, plotDebtChanges, storySnapshot };
      })();
    } finally {
      projectDatabase.close();
    }
  }
}

function applyPlotDebtDeltas(
  repository: SerialStateRepository,
  projectId: string,
  body: StoryStateDeltaOutput,
  now: number,
): PlotDebtRecord[] {
  return body.plotDebtDeltas.map((delta) => {
    const existing =
      delta.plotDebtId === undefined
        ? null
        : repository.getPlotDebtById(projectId, delta.plotDebtId);
    const lifecycleNotes = existing ? [...existing.lifecycleNotes, delta.note] : [delta.note];
    const status = getPlotDebtStatus(delta.action, existing?.status);

    return repository.savePlotDebt({
      actualPayoffChapterIndex: existing?.actualPayoffChapterIndex ?? null,
      debtType: existing?.debtType ?? "reader_promise",
      expectedPayoffChapterIndex: existing?.expectedPayoffChapterIndex ?? null,
      lifecycleNotes,
      promise: existing?.promise ?? delta.note,
      projectId,
      relatedCharacterIds: existing?.relatedCharacterIds ?? [],
      relatedForeshadowingId: existing?.relatedForeshadowingId ?? null,
      relatedPlotlineId: existing?.relatedPlotlineId ?? null,
      relatedWorldRuleIds: existing?.relatedWorldRuleIds ?? [],
      riskLevel: delta.action === "risk_raise" ? "high" : (existing?.riskLevel ?? "medium"),
      seedChapterIndex: existing?.seedChapterIndex ?? null,
      status,
      title: existing?.title ?? delta.title,
      ...(existing?.id === undefined ? {} : { debtId: existing.id }),
      now,
    });
  });
}

function getPlotDebtStatus(action: string, fallback?: string): string {
  switch (action) {
    case "reinforce":
      return "reinforced";
    case "payoff":
      return "paid_off";
    case "drop":
      return "dropped";
    case "risk_raise":
      return fallback ?? "open";
    case "create":
    default:
      return fallback ?? "open";
  }
}

function getPendingStateArtifactOrThrow(
  repository: ArtifactRepository,
  projectId: string,
  artifactId: string,
): ArtifactRecord {
  const artifact = repository.getById(projectId, artifactId);
  if (!artifact) {
    throw new Error(`ARTIFACT_NOT_FOUND: ${artifactId}`);
  }
  if (artifact.kind !== "story_state_delta_draft") {
    throw new Error(`ARTIFACT_KIND_MISMATCH: ${artifact.kind}`);
  }
  if (artifact.status !== "pending") {
    throw new Error(`ARTIFACT_NOT_PENDING: ${artifactId}`);
  }

  return artifact;
}

function getProjectOrThrow(
  projectDatabase: ProjectDatabase,
  projectId: string,
): NonNullable<ReturnType<ProjectRepository["getOverview"]>> {
  const project = new ProjectRepository(projectDatabase).getOverview(projectId);
  if (!project) {
    throw new Error(`PROJECT_NOT_FOUND: ${projectId}`);
  }

  return project;
}

function parseRecord(value: string | null): Record<string, unknown> {
  if (!value) {
    return {};
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function toOptionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
