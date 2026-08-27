import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { DomainEventRepository, PlotRepository, type PlotlineRecord } from "@story-pilot/db";

import { ProjectStorageService } from "../storage/project-storage.service.js";

export interface CreatePlotlineInput {
  readonly projectId: string;
  readonly title: string;
  readonly kind: "main" | "branch" | "romance" | "mystery" | "growth" | "world";
  readonly summary?: string;
  readonly priority: number;
}

@Injectable()
export class PlotlineService {
  constructor(private readonly projectStorage: ProjectStorageService) {}

  async createPlotline(input: CreatePlotlineInput): Promise<PlotlineRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const plotline = new PlotRepository(projectDatabase).createPlotline({
        kind: input.kind,
        plotlineId: randomUUID(),
        priority: input.priority,
        projectId: input.projectId,
        title: input.title,
        ...(input.summary === undefined ? {} : { summary: input.summary }),
      });

      new DomainEventRepository(projectDatabase).append({
        aggregateId: plotline.id,
        aggregateType: "plotline",
        eventId: randomUUID(),
        eventType: "plotline.created",
        payload: {
          title: plotline.name,
          type: plotline.type,
        },
        projectId: input.projectId,
      });

      return plotline;
    } finally {
      projectDatabase.close();
    }
  }
}
