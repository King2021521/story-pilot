import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { projects } from "./project.js";

export const workOrders = sqliteTable(
  "work_orders",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    status: text("status").notNull().default("queued"),
    title: text("title").notNull(),
    description: text("description"),
    createdBy: text("created_by").notNull().default("user"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("work_orders_project_id_idx").on(table.projectId),
    index("work_orders_status_idx").on(table.status),
  ],
);

export const workflowRuns = sqliteTable(
  "workflow_runs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    workOrderId: text("work_order_id").references(() => workOrders.id, { onDelete: "set null" }),
    workflowName: text("workflow_name").notNull(),
    status: text("status").notNull().default("queued"),
    input: text("input"),
    output: text("output"),
    error: text("error"),
    startedAt: integer("started_at"),
    completedAt: integer("completed_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("workflow_runs_project_id_idx").on(table.projectId),
    index("workflow_runs_work_order_id_idx").on(table.workOrderId),
    index("workflow_runs_status_idx").on(table.status),
  ],
);

export const workflowSteps = sqliteTable(
  "workflow_steps",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    workflowRunId: text("workflow_run_id")
      .notNull()
      .references(() => workflowRuns.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: text("status").notNull().default("queued"),
    input: text("input"),
    output: text("output"),
    error: text("error"),
    startedAt: integer("started_at"),
    completedAt: integer("completed_at"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("workflow_steps_project_id_idx").on(table.projectId),
    index("workflow_steps_run_id_idx").on(table.workflowRunId),
  ],
);

export const artifacts = sqliteTable(
  "artifacts",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    workOrderId: text("work_order_id").references(() => workOrders.id, { onDelete: "set null" }),
    workflowRunId: text("workflow_run_id").references(() => workflowRuns.id, { onDelete: "set null" }),
    kind: text("kind").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    status: text("status").notNull().default("pending"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    metadata: text("metadata"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    appliedAt: integer("applied_at"),
  },
  (table) => [
    index("artifacts_project_id_idx").on(table.projectId),
    index("artifacts_target_idx").on(table.targetType, table.targetId),
    index("artifacts_status_idx").on(table.status),
  ],
);

export const modelCalls = sqliteTable(
  "model_calls",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    workflowRunId: text("workflow_run_id").references(() => workflowRuns.id, { onDelete: "set null" }),
    stepId: text("step_id").references(() => workflowSteps.id, { onDelete: "set null" }),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    purpose: text("purpose").notNull(),
    promptVersion: text("prompt_version"),
    request: text("request").notNull(),
    response: text("response"),
    usage: text("usage"),
    status: text("status").notNull().default("completed"),
    error: text("error"),
    latencyMs: integer("latency_ms"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("model_calls_project_id_idx").on(table.projectId),
    index("model_calls_workflow_run_id_idx").on(table.workflowRunId),
    index("model_calls_purpose_idx").on(table.purpose),
  ],
);
