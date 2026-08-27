import type { ProjectDatabase } from "../project-database.js";

export interface CreateProjectRecordInput {
  readonly projectId: string;
  readonly workId: string;
  readonly defaultVolumeId: string;
  readonly title: string;
  readonly genre: string;
  readonly rootPath: string;
  readonly logline?: string;
  readonly wordCountGoal?: number;
  readonly now?: number;
}

export interface ProjectOverviewRecord {
  readonly id: string;
  readonly workId: string;
  readonly defaultVolumeId: string;
  readonly title: string;
  readonly genre: string;
  readonly status: string;
  readonly rootPath: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export class ProjectRepository {
  constructor(private readonly projectDatabase: ProjectDatabase) {}

  createProject(input: CreateProjectRecordInput): ProjectOverviewRecord {
    const now = input.now ?? Date.now();

    const insertProject = this.projectDatabase.client.prepare(`
      insert into projects (id, title, genre, status, root_path, created_at, updated_at, opened_at)
      values (@projectId, @title, @genre, 'planning', @rootPath, @now, @now, @now)
    `);
    const insertWork = this.projectDatabase.client.prepare(`
      insert into works (id, project_id, title, genre, target_length, status, logline, created_at, updated_at)
      values (@workId, @projectId, @title, @genre, @wordCountGoal, 'planning', @logline, @now, @now)
    `);
    const insertDefaultVolume = this.projectDatabase.client.prepare(`
      insert into volumes (id, project_id, work_id, title, position, created_at, updated_at)
      values (@defaultVolumeId, @projectId, @workId, '第一卷', 1, @now, @now)
    `);

    const createRecords = this.projectDatabase.client.transaction(() => {
      insertProject.run({
        genre: input.genre,
        now,
        projectId: input.projectId,
        rootPath: input.rootPath,
        title: input.title,
      });
      insertWork.run({
        genre: input.genre,
        logline: input.logline ?? null,
        now,
        projectId: input.projectId,
        title: input.title,
        wordCountGoal: input.wordCountGoal ?? null,
        workId: input.workId,
      });
      insertDefaultVolume.run({
        defaultVolumeId: input.defaultVolumeId,
        now,
        projectId: input.projectId,
        workId: input.workId,
      });
    });

    createRecords();

    return {
      createdAt: now,
      defaultVolumeId: input.defaultVolumeId,
      genre: input.genre,
      id: input.projectId,
      rootPath: input.rootPath,
      status: "planning",
      title: input.title,
      updatedAt: now,
      workId: input.workId,
    };
  }
}
