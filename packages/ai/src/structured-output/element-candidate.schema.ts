import { z } from "zod";

export const ElementCandidateTypeSchema = z.enum([
  "character_name",
  "city",
  "location",
  "organization",
  "weapon",
  "technique",
  "item",
  "place_name",
]);

export const ElementCandidateSchema = z.object({
  name: z.string().min(1),
  type: ElementCandidateTypeSchema,
  description: z.string().min(1),
  rationale: z.string().min(1),
  tags: z.array(z.string().min(1)).default([]),
});

export const ElementCandidateOutputSchema = z.object({
  items: z.array(ElementCandidateSchema).default([]),
});

export type ElementCandidateType = z.infer<typeof ElementCandidateTypeSchema>;
export type ElementCandidate = z.infer<typeof ElementCandidateSchema>;
export type ElementCandidateOutput = z.infer<typeof ElementCandidateOutputSchema>;
