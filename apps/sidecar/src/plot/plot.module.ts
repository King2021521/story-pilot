import { Module } from "@nestjs/common";

import { StorageModule } from "../storage/storage.module.js";
import { ForeshadowingService } from "./foreshadowing.service.js";
import { PlotlineService } from "./plotline.service.js";
import { StoryEventService } from "./story-event.service.js";

@Module({
  exports: [ForeshadowingService, PlotlineService, StoryEventService],
  imports: [StorageModule],
  providers: [ForeshadowingService, PlotlineService, StoryEventService],
})
export class PlotModule {}
