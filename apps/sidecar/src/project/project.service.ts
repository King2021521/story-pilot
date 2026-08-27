import { randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";

import { Injectable } from "@nestjs/common";
import {
  createProjectDatabase,
  PROJECT_DATABASE_FILE,
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

export interface ListRecentProjectsInput {
  readonly limit?: number;
}

export interface OpenProjectInput {
  readonly projectId?: string;
  readonly path?: string;
}

export interface BackupProjectResult {
  readonly projectId: string;
  readonly backupPath: string;
  readonly createdAt: number;
}

@Injectable()
export class ProjectService {
  constructor(private readonly projectStorage: ProjectStorageService) {}

  async createProject(input: CreateProjectInput): Promise<ProjectOverview> {
    const title = input.title.trim();
    const genre = input.genre?.trim() || "未分类";
    const projectId = randomUUID();
    const workId = randomUUID();
    const defaultVolumeId = randomUUID();
    const layout = this.projectStorage.createProjectLayout({ projectId });
    const projectDatabase = createProjectDatabase(layout.databasePath);

    try {
      await runProjectMigrations(projectDatabase);
      const repository = new ProjectRepository(projectDatabase);

      return repository.createProject({
        defaultVolumeId,
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

  async listRecent(input: ListRecentProjectsInput = {}): Promise<ProjectOverview[]> {
    const limit = input.limit ?? 20;
    const projects: ProjectOverview[] = [];

    for (const projectRoot of this.projectStorage.listProjectRootPaths()) {
      const databasePath = join(projectRoot, PROJECT_DATABASE_FILE);
      if (!existsSync(databasePath)) {
        continue;
      }

      const projectDatabase = createProjectDatabase(databasePath);
      try {
        const project = new ProjectRepository(projectDatabase).getFirstOverview();
        if (project) {
          projects.push(project);
        }
      } catch {
        continue;
      } finally {
        projectDatabase.close();
      }
    }

    return projects
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, limit);
  }

  async openProject(input: OpenProjectInput): Promise<ProjectOverview> {
    const databasePath = input.path
      ? join(input.path, PROJECT_DATABASE_FILE)
      : join(this.projectStorage.getProjectRootPath(requireProjectId(input)), PROJECT_DATABASE_FILE);
    const projectDatabase = createProjectDatabase(databasePath);
    await runProjectMigrations(projectDatabase);

    try {
      const repository = new ProjectRepository(projectDatabase);
      const project = input.projectId
        ? repository.touchOpenedAt(input.projectId)
        : repository.getFirstOverview();
      if (!project) {
        throw new Error(`PROJECT_NOT_FOUND: ${input.projectId ?? input.path ?? "unknown"}`);
      }

      return project;
    } finally {
      projectDatabase.close();
    }
  }

  async getOverview(projectId: string): Promise<ProjectOverview> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(projectId);
    try {
      const project = new ProjectRepository(projectDatabase).getOverview(projectId);
      if (!project) {
        throw new Error(`PROJECT_NOT_FOUND: ${projectId}`);
      }

      return project;
    } finally {
      projectDatabase.close();
    }
  }

  async backup(projectId: string): Promise<BackupProjectResult> {
    const project = await this.getOverview(projectId);
    const createdAt = Date.now();
    const backupsPath = join(project.rootPath, "backups");
    mkdirSync(backupsPath, { recursive: true });
    const backupPath = join(backupsPath, `${basename(project.rootPath)}-${createdAt}.project.sqlite`);

    copyFileSync(join(project.rootPath, PROJECT_DATABASE_FILE), backupPath);

    return {
      backupPath,
      createdAt,
      projectId,
    };
  }
}

function requireProjectId(input: OpenProjectInput): string {
  if (!input.projectId) {
    throw new Error("PROJECT_ID_REQUIRED");
  }

  return input.projectId;
}
