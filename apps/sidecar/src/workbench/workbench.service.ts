import { Injectable } from "@nestjs/common";
import {
  ArtifactRepository,
  ChapterRepository,
  CharacterRepository,
  MemoryRepository,
  PlotRepository,
  ProjectRepository,
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
  readonly artifacts: readonly unknown[];
  readonly foreshadowings: readonly unknown[];
  readonly memoryCandidates: readonly unknown[];
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
      return {
        artifacts: new ArtifactRepository(projectDatabase).listByProject({ projectId }),
        chapters: new ChapterRepository(projectDatabase).listChapters({ projectId }),
        characters: new CharacterRepository(projectDatabase).listCharacters(projectId),
        foreshadowings: new PlotRepository(projectDatabase).listForeshadowings(projectId),
        memoryCandidates: new MemoryRepository(projectDatabase).listCandidates({ projectId }),
        plotlines: new PlotRepository(projectDatabase).listPlotlines(projectId),
        project: getProjectOrThrow(new ProjectRepository(projectDatabase), projectId),
        worldRules: new WorldRepository(projectDatabase).listWorldRules(projectId),
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
