import { z } from "zod";

export const OutlineGenerateOutputSchema = z.object({
  outline: z.object({
    title: z.string().min(1),
    scope: z.enum(["full_book", "volume", "arc", "chapter_batch"]),
    basis: z.record(z.string(), z.unknown()).default({}),
  }),
  chapterOutlines: z
    .array(
      z.object({
        title: z.string().min(1),
        chapterGoal: z.string().min(1),
        conflict: z.string().min(1).optional(),
        informationGain: z.string().min(1).optional(),
        emotionalTurn: z.string().min(1).optional(),
        hook: z.string().min(1).optional(),
        targetWordCount: z.number().int().positive().optional(),
      }),
    )
    .min(1),
  riskNotes: z.array(z.string().min(1)).default([]),
});

export type OutlineGenerateOutput = z.infer<typeof OutlineGenerateOutputSchema>;
