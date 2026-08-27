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

export interface UpdateWorldRuleRecordInput {
  readonly projectId: string;
  readonly worldRuleId: string;
  readonly category?: string;
  readonly title?: string;
  readonly statement?: string;
  readonly constraintLevel?: string;
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

    return mapWorldRuleRow(rule);
  }

  listWorldRules(projectId: string): WorldRuleRecord[] {
    return this.projectDatabase.client
      .prepare("select * from world_rules where project_id = ? order by created_at asc")
      .all(projectId)
      .map((row) => mapWorldRuleRow(row as WorldRuleRow));
  }

  getWorldRule(projectId: string, worldRuleId: string): WorldRuleRecord | undefined {
    const rule = this.projectDatabase.client
      .prepare("select * from world_rules where project_id = ? and id = ?")
      .get(projectId, worldRuleId) as WorldRuleRow | undefined;

    return rule ? mapWorldRuleRow(rule) : undefined;
  }

  updateWorldRule(input: UpdateWorldRuleRecordInput): WorldRuleRecord {
    const now = input.now ?? Date.now();
    this.projectDatabase.client
      .prepare(
        `
        update world_rules
        set category = coalesce(@category, category),
            title = coalesce(@title, title),
            content = coalesce(@statement, content),
            source = coalesce(@constraintLevel, source),
            updated_at = @now
        where project_id = @projectId and id = @worldRuleId
        `,
      )
      .run({
        category: input.category ?? null,
        constraintLevel: input.constraintLevel ?? null,
        now,
        projectId: input.projectId,
        statement: input.statement ?? null,
        title: input.title ?? null,
        worldRuleId: input.worldRuleId,
      });

    const rule = this.getWorldRule(input.projectId, input.worldRuleId);
    if (!rule) {
      throw new Error(`WORLD_RULE_NOT_FOUND: ${input.worldRuleId}`);
    }

    return rule;
  }
}

function mapWorldRuleRow(row: WorldRuleRow): WorldRuleRecord {
  return {
    category: row.category,
    content: row.content,
    id: row.id,
    projectId: row.project_id,
    source: row.source,
    status: row.status,
    title: row.title,
  };
}
