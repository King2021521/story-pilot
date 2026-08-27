import { z } from "zod";

export const ContinuityReviewIssueSchema = z.object({
  issueType: z.string().min(1),
  severity: z.enum(["info", "warning", "error"]),
  evidence: z.string().min(1),
  suggestion: z.string().min(1),
  relatedEntityIds: z.array(z.string().min(1)).default([]),
});

export const ContinuityReviewOutputSchema = z.object({
  summary: z.string().min(1),
  issues: z.array(ContinuityReviewIssueSchema).default([]),
});

export type ContinuityReviewOutput = z.infer<typeof ContinuityReviewOutputSchema>;
export type ContinuityReviewIssue = z.infer<typeof ContinuityReviewIssueSchema>;
