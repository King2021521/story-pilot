import { Module } from "@nestjs/common";

import { modelGatewayProvider } from "./model-gateway.provider.js";

@Module({
  exports: [modelGatewayProvider],
  providers: [modelGatewayProvider],
})
export class AiModule {}
