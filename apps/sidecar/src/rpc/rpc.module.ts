import { Module } from "@nestjs/common";

import { HealthModule } from "../health/health.module.js";
import { RpcController } from "./rpc.controller.js";
import { RpcService } from "./rpc.service.js";

@Module({
  controllers: [RpcController],
  imports: [HealthModule],
  providers: [RpcService],
})
export class RpcModule {}

