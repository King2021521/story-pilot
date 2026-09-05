import { randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import {
  buildPromptTemplateMessages,
  SerialReviewOutputSchema,
  type ModelGateway,
} from "@story-pilot/ai";
import type { CommandPayload } from "@story-pilot/contracts";
import {
  ArtifactRepository,
  ChapterRepository,
  DomainEventRepository,
  LongformPlanRepository,
  ModelCallRepository,
  ProjectRepository,
  SerialReviewRepository,
  SerialStateRepository,
  type ArtifactRecord,
  type GenerationContextPackageRecord,
  type ProjectDatabase,
  type ProjectOverviewRecord,
  type SerialReviewRecord,
} from "@story-pilot/db";

import { MODEL_GATEWAY } from "../ai/model-gateway.provider.js";
import { ContextPackageService } from "../context-package/context-package.service.js";
import { ProjectStorageService } from "../storage/project-storage.service.js";

export type GenerateSerialReviewInput = CommandPayload<"serialReview.generate">;
export type ApplySerialReviewInput = CommandPayload<"serialReview.apply">;

export interface GenerateSerialReviewResult {
  readonly artifact: ArtifactRecord;
  readonly contextPackage: GenerationContextPackageRecord;
}

const SERIAL_REVIEW_PROMPT_VERSION = "serial-review.generate@v1";

@Injectable()
export class SerialReviewService {
  constructor(
    private readonly projectStorage: ProjectStorageService,
    private readonly contextPackageService: ContextPackageService,
    @Inject(MODEL_GATEWAY) private readonly modelGateway: ModelGateway,
  ) {}

  async generate(input: GenerateSerialReviewInput): Promise<GenerateSerialReviewResult> {
    const targetId = `${input.startChapterIndex}-${input.endChapterIndex}`;
    const contextPackage = await this.contextPackageService.buildPackage({
      projectId: input.projectId,
      purpose: "retrospective_generate",
      targetId,
      targetType: "chapter_range",
    });
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const project = getProjectOrThrow(projectDatabase, input.projectId);
      const serialStateRepository = new SerialStateRepository(projectDatabase);
      const chaptersInRange = new ChapterRepository(projectDatabase)
        .listChapters({ projectId: input.projectId })
        .filter(
          (chapter) =>
            chapter.position >= input.startChapterIndex &&
            chapter.position <= input.endChapterIndex,
        )
        .map((chapter) => ({
          id: chapter.id,
          position: chapter.position,
          synopsis: chapter.synopsis,
          title: chapter.title,
          version: chapter.version,
          wordCount: chapter.wordCount,
        }));
      const storyStates = serialStateRepository
        .listStorySnapshots(input.projectId)
        .filter(
          (snapshot) =>
            snapshot.chapterIndex >= input.startChapterIndex &&
            snapshot.chapterIndex <= input.endChapterIndex,
        );
      const characterStates = serialStateRepository
        .listCharacterSnapshots({ projectId: input.projectId })
        .filter(
          (snapshot) =>
            snapshot.chapterIndex >= input.startChapterIndex &&
            snapshot.chapterIndex <= input.endChapterIndex,
        );
      const plotDebts = serialStateRepository.listPlotDebts({ projectId: input.projectId });
      const longformRepository = new LongformPlanRepository(projectDatabase);

      const messages = buildPromptTemplateMessages({
        templateId: "serial-review.generate",
        variables: {
          characterStates,
          contextPackage,
          longformPlans: {
            arcPlans: longformRepository.listArcPlans(input.projectId),
            bookPlans: longformRepository.listBookPlans(input.projectId),
            chapterPlans: longformRepository
              .listChapterPlans(input.projectId)
              .filter(
                (plan) =>
                  plan.chapterIndex >= input.startChapterIndex &&
                  plan.chapterIndex <= input.endChapterIndex,
              ),
            volumePlans: longformRepository.listVolumePlans(input.projectId),
          },
          plotDebts,
          project,
          recentChapters: chaptersInRange,
          reviewScope: {
            endChapterIndex: input.endChapterIndex,
            scope: input.scope,
            startChapterIndex: input.startChapterIndex,
          },
          storyStates,
        },
      });
      const modelResult = await this.modelGateway.generateObject({
        messages,
        promptVersion: SERIAL_REVIEW_PROMPT_VERSION,
        purpose: "retrospective_generate",
        schema: SerialReviewOutputSchema,
        schemaName: "SerialReviewOutput",
      });
      const modelCallId = randomUUID();
      const now = Date.now();
      const artifact = projectDatabase.client.transaction(() => {
        new ModelCallRepository(projectDatabase).create({
          latencyMs: modelResult.modelCall.latencyMs,
          model: modelResult.modelCall.model,
          modelCallId,
          projectId: input.projectId,
          promptVersion: modelResult.modelCall.promptVersion ?? SERIAL_REVIEW_PROMPT_VERSION,
          provider: modelResult.modelCall.provider,
          purpose: modelResult.modelCall.purpose,
          request: {
            contextPackageId: contextPackage.id,
            messages,
            reviewScope: input.scope,
            schemaName: "SerialReviewOutput",
            templateId: "serial-review.generate",
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
          kind: "serial_review_report",
          metadata: JSON.stringify({
            contextPackageId: contextPackage.id,
            endChapterIndex: input.endChapterIndex,
            modelCallId,
            promptVersion: SERIAL_REVIEW_PROMPT_VERSION,
            scope: input.scope,
            startChapterIndex: input.startChapterIndex,
          }),
          projectId: input.projectId,
          targetId,
          targetType: "chapter_range",
          title: `第 ${input.startChapterIndex}-${input.endChapterIndex} 章阶段复盘`,
          now,
        });
        new DomainEventRepository(projectDatabase).append({
          aggregateId: createdArtifact.id,
          aggregateType: "artifact",
          eventId: randomUUID(),
          eventType: "serial_review.artifact_created",
          payload: {
            artifactId: createdArtifact.id,
            contextPackageId: contextPackage.id,
            endChapterIndex: input.endChapterIndex,
            scope: input.scope,
            startChapterIndex: input.startChapterIndex,
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

  async apply(input: ApplySerialReviewInput): Promise<SerialReviewRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const artifactRepository = new ArtifactRepository(projectDatabase);
      const artifact = getPendingSerialReviewArtifactOrThrow(
        artifactRepository,
        input.projectId,
        input.artifactId,
      );
      const body = SerialReviewOutputSchema.parse(JSON.parse(artifact.body));
      const metadata = parseRecord(artifact.metadata);
      const now = Date.now();

      return projectDatabase.client.transaction(() => {
        const nextActions = body.nextActions.map((action) => ({
          actionType: action.actionType,
          title: action.title,
          ...(action.targetId === undefined ? {} : { targetId: action.targetId }),
        }));
        const rhythmReport = {
          score: body.rhythmReport.score,
          ...(body.rhythmReport.issue === undefined ? {} : { issue: body.rhythmReport.issue }),
          ...(body.rhythmReport.suggestion === undefined
            ? {}
            : { suggestion: body.rhythmReport.suggestion }),
        };
        const review = new SerialReviewRepository(projectDatabase).save({
          ...body,
          endChapterIndex: toRequiredNumber(metadata.endChapterIndex, "endChapterIndex"),
          nextActions,
          projectId: input.projectId,
          reviewId: randomUUID(),
          rhythmReport,
          scope: toRequiredString(metadata.scope, "scope"),
          sourceArtifactId: artifact.id,
          startChapterIndex: toRequiredNumber(metadata.startChapterIndex, "startChapterIndex"),
          status: "applied",
          now,
        });
        artifactRepository.markApplied(input.projectId, artifact.id, now);
        new DomainEventRepository(projectDatabase).append({
          aggregateId: review.id,
          aggregateType: "serial_review",
          eventId: randomUUID(),
          eventType: "serial_review.applied",
          payload: {
            artifactId: artifact.id,
            endChapterIndex: review.endChapterIndex,
            scope: review.scope,
            startChapterIndex: review.startChapterIndex,
          },
          projectId: input.projectId,
          now,
        });

        return review;
      })();
    } finally {
      projectDatabase.close();
    }
  }
}

function getPendingSerialReviewArtifactOrThrow(
  repository: ArtifactRepository,
  projectId: string,
  artifactId: string,
): ArtifactRecord {
  const artifact = repository.getById(projectId, artifactId);
  if (!artifact) {
    throw new Error(`ARTIFACT_NOT_FOUND: ${artifactId}`);
  }
  if (artifact.kind !== "serial_review_report") {
    throw new Error(`SERIAL_REVIEW_ARTIFACT_KIND_INVALID: ${artifact.kind}`);
  }
  if (artifact.status !== "pending") {
    throw new Error(`SERIAL_REVIEW_ARTIFACT_NOT_PENDING: ${artifact.status}`);
  }
  return artifact;
}

function parseRecord(value: string | null): Record<string, unknown> {
  if (!value) {
    return {};
  }
  const parsed: unknown = JSON.parse(value);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}

function toRequiredNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`SERIAL_REVIEW_METADATA_MISSING: ${field}`);
  }
  return value;
}

function toRequiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`SERIAL_REVIEW_METADATA_MISSING: ${field}`);
  }
  return value;
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
