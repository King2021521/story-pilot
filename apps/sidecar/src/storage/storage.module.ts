import { Module } from "@nestjs/common";

import { ProjectStorageService } from "./project-storage.service.js";

@Module({
  exports: [ProjectStorageService],
  providers: [ProjectStorageService],
})
export class StorageModule {}
