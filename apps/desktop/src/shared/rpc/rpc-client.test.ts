import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TauriRpcClient } from "./rpc-client";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

describe("TauriRpcClient", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("falls back to an empty project list when the Tauri bridge is unavailable in web preview", async () => {
    invokeMock.mockRejectedValue(
      new TypeError("Cannot read properties of undefined (reading 'invoke')"),
    );

    await expect(
      new TauriRpcClient().send("project.listRecent", { limit: 20 }),
    ).resolves.toMatchObject({
      data: { items: [] },
      ok: true,
    });
  });
});
