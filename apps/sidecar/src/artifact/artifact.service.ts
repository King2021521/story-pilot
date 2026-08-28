import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import {
  ArtifactRepository,
  ChapterRepository,
  DomainEventRepository,
  type ArtifactRecord,
  type ChapterRecord,
} from "@story-pilot/db";
import { createNextChapterVersion } from "@story-pilot/domain";

import { ProjectStorageService } from "../storage/project-storage.service.js";

export interface CreateArtifactInput {
  readonly projectId: string;
  readonly workOrderId?: string;
  readonly workflowRunId?: string;
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
        ...(input.workflowRunId === undefined ? {} : { workflowRunId: input.workflowRunId }),
        ...(input.workOrderId === undefined ? {} : { workOrderId: input.workOrderId }),
      });
    } finally {
      projectDatabase.close();
    }
  }

  async getArtifact(projectId: string, artifactId: string): Promise<ArtifactRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(projectId);
    try {
      const artifact = new ArtifactRepository(projectDatabase).getById(projectId, artifactId);
      if (!artifact) {
        throw new Error(`ARTIFACT_NOT_FOUND: ${artifactId}`);
      }

      return artifact;
    } finally {
      projectDatabase.close();
    }
  }

  async rejectArtifact(projectId: string, artifactId: string): Promise<ArtifactRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(projectId);
    try {
      const artifact = new ArtifactRepository(projectDatabase).getById(projectId, artifactId);
      if (!artifact) {
        throw new Error(`ARTIFACT_NOT_FOUND: ${artifactId}`);
      }
      if (artifact.status !== "pending") {
        throw new Error(`ARTIFACT_NOT_PENDING: ${artifactId}`);
      }

      return new ArtifactRepository(projectDatabase).markRejected(
        projectId,
        artifactId,
        Date.now(),
      );
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

      let appliedArtifact: ArtifactRecord | undefined;
      let appliedChapter: ChapterRecord | undefined;
      const apply = projectDatabase.client.transaction(() => {
        const baseVersion = input.targetVersion ?? chapter.version;
        const nextContent = resolveChapterContent(chapter.content, artifact.body, input.applyMode);
        const nextVersion = createNextChapterVersion(chapter.version);
        const appliedAt = Date.now();

        appliedChapter = chapterRepository.saveContentWithinTransaction({
          artifactId: artifact.id,
          baseVersion,
          chapterId: chapter.id,
          content: nextContent,
          nextVersion,
          projectId: input.projectId,
          source: "ai",
          updateCurrentContent: input.applyMode !== "create_version_only",
          versionId: randomUUID(),
          now: appliedAt,
        });
        appliedArtifact = artifactRepository.markApplied(input.projectId, artifact.id, appliedAt);
        new DomainEventRepository(projectDatabase).append({
          aggregateId: artifact.id,
          aggregateType: "artifact",
          eventId: randomUUID(),
          eventType: "artifact.applied",
          now: appliedAt,
          payload: {
            applyMode: input.applyMode,
            artifactId: artifact.id,
            chapterId: chapter.id,
            version: nextVersion,
          },
          projectId: input.projectId,
        });
      });
      apply();

      if (!appliedArtifact || !appliedChapter) {
        throw new Error(`ARTIFACT_NOT_APPLIED: ${artifact.id}`);
      }

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
      return artifactBody;
    case "create_version_only":
      return artifactBody;
    case "append":
      return currentContent ? `${currentContent}\n\n${artifactBody}` : artifactBody;
    case "patch":
      return applyStructuredPatch(currentContent, artifactBody);
  }
}

type TextPatchOperation =
  | {
      readonly op: "replace_text";
      readonly find: string;
      readonly replace: string;
    }
  | {
      readonly op: "replace";
      readonly path: "/content";
      readonly value: string;
    }
  | {
      readonly op: "append";
      readonly path?: "/content";
      readonly value: string;
    };

function applyStructuredPatch(currentContent: string, artifactBody: string): string {
  const parsed = parsePatchBody(artifactBody);
  const operations = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.operations)
      ? parsed.operations
      : undefined;

  if (!operations) {
    throw new Error("PATCH_ARTIFACT_INVALID_BODY");
  }

  return operations.reduce((content, operation, index) => {
    const parsedOperation = parseTextPatchOperation(operation, index);
    switch (parsedOperation.op) {
      case "replace_text": {
        if (!content.includes(parsedOperation.find)) {
          throw new Error(`PATCH_ARTIFACT_FIND_NOT_FOUND: ${parsedOperation.find}`);
        }

        return content.replace(parsedOperation.find, parsedOperation.replace);
      }
      case "replace":
        return parsedOperation.value;
      case "append":
        return content ? `${content}\n\n${parsedOperation.value}` : parsedOperation.value;
    }
  }, currentContent);
}

function parsePatchBody(artifactBody: string): unknown {
  try {
    return JSON.parse(artifactBody) as unknown;
  } catch (error) {
    throw new Error("PATCH_ARTIFACT_INVALID_JSON", { cause: error });
  }
}

function parseTextPatchOperation(operation: unknown, index: number): TextPatchOperation {
  if (!isRecord(operation) || typeof operation.op !== "string") {
    throw new Error(`PATCH_ARTIFACT_INVALID_OPERATION: ${index}`);
  }

  if (operation.op === "replace_text") {
    if (typeof operation.find !== "string" || typeof operation.replace !== "string") {
      throw new Error(`PATCH_ARTIFACT_INVALID_OPERATION: ${index}`);
    }

    return {
      find: operation.find,
      op: "replace_text",
      replace: operation.replace,
    };
  }

  if (operation.op === "replace") {
    if (operation.path !== "/content" || typeof operation.value !== "string") {
      throw new Error(`PATCH_ARTIFACT_INVALID_OPERATION: ${index}`);
    }

    return {
      op: "replace",
      path: "/content",
      value: operation.value,
    };
  }

  if (operation.op === "append") {
    if (
      (operation.path !== undefined && operation.path !== "/content") ||
      typeof operation.value !== "string"
    ) {
      throw new Error(`PATCH_ARTIFACT_INVALID_OPERATION: ${index}`);
    }

    return {
      op: "append",
      ...(operation.path === undefined ? {} : { path: "/content" }),
      value: operation.value,
    };
  }

  throw new Error(`PATCH_ARTIFACT_UNSUPPORTED_OPERATION: ${operation.op}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
