import { z } from "zod";

import { projectIdPayloadSchema } from "./shared.js";

const chapterExecutionCardStatusSchema = z.enum(["draft", "confirmed", "archived"]);

const chapterExecutionCardSceneBriefSchema = z.object({
  sceneIndex: z.number().int().positive().max(100),
  sceneGoal: z.string().min(1).max(240),
  conflictTurn: z.string().min(1).max(240),
  outcome: z.string().min(1).max(240),
  memoryTargets: z.array(z.string().min(1).max(120)).max(20).default([]),
});

const chapterExecutionCardValuesSchema = z.object({
  chapterPlanId: z.string().min(1),
  chapterId: z.string().min(1).nullable().optional(),
  chapterIndex: z.number().int().positive().max(100_000),
  title: z.string().min(1).max(120),
  narrativeGoal: z.string().min(1).max(500),
  coreConflict: z.string().min(1).max(500),
  informationGain: z.string().min(1).max(400),
  emotionalTurn: z.string().min(1).max(400),
  readerReward: z.string().min(1).max(400),
  hook: z.string().min(1).max(240),
  povCharacterId: z.string().min(1).nullable().optional(),
  requiredCharacterIds: z.array(z.string().min(1)).max(30).default([]),
  requiredLocationIds: z.array(z.string().min(1)).max(30).default([]),
  relatedPlotlineIds: z.array(z.string().min(1)).max(30).default([]),
  relatedForeshadowingIds: z.array(z.string().min(1)).max(30).default([]),
  relatedPlotDebtIds: z.array(z.string().min(1)).max(30).default([]),
  sceneBriefs: z.array(chapterExecutionCardSceneBriefSchema).min(1).max(20),
  forbiddenMoves: z.array(z.string().min(1).max(160)).max(20).default([]),
  targetWordCount: z.number().int().min(500).max(20_000),
  status: chapterExecutionCardStatusSchema,
  sourceArtifactId: z.string().min(1).nullable().optional(),
});

export const chapterCommandSchemas = {
  "chapter.list": projectIdPayloadSchema.extend({
    volumeId: z.string().min(1).optional(),
  }),
  "chapter.get": projectIdPayloadSchema.extend({
    chapterId: z.string().min(1),
  }),
  "chapter.create": projectIdPayloadSchema.extend({
    volumeId: z.string().min(1),
    title: z.string().min(1),
    summary: z.string().optional(),
    targetWordCount: z.number().int().positive().optional(),
    sortOrder: z.number().int().nonnegative().optional(),
  }),
  "chapter.saveContent": projectIdPayloadSchema.extend({
    chapterId: z.string().min(1),
    content: z.string(),
    baseVersion: z.number().int().nonnegative(),
  }),
  "chapter.listVersions": projectIdPayloadSchema.extend({
    chapterId: z.string().min(1),
  }),
  "chapter.restoreVersion": projectIdPayloadSchema.extend({
    chapterId: z.string().min(1),
    versionId: z.string().min(1),
  }),
  "chapter.generateDraft": projectIdPayloadSchema.extend({
    chapterId: z.string().min(1),
    instruction: z.string().optional(),
    options: z
      .object({
        targetWordCount: z.number().int().positive().optional(),
        styleGuideId: z.string().min(1).optional(),
        modelAlias: z.string().min(1).optional(),
      })
      .optional(),
  }),
  "chapter.generateDraftFromOutline": projectIdPayloadSchema.extend({
    chapterOutlineId: z.string().min(1),
    instruction: z.string().optional(),
  }),
  "chapter.generateDraftFromPlan": projectIdPayloadSchema.extend({
    chapterPlanId: z.string().min(1),
    instruction: z.string().optional(),
  }),
  "chapter.reviewContinuity": projectIdPayloadSchema.extend({
    chapterId: z.string().min(1),
    scope: z.enum(["chapter", "volume", "project"]).default("chapter"),
  }),
  "chapter.reviewDraft": projectIdPayloadSchema.extend({
    artifactId: z.string().min(1).optional(),
    chapterId: z.string().min(1),
    chapterVersion: z.number().int().nonnegative().optional(),
  }),
  "chapterExecutionCard.generate": projectIdPayloadSchema.extend({
    chapterPlanId: z.string().min(1),
    instruction: z.string().max(1_000).optional(),
  }),
  "chapterExecutionCard.apply": projectIdPayloadSchema.extend({
    artifactId: z.string().min(1),
  }),
  "chapterExecutionCard.save": projectIdPayloadSchema.extend({
    cardId: z.string().min(1).optional(),
    values: chapterExecutionCardValuesSchema,
  }),
};
