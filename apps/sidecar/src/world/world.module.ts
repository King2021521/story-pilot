import { Module } from "@nestjs/common";

import { StorageModule } from "../storage/storage.module.js";
import { WorldRuleService } from "./world-rule.service.js";

@Module({
  exports: [WorldRuleService],
  imports: [StorageModule],
  providers: [WorldRuleService],
})
export class WorldModule {}
