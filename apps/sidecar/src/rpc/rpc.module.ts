import { Module } from "@nestjs/common";

import { ArtifactModule } from "../artifact/artifact.module.js";
import { AiCommandModule } from "../ai-command/ai-command.module.js";
import { CharacterModule } from "../character/character.module.js";
import { ChapterModule } from "../chapter/chapter.module.js";
import { ContextPackageModule } from "../context-package/context-package.module.js";
import { CreativeModule } from "../creative/creative.module.js";
import { CreativePathModule } from "../creative-path/creative-path.module.js";
import { DiagnosticsModule } from "../diagnostics/diagnostics.module.js";
import { GraphModule } from "../graph/graph.module.js";
import { HealthModule } from "../health/health.module.js";
import { MemoryModule } from "../memory/memory.module.js";
import { OutlineModule } from "../outline/outline.module.js";
import { PlotModule } from "../plot/plot.module.js";
import { ProjectModule } from "../project/project.module.js";
import { ReviewModule } from "../review/review.module.js";
import { SettingsModule } from "../settings/settings.module.js";
import { SerialStateModule } from "../serial-state/serial-state.module.js";
import { WorkflowModule } from "../workflow/workflow.module.js";
import { WorkbenchModule } from "../workbench/workbench.module.js";
import { WorldModule } from "../world/world.module.js";
import { RpcController } from "./rpc.controller.js";
import { RpcService } from "./rpc.service.js";

@Module({
  controllers: [RpcController],
  imports: [
    AiCommandModule,
    ArtifactModule,
    CharacterModule,
    ChapterModule,
    ContextPackageModule,
    CreativeModule,
    CreativePathModule,
    DiagnosticsModule,
    GraphModule,
    HealthModule,
    MemoryModule,
    OutlineModule,
    PlotModule,
    ProjectModule,
    ReviewModule,
    SettingsModule,
    SerialStateModule,
    WorkflowModule,
    WorkbenchModule,
    WorldModule,
  ],
  providers: [RpcService],
})
export class RpcModule {}
