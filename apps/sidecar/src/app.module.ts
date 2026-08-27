import { Module } from "@nestjs/common";

import { ArtifactModule } from "./artifact/artifact.module.js";
import { CharacterModule } from "./character/character.module.js";
import { ChapterModule } from "./chapter/chapter.module.js";
import { HealthModule } from "./health/health.module.js";
import { PlotModule } from "./plot/plot.module.js";
import { ProjectModule } from "./project/project.module.js";
import { RpcModule } from "./rpc/rpc.module.js";
import { WorldModule } from "./world/world.module.js";

@Module({
  imports: [
    ArtifactModule,
    CharacterModule,
    ChapterModule,
    HealthModule,
    PlotModule,
    ProjectModule,
    RpcModule,
    WorldModule,
  ],
})
export class AppModule {}
