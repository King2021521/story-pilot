import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import type { CommandPayload } from "@story-pilot/contracts";
import { DomainEventRepository, PlotRepository, type ForeshadowingRecord } from "@story-pilot/db";

import { ProjectStorageService } from "../storage/project-storage.service.js";

export interface CreateForeshadowingInput {
  readonly projectId: string;
  readonly title: string;
  readonly description: string;
  readonly payoffExpectation?: string;
  readonly importance?: number;
  readonly seedEventId?: string;
  readonly payoffEventId?: string;
  readonly status?: string;
}

export type UpdateForeshadowingInput = CommandPayload<"foreshadowing.update">;

@Injectable()
export class ForeshadowingService {
  constructor(private readonly projectStorage: ProjectStorageService) {}

  async createForeshadowing(input: CreateForeshadowingInput): Promise<ForeshadowingRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const foreshadowing = new PlotRepository(projectDatabase).createForeshadowing({
        description: input.description,
        foreshadowingId: randomUUID(),
        importance: input.importance ?? 3,
        projectId: input.projectId,
        title: input.title,
        ...(input.payoffExpectation === undefined
          ? {}
          : { payoffExpectation: input.payoffExpectation }),
        ...(input.seedEventId === undefined
          ? {}
          : { seedEventId: input.seedEventId, seedEventLinkId: randomUUID() }),
        ...(input.payoffEventId === undefined
          ? {}
          : { payoffEventId: input.payoffEventId, payoffEventLinkId: randomUUID() }),
        ...(input.status === undefined ? {} : { status: input.status }),
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

  async updateForeshadowing(input: UpdateForeshadowingInput): Promise<ForeshadowingRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const foreshadowing = new PlotRepository(projectDatabase).updateForeshadowing({
        foreshadowingId: input.foreshadowingId,
        projectId: input.projectId,
        ...(input.patch.description === undefined ? {} : { description: input.patch.description }),
        ...(input.patch.importance === undefined ? {} : { importance: input.patch.importance }),
        ...(input.patch.payoffEventId === undefined
          ? {}
          : {
              payoffEventId: input.patch.payoffEventId,
              ...(input.patch.payoffEventId === null ? {} : { payoffEventLinkId: randomUUID() }),
            }),
        ...(input.patch.payoffExpectation === undefined
          ? {}
          : { payoffExpectation: input.patch.payoffExpectation }),
        ...(input.patch.seedEventId === undefined
          ? {}
          : {
              seedEventId: input.patch.seedEventId,
              ...(input.patch.seedEventId === null ? {} : { seedEventLinkId: randomUUID() }),
            }),
        ...(input.patch.status === undefined ? {} : { status: input.patch.status }),
        ...(input.patch.title === undefined ? {} : { title: input.patch.title }),
      });

      new DomainEventRepository(projectDatabase).append({
        aggregateId: foreshadowing.id,
        aggregateType: "foreshadowing",
        eventId: randomUUID(),
        eventType: "foreshadowing.updated",
        payload: {
          importance: foreshadowing.importance,
          links: foreshadowing.links.map((link) => ({
            eventId: link.eventId,
            note: link.note,
            role: link.role,
          })),
          payoffText: foreshadowing.payoffText,
          seedText: foreshadowing.seedText,
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
