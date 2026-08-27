import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createModelGatewayFromEnv } from "./model-gateway.provider.js";

describe("createModelGatewayFromEnv", () => {
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
