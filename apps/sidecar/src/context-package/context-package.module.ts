import { Module } from "@nestjs/common";

import { StorageModule } from "../storage/storage.module.js";
import { ContextPackageService } from "./context-package.service.js";

@Module({
  exports: [ContextPackageService],
  imports: [StorageModule],
  providers: [ContextPackageService],
})
export class ContextPackageModule {}
