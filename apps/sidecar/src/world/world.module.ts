import { Module } from "@nestjs/common";

import { AiModule } from "../ai/ai.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { WorldRuleService } from "./world-rule.service.js";
import { WorldbuildingService } from "./worldbuilding.service.js";

@Module({
  exports: [WorldRuleService, WorldbuildingService],
  imports: [AiModule, StorageModule],
  providers: [WorldRuleService, WorldbuildingService],
})
export class WorldModule {}
