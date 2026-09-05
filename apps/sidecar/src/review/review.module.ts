import { Module } from "@nestjs/common";

import { AiModule } from "../ai/ai.module.js";
import { ContextPackageModule } from "../context-package/context-package.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { ChapterReviewService } from "./chapter-review.service.js";
import { SerialReviewService } from "./serial-review.service.js";

@Module({
  exports: [ChapterReviewService, SerialReviewService],
  imports: [AiModule, ContextPackageModule, StorageModule],
  providers: [ChapterReviewService, SerialReviewService],
})
export class ReviewModule {}
