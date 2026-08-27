import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import {
  ArtifactRepository,
  ChapterRepository,
  type ArtifactRecord,
  type ChapterRecord,
} from "@story-pilot/db";
import { createNextChapterVersion } from "@story-pilot/domain";

import { ProjectStorageService } from "../storage/project-storage.service.js";

export interface CreateArtifactInput {
  readonly projectId: string;
  readonly kind: string;
  readonly targetType?: string;
  readonly targetId?: string;
  readonly title: string;
  readonly body: string;
  readonly metadata?: string;
}

export interface ApplyArtifactInput {
  readonly projectId: string;
  readonly artifactId: string;
  readonly applyMode: "replace" | "patch" | "append" | "create_version_only";
  readonly targetVersion?: number;
}

export interface AppliedArtifactResult {
  readonly artifact: ArtifactRecord;
  readonly chapter: ChapterRecord;
}

@Injectable()
export class ArtifactService {
  constructor(private readonly projectStorage: ProjectStorageService) {}

  async createArtifact(input: CreateArtifactInput): Promise<ArtifactRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      return new ArtifactRepository(projectDatabase).createArtifact({
        artifactId: randomUUID(),
        body: input.body,
        kind: input.kind,
        projectId: input.projectId,
        title: input.title,
        ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
        ...(input.targetId === undefined ? {} : { targetId: input.targetId }),
        ...(input.targetType === undefined ? {} : { targetType: input.targetType }),
      });
    } finally {
      projectDatabase.close();
    }
  }

  async applyArtifact(input: ApplyArtifactInput): Promise<AppliedArtifactResult> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const artifactRepository = new ArtifactRepository(projectDatabase);
      const chapterRepository = new ChapterRepository(projectDatabase);
      const artifact = artifactRepository.getById(input.projectId, input.artifactId);
      if (!artifact) {
        throw new Error(`ARTIFACT_NOT_FOUND: ${input.artifactId}`);
      }
      if (artifact.status !== "pending") {
        throw new Error(`ARTIFACT_NOT_PENDING: ${input.artifactId}`);
      }
      if (artifact.targetType !== "chapter" || !artifact.targetId) {
        throw new Error(`UNSUPPORTED_ARTIFACT_TARGET: ${artifact.targetType ?? "unknown"}`);
      }

      const chapter = chapterRepository.getById(input.projectId, artifact.targetId);
      if (!chapter) {
        throw new Error(`CHAPTER_NOT_FOUND: ${artifact.targetId}`);
      }

      const baseVersion = input.targetVersion ?? chapter.version;
      const nextContent = resolveChapterContent(chapter.content, artifact.body, input.applyMode);
      const appliedChapter = chapterRepository.saveContent({
        baseVersion,
        chapterId: chapter.id,
        content: nextContent,
        nextVersion: createNextChapterVersion(chapter.version),
        projectId: input.projectId,
        source: "ai_artifact",
        versionId: randomUUID(),
      });
      const appliedArtifact = artifactRepository.markApplied(input.projectId, artifact.id, Date.now());

      return {
        artifact: appliedArtifact,
        chapter: appliedChapter,
      };
    } finally {
      projectDatabase.close();
    }
  }

}

function resolveChapterContent(
  currentContent: string,
  artifactBody: string,
  applyMode: ApplyArtifactInput["applyMode"],
): string {
  switch (applyMode) {
    case "replace":
    case "create_version_only":
      return artifactBody;
    case "append":
      return currentContent ? `${currentContent}\n\n${artifactBody}` : artifactBody;
    case "patch":
      throw new Error("PATCH_ARTIFACT_NOT_IMPLEMENTED");
  }
}
