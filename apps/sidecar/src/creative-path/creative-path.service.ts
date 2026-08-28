import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import {
  ArtifactRepository,
  CreativePathRepository,
  DomainEventRepository,
  ProjectRepository,
  type ArtifactRecord,
  type CreativePathRecord,
  type ProjectBriefRecord,
  type StoryBlueprintRecord,
} from "@story-pilot/db";

import { ProjectStorageService } from "../storage/project-storage.service.js";

export interface SaveBriefInput {
  readonly projectId: string;
  readonly genre: string;
  readonly subgenres: readonly string[];
  readonly targetAudience?: string;
  readonly platformProfile?: string;
  readonly lengthProfile?: string;
  readonly narrativePov?: string;
  readonly emotionalRewards?: readonly string[];
  readonly initialIdea?: string;
  readonly forbiddenDirections?: readonly string[];
}

export interface ConfirmBriefInput {
  readonly projectId: string;
  readonly briefId: string;
}

export interface GenerateBlueprintInput {
  readonly projectId: string;
}

export interface GenerateBlueprintResult {
  readonly artifact: ArtifactRecord;
  readonly blueprint: StoryBlueprintRecord;
}

export interface ApplyBlueprintInput {
  readonly projectId: string;
  readonly blueprintId: string;
}

@Injectable()
export class CreativePathService {
  constructor(private readonly projectStorage: ProjectStorageService) {}

  async getPath(projectId: string): Promise<CreativePathRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(projectId);
    try {
      const repository = new CreativePathRepository(projectDatabase);
      if (repository.listStages(projectId).length === 0) {
        repository.initializePath(projectId);
      }

      return repository.getPath(projectId);
    } finally {
      projectDatabase.close();
    }
  }

  async saveBrief(input: SaveBriefInput): Promise<ProjectBriefRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const now = Date.now();
      const save = projectDatabase.client.transaction(() => {
        const brief = new CreativePathRepository(projectDatabase).saveBrief({
          briefId: randomUUID(),
          emotionalRewards: input.emotionalRewards ?? [],
          forbiddenDirections: input.forbiddenDirections ?? [],
          genre: input.genre,
          projectId: input.projectId,
          subgenres: input.subgenres,
          now,
          ...(input.initialIdea === undefined ? {} : { initialIdea: input.initialIdea }),
          ...(input.lengthProfile === undefined ? {} : { lengthProfile: input.lengthProfile }),
          ...(input.narrativePov === undefined ? {} : { narrativePov: input.narrativePov }),
          ...(input.platformProfile === undefined
            ? {}
            : { platformProfile: input.platformProfile }),
          ...(input.targetAudience === undefined ? {} : { targetAudience: input.targetAudience }),
        });
        new DomainEventRepository(projectDatabase).append({
          aggregateId: brief.id,
          aggregateType: "project_brief",
          eventId: randomUUID(),
          eventType: "project_brief.saved",
          payload: { genre: brief.genre, status: brief.status, version: brief.version },
          projectId: input.projectId,
          now,
        });

        return brief;
      });

      return save();
    } finally {
      projectDatabase.close();
    }
  }

  async confirmBrief(input: ConfirmBriefInput): Promise<ProjectBriefRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const now = Date.now();
      const confirm = projectDatabase.client.transaction(() => {
        const brief = new CreativePathRepository(projectDatabase).confirmBrief(
          input.projectId,
          input.briefId,
          now,
        );
        new DomainEventRepository(projectDatabase).append({
          aggregateId: brief.id,
          aggregateType: "project_brief",
          eventId: randomUUID(),
          eventType: "project_brief.confirmed",
          payload: { genre: brief.genre, version: brief.version },
          projectId: input.projectId,
          now,
        });

        return brief;
      });

      return confirm();
    } finally {
      projectDatabase.close();
    }
  }

  async generateBlueprint(input: GenerateBlueprintInput): Promise<GenerateBlueprintResult> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const now = Date.now();
      const generate = projectDatabase.client.transaction(() => {
        const pathRepository = new CreativePathRepository(projectDatabase);
        const project = getProjectOrThrow(new ProjectRepository(projectDatabase), input.projectId);
        const brief = pathRepository.getLatestBrief(input.projectId);
        const draft = buildBlueprintDraft(project.title, project.genre, brief);
        const artifact = new ArtifactRepository(projectDatabase).createArtifact({
          artifactId: randomUUID(),
          body: JSON.stringify(draft, null, 2),
          kind: "story_blueprint_draft",
          metadata: JSON.stringify({ briefId: brief?.id ?? null }),
          projectId: input.projectId,
          targetId: input.projectId,
          targetType: "project",
          title: "创作蓝图草案",
          now,
        });
        const blueprint = pathRepository.saveBlueprint({
          ...draft,
          blueprintId: randomUUID(),
          projectId: input.projectId,
          sourceArtifactId: artifact.id,
          now,
        });
        new DomainEventRepository(projectDatabase).append({
          aggregateId: blueprint.id,
          aggregateType: "story_blueprint",
          eventId: randomUUID(),
          eventType: "story_blueprint.generated",
          payload: { artifactId: artifact.id, status: blueprint.status },
          projectId: input.projectId,
          now,
        });

        return { artifact, blueprint };
      });

      return generate();
    } finally {
      projectDatabase.close();
    }
  }

  async applyBlueprint(input: ApplyBlueprintInput): Promise<StoryBlueprintRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const now = Date.now();
      const apply = projectDatabase.client.transaction(() => {
        const pathRepository = new CreativePathRepository(projectDatabase);
        const blueprint = pathRepository.applyBlueprint(input.projectId, input.blueprintId, now);
        if (blueprint.sourceArtifactId) {
          new ArtifactRepository(projectDatabase).markApplied(
            input.projectId,
            blueprint.sourceArtifactId,
            now,
          );
        }
        new DomainEventRepository(projectDatabase).append({
          aggregateId: blueprint.id,
          aggregateType: "story_blueprint",
          eventId: randomUUID(),
          eventType: "story_blueprint.applied",
          payload: { sourceArtifactId: blueprint.sourceArtifactId },
          projectId: input.projectId,
          now,
        });

        return blueprint;
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

function buildBlueprintDraft(
  title: string,
  genre: string,
  brief: ProjectBriefRecord | null,
): {
  readonly premise: string;
  readonly logline: string;
  readonly corePromise: string;
  readonly mainConflict: string;
  readonly protagonistArc: string;
  readonly antagonistForce: string;
  readonly differentiators: readonly string[];
  readonly risks: readonly string[];
} {
  const idea = brief?.initialIdea?.trim() || `${title} 的核心故事从一个异常事件开始。`;
  const subgenreText = brief?.subgenres.length ? brief.subgenres.join("、") : genre;

  return {
    antagonistForce: "隐藏真相或垄断关键资源的对立力量。",
    corePromise: `以${subgenreText}读者期待为基础，持续提供冲突升级、线索推进和阶段回报。`,
    differentiators: [
      "把核心设定绑定人物选择，而不是只做背景装饰。",
      "每一卷至少保留一个可追踪的伏笔回收链。",
      "章节推进以章纲目标为硬约束。",
    ],
    logline: idea,
    mainConflict: "主角追求真相或力量时，必须对抗既有秩序制造的阻力。",
    premise: idea,
    protagonistArc: "主角从被动卷入转为主动承担代价，并在关键选择中完成成长。",
    risks: [
      "设定堆叠过多会拖慢开篇。",
      "如果没有章纲约束，正文容易偏离主冲突。",
      "反派力量需要具体行动，避免只停留在概念层。",
    ],
  };
}
