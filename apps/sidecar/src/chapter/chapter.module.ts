import { Module } from "@nestjs/common";

import { StorageModule } from "../storage/storage.module.js";
import { ChapterService } from "./chapter.service.js";

@Module({
  exports: [ChapterService],
  imports: [StorageModule],
  providers: [ChapterService],
})
export class ChapterModule {}
