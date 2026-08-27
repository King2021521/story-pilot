import { Module } from "@nestjs/common";

import { HealthModule } from "./health/health.module.js";
import { ProjectModule } from "./project/project.module.js";
import { RpcModule } from "./rpc/rpc.module.js";

@Module({
  imports: [HealthModule, ProjectModule, RpcModule],
})
export class AppModule {}
