import "reflect-metadata";

import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";

import { HealthService } from "../health/health.service.js";
import { RpcController } from "./rpc.controller.js";
import { RpcService } from "./rpc.service.js";

describe("RpcController", () => {
  it("handles app.health through the RPC envelope", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [RpcController],
      providers: [RpcService, HealthService],
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
      controllers: [RpcController],
      providers: [RpcService, HealthService],
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
});

