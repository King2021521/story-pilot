import { z } from "zod";

export const ForeshadowingPlanSuggestionSchema = z.object({
  action: z.enum(["seed", "reinforce", "payoff", "delay", "revise"]),
  foreshadowingId: z.string().min(1).optional(),
  chapterId: z.string().min(1).optional(),
  rationale: z.string().min(1),
  proposedText: z.string().min(1).optional(),
  priority: z.number().int().positive().default(3),
});

export const ForeshadowingPlanOutputSchema = z.object({
  summary: z.string().min(1),
  suggestions: z.array(ForeshadowingPlanSuggestionSchema).default([]),
});

export type ForeshadowingPlanOutput = z.infer<typeof ForeshadowingPlanOutputSchema>;
export type ForeshadowingPlanSuggestion = z.infer<typeof ForeshadowingPlanSuggestionSchema>;
