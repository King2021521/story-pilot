import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import type { CommandPayload } from "@story-pilot/contracts";
import { DomainEventRepository, PlotRepository, type EventRelationRecord } from "@story-pilot/db";

import { ProjectStorageService } from "../storage/project-storage.service.js";

type ListEventRelationsInput = CommandPayload<"eventRelation.list">;
type CreateEventRelationInput = CommandPayload<"eventRelation.create">;
type UpdateEventRelationInput = CommandPayload<"eventRelation.update">;

@Injectable()
export class EventRelationService {
  constructor(private readonly projectStorage: ProjectStorageService) {}

  async listEventRelations(input: ListEventRelationsInput): Promise<EventRelationRecord[]> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      return new PlotRepository(projectDatabase).listEventRelations(input.projectId, input.eventId);
    } finally {
      projectDatabase.close();
    }
  }

  async createEventRelation(input: CreateEventRelationInput): Promise<EventRelationRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const now = Date.now();
      return projectDatabase.client.transaction(() => {
        const relation = new PlotRepository(projectDatabase).createEventRelation({
          eventRelationId: randomUUID(),
          now,
          projectId: input.projectId,
          relationType: input.relationType,
          sourceEventId: input.sourceEventId,
          targetEventId: input.targetEventId,
          ...(input.description === undefined ? {} : { description: input.description }),
        });
        new DomainEventRepository(projectDatabase).append({
          aggregateId: relation.id,
          aggregateType: "event_relation",
          eventId: randomUUID(),
          eventType: "event_relation.created",
          now,
          payload: {
            relationType: relation.relationType,
            sourceEventId: relation.sourceEventId,
            targetEventId: relation.targetEventId,
          },
          projectId: input.projectId,
        });

        return relation;
      })();
    } finally {
      projectDatabase.close();
    }
  }

  async updateEventRelation(input: UpdateEventRelationInput): Promise<EventRelationRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const now = Date.now();
      return projectDatabase.client.transaction(() => {
        const relation = new PlotRepository(projectDatabase).updateEventRelation({
          eventRelationId: input.eventRelationId,
          projectId: input.projectId,
          ...(input.patch.description === undefined
            ? {}
            : { description: input.patch.description }),
          ...(input.patch.relationType === undefined
            ? {}
            : { relationType: input.patch.relationType }),
        });
        new DomainEventRepository(projectDatabase).append({
          aggregateId: relation.id,
          aggregateType: "event_relation",
          eventId: randomUUID(),
          eventType: "event_relation.updated",
          now,
          payload: {
            description: relation.description,
            relationType: relation.relationType,
          },
          projectId: input.projectId,
        });

        return relation;
      })();
    } finally {
      projectDatabase.close();
    }
  }
}
