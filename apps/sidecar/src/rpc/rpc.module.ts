import { Module } from "@nestjs/common";

import { ArtifactModule } from "../artifact/artifact.module.js";
import { CharacterModule } from "../character/character.module.js";
import { ChapterModule } from "../chapter/chapter.module.js";
import { GraphModule } from "../graph/graph.module.js";
import { HealthModule } from "../health/health.module.js";
import { MemoryModule } from "../memory/memory.module.js";
import { PlotModule } from "../plot/plot.module.js";
import { ProjectModule } from "../project/project.module.js";
import { WorkflowModule } from "../workflow/workflow.module.js";
import { WorldModule } from "../world/world.module.js";
import { RpcController } from "./rpc.controller.js";
import { RpcService } from "./rpc.service.js";

@Module({
  controllers: [RpcController],
  imports: [
    ArtifactModule,
    CharacterModule,
    ChapterModule,
    GraphModule,
    HealthModule,
    MemoryModule,
    PlotModule,
    ProjectModule,
    WorkflowModule,
    WorldModule,
  ],
  providers: [RpcService],
})
export class RpcModule {}
