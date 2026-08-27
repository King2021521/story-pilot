import { buildServer } from "./server.js";

const host = process.env.STORY_PILOT_SIDECAR_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.STORY_PILOT_SIDECAR_PORT ?? "0", 10);

const server = buildServer({ version: process.env.npm_package_version ?? "0.1.0" });

try {
  const address = await server.listen({ host, port });
  server.log.info({ address }, "Story Pilot sidecar is listening");
} catch (error) {
  server.log.error(error);
  process.exit(1);
}

