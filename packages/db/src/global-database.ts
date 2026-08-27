import Database from "better-sqlite3";

export interface GlobalDatabase {
  readonly path: string;
  readonly client: Database.Database;
  close(): void;
}

export const INITIAL_GLOBAL_SCHEMA_MIGRATION_ID = "global-schema-v1";

export function createGlobalDatabase(path: string): GlobalDatabase {
  const client = new Database(path);
  client.pragma("foreign_keys = ON");

  return {
    path,
    client,
    close: () => client.close(),
  };
}

export async function runGlobalMigrations(globalDatabase: GlobalDatabase): Promise<void> {
  const migrate = globalDatabase.client.transaction(() => {
    globalDatabase.client.exec(`
      create table if not exists __story_pilot_global_migrations (
        id text primary key,
        applied_at integer not null
      );
    `);

    const existingMigration = globalDatabase.client
      .prepare("select id from __story_pilot_global_migrations where id = ?")
      .get(INITIAL_GLOBAL_SCHEMA_MIGRATION_ID);

    if (existingMigration) {
      return;
    }

    globalDatabase.client.exec(`
      create table if not exists project_index (
        project_id text primary key,
        work_id text not null,
        default_volume_id text not null,
        title text not null,
        genre text not null,
        status text not null,
        root_path text not null unique,
        database_path text not null,
        graph_path text not null,
        created_at integer not null,
        updated_at integer not null,
        opened_at integer,
        indexed_at integer not null
      );

      create index if not exists project_index_opened_at_idx
        on project_index(opened_at);
      create index if not exists project_index_updated_at_idx
        on project_index(updated_at);
      create index if not exists project_index_root_path_idx
        on project_index(root_path);
    `);
    globalDatabase.client
      .prepare("insert into __story_pilot_global_migrations (id, applied_at) values (?, ?)")
      .run(INITIAL_GLOBAL_SCHEMA_MIGRATION_ID, Date.now());
  });

  migrate();
}
