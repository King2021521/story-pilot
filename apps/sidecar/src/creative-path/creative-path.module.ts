import { Module } from "@nestjs/common";

import { AiModule } from "../ai/ai.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { CreativePathService } from "./creative-path.service.js";

@Module({
  exports: [CreativePathService],
  imports: [AiModule, StorageModule],
  providers: [CreativePathService],
})
export class CreativePathModule {}
