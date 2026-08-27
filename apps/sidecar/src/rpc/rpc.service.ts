import { Injectable } from "@nestjs/common";
import {
  createRpcError,
  createRpcSuccess,
  parseRpcRequest,
  type RpcRequest,
  type RpcResponse,
} from "@story-pilot/contracts";

import { HealthService } from "../health/health.service.js";

@Injectable()
export class RpcService {
  constructor(private readonly healthService: HealthService) {}

  async handle(input: unknown): Promise<RpcResponse> {
    let request: RpcRequest;

    try {
      request = parseRpcRequest(input);
    } catch (error) {
      return createRpcError("unknown", "VALIDATION_FAILED", "RPC request validation failed", error);
    }

    if (request.command === "app.health") {
      return createRpcSuccess(request.id, this.healthService.getHealth());
    }

    return createRpcError(request.id, "UNKNOWN_COMMAND", `Unsupported command: ${request.command}`);
  }
}

