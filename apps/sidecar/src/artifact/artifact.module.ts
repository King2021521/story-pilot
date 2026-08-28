import { Module } from "@nestjs/common";

import { StorageModule } from "../storage/storage.module.js";
import { ArtifactService } from "./artifact.service.js";

@Module({
  exports: [ArtifactService],
  imports: [StorageModule],
  providers: [ArtifactService],
})
export class ArtifactModule {}
