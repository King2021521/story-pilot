import type { ProjectDatabase } from "../project-database.js";

export interface CreateProjectRecordInput {
  readonly projectId: string;
  readonly workId: string;
  readonly defaultVolumeId: string;
  readonly title: string;
  readonly genre: string;
  readonly style?: string;
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
  readonly style: string | null;
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
      insert into projects (id, title, genre, style, status, root_path, created_at, updated_at, opened_at)
      values (@projectId, @title, @genre, @style, 'planning', @rootPath, @now, @now, @now)
    `);
    const insertWork = this.projectDatabase.client.prepare(`
      insert into works (id, project_id, title, genre, style, target_length, status, logline, created_at, updated_at)
      values (@workId, @projectId, @title, @genre, @style, @wordCountGoal, 'planning', @logline, @now, @now)
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
        style: input.style ?? null,
        title: input.title,
      });
      insertWork.run({
        genre: input.genre,
        logline: input.logline ?? null,
        now,
        projectId: input.projectId,
        style: input.style ?? null,
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
      style: input.style ?? null,
      title: input.title,
      updatedAt: now,
      workId: input.workId,
    };
  }

  getOverview(projectId: string): ProjectOverviewRecord | undefined {
    const row = this.projectDatabase.client
      .prepare(
        `
        select
          p.id,
          p.title,
          p.genre,
          p.style,
          p.status,
          p.root_path,
          p.created_at,
          p.updated_at,
          w.id as work_id,
          v.id as default_volume_id
        from projects p
        left join works w on w.project_id = p.id
        left join volumes v on v.project_id = p.id and v.work_id = w.id
        where p.id = ?
        order by w.created_at asc, v.position asc
        limit 1
        `,
      )
      .get(projectId) as ProjectOverviewRow | undefined;

    return row ? mapProjectOverviewRow(row) : undefined;
  }

  getFirstOverview(): ProjectOverviewRecord | undefined {
    const row = this.projectDatabase.client
      .prepare(
        `
        select
          p.id,
          p.title,
          p.genre,
          p.style,
          p.status,
          p.root_path,
          p.created_at,
          p.updated_at,
          w.id as work_id,
          v.id as default_volume_id
        from projects p
        left join works w on w.project_id = p.id
        left join volumes v on v.project_id = p.id and v.work_id = w.id
        order by coalesce(p.opened_at, 0) desc, p.updated_at desc
        limit 1
        `,
      )
      .get() as ProjectOverviewRow | undefined;

    return row ? mapProjectOverviewRow(row) : undefined;
  }

  touchOpenedAt(projectId: string, openedAt = Date.now()): ProjectOverviewRecord {
    this.projectDatabase.client
      .prepare("update projects set opened_at = ?, updated_at = ? where id = ?")
      .run(openedAt, openedAt, projectId);

    const overview = this.getOverview(projectId);
    if (!overview) {
      throw new Error(`PROJECT_NOT_FOUND: ${projectId}`);
    }

    return overview;
  }
}

interface ProjectOverviewRow {
  readonly id: string;
  readonly title: string;
  readonly genre: string;
  readonly style: string | null;
  readonly status: string;
  readonly root_path: string;
  readonly created_at: number;
  readonly updated_at: number;
  readonly work_id: string | null;
  readonly default_volume_id: string | null;
}

function mapProjectOverviewRow(row: ProjectOverviewRow): ProjectOverviewRecord {
  if (!row.work_id || !row.default_volume_id) {
    throw new Error(`PROJECT_OVERVIEW_INCOMPLETE: ${row.id}`);
  }

  return {
    createdAt: row.created_at,
    defaultVolumeId: row.default_volume_id,
    genre: row.genre,
    id: row.id,
    rootPath: row.root_path,
    status: row.status,
    style: row.style,
    title: row.title,
    updatedAt: row.updated_at,
    workId: row.work_id,
  };
}
