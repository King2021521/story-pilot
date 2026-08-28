import { Module } from "@nestjs/common";

import { StorageModule } from "../storage/storage.module.js";
import { WorkbenchService } from "./workbench.service.js";

@Module({
  exports: [WorkbenchService],
  imports: [StorageModule],
  providers: [WorkbenchService],
})
export class WorkbenchModule {}
