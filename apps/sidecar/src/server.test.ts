import { afterEach, describe, expect, it } from "vitest";

import { buildServer } from "./server.js";

const servers: Array<{ close: () => Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("sidecar server", () => {
  it("returns sidecar health", async () => {
    const server = buildServer({ version: "test" });
    servers.push(server);

    const response = await server.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      service: "story-pilot-sidecar",
      status: "ok",
      version: "test",
    });
  });

  it("handles the app.health rpc command", async () => {
    const server = buildServer({ version: "test" });
    servers.push(server);

    const response = await server.inject({
      method: "POST",
      url: "/rpc",
      payload: {
        id: "req_1",
        command: "app.health",
        payload: { source: "test" },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: "req_1",
      ok: true,
      data: {
        service: "story-pilot-sidecar",
        status: "ok",
        version: "test",
      },
    });
  });
});

