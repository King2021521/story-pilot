import { Module } from "@nestjs/common";

import { StorageModule } from "../storage/storage.module.js";
import { CharacterService } from "./character.service.js";

@Module({
  exports: [CharacterService],
  imports: [StorageModule],
  providers: [CharacterService],
})
export class CharacterModule {}
