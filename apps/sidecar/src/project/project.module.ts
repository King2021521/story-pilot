import { Module } from "@nestjs/common";

import { StorageModule } from "../storage/storage.module.js";
import { ProjectService } from "./project.service.js";

@Module({
  exports: [ProjectService],
  imports: [StorageModule],
  providers: [ProjectService],
})
export class ProjectModule {}
