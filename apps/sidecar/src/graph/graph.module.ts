import { Module } from "@nestjs/common";

import { StorageModule } from "../storage/storage.module.js";
import { GraphService } from "./graph.service.js";

@Module({
  exports: [GraphService],
  imports: [StorageModule],
  providers: [GraphService],
})
export class GraphModule {}
