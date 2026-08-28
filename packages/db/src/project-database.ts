import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import {
  CREATIVE_PATH_SCHEMA_SQL,
  INITIAL_PROJECT_SCHEMA_MIGRATION_ID,
  INITIAL_PROJECT_SCHEMA_SQL,
} from "./migrations/project-schema-v1.js";
import { projectSchema } from "./schema/index.js";

export interface ProjectDatabase {
  readonly path: string;
  readonly client: Database.Database;
  readonly db: BetterSQLite3Database<typeof projectSchema>;
  close(): void;
}

export function createProjectDatabase(path: string): ProjectDatabase {
  const client = new Database(path);
  client.pragma("foreign_keys = ON");

  return {
    path,
    client,
    db: drizzle({ client, schema: projectSchema }),
    close: () => client.close(),
  };
}

export async function runProjectMigrations(projectDatabase: ProjectDatabase): Promise<void> {
  const migrate = projectDatabase.client.transaction(() => {
    projectDatabase.client.exec(`
      create table if not exists __story_pilot_migrations (
        id text primary key,
        applied_at integer not null
      );
    `);

    const existingMigration = projectDatabase.client
      .prepare("select id from __story_pilot_migrations where id = ?")
      .get(INITIAL_PROJECT_SCHEMA_MIGRATION_ID);

    if (existingMigration) {
      return;
    }

    projectDatabase.client.exec(INITIAL_PROJECT_SCHEMA_SQL);
    projectDatabase.client
      .prepare("insert into __story_pilot_migrations (id, applied_at) values (?, ?)")
      .run(INITIAL_PROJECT_SCHEMA_MIGRATION_ID, Date.now());
  });

  migrate();
  ensureProjectSchemaCompatibility(projectDatabase);
}

function ensureProjectSchemaCompatibility(projectDatabase: ProjectDatabase): void {
  ensureTableColumn(projectDatabase, "projects", "style", "style text");
  ensureTableColumn(projectDatabase, "works", "style", "style text");
  ensureTableColumn(projectDatabase, "chapter_versions", "artifact_id", "artifact_id text");
  projectDatabase.client.exec(CREATIVE_PATH_SCHEMA_SQL);
}

function ensureTableColumn(
  projectDatabase: ProjectDatabase,
  tableName: string,
  columnName: string,
  columnDefinition: string,
): void {
  const columns = projectDatabase.client
    .prepare(`pragma table_info(${tableName})`)
    .all()
    .map((row) => (row as { name: string }).name);

  if (!columns.includes(columnName)) {
    projectDatabase.client.exec(`alter table ${tableName} add column ${columnDefinition}`);
  }
}
