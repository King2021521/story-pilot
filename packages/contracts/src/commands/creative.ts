import { z } from "zod";

import { projectIdPayloadSchema } from "./shared.js";

const elementTypeSchema = z.enum([
  "character_name",
  "city",
  "location",
  "organization",
  "weapon",
  "technique",
  "item",
  "place_name",
]);

const elementCandidateSchema = z.object({
  name: z.string().min(1),
  type: elementTypeSchema,
  description: z.string().min(1).optional(),
  rationale: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).default([]),
});

const creativeStageKeySchema = z.enum([
  "brief",
  "blueprint",
  "worldbuilding",
  "characters",
  "plot_arcs",
  "outline",
  "chapters",
  "memory_review",
  "retrospective",
]);

const outlineImpactTargetSchema = z.enum(["book_plan", "volume_plan", "arc_plan", "chapter_plan"]);

export const creativePathCommandSchemas = {
  "creativeStage.getPath": projectIdPayloadSchema,
  "creativeStage.evaluateGate": projectIdPayloadSchema.extend({
    stageKey: creativeStageKeySchema,
  }),
  "creativeStage.advance": projectIdPayloadSchema.extend({
    stageKey: creativeStageKeySchema,
    mode: z.enum(["strict", "force"]).default("strict"),
    reason: z.string().min(1).optional(),
  }),
  "creativeStage.reopen": projectIdPayloadSchema.extend({
    stageKey: creativeStageKeySchema,
    reason: z.string().min(1).optional(),
  }),
  "creativeStage.skip": projectIdPayloadSchema.extend({
    stageKey: creativeStageKeySchema,
    reason: z.string().min(1),
  }),
  "creativeStage.complete": projectIdPayloadSchema.extend({
    stageKey: z.enum([
      "worldbuilding",
      "characters",
      "plot_arcs",
      "chapters",
      "memory_review",
      "retrospective",
    ]),
  }),
  "brief.save": projectIdPayloadSchema.extend({
    genre: z.string().min(1),
    subgenres: z.array(z.string().min(1)).default([]),
    targetAudience: z.string().min(1).optional(),
    platformProfile: z.string().min(1).optional(),
    lengthProfile: z.string().min(1).optional(),
    narrativePov: z.string().min(1).optional(),
    emotionalRewards: z.array(z.string().min(1)).default([]),
    initialIdea: z.string().optional(),
    forbiddenDirections: z.array(z.string().min(1)).default([]),
  }),
  "brief.confirm": projectIdPayloadSchema.extend({
    briefId: z.string().min(1),
  }),
  "blueprint.generate": projectIdPayloadSchema,
  "blueprint.apply": projectIdPayloadSchema.extend({
    blueprintId: z.string().min(1),
  }),
  "outline.generate": projectIdPayloadSchema.extend({
    scope: z.enum(["full_book", "volume", "arc", "chapter_batch"]).default("chapter_batch"),
    chapterCount: z.union([z.literal(3), z.literal(5), z.literal(10)]).default(10),
  }),
  "outline.approveChapterOutline": projectIdPayloadSchema.extend({
    chapterOutlineId: z.string().min(1),
  }),
  "outline.applyChapterOutline": projectIdPayloadSchema.extend({
    chapterOutlineId: z.string().min(1),
  }),
  "plot.generateBookPlan": projectIdPayloadSchema.extend({
    targetWordCount: z.number().int().min(100_000).max(10_000_000),
    volumeCount: z.number().int().min(1).max(30),
  }),
  "plot.applyBookPlan": projectIdPayloadSchema.extend({
    artifactId: z.string().min(1),
  }),
  "plot.generateRollingOutline": projectIdPayloadSchema.extend({
    arcPlanId: z.string().min(1).optional(),
    chapterCount: z.union([z.literal(10), z.literal(20)]).default(10),
    startChapterIndex: z.number().int().positive(),
    volumePlanId: z.string().min(1).optional(),
  }),
  "plot.applyChapterPlans": projectIdPayloadSchema.extend({
    artifactId: z.string().min(1),
    selectedChapterPlanIds: z.array(z.string().min(1)).min(1).max(20),
  }),
  "plot.analyzeOutlineImpact": projectIdPayloadSchema.extend({
    patch: z.record(z.string(), z.unknown()),
    targetId: z.string().min(1),
    targetType: outlineImpactTargetSchema,
  }),
};

export const creativeCommandSchemas = {
  "character.list": projectIdPayloadSchema,
  "character.create": projectIdPayloadSchema.extend({
    name: z.string().min(1),
    role: z.enum(["protagonist", "antagonist", "support", "cameo"]).default("support"),
    archetype: z.string().optional(),
    goal: z.string().optional(),
    need: z.string().optional(),
    flaw: z.string().optional(),
    secret: z.string().optional(),
    voiceProfile: z.string().optional(),
    biography: z.string().optional(),
  }),
  "character.update": projectIdPayloadSchema.extend({
    characterId: z.string().min(1),
    patch: z.record(z.string(), z.unknown()),
  }),
  "character.generateNames": projectIdPayloadSchema.extend({
    count: z.number().int().positive().max(50).default(10),
    style: z.string().optional(),
    gender: z.string().optional(),
    constraints: z.array(z.string()).default([]),
  }),
  "element.generateCandidates": projectIdPayloadSchema.extend({
    elementType: elementTypeSchema,
    count: z.union([z.literal(5), z.literal(10), z.literal(20)]).default(10),
    genre: z.string().min(1).optional(),
    style: z.string().min(1).optional(),
    worldRuleIds: z.array(z.string().min(1)).default([]),
    constraints: z.array(z.string().min(1)).default([]),
  }),
  "element.acceptCandidates": projectIdPayloadSchema.extend({
    items: z.array(elementCandidateSchema).min(1).max(50),
  }),
  "worldRule.list": projectIdPayloadSchema,
  "worldRule.create": projectIdPayloadSchema.extend({
    category: z.enum(["magic", "tech", "society", "history", "geography", "economy", "custom"]),
    title: z.string().min(1),
    statement: z.string().min(1),
    constraintLevel: z.enum(["hard", "soft", "optional"]).default("soft"),
  }),
  "worldRule.update": projectIdPayloadSchema.extend({
    worldRuleId: z.string().min(1),
    patch: z.record(z.string(), z.unknown()),
  }),
  "plotline.list": projectIdPayloadSchema,
  "plotline.create": projectIdPayloadSchema.extend({
    title: z.string().min(1),
    kind: z.enum(["main", "branch", "romance", "mystery", "growth", "world"]).default("branch"),
    summary: z.string().optional(),
    priority: z.number().int().nonnegative().default(0),
  }),
  "plotline.updateNode": projectIdPayloadSchema.extend({
    plotlineNodeId: z.string().min(1),
    patch: z.record(z.string(), z.unknown()),
  }),
  "storyEvent.list": projectIdPayloadSchema,
  "storyEvent.create": projectIdPayloadSchema.extend({
    title: z.string().min(1),
    description: z.string().min(1),
    eventType: z
      .enum([
        "decision",
        "discovery",
        "conflict",
        "reveal",
        "loss",
        "victory",
        "betrayal",
        "travel",
        "custom",
      ])
      .default("custom"),
    chapterId: z.string().min(1).optional(),
    sceneId: z.string().min(1).optional(),
    locationId: z.string().min(1).optional(),
    storyTime: z.string().optional(),
    outcome: z.string().optional(),
    participants: z
      .array(
        z.object({
          entityType: z.string().min(1),
          entityId: z.string().min(1),
          role: z.string().min(1).default("participant"),
        }),
      )
      .default([]),
  }),
  "foreshadowing.list": projectIdPayloadSchema,
  "foreshadowing.create": projectIdPayloadSchema.extend({
    title: z.string().min(1),
    description: z.string().min(1),
    payoffExpectation: z.string().optional(),
    importance: z.number().int().min(1).max(5).default(3),
    seedEventId: z.string().min(1).optional(),
    payoffEventId: z.string().min(1).optional(),
  }),
  "foreshadowing.plan": projectIdPayloadSchema.extend({
    chapterId: z.string().min(1).optional(),
    plotlineId: z.string().min(1).optional(),
  }),
};
