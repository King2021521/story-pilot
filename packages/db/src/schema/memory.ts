import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { projects } from "./project.js";
import { modelCalls } from "./workflow.js";

export const memoryCandidates = sqliteTable(
  "memory_candidates",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    kind: text("kind").notNull(),
    content: text("content").notNull(),
    confidence: real("confidence").notNull().default(0.5),
    status: text("status").notNull().default("pending"),
    proposedRelations: text("proposed_relations"),
    modelCallId: text("model_call_id").references(() => modelCalls.id, { onDelete: "set null" }),
    createdAt: integer("created_at").notNull(),
    resolvedAt: integer("resolved_at"),
  },
  (table) => [
    index("memory_candidates_project_id_idx").on(table.projectId),
    index("memory_candidates_status_idx").on(table.status),
    index("memory_candidates_entity_idx").on(table.entityType, table.entityId),
  ],
);

export const memories = sqliteTable(
  "memories",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    kind: text("kind").notNull(),
    content: text("content").notNull(),
    sourceCandidateId: text("source_candidate_id").references(() => memoryCandidates.id, {
      onDelete: "set null",
    }),
    confidence: real("confidence").notNull().default(1),
    status: text("status").notNull().default("canon"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("memories_project_id_idx").on(table.projectId),
    index("memories_entity_idx").on(table.entityType, table.entityId),
    index("memories_kind_idx").on(table.kind),
  ],
);

export const contextPackages = sqliteTable(
  "context_packages",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    purpose: text("purpose").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    inputHash: text("input_hash").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("context_packages_project_id_idx").on(table.projectId),
    index("context_packages_target_idx").on(table.targetType, table.targetId),
  ],
);

export const contextPackageItems = sqliteTable(
  "context_package_items",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    contextPackageId: text("context_package_id")
      .notNull()
      .references(() => contextPackages.id, { onDelete: "cascade" }),
    itemType: text("item_type").notNull(),
    itemId: text("item_id").notNull(),
    rank: integer("rank").notNull().default(0),
    content: text("content").notNull(),
    metadata: text("metadata"),
  },
  (table) => [
    index("context_package_items_project_id_idx").on(table.projectId),
    index("context_package_items_package_id_idx").on(table.contextPackageId),
  ],
);

export const projectionCheckpoints = sqliteTable(
  "projection_checkpoints",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    projectionName: text("projection_name").notNull(),
    lastDomainEventId: text("last_domain_event_id"),
    rebuiltAt: integer("rebuilt_at"),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("projection_checkpoints_project_id_idx").on(table.projectId),
    index("projection_checkpoints_projection_name_idx").on(table.projectionName),
  ],
);
