import type {
  ModelProvider,
  ProviderEmbedInput,
  ProviderEmbedResult,
  ProviderGenerateObjectInput,
  ProviderObjectResult,
  ProviderStreamTextInput,
} from "../model-gateway/types.js";

export interface FakeModelProviderOptions {
  readonly objectResponses?: Record<string, unknown>;
  readonly textChunks?: readonly string[];
  readonly embedding?: readonly number[];
}

export class FakeModelProvider implements ModelProvider {
  readonly name = "fake";
  readonly model = "fake-model";

  constructor(private readonly options: FakeModelProviderOptions = {}) {}

  async generateObject(input: ProviderGenerateObjectInput): Promise<ProviderObjectResult> {
    const object = this.options.objectResponses?.[input.schemaName] ?? this.options.objectResponses?.[input.purpose];

    if (object === undefined) {
      throw new Error(`FAKE_MODEL_RESPONSE_NOT_FOUND: ${input.schemaName}`);
    }

    return {
      object,
      raw: {
        object,
        provider: this.name,
      },
    };
  }

  async *streamText(_input: ProviderStreamTextInput): AsyncIterable<string> {
    void _input;
    for (const chunk of this.options.textChunks ?? []) {
      yield chunk;
    }
  }

  async embed(_input: ProviderEmbedInput): Promise<ProviderEmbedResult> {
    void _input;
    return {
      embedding: [...(this.options.embedding ?? [])],
    };
  }
}
