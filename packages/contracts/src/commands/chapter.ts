import { z } from "zod";

import { projectIdPayloadSchema } from "./shared.js";

export const chapterCommandSchemas = {
  "chapter.list": projectIdPayloadSchema.extend({
    volumeId: z.string().min(1).optional(),
  }),
  "chapter.get": projectIdPayloadSchema.extend({
    chapterId: z.string().min(1),
  }),
  "chapter.create": projectIdPayloadSchema.extend({
    volumeId: z.string().min(1),
    title: z.string().min(1),
    summary: z.string().optional(),
    targetWordCount: z.number().int().positive().optional(),
    sortOrder: z.number().int().nonnegative().optional(),
  }),
  "chapter.saveContent": projectIdPayloadSchema.extend({
    chapterId: z.string().min(1),
    content: z.string(),
    baseVersion: z.number().int().nonnegative(),
  }),
  "chapter.listVersions": projectIdPayloadSchema.extend({
    chapterId: z.string().min(1),
  }),
  "chapter.restoreVersion": projectIdPayloadSchema.extend({
    chapterId: z.string().min(1),
    versionId: z.string().min(1),
  }),
  "chapter.generateDraft": projectIdPayloadSchema.extend({
    chapterId: z.string().min(1),
    instruction: z.string().optional(),
    options: z
      .object({
        targetWordCount: z.number().int().positive().optional(),
        styleGuideId: z.string().min(1).optional(),
        modelAlias: z.string().min(1).optional(),
      })
      .optional(),
  }),
  "chapter.reviewContinuity": projectIdPayloadSchema.extend({
    chapterId: z.string().min(1),
    scope: z.enum(["chapter", "volume", "project"]).default("chapter"),
  }),
};

