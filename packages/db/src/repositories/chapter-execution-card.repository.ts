import { randomUUID } from "node:crypto";

import type { ProjectDatabase } from "../project-database.js";

export interface ChapterExecutionSceneBrief {
  readonly sceneIndex: number;
  readonly sceneGoal: string;
  readonly conflictTurn: string;
  readonly outcome: string;
  readonly memoryTargets: readonly string[];
}

export interface ChapterExecutionCardRecord {
  readonly id: string;
  readonly projectId: string;
  readonly chapterPlanId: string;
  readonly chapterId: string | null;
  readonly chapterIndex: number;
  readonly title: string;
  readonly narrativeGoal: string;
  readonly coreConflict: string;
  readonly informationGain: string;
  readonly emotionalTurn: string;
  readonly readerReward: string;
  readonly hook: string;
  readonly povCharacterId: string | null;
  readonly requiredCharacterIds: readonly string[];
  readonly requiredLocationIds: readonly string[];
  readonly relatedPlotlineIds: readonly string[];
  readonly relatedForeshadowingIds: readonly string[];
  readonly relatedPlotDebtIds: readonly string[];
  readonly sceneBriefs: readonly ChapterExecutionSceneBrief[];
  readonly forbiddenMoves: readonly string[];
  readonly targetWordCount: number;
  readonly status: string;
  readonly version: number;
  readonly sourceArtifactId: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface SaveChapterExecutionCardInput {
  readonly id?: string;
  readonly cardId?: string;
  readonly projectId: string;
  readonly chapterPlanId: string;
  readonly chapterId?: string | null;
  readonly chapterIndex: number;
  readonly title: string;
  readonly narrativeGoal: string;
  readonly coreConflict: string;
  readonly informationGain: string;
  readonly emotionalTurn: string;
  readonly readerReward: string;
  readonly hook: string;
  readonly povCharacterId?: string | null;
  readonly requiredCharacterIds: readonly string[];
  readonly requiredLocationIds: readonly string[];
  readonly relatedPlotlineIds: readonly string[];
  readonly relatedForeshadowingIds: readonly string[];
  readonly relatedPlotDebtIds: readonly string[];
  readonly sceneBriefs: readonly ChapterExecutionSceneBrief[];
  readonly forbiddenMoves: readonly string[];
  readonly targetWordCount: number;
  readonly status: string;
  readonly sourceArtifactId?: string | null;
  readonly now?: number;
}

interface ChapterExecutionCardRow {
  readonly id: string;
  readonly project_id: string;
  readonly chapter_plan_id: string;
  readonly chapter_id: string | null;
  readonly chapter_index: number;
  readonly title: string;
  readonly narrative_goal: string;
  readonly core_conflict: string;
  readonly information_gain: string;
  readonly emotional_turn: string;
  readonly reader_reward: string;
  readonly hook: string;
  readonly pov_character_id: string | null;
  readonly required_character_ids_json: string;
  readonly required_location_ids_json: string;
  readonly related_plotline_ids_json: string;
  readonly related_foreshadowing_ids_json: string;
  readonly related_plot_debt_ids_json: string;
  readonly scene_brief_json: string;
  readonly forbidden_moves_json: string;
  readonly target_word_count: number;
  readonly status: string;
  readonly version: number;
  readonly source_artifact_id: string | null;
  readonly created_at: number;
  readonly updated_at: number;
}

export class ChapterExecutionCardRepository {
  constructor(private readonly projectDatabase: ProjectDatabase) {}

  save(input: SaveChapterExecutionCardInput): ChapterExecutionCardRecord {
    const cardId = input.cardId ?? input.id ?? randomUUID();
    const now = input.now ?? Date.now();
    const existing = this.getById(input.projectId, cardId);
    const version = existing ? existing.version + 1 : 1;
    const createdAt = existing?.createdAt ?? now;

    this.projectDatabase.client
      .prepare(
        `
        insert into chapter_execution_cards (
          id, project_id, chapter_plan_id, chapter_id, chapter_index, title,
          narrative_goal, core_conflict, information_gain, emotional_turn,
          reader_reward, hook, pov_character_id, required_character_ids_json,
          required_location_ids_json, related_plotline_ids_json,
          related_foreshadowing_ids_json, related_plot_debt_ids_json,
          scene_brief_json, forbidden_moves_json, target_word_count,
          status, version, source_artifact_id, created_at, updated_at
        )
        values (
          @cardId, @projectId, @chapterPlanId, @chapterId, @chapterIndex, @title,
          @narrativeGoal, @coreConflict, @informationGain, @emotionalTurn,
          @readerReward, @hook, @povCharacterId, @requiredCharacterIdsJson,
          @requiredLocationIdsJson, @relatedPlotlineIdsJson,
          @relatedForeshadowingIdsJson, @relatedPlotDebtIdsJson,
          @sceneBriefJson, @forbiddenMovesJson, @targetWordCount,
          @status, @version, @sourceArtifactId, @createdAt, @now
        )
        on conflict(id) do update set
          chapter_plan_id = excluded.chapter_plan_id,
          chapter_id = excluded.chapter_id,
          chapter_index = excluded.chapter_index,
          title = excluded.title,
          narrative_goal = excluded.narrative_goal,
          core_conflict = excluded.core_conflict,
          information_gain = excluded.information_gain,
          emotional_turn = excluded.emotional_turn,
          reader_reward = excluded.reader_reward,
          hook = excluded.hook,
          pov_character_id = excluded.pov_character_id,
          required_character_ids_json = excluded.required_character_ids_json,
          required_location_ids_json = excluded.required_location_ids_json,
          related_plotline_ids_json = excluded.related_plotline_ids_json,
          related_foreshadowing_ids_json = excluded.related_foreshadowing_ids_json,
          related_plot_debt_ids_json = excluded.related_plot_debt_ids_json,
          scene_brief_json = excluded.scene_brief_json,
          forbidden_moves_json = excluded.forbidden_moves_json,
          target_word_count = excluded.target_word_count,
          status = excluded.status,
          version = excluded.version,
          source_artifact_id = excluded.source_artifact_id,
          updated_at = excluded.updated_at
        `,
      )
      .run({
        cardId,
        chapterId: input.chapterId ?? null,
        chapterIndex: input.chapterIndex,
        chapterPlanId: input.chapterPlanId,
        coreConflict: input.coreConflict,
        createdAt,
        emotionalTurn: input.emotionalTurn,
        forbiddenMovesJson: JSON.stringify(input.forbiddenMoves),
        hook: input.hook,
        informationGain: input.informationGain,
        narrativeGoal: input.narrativeGoal,
        now,
        povCharacterId: input.povCharacterId ?? null,
        projectId: input.projectId,
        readerReward: input.readerReward,
        relatedForeshadowingIdsJson: JSON.stringify(input.relatedForeshadowingIds),
        relatedPlotDebtIdsJson: JSON.stringify(input.relatedPlotDebtIds),
        relatedPlotlineIdsJson: JSON.stringify(input.relatedPlotlineIds),
        requiredCharacterIdsJson: JSON.stringify(input.requiredCharacterIds),
        requiredLocationIdsJson: JSON.stringify(input.requiredLocationIds),
        sceneBriefJson: JSON.stringify(input.sceneBriefs),
        sourceArtifactId: input.sourceArtifactId ?? null,
        status: input.status,
        targetWordCount: input.targetWordCount,
        title: input.title,
        version,
      });

    const saved = this.getById(input.projectId, cardId);
    if (!saved) {
      throw new Error(`CHAPTER_EXECUTION_CARD_NOT_SAVED: ${cardId}`);
    }

    return saved;
  }

  getById(projectId: string, cardId: string): ChapterExecutionCardRecord | null {
    const row = this.projectDatabase.client
      .prepare("select * from chapter_execution_cards where project_id = ? and id = ?")
      .get(projectId, cardId) as ChapterExecutionCardRow | undefined;

    return row ? mapChapterExecutionCardRow(row) : null;
  }

  listByProject(projectId: string): ChapterExecutionCardRecord[] {
    return this.projectDatabase.client
      .prepare(
        `
        select * from chapter_execution_cards
        where project_id = ?
        order by chapter_index asc, updated_at desc
        `,
      )
      .all(projectId)
      .map((row) => mapChapterExecutionCardRow(row as ChapterExecutionCardRow));
  }

  listByChapterPlan(projectId: string, chapterPlanId: string): ChapterExecutionCardRecord[] {
    return this.projectDatabase.client
      .prepare(
        `
        select * from chapter_execution_cards
        where project_id = ? and chapter_plan_id = ?
        order by updated_at desc, id desc
        `,
      )
      .all(projectId, chapterPlanId)
      .map((row) => mapChapterExecutionCardRow(row as ChapterExecutionCardRow));
  }

  getLatestByChapter(projectId: string, chapterId: string): ChapterExecutionCardRecord | null {
    const row = this.projectDatabase.client
      .prepare(
        `
        select * from chapter_execution_cards
        where project_id = ? and chapter_id = ?
        order by case status when 'confirmed' then 0 else 1 end, updated_at desc, id desc
        limit 1
        `,
      )
      .get(projectId, chapterId) as ChapterExecutionCardRow | undefined;

    return row ? mapChapterExecutionCardRow(row) : null;
  }
}

function mapChapterExecutionCardRow(row: ChapterExecutionCardRow): ChapterExecutionCardRecord {
  return {
    chapterId: row.chapter_id,
    chapterIndex: row.chapter_index,
    chapterPlanId: row.chapter_plan_id,
    coreConflict: row.core_conflict,
    createdAt: row.created_at,
    emotionalTurn: row.emotional_turn,
    forbiddenMoves: parseJsonArray<string>(row.forbidden_moves_json, "forbidden_moves_json"),
    hook: row.hook,
    id: row.id,
    informationGain: row.information_gain,
    narrativeGoal: row.narrative_goal,
    povCharacterId: row.pov_character_id,
    projectId: row.project_id,
    readerReward: row.reader_reward,
    relatedForeshadowingIds: parseJsonArray<string>(
      row.related_foreshadowing_ids_json,
      "related_foreshadowing_ids_json",
    ),
    relatedPlotDebtIds: parseJsonArray<string>(
      row.related_plot_debt_ids_json,
      "related_plot_debt_ids_json",
    ),
    relatedPlotlineIds: parseJsonArray<string>(
      row.related_plotline_ids_json,
      "related_plotline_ids_json",
    ),
    requiredCharacterIds: parseJsonArray<string>(
      row.required_character_ids_json,
      "required_character_ids_json",
    ),
    requiredLocationIds: parseJsonArray<string>(
      row.required_location_ids_json,
      "required_location_ids_json",
    ),
    sceneBriefs: parseJsonArray<ChapterExecutionSceneBrief>(
      row.scene_brief_json,
      "scene_brief_json",
    ),
    sourceArtifactId: row.source_artifact_id,
    status: row.status,
    targetWordCount: row.target_word_count,
    title: row.title,
    updatedAt: row.updated_at,
    version: row.version,
  };
}

function parseJsonArray<T>(value: string, columnName: string): readonly T[] {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`INVALID_CHAPTER_EXECUTION_CARD_JSON: ${columnName}`);
  }

  return parsed as readonly T[];
}
