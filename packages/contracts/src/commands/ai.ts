import { z } from "zod";

import { projectIdPayloadSchema } from "./shared.js";

const aiCapabilitySchema = z.enum([
  "brief.refine",
  "blueprint.generate",
  "worldbuilding.generate",
  "character.generate",
  "relationship.generate",
  "plotArc.generate",
  "outline.generate",
  "chapter.draft",
  "chapter.rewrite",
  "continuity.review",
  "foreshadowing.plan",
  "memory.extract",
  "retrospective.generate",
  "element.generateCandidates",
]);

export const aiCommandSchemas = {
  "ai.generate": projectIdPayloadSchema
    .extend({
      capability: aiCapabilitySchema,
      input: z.record(z.string(), z.unknown()).optional(),
      instruction: z.string().optional(),
      options: z
        .object({
          temperature: z.number().min(0).max(2).optional(),
          maxOutputTokens: z.number().int().positive().optional(),
        })
        .strict()
        .optional(),
      targetId: z.string().min(1).optional(),
      targetType: z.string().min(1).optional(),
    })
    .strict(),
  "ai.getRun": projectIdPayloadSchema.extend({
    workflowRunId: z.string().min(1),
  }),
  "ai.cancelRun": projectIdPayloadSchema.extend({
    workflowRunId: z.string().min(1),
  }),
  "ai.listArtifacts": projectIdPayloadSchema
    .extend({
      kind: z.string().min(1).optional(),
      targetId: z.string().min(1).optional(),
      targetType: z.string().min(1).optional(),
    })
    .strict(),
};
