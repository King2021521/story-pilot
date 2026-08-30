import { z } from "zod";

import { projectIdPayloadSchema } from "./shared.js";

const elementTypeSchema = z.enum([
  "character_name",
  "city",
  "location",
  "organization",
  "faction",
  "sect",
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
const outlineScopeSchema = z
  .enum(["full_book", "volume", "arc", "chapter_batch"])
  .default("chapter_batch");
const outlineBasisSchema = z.record(z.string(), z.unknown()).default({});
const outlineRelationIdsSchema = z.array(z.string().min(1)).default([]);
const sceneOutlineBeatTypeSchema = z
  .enum([
    "opening_hook",
    "setup",
    "conflict",
    "reversal",
    "reveal",
    "payoff",
    "transition",
    "climax",
    "aftermath",
    "custom",
  ])
  .default("custom");
const entityRelationStatusValueSchema = z.enum(["draft", "confirmed", "archived"]);
const entityRelationStatusSchema = entityRelationStatusValueSchema.default("confirmed");
const entityRelationPatchSchema = z
  .object({
    description: z.string().max(500).nullable().optional(),
    polarity: z.number().min(-1).max(1).optional(),
    relationType: z.string().min(1).max(80).optional(),
    status: entityRelationStatusValueSchema.optional(),
    strength: z.number().min(0).max(1).optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "At least one entity relation field must be provided",
  });
const eventRelationTypeValueSchema = z.enum([
  "causes",
  "precedes",
  "blocks",
  "reveals",
  "foreshadows",
  "contrasts",
  "escalates",
  "resolves",
  "custom",
]);
const eventRelationTypeSchema = eventRelationTypeValueSchema.default("causes");
const eventRelationPatchSchema = z
  .object({
    description: z.string().max(500).nullable().optional(),
    relationType: eventRelationTypeValueSchema.optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "At least one event relation field must be provided",
  });
const conflictTypeValueSchema = z.enum([
  "survival",
  "resource",
  "power",
  "relationship",
  "ideology",
  "mystery",
  "internal",
  "external",
  "custom",
]);
const conflictTypeSchema = conflictTypeValueSchema.default("custom");
const conflictStatusValueSchema = z.enum(["planned", "active", "resolved", "archived"]);
const conflictStatusSchema = conflictStatusValueSchema.default("planned");
const conflictPatchSchema = z
  .object({
    conflictType: conflictTypeValueSchema.optional(),
    escalationPath: z.array(z.string().min(1).max(160)).max(20).optional(),
    opposingForces: z.array(z.string().min(1).max(120)).max(12).optional(),
    relatedPlotlineId: z.string().min(1).nullable().optional(),
    stakes: z.string().min(1).max(800).optional(),
    status: conflictStatusValueSchema.optional(),
    title: z.string().min(1).max(120).optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "At least one conflict field must be provided",
  });

const storyEventTypeValueSchema = z.enum([
  "decision",
  "discovery",
  "conflict",
  "reveal",
  "loss",
  "victory",
  "betrayal",
  "travel",
  "custom",
]);
const storyEventTypeSchema = storyEventTypeValueSchema.default("custom");

const storyEventStatusValueSchema = z.enum(["draft", "planned", "canon", "archived"]);
const storyEventStatusSchema = storyEventStatusValueSchema.default("canon");

const storyEventParticipantSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  role: z.string().min(1).default("participant"),
});

const storyEventPatchSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    eventType: storyEventTypeValueSchema.optional(),
    status: storyEventStatusValueSchema.optional(),
    chapterId: z.string().min(1).nullable().optional(),
    sceneId: z.string().min(1).nullable().optional(),
    storyTime: z.string().nullable().optional(),
    outcome: z.string().optional(),
    participants: z.array(storyEventParticipantSchema).optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "At least one story event field must be provided",
  });

const foreshadowingStatusValueSchema = z.enum(["seeded", "payoff_ready", "paid_off", "archived"]);
const foreshadowingStatusSchema = foreshadowingStatusValueSchema.default("seeded");

const foreshadowingPatchSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().min(1).nullable().optional(),
    payoffExpectation: z.string().nullable().optional(),
    importance: z.number().int().min(1).max(5).optional(),
    seedEventId: z.string().min(1).nullable().optional(),
    payoffEventId: z.string().min(1).nullable().optional(),
    status: foreshadowingStatusValueSchema.optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "At least one foreshadowing field must be provided",
  });

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
    scope: outlineScopeSchema,
    chapterCount: z.union([z.literal(3), z.literal(5), z.literal(10)]).default(10),
  }),
  "outline.saveDraft": projectIdPayloadSchema.extend({
    basis: outlineBasisSchema,
    outlineId: z.string().min(1).optional(),
    scope: outlineScopeSchema,
    status: outlinePlanStatusSchema,
    title: z.string().min(1).max(120),
  }),
  "outline.saveVolumeOutline": projectIdPayloadSchema.extend({
    climax: outlinePlanOptionalTextFieldSchema,
    majorConflict: outlinePlanOptionalTextFieldSchema,
    outlineId: z.string().min(1),
    purpose: outlinePlanTextFieldSchema,
    sortOrder: z.number().int().min(0).max(500),
    status: outlinePlanStatusSchema,
    title: z.string().min(1).max(120),
    volumeId: z.string().min(1).nullable().optional(),
    volumeOutlineId: z.string().min(1).optional(),
    wordCountGoal: z.number().int().min(1_000).max(2_000_000).nullable().optional(),
  }),
  "outline.saveChapterOutline": projectIdPayloadSchema.extend({
    chapterGoal: outlinePlanTextFieldSchema,
    chapterId: z.string().min(1).nullable().optional(),
    chapterOutlineId: z.string().min(1).optional(),
    conflict: outlinePlanOptionalTextFieldSchema,
    emotionalTurn: outlinePlanOptionalTextFieldSchema,
    hook: outlinePlanOptionalTextFieldSchema,
    informationGain: outlinePlanOptionalTextFieldSchema,
    outlineId: z.string().min(1),
    relatedForeshadowingIds: outlineRelationIdsSchema,
    relatedPlotlineNodeIds: outlineRelationIdsSchema,
    requiredCharacterIds: outlineRelationIdsSchema,
    requiredLocationIds: outlineRelationIdsSchema,
    sortOrder: z.number().int().min(0).max(10_000),
    status: outlinePlanStatusSchema,
    targetWordCount: z.number().int().min(500).max(20_000).nullable().optional(),
    title: z.string().min(1).max(120),
    volumeOutlineId: z.string().min(1).nullable().optional(),
  }),
  "outline.saveSceneOutline": projectIdPayloadSchema.extend({
    beatType: sceneOutlineBeatTypeSchema,
    chapterOutlineId: z.string().min(1),
    conflict: outlinePlanOptionalTextFieldSchema,
    entryState: outlinePlanOptionalTextFieldSchema,
    exitState: outlinePlanOptionalTextFieldSchema,
    locationId: z.string().min(1).nullable().optional(),
    povCharacterId: z.string().min(1).nullable().optional(),
    purpose: outlinePlanTextFieldSchema,
    sceneId: z.string().min(1).nullable().optional(),
    sceneOutlineId: z.string().min(1).optional(),
    sortOrder: z.number().int().min(0).max(10_000),
    status: outlinePlanStatusSchema,
    title: z.string().min(1).max(120),
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
  "plot.saveChapterPlan": projectIdPayloadSchema.extend({
    arcPlanId: outlinePlanOptionalIdSchema,
    chapterId: outlinePlanOptionalIdSchema,
    chapterGoal: outlinePlanTextFieldSchema,
    chapterIndex: z.number().int().positive().max(100_000),
    chapterPlanId: z.string().min(1).optional(),
    conflict: outlinePlanTextFieldSchema,
    emotionalTurn: outlinePlanTextFieldSchema,
    hook: outlinePlanTextFieldSchema,
    informationGain: outlinePlanTextFieldSchema,
    relatedCharacterIds: outlineRelationIdsSchema,
    relatedForeshadowingIds: outlineRelationIdsSchema,
    relatedPlotlineIds: outlineRelationIdsSchema,
    status: outlinePlanStatusSchema,
    targetWordCount: z.number().int().min(500).max(20_000),
    title: z.string().min(1).max(120),
  }),
  "plot.saveScenePlan": projectIdPayloadSchema.extend({
    chapterPlanId: z.string().min(1),
    conflictTurn: outlinePlanTextFieldSchema,
    locationId: outlinePlanOptionalIdSchema,
    memoryTargets: z.array(z.string().min(1).max(160)).max(20).default([]),
    outcome: outlinePlanTextFieldSchema,
    povCharacterId: outlinePlanOptionalIdSchema,
    sceneGoal: outlinePlanTextFieldSchema,
    sceneIndex: z.number().int().positive().max(100),
    scenePlanId: z.string().min(1).optional(),
    status: outlinePlanStatusSchema,
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
  "entityRelation.list": projectIdPayloadSchema.extend({
    entityId: z.string().min(1).optional(),
    entityType: z.string().min(1).optional(),
    status: entityRelationStatusValueSchema.optional(),
  }),
  "entityRelation.create": projectIdPayloadSchema.extend({
    description: z.string().max(500).optional(),
    polarity: z.number().min(-1).max(1).default(0),
    relationType: z.string().min(1).max(80),
    sourceEntityId: z.string().min(1),
    sourceEntityType: z.string().min(1).max(60),
    status: entityRelationStatusSchema,
    strength: z.number().min(0).max(1).default(0.5),
    targetEntityId: z.string().min(1),
    targetEntityType: z.string().min(1).max(60),
  }),
  "entityRelation.update": projectIdPayloadSchema.extend({
    entityRelationId: z.string().min(1),
    patch: entityRelationPatchSchema,
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
    description: z.string().max(500).optional(),
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
    eventType: storyEventTypeSchema,
    status: storyEventStatusSchema,
    chapterId: z.string().min(1).optional(),
    sceneId: z.string().min(1).optional(),
    locationId: z.string().min(1).optional(),
    storyTime: z.string().optional(),
    outcome: z.string().optional(),
    participants: z.array(storyEventParticipantSchema).default([]),
  }),
  "storyEvent.update": projectIdPayloadSchema.extend({
    storyEventId: z.string().min(1),
    patch: storyEventPatchSchema,
  }),
  "eventRelation.list": projectIdPayloadSchema.extend({
    eventId: z.string().min(1).optional(),
  }),
  "eventRelation.create": projectIdPayloadSchema.extend({
    description: z.string().max(500).optional(),
    relationType: eventRelationTypeSchema,
    sourceEventId: z.string().min(1),
    targetEventId: z.string().min(1),
  }),
  "eventRelation.update": projectIdPayloadSchema.extend({
    eventRelationId: z.string().min(1),
    patch: eventRelationPatchSchema,
  }),
  "conflict.list": projectIdPayloadSchema.extend({
    status: conflictStatusValueSchema.optional(),
  }),
  "conflict.create": projectIdPayloadSchema.extend({
    conflictType: conflictTypeSchema,
    escalationPath: z.array(z.string().min(1).max(160)).max(20).default([]),
    opposingForces: z.array(z.string().min(1).max(120)).max(12).default([]),
    relatedPlotlineId: z.string().min(1).nullable().optional(),
    stakes: z.string().min(1).max(800),
    status: conflictStatusSchema,
    title: z.string().min(1).max(120),
  }),
  "conflict.update": projectIdPayloadSchema.extend({
    conflictId: z.string().min(1),
    patch: conflictPatchSchema,
  }),
  "foreshadowing.list": projectIdPayloadSchema,
  "foreshadowing.create": projectIdPayloadSchema.extend({
    title: z.string().min(1),
    description: z.string().min(1),
    payoffExpectation: z.string().optional(),
    importance: z.number().int().min(1).max(5).default(3),
    seedEventId: z.string().min(1).optional(),
    payoffEventId: z.string().min(1).optional(),
    status: foreshadowingStatusSchema,
  }),
  "foreshadowing.update": projectIdPayloadSchema.extend({
    foreshadowingId: z.string().min(1),
    patch: foreshadowingPatchSchema,
  }),
  "foreshadowing.plan": projectIdPayloadSchema.extend({
    chapterId: z.string().min(1).optional(),
    plotlineId: z.string().min(1).optional(),
  }),
};
