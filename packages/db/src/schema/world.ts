import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { projects } from "./project.js";

export const worldbuildingProfiles = sqliteTable("worldbuilding_profiles", {
  projectId: text("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  worldBase: text("world_base").notNull().default(""),
  geography: text("geography").notNull().default(""),
  history: text("history").notNull().default(""),
  powerSystem: text("power_system").notNull().default(""),
  socialStructure: text("social_structure").notNull().default(""),
  powerOrder: text("power_order").notNull().default(""),
  factions: text("factions").notNull().default(""),
  economy: text("economy").notNull().default(""),
  culture: text("culture").notNull().default(""),
  rules: text("rules").notNull().default(""),
  specialMechanism: text("special_mechanism").notNull().default(""),
  coreConflict: text("core_conflict").notNull().default(""),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const worldRules = sqliteTable(
  "world_rules",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    status: text("status").notNull().default("canon"),
    source: text("source"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("world_rules_project_id_idx").on(table.projectId),
    index("world_rules_category_idx").on(table.category),
  ],
);

export const locations = sqliteTable(
  "locations",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull().default("place"),
    description: text("description"),
    status: text("status").notNull().default("active"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("locations_project_id_idx").on(table.projectId),
    index("locations_name_idx").on(table.name),
  ],
);

export const organizations = sqliteTable(
  "organizations",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull().default("organization"),
    description: text("description"),
    status: text("status").notNull().default("active"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("organizations_project_id_idx").on(table.projectId),
    index("organizations_name_idx").on(table.name),
  ],
);

export const items = sqliteTable(
  "items",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull().default("item"),
    description: text("description"),
    ownerEntityType: text("owner_entity_type"),
    ownerEntityId: text("owner_entity_id"),
    status: text("status").notNull().default("active"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("items_project_id_idx").on(table.projectId),
    index("items_name_idx").on(table.name),
  ],
);
