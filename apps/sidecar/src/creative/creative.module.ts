import { Module } from "@nestjs/common";

import { AiModule } from "../ai/ai.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { ElementCandidateService } from "./element-candidate.service.js";

@Module({
  exports: [ElementCandidateService],
  imports: [AiModule, StorageModule],
  providers: [ElementCandidateService],
})
export class CreativeModule {}
