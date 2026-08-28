import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  ChapterDraftOutputSchema,
  ContinuityReviewOutputSchema,
  ElementCandidateOutputSchema,
  ForeshadowingPlanOutputSchema,
  MemoryExtractOutputSchema,
} from "@story-pilot/ai";

import { createModelGatewayFromEnv } from "./model-gateway.provider.js";

describe("createModelGatewayFromEnv", () => {
  it("uses deterministic fake MVP responses when local LLM env is missing", async () => {
    const gateway = createModelGatewayFromEnv({});

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
});
