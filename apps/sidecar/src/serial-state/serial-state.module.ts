import { Module } from "@nestjs/common";

import { AiModule } from "../ai/ai.module.js";
import { ContextPackageModule } from "../context-package/context-package.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { SerialStateService } from "./serial-state.service.js";

@Module({
  exports: [SerialStateService],
  imports: [AiModule, ContextPackageModule, StorageModule],
  providers: [SerialStateService],
})
export class SerialStateModule {}
