import { Module } from "@nestjs/common";

import { AiModule } from "../ai/ai.module.js";
import { GraphModule } from "../graph/graph.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { ContextPackageModule } from "../context-package/context-package.module.js";
import { ChapterExecutionCardService } from "./chapter-execution-card.service.js";
import { ChapterService } from "./chapter.service.js";

@Module({
  exports: [ChapterExecutionCardService, ChapterService],
  imports: [AiModule, ContextPackageModule, GraphModule, StorageModule],
  providers: [ChapterExecutionCardService, ChapterService],
})
export class ChapterModule {}
