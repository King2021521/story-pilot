import { Module } from "@nestjs/common";

import { StorageModule } from "../storage/storage.module.js";
import { WorkOrderService } from "./work-order.service.js";
import { WorkflowService } from "./workflow.service.js";

@Module({
  exports: [WorkOrderService, WorkflowService],
  imports: [StorageModule],
  providers: [WorkOrderService, WorkflowService],
})
export class WorkflowModule {}
