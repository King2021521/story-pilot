import { randomUUID } from "node:crypto";

import type { ProjectDatabase } from "../project-database.js";

export type SerialReviewScope = "chapter_batch" | "arc" | "volume";
export type SerialReviewStatus = "draft" | "applied" | "archived";

export interface SerialReviewPromiseDelivery {
  readonly evidence: string;
  readonly promise: string;
  readonly score: number;
}

export interface SerialReviewRhythmReport {
  readonly issue?: string;
  readonly score: number;
  readonly suggestion?: string;
}

export interface SerialReviewCharacterStagnation {
  readonly characterId: string;
  readonly evidence: string;
  readonly suggestion: string;
}

export interface SerialReviewPlotDebtRisk {
  readonly plotDebtId: string;
  readonly riskLevel: string;
  readonly suggestion: string;
}

export interface SerialReviewNextAction {
  readonly actionType: string;
  readonly targetId?: string;
  readonly title: string;
}

export interface SerialReviewPayload {
  readonly characterStagnation: readonly SerialReviewCharacterStagnation[];
  readonly nextActions: readonly SerialReviewNextAction[];
  readonly plotDebtRisks: readonly SerialReviewPlotDebtRisk[];
  readonly progressSummary: string;
  readonly promiseDelivery: readonly SerialReviewPromiseDelivery[];
  readonly repetitionRisks: readonly string[];
  readonly rhythmReport: SerialReviewRhythmReport;
}

export interface SerialReviewRecord extends SerialReviewPayload {
  readonly createdAt: number;
  readonly endChapterIndex: number;
  readonly id: string;
  readonly projectId: string;
  readonly scope: SerialReviewScope | string;
  readonly sourceArtifactId: string | null;
  readonly startChapterIndex: number;
  readonly status: SerialReviewStatus | string;
  readonly updatedAt: number;
}

export interface SaveSerialReviewInput extends SerialReviewPayload {
  readonly endChapterIndex: number;
  readonly now?: number;
  readonly projectId: string;
  readonly reviewId?: string;
  readonly scope: SerialReviewScope | string;
  readonly sourceArtifactId?: string | null;
  readonly startChapterIndex: number;
  readonly status?: SerialReviewStatus | string;
}

interface SerialReviewRow {
  readonly character_stagnation_json: string;
  readonly created_at: number;
  readonly end_chapter_index: number;
  readonly id: string;
  readonly next_actions_json: string;
  readonly plot_debt_risks_json: string;
  readonly progress_summary: string;
  readonly project_id: string;
  readonly promise_delivery_json: string;
  readonly repetition_risks_json: string;
  readonly rhythm_report_json: string;
  readonly scope: string;
  readonly source_artifact_id: string | null;
  readonly start_chapter_index: number;
  readonly status: string;
  readonly updated_at: number;
}

export class SerialReviewRepository {
  constructor(private readonly projectDatabase: ProjectDatabase) {}

  save(input: SaveSerialReviewInput): SerialReviewRecord {
    const now = input.now ?? Date.now();
    const reviewId = input.reviewId ?? randomUUID();
    const existing = this.getById(input.projectId, reviewId);
    const createdAt = existing?.createdAt ?? now;

    this.projectDatabase.client
      .prepare(
        `
        insert into serial_reviews (
          id, project_id, scope, start_chapter_index, end_chapter_index, progress_summary,
          promise_delivery_json, rhythm_report_json, repetition_risks_json,
          character_stagnation_json, plot_debt_risks_json, next_actions_json, status,
          source_artifact_id, created_at, updated_at
        )
        values (
          @reviewId, @projectId, @scope, @startChapterIndex, @endChapterIndex,
          @progressSummary, @promiseDeliveryJson, @rhythmReportJson, @repetitionRisksJson,
          @characterStagnationJson, @plotDebtRisksJson, @nextActionsJson, @status,
          @sourceArtifactId, @createdAt, @now
        )
        on conflict(id) do update set
          scope = excluded.scope,
          start_chapter_index = excluded.start_chapter_index,
          end_chapter_index = excluded.end_chapter_index,
          progress_summary = excluded.progress_summary,
          promise_delivery_json = excluded.promise_delivery_json,
          rhythm_report_json = excluded.rhythm_report_json,
          repetition_risks_json = excluded.repetition_risks_json,
          character_stagnation_json = excluded.character_stagnation_json,
          plot_debt_risks_json = excluded.plot_debt_risks_json,
          next_actions_json = excluded.next_actions_json,
          status = excluded.status,
          source_artifact_id = excluded.source_artifact_id,
          updated_at = excluded.updated_at
      `,
      )
      .run({
        characterStagnationJson: JSON.stringify(input.characterStagnation),
        createdAt,
        endChapterIndex: input.endChapterIndex,
        nextActionsJson: JSON.stringify(input.nextActions),
        now,
        plotDebtRisksJson: JSON.stringify(input.plotDebtRisks),
        progressSummary: input.progressSummary,
        projectId: input.projectId,
        promiseDeliveryJson: JSON.stringify(input.promiseDelivery),
        repetitionRisksJson: JSON.stringify(input.repetitionRisks),
        reviewId,
        rhythmReportJson: JSON.stringify(input.rhythmReport),
        scope: input.scope,
        sourceArtifactId: input.sourceArtifactId ?? null,
        startChapterIndex: input.startChapterIndex,
        status: input.status ?? "applied",
      });

    const record = this.getById(input.projectId, reviewId);
    if (!record) {
      throw new Error(`SERIAL_REVIEW_NOT_CREATED: ${reviewId}`);
    }
    return record;
  }

  getById(projectId: string, reviewId: string): SerialReviewRecord | null {
    const row = this.projectDatabase.client
      .prepare("select * from serial_reviews where project_id = ? and id = ?")
      .get(projectId, reviewId) as SerialReviewRow | undefined;
    return row ? mapSerialReviewRow(row) : null;
  }

  listByProject(projectId: string): SerialReviewRecord[] {
    return this.projectDatabase.client
      .prepare(
        `
        select * from serial_reviews
        where project_id = ?
        order by end_chapter_index desc, created_at desc
      `,
      )
      .all(projectId)
      .map((row) => mapSerialReviewRow(row as SerialReviewRow));
  }
}

function mapSerialReviewRow(row: SerialReviewRow): SerialReviewRecord {
  return {
    characterStagnation: parseJsonArray(
      row.character_stagnation_json,
    ) as SerialReviewCharacterStagnation[],
    createdAt: row.created_at,
    endChapterIndex: row.end_chapter_index,
    id: row.id,
    nextActions: parseJsonArray(row.next_actions_json) as SerialReviewNextAction[],
    plotDebtRisks: parseJsonArray(row.plot_debt_risks_json) as SerialReviewPlotDebtRisk[],
    progressSummary: row.progress_summary,
    projectId: row.project_id,
    promiseDelivery: parseJsonArray(row.promise_delivery_json) as SerialReviewPromiseDelivery[],
    repetitionRisks: parseJsonArray(row.repetition_risks_json) as string[],
    rhythmReport: parseJsonObject(row.rhythm_report_json) as unknown as SerialReviewRhythmReport,
    scope: row.scope,
    sourceArtifactId: row.source_artifact_id,
    startChapterIndex: row.start_chapter_index,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

function parseJsonArray(value: string): unknown[] {
  const parsed: unknown = JSON.parse(value);
  return Array.isArray(parsed) ? parsed : [];
}

function parseJsonObject(value: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}
