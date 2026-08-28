import { z } from "zod";

import { emptyPayloadSchema, projectIdPayloadSchema } from "./shared.js";

export const projectCommandSchemas = {
  "app.health": emptyPayloadSchema,
  "diagnostics.getHealth": emptyPayloadSchema,
  "diagnostics.export": emptyPayloadSchema,
  "project.create": z.object({
    title: z.string().min(1),
    subtitle: z.string().min(1).optional(),
    genre: z.string().min(1).optional(),
    style: z.string().min(1).optional(),
    targetAudience: z.string().min(1).optional(),
    logline: z.string().min(1).optional(),
    wordCountGoal: z.number().int().positive().optional(),
  }),
  "project.listRecent": z
    .object({
      limit: z.number().int().positive().max(100).optional(),
    })
    .default({}),
  "project.open": z.union([
    z.object({ projectId: z.string().min(1) }),
    z.object({ path: z.string().min(1) }),
  ]),
  "project.getOverview": projectIdPayloadSchema,
  "project.backup": projectIdPayloadSchema,
  "backup.createProject": projectIdPayloadSchema,
  "backup.restoreProject": projectIdPayloadSchema.extend({
    backupPath: z.string().min(1),
  }),
  "workbench.getSnapshot": projectIdPayloadSchema,
  "workbench.getBoard": projectIdPayloadSchema,
};
