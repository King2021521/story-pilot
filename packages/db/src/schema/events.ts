import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { projects } from "./project.js";

export const domainEvents = sqliteTable(
  "domain_events",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: text("payload").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("domain_events_project_id_idx").on(table.projectId),
    index("domain_events_aggregate_idx").on(table.aggregateType, table.aggregateId),
    index("domain_events_event_type_idx").on(table.eventType),
  ],
);
