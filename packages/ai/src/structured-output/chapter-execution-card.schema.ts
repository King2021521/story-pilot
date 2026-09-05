import { z } from "zod";

export const ChapterExecutionSceneBriefSchema = z
  .object({
    conflictTurn: z.string().min(30).max(240),
    memoryTargets: z.array(z.string().min(1).max(120)).default([]),
    outcome: z.string().min(30).max(240),
    sceneGoal: z.string().min(30).max(240),
    sceneIndex: z.number().int().positive(),
  })
  .strict();

export const ChapterExecutionCardSchema = z
  .object({
    chapterIndex: z.number().int().positive(),
    coreConflict: z.string().min(80).max(500),
    emotionalTurn: z.string().min(50).max(400),
    forbiddenMoves: z.array(z.string().min(1).max(160)).default([]),
    hook: z.string().min(40).max(240),
    informationGain: z.string().min(50).max(400),
    narrativeGoal: z.string().min(80).max(500),
    povCharacterId: z.string().min(1).optional(),
    readerReward: z.string().min(50).max(400),
    relatedForeshadowingIds: z.array(z.string()).default([]),
    relatedPlotDebtIds: z.array(z.string()).default([]),
    relatedPlotlineIds: z.array(z.string()).default([]),
    requiredCharacterIds: z.array(z.string()).default([]),
    requiredLocationIds: z.array(z.string()).default([]),
    sceneBriefs: z.array(ChapterExecutionSceneBriefSchema).min(1),
    targetWordCount: z.number().int().min(1000).max(12_000),
    title: z.string().min(1).max(80),
  })
  .strict();

export const ChapterExecutionCardOutputSchema = z
  .object({
    card: ChapterExecutionCardSchema,
    riskNotes: z.array(z.string().min(1).max(200)).default([]),
  })
  .strict();

export type ChapterExecutionSceneBrief = z.infer<typeof ChapterExecutionSceneBriefSchema>;
export type ChapterExecutionCard = z.infer<typeof ChapterExecutionCardSchema>;
export type ChapterExecutionCardOutput = z.infer<typeof ChapterExecutionCardOutputSchema>;
