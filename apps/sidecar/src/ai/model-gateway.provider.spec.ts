import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  ChapterDraftOutputSchema,
  ContinuityReviewOutputSchema,
  CoreStoryFieldCompletionOutputSchema,
  ElementCandidateOutputSchema,
  ForeshadowingPlanOutputSchema,
  MemoryExtractOutputSchema,
  WorldbuildingFieldCompletionOutputSchema,
} from "@story-pilot/ai";

import { createModelGatewayFromEnv, modelGatewayProvider } from "./model-gateway.provider.js";

describe("createModelGatewayFromEnv", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it("rejects production model calls when local LLM settings are missing", async () => {
    const gateway = createModelGatewayFromEnv({});

    await expect(
      gateway.generateObject({
        messages: [{ role: "user", content: "写第一章" }],
        purpose: "chapter_draft",
        schema: ChapterDraftOutputSchema,
        schemaName: "ChapterDraftOutput",
      }),
    ).rejects.toThrow("AI_MODEL_NOT_CONFIGURED");
  });

  it("uses deterministic fake MVP responses only when explicitly enabled", async () => {
    const gateway = createModelGatewayFromEnv({ STORY_PILOT_ALLOW_FAKE_MODEL: "true" });

    await expect(
      gateway.generateObject({
        messages: [{ role: "user", content: "写第一章" }],
        purpose: "chapter_draft",
        schema: ChapterDraftOutputSchema,
        schemaName: "ChapterDraftOutput",
      }),
    ).resolves.toMatchObject({
      object: {
        draft: {
          body: expect.any(String),
          summary: expect.any(String),
          title: expect.any(String),
        },
      },
    });
    await expect(
      gateway.generateObject({
        messages: [{ role: "user", content: "提取记忆" }],
        purpose: "memory_extract",
        schema: MemoryExtractOutputSchema,
        schemaName: "MemoryExtractOutput",
      }),
    ).resolves.toMatchObject({
      object: {
        memoryCandidates: expect.any(Array),
      },
    });
    await expect(
      gateway.generateObject({
        messages: [{ role: "user", content: "检查连续性" }],
        purpose: "continuity_review",
        schema: ContinuityReviewOutputSchema,
        schemaName: "ContinuityReviewOutput",
      }),
    ).resolves.toMatchObject({
      object: {
        issues: expect.any(Array),
        summary: expect.any(String),
      },
    });
    await expect(
      gateway.generateObject({
        messages: [{ role: "user", content: "规划伏笔" }],
        purpose: "foreshadowing_plan",
        schema: ForeshadowingPlanOutputSchema,
        schemaName: "ForeshadowingPlanOutput",
      }),
    ).resolves.toMatchObject({
      object: {
        suggestions: expect.any(Array),
        summary: expect.any(String),
      },
    });
    await expect(
      gateway.generateObject({
        messages: [{ role: "user", content: "生成武器候选" }],
        purpose: "element_generate",
        schema: ElementCandidateOutputSchema,
        schemaName: "ElementCandidateOutput",
      }),
    ).resolves.toMatchObject({
      object: {
        items: [expect.objectContaining({ name: expect.any(String), type: "weapon" })],
      },
    });
  });

  it("keeps deterministic fake planning responses aligned with strict completion schemas", async () => {
    const gateway = createModelGatewayFromEnv({ STORY_PILOT_ALLOW_FAKE_MODEL: "true" });

    await expect(
      gateway.generateObject({
        messages: [{ role: "user", content: "补全世界观" }],
        purpose: "worldbuilding_generate",
        schema: WorldbuildingFieldCompletionOutputSchema,
        schemaName: "WorldbuildingFieldCompletionOutput",
      }),
    ).resolves.toMatchObject({
      object: {
        fields: {
          worldBase: expect.any(String),
        },
      },
    });
    await expect(
      gateway.generateObject({
        messages: [{ role: "user", content: "补全核心故事" }],
        purpose: "core_story_complete",
        schema: CoreStoryFieldCompletionOutputSchema,
        schemaName: "CoreStoryFieldCompletionOutput",
      }),
    ).resolves.toMatchObject({
      object: {
        fields: {
          logline: expect.any(String),
          premise: expect.any(String),
        },
      },
    });
  });

  it("creates an OpenAI-compatible gateway from local LLM env settings", async () => {
    const calls: string[] = [];
    const gateway = createModelGatewayFromEnv(
      {
        STORY_PILOT_LLM_API_KEY: "test-key",
        STORY_PILOT_LLM_BASE_URL: "https://api.example.test/v1",
        STORY_PILOT_LLM_MODEL: "gpt-5.5",
      },
      async (url) => {
        calls.push(String(url));
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
    );

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
    expect(calls).toEqual(["https://api.example.test/v1/chat/completions"]);
  });

  it("applies retry and embedding model env settings to provider requests", async () => {
    const calls: Array<{ body: unknown; url: string }> = [];
    const gateway = createModelGatewayFromEnv(
      {
        STORY_PILOT_LLM_API_KEY: "test-key",
        STORY_PILOT_LLM_BASE_URL: "https://api.example.test/v1",
        STORY_PILOT_LLM_EMBEDDING_MODEL: "text-embedding-test",
        STORY_PILOT_LLM_MAX_RETRIES: "1",
        STORY_PILOT_LLM_MODEL: "gpt-5.5",
        STORY_PILOT_LLM_TIMEOUT_MS: "45000",
      },
      async (url, init) => {
        calls.push({
          body: JSON.parse(String(init?.body)),
          url: String(url),
        });

        if (String(url).endsWith("/chat/completions") && calls.length === 1) {
          return new Response(JSON.stringify({ error: "temporary" }), { status: 500 });
        }

        if (String(url).endsWith("/embeddings")) {
          return new Response(
            JSON.stringify({
              data: [{ embedding: [0.1, 0.2] }],
            }),
            { status: 200 },
          );
        }

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
    );

    await expect(
      gateway.generateObject({
        messages: [{ role: "user", content: "ping" }],
        purpose: "memory_extract",
        schema: z.object({ ok: z.boolean() }),
        schemaName: "Ping",
      }),
    ).resolves.toMatchObject({
      object: { ok: true },
    });
    await expect(gateway.embed({ input: "旧信", purpose: "memory_recall" })).resolves.toMatchObject(
      {
        embedding: [0.1, 0.2],
      },
    );

    expect(calls.map((call) => call.url)).toEqual([
      "https://api.example.test/v1/chat/completions",
      "https://api.example.test/v1/chat/completions",
      "https://api.example.test/v1/embeddings",
    ]);
    expect(calls[2]?.body).toMatchObject({
      model: "text-embedding-test",
    });
  });

  it("provider gateway reads updated model environment after settings changes", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      calls.push(String(url));
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
    });
    process.env.STORY_PILOT_LLM_API_KEY = "first-key";
    process.env.STORY_PILOT_LLM_BASE_URL = "https://api.first.test/v1";
    process.env.STORY_PILOT_LLM_MODEL = "first-model";

    const gateway = modelGatewayProvider.useFactory();
    await gateway.generateObject({
      messages: [{ role: "user", content: "ping" }],
      purpose: "test",
      schema: z.object({ ok: z.boolean() }),
      schemaName: "Ping",
    });

    process.env.STORY_PILOT_LLM_API_KEY = "second-key";
    process.env.STORY_PILOT_LLM_BASE_URL = "https://api.second.test/v1";
    process.env.STORY_PILOT_LLM_MODEL = "second-model";

    await gateway.generateObject({
      messages: [{ role: "user", content: "ping" }],
      purpose: "test",
      schema: z.object({ ok: z.boolean() }),
      schemaName: "Ping",
    });

    expect(calls).toEqual([
      "https://api.first.test/v1/chat/completions",
      "https://api.second.test/v1/chat/completions",
    ]);
  });
});
