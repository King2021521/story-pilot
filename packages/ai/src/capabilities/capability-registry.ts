import type { PromptCapability } from "../prompts/prompt-registry.js";

export const AI_CAPABILITY_NAMES = [
  "idea.generateConcepts",
  "storyBible.generate",
  "outline.generate",
  "chapter.draft",
  "text.rewrite",
  "memory.extract",
  "continuity.review",
  "foreshadowing.plan",
  "element.generateNames",
] as const;

export type AiCapabilityName = (typeof AI_CAPABILITY_NAMES)[number];

export interface AiCapabilityDefinition {
  readonly name: AiCapabilityName;
  readonly purpose: string;
  readonly promptCapability?: PromptCapability;
}

const capabilities: Record<AiCapabilityName, AiCapabilityDefinition> = {
  "chapter.draft": {
    name: "chapter.draft",
    promptCapability: "chapter_draft",
    purpose: "chapter_draft",
  },
  "continuity.review": {
    name: "continuity.review",
    promptCapability: "continuity_review",
    purpose: "continuity_review",
  },
  "element.generateNames": {
    name: "element.generateNames",
    purpose: "element_generate_names",
  },
  "foreshadowing.plan": {
    name: "foreshadowing.plan",
    promptCapability: "foreshadowing_plan",
    purpose: "foreshadowing_plan",
  },
  "idea.generateConcepts": {
    name: "idea.generateConcepts",
    purpose: "idea_generate_concepts",
  },
  "memory.extract": {
    name: "memory.extract",
    promptCapability: "memory_extract",
    purpose: "memory_extract",
  },
  "outline.generate": {
    name: "outline.generate",
    purpose: "outline_generate",
  },
  "storyBible.generate": {
    name: "storyBible.generate",
    purpose: "story_bible_generate",
  },
  "text.rewrite": {
    name: "text.rewrite",
    purpose: "text_rewrite",
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
