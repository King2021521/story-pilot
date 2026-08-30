import { z } from "zod";

const coreStoryTextFieldSchema = z.string().min(200).max(800);
const coreStoryLoglineFieldSchema = z.string().min(40).max(180);
const coreStoryListFieldSchema = z.array(z.string().min(1).max(120)).min(1).max(8);
const coreStoryDriverSchema = z.enum([
  "growth_reversal",
  "mystery",
  "power_game",
  "adventure",
  "romance",
  "ensemble_epic",
  "survival",
  "slice_of_life",
  "custom",
]);

export const CoreStoryFieldCompletionOutputSchema = z
  .object({
    fields: z
      .object({
        antagonistForce: coreStoryTextFieldSchema,
        corePromise: coreStoryTextFieldSchema,
        differentiators: coreStoryListFieldSchema,
        emotionalAxes: coreStoryListFieldSchema,
        logline: coreStoryLoglineFieldSchema,
        mainConflict: coreStoryTextFieldSchema,
        mainGoal: coreStoryTextFieldSchema,
        premise: coreStoryTextFieldSchema,
        protagonistArc: coreStoryTextFieldSchema,
        risks: coreStoryListFieldSchema,
        stakes: coreStoryTextFieldSchema,
        storyDriver: coreStoryDriverSchema,
      })
      .strict(),
  })
  .strict();

export type CoreStoryFieldCompletionOutput = z.infer<typeof CoreStoryFieldCompletionOutputSchema>;
