import { z } from "zod";

export const SerialReviewRiskLevelSchema = z.enum(["low", "medium", "high", "error"]);

export const SerialReviewOutputSchema = z
  .object({
    characterStagnation: z
      .array(
        z
          .object({
            characterId: z.string().min(1),
            evidence: z.string().min(1).max(500),
            suggestion: z.string().min(1).max(500),
          })
          .strict(),
      )
      .default([]),
    nextActions: z
      .array(
        z
          .object({
            actionType: z.string().min(1).max(80),
            targetId: z.string().min(1).optional(),
            title: z.string().min(1).max(200),
          })
          .strict(),
      )
      .min(1),
    plotDebtRisks: z
      .array(
        z
          .object({
            plotDebtId: z.string().min(1),
            riskLevel: SerialReviewRiskLevelSchema,
            suggestion: z.string().min(1).max(500),
          })
          .strict(),
      )
      .default([]),
    progressSummary: z.string().min(1).max(1200),
    promiseDelivery: z
      .array(
        z
          .object({
            evidence: z.string().min(1).max(500),
            promise: z.string().min(1).max(160),
            score: z.number().min(0).max(100),
          })
          .strict(),
      )
      .default([]),
    repetitionRisks: z.array(z.string().min(1).max(300)).default([]),
    rhythmReport: z
      .object({
        issue: z.string().min(1).max(500).optional(),
        score: z.number().min(0).max(100),
        suggestion: z.string().min(1).max(500).optional(),
      })
      .strict(),
  })
  .strict();

export type SerialReviewRiskLevel = z.infer<typeof SerialReviewRiskLevelSchema>;
export type SerialReviewOutput = z.infer<typeof SerialReviewOutputSchema>;
