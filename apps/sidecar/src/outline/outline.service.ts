import { createHash, randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import type { CommandPayload } from "@story-pilot/contracts";
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
  type SceneOutlineRecord,
  type VolumeOutlineRecord,
} from "@story-pilot/db";
import {
  buildPromptMessages,
  OutlineGenerateOutputSchema,
  type ModelGateway,
} from "@story-pilot/ai";

import { MODEL_GATEWAY } from "../ai/model-gateway.provider.js";
import { buildCreativeContextItems, creativeContextText } from "../ai/creative-context.js";
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

type SaveOutlineDraftInput = CommandPayload<"outline.saveDraft">;
type SaveVolumeOutlineInput = CommandPayload<"outline.saveVolumeOutline">;
type SaveChapterOutlineInput = CommandPayload<"outline.saveChapterOutline">;
type SaveSceneOutlineInput = CommandPayload<"outline.saveSceneOutline">;

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
      const contextItems = buildCreativeContextItems({
        projectDatabase,
        projectId: project.id,
      });
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
        context: creativeContextText(contextItems),
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

  async saveOutlineDraft(input: SaveOutlineDraftInput): Promise<OutlineRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const outlineId = input.outlineId ?? randomUUID();
      const now = Date.now();
      return projectDatabase.client.transaction(() => {
        const outline = new OutlineRepository(projectDatabase).saveOutlineDraft({
          basis: input.basis,
          now,
          outlineId,
          projectId: input.projectId,
          scope: input.scope,
          status: input.status,
          title: input.title,
        });
        new DomainEventRepository(projectDatabase).append({
          aggregateId: outline.id,
          aggregateType: "outline",
          eventId: randomUUID(),
          eventType: "outline.saved",
          now,
          payload: {
            scope: outline.scope,
            status: outline.status,
            title: outline.title,
          },
          projectId: input.projectId,
        });

        return outline;
      })();
    } finally {
      projectDatabase.close();
    }
  }

  async saveVolumeOutline(input: SaveVolumeOutlineInput): Promise<VolumeOutlineRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const volumeOutlineId = input.volumeOutlineId ?? randomUUID();
      const now = Date.now();
      return projectDatabase.client.transaction(() => {
        const volumeOutline = new OutlineRepository(projectDatabase).saveVolumeOutline({
          now,
          outlineId: input.outlineId,
          projectId: input.projectId,
          purpose: input.purpose,
          sortOrder: input.sortOrder,
          status: input.status,
          title: input.title,
          volumeOutlineId,
          ...(input.climax === undefined ? {} : { climax: input.climax }),
          ...(input.majorConflict === undefined ? {} : { majorConflict: input.majorConflict }),
          ...(input.volumeId === undefined ? {} : { volumeId: input.volumeId }),
          ...(input.wordCountGoal === undefined ? {} : { wordCountGoal: input.wordCountGoal }),
        });
        new DomainEventRepository(projectDatabase).append({
          aggregateId: volumeOutline.id,
          aggregateType: "volume_outline",
          eventId: randomUUID(),
          eventType: "volume_outline.saved",
          now,
          payload: {
            outlineId: volumeOutline.outlineId,
            sortOrder: volumeOutline.sortOrder,
            status: volumeOutline.status,
          },
          projectId: input.projectId,
        });

        return volumeOutline;
      })();
    } finally {
      projectDatabase.close();
    }
  }

  async saveChapterOutline(input: SaveChapterOutlineInput): Promise<ChapterOutlineRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const chapterOutlineId = input.chapterOutlineId ?? randomUUID();
      const now = Date.now();
      return projectDatabase.client.transaction(() => {
        const chapterOutline = new OutlineRepository(projectDatabase).saveChapterOutline({
          chapterGoal: input.chapterGoal,
          chapterOutlineId,
          now,
          outlineId: input.outlineId,
          projectId: input.projectId,
          relatedForeshadowingIds: input.relatedForeshadowingIds,
          relatedPlotlineNodeIds: input.relatedPlotlineNodeIds,
          requiredCharacterIds: input.requiredCharacterIds,
          requiredLocationIds: input.requiredLocationIds,
          sortOrder: input.sortOrder,
          status: input.status,
          title: input.title,
          ...(input.chapterId === undefined ? {} : { chapterId: input.chapterId }),
          ...(input.conflict === undefined ? {} : { conflict: input.conflict }),
          ...(input.emotionalTurn === undefined ? {} : { emotionalTurn: input.emotionalTurn }),
          ...(input.hook === undefined ? {} : { hook: input.hook }),
          ...(input.informationGain === undefined
            ? {}
            : { informationGain: input.informationGain }),
          ...(input.targetWordCount === undefined
            ? {}
            : { targetWordCount: input.targetWordCount }),
          ...(input.volumeOutlineId === undefined
            ? {}
            : { volumeOutlineId: input.volumeOutlineId }),
        });
        new DomainEventRepository(projectDatabase).append({
          aggregateId: chapterOutline.id,
          aggregateType: "chapter_outline",
          eventId: randomUUID(),
          eventType: "chapter_outline.saved",
          now,
          payload: {
            outlineId: chapterOutline.outlineId,
            sortOrder: chapterOutline.sortOrder,
            status: chapterOutline.status,
            volumeOutlineId: chapterOutline.volumeOutlineId,
          },
          projectId: input.projectId,
        });

        return chapterOutline;
      })();
    } finally {
      projectDatabase.close();
    }
  }

  async saveSceneOutline(input: SaveSceneOutlineInput): Promise<SceneOutlineRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const sceneOutlineId = input.sceneOutlineId ?? randomUUID();
      const now = Date.now();
      return projectDatabase.client.transaction(() => {
        const sceneOutline = new OutlineRepository(projectDatabase).saveSceneOutline({
          beatType: input.beatType,
          chapterOutlineId: input.chapterOutlineId,
          now,
          projectId: input.projectId,
          purpose: input.purpose,
          sceneOutlineId,
          sortOrder: input.sortOrder,
          status: input.status,
          title: input.title,
          ...(input.conflict === undefined ? {} : { conflict: input.conflict }),
          ...(input.entryState === undefined ? {} : { entryState: input.entryState }),
          ...(input.exitState === undefined ? {} : { exitState: input.exitState }),
          ...(input.locationId === undefined ? {} : { locationId: input.locationId }),
          ...(input.povCharacterId === undefined ? {} : { povCharacterId: input.povCharacterId }),
          ...(input.sceneId === undefined ? {} : { sceneId: input.sceneId }),
        });
        new DomainEventRepository(projectDatabase).append({
          aggregateId: sceneOutline.id,
          aggregateType: "scene_outline",
          eventId: randomUUID(),
          eventType: "scene_outline.saved",
          now,
          payload: {
            chapterOutlineId: sceneOutline.chapterOutlineId,
            sortOrder: sceneOutline.sortOrder,
            status: sceneOutline.status,
          },
          projectId: input.projectId,
        });

        return sceneOutline;
      })();
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
