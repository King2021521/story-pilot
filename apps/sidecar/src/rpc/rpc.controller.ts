import { Body, Controller, Post } from "@nestjs/common";
import type { RpcResponse } from "@story-pilot/contracts";

import { RpcService } from "./rpc.service.js";

@Controller()
export class RpcController {
  constructor(private readonly rpcService: RpcService) {}

  @Post("rpc")
  handle(@Body() body: unknown): Promise<RpcResponse> {
    return this.rpcService.handle(body);
  }
}

