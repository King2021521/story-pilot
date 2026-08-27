export type AiArtifactStatus = "draft" | "applied" | "rejected" | "archived";

export const DEFAULT_CONTEXT_TOKEN_BUDGET = 12_000;

export * from "./model-gateway/model-gateway.js";
export * from "./model-gateway/types.js";
export * from "./prompts/prompt-registry.js";
export * from "./providers/fake-model-provider.js";
export * from "./providers/openai-compatible-provider.js";
