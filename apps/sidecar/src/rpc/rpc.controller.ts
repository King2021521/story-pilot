import { Body, Controller, Headers, Post } from "@nestjs/common";
import { createRpcError, type RpcResponse } from "@story-pilot/contracts";

import { RpcService } from "./rpc.service.js";

@Controller()
export class RpcController {
  constructor(private readonly rpcService: RpcService) {}

  @Post("rpc")
  async handle(
    @Body() body: unknown,
    @Headers("x-story-pilot-bridge-token") bridgeToken?: string,
  ): Promise<RpcResponse> {
    if (!isBridgeTokenAllowed(bridgeToken)) {
      return createRpcError(
        extractRpcId(body),
        "SECURITY_FORBIDDEN",
        "Invalid sidecar bridge token",
      );
    }

    return this.rpcService.handle(body);
  }
}

function isBridgeTokenAllowed(bridgeToken: string | undefined): boolean {
  const requiredToken = process.env.STORY_PILOT_SIDECAR_TOKEN;
  if (!requiredToken) {
    return true;
  }

  return bridgeToken === requiredToken;
}

function extractRpcId(body: unknown): string {
  if (typeof body === "object" && body !== null && "id" in body && typeof body.id === "string") {
    return body.id;
  }

  return "unknown";
}
