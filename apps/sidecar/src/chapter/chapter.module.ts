import { Module } from "@nestjs/common";

import { AiModule } from "../ai/ai.module.js";
import { GraphModule } from "../graph/graph.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { ChapterService } from "./chapter.service.js";

@Module({
  exports: [ChapterService],
  imports: [AiModule, GraphModule, StorageModule],
  providers: [ChapterService],
})
export class ChapterModule {}
