import type { GlobalDatabase } from "../global-database.js";

export interface GlobalProjectIndexInput {
  readonly projectId: string;
  readonly workId: string;
  readonly defaultVolumeId: string;
  readonly title: string;
  readonly genre: string;
  readonly status: string;
  readonly rootPath: string;
  readonly databasePath: string;
  readonly graphPath: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly openedAt?: number | null;
  readonly indexedAt?: number;
}

export interface GlobalProjectIndexListInput {
  readonly limit?: number;
}

export interface GlobalProjectIndexRecord {
  readonly id: string;
  readonly workId: string;
  readonly defaultVolumeId: string;
  readonly title: string;
  readonly genre: string;
  readonly status: string;
  readonly rootPath: string;
  readonly databasePath: string;
  readonly graphPath: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly openedAt: number | null;
  readonly indexedAt: number;
}

interface GlobalProjectIndexRow {
  readonly project_id: string;
  readonly work_id: string;
  readonly default_volume_id: string;
  readonly title: string;
  readonly genre: string;
  readonly status: string;
  readonly root_path: string;
  readonly database_path: string;
  readonly graph_path: string;
  readonly created_at: number;
  readonly updated_at: number;
  readonly opened_at: number | null;
  readonly indexed_at: number;
}

export class GlobalProjectIndexRepository {
  constructor(private readonly globalDatabase: GlobalDatabase) {}

  upsertProject(input: GlobalProjectIndexInput): GlobalProjectIndexRecord {
    const indexedAt = input.indexedAt ?? Date.now();
    this.globalDatabase.client
      .prepare(
        `
        insert into project_index (
          project_id, work_id, default_volume_id, title, genre, status,
          root_path, database_path, graph_path, created_at, updated_at, opened_at, indexed_at
        )
        values (
          @projectId, @workId, @defaultVolumeId, @title, @genre, @status,
          @rootPath, @databasePath, @graphPath, @createdAt, @updatedAt, @openedAt, @indexedAt
        )
        on conflict(project_id) do update set
          work_id = excluded.work_id,
          default_volume_id = excluded.default_volume_id,
          title = excluded.title,
          genre = excluded.genre,
          status = excluded.status,
          root_path = excluded.root_path,
          database_path = excluded.database_path,
          graph_path = excluded.graph_path,
          updated_at = max(project_index.updated_at, excluded.updated_at),
          opened_at = case
            when excluded.opened_at is null then project_index.opened_at
            when project_index.opened_at is null then excluded.opened_at
            else max(project_index.opened_at, excluded.opened_at)
          end,
          indexed_at = excluded.indexed_at
        `,
      )
      .run({
        createdAt: input.createdAt,
        databasePath: input.databasePath,
        defaultVolumeId: input.defaultVolumeId,
        genre: input.genre,
        graphPath: input.graphPath,
        indexedAt,
        openedAt: input.openedAt ?? null,
        projectId: input.projectId,
        rootPath: input.rootPath,
        status: input.status,
        title: input.title,
        updatedAt: input.updatedAt,
        workId: input.workId,
      });

    const record = this.getById(input.projectId);
    if (!record) {
      throw new Error(`PROJECT_INDEX_NOT_CREATED: ${input.projectId}`);
    }

    return record;
  }

  touchOpenedAt(projectId: string, openedAt = Date.now()): GlobalProjectIndexRecord {
    this.globalDatabase.client
      .prepare(
        `
        update project_index
        set opened_at = @openedAt, updated_at = max(updated_at, @openedAt), indexed_at = @openedAt
        where project_id = @projectId
        `,
      )
      .run({ openedAt, projectId });

    const record = this.getById(projectId);
    if (!record) {
      throw new Error(`PROJECT_INDEX_NOT_FOUND: ${projectId}`);
    }

    return record;
  }

  listRecent(input: GlobalProjectIndexListInput = {}): GlobalProjectIndexRecord[] {
    const limit = input.limit ?? 20;
    const rows = this.globalDatabase.client
      .prepare(
        `
        select *
        from project_index
        order by coalesce(opened_at, 0) desc, updated_at desc, created_at desc
        limit ?
        `,
      )
      .all(limit) as GlobalProjectIndexRow[];

    return rows.map(mapGlobalProjectIndexRow);
  }

  getById(projectId: string): GlobalProjectIndexRecord | undefined {
    const row = this.globalDatabase.client
      .prepare("select * from project_index where project_id = ?")
      .get(projectId) as GlobalProjectIndexRow | undefined;

    return row ? mapGlobalProjectIndexRow(row) : undefined;
  }

  getByRootPath(rootPath: string): GlobalProjectIndexRecord | undefined {
    const row = this.globalDatabase.client
      .prepare("select * from project_index where root_path = ?")
      .get(rootPath) as GlobalProjectIndexRow | undefined;

    return row ? mapGlobalProjectIndexRow(row) : undefined;
  }
}

function mapGlobalProjectIndexRow(row: GlobalProjectIndexRow): GlobalProjectIndexRecord {
  return {
    createdAt: row.created_at,
    databasePath: row.database_path,
    defaultVolumeId: row.default_volume_id,
    genre: row.genre,
    graphPath: row.graph_path,
    id: row.project_id,
    indexedAt: row.indexed_at,
    openedAt: row.opened_at,
    rootPath: row.root_path,
    status: row.status,
    title: row.title,
    updatedAt: row.updated_at,
    workId: row.work_id,
  };
}
