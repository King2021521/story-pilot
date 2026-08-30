import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import {
  CREATIVE_PATH_SCHEMA_SQL,
  INITIAL_PROJECT_SCHEMA_MIGRATION_ID,
  INITIAL_PROJECT_SCHEMA_SQL,
  WORLDBUILDING_PROFILE_SCHEMA_SQL,
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
  ensureTableColumn(projectDatabase, "memories", "scope", "scope text not null default 'project'");
  ensureTableColumn(
    projectDatabase,
    "memories",
    "valid_from_chapter_index",
    "valid_from_chapter_index integer",
  );
  ensureTableColumn(
    projectDatabase,
    "memories",
    "valid_to_chapter_index",
    "valid_to_chapter_index integer",
  );
  ensureTableColumn(projectDatabase, "memories", "source_type", "source_type text");
  ensureTableColumn(projectDatabase, "memories", "source_id", "source_id text");
  ensureTableColumn(projectDatabase, "memories", "source_quote", "source_quote text");
  ensureTableColumn(
    projectDatabase,
    "memories",
    "evidence_json",
    "evidence_json text not null default '{}'",
  );
  ensureTableColumn(
    projectDatabase,
    "memories",
    "supersedes_memory_id",
    "supersedes_memory_id text",
  );
  ensureTableColumn(
    projectDatabase,
    "memories",
    "contradiction_group_id",
    "contradiction_group_id text",
  );
  ensureTableColumn(projectDatabase, "memories", "embedding_ref", "embedding_ref text");
  ensureTableColumn(projectDatabase, "characters", "gender_age", "gender_age text");
  ensureTableColumn(projectDatabase, "characters", "importance", "importance text");
  ensureTableColumn(projectDatabase, "characters", "first_appearance", "first_appearance text");
  ensureTableColumn(projectDatabase, "characters", "narrative_function", "narrative_function text");
  ensureTableColumn(projectDatabase, "characters", "story_task", "story_task text");
  ensureTableColumn(projectDatabase, "characters", "relationship_hook", "relationship_hook text");
  ensureTableColumn(projectDatabase, "characters", "appearance", "appearance text");
  ensureTableColumn(projectDatabase, "characters", "arc_start", "arc_start text");
  ensureTableColumn(projectDatabase, "characters", "arc_turn", "arc_turn text");
  ensureTableColumn(projectDatabase, "characters", "arc_end", "arc_end text");
  ensureTableColumn(
    projectDatabase,
    "story_blueprints",
    "main_goal",
    "main_goal text not null default ''",
  );
  ensureTableColumn(
    projectDatabase,
    "story_blueprints",
    "stakes",
    "stakes text not null default ''",
  );
  ensureTableColumn(
    projectDatabase,
    "story_blueprints",
    "story_driver",
    "story_driver text not null default 'growth_reversal'",
  );
  ensureTableColumn(
    projectDatabase,
    "story_blueprints",
    "emotional_axes_json",
    "emotional_axes_json text not null default '[]'",
  );
  ensureTableColumn(
    projectDatabase,
    "project_briefs",
    "estimated_word_count",
    "estimated_word_count integer",
  );
  ensureTableColumn(
    projectDatabase,
    "project_briefs",
    "estimated_chapter_count",
    "estimated_chapter_count integer",
  );
  ensureTableColumn(
    projectDatabase,
    "plotlines",
    "narrative_role",
    "narrative_role text not null default 'main_drive'",
  );
  ensureTableColumn(
    projectDatabase,
    "plotlines",
    "importance",
    "importance text not null default 'major'",
  );
  ensureTableColumn(projectDatabase, "plotlines", "central_question", "central_question text");
  ensureTableColumn(projectDatabase, "plotlines", "driver", "driver text");
  ensureTableColumn(projectDatabase, "plotlines", "start_state", "start_state text");
  ensureTableColumn(projectDatabase, "plotlines", "mid_escalation", "mid_escalation text");
  ensureTableColumn(projectDatabase, "plotlines", "payoff_plan", "payoff_plan text");
  ensureTableColumn(projectDatabase, "plotlines", "emotional_promise", "emotional_promise text");
  ensureTableColumn(
    projectDatabase,
    "plotlines",
    "related_character_ids_json",
    "related_character_ids_json text not null default '[]'",
  );
  ensureTableColumn(
    projectDatabase,
    "plotlines",
    "related_world_rule_ids_json",
    "related_world_rule_ids_json text not null default '[]'",
  );
  ensureTableColumn(
    projectDatabase,
    "plotlines",
    "related_foreshadowing_ids_json",
    "related_foreshadowing_ids_json text not null default '[]'",
  );
  ensureTableColumn(
    projectDatabase,
    "plotlines",
    "related_story_event_ids_json",
    "related_story_event_ids_json text not null default '[]'",
  );
  ensureTableColumn(projectDatabase, "plotline_nodes", "chapter_hint", "chapter_hint text");
  ensureTableColumn(projectDatabase, "story_events", "outcome", "outcome text");
  ensureTableColumn(
    projectDatabase,
    "foreshadowings",
    "importance",
    "importance integer not null default 3",
  );
  projectDatabase.client.exec(CREATIVE_PATH_SCHEMA_SQL);
  projectDatabase.client.exec(WORLDBUILDING_PROFILE_SCHEMA_SQL);
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
