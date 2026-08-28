import { Controller, Get } from "@nestjs/common";

import { HealthService, type SidecarHealth } from "./health.service.js";

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get("health")
  getHealth(): SidecarHealth {
    return this.healthService.getHealth();
  }
}
