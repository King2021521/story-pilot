import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { chapters, scenes } from "./chapter.js";
import { projects } from "./project.js";

export const plotlines = sqliteTable(
  "plotlines",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull().default("main"),
    status: text("status").notNull().default("planning"),
    narrativeRole: text("narrative_role").notNull().default("main_drive"),
    importance: text("importance").notNull().default("major"),
    summary: text("summary"),
    centralQuestion: text("central_question"),
    driver: text("driver"),
    startState: text("start_state"),
    midEscalation: text("mid_escalation"),
    payoffPlan: text("payoff_plan"),
    emotionalPromise: text("emotional_promise"),
    relatedCharacterIdsJson: text("related_character_ids_json").notNull().default("[]"),
    relatedWorldRuleIdsJson: text("related_world_rule_ids_json").notNull().default("[]"),
    relatedForeshadowingIdsJson: text("related_foreshadowing_ids_json").notNull().default("[]"),
    relatedStoryEventIdsJson: text("related_story_event_ids_json").notNull().default("[]"),
    priority: integer("priority").notNull().default(0),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("plotlines_project_id_idx").on(table.projectId),
    index("plotlines_status_idx").on(table.status),
  ],
);

export const plotlineNodes = sqliteTable(
  "plotline_nodes",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    plotlineId: text("plotline_id")
      .notNull()
      .references(() => plotlines.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    position: integer("position").notNull(),
    kind: text("kind").notNull().default("beat"),
    status: text("status").notNull().default("planned"),
    description: text("description"),
    chapterHint: text("chapter_hint"),
    targetChapterId: text("target_chapter_id").references(() => chapters.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("plotline_nodes_project_id_idx").on(table.projectId),
    index("plotline_nodes_plotline_position_idx").on(table.plotlineId, table.position),
  ],
);

export const storyEvents = sqliteTable(
  "story_events",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    eventType: text("event_type").notNull().default("plot"),
    eventTime: text("event_time"),
    position: integer("position").notNull().default(0),
    summary: text("summary").notNull(),
    causalImportance: real("causal_importance").notNull().default(0.5),
    chapterId: text("chapter_id").references(() => chapters.id, { onDelete: "set null" }),
    sceneId: text("scene_id").references(() => scenes.id, { onDelete: "set null" }),
    status: text("status").notNull().default("canon"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("story_events_project_id_idx").on(table.projectId),
    index("story_events_position_idx").on(table.projectId, table.position),
    index("story_events_chapter_id_idx").on(table.chapterId),
  ],
);

export const eventParticipants = sqliteTable(
  "event_participants",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => storyEvents.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    role: text("role").notNull().default("participant"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("event_participants_project_id_idx").on(table.projectId),
    index("event_participants_event_id_idx").on(table.eventId),
    index("event_participants_entity_idx").on(table.entityType, table.entityId),
  ],
);

export const eventRelations = sqliteTable(
  "event_relations",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sourceEventId: text("source_event_id")
      .notNull()
      .references(() => storyEvents.id, { onDelete: "cascade" }),
    relationType: text("relation_type").notNull(),
    targetEventId: text("target_event_id")
      .notNull()
      .references(() => storyEvents.id, { onDelete: "cascade" }),
    description: text("description"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("event_relations_project_id_idx").on(table.projectId),
    index("event_relations_source_idx").on(table.sourceEventId),
    index("event_relations_target_idx").on(table.targetEventId),
  ],
);

export const foreshadowings = sqliteTable(
  "foreshadowings",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    status: text("status").notNull().default("seeded"),
    seedText: text("seed_text"),
    payoffText: text("payoff_text"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("foreshadowings_project_id_idx").on(table.projectId),
    index("foreshadowings_status_idx").on(table.status),
  ],
);

export const foreshadowingEvents = sqliteTable(
  "foreshadowing_events",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    foreshadowingId: text("foreshadowing_id")
      .notNull()
      .references(() => foreshadowings.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => storyEvents.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    note: text("note"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("foreshadowing_events_project_id_idx").on(table.projectId),
    index("foreshadowing_events_foreshadowing_id_idx").on(table.foreshadowingId),
  ],
);
