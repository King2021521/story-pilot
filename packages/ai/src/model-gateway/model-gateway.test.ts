import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ModelGateway } from "./model-gateway.js";
import { FakeModelProvider } from "../providers/fake-model-provider.js";
import { OpenAICompatibleProvider } from "../providers/openai-compatible-provider.js";

describe("ModelGateway", () => {
  it("applies generation policies and explicit overrides before calling the provider", async () => {
    const provider = new RecordingProvider({ ok: true });
    const gateway = new ModelGateway(provider);

    await gateway.generateObject({
      maxOutputTokens: 1234,
      messages: [{ role: "user", content: "写一个章节草稿" }],
      purpose: "chapter_draft",
      schema: z.object({ ok: z.boolean() }),
      schemaName: "PolicyCheck",
      temperature: 0.33,
    });
    await gateway.generateObject({
      messages: [{ role: "user", content: "抽取记忆" }],
      purpose: "memory_extract",
      schema: z.object({ ok: z.boolean() }),
      schemaName: "PolicyCheck",
    });

    expect(provider.calls[0]).toMatchObject({
      maxOutputTokens: 1234,
      purpose: "chapter_draft",
      temperature: 0.33,
    });
    expect(provider.calls[1]).toMatchObject({
      maxOutputTokens: 3500,
      purpose: "memory_extract",
      temperature: 0.2,
    });
  });

  it("retries object generation once when the provider fails before succeeding", async () => {
    const provider = new FlakyProvider();
    const gateway = new ModelGateway(provider, { maxRetries: 1 });

    await expect(
      gateway.generateObject({
        messages: [{ role: "user", content: "ping" }],
        purpose: "test",
        schema: z.object({ ok: z.boolean() }),
        schemaName: "Ping",
      }),
    ).resolves.toMatchObject({
      object: { ok: true },
    });
    expect(provider.attempts).toBe(2);
  });

  it("generates typed objects through a fake provider", async () => {
    const gateway = new ModelGateway(
      new FakeModelProvider({
        objectResponses: {
          ChapterDraftOutput: {
            draft: {
              title: "第一章 雨夜来信",
              content: "雨夜来信。旧案重新浮出水面。",
            },
            memoryCandidates: [],
          },
        },
      }),
    );

    const result = await gateway.generateObject({
      purpose: "chapter_draft",
      schema: z.object({
        draft: z.object({
          title: z.string(),
          content: z.string(),
        }),
        memoryCandidates: z.array(z.unknown()),
      }),
      schemaName: "ChapterDraftOutput",
      messages: [{ role: "user", content: "生成第一章" }],
    });

    expect(result.object).toMatchObject({
      draft: {
        content: expect.stringContaining("雨夜来信"),
      },
    });
    expect(result.modelCall).toMatchObject({
      model: "fake-model",
      provider: "fake",
      purpose: "chapter_draft",
      schemaName: "ChapterDraftOutput",
      status: "completed",
    });
  });

  it("parses OpenAI-compatible JSON object responses", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const provider = new OpenAICompatibleProvider({
      apiKey: "test-key",
      baseUrl: "https://llm.example.test/v1",
      fetch: async (url, init) => {
        calls.push({
          body: JSON.parse(String(init?.body)),
          url: String(url),
        });

        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    draft: {
                      title: "第一章",
                      content: "门缝下有一封信。",
                    },
                  }),
                },
              },
            ],
            usage: {
              completion_tokens: 7,
              prompt_tokens: 11,
              total_tokens: 18,
            },
          }),
          {
            headers: { "content-type": "application/json" },
            status: 200,
          },
        );
      },
      model: "gpt-5.5",
    });
    const gateway = new ModelGateway(provider);

    const result = await gateway.generateObject({
      maxOutputTokens: 4096,
      purpose: "chapter_draft",
      schema: z.object({
        draft: z.object({
          title: z.string(),
          content: z.string(),
        }),
      }),
      schemaName: "ChapterDraftOutput",
      messages: [{ role: "user", content: "生成第一章" }],
      temperature: 0.42,
      topP: 0.9,
    });

    expect(calls[0]).toMatchObject({
      body: {
        max_tokens: 4096,
        temperature: 0.42,
        top_p: 0.9,
      },
      url: "https://llm.example.test/v1/chat/completions",
    });
    expect(result.object.draft.content).toContain("门缝下");
    expect(result.modelCall.usage?.totalTokens).toBe(18);
  });

  it("normalizes OpenAI-compatible API keys that include a bearer prefix", async () => {
    let authorizationHeader: string | undefined;
    const provider = new OpenAICompatibleProvider({
      apiKey: "Bearer test-key",
      baseUrl: "https://llm.example.test/v1",
      fetch: async (_url, init) => {
        authorizationHeader = (init?.headers as Record<string, string> | undefined)?.authorization;

        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({ ok: true }),
                },
              },
            ],
          }),
          { status: 200 },
        );
      },
      model: "gpt-5.5",
    });
    const gateway = new ModelGateway(provider);

    await gateway.generateObject({
      messages: [{ role: "user", content: "ping" }],
      purpose: "test",
      schema: z.object({ ok: z.boolean() }),
      schemaName: "Ping",
    });

    expect(authorizationHeader).toBe("Bearer test-key");
  });

  it("streams text and embeddings through the configured provider", async () => {
    const gateway = new ModelGateway(
      new FakeModelProvider({
        embedding: [0.1, 0.2, 0.3],
        textChunks: ["雨夜", "来信"],
      }),
    );

    const chunks: string[] = [];
    for await (const chunk of gateway.streamText({
      messages: [{ role: "user", content: "继续写" }],
      purpose: "rewrite",
    })) {
      chunks.push(chunk);
    }

    await expect(
      gateway.embed({
        input: "林澈怀疑周潜。",
        purpose: "memory_recall",
      }),
    ).resolves.toMatchObject({
      embedding: [0.1, 0.2, 0.3],
    });
    expect(chunks.join("")).toBe("雨夜来信");
  });
});

class RecordingProvider {
  readonly calls: unknown[] = [];
  readonly model = "recording-model";
  readonly name = "recording";

  constructor(private readonly object: unknown) {}

  async generateObject(input: unknown) {
    this.calls.push(input);

    return { object: this.object };
  }

  streamText(): AsyncIterable<string> {
    return (async function* emptyStream() {})();
  }

  async embed() {
    return { embedding: [] };
  }
}

class FlakyProvider {
  readonly model = "flaky-model";
  readonly name = "flaky";
  attempts = 0;

  async generateObject() {
    this.attempts += 1;
    if (this.attempts === 1) {
      throw new Error("temporary failure");
    }

    return { object: { ok: true } };
  }

  streamText(): AsyncIterable<string> {
    return (async function* emptyStream() {})();
  }

  async embed() {
    return { embedding: [] };
  }
}
