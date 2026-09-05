import { z } from "zod";

export const StoryStateDeltaActionSchema = z.enum([
  "create",
  "reinforce",
  "payoff",
  "drop",
  "risk_raise",
]);

export const StoryStateDeltaOutputSchema = z
  .object({
    characterDeltas: z
      .array(
        z
          .object({
            characterId: z.string().min(1),
            emotionalState: z.string().max(300).optional(),
            externalGoal: z.string().max(300).optional(),
            internalNeed: z.string().max(300).optional(),
            knowledgeState: z.string().max(300).optional(),
            physicalState: z.string().max(300).optional(),
            relationshipChanges: z.array(z.string().max(160)).default([]),
            resourceChanges: z.array(z.string().max(160)).default([]),
            riskFlags: z.array(z.string().max(120)).default([]),
          })
          .strict(),
      )
      .default([]),
    memoryCandidates: z.array(z.string().min(1).max(300)).default([]),
    plotDebtDeltas: z
      .array(
        z
          .object({
            action: StoryStateDeltaActionSchema,
            note: z.string().min(1).max(300),
            plotDebtId: z.string().min(1).optional(),
            title: z.string().min(1).max(120),
          })
          .strict(),
      )
      .default([]),
    storyDelta: z
      .object({
        globalSituationChange: z.string().max(800).default(""),
        hiddenInformation: z.array(z.string().max(160)).default([]),
        locationChanges: z.array(z.string().max(160)).default([]),
        organizationChanges: z.array(z.string().max(160)).default([]),
        resourceChanges: z.array(z.string().max(160)).default([]),
        revealedInformation: z.array(z.string().max(160)).default([]),
      })
      .strict(),
  })
  .strict();

export type StoryStateDeltaAction = z.infer<typeof StoryStateDeltaActionSchema>;
export type StoryStateDeltaOutput = z.infer<typeof StoryStateDeltaOutputSchema>;
