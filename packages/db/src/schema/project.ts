import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    genre: text("genre").notNull(),
    status: text("status").notNull().default("planning"),
    summary: text("summary"),
    rootPath: text("root_path").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    openedAt: integer("opened_at"),
  },
  (table) => [
    index("projects_status_idx").on(table.status),
    index("projects_opened_at_idx").on(table.openedAt),
  ],
);

export const works = sqliteTable(
  "works",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    genre: text("genre").notNull(),
    targetLength: integer("target_length"),
    status: text("status").notNull().default("planning"),
    logline: text("logline"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("works_project_id_idx").on(table.projectId),
    index("works_status_idx").on(table.status),
  ],
);

export const volumes = sqliteTable(
  "volumes",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    position: integer("position").notNull(),
    summary: text("summary"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("volumes_project_id_idx").on(table.projectId),
    index("volumes_work_position_idx").on(table.workId, table.position),
  ],
);

export const files = sqliteTable(
  "files",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    relativePath: text("relative_path").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    checksum: text("checksum"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("files_project_id_idx").on(table.projectId),
    index("files_role_idx").on(table.role),
  ],
);
