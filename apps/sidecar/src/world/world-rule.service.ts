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

export interface UpdateWorldRuleInput {
  readonly projectId: string;
  readonly worldRuleId: string;
  readonly patch: Record<string, unknown>;
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
          constraintLevel: rule.source,
          statement: rule.content,
          title: rule.title,
        },
        projectId: input.projectId,
      });

      return rule;
    } finally {
      projectDatabase.close();
    }
  }

  async listWorldRules(projectId: string): Promise<WorldRuleRecord[]> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(projectId);
    try {
      return new WorldRepository(projectDatabase).listWorldRules(projectId);
    } finally {
      projectDatabase.close();
    }
  }

  async updateWorldRule(input: UpdateWorldRuleInput): Promise<WorldRuleRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const category = getStringPatch(input.patch, "category");
      const constraintLevel = getStringPatch(input.patch, "constraintLevel");
      const statement = getStringPatch(input.patch, "statement");
      const title = getStringPatch(input.patch, "title");
      const rule = new WorldRepository(projectDatabase).updateWorldRule({
        projectId: input.projectId,
        worldRuleId: input.worldRuleId,
        ...(category === undefined ? {} : { category }),
        ...(constraintLevel === undefined ? {} : { constraintLevel }),
        ...(statement === undefined ? {} : { statement }),
        ...(title === undefined ? {} : { title }),
      });

      new DomainEventRepository(projectDatabase).append({
        aggregateId: rule.id,
        aggregateType: "world_rule",
        eventId: randomUUID(),
        eventType: "world_rule.updated",
        payload: {
          category: rule.category,
          constraintLevel: rule.source,
          statement: rule.content,
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

function getStringPatch(patch: Record<string, unknown>, key: string): string | undefined {
  const value = patch[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
