import type { ProjectDatabase } from "../project-database.js";

export interface WorldRuleRecord {
  readonly id: string;
  readonly projectId: string;
  readonly category: string;
  readonly title: string;
  readonly content: string;
  readonly status: string;
  readonly source: string | null;
}

export interface CreateWorldRuleRecordInput {
  readonly worldRuleId: string;
  readonly projectId: string;
  readonly category: string;
  readonly title: string;
  readonly statement: string;
  readonly constraintLevel: string;
  readonly now?: number;
}

interface WorldRuleRow {
  readonly id: string;
  readonly project_id: string;
  readonly category: string;
  readonly title: string;
  readonly content: string;
  readonly status: string;
  readonly source: string | null;
}

export class WorldRepository {
  constructor(private readonly projectDatabase: ProjectDatabase) {}

  createWorldRule(input: CreateWorldRuleRecordInput): WorldRuleRecord {
    const now = input.now ?? Date.now();
    this.projectDatabase.client
      .prepare(`
        insert into world_rules (
          id, project_id, category, title, content, status, source, created_at, updated_at
        )
        values (
          @worldRuleId, @projectId, @category, @title, @statement, 'canon', @constraintLevel, @now, @now
        )
      `)
      .run({
        category: input.category,
        constraintLevel: input.constraintLevel,
        now,
        projectId: input.projectId,
        statement: input.statement,
        title: input.title,
        worldRuleId: input.worldRuleId,
      });

    const rule = this.projectDatabase.client
      .prepare("select * from world_rules where project_id = ? and id = ?")
      .get(input.projectId, input.worldRuleId) as WorldRuleRow | undefined;

    if (!rule) {
      throw new Error(`WORLD_RULE_NOT_CREATED: ${input.worldRuleId}`);
    }

    return {
      category: rule.category,
      content: rule.content,
      id: rule.id,
      projectId: rule.project_id,
      source: rule.source,
      status: rule.status,
      title: rule.title,
    };
  }
}
