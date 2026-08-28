import { Module } from "@nestjs/common";

import { AiModule } from "../ai/ai.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { OutlineService } from "./outline.service.js";

@Module({
  exports: [OutlineService],
  imports: [AiModule, StorageModule],
  providers: [OutlineService],
})
export class OutlineModule {}
