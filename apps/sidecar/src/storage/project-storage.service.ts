import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { Injectable } from "@nestjs/common";

export interface CreateProjectLayoutInput {
  readonly projectId: string;
}

export interface ProjectLayout {
  readonly rootPath: string;
  readonly databasePath: string;
  readonly graphPath: string;
  readonly filesPath: string;
  readonly snapshotsPath: string;
  readonly backupsPath: string;
}

@Injectable()
export class ProjectStorageService {
  createProjectLayout(input: CreateProjectLayoutInput): ProjectLayout {
    const rootPath = this.getProjectRootPath(input.projectId);
    const databasePath = join(rootPath, "project.sqlite");
    const graphPath = join(rootPath, "graph.kuzu");
    const filesPath = join(rootPath, "files");
    const snapshotsPath = join(rootPath, "snapshots");
    const backupsPath = join(rootPath, "backups");

    mkdirSync(filesPath, { recursive: true });
    mkdirSync(snapshotsPath, { recursive: true });
    mkdirSync(backupsPath, { recursive: true });
    mkdirSync(graphPath, { recursive: true });

    return {
      backupsPath,
      databasePath,
      filesPath,
      graphPath,
      rootPath,
      snapshotsPath,
    };
  }

  getProjectRootPath(projectId: string): string {
    return join(this.getProjectsRoot(), projectId);
  }

  private getProjectsRoot(): string {
    return process.env.STORY_PILOT_PROJECTS_ROOT ?? join(homedir(), ".story-pilot", "projects");
  }
}
