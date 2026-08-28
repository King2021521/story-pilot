import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";
import { loadLocalEnv } from "./config/env-loader.js";
import { initializeRuntimeConfig } from "./config/runtime-settings.js";

loadLocalEnv();
initializeRuntimeConfig();

const host = process.env.STORY_PILOT_SIDECAR_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.STORY_PILOT_SIDECAR_PORT ?? "0", 10);

try {
  const app = await NestFactory.create(AppModule, { logger: ["error", "warn", "log"] });
  await app.listen(port, host);
  const url = await app.getUrl();
  console.log(`Story Pilot sidecar is listening at ${url}`);
} catch (error) {
  console.error(error);
  process.exit(1);
}
