import type { ProjectDatabase } from "../project-database.js";

export interface GenerationContextPackageItem {
  readonly itemType: string;
  readonly itemId: string;
  readonly rank: number;
  readonly content: string;
  readonly metadata?: unknown;
}

export interface OmittedGenerationContextPackageItem {
  readonly sourceType: string;
  readonly sourceId: string;
  readonly reason: string;
  readonly tokenEstimate: number;
}

export interface GenerationContextPackageRecord {
  readonly id: string;
  readonly projectId: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly purpose: string;
  readonly tokenBudget: number;
  readonly estimatedTokens: number;
  readonly strategy: string;
  readonly items: readonly GenerationContextPackageItem[];
  readonly omittedItems: readonly OmittedGenerationContextPackageItem[];
  readonly createdAt: number;
}

export interface CreateGenerationContextPackageInput {
  readonly contextPackageId: string;
  readonly projectId: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly purpose: string;
  readonly tokenBudget: number;
  readonly estimatedTokens: number;
  readonly strategy: string;
  readonly items: readonly GenerationContextPackageItem[];
  readonly omittedItems?: readonly OmittedGenerationContextPackageItem[];
  readonly now?: number;
}

interface GenerationContextPackageRow {
  readonly id: string;
  readonly project_id: string;
  readonly target_type: string;
  readonly target_id: string;
  readonly purpose: string;
  readonly token_budget: number;
  readonly estimated_tokens: number;
  readonly strategy: string;
  readonly items_json: string;
  readonly omitted_items_json: string;
  readonly created_at: number;
}

export class ContextPackageRepository {
  constructor(private readonly projectDatabase: ProjectDatabase) {}

  create(input: CreateGenerationContextPackageInput): GenerationContextPackageRecord {
    const now = input.now ?? Date.now();
    this.projectDatabase.client
      .prepare(
        `
        insert into generation_context_packages (
          id, project_id, target_type, target_id, purpose, token_budget, estimated_tokens,
          strategy, items_json, omitted_items_json, created_at
        )
        values (
          @contextPackageId, @projectId, @targetType, @targetId, @purpose, @tokenBudget,
          @estimatedTokens, @strategy, @itemsJson, @omittedItemsJson, @now
        )
      `,
      )
      .run({
        contextPackageId: input.contextPackageId,
        estimatedTokens: input.estimatedTokens,
        itemsJson: JSON.stringify([...input.items].sort((left, right) => left.rank - right.rank)),
        now,
        omittedItemsJson: JSON.stringify(input.omittedItems ?? []),
        projectId: input.projectId,
        purpose: input.purpose,
        strategy: input.strategy,
        targetId: input.targetId,
        targetType: input.targetType,
        tokenBudget: input.tokenBudget,
      });

    const record = this.getById(input.projectId, input.contextPackageId);
    if (!record) {
      throw new Error(`GENERATION_CONTEXT_PACKAGE_NOT_CREATED: ${input.contextPackageId}`);
    }

    return record;
  }

  getById(projectId: string, contextPackageId: string): GenerationContextPackageRecord | null {
    const row = this.projectDatabase.client
      .prepare("select * from generation_context_packages where project_id = ? and id = ?")
      .get(projectId, contextPackageId) as GenerationContextPackageRow | undefined;

    return row ? mapGenerationContextPackageRow(row) : null;
  }

  listByTarget(
    projectId: string,
    targetType: string,
    targetId: string,
  ): GenerationContextPackageRecord[] {
    return this.projectDatabase.client
      .prepare(
        `
        select * from generation_context_packages
        where project_id = ? and target_type = ? and target_id = ?
        order by created_at desc, id desc
      `,
      )
      .all(projectId, targetType, targetId)
      .map((row) => mapGenerationContextPackageRow(row as GenerationContextPackageRow));
  }
}

function mapGenerationContextPackageRow(
  row: GenerationContextPackageRow,
): GenerationContextPackageRecord {
  return {
    createdAt: row.created_at,
    estimatedTokens: row.estimated_tokens,
    id: row.id,
    items: parseJsonArray<GenerationContextPackageItem>(row.items_json, "items_json"),
    omittedItems: parseJsonArray<OmittedGenerationContextPackageItem>(
      row.omitted_items_json,
      "omitted_items_json",
    ),
    projectId: row.project_id,
    purpose: row.purpose,
    strategy: row.strategy,
    targetId: row.target_id,
    targetType: row.target_type,
    tokenBudget: row.token_budget,
  };
}

function parseJsonArray<T>(value: string, columnName: string): readonly T[] {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`INVALID_GENERATION_CONTEXT_PACKAGE_JSON: ${columnName}`);
  }

  return parsed as readonly T[];
}
