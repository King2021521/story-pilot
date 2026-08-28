import { Module } from "@nestjs/common";

import { ChapterModule } from "../chapter/chapter.module.js";
import { CreativePathModule } from "../creative-path/creative-path.module.js";
import { OutlineModule } from "../outline/outline.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { WorkflowModule } from "../workflow/workflow.module.js";
import { AiCommandService } from "./ai-command.service.js";

@Module({
  exports: [AiCommandService],
  imports: [ChapterModule, CreativePathModule, OutlineModule, StorageModule, WorkflowModule],
  providers: [AiCommandService],
})
export class AiCommandModule {}
