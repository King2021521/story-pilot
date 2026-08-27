import { Module } from "@nestjs/common";

import { ArtifactModule } from "./artifact/artifact.module.js";
import { ChapterModule } from "./chapter/chapter.module.js";
import { HealthModule } from "./health/health.module.js";
import { ProjectModule } from "./project/project.module.js";
import { RpcModule } from "./rpc/rpc.module.js";

@Module({
  imports: [ArtifactModule, ChapterModule, HealthModule, ProjectModule, RpcModule],
})
export class AppModule {}
