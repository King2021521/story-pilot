import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import type { ModelMessage } from "../model-gateway/types.js";

export type PromptCapability =
  | "brief_refine"
  | "blueprint_generate"
  | "core_story_complete"
  | "worldbuilding_generate"
  | "character_generate"
  | "relationship_generate"
  | "plot_arc_generate"
  | "outline_generate"
  | "book_plan_generate"
  | "rolling_chapter_plan_generate"
  | "chapter_draft"
  | "chapter_execution_card_generate"
  | "chapter_review"
  | "chapter_rewrite"
  | "memory_extract"
  | "continuity_review"
  | "foreshadowing_plan"
  | "plot_debt_update"
  | "retrospective_generate"
  | "story_state_delta_extract"
  | "element_generate";
export type PromptVersion = "v1";

export interface PromptDefinition {
  readonly capability: PromptCapability | "global_writer" | "canon_boundary";
  readonly version: PromptVersion;
  readonly content: string;
  readonly contentHash: string;
}

export interface BuildPromptMessagesInput {
  readonly capability: PromptCapability;
  readonly version: PromptVersion;
  readonly instruction: string;
  readonly context?: string;
}

const promptFiles = {
  blueprint_generate: "./blueprint-generate/system.v1.md",
  canon_boundary: "./shared/canon-boundary.v1.md",
  brief_refine: "./brief-refine/system.v1.md",
  character_generate: "./character-generate/system.v1.md",
  chapter_draft: "./chapter-draft/system.v1.md",
  chapter_execution_card_generate: "./chapter-execution-card-generate/system.v1.md",
  chapter_review: "./chapter-review/system.v1.md",
  chapter_rewrite: "./chapter-rewrite/system.v1.md",
  continuity_review: "./continuity-review/system.v1.md",
  core_story_complete: "./core-story-complete/system.v1.md",
  element_generate: "./element-generate/system.v1.md",
  foreshadowing_plan: "./foreshadowing-plan/system.v1.md",
  global_writer: "./shared/global-writer-system.v1.md",
  memory_extract: "./memory-extract/system.v1.md",
  outline_generate: "./outline-generate/system.v1.md",
  book_plan_generate: "./book-plan-generate/system.v1.md",
  plot_debt_update: "./plot-debt-update/system.v1.md",
  rolling_chapter_plan_generate: "./rolling-chapter-plan-generate/system.v1.md",
  plot_arc_generate: "./plot-arc-generate/system.v1.md",
  relationship_generate: "./relationship-generate/system.v1.md",
  retrospective_generate: "./retrospective-generate/system.v1.md",
  story_state_delta_extract: "./story-state-delta-extract/system.v1.md",
  worldbuilding_generate: "./worldbuilding-generate/system.v1.md",
} as const;

const promptCache = new Map<string, PromptDefinition>();

export const PromptRegistry = {
  getPrompt(capability: PromptDefinition["capability"], version: PromptVersion): PromptDefinition {
    const key = `${capability}:${version}`;
    const cached = promptCache.get(key);
    if (cached) {
      return cached;
    }

    const content = readFileSync(new URL(promptFiles[capability], import.meta.url), "utf8").trim();
    const prompt = {
      capability,
      content,
      contentHash: hashPromptContent(content),
      version,
    };
    promptCache.set(key, prompt);
    return prompt;
  },
};

export function buildPromptMessages(input: BuildPromptMessagesInput): ModelMessage[] {
  const sharedPrompts = [
    PromptRegistry.getPrompt("global_writer", input.version),
    PromptRegistry.getPrompt("canon_boundary", input.version),
    PromptRegistry.getPrompt(input.capability, input.version),
  ];
  const context = input.context?.trim();
  const userContent = [
    context ? `上下文：\n${context}` : undefined,
    `用户指令：\n${input.instruction}`,
  ]
    .filter((value): value is string => value !== undefined)
    .join("\n\n");

  return [
    {
      role: "system",
      content: sharedPrompts.map((prompt) => prompt.content).join("\n\n"),
    },
    {
      role: "user",
      content: userContent,
    },
  ];
}

function hashPromptContent(content: string): string {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}
