import { randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import {
  buildPromptTemplateMessages,
  ChapterReviewOutputSchema,
  type ModelGateway,
} from "@story-pilot/ai";
import type { CommandPayload } from "@story-pilot/contracts";
import {
  ArtifactRepository,
  ChapterExecutionCardRepository,
  ChapterRepository,
  DomainEventRepository,
  ModelCallRepository,
  ProjectRepository,
  type ArtifactRecord,
  type ChapterRecord,
  type GenerationContextPackageRecord,
  type ProjectDatabase,
  type ProjectOverviewRecord,
} from "@story-pilot/db";

import { MODEL_GATEWAY } from "../ai/model-gateway.provider.js";
import { ContextPackageService } from "../context-package/context-package.service.js";
import { ProjectStorageService } from "../storage/project-storage.service.js";

export type ReviewChapterDraftInput = CommandPayload<"chapter.reviewDraft">;

export interface ReviewChapterDraftResult {
  readonly artifact: ArtifactRecord;
  readonly contextPackage: GenerationContextPackageRecord;
}

const CHAPTER_REVIEW_PROMPT_VERSION = "chapter-review.generate@v1";

@Injectable()
export class ChapterReviewService {
  constructor(
    private readonly projectStorage: ProjectStorageService,
    private readonly contextPackageService: ContextPackageService,
    @Inject(MODEL_GATEWAY) private readonly modelGateway: ModelGateway,
  ) {}

  async reviewDraft(input: ReviewChapterDraftInput): Promise<ReviewChapterDraftResult> {
    const contextPackage = await this.contextPackageService.buildPackage({
      projectId: input.projectId,
      purpose: "chapter_review",
      targetId: input.chapterId,
      targetType: "chapter",
    });
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const project = getProjectOrThrow(projectDatabase, input.projectId);
      const chapterRepository = new ChapterRepository(projectDatabase);
      const chapter = getChapterOrThrow(chapterRepository, input.projectId, input.chapterId);
      const currentArtifact = resolveReviewArtifact({
        chapter,
        chapterRepository,
        projectDatabase,
        projectId: input.projectId,
        ...(input.artifactId === undefined ? {} : { artifactId: input.artifactId }),
        ...(input.chapterVersion === undefined ? {} : { chapterVersion: input.chapterVersion }),
      });
      const chapterExecutionCard = new ChapterExecutionCardRepository(
        projectDatabase,
      ).getLatestByChapter(input.projectId, chapter.id) ?? {
        missing: true,
        reason: "当前章节还没有已确认的章节执行卡。",
      };

      const messages = buildPromptTemplateMessages({
        templateId: "chapter-review.generate",
        variables: {
          chapter: {
            id: chapter.id,
            synopsis: chapter.synopsis,
            title: chapter.title,
            version: chapter.version,
            wordCount: chapter.wordCount,
          },
          chapterExecutionCard,
          contextPackage,
          currentArtifact,
          project,
        },
      });
      const modelResult = await this.modelGateway.generateObject({
        messages,
        promptVersion: CHAPTER_REVIEW_PROMPT_VERSION,
        purpose: "chapter_review",
        schema: ChapterReviewOutputSchema,
        schemaName: "ChapterReviewOutput",
      });
      const modelCallId = randomUUID();
      const now = Date.now();
      const artifact = projectDatabase.client.transaction(() => {
        new ModelCallRepository(projectDatabase).create({
          latencyMs: modelResult.modelCall.latencyMs,
          model: modelResult.modelCall.model,
          modelCallId,
          projectId: input.projectId,
          promptVersion: modelResult.modelCall.promptVersion ?? CHAPTER_REVIEW_PROMPT_VERSION,
          provider: modelResult.modelCall.provider,
          purpose: modelResult.modelCall.purpose,
          request: {
            artifactId: input.artifactId ?? null,
            chapterId: chapter.id,
            chapterVersion: input.chapterVersion ?? null,
            contextPackageId: contextPackage.id,
            messages,
            schemaName: "ChapterReviewOutput",
            templateId: "chapter-review.generate",
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
          kind: "chapter_review_report",
          metadata: JSON.stringify({
            chapterId: chapter.id,
            chapterVersion: input.chapterVersion ?? null,
            contextPackageId: contextPackage.id,
            modelCallId,
            promptVersion: CHAPTER_REVIEW_PROMPT_VERSION,
            sourceArtifactId: input.artifactId ?? null,
          }),
          projectId: input.projectId,
          targetId: chapter.id,
          targetType: "chapter",
          title: `${chapter.title} 审稿报告`,
          now,
        });
        new DomainEventRepository(projectDatabase).append({
          aggregateId: createdArtifact.id,
          aggregateType: "artifact",
          eventId: randomUUID(),
          eventType: "chapter_review.artifact_created",
          payload: {
            artifactId: createdArtifact.id,
            chapterId: chapter.id,
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
}

function resolveReviewArtifact(input: {
  readonly artifactId?: string;
  readonly chapter: ChapterRecord;
  readonly chapterRepository: ChapterRepository;
  readonly chapterVersion?: number;
  readonly projectDatabase: ProjectDatabase;
  readonly projectId: string;
}): {
  readonly content: string;
  readonly id: string | null;
  readonly kind: string;
  readonly source: string;
  readonly version: number;
} {
  if (input.artifactId) {
    const artifact = new ArtifactRepository(input.projectDatabase).getById(
      input.projectId,
      input.artifactId,
    );
    if (!artifact) {
      throw new Error(`ARTIFACT_NOT_FOUND: ${input.artifactId}`);
    }
    return {
      content: artifact.body,
      id: artifact.id,
      kind: artifact.kind,
      source: "artifact",
      version: input.chapter.version,
    };
  }

  if (input.chapterVersion !== undefined) {
    const version = input.chapterRepository
      .listVersions(input.projectId, input.chapter.id)
      .find((candidate) => candidate.version === input.chapterVersion);
    if (!version) {
      throw new Error(`CHAPTER_VERSION_NOT_FOUND: ${input.chapterVersion}`);
    }
    return {
      content: version.content,
      id: version.id,
      kind: "chapter_version",
      source: version.source,
      version: version.version,
    };
  }

  return {
    content: input.chapter.content,
    id: input.chapter.id,
    kind: "chapter_current",
    source: "chapter",
    version: input.chapter.version,
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

function getChapterOrThrow(
  chapterRepository: ChapterRepository,
  projectId: string,
  chapterId: string,
): ChapterRecord {
  const chapter = chapterRepository.getById(projectId, chapterId);
  if (!chapter) {
    throw new Error(`CHAPTER_NOT_FOUND: ${chapterId}`);
  }
  return chapter;
}
