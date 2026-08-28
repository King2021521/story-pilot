import { Module } from "@nestjs/common";

import { StorageModule } from "../storage/storage.module.js";
import { DiagnosticsService } from "./diagnostics.service.js";

@Module({
  exports: [DiagnosticsService],
  imports: [StorageModule],
  providers: [DiagnosticsService],
})
export class DiagnosticsModule {}
