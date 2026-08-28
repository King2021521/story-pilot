import { existsSync, mkdirSync, readdirSync, renameSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { Injectable } from "@nestjs/common";
import {
  createGlobalDatabase,
  createProjectDatabase,
  GLOBAL_DATABASE_FILE,
  GlobalProjectIndexRepository,
  PROJECT_DATABASE_FILE,
  runGlobalMigrations,
  runProjectMigrations,
  type GlobalDatabase,
  type GlobalProjectIndexRecord,
  type ProjectDatabase,
  type ProjectOverviewRecord,
} from "@story-pilot/db";

import {
  resolveRuntimeGlobalDatabasePath,
  resolveRuntimeProjectsRoot,
  STORY_PILOT_GLOBAL_DATABASE_PATH_ENV,
  STORY_PILOT_HOME_ENV,
  STORY_PILOT_PROJECTS_ROOT_ENV,
} from "../config/runtime-settings.js";

export interface CreateProjectLayoutInput {
  readonly projectId: string;
}

export interface ProjectLayout {
  readonly rootPath: string;
  readonly databasePath: string;
  readonly graphPath: string;
  readonly exportsPath: string;
  readonly artifactsPath: string;
  readonly attachmentsPath: string;
  readonly backupsPath: string;
}

@Injectable()
export class ProjectStorageService {
  createProjectLayout(input: CreateProjectLayoutInput): ProjectLayout {
    const rootPath = this.getProjectRootPath(input.projectId);
    const databasePath = join(rootPath, "project.sqlite");
    const graphPath = join(rootPath, "graph.kuzu");
    const exportsPath = join(rootPath, "exports");
    const artifactsPath = join(rootPath, "artifacts");
    const attachmentsPath = join(rootPath, "attachments");
    const backupsPath = join(rootPath, "backups");

    mkdirSync(exportsPath, { recursive: true });
    mkdirSync(artifactsPath, { recursive: true });
    mkdirSync(attachmentsPath, { recursive: true });
    mkdirSync(backupsPath, { recursive: true });
    mkdirSync(graphPath, { recursive: true });

    return {
      artifactsPath,
      attachmentsPath,
      backupsPath,
      databasePath,
      exportsPath,
      graphPath,
      rootPath,
    };
  }

  getProjectRootPath(projectId: string): string {
    return join(this.getProjectsRoot(), projectId);
  }

  getProjectsRootPath(): string {
    return this.getProjectsRoot();
  }

  getGlobalDatabasePath(): string {
    return this.resolveGlobalDatabasePath();
  }

  listProjectRootPaths(): string[] {
    const projectsRoot = this.ensureProjectsRoot();
    try {
      return readdirSync(projectsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(projectsRoot, entry.name))
        .filter((projectRoot) => statSync(projectRoot).isDirectory());
    } catch {
      return [];
    }
  }

  getGraphPath(projectId: string): string {
    return join(this.getProjectRootPath(projectId), "graph.kuzu");
  }

  async openGlobalDatabase(): Promise<GlobalDatabase> {
    const globalDatabasePath = this.ensureGlobalDatabasePath();
    const globalDatabase = createGlobalDatabase(globalDatabasePath);
    await runGlobalMigrations(globalDatabase);
    return globalDatabase;
  }

  async upsertProjectIndex(project: ProjectOverviewRecord): Promise<GlobalProjectIndexRecord> {
    const globalDatabase = await this.openGlobalDatabase();
    try {
      return new GlobalProjectIndexRepository(globalDatabase).upsertProject({
        createdAt: project.createdAt,
        databasePath: join(project.rootPath, PROJECT_DATABASE_FILE),
        defaultVolumeId: project.defaultVolumeId,
        genre: project.genre,
        graphPath: join(project.rootPath, "graph.kuzu"),
        openedAt: project.updatedAt,
        projectId: project.id,
        rootPath: project.rootPath,
        status: project.status,
        title: project.title,
        updatedAt: project.updatedAt,
        workId: project.workId,
      });
    } finally {
      globalDatabase.close();
    }
  }

  async touchProjectIndex(project: ProjectOverviewRecord): Promise<GlobalProjectIndexRecord> {
    const indexed = await this.upsertProjectIndex(project);
    const globalDatabase = await this.openGlobalDatabase();
    try {
      return new GlobalProjectIndexRepository(globalDatabase).touchOpenedAt(
        project.id,
        Math.max(Date.now(), indexed.openedAt ?? 0, indexed.updatedAt) + 1,
      );
    } finally {
      globalDatabase.close();
    }
  }

  async listProjectIndex(
    input: { readonly limit?: number } = {},
  ): Promise<GlobalProjectIndexRecord[]> {
    const globalDatabase = await this.openGlobalDatabase();
    try {
      return new GlobalProjectIndexRepository(globalDatabase).listRecent(input);
    } finally {
      globalDatabase.close();
    }
  }

  async openProjectDatabase(projectId: string): Promise<ProjectDatabase> {
    const projectDatabase = createProjectDatabase(
      join(this.getProjectRootPath(projectId), PROJECT_DATABASE_FILE),
    );
    await runProjectMigrations(projectDatabase);
    return projectDatabase;
  }

  projectDatabaseExists(projectId: string): boolean {
    return existsSync(join(this.getProjectRootPath(projectId), PROJECT_DATABASE_FILE));
  }

  private getProjectsRoot(): string {
    return resolveRuntimeProjectsRoot(process.env);
  }

  private ensureProjectsRoot(): string {
    const projectsRoot = this.getProjectsRoot();
    mkdirSync(projectsRoot, { recursive: true });
    return projectsRoot;
  }

  private resolveGlobalDatabasePath(): string {
    if (process.env[STORY_PILOT_GLOBAL_DATABASE_PATH_ENV] || process.env[STORY_PILOT_HOME_ENV]) {
      return resolveRuntimeGlobalDatabasePath(process.env);
    }

    if (process.env[STORY_PILOT_PROJECTS_ROOT_ENV]) {
      return join(this.ensureProjectsRoot(), GLOBAL_DATABASE_FILE);
    }

    return resolveRuntimeGlobalDatabasePath(process.env);
  }

  private ensureGlobalDatabasePath(): string {
    const globalDatabasePath = this.resolveGlobalDatabasePath();
    mkdirSync(dirname(globalDatabasePath), { recursive: true });
    this.migrateLegacyGlobalDatabase(globalDatabasePath);
    return globalDatabasePath;
  }

  private migrateLegacyGlobalDatabase(globalDatabasePath: string): void {
    const legacyGlobalDatabasePath = join(this.ensureProjectsRoot(), GLOBAL_DATABASE_FILE);
    if (resolve(legacyGlobalDatabasePath) === resolve(globalDatabasePath)) {
      return;
    }
    if (existsSync(globalDatabasePath) || !existsSync(legacyGlobalDatabasePath)) {
      return;
    }

    renameSync(legacyGlobalDatabasePath, globalDatabasePath);
  }
}
