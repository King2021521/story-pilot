import type { z } from "zod";

export type ModelMessageRole = "system" | "user" | "assistant";

export interface ModelMessage {
  readonly role: ModelMessageRole;
  readonly content: string;
}

export interface TokenUsage {
  readonly promptTokens?: number;
  readonly completionTokens?: number;
  readonly totalTokens?: number;
}

export interface ModelCallMetadata {
  readonly provider: string;
  readonly model: string;
  readonly purpose: string;
  readonly schemaName?: string;
  readonly promptVersion?: string;
  readonly status: "completed" | "failed";
  readonly startedAt: number;
  readonly completedAt: number;
  readonly latencyMs: number;
  readonly usage?: TokenUsage;
}

export interface GenerateObjectInput<TSchema extends z.ZodType> {
  readonly purpose: string;
  readonly schemaName: string;
  readonly schema: TSchema;
  readonly messages: readonly ModelMessage[];
  readonly promptVersion?: string;
  readonly temperature?: number;
  readonly topP?: number;
  readonly maxOutputTokens?: number;
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
}

export interface GenerateObjectResult<TObject> {
  readonly object: TObject;
  readonly raw: unknown;
  readonly modelCall: ModelCallMetadata;
}

export interface StreamTextInput {
  readonly purpose: string;
  readonly messages: readonly ModelMessage[];
  readonly promptVersion?: string;
  readonly temperature?: number;
  readonly topP?: number;
  readonly maxOutputTokens?: number;
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
}

export interface EmbedInput {
  readonly purpose: string;
  readonly input: string;
}

export interface EmbedResult {
  readonly embedding: number[];
  readonly modelCall: ModelCallMetadata;
}

export interface ProviderGenerateObjectInput {
  readonly purpose: string;
  readonly schemaName: string;
  readonly messages: readonly ModelMessage[];
  readonly promptVersion?: string;
  readonly temperature?: number;
  readonly topP?: number;
  readonly maxOutputTokens?: number;
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
}

export interface ProviderObjectResult {
  readonly object: unknown;
  readonly raw?: unknown;
  readonly usage?: TokenUsage;
}

export interface ProviderStreamTextInput {
  readonly purpose: string;
  readonly messages: readonly ModelMessage[];
  readonly promptVersion?: string;
  readonly temperature?: number;
  readonly topP?: number;
  readonly maxOutputTokens?: number;
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
}

export interface ProviderEmbedInput {
  readonly purpose: string;
  readonly input: string;
}

export interface ProviderEmbedResult {
  readonly embedding: number[];
  readonly usage?: TokenUsage;
}

export interface ModelProvider {
  readonly name: string;
  readonly model: string;
  generateObject(input: ProviderGenerateObjectInput): Promise<ProviderObjectResult>;
  streamText(input: ProviderStreamTextInput): AsyncIterable<string>;
  embed(input: ProviderEmbedInput): Promise<ProviderEmbedResult>;
}
