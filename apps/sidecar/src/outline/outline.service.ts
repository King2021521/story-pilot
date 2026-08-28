import { createHash, randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import {
  ArtifactRepository,
  ContextRepository,
  CreativePathRepository,
  DomainEventRepository,
  ModelCallRepository,
  OutlineRepository,
  ProjectRepository,
  type ArtifactRecord,
  type ChapterOutlineRecord,
  type OutlineRecord,
} from "@story-pilot/db";
import {
  buildPromptMessages,
  OutlineGenerateOutputSchema,
  type ModelGateway,
} from "@story-pilot/ai";

import { MODEL_GATEWAY } from "../ai/model-gateway.provider.js";
import { ProjectStorageService } from "../storage/project-storage.service.js";

export interface GenerateOutlineInput {
  readonly projectId: string;
  readonly scope: "full_book" | "volume" | "arc" | "chapter_batch";
  readonly chapterCount: 3 | 5 | 10;
  readonly instruction?: string;
  readonly temperature?: number;
  readonly workflowRunId?: string;
  readonly workOrderId?: string;
}

export interface GenerateOutlineResult {
  readonly artifact: ArtifactRecord;
  readonly outline: OutlineRecord;
  readonly chapterOutlines: readonly ChapterOutlineRecord[];
}

export interface ChapterOutlineInput {
  readonly projectId: string;
  readonly chapterOutlineId: string;
}

@Injectable()
export class OutlineService {
  constructor(
    private readonly projectStorage: ProjectStorageService,
    @Inject(MODEL_GATEWAY) private readonly modelGateway: ModelGateway,
  ) {}

  async generate(input: GenerateOutlineInput): Promise<GenerateOutlineResult> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const project = getProjectOrThrow(new ProjectRepository(projectDatabase), input.projectId);
      const pathRepository = new CreativePathRepository(projectDatabase);
      const path = pathRepository.getPath(input.projectId);
      const contextItems = [
        {
          content: JSON.stringify(
            {
              genre: project.genre,
              style: project.style,
              title: project.title,
            },
            null,
            2,
          ),
          contextPackageItemId: randomUUID(),
          itemId: project.id,
          itemType: "project",
          rank: 1,
        },
        ...(path.brief
          ? [
              {
                content: JSON.stringify(path.brief, null, 2),
                contextPackageItemId: randomUUID(),
                itemId: path.brief.id,
                itemType: "project_brief",
                rank: 2,
              },
            ]
          : []),
        ...(path.blueprint
          ? [
              {
                content: JSON.stringify(path.blueprint, null, 2),
                contextPackageItemId: randomUUID(),
                itemId: path.blueprint.id,
                itemType: "story_blueprint",
                rank: 3,
              },
            ]
          : []),
      ];
      const contextPackage = new ContextRepository(projectDatabase).createPackage({
        contextPackageId: randomUUID(),
        inputHash: hashGenerationContextInput({
          blueprintId: path.blueprint?.id ?? null,
          briefId: path.brief?.id ?? null,
          capability: "outline_generate",
          chapterCount: input.chapterCount,
          projectId: input.projectId,
          scope: input.scope,
        }),
        items: contextItems,
        projectId: input.projectId,
        purpose: "outline_generate",
        targetId: input.projectId,
        targetType: "project",
      });
      const messages = buildPromptMessages({
        capability: "outline_generate",
        context: contextItems.map((item) => item.content).join("\n\n"),
        instruction:
          input.instruction?.trim() ||
          `生成 ${input.chapterCount} 章 ${input.scope} 章节大纲，必须先完成章纲再进入正文。`,
        version: "v1",
      });
      const modelResult = await this.modelGateway.generateObject({
        messages,
        promptVersion: "outline-generate.v1",
        purpose: "outline_generate",
        schema: OutlineGenerateOutputSchema,
        schemaName: "OutlineGenerateOutput",
        ...(input.temperature === undefined ? {} : { temperature: input.temperature }),
      });
      const now = Date.now();
      const generate = projectDatabase.client.transaction(() => {
        const modelCallId = randomUUID();
        new ModelCallRepository(projectDatabase).create({
          latencyMs: modelResult.modelCall.latencyMs,
          model: modelResult.modelCall.model,
          modelCallId,
          projectId: input.projectId,
          provider: modelResult.modelCall.provider,
          purpose: modelResult.modelCall.purpose,
          request: {
            chapterCount: input.chapterCount,
            contextPackageId: contextPackage.id,
            messages,
            schemaName: "OutlineGenerateOutput",
            scope: input.scope,
          },
          response: modelResult.raw,
          status: modelResult.modelCall.status,
          ...(input.workflowRunId === undefined ? {} : { workflowRunId: input.workflowRunId }),
          promptVersion: modelResult.modelCall.promptVersion ?? "outline-generate.v1",
          ...(modelResult.modelCall.usage === undefined
            ? {}
            : { usage: modelResult.modelCall.usage }),
        });
        const chapterOutlines = normalizeChapterOutlineDrafts(
          modelResult.object.chapterOutlines,
          input.chapterCount,
        );
        const artifact = new ArtifactRepository(projectDatabase).createArtifact({
          artifactId: randomUUID(),
          body: JSON.stringify(
            {
              basis: {
                blueprintId: path.blueprint?.id ?? null,
                briefId: path.brief?.id ?? null,
              },
              chapterOutlines,
              riskNotes: modelResult.object.riskNotes,
              scope: input.scope,
            },
            null,
            2,
          ),
          kind: "outline_draft",
          metadata: JSON.stringify({
            blueprintId: path.blueprint?.id ?? null,
            briefId: path.brief?.id ?? null,
            chapterCount: input.chapterCount,
            contextPackageId: contextPackage.id,
            modelCallId,
          }),
          projectId: input.projectId,
          targetId: input.projectId,
          targetType: "project",
          title: modelResult.object.outline.title,
          ...(input.workflowRunId === undefined ? {} : { workflowRunId: input.workflowRunId }),
          ...(input.workOrderId === undefined ? {} : { workOrderId: input.workOrderId }),
          now,
        });
        const created = new OutlineRepository(projectDatabase).createOutlineWithChapters({
          basis: {
            ...modelResult.object.outline.basis,
            blueprintId: path.blueprint?.id ?? null,
            briefId: path.brief?.id ?? null,
          },
          chapters: chapterOutlines.map((chapter) => ({
            ...chapter,
            chapterOutlineId: randomUUID(),
          })),
          outlineId: randomUUID(),
          projectId: input.projectId,
          scope: input.scope,
          sourceArtifactId: artifact.id,
          title: modelResult.object.outline.title,
          volumeOutlineId: randomUUID(),
          now,
        });
        pathRepository.markStageCompleted(input.projectId, "outline", "chapters", now);
        new DomainEventRepository(projectDatabase).append({
          aggregateId: created.outline.id,
          aggregateType: "outline",
          eventId: randomUUID(),
          eventType: "outline.generated",
          payload: {
            artifactId: artifact.id,
            chapterCount: created.chapterOutlines.length,
            scope: input.scope,
          },
          projectId: input.projectId,
          now,
        });

        return {
          artifact,
          chapterOutlines: created.chapterOutlines,
          outline: created.outline,
        };
      });

      return generate();
    } finally {
      projectDatabase.close();
    }
  }

  async approveChapterOutline(input: ChapterOutlineInput): Promise<ChapterOutlineRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const now = Date.now();
      const approve = projectDatabase.client.transaction(() => {
        const chapterOutline = new OutlineRepository(projectDatabase).approveChapterOutline(
          input.projectId,
          input.chapterOutlineId,
          now,
        );
        new DomainEventRepository(projectDatabase).append({
          aggregateId: chapterOutline.id,
          aggregateType: "chapter_outline",
          eventId: randomUUID(),
          eventType: "chapter_outline.approved",
          payload: { outlineId: chapterOutline.outlineId, title: chapterOutline.title },
          projectId: input.projectId,
          now,
        });

        return chapterOutline;
      });

      return approve();
    } finally {
      projectDatabase.close();
    }
  }

  async applyChapterOutline(input: ChapterOutlineInput) {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const now = Date.now();
      const apply = projectDatabase.client.transaction(() => {
        const result = new OutlineRepository(projectDatabase).applyChapterOutline({
          chapterId: randomUUID(),
          chapterOutlineId: input.chapterOutlineId,
          projectId: input.projectId,
          now,
        });
        new DomainEventRepository(projectDatabase).append({
          aggregateId: result.chapterOutline.id,
          aggregateType: "chapter_outline",
          eventId: randomUUID(),
          eventType: "outline.applied",
          payload: {
            chapterId: result.chapter.id,
            outlineId: result.chapterOutline.outlineId,
            title: result.chapterOutline.title,
          },
          projectId: input.projectId,
          now,
        });

        return result;
      });

      return apply();
    } finally {
      projectDatabase.close();
    }
  }
}

function getProjectOrThrow(repository: ProjectRepository, projectId: string) {
  const project = repository.getOverview(projectId);
  if (!project) {
    throw new Error(`PROJECT_NOT_FOUND: ${projectId}`);
  }

  return project;
}

function hashGenerationContextInput(input: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function normalizeChapterOutlineDrafts(
  chapterOutlines: readonly {
    readonly title: string;
    readonly chapterGoal: string;
    readonly conflict?: string | undefined;
    readonly informationGain?: string | undefined;
    readonly emotionalTurn?: string | undefined;
    readonly hook?: string | undefined;
    readonly targetWordCount?: number | undefined;
  }[],
  chapterCount: number,
): Array<{
  readonly title: string;
  readonly chapterGoal: string;
  readonly conflict: string;
  readonly informationGain: string;
  readonly emotionalTurn: string;
  readonly hook: string;
  readonly targetWordCount: number;
  readonly sortOrder: number;
}> {
  return chapterOutlines.slice(0, chapterCount).map((chapter, index) => {
    const chapterNumber = index + 1;

    return {
      chapterGoal: chapter.chapterGoal,
      conflict: chapter.conflict ?? `主角目标与当前阻力在第 ${chapterNumber} 章正面碰撞。`,
      emotionalTurn: chapter.emotionalTurn ?? "从短暂掌控到新的压力。",
      hook: chapter.hook ?? "留下一个具体未解问题。",
      informationGain: chapter.informationGain ?? "新增一条与主冲突相关的信息。",
      sortOrder: chapterNumber,
      targetWordCount: chapter.targetWordCount ?? 3000,
      title: chapter.title,
    };
  });
}
