import type { z } from "zod";

import { getGenerationPolicy } from "../capabilities/generation-policy.js";
import type {
  EmbedInput,
  EmbedResult,
  GenerateObjectInput,
  GenerateObjectResult,
  ModelCallMetadata,
  ModelProvider,
  StreamTextInput,
  TokenUsage,
} from "./types.js";

export interface ModelGatewayOptions {
  readonly maxRetries?: number;
  readonly timeoutMs?: number;
}

export class ModelGateway {
  constructor(
    private readonly provider: ModelProvider,
    private readonly options: ModelGatewayOptions = {},
  ) {}

  async generateObject<TSchema extends z.ZodType>(
    input: GenerateObjectInput<TSchema>,
  ): Promise<GenerateObjectResult<z.infer<TSchema>>> {
    const startedAt = Date.now();
    const request = this.buildProviderObjectInput(input);
    const result = await this.generateObjectWithRetries(request, input.schema);
    const completedAt = Date.now();

    return {
      modelCall: this.createMetadata({
        completedAt,
        purpose: input.purpose,
        schemaName: input.schemaName,
        startedAt,
        status: "completed",
        ...(input.promptVersion === undefined ? {} : { promptVersion: input.promptVersion }),
        ...(result.usage === undefined ? {} : { usage: result.usage }),
      }),
      object: result.object,
      raw: result.raw ?? result.object,
    };
  }

  streamText(input: StreamTextInput): AsyncIterable<string> {
    const policy = getGenerationPolicy(input.purpose);

    return this.provider.streamText({
      messages: input.messages,
      purpose: input.purpose,
      ...(input.promptVersion === undefined ? {} : { promptVersion: input.promptVersion }),
      ...withOptionalNumber("temperature", input.temperature ?? policy.temperature),
      ...withOptionalNumber("topP", input.topP ?? policy.topP),
      ...withOptionalInteger("maxOutputTokens", input.maxOutputTokens ?? policy.maxOutputTokens),
      ...withOptionalInteger("timeoutMs", input.timeoutMs ?? this.options.timeoutMs),
      ...withOptionalInteger("maxRetries", input.maxRetries ?? this.options.maxRetries),
    });
  }

  async embed(input: EmbedInput): Promise<EmbedResult> {
    const startedAt = Date.now();
    const result = await this.provider.embed(input);
    const completedAt = Date.now();

    return {
      embedding: result.embedding,
      modelCall: this.createMetadata({
        completedAt,
        purpose: input.purpose,
        startedAt,
        status: "completed",
        ...(result.usage === undefined ? {} : { usage: result.usage }),
      }),
    };
  }

  private createMetadata(input: {
    readonly purpose: string;
    readonly status: ModelCallMetadata["status"];
    readonly startedAt: number;
    readonly completedAt: number;
    readonly schemaName?: string;
    readonly promptVersion?: string;
    readonly usage?: TokenUsage;
  }): ModelCallMetadata {
    return {
      completedAt: input.completedAt,
      latencyMs: input.completedAt - input.startedAt,
      model: this.provider.model,
      provider: this.provider.name,
      purpose: input.purpose,
      startedAt: input.startedAt,
      status: input.status,
      ...(input.promptVersion === undefined ? {} : { promptVersion: input.promptVersion }),
      ...(input.schemaName === undefined ? {} : { schemaName: input.schemaName }),
      ...(input.usage === undefined ? {} : { usage: input.usage }),
    };
  }

  private buildProviderObjectInput<TSchema extends z.ZodType>(input: GenerateObjectInput<TSchema>) {
    const policy = getGenerationPolicy(input.purpose);

    return {
      messages: input.messages,
      purpose: input.purpose,
      schemaName: input.schemaName,
      ...(input.promptVersion === undefined ? {} : { promptVersion: input.promptVersion }),
      ...withOptionalNumber("temperature", input.temperature ?? policy.temperature),
      ...withOptionalNumber("topP", input.topP ?? policy.topP),
      ...withOptionalInteger("maxOutputTokens", input.maxOutputTokens ?? policy.maxOutputTokens),
      ...withOptionalInteger("timeoutMs", input.timeoutMs ?? this.options.timeoutMs),
      ...withOptionalInteger("maxRetries", input.maxRetries ?? this.options.maxRetries),
    };
  }

  private async generateObjectWithRetries<TSchema extends z.ZodType>(
    request: ReturnType<ModelGateway["buildProviderObjectInput"]>,
    schema: TSchema,
  ): Promise<{ object: z.infer<TSchema>; raw?: unknown; usage?: TokenUsage }> {
    const maxRetries = Math.max(0, request.maxRetries ?? 0);
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const result = await this.provider.generateObject(request);
        return {
          ...result,
          object: schema.parse(result.object),
        };
      } catch (error) {
        lastError = error;
        if (attempt >= maxRetries) {
          break;
        }
      }
    }

    throw lastError;
  }
}

function withOptionalNumber<TName extends string>(
  name: TName,
  value: number | undefined,
): { readonly [Key in TName]?: number } {
  return value === undefined || !Number.isFinite(value)
    ? {}
    : ({ [name]: value } as { readonly [Key in TName]?: number });
}

function withOptionalInteger<TName extends string>(
  name: TName,
  value: number | undefined,
): { readonly [Key in TName]?: number } {
  return value === undefined || !Number.isFinite(value)
    ? {}
    : ({ [name]: Math.trunc(value) } as { readonly [Key in TName]?: number });
}
