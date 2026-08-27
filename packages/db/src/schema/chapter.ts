import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { projects, volumes, works } from "./project.js";

export const chapters = sqliteTable(
  "chapters",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    volumeId: text("volume_id").references(() => volumes.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    status: text("status").notNull().default("draft"),
    position: integer("position").notNull(),
    synopsis: text("synopsis"),
    content: text("content").notNull().default(""),
    wordCount: integer("word_count").notNull().default(0),
    version: integer("version").notNull().default(0),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("chapters_project_id_idx").on(table.projectId),
    index("chapters_work_position_idx").on(table.workId, table.position),
    index("chapters_status_idx").on(table.status),
  ],
);

export const chapterVersions = sqliteTable(
  "chapter_versions",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    chapterId: text("chapter_id")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    source: text("source").notNull(),
    content: text("content").notNull(),
    summary: text("summary"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("chapter_versions_chapter_version_uidx").on(table.chapterId, table.version),
    index("chapter_versions_project_id_idx").on(table.projectId),
  ],
);

export const scenes = sqliteTable(
  "scenes",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    chapterId: text("chapter_id")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    position: integer("position").notNull(),
    povCharacterId: text("pov_character_id"),
    locationId: text("location_id"),
    summary: text("summary"),
    status: text("status").notNull().default("planned"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("scenes_project_id_idx").on(table.projectId),
    index("scenes_chapter_position_idx").on(table.chapterId, table.position),
  ],
);
