import fastify, { type FastifyInstance } from "fastify";

import { createRpcError, createRpcSuccess, parseRpcRequest } from "@story-pilot/contracts";

export type SidecarServerOptions = {
  version?: string;
};

export type SidecarHealth = {
  service: "story-pilot-sidecar";
  status: "ok";
  version: string;
};

export function buildServer(options: SidecarServerOptions = {}): FastifyInstance {
  const version = options.version ?? "0.1.0";
  const server = fastify({ logger: false });

  server.get("/health", async (): Promise<SidecarHealth> => {
    return createHealth(version);
  });

  server.post("/rpc", async (request, reply) => {
    const parsed = parseRpcRequest(request.body);

    if (parsed.command === "app.health") {
      return createRpcSuccess(parsed.id, createHealth(version));
    }

    reply.code(404);
    return createRpcError(parsed.id, "UNKNOWN_COMMAND", `Unsupported command: ${parsed.command}`);
  });

  return server;
}

function createHealth(version: string): SidecarHealth {
  return {
    service: "story-pilot-sidecar",
    status: "ok",
    version,
  };
}

