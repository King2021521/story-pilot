import { randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { basename, join, resolve, sep } from "node:path";

import { Injectable } from "@nestjs/common";
import {
  createProjectDatabase,
  CreativePathRepository,
  DomainEventRepository,
  PROJECT_DATABASE_FILE,
  ProjectRepository,
  runProjectMigrations,
  type ProjectOverviewRecord,
} from "@story-pilot/db";

import { ProjectStorageService } from "../storage/project-storage.service.js";

export interface CreateProjectInput {
  readonly title: string;
  readonly genre?: string;
  readonly style?: string;
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

export interface RestoreProjectBackupInput {
  readonly projectId: string;
  readonly backupPath: string;
}

export interface RestoreProjectBackupResult {
  readonly restoredProjectId: string;
  readonly restoredAt: number;
  readonly backupPath: string;
  readonly safetyBackupPath: string;
}

@Injectable()
export class ProjectService {
  constructor(private readonly projectStorage: ProjectStorageService) {}

  async createProject(input: CreateProjectInput): Promise<ProjectOverview> {
    const title = input.title.trim();
    const genre = input.genre?.trim() || "未分类";
    const style = input.style?.trim();
    const projectId = randomUUID();
    const workId = randomUUID();
    const defaultVolumeId = randomUUID();
    const layout = this.projectStorage.createProjectLayout({ projectId });
    const projectDatabase = createProjectDatabase(layout.databasePath);

    try {
      await runProjectMigrations(projectDatabase);
      const repository = new ProjectRepository(projectDatabase);

      const project = repository.createProject({
        defaultVolumeId,
        genre,
        projectId,
        rootPath: layout.rootPath,
        title,
        workId,
        ...(style === undefined || style.length === 0 ? {} : { style }),
        ...(input.logline === undefined ? {} : { logline: input.logline }),
        ...(input.wordCountGoal === undefined ? {} : { wordCountGoal: input.wordCountGoal }),
      });
      const now = Date.now();
      const creativePathRepository = new CreativePathRepository(projectDatabase);
      const stages = creativePathRepository.initializePath(project.id, now);
      const brief = creativePathRepository.saveBrief({
        briefId: randomUUID(),
        genre,
        projectId: project.id,
        subgenres: [],
        now,
        ...(input.logline === undefined ? {} : { initialIdea: input.logline }),
      });
      const domainEventRepository = new DomainEventRepository(projectDatabase);
      domainEventRepository.append({
        aggregateId: project.id,
        aggregateType: "creative_path",
        eventId: randomUUID(),
        eventType: "creative_stage.initialized",
        payload: { stageKeys: stages.map((stage) => stage.stageKey) },
        projectId: project.id,
        now,
      });
      domainEventRepository.append({
        aggregateId: brief.id,
        aggregateType: "project_brief",
        eventId: randomUUID(),
        eventType: "project_brief.saved",
        payload: { genre: brief.genre, status: brief.status, version: brief.version },
        projectId: project.id,
        now,
      });
      await this.projectStorage.upsertProjectIndex(project);

      return project;
    } finally {
      projectDatabase.close();
    }
  }

  async listRecent(input: ListRecentProjectsInput = {}): Promise<ProjectOverview[]> {
    const limit = input.limit ?? 20;
    await this.syncProjectIndexFromProjectRoots();

    return (await this.projectStorage.listProjectIndex({ limit }))
      .filter((project) => this.projectStorage.projectDatabaseExists(project.id))
      .map((project) => ({
        createdAt: project.createdAt,
        defaultVolumeId: project.defaultVolumeId,
        genre: project.genre,
        id: project.id,
        rootPath: project.rootPath,
        status: project.status,
        style: null,
        title: project.title,
        updatedAt: project.updatedAt,
        workId: project.workId,
      }));
  }

  async syncProjectIndexFromProjectRoots(): Promise<void> {
    for (const projectRoot of this.projectStorage.listProjectRootPaths()) {
      const databasePath = join(projectRoot, PROJECT_DATABASE_FILE);
      if (!existsSync(databasePath)) {
        continue;
      }

      const projectDatabase = createProjectDatabase(databasePath);
      try {
        const project = new ProjectRepository(projectDatabase).getFirstOverview();
        if (project) {
          await this.projectStorage.upsertProjectIndex(project);
        }
      } catch {
        continue;
      } finally {
        projectDatabase.close();
      }
    }
  }

  async openProject(input: OpenProjectInput): Promise<ProjectOverview> {
    const databasePath = input.path
      ? join(input.path, PROJECT_DATABASE_FILE)
      : join(
          this.projectStorage.getProjectRootPath(requireProjectId(input)),
          PROJECT_DATABASE_FILE,
        );
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

      await this.projectStorage.touchProjectIndex(project);

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
    const backupPath = join(
      backupsPath,
      `${basename(project.rootPath)}-${createdAt}.project.sqlite`,
    );

    copyFileSync(join(project.rootPath, PROJECT_DATABASE_FILE), backupPath);

    return {
      backupPath,
      createdAt,
      projectId,
    };
  }

  async restoreBackup(input: RestoreProjectBackupInput): Promise<RestoreProjectBackupResult> {
    const project = await this.getOverview(input.projectId);
    const restoredAt = Date.now();
    const backupsPath = resolve(join(project.rootPath, "backups"));
    const backupPath = resolve(input.backupPath);
    if (!backupPath.startsWith(`${backupsPath}${sep}`)) {
      throw new Error(`FILE_OUT_OF_SCOPE: ${input.backupPath}`);
    }
    if (!existsSync(backupPath)) {
      throw new Error(`BACKUP_NOT_FOUND: ${input.backupPath}`);
    }

    mkdirSync(backupsPath, { recursive: true });
    const databasePath = join(project.rootPath, PROJECT_DATABASE_FILE);
    const safetyBackupPath = join(
      backupsPath,
      `${basename(project.rootPath)}-${restoredAt}.pre-restore.project.sqlite`,
    );
    copyFileSync(databasePath, safetyBackupPath);
    copyFileSync(backupPath, databasePath);

    const projectDatabase = createProjectDatabase(databasePath);
    try {
      await runProjectMigrations(projectDatabase);
      const restoredProject = new ProjectRepository(projectDatabase).getFirstOverview();
      if (!restoredProject || restoredProject.id !== input.projectId) {
        throw new Error(`BACKUP_PROJECT_MISMATCH: ${input.projectId}`);
      }
      await this.projectStorage.upsertProjectIndex(restoredProject);
    } finally {
      projectDatabase.close();
    }

    return {
      backupPath,
      restoredAt,
      restoredProjectId: input.projectId,
      safetyBackupPath,
    };
  }
}

function requireProjectId(input: OpenProjectInput): string {
  if (!input.projectId) {
    throw new Error("PROJECT_ID_REQUIRED");
  }

  return input.projectId;
}
