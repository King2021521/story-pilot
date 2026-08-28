import { Module } from "@nestjs/common";

import { ArtifactModule } from "../artifact/artifact.module.js";
import { CharacterModule } from "../character/character.module.js";
import { ChapterModule } from "../chapter/chapter.module.js";
import { CreativeModule } from "../creative/creative.module.js";
import { GraphModule } from "../graph/graph.module.js";
import { HealthModule } from "../health/health.module.js";
import { MemoryModule } from "../memory/memory.module.js";
import { PlotModule } from "../plot/plot.module.js";
import { ProjectModule } from "../project/project.module.js";
import { WorkflowModule } from "../workflow/workflow.module.js";
import { WorkbenchModule } from "../workbench/workbench.module.js";
import { WorldModule } from "../world/world.module.js";
import { RpcController } from "./rpc.controller.js";
import { RpcService } from "./rpc.service.js";

@Module({
  controllers: [RpcController],
  imports: [
    ArtifactModule,
    CharacterModule,
    ChapterModule,
    CreativeModule,
    GraphModule,
    HealthModule,
    MemoryModule,
    PlotModule,
    ProjectModule,
    WorkflowModule,
    WorkbenchModule,
    WorldModule,
  ],
  providers: [RpcService],
})
export class RpcModule {}
