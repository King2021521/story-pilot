import "reflect-metadata";

import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";

import { RpcController } from "./rpc.controller.js";
import { RpcModule } from "./rpc.module.js";

describe("RpcController", () => {
  it("handles app.health through the RPC envelope", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [RpcModule],
    }).compile();

    const controller = moduleRef.get(RpcController);

    await expect(
      controller.handle({
        id: "req_1",
        command: "app.health",
        payload: { source: "test" },
      }),
    ).resolves.toMatchObject({
      id: "req_1",
      ok: true,
      data: {
        service: "story-pilot-sidecar",
        status: "ok",
      },
    });
  });

  it("returns a normalized error for unknown commands", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [RpcModule],
    }).compile();

    const controller = moduleRef.get(RpcController);

    await expect(
      controller.handle({
        id: "req_2",
        command: "unknown.command",
      }),
    ).resolves.toEqual({
      id: "req_2",
      ok: false,
      error: {
        code: "UNKNOWN_COMMAND",
        message: "Unsupported command: unknown.command",
      },
    });
  });

  it("rejects RPC requests when a bridge token is configured and does not match", async () => {
    const previousToken = process.env.STORY_PILOT_SIDECAR_TOKEN;
    process.env.STORY_PILOT_SIDECAR_TOKEN = "test-bridge-token";
    const moduleRef = await Test.createTestingModule({
      imports: [RpcModule],
    }).compile();
    const controller = moduleRef.get(RpcController);

    try {
      await expect(
        controller.handle(
          {
            id: "req_auth",
            command: "app.health",
          },
          "wrong-token",
        ),
      ).resolves.toEqual({
        id: "req_auth",
        ok: false,
        error: {
          code: "SECURITY_FORBIDDEN",
          message: "Invalid sidecar bridge token",
        },
      });
    } finally {
      if (previousToken === undefined) {
        delete process.env.STORY_PILOT_SIDECAR_TOKEN;
      } else {
        process.env.STORY_PILOT_SIDECAR_TOKEN = previousToken;
      }
      await moduleRef.close();
    }
  });
});
