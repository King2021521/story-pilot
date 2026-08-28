import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import {
  ArtifactRepository,
  CreativePathRepository,
  DomainEventRepository,
  OutlineRepository,
  ProjectRepository,
  type ArtifactRecord,
  type ChapterOutlineRecord,
  type OutlineRecord,
} from "@story-pilot/db";

import { ProjectStorageService } from "../storage/project-storage.service.js";

export interface GenerateOutlineInput {
  readonly projectId: string;
  readonly scope: "full_book" | "volume" | "arc" | "chapter_batch";
  readonly chapterCount: 3 | 5 | 10;
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
  constructor(private readonly projectStorage: ProjectStorageService) {}

  async generate(input: GenerateOutlineInput): Promise<GenerateOutlineResult> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const now = Date.now();
      const generate = projectDatabase.client.transaction(() => {
        const project = getProjectOrThrow(new ProjectRepository(projectDatabase), input.projectId);
        const pathRepository = new CreativePathRepository(projectDatabase);
        const path = pathRepository.getPath(input.projectId);
        const chapterOutlines = buildChapterOutlines(input.chapterCount, project.genre);
        const artifact = new ArtifactRepository(projectDatabase).createArtifact({
          artifactId: randomUUID(),
          body: JSON.stringify(
            {
              basis: {
                blueprintId: path.blueprint?.id ?? null,
                briefId: path.brief?.id ?? null,
              },
              chapterOutlines,
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
          }),
          projectId: input.projectId,
          targetId: input.projectId,
          targetType: "project",
          title: `前 ${input.chapterCount} 章大纲草案`,
          now,
        });
        const created = new OutlineRepository(projectDatabase).createOutlineWithChapters({
          basis: {
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
          title: `前 ${input.chapterCount} 章章纲`,
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

function buildChapterOutlines(
  chapterCount: number,
  genre: string,
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
  const beats = [
    "开局钩子",
    "冲突升级",
    "第一次反转",
    "代价显现",
    "线索合流",
    "关系裂变",
    "阶段胜利",
    "更大危机",
    "真相逼近",
    "小高潮",
  ];

  return Array.from({ length: chapterCount }, (_, index) => {
    const chapterNumber = index + 1;
    const beat = beats[index] ?? `推进节点 ${chapterNumber}`;

    return {
      chapterGoal: `完成${genre}故事的${beat}，让主角获得明确行动方向。`,
      conflict: `主角目标与当前阻力在第 ${chapterNumber} 章正面碰撞。`,
      emotionalTurn: chapterNumber === 1 ? "从平静到被迫卷入。" : "从短暂掌控到新的压力。",
      hook: chapterNumber === 1 ? "以异常事件收束，推动读者进入下一章。" : "留下一个具体未解问题。",
      informationGain: `新增一条与主冲突相关的信息，并绑定后续章纲。`,
      sortOrder: chapterNumber,
      targetWordCount: 3000,
      title: `第 ${chapterNumber} 章：${beat}`,
    };
  });
}
