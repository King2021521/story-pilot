import { Injectable } from "@nestjs/common";

export type SidecarHealth = {
  service: "story-pilot-sidecar";
  status: "ok";
  version: string;
};

@Injectable()
export class HealthService {
  getHealth(): SidecarHealth {
    return {
      service: "story-pilot-sidecar",
      status: "ok",
      version: process.env.npm_package_version ?? "0.1.0",
    };
  }
}
