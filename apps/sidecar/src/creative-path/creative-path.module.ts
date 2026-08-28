import { Module } from "@nestjs/common";

import { StorageModule } from "../storage/storage.module.js";
import { CreativePathService } from "./creative-path.service.js";

@Module({
  exports: [CreativePathService],
  imports: [StorageModule],
  providers: [CreativePathService],
})
export class CreativePathModule {}
