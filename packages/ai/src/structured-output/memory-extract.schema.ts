import { z } from "zod";

export const MemoryExtractRelationSchema = z.object({
  predicate: z.string().min(1),
  targetId: z.string().min(1),
  targetType: z.string().min(1),
});

export const MemoryExtractCandidateSchema = z
  .object({
    confidence: z.number().min(0).max(1).default(0.5),
    content: z.string().min(1),
    entityId: z.string().min(1).optional(),
    entityType: z.string().min(1),
    kind: z.string().min(1),
    proposedRelations: z.array(MemoryExtractRelationSchema).default([]),
    sourceQuote: z.string().min(1).optional(),
    sourceSummary: z.string().min(1).optional(),
    status: z.literal("pending").default("pending"),
  })
  .refine(
    (candidate) => candidate.sourceQuote !== undefined || candidate.sourceSummary !== undefined,
    {
      message: "Memory candidates require sourceQuote or sourceSummary",
      path: ["sourceQuote"],
    },
  );

export const MemoryExtractOutputSchema = z.object({
  conflictNotes: z.array(z.string().min(1)).default([]),
  memoryCandidates: z.array(MemoryExtractCandidateSchema).default([]),
});

export type MemoryExtractOutput = z.infer<typeof MemoryExtractOutputSchema>;
export type MemoryExtractCandidate = z.infer<typeof MemoryExtractCandidateSchema>;
