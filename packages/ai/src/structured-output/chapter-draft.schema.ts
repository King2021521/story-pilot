import { z } from "zod";

export const ChapterDraftMemoryRelationSchema = z.object({
  predicate: z.string().min(1),
  targetId: z.string().min(1),
  targetType: z.string().min(1),
});

export const ChapterDraftMemoryCandidateSchema = z.object({
  confidence: z.number().min(0).max(1).default(0.5),
  content: z.string().min(1),
  entityId: z.string().min(1).optional(),
  entityType: z.string().min(1),
  kind: z.string().min(1),
  proposedRelations: z.array(ChapterDraftMemoryRelationSchema).default([]),
  status: z.literal("pending").default("pending"),
});

export const ChapterDraftOutputSchema = z.object({
  draft: z.object({
    body: z.string().min(1),
    summary: z.string().min(1),
    title: z.string().min(1),
  }),
  memoryCandidates: z.array(ChapterDraftMemoryCandidateSchema).default([]),
  reviewNotes: z.array(z.string().min(1)).default([]),
});

export type ChapterDraftOutput = z.infer<typeof ChapterDraftOutputSchema>;
export type ChapterDraftMemoryCandidate = z.infer<typeof ChapterDraftMemoryCandidateSchema>;
