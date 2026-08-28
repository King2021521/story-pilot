import { describe, expect, it } from "vitest";

import { createRpcError, createRpcSuccess, parseRpcRequest } from "./index.js";

describe("rpc contract helpers", () => {
  it("parses a valid rpc request", () => {
    expect(
      parseRpcRequest({
        id: "req_1",
        command: "app.health",
        payload: { source: "test" },
      }),
    ).toEqual({
      id: "req_1",
      command: "app.health",
      payload: { source: "test" },
    });
  });

  it("rejects an empty command", () => {
    expect(() => parseRpcRequest({ id: "req_1", command: "" })).toThrow();
  });

  it("creates stable success and error envelopes", () => {
    expect(createRpcSuccess("req_1", { ok: true })).toEqual({
      id: "req_1",
      ok: true,
      data: { ok: true },
    });

    expect(createRpcError("req_1", "MODEL_PROVIDER_NOT_CONFIGURED", "模型未配置")).toEqual({
      id: "req_1",
      ok: false,
      error: {
        code: "MODEL_PROVIDER_NOT_CONFIGURED",
        message: "模型未配置",
      },
    });
  });
});
