import type { PromptCapability } from "../prompts/prompt-registry.js";

export const AI_CAPABILITY_NAMES = [
  "brief.refine",
  "blueprint.generate",
  "worldbuilding.generate",
  "character.generate",
  "relationship.generate",
  "plotArc.generate",
  "outline.generate",
  "bookPlan.generate",
  "rollingOutline.generate",
  "chapter.draft",
  "chapter.rewrite",
  "continuity.review",
  "foreshadowing.plan",
  "memory.extract",
  "retrospective.generate",
  "element.generateCandidates",
] as const;

export type AiCapabilityName = (typeof AI_CAPABILITY_NAMES)[number];

export interface AiCapabilityDefinition {
  readonly name: AiCapabilityName;
  readonly displayName: string;
  readonly purpose: string;
  readonly promptCapability: PromptCapability;
  readonly defaultPromptVersion: "v1";
  readonly outputSchemaName: string;
  readonly entrypoint: "ai_generate" | "specialized_rpc" | "prompt_only";
}

const capabilities: Record<AiCapabilityName, AiCapabilityDefinition> = {
  "blueprint.generate": {
    defaultPromptVersion: "v1",
    displayName: "创作蓝图生成",
    entrypoint: "ai_generate",
    name: "blueprint.generate",
    outputSchemaName: "BlueprintGenerateOutput",
    promptCapability: "blueprint_generate",
    purpose: "blueprint_generate",
  },
  "brief.refine": {
    defaultPromptVersion: "v1",
    displayName: "立项精修",
    entrypoint: "prompt_only",
    name: "brief.refine",
    outputSchemaName: "BriefRefineOutput",
    promptCapability: "brief_refine",
    purpose: "brief_refine",
  },
  "bookPlan.generate": {
    defaultPromptVersion: "v1",
    displayName: "全书规划生成",
    entrypoint: "specialized_rpc",
    name: "bookPlan.generate",
    outputSchemaName: "BookPlanGenerateOutput",
    promptCapability: "book_plan_generate",
    purpose: "book_plan_generate",
  },
  "character.generate": {
    defaultPromptVersion: "v1",
    displayName: "人物生成",
    entrypoint: "prompt_only",
    name: "character.generate",
    outputSchemaName: "CharacterGenerateOutput",
    promptCapability: "character_generate",
    purpose: "character_generate",
  },
  "chapter.draft": {
    defaultPromptVersion: "v1",
    displayName: "章节草稿",
    entrypoint: "ai_generate",
    name: "chapter.draft",
    outputSchemaName: "ChapterDraftOutput",
    promptCapability: "chapter_draft",
    purpose: "chapter_draft",
  },
  "chapter.rewrite": {
    defaultPromptVersion: "v1",
    displayName: "章节改写",
    entrypoint: "prompt_only",
    name: "chapter.rewrite",
    outputSchemaName: "ChapterRewriteOutput",
    promptCapability: "chapter_rewrite",
    purpose: "chapter_rewrite",
  },
  "continuity.review": {
    defaultPromptVersion: "v1",
    displayName: "连续性审阅",
    entrypoint: "ai_generate",
    name: "continuity.review",
    outputSchemaName: "ContinuityReviewOutput",
    promptCapability: "continuity_review",
    purpose: "continuity_review",
  },
  "element.generateCandidates": {
    defaultPromptVersion: "v1",
    displayName: "要素候选生成",
    entrypoint: "specialized_rpc",
    name: "element.generateCandidates",
    outputSchemaName: "ElementCandidateOutput",
    promptCapability: "element_generate",
    purpose: "element_generate",
  },
  "foreshadowing.plan": {
    defaultPromptVersion: "v1",
    displayName: "伏笔规划",
    entrypoint: "ai_generate",
    name: "foreshadowing.plan",
    outputSchemaName: "ForeshadowingPlanOutput",
    promptCapability: "foreshadowing_plan",
    purpose: "foreshadowing_plan",
  },
  "memory.extract": {
    defaultPromptVersion: "v1",
    displayName: "记忆抽取",
    entrypoint: "ai_generate",
    name: "memory.extract",
    outputSchemaName: "MemoryExtractOutput",
    promptCapability: "memory_extract",
    purpose: "memory_extract",
  },
  "outline.generate": {
    defaultPromptVersion: "v1",
    displayName: "大纲生成",
    entrypoint: "ai_generate",
    name: "outline.generate",
    outputSchemaName: "OutlineGenerateOutput",
    promptCapability: "outline_generate",
    purpose: "outline_generate",
  },
  "rollingOutline.generate": {
    defaultPromptVersion: "v1",
    displayName: "滚动章节规划",
    entrypoint: "specialized_rpc",
    name: "rollingOutline.generate",
    outputSchemaName: "RollingChapterPlanGenerateOutput",
    promptCapability: "rolling_chapter_plan_generate",
    purpose: "rolling_chapter_plan_generate",
  },
  "plotArc.generate": {
    defaultPromptVersion: "v1",
    displayName: "剧情弧线生成",
    entrypoint: "prompt_only",
    name: "plotArc.generate",
    outputSchemaName: "PlotArcGenerateOutput",
    promptCapability: "plot_arc_generate",
    purpose: "plot_arc_generate",
  },
  "relationship.generate": {
    defaultPromptVersion: "v1",
    displayName: "人物关系生成",
    entrypoint: "prompt_only",
    name: "relationship.generate",
    outputSchemaName: "RelationshipGenerateOutput",
    promptCapability: "relationship_generate",
    purpose: "relationship_generate",
  },
  "retrospective.generate": {
    defaultPromptVersion: "v1",
    displayName: "阶段复盘生成",
    entrypoint: "prompt_only",
    name: "retrospective.generate",
    outputSchemaName: "RetrospectiveGenerateOutput",
    promptCapability: "retrospective_generate",
    purpose: "retrospective_generate",
  },
  "worldbuilding.generate": {
    defaultPromptVersion: "v1",
    displayName: "世界观生成",
    entrypoint: "specialized_rpc",
    name: "worldbuilding.generate",
    outputSchemaName: "WorldbuildingFieldCompletionOutput",
    promptCapability: "worldbuilding_generate",
    purpose: "worldbuilding_generate",
  },
};

export const CapabilityRegistry = {
  get(name: AiCapabilityName): AiCapabilityDefinition {
    return capabilities[name];
  },

  list(): readonly AiCapabilityDefinition[] {
    return AI_CAPABILITY_NAMES.map((name) => capabilities[name]);
  },
};
