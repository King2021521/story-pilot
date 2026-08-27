import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { DomainEventRepository, WorldRepository, type WorldRuleRecord } from "@story-pilot/db";

import { ProjectStorageService } from "../storage/project-storage.service.js";

export interface CreateWorldRuleInput {
  readonly projectId: string;
  readonly category: "magic" | "tech" | "society" | "history" | "geography" | "economy" | "custom";
  readonly title: string;
  readonly statement: string;
  readonly constraintLevel: "hard" | "soft" | "optional";
}

@Injectable()
export class WorldRuleService {
  constructor(private readonly projectStorage: ProjectStorageService) {}

  async createWorldRule(input: CreateWorldRuleInput): Promise<WorldRuleRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const rule = new WorldRepository(projectDatabase).createWorldRule({
        category: input.category,
        constraintLevel: input.constraintLevel,
        projectId: input.projectId,
        statement: input.statement,
        title: input.title,
        worldRuleId: randomUUID(),
      });

      new DomainEventRepository(projectDatabase).append({
        aggregateId: rule.id,
        aggregateType: "world_rule",
        eventId: randomUUID(),
        eventType: "world_rule.created",
        payload: {
          category: rule.category,
          title: rule.title,
        },
        projectId: input.projectId,
      });

      return rule;
    } finally {
      projectDatabase.close();
    }
  }
}
