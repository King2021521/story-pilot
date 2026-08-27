import { Module } from "@nestjs/common";

import { HealthModule } from "./health/health.module.js";
import { RpcModule } from "./rpc/rpc.module.js";

@Module({
  imports: [HealthModule, RpcModule],
})
export class AppModule {}

