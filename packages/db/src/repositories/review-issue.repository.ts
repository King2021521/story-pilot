import type { ProjectDatabase } from "../project-database.js";

export interface ReviewIssueRecord {
  readonly id: string;
  readonly projectId: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly issueType: string;
  readonly severity: "info" | "warning" | "error" | string;
  readonly message: string;
  readonly evidence: unknown;
  readonly suggestedFix: unknown | null;
  readonly status: "open" | "acknowledged" | "resolved" | "ignored" | string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface CreateReviewIssueRecordInput {
  readonly issueId: string;
  readonly projectId: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly issueType: string;
  readonly severity: "info" | "warning" | "error";
  readonly message: string;
  readonly evidence: unknown;
  readonly suggestedFix?: unknown;
}

interface ReviewIssueRow {
  readonly id: string;
  readonly project_id: string;
  readonly target_type: string;
  readonly target_id: string;
  readonly issue_type: string;
  readonly severity: string;
  readonly message: string;
  readonly evidence_json: string;
  readonly suggested_fix_json: string | null;
  readonly status: string;
  readonly created_at: number;
  readonly updated_at: number;
}

export class ReviewIssueRepository {
  constructor(private readonly projectDatabase: ProjectDatabase) {}

  createMany(input: {
    readonly projectId: string;
    readonly issues: readonly CreateReviewIssueRecordInput[];
    readonly now?: number;
  }): ReviewIssueRecord[] {
    const now = input.now ?? Date.now();
    const insert = this.projectDatabase.client.prepare(
      `
      insert into review_issues (
        id, project_id, target_type, target_id, issue_type, severity,
        message, evidence_json, suggested_fix_json, status, created_at, updated_at
      )
      values (
        @issueId, @projectId, @targetType, @targetId, @issueType, @severity,
        @message, @evidenceJson, @suggestedFixJson, 'open', @now, @now
      )
      `,
    );

    const create = this.projectDatabase.client.transaction(() => {
      for (const issue of input.issues) {
        insert.run({
          evidenceJson: JSON.stringify(issue.evidence ?? {}),
          issueId: issue.issueId,
          issueType: issue.issueType,
          message: issue.message,
          now,
          projectId: issue.projectId,
          severity: issue.severity,
          suggestedFixJson:
            issue.suggestedFix === undefined ? null : JSON.stringify(issue.suggestedFix),
          targetId: issue.targetId,
          targetType: issue.targetType,
        });
      }
    });

    create();

    const issueIds = new Set(input.issues.map((issue) => issue.issueId));
    return this.listByProject({ projectId: input.projectId }).filter((issue) =>
      issueIds.has(issue.id),
    );
  }

  listByProject(input: {
    readonly projectId: string;
    readonly status?: string;
    readonly limit?: number;
  }): ReviewIssueRecord[] {
    if (input.status) {
      return this.projectDatabase.client
        .prepare(
          `
          select * from review_issues
          where project_id = ? and status = ?
          order by created_at desc
          limit ?
          `,
        )
        .all(input.projectId, input.status, input.limit ?? 200)
        .map((row) => mapReviewIssueRow(row as ReviewIssueRow));
    }

    return this.projectDatabase.client
      .prepare(
        `
        select * from review_issues
        where project_id = ?
        order by created_at desc
        limit ?
        `,
      )
      .all(input.projectId, input.limit ?? 200)
      .map((row) => mapReviewIssueRow(row as ReviewIssueRow));
  }

  updateStatus(input: {
    readonly projectId: string;
    readonly issueId: string;
    readonly status: "open" | "acknowledged" | "resolved" | "ignored";
    readonly now?: number;
  }): ReviewIssueRecord {
    const now = input.now ?? Date.now();
    this.projectDatabase.client
      .prepare(
        `
        update review_issues
        set status = ?, updated_at = ?
        where project_id = ? and id = ?
        `,
      )
      .run(input.status, now, input.projectId, input.issueId);

    const issue = this.getById(input.projectId, input.issueId);
    if (!issue) {
      throw new Error(`REVIEW_ISSUE_NOT_FOUND: ${input.issueId}`);
    }

    return issue;
  }

  getById(projectId: string, issueId: string): ReviewIssueRecord | null {
    const row = this.projectDatabase.client
      .prepare("select * from review_issues where project_id = ? and id = ?")
      .get(projectId, issueId) as ReviewIssueRow | undefined;

    return row ? mapReviewIssueRow(row) : null;
  }
}

function mapReviewIssueRow(row: ReviewIssueRow): ReviewIssueRecord {
  return {
    createdAt: row.created_at,
    evidence: parseJson(row.evidence_json, {}),
    id: row.id,
    issueType: row.issue_type,
    message: row.message,
    projectId: row.project_id,
    severity: row.severity,
    status: row.status,
    suggestedFix: row.suggested_fix_json === null ? null : parseJson(row.suggested_fix_json, null),
    targetId: row.target_id,
    targetType: row.target_type,
    updatedAt: row.updated_at,
  };
}

function parseJson(value: string, fallback: unknown): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return fallback;
  }
}
