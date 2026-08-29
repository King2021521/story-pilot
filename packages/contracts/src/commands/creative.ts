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

const worldbuildingTextFieldSchema = z.string().max(500).default("");

const coreStoryTextFieldSchema = z.string().max(800).default("");
const coreStoryLoglineFieldSchema = z.string().max(180).default("");
const coreStoryListFieldSchema = z.array(z.string().min(1).max(120)).max(8).default([]);
const coreStoryDriverSchema = z
  .enum([
    "growth_reversal",
    "mystery",
    "power_game",
    "adventure",
    "romance",
    "ensemble_epic",
    "survival",
    "slice_of_life",
    "custom",
  ])
  .default("growth_reversal");

const characterImportanceSchema = z.enum(["core", "major", "minor", "cameo"]).default("major");

const characterNarrativeFunctionSchema = z
  .enum([
    "viewpoint",
    "driver",
    "opposition",
    "ally",
    "mentor",
    "foil",
    "love_interest",
    "comic_relief",
    "information_source",
    "custom",
  ])
  .default("driver");

const plotlineKindSchema = z
  .enum(["main", "branch", "romance", "mystery", "growth", "world", "antagonist"])
  .default("branch");

const plotlineNarrativeRoleSchema = z
  .enum([
    "main_drive",
    "obstacle",
    "secret_reveal",
    "relationship_tension",
    "emotional_reward",
    "worldbuilding",
    "contrast",
    "custom",
  ])
  .default("main_drive");

const plotlineImportanceSchema = z.enum(["core", "major", "minor", "background"]).default("major");

const plotlineStatusSchema = z
  .enum(["idea", "planning", "active", "resolved", "archived"])
  .default("planning");

const plotlineNodeKindSchema = z
  .enum(["seed", "advance", "mislead", "turn", "reveal", "climax", "payoff"])
  .default("advance");

const plotlineNodeStatusSchema = z
  .enum(["planned", "drafted", "used", "resolved", "cut"])
  .default("planned");

const plotlineTextFieldSchema = z.string().max(500).optional();
const plotlineRelationIdsSchema = z.array(z.string().min(1)).default([]);
const outlinePlanTextFieldSchema = z.string().max(800).default("");
const outlinePlanOptionalTextFieldSchema = z.string().max(800).nullable().optional();
const outlinePlanOptionalIdSchema = z.string().min(1).nullable().optional();
const outlinePlanStatusSchema = z
  .enum(["draft", "active", "approved", "archived"])
  .default("draft");
const outlinePlanEscalationSchema = z.array(z.string().min(1).max(160)).max(12).default([]);

const coreStoryFieldsSchema = z.object({
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
});

const worldbuildingFieldsSchema = z.object({
  coreConflict: worldbuildingTextFieldSchema,
  culture: worldbuildingTextFieldSchema,
  economy: worldbuildingTextFieldSchema,
  factions: worldbuildingTextFieldSchema,
  geography: worldbuildingTextFieldSchema,
  history: worldbuildingTextFieldSchema,
  powerOrder: worldbuildingTextFieldSchema,
  powerSystem: worldbuildingTextFieldSchema,
  rules: worldbuildingTextFieldSchema,
  socialStructure: worldbuildingTextFieldSchema,
  specialMechanism: worldbuildingTextFieldSchema,
  worldBase: worldbuildingTextFieldSchema,
});

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
    estimatedChapterCount: z.number().int().min(1).max(10_000).optional(),
    estimatedWordCount: z.number().int().min(10_000).max(20_000_000).optional(),
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
  "blueprint.saveForm": projectIdPayloadSchema.extend({
    fields: coreStoryFieldsSchema,
  }),
  "blueprint.completeForm": projectIdPayloadSchema.extend({
    fields: coreStoryFieldsSchema,
  }),
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
  "plot.saveBookPlanDraft": projectIdPayloadSchema.extend({
    bookPlanId: z.string().min(1).optional(),
    corePromise: outlinePlanTextFieldSchema,
    endingDirection: outlinePlanOptionalTextFieldSchema,
    mainPlotlineId: outlinePlanOptionalIdSchema,
    status: outlinePlanStatusSchema,
    targetWordCount: z.number().int().min(100_000).max(10_000_000),
    title: z.string().min(1).max(120),
  }),
  "plot.saveVolumePlan": projectIdPayloadSchema.extend({
    bookPlanId: z.string().min(1),
    climax: outlinePlanOptionalTextFieldSchema,
    majorConflict: outlinePlanTextFieldSchema,
    purpose: outlinePlanTextFieldSchema,
    status: outlinePlanStatusSchema,
    targetWordCount: z.number().int().min(10_000).max(2_000_000),
    title: z.string().min(1).max(120),
    volumeIndex: z.number().int().min(1).max(100),
    volumePlanId: z.string().min(1).optional(),
  }),
  "plot.saveArcPlan": projectIdPayloadSchema.extend({
    arcIndex: z.number().int().min(1).max(300),
    arcPlanId: z.string().min(1).optional(),
    characterArcId: outlinePlanOptionalIdSchema,
    endChapterIndex: z.number().int().positive().nullable().optional(),
    escalation: outlinePlanEscalationSchema,
    plotlineId: outlinePlanOptionalIdSchema,
    purpose: outlinePlanTextFieldSchema,
    startChapterIndex: z.number().int().positive().nullable().optional(),
    status: outlinePlanStatusSchema,
    title: z.string().min(1).max(120),
    volumePlanId: z.string().min(1),
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
    archetype: z.string().max(80).optional(),
    genderAge: z.string().max(80).optional(),
    importance: characterImportanceSchema.optional(),
    firstAppearance: z.string().max(80).optional(),
    narrativeFunction: characterNarrativeFunctionSchema.optional(),
    storyTask: z.string().max(500).optional(),
    relationshipHook: z.string().max(500).optional(),
    appearance: z.string().max(500).optional(),
    arcStart: z.string().max(500).optional(),
    arcTurn: z.string().max(500).optional(),
    arcEnd: z.string().max(500).optional(),
    goal: z.string().max(500).optional(),
    need: z.string().max(500).optional(),
    flaw: z.string().max(500).optional(),
    secret: z.string().max(500).optional(),
    voiceProfile: z.string().max(500).optional(),
    biography: z.string().max(500).optional(),
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
  "worldbuilding.saveFields": projectIdPayloadSchema.extend({
    fields: worldbuildingFieldsSchema,
  }),
  "worldbuilding.completeFields": projectIdPayloadSchema.extend({
    fields: worldbuildingFieldsSchema,
  }),
  "plotline.list": projectIdPayloadSchema,
  "plotline.create": projectIdPayloadSchema.extend({
    title: z.string().min(1),
    kind: plotlineKindSchema,
    narrativeRole: plotlineNarrativeRoleSchema,
    importance: plotlineImportanceSchema,
    status: plotlineStatusSchema,
    centralQuestion: plotlineTextFieldSchema,
    driver: plotlineTextFieldSchema,
    startState: plotlineTextFieldSchema,
    midEscalation: plotlineTextFieldSchema,
    payoffPlan: plotlineTextFieldSchema,
    emotionalPromise: plotlineTextFieldSchema,
    relatedCharacterIds: plotlineRelationIdsSchema,
    relatedWorldRuleIds: plotlineRelationIdsSchema,
    relatedForeshadowingIds: plotlineRelationIdsSchema,
    relatedStoryEventIds: plotlineRelationIdsSchema,
    summary: z.string().max(500).optional(),
    priority: z.number().int().nonnegative().default(0),
  }),
  "plotline.update": projectIdPayloadSchema.extend({
    plotlineId: z.string().min(1),
    patch: z.record(z.string(), z.unknown()),
  }),
  "plotline.createNode": projectIdPayloadSchema.extend({
    plotlineId: z.string().min(1),
    title: z.string().min(1),
    kind: plotlineNodeKindSchema,
    status: plotlineNodeStatusSchema,
    description: plotlineTextFieldSchema,
    chapterHint: z.string().max(80).optional(),
    targetChapterId: z.string().min(1).optional(),
    position: z.number().int().nonnegative().optional(),
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
