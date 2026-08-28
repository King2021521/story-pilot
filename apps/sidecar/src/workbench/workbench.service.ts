import { Injectable } from "@nestjs/common";
import {
  ArtifactRepository,
  ChapterRepository,
  CharacterRepository,
  CreativePathRepository,
  LongformPlanRepository,
  MemoryRepository,
  OutlineRepository,
  PlotRepository,
  ProjectRepository,
  ReviewIssueRepository,
  WorkflowRepository,
  WorldRepository,
} from "@story-pilot/db";

import { ProjectStorageService } from "../storage/project-storage.service.js";

export interface WorkbenchSnapshot {
  readonly project: unknown;
  readonly stats: {
    readonly chapters: number;
    readonly artifacts: number;
    readonly memories: number;
    readonly pendingMemoryCandidates: number;
    readonly workOrders: number;
  };
  readonly recentChapters: readonly unknown[];
  readonly pendingArtifacts: readonly unknown[];
  readonly pendingMemoryCandidates: readonly unknown[];
  readonly activeWorkOrders: readonly unknown[];
}

export interface WorkbenchBoard {
  readonly project: unknown;
  readonly chapters: readonly unknown[];
  readonly characters: readonly unknown[];
  readonly creativePath: unknown;
  readonly artifacts: readonly unknown[];
  readonly foreshadowings: readonly unknown[];
  readonly items: readonly unknown[];
  readonly locations: readonly unknown[];
  readonly memoryCandidates: readonly unknown[];
  readonly organizations: readonly unknown[];
  readonly plotlines: readonly unknown[];
  readonly worldRules: readonly unknown[];
  readonly workOrders: readonly unknown[];
}

@Injectable()
export class WorkbenchService {
  constructor(private readonly projectStorage: ProjectStorageService) {}

  async getSnapshot(projectId: string): Promise<WorkbenchSnapshot> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(projectId);
    try {
      const project = getProjectOrThrow(new ProjectRepository(projectDatabase), projectId);
      const chapters = new ChapterRepository(projectDatabase).listChapters({ projectId });
      const pendingArtifacts = new ArtifactRepository(projectDatabase).listByProject({
        projectId,
        status: "pending",
      });
      const memoryRepository = new MemoryRepository(projectDatabase);
      const pendingMemoryCandidates = memoryRepository.listCandidates({
        projectId,
        status: "pending",
      });
      const memories = memoryRepository.listMemories({ projectId, statuses: ["canon"] });
      const activeWorkOrders = new WorkflowRepository(projectDatabase).listWorkOrders({
        projectId,
        status: "running",
      });

      return {
        activeWorkOrders,
        pendingArtifacts,
        pendingMemoryCandidates,
        project,
        recentChapters: chapters.slice(0, 10),
        stats: {
          artifacts: pendingArtifacts.length,
          chapters: chapters.length,
          memories: memories.length,
          pendingMemoryCandidates: pendingMemoryCandidates.length,
          workOrders: activeWorkOrders.length,
        },
      };
    } finally {
      projectDatabase.close();
    }
  }

  async getBoard(projectId: string): Promise<WorkbenchBoard> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(projectId);
    try {
      const worldRepository = new WorldRepository(projectDatabase);
      const creativePathRepository = new CreativePathRepository(projectDatabase);
      const longformPlanRepository = new LongformPlanRepository(projectDatabase);
      const outlineRepository = new OutlineRepository(projectDatabase);
      if (creativePathRepository.listStages(projectId).length === 0) {
        creativePathRepository.initializePath(projectId);
      }
      const creativePath = creativePathRepository.getPath(projectId);
      return {
        artifacts: new ArtifactRepository(projectDatabase).listByProject({ projectId }),
        chapters: new ChapterRepository(projectDatabase).listChapters({ projectId }),
        characters: new CharacterRepository(projectDatabase).listCharacters(projectId),
        creativePath: {
          ...creativePath,
          arcPlans: longformPlanRepository.listArcPlans(projectId),
          bookPlans: longformPlanRepository.listBookPlans(projectId),
          chapterOutlines: outlineRepository.listChapterOutlines(projectId),
          chapterPlans: longformPlanRepository.listChapterPlans(projectId),
          outlines: outlineRepository.listOutlines(projectId),
          reviewIssues: new ReviewIssueRepository(projectDatabase).listByProject({
            projectId,
            status: "open",
          }),
          scenePlans: longformPlanRepository.listScenePlans(projectId),
          volumePlans: longformPlanRepository.listVolumePlans(projectId),
        },
        foreshadowings: new PlotRepository(projectDatabase).listForeshadowings(projectId),
        items: worldRepository.listItems(projectId),
        locations: worldRepository.listLocations(projectId),
        memoryCandidates: new MemoryRepository(projectDatabase).listCandidates({ projectId }),
        organizations: worldRepository.listOrganizations(projectId),
        plotlines: new PlotRepository(projectDatabase).listPlotlines(projectId),
        project: getProjectOrThrow(new ProjectRepository(projectDatabase), projectId),
        worldRules: worldRepository.listWorldRules(projectId),
        workOrders: new WorkflowRepository(projectDatabase).listWorkOrders({ projectId }),
      };
    } finally {
      projectDatabase.close();
    }
  }
}

function getProjectOrThrow(repository: ProjectRepository, projectId: string): unknown {
  const project = repository.getOverview(projectId);
  if (!project) {
    throw new Error(`PROJECT_NOT_FOUND: ${projectId}`);
  }

  return project;
}
