import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import {
  createProjectDatabase,
  ProjectRepository,
  runProjectMigrations,
  type ProjectOverviewRecord,
} from "@story-pilot/db";

import { ProjectStorageService } from "../storage/project-storage.service.js";

export interface CreateProjectInput {
  readonly title: string;
  readonly genre?: string;
  readonly logline?: string;
  readonly wordCountGoal?: number;
}

export type ProjectOverview = ProjectOverviewRecord;

@Injectable()
export class ProjectService {
  constructor(private readonly projectStorage: ProjectStorageService) {}

  async createProject(input: CreateProjectInput): Promise<ProjectOverview> {
    const title = input.title.trim();
    const genre = input.genre?.trim() || "未分类";
    const projectId = randomUUID();
    const workId = randomUUID();
    const layout = this.projectStorage.createProjectLayout({ projectId });
    const projectDatabase = createProjectDatabase(layout.databasePath);

    try {
      await runProjectMigrations(projectDatabase);
      const repository = new ProjectRepository(projectDatabase);

      return repository.createProject({
        genre,
        projectId,
        rootPath: layout.rootPath,
        title,
        workId,
        ...(input.logline === undefined ? {} : { logline: input.logline }),
        ...(input.wordCountGoal === undefined ? {} : { wordCountGoal: input.wordCountGoal }),
      });
    } finally {
      projectDatabase.close();
    }
  }
}
