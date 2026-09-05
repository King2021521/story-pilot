export type AiArtifactStatus = "draft" | "applied" | "rejected" | "archived";

export const DEFAULT_CONTEXT_TOKEN_BUDGET = 12_000;

export * from "./model-gateway/model-gateway.js";
export * from "./model-gateway/types.js";
export * from "./capabilities/capability-registry.js";
export * from "./capabilities/generation-policy.js";
export * from "./context-builder/context-builder.js";
export * from "./eval/prompt-eval.js";
export * from "./prompts/prompt-registry.js";
export * from "./prompts/prompt-template-registry.js";
export * from "./providers/fake-model-provider.js";
export * from "./providers/openai-compatible-provider.js";
export * from "./structured-output/chapter-draft.schema.js";
export * from "./structured-output/chapter-execution-card.schema.js";
export * from "./structured-output/chapter-review.schema.js";
export * from "./structured-output/book-plan-generate.schema.js";
export * from "./structured-output/blueprint-generate.schema.js";
export * from "./structured-output/continuity-review.schema.js";
export * from "./structured-output/core-story-field-completion.schema.js";
export * from "./structured-output/element-candidate.schema.js";
export * from "./structured-output/foreshadowing-plan.schema.js";
export * from "./structured-output/memory-extract.schema.js";
export * from "./structured-output/outline-generate.schema.js";
export * from "./structured-output/rolling-chapter-plan-generate.schema.js";
export * from "./structured-output/serial-review.schema.js";
export * from "./structured-output/story-state-delta.schema.js";
export * from "./structured-output/worldbuilding-field-completion.schema.js";
