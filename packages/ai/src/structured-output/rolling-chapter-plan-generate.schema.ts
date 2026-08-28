import { z } from "zod";

export const RollingChapterPlanGenerateOutputSchema = z.object({
  chapterPlans: z
    .array(
      z.object({
        id: z.string().min(1).optional(),
        arcPlanId: z.string().min(1).optional(),
        chapterIndex: z.number().int().positive(),
        title: z.string().min(1),
        chapterGoal: z.string().min(1),
        conflict: z.string().min(1),
        informationGain: z.string().min(1),
        emotionalTurn: z.string().min(1),
        hook: z.string().min(1),
        targetWordCount: z.number().int().positive(),
        relatedPlotlineIds: z.array(z.string().min(1)).default([]),
        relatedCharacterIds: z.array(z.string().min(1)).default([]),
        relatedForeshadowingIds: z.array(z.string().min(1)).default([]),
        scenes: z
          .array(
            z.object({
              id: z.string().min(1).optional(),
              sceneIndex: z.number().int().positive(),
              povCharacterId: z.string().min(1).optional(),
              locationId: z.string().min(1).optional(),
              sceneGoal: z.string().min(1),
              conflictTurn: z.string().min(1),
              outcome: z.string().min(1),
              memoryTargets: z.array(z.string().min(1)).default([]),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
  riskNotes: z.array(z.string().min(1)).default([]),
});

export type RollingChapterPlanGenerateOutput = z.infer<
  typeof RollingChapterPlanGenerateOutputSchema
>;
