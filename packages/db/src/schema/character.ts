import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { projects } from "./project.js";

export const characters = sqliteTable(
  "characters",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    role: text("role").notNull().default("supporting"),
    archetype: text("archetype"),
    status: text("status").notNull().default("active"),
    profile: text("profile"),
    appearance: text("appearance"),
    motivation: text("motivation"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("characters_project_id_idx").on(table.projectId),
    index("characters_display_name_idx").on(table.displayName),
  ],
);

export const characterTraits = sqliteTable(
  "character_traits",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    value: text("value").notNull(),
    evidence: text("evidence"),
    confidence: real("confidence").notNull().default(1),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("character_traits_project_id_idx").on(table.projectId),
    index("character_traits_character_id_idx").on(table.characterId),
  ],
);

export const entityRelations = sqliteTable(
  "entity_relations",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sourceEntityType: text("source_entity_type").notNull(),
    sourceEntityId: text("source_entity_id").notNull(),
    relationType: text("relation_type").notNull(),
    targetEntityType: text("target_entity_type").notNull(),
    targetEntityId: text("target_entity_id").notNull(),
    description: text("description"),
    polarity: integer("polarity").notNull().default(0),
    strength: real("strength").notNull().default(0.5),
    status: text("status").notNull().default("confirmed"),
    evidence: text("evidence"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("entity_relations_project_id_idx").on(table.projectId),
    index("entity_relations_source_idx").on(table.sourceEntityType, table.sourceEntityId),
    index("entity_relations_target_idx").on(table.targetEntityType, table.targetEntityId),
  ],
);
