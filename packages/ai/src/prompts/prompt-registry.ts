import { readFileSync } from "node:fs";

import type { ModelMessage } from "../model-gateway/types.js";

export type PromptCapability = "chapter_draft" | "memory_extract" | "continuity_review";
export type PromptVersion = "v1";

export interface PromptDefinition {
  readonly capability: PromptCapability | "global_writer" | "canon_boundary";
  readonly version: PromptVersion;
  readonly content: string;
}

export interface BuildPromptMessagesInput {
  readonly capability: PromptCapability;
  readonly version: PromptVersion;
  readonly instruction: string;
  readonly context?: string;
}

const promptFiles = {
  canon_boundary: "./shared/canon-boundary.v1.md",
  chapter_draft: "./chapter-draft/system.v1.md",
  continuity_review: "./continuity-review/system.v1.md",
  global_writer: "./shared/global-writer-system.v1.md",
  memory_extract: "./memory-extract/system.v1.md",
} as const;

const promptCache = new Map<string, PromptDefinition>();

export const PromptRegistry = {
  getPrompt(capability: PromptDefinition["capability"], version: PromptVersion): PromptDefinition {
    const key = `${capability}:${version}`;
    const cached = promptCache.get(key);
    if (cached) {
      return cached;
    }

    const prompt = {
      capability,
      content: readFileSync(new URL(promptFiles[capability], import.meta.url), "utf8").trim(),
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
