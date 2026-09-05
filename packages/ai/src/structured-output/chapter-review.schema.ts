import { z } from "zod";

export const ChapterReviewDimensionKeySchema = z.enum([
  "plan_fit",
  "conflict",
  "information_gain",
  "emotional_reward",
  "hook",
  "character_voice",
  "canon_consistency",
  "pacing",
]);

export const ChapterReviewIssueSeveritySchema = z.enum(["info", "warning", "error"]);

export const ChapterReviewOutputSchema = z
  .object({
    blockingIssues: z
      .array(
        z
          .object({
            issueType: z.string().min(1),
            message: z.string().min(1).max(500),
            relatedEntityIds: z.array(z.string()).default([]),
            severity: ChapterReviewIssueSeveritySchema,
          })
          .strict(),
      )
      .default([]),
    dimensions: z
      .array(
        z
          .object({
            evidence: z.string().min(1).max(500),
            key: ChapterReviewDimensionKeySchema,
            score: z.number().min(0).max(100),
            suggestion: z.string().min(1).max(500),
          })
          .strict(),
      )
      .min(1),
    rewriteSuggestions: z.array(z.string().min(1).max(200)).default([]),
    score: z.number().min(0).max(100),
  })
  .strict();

export type ChapterReviewDimensionKey = z.infer<typeof ChapterReviewDimensionKeySchema>;
export type ChapterReviewIssueSeverity = z.infer<typeof ChapterReviewIssueSeveritySchema>;
export type ChapterReviewOutput = z.infer<typeof ChapterReviewOutputSchema>;
