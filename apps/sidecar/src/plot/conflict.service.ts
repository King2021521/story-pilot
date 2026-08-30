import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import type { CommandPayload } from "@story-pilot/contracts";
import { DomainEventRepository, PlotRepository, type ConflictRecord } from "@story-pilot/db";

import { ProjectStorageService } from "../storage/project-storage.service.js";

type ListConflictsInput = CommandPayload<"conflict.list">;
type CreateConflictInput = CommandPayload<"conflict.create">;
type UpdateConflictInput = CommandPayload<"conflict.update">;

@Injectable()
export class ConflictService {
  constructor(private readonly projectStorage: ProjectStorageService) {}

  async listConflicts(input: ListConflictsInput): Promise<ConflictRecord[]> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      return new PlotRepository(projectDatabase).listConflicts(input.projectId, input.status);
    } finally {
      projectDatabase.close();
    }
  }

  async createConflict(input: CreateConflictInput): Promise<ConflictRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const now = Date.now();
      return projectDatabase.client.transaction(() => {
        const conflict = new PlotRepository(projectDatabase).createConflict({
          conflictId: randomUUID(),
          conflictType: input.conflictType,
          escalationPath: input.escalationPath,
          now,
          opposingForces: input.opposingForces,
          projectId: input.projectId,
          stakes: input.stakes,
          status: input.status,
          title: input.title,
          ...(input.relatedPlotlineId === undefined
            ? {}
            : { relatedPlotlineId: input.relatedPlotlineId }),
        });
        new DomainEventRepository(projectDatabase).append({
          aggregateId: conflict.id,
          aggregateType: "conflict",
          eventId: randomUUID(),
          eventType: "conflict.created",
          now,
          payload: {
            conflictType: conflict.conflictType,
            relatedPlotlineId: conflict.relatedPlotlineId,
            status: conflict.status,
            title: conflict.title,
          },
          projectId: input.projectId,
        });

        return conflict;
      })();
    } finally {
      projectDatabase.close();
    }
  }

  async updateConflict(input: UpdateConflictInput): Promise<ConflictRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const now = Date.now();
      return projectDatabase.client.transaction(() => {
        const conflict = new PlotRepository(projectDatabase).updateConflict({
          conflictId: input.conflictId,
          now,
          projectId: input.projectId,
          ...(input.patch.conflictType === undefined
            ? {}
            : { conflictType: input.patch.conflictType }),
          ...(input.patch.escalationPath === undefined
            ? {}
            : { escalationPath: input.patch.escalationPath }),
          ...(input.patch.opposingForces === undefined
            ? {}
            : { opposingForces: input.patch.opposingForces }),
          ...(input.patch.relatedPlotlineId === undefined
            ? {}
            : { relatedPlotlineId: input.patch.relatedPlotlineId }),
          ...(input.patch.stakes === undefined ? {} : { stakes: input.patch.stakes }),
          ...(input.patch.status === undefined ? {} : { status: input.patch.status }),
          ...(input.patch.title === undefined ? {} : { title: input.patch.title }),
        });
        new DomainEventRepository(projectDatabase).append({
          aggregateId: conflict.id,
          aggregateType: "conflict",
          eventId: randomUUID(),
          eventType: "conflict.updated",
          now,
          payload: {
            conflictType: conflict.conflictType,
            status: conflict.status,
            title: conflict.title,
          },
          projectId: input.projectId,
        });

        return conflict;
      })();
    } finally {
      projectDatabase.close();
    }
  }
}
