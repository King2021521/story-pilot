import { z } from "zod";

import { entityTargetSchema, projectIdPayloadSchema } from "./shared.js";

export const workflowCommandSchemas = {
  "workOrder.list": projectIdPayloadSchema.extend({
    status: z
      .enum(["queued", "running", "waiting_user", "completed", "failed", "canceled"])
      .optional(),
  }),
  "workOrder.get": projectIdPayloadSchema.extend({
    workOrderId: z.string().min(1),
  }),
  "workflow.run": projectIdPayloadSchema
    .merge(entityTargetSchema)
    .extend({
      workflowType: z.enum([
        "story_bible",
        "outline",
        "chapter_draft",
        "rewrite",
        "review",
        "memory_extract",
        "foreshadowing_plan",
        "element_generate",
      ]),
      input: z.record(z.string(), z.unknown()).default({}),
    }),
  "workflow.cancel": projectIdPayloadSchema.extend({
    workflowRunId: z.string().min(1),
  }),
  "workflow.retry": projectIdPayloadSchema.extend({
    workflowRunId: z.string().min(1),
  }),
  "artifact.get": projectIdPayloadSchema.extend({
    artifactId: z.string().min(1),
  }),
  "artifact.apply": projectIdPayloadSchema.extend({
    artifactId: z.string().min(1),
    targetVersion: z.number().int().nonnegative().optional(),
    applyMode: z.enum(["replace", "patch", "append", "create_version_only"]),
  }),
  "artifact.reject": projectIdPayloadSchema.extend({
    artifactId: z.string().min(1),
  }),
};

