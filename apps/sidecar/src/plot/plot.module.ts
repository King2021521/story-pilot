import { Module } from "@nestjs/common";

import { AiModule } from "../ai/ai.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { ForeshadowingService } from "./foreshadowing.service.js";
import { LongformPlanService } from "./longform-plan.service.js";
import { PlotlineService } from "./plotline.service.js";
import { StoryEventService } from "./story-event.service.js";

@Module({
  exports: [ForeshadowingService, LongformPlanService, PlotlineService, StoryEventService],
  imports: [AiModule, StorageModule],
  providers: [ForeshadowingService, LongformPlanService, PlotlineService, StoryEventService],
})
export class PlotModule {}
