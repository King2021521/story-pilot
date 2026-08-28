import { Module } from "@nestjs/common";

import { GraphModule } from "../graph/graph.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { MemoryService } from "./memory.service.js";

@Module({
  exports: [MemoryService],
  imports: [GraphModule, StorageModule],
  providers: [MemoryService],
})
export class MemoryModule {}
