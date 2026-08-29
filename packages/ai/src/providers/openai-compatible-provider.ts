import type {
  ModelProvider,
  ProviderEmbedInput,
  ProviderEmbedResult,
  ProviderGenerateObjectInput,
  ProviderObjectResult,
  ProviderStreamTextInput,
  TokenUsage,
} from "../model-gateway/types.js";

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface OpenAICompatibleProviderOptions {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;
  readonly fetch?: FetchLike;
}

interface ChatCompletionResponse {
  readonly choices?: Array<{
    readonly message?: {
      readonly content?: string | null;
    };
  }>;
  readonly usage?: {
    readonly prompt_tokens?: number;
    readonly completion_tokens?: number;
    readonly total_tokens?: number;
  };
}

interface EmbeddingsResponse {
  readonly data?: Array<{
    readonly embedding?: number[];
  }>;
  readonly usage?: {
    readonly prompt_tokens?: number;
    readonly total_tokens?: number;
  };
}

export class OpenAICompatibleProvider implements ModelProvider {
  readonly name = "openai-compatible";
  readonly model: string;

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: OpenAICompatibleProviderOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/u, "");
    this.apiKey = normalizeApiKey(options.apiKey);
    this.model = options.model;
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async generateObject(input: ProviderGenerateObjectInput): Promise<ProviderObjectResult> {
    const json = (await this.postJson("/chat/completions", {
      messages: input.messages,
      model: this.model,
      response_format: { type: "json_object" },
      ...(input.temperature === undefined ? {} : { temperature: input.temperature }),
    })) as ChatCompletionResponse;
    const content = json.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("OPENAI_COMPATIBLE_EMPTY_OBJECT_RESPONSE");
    }

    return {
      object: JSON.parse(content) as unknown,
      raw: json,
      ...withUsage(mapChatUsage(json.usage)),
    };
  }

  async *streamText(input: ProviderStreamTextInput): AsyncIterable<string> {
    const json = (await this.postJson("/chat/completions", {
      messages: input.messages,
      model: this.model,
      ...(input.temperature === undefined ? {} : { temperature: input.temperature }),
    })) as ChatCompletionResponse;
    const content = json.choices?.[0]?.message?.content;

    if (content) {
      yield content;
    }
  }

  async embed(input: ProviderEmbedInput): Promise<ProviderEmbedResult> {
    const json = (await this.postJson("/embeddings", {
      input: input.input,
      model: this.model,
    })) as EmbeddingsResponse;
    const embedding = json.data?.[0]?.embedding;

    if (!embedding) {
      throw new Error("OPENAI_COMPATIBLE_EMPTY_EMBEDDING_RESPONSE");
    }

    return {
      embedding,
      ...withUsage(mapEmbeddingUsage(json.usage)),
    };
  }

  private async postJson(path: string, body: unknown): Promise<unknown> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      body: JSON.stringify(body),
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`OPENAI_COMPATIBLE_HTTP_ERROR: ${response.status}`);
    }

    return response.json();
  }
}

function normalizeApiKey(apiKey: string): string {
  return apiKey.trim().replace(/^Bearer\s+/iu, "");
}

function mapChatUsage(usage: ChatCompletionResponse["usage"]): TokenUsage | undefined {
  if (!usage) {
    return undefined;
  }

  return {
    ...(usage.completion_tokens === undefined ? {} : { completionTokens: usage.completion_tokens }),
    ...(usage.prompt_tokens === undefined ? {} : { promptTokens: usage.prompt_tokens }),
    ...(usage.total_tokens === undefined ? {} : { totalTokens: usage.total_tokens }),
  };
}

function mapEmbeddingUsage(usage: EmbeddingsResponse["usage"]): TokenUsage | undefined {
  if (!usage) {
    return undefined;
  }

  return {
    ...(usage.prompt_tokens === undefined ? {} : { promptTokens: usage.prompt_tokens }),
    ...(usage.total_tokens === undefined ? {} : { totalTokens: usage.total_tokens }),
  };
}

function withUsage(usage: TokenUsage | undefined): { usage?: TokenUsage } {
  return usage === undefined ? {} : { usage };
}
