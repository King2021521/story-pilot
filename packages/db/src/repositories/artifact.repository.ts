import type { ProjectDatabase } from "../project-database.js";

export interface ArtifactRecord {
  readonly id: string;
  readonly projectId: string;
  readonly workOrderId: string | null;
  readonly workflowRunId: string | null;
  readonly kind: string;
  readonly targetType: string | null;
  readonly targetId: string | null;
  readonly status: string;
  readonly title: string;
  readonly body: string;
  readonly metadata: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly appliedAt: number | null;
}

export interface CreateArtifactRecordInput {
  readonly artifactId: string;
  readonly projectId: string;
  readonly workOrderId?: string;
  readonly workflowRunId?: string;
  readonly kind: string;
  readonly targetType?: string;
  readonly targetId?: string;
  readonly title: string;
  readonly body: string;
  readonly metadata?: string;
  readonly now?: number;
}

interface ArtifactRow {
  readonly id: string;
  readonly project_id: string;
  readonly work_order_id: string | null;
  readonly workflow_run_id: string | null;
  readonly kind: string;
  readonly target_type: string | null;
  readonly target_id: string | null;
  readonly status: string;
  readonly title: string;
  readonly body: string;
  readonly metadata: string | null;
  readonly created_at: number;
  readonly updated_at: number;
  readonly applied_at: number | null;
}

export class ArtifactRepository {
  constructor(private readonly projectDatabase: ProjectDatabase) {}

  createArtifact(input: CreateArtifactRecordInput): ArtifactRecord {
    const now = input.now ?? Date.now();

    this.projectDatabase.client
      .prepare(
        `
        insert into artifacts (
          id, project_id, work_order_id, workflow_run_id, kind, target_type, target_id,
          status, title, body, metadata, created_at, updated_at
        )
        values (
          @artifactId, @projectId, @workOrderId, @workflowRunId, @kind, @targetType, @targetId,
          'pending', @title, @body, @metadata, @now, @now
        )
      `,
      )
      .run({
        artifactId: input.artifactId,
        body: input.body,
        kind: input.kind,
        metadata: input.metadata ?? null,
        now,
        projectId: input.projectId,
        targetId: input.targetId ?? null,
        targetType: input.targetType ?? null,
        title: input.title,
        workflowRunId: input.workflowRunId ?? null,
        workOrderId: input.workOrderId ?? null,
      });

    const artifact = this.getById(input.projectId, input.artifactId);
    if (!artifact) {
      throw new Error(`ARTIFACT_NOT_CREATED: ${input.artifactId}`);
    }

    return artifact;
  }

  getById(projectId: string, artifactId: string): ArtifactRecord | undefined {
    const row = this.projectDatabase.client
      .prepare("select * from artifacts where project_id = ? and id = ?")
      .get(projectId, artifactId) as ArtifactRow | undefined;

    return row ? mapArtifactRow(row) : undefined;
  }

  listByProject(input: {
    readonly projectId: string;
    readonly status?: string;
    readonly limit?: number;
  }): ArtifactRecord[] {
    if (input.status) {
      return this.projectDatabase.client
        .prepare(
          `
          select * from artifacts
          where project_id = ? and status = ?
          order by updated_at desc
          limit ?
          `,
        )
        .all(input.projectId, input.status, input.limit ?? 100)
        .map((row) => mapArtifactRow(row as ArtifactRow));
    }

    return this.projectDatabase.client
      .prepare(
        `
        select * from artifacts
        where project_id = ?
        order by updated_at desc
        limit ?
        `,
      )
      .all(input.projectId, input.limit ?? 100)
      .map((row) => mapArtifactRow(row as ArtifactRow));
  }

  markApplied(projectId: string, artifactId: string, appliedAt: number): ArtifactRecord {
    this.projectDatabase.client
      .prepare(
        "update artifacts set status = 'applied', applied_at = ?, updated_at = ? where project_id = ? and id = ?",
      )
      .run(appliedAt, appliedAt, projectId, artifactId);

    const artifact = this.getById(projectId, artifactId);
    if (!artifact) {
      throw new Error(`ARTIFACT_NOT_FOUND: ${artifactId}`);
    }

    return artifact;
  }

  markRejected(projectId: string, artifactId: string, rejectedAt: number): ArtifactRecord {
    this.projectDatabase.client
      .prepare(
        "update artifacts set status = 'rejected', updated_at = ? where project_id = ? and id = ?",
      )
      .run(rejectedAt, projectId, artifactId);

    const artifact = this.getById(projectId, artifactId);
    if (!artifact) {
      throw new Error(`ARTIFACT_NOT_FOUND: ${artifactId}`);
    }

    return artifact;
  }
}

function mapArtifactRow(row: ArtifactRow): ArtifactRecord {
  return {
    appliedAt: row.applied_at,
    body: row.body,
    createdAt: row.created_at,
    id: row.id,
    kind: row.kind,
    metadata: row.metadata,
    projectId: row.project_id,
    status: row.status,
    targetId: row.target_id,
    targetType: row.target_type,
    title: row.title,
    updatedAt: row.updated_at,
    workflowRunId: row.workflow_run_id,
    workOrderId: row.work_order_id,
  };
}
