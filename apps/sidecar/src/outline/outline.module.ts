import { Module } from "@nestjs/common";

import { StorageModule } from "../storage/storage.module.js";
import { OutlineService } from "./outline.service.js";

@Module({
  exports: [OutlineService],
  imports: [StorageModule],
  providers: [OutlineService],
})
export class OutlineModule {}
