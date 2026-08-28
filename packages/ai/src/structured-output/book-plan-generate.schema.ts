import { z } from "zod";

export const BookPlanGenerateOutputSchema = z.object({
  bookPlan: z.object({
    title: z.string().min(1),
    targetWordCount: z.number().int().positive(),
    corePromise: z.string().min(1),
    endingDirection: z.string().min(1).optional(),
    mainPlotlineId: z.string().min(1).optional(),
  }),
  volumePlans: z
    .array(
      z.object({
        title: z.string().min(1),
        volumeIndex: z.number().int().positive(),
        purpose: z.string().min(1),
        majorConflict: z.string().min(1),
        climax: z.string().min(1).optional(),
        targetWordCount: z.number().int().positive(),
        arcs: z
          .array(
            z.object({
              title: z.string().min(1),
              arcIndex: z.number().int().positive(),
              plotlineId: z.string().min(1).optional(),
              characterArcId: z.string().min(1).optional(),
              startChapterIndex: z.number().int().positive().optional(),
              endChapterIndex: z.number().int().positive().optional(),
              purpose: z.string().min(1),
              escalation: z.array(z.string().min(1)).default([]),
            }),
          )
          .default([]),
      }),
    )
    .min(1),
  riskNotes: z.array(z.string().min(1)).default([]),
});

export type BookPlanGenerateOutput = z.infer<typeof BookPlanGenerateOutputSchema>;
