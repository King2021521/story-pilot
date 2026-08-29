import { z } from "zod";

export const BlueprintGenerateOutputSchema = z.object({
  premise: z.string().min(1),
  logline: z.string().min(1),
  corePromise: z.string().min(1),
  mainGoal: z.string().min(1),
  mainConflict: z.string().min(1),
  protagonistArc: z.string().min(1).optional(),
  antagonistForce: z.string().min(1).optional(),
  stakes: z.string().min(1),
  storyDriver: z.enum([
    "growth_reversal",
    "mystery",
    "power_game",
    "adventure",
    "romance",
    "ensemble_epic",
    "survival",
    "slice_of_life",
    "custom",
  ]),
  emotionalAxes: z.array(z.string().min(1)).default([]),
  differentiators: z.array(z.string().min(1)).default([]),
  risks: z.array(z.string().min(1)).default([]),
});

export type BlueprintGenerateOutput = z.infer<typeof BlueprintGenerateOutputSchema>;
