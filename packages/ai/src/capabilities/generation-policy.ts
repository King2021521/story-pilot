export interface GenerationPolicy {
  readonly temperature?: number;
  readonly topP?: number;
  readonly maxOutputTokens?: number;
}

const defaultPolicy: GenerationPolicy = {
  maxOutputTokens: 4000,
  temperature: 0.6,
};

const policies: Record<string, GenerationPolicy> = {
  blueprint_generate: {
    maxOutputTokens: 4500,
    temperature: 0.65,
  },
  book_plan_generate: {
    maxOutputTokens: 12000,
    temperature: 0.5,
  },
  brief_refine: {
    maxOutputTokens: 2500,
    temperature: 0.45,
  },
  chapter_draft: {
    maxOutputTokens: 12000,
    temperature: 0.82,
  },
  chapter_rewrite: {
    maxOutputTokens: 8000,
    temperature: 0.65,
  },
  continuity_review: {
    maxOutputTokens: 4000,
    temperature: 0.2,
  },
  core_story_complete: {
    maxOutputTokens: 8000,
    temperature: 0.7,
  },
  element_generate: {
    maxOutputTokens: 5000,
    temperature: 0.8,
  },
  foreshadowing_plan: {
    maxOutputTokens: 3000,
    temperature: 0.35,
  },
  memory_extract: {
    maxOutputTokens: 3500,
    temperature: 0.2,
  },
  outline_generate: {
    maxOutputTokens: 5000,
    temperature: 0.55,
  },
  plot_arc_generate: {
    maxOutputTokens: 5000,
    temperature: 0.72,
  },
  relationship_generate: {
    maxOutputTokens: 3500,
    temperature: 0.68,
  },
  retrospective_generate: {
    maxOutputTokens: 4500,
    temperature: 0.35,
  },
  rolling_chapter_plan_generate: {
    maxOutputTokens: 12000,
    temperature: 0.45,
  },
  worldbuilding_generate: {
    maxOutputTokens: 12000,
    temperature: 0.65,
  },
};

export function getGenerationPolicy(purpose: string): GenerationPolicy {
  return policies[purpose] ?? defaultPolicy;
}
