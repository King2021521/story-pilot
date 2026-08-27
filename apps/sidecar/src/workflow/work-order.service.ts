import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { WorkflowRepository, type WorkOrderRecord } from "@story-pilot/db";

import { ProjectStorageService } from "../storage/project-storage.service.js";

export interface CreateWorkOrderInput {
  readonly projectId: string;
  readonly type: string;
  readonly title: string;
  readonly description?: string;
}

@Injectable()
export class WorkOrderService {
  constructor(private readonly projectStorage: ProjectStorageService) {}

  async create(input: CreateWorkOrderInput): Promise<WorkOrderRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      return new WorkflowRepository(projectDatabase).createWorkOrder({
        projectId: input.projectId,
        title: input.title,
        type: input.type,
        workOrderId: randomUUID(),
        ...(input.description === undefined ? {} : { description: input.description }),
      });
    } finally {
      projectDatabase.close();
    }
  }
}
