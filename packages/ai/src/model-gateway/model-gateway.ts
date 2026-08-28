import type { z } from "zod";

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

export class ModelGateway {
  constructor(private readonly provider: ModelProvider) {}

  async generateObject<TSchema extends z.ZodType>(
    input: GenerateObjectInput<TSchema>,
  ): Promise<GenerateObjectResult<z.infer<TSchema>>> {
    const startedAt = Date.now();
    const result = await this.provider.generateObject({
      messages: input.messages,
      purpose: input.purpose,
      schemaName: input.schemaName,
      ...(input.promptVersion === undefined ? {} : { promptVersion: input.promptVersion }),
      ...(input.temperature === undefined ? {} : { temperature: input.temperature }),
    });
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
      object: input.schema.parse(result.object),
      raw: result.raw ?? result.object,
    };
  }

  streamText(input: StreamTextInput): AsyncIterable<string> {
    return this.provider.streamText(input);
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
}
