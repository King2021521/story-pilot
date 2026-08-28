import type { ProjectDatabase } from "../project-database.js";

export interface ContextPackageRecord {
  readonly id: string;
  readonly projectId: string;
  readonly purpose: string;
  readonly targetType: string | null;
  readonly targetId: string | null;
  readonly inputHash: string;
  readonly createdAt: number;
}

export interface CreateContextPackageRecordInput {
  readonly contextPackageId: string;
  readonly projectId: string;
  readonly purpose: string;
  readonly targetType?: string;
  readonly targetId?: string;
  readonly inputHash: string;
  readonly items: readonly CreateContextPackageItemRecordInput[];
  readonly now?: number;
}

export interface CreateContextPackageItemRecordInput {
  readonly contextPackageItemId: string;
  readonly itemType: string;
  readonly itemId: string;
  readonly rank: number;
  readonly content: string;
  readonly metadata?: unknown;
}

interface ContextPackageRow {
  readonly id: string;
  readonly project_id: string;
  readonly purpose: string;
  readonly target_type: string | null;
  readonly target_id: string | null;
  readonly input_hash: string;
  readonly created_at: number;
}

export class ContextRepository {
  constructor(private readonly projectDatabase: ProjectDatabase) {}

  createPackage(input: CreateContextPackageRecordInput): ContextPackageRecord {
    const now = input.now ?? Date.now();
    const create = this.projectDatabase.client.transaction(() => {
      this.projectDatabase.client
        .prepare(
          `
          insert into context_packages (
            id, project_id, purpose, target_type, target_id, input_hash, created_at
          )
          values (
            @contextPackageId, @projectId, @purpose, @targetType, @targetId, @inputHash, @now
          )
        `,
        )
        .run({
          contextPackageId: input.contextPackageId,
          inputHash: input.inputHash,
          now,
          projectId: input.projectId,
          purpose: input.purpose,
          targetId: input.targetId ?? null,
          targetType: input.targetType ?? null,
        });

      for (const item of input.items) {
        this.projectDatabase.client
          .prepare(
            `
            insert into context_package_items (
              id, project_id, context_package_id, item_type, item_id, rank, content, metadata
            )
            values (
              @contextPackageItemId, @projectId, @contextPackageId, @itemType, @itemId,
              @rank, @content, @metadata
            )
          `,
          )
          .run({
            content: item.content,
            contextPackageId: input.contextPackageId,
            contextPackageItemId: item.contextPackageItemId,
            itemId: item.itemId,
            itemType: item.itemType,
            metadata: item.metadata === undefined ? null : JSON.stringify(item.metadata),
            projectId: input.projectId,
            rank: item.rank,
          });
      }
    });

    create();

    const row = this.projectDatabase.client
      .prepare("select * from context_packages where project_id = ? and id = ?")
      .get(input.projectId, input.contextPackageId) as ContextPackageRow | undefined;
    if (!row) {
      throw new Error(`CONTEXT_PACKAGE_NOT_CREATED: ${input.contextPackageId}`);
    }

    return mapContextPackageRow(row);
  }
}

function mapContextPackageRow(row: ContextPackageRow): ContextPackageRecord {
  return {
    createdAt: row.created_at,
    id: row.id,
    inputHash: row.input_hash,
    projectId: row.project_id,
    purpose: row.purpose,
    targetId: row.target_id,
    targetType: row.target_type,
  };
}
