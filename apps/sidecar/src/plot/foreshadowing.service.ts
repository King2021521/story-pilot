import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { DomainEventRepository, PlotRepository, type ForeshadowingRecord } from "@story-pilot/db";

import { ProjectStorageService } from "../storage/project-storage.service.js";

export interface CreateForeshadowingInput {
  readonly projectId: string;
  readonly title: string;
  readonly description: string;
  readonly payoffExpectation?: string;
  readonly seedEventId?: string;
  readonly payoffEventId?: string;
}

@Injectable()
export class ForeshadowingService {
  constructor(private readonly projectStorage: ProjectStorageService) {}

  async createForeshadowing(input: CreateForeshadowingInput): Promise<ForeshadowingRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const foreshadowing = new PlotRepository(projectDatabase).createForeshadowing({
        description: input.description,
        foreshadowingId: randomUUID(),
        projectId: input.projectId,
        title: input.title,
        ...(input.payoffExpectation === undefined ? {} : { payoffExpectation: input.payoffExpectation }),
        ...(input.seedEventId === undefined
          ? {}
          : { seedEventId: input.seedEventId, seedEventLinkId: randomUUID() }),
        ...(input.payoffEventId === undefined
          ? {}
          : { payoffEventId: input.payoffEventId, payoffEventLinkId: randomUUID() }),
      });

      new DomainEventRepository(projectDatabase).append({
        aggregateId: foreshadowing.id,
        aggregateType: "foreshadowing",
        eventId: randomUUID(),
        eventType: "foreshadowing.seeded",
        payload: {
          links: foreshadowing.links.map((link) => ({
            eventId: link.eventId,
            note: link.note,
            role: link.role,
          })),
          status: foreshadowing.status,
          title: foreshadowing.title,
        },
        projectId: input.projectId,
      });

      return foreshadowing;
    } finally {
      projectDatabase.close();
    }
  }

  async listForeshadowings(projectId: string): Promise<ForeshadowingRecord[]> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(projectId);
    try {
      return new PlotRepository(projectDatabase).listForeshadowings(projectId);
    } finally {
      projectDatabase.close();
    }
  }
}
