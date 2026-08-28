import { Module } from "@nestjs/common";

import { AiModule } from "../ai/ai.module.js";
import { GraphModule } from "../graph/graph.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { WorkOrderService } from "./work-order.service.js";
import { WorkflowService } from "./workflow.service.js";

@Module({
  exports: [WorkOrderService, WorkflowService],
  imports: [AiModule, GraphModule, StorageModule],
  providers: [WorkOrderService, WorkflowService],
})
export class WorkflowModule {}
