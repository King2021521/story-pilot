import { randomUUID } from "node:crypto";

import type { ProjectDatabase } from "../project-database.js";

export type PlotDebtStatus = "open" | "reinforced" | "payoff_ready" | "paid_off" | "dropped";
export type PlotDebtRiskLevel = "low" | "medium" | "high" | "critical";

export interface PlotDebtRecord {
  readonly actualPayoffChapterIndex: number | null;
  readonly createdAt: number;
  readonly debtType: string;
  readonly expectedPayoffChapterIndex: number | null;
  readonly id: string;
  readonly lifecycleNotes: readonly string[];
  readonly promise: string;
  readonly projectId: string;
  readonly relatedCharacterIds: readonly string[];
  readonly relatedForeshadowingId: string | null;
  readonly relatedPlotlineId: string | null;
  readonly relatedWorldRuleIds: readonly string[];
  readonly riskLevel: PlotDebtRiskLevel | string;
  readonly seedChapterIndex: number | null;
  readonly status: PlotDebtStatus | string;
  readonly title: string;
  readonly updatedAt: number;
}

export interface SavePlotDebtInput {
  readonly actualPayoffChapterIndex?: number | null;
  readonly debtId?: string;
  readonly debtType: string;
  readonly expectedPayoffChapterIndex?: number | null;
  readonly id?: string;
  readonly lifecycleNotes?: readonly string[];
  readonly now?: number;
  readonly promise: string;
  readonly projectId: string;
  readonly relatedCharacterIds?: readonly string[];
  readonly relatedForeshadowingId?: string | null;
  readonly relatedPlotlineId?: string | null;
  readonly relatedWorldRuleIds?: readonly string[];
  readonly riskLevel?: PlotDebtRiskLevel | string;
  readonly seedChapterIndex?: number | null;
  readonly status?: PlotDebtStatus | string;
  readonly title: string;
}

export interface StoryStateSnapshotRecord {
  readonly activeConflicts: readonly string[];
  readonly chapterId: string | null;
  readonly chapterIndex: number;
  readonly createdAt: number;
  readonly currentArcPlanId: string | null;
  readonly currentVolumeId: string | null;
  readonly globalSituation: string;
  readonly hiddenInformation: readonly string[];
  readonly id: string;
  readonly locationState: Record<string, unknown>;
  readonly openQuestions: readonly string[];
  readonly organizationState: Record<string, unknown>;
  readonly projectId: string;
  readonly resourceState: Record<string, unknown>;
  readonly revealedInformation: readonly string[];
  readonly sourceChapterVersion: number | null;
  readonly storyTime: string | null;
}

export interface CreateStoryStateSnapshotInput {
  readonly activeConflicts?: readonly string[];
  readonly chapterId?: string | null;
  readonly chapterIndex: number;
  readonly currentArcPlanId?: string | null;
  readonly currentVolumeId?: string | null;
  readonly globalSituation: string;
  readonly hiddenInformation?: readonly string[];
  readonly locationState?: Record<string, unknown>;
  readonly now?: number;
  readonly openQuestions?: readonly string[];
  readonly organizationState?: Record<string, unknown>;
  readonly projectId: string;
  readonly resourceState?: Record<string, unknown>;
  readonly revealedInformation?: readonly string[];
  readonly sourceChapterVersion?: number | null;
  readonly storySnapshotId?: string;
  readonly storyTime?: string | null;
}

export interface CharacterStateSnapshotRecord {
  readonly characterId: string;
  readonly chapterId: string | null;
  readonly chapterIndex: number;
  readonly createdAt: number;
  readonly emotionalState: string;
  readonly externalGoal: string;
  readonly id: string;
  readonly internalNeed: string;
  readonly knowledgeState: string;
  readonly physicalState: string;
  readonly position: string;
  readonly projectId: string;
  readonly relationshipState: Record<string, unknown>;
  readonly resourceState: Record<string, unknown>;
  readonly riskFlags: readonly string[];
  readonly secrets: readonly string[];
  readonly sourceId: string;
  readonly sourceType: string;
}

export interface CreateCharacterStateSnapshotInput {
  readonly characterId: string;
  readonly chapterId?: string | null;
  readonly chapterIndex: number;
  readonly emotionalState?: string;
  readonly externalGoal?: string;
  readonly internalNeed?: string;
  readonly knowledgeState?: string;
  readonly now?: number;
  readonly physicalState?: string;
  readonly position?: string;
  readonly projectId: string;
  readonly relationshipState?: Record<string, unknown>;
  readonly resourceState?: Record<string, unknown>;
  readonly riskFlags?: readonly string[];
  readonly secrets?: readonly string[];
  readonly sourceId: string;
  readonly sourceType: string;
  readonly stateSnapshotId?: string;
}

interface PlotDebtRow {
  readonly actual_payoff_chapter_index: number | null;
  readonly created_at: number;
  readonly debt_type: string;
  readonly expected_payoff_chapter_index: number | null;
  readonly id: string;
  readonly lifecycle_notes_json: string;
  readonly promise: string;
  readonly project_id: string;
  readonly related_character_ids_json: string;
  readonly related_foreshadowing_id: string | null;
  readonly related_plotline_id: string | null;
  readonly related_world_rule_ids_json: string;
  readonly risk_level: string;
  readonly seed_chapter_index: number | null;
  readonly status: string;
  readonly title: string;
  readonly updated_at: number;
}

interface StoryStateSnapshotRow {
  readonly active_conflicts_json: string;
  readonly chapter_id: string | null;
  readonly chapter_index: number;
  readonly created_at: number;
  readonly current_arc_plan_id: string | null;
  readonly current_volume_id: string | null;
  readonly global_situation: string;
  readonly hidden_information_json: string;
  readonly id: string;
  readonly location_state_json: string;
  readonly open_questions_json: string;
  readonly organization_state_json: string;
  readonly project_id: string;
  readonly resource_state_json: string;
  readonly revealed_information_json: string;
  readonly source_chapter_version: number | null;
  readonly story_time: string | null;
}

interface CharacterStateSnapshotRow {
  readonly character_id: string;
  readonly chapter_id: string | null;
  readonly chapter_index: number;
  readonly created_at: number;
  readonly emotional_state: string;
  readonly external_goal: string;
  readonly id: string;
  readonly internal_need: string;
  readonly knowledge_state: string;
  readonly physical_state: string;
  readonly position: string;
  readonly project_id: string;
  readonly relationship_state_json: string;
  readonly resource_state_json: string;
  readonly risk_flags_json: string;
  readonly secrets_json: string;
  readonly source_id: string;
  readonly source_type: string;
}

export class SerialStateRepository {
  constructor(private readonly projectDatabase: ProjectDatabase) {}

  savePlotDebt(input: SavePlotDebtInput): PlotDebtRecord {
    const debtId = input.debtId ?? input.id ?? randomUUID();
    const now = input.now ?? Date.now();
    const existing = this.getPlotDebtById(input.projectId, debtId);
    const createdAt = existing?.createdAt ?? now;

    this.projectDatabase.client
      .prepare(
        `
        insert into plot_debts (
          id, project_id, title, debt_type, promise, seed_chapter_index,
          expected_payoff_chapter_index, actual_payoff_chapter_index, status, risk_level,
          related_plotline_id, related_character_ids_json, related_foreshadowing_id,
          related_world_rule_ids_json, lifecycle_notes_json, created_at, updated_at
        )
        values (
          @debtId, @projectId, @title, @debtType, @promise, @seedChapterIndex,
          @expectedPayoffChapterIndex, @actualPayoffChapterIndex, @status, @riskLevel,
          @relatedPlotlineId, @relatedCharacterIdsJson, @relatedForeshadowingId,
          @relatedWorldRuleIdsJson, @lifecycleNotesJson, @createdAt, @now
        )
        on conflict(id) do update set
          title = excluded.title,
          debt_type = excluded.debt_type,
          promise = excluded.promise,
          seed_chapter_index = excluded.seed_chapter_index,
          expected_payoff_chapter_index = excluded.expected_payoff_chapter_index,
          actual_payoff_chapter_index = excluded.actual_payoff_chapter_index,
          status = excluded.status,
          risk_level = excluded.risk_level,
          related_plotline_id = excluded.related_plotline_id,
          related_character_ids_json = excluded.related_character_ids_json,
          related_foreshadowing_id = excluded.related_foreshadowing_id,
          related_world_rule_ids_json = excluded.related_world_rule_ids_json,
          lifecycle_notes_json = excluded.lifecycle_notes_json,
          updated_at = excluded.updated_at
        `,
      )
      .run({
        actualPayoffChapterIndex: input.actualPayoffChapterIndex ?? null,
        createdAt,
        debtId,
        debtType: input.debtType,
        expectedPayoffChapterIndex: input.expectedPayoffChapterIndex ?? null,
        lifecycleNotesJson: JSON.stringify(input.lifecycleNotes ?? []),
        now,
        promise: input.promise,
        projectId: input.projectId,
        relatedCharacterIdsJson: JSON.stringify(input.relatedCharacterIds ?? []),
        relatedForeshadowingId: input.relatedForeshadowingId ?? null,
        relatedPlotlineId: input.relatedPlotlineId ?? null,
        relatedWorldRuleIdsJson: JSON.stringify(input.relatedWorldRuleIds ?? []),
        riskLevel: input.riskLevel ?? "medium",
        seedChapterIndex: input.seedChapterIndex ?? null,
        status: input.status ?? "open",
        title: input.title,
      });

    const saved = this.getPlotDebtById(input.projectId, debtId);
    if (!saved) {
      throw new Error(`PLOT_DEBT_NOT_SAVED: ${debtId}`);
    }
    return saved;
  }

  getPlotDebtById(projectId: string, debtId: string): PlotDebtRecord | null {
    const row = this.projectDatabase.client
      .prepare("select * from plot_debts where project_id = ? and id = ?")
      .get(projectId, debtId) as PlotDebtRow | undefined;

    return row ? mapPlotDebtRow(row) : null;
  }

  listPlotDebts(input: {
    readonly projectId: string;
    readonly riskLevel?: readonly string[];
    readonly status?: readonly string[];
  }): PlotDebtRecord[] {
    const rows = this.projectDatabase.client
      .prepare(
        `
        select * from plot_debts
        where project_id = ?
        order by
          case risk_level
            when 'critical' then 1
            when 'high' then 2
            when 'medium' then 3
            else 4
          end,
          coalesce(expected_payoff_chapter_index, 999999),
          updated_at desc
        `,
      )
      .all(input.projectId)
      .map((row) => mapPlotDebtRow(row as PlotDebtRow));

    return rows.filter((debt) => {
      const statusMatches = !input.status?.length || input.status.includes(debt.status);
      const riskMatches = !input.riskLevel?.length || input.riskLevel.includes(debt.riskLevel);
      return statusMatches && riskMatches;
    });
  }

  createStorySnapshot(input: CreateStoryStateSnapshotInput): StoryStateSnapshotRecord {
    const snapshotId = input.storySnapshotId ?? randomUUID();
    const now = input.now ?? Date.now();

    this.projectDatabase.client
      .prepare(
        `
        insert into story_state_snapshots (
          id, project_id, chapter_id, chapter_index, story_time, current_volume_id,
          current_arc_plan_id, global_situation, active_conflicts_json, open_questions_json,
          revealed_information_json, hidden_information_json, resource_state_json,
          location_state_json, organization_state_json, source_chapter_version, created_at
        )
        values (
          @snapshotId, @projectId, @chapterId, @chapterIndex, @storyTime, @currentVolumeId,
          @currentArcPlanId, @globalSituation, @activeConflictsJson, @openQuestionsJson,
          @revealedInformationJson, @hiddenInformationJson, @resourceStateJson,
          @locationStateJson, @organizationStateJson, @sourceChapterVersion, @now
        )
        `,
      )
      .run({
        activeConflictsJson: JSON.stringify(input.activeConflicts ?? []),
        chapterId: input.chapterId ?? null,
        chapterIndex: input.chapterIndex,
        currentArcPlanId: input.currentArcPlanId ?? null,
        currentVolumeId: input.currentVolumeId ?? null,
        globalSituation: input.globalSituation,
        hiddenInformationJson: JSON.stringify(input.hiddenInformation ?? []),
        locationStateJson: JSON.stringify(input.locationState ?? {}),
        now,
        openQuestionsJson: JSON.stringify(input.openQuestions ?? []),
        organizationStateJson: JSON.stringify(input.organizationState ?? {}),
        projectId: input.projectId,
        resourceStateJson: JSON.stringify(input.resourceState ?? {}),
        revealedInformationJson: JSON.stringify(input.revealedInformation ?? []),
        snapshotId,
        sourceChapterVersion: input.sourceChapterVersion ?? null,
        storyTime: input.storyTime ?? null,
      });

    const snapshot = this.getStorySnapshotById(input.projectId, snapshotId);
    if (!snapshot) {
      throw new Error(`STORY_STATE_SNAPSHOT_NOT_SAVED: ${snapshotId}`);
    }
    return snapshot;
  }

  getStorySnapshotById(projectId: string, snapshotId: string): StoryStateSnapshotRecord | null {
    const row = this.projectDatabase.client
      .prepare("select * from story_state_snapshots where project_id = ? and id = ?")
      .get(projectId, snapshotId) as StoryStateSnapshotRow | undefined;

    return row ? mapStoryStateSnapshotRow(row) : null;
  }

  getLatestStorySnapshot(projectId: string): StoryStateSnapshotRecord | null {
    const row = this.projectDatabase.client
      .prepare(
        `
        select * from story_state_snapshots
        where project_id = ?
        order by chapter_index desc, created_at desc
        limit 1
        `,
      )
      .get(projectId) as StoryStateSnapshotRow | undefined;

    return row ? mapStoryStateSnapshotRow(row) : null;
  }

  listStorySnapshots(projectId: string): StoryStateSnapshotRecord[] {
    return this.projectDatabase.client
      .prepare(
        `
        select * from story_state_snapshots
        where project_id = ?
        order by chapter_index desc, created_at desc
        `,
      )
      .all(projectId)
      .map((row) => mapStoryStateSnapshotRow(row as StoryStateSnapshotRow));
  }

  createCharacterSnapshot(input: CreateCharacterStateSnapshotInput): CharacterStateSnapshotRecord {
    const snapshotId = input.stateSnapshotId ?? randomUUID();
    const now = input.now ?? Date.now();

    this.projectDatabase.client
      .prepare(
        `
        insert into character_state_snapshots (
          id, project_id, character_id, chapter_id, chapter_index, external_goal,
          internal_need, physical_state, emotional_state, knowledge_state,
          relationship_state_json, resource_state_json, secrets_json, position,
          risk_flags_json, source_type, source_id, created_at
        )
        values (
          @snapshotId, @projectId, @characterId, @chapterId, @chapterIndex, @externalGoal,
          @internalNeed, @physicalState, @emotionalState, @knowledgeState,
          @relationshipStateJson, @resourceStateJson, @secretsJson, @position,
          @riskFlagsJson, @sourceType, @sourceId, @now
        )
        `,
      )
      .run({
        characterId: input.characterId,
        chapterId: input.chapterId ?? null,
        chapterIndex: input.chapterIndex,
        emotionalState: input.emotionalState ?? "",
        externalGoal: input.externalGoal ?? "",
        internalNeed: input.internalNeed ?? "",
        knowledgeState: input.knowledgeState ?? "",
        now,
        physicalState: input.physicalState ?? "",
        position: input.position ?? "",
        projectId: input.projectId,
        relationshipStateJson: JSON.stringify(input.relationshipState ?? {}),
        resourceStateJson: JSON.stringify(input.resourceState ?? {}),
        riskFlagsJson: JSON.stringify(input.riskFlags ?? []),
        secretsJson: JSON.stringify(input.secrets ?? []),
        snapshotId,
        sourceId: input.sourceId,
        sourceType: input.sourceType,
      });

    const snapshot = this.getCharacterSnapshotById(input.projectId, snapshotId);
    if (!snapshot) {
      throw new Error(`CHARACTER_STATE_SNAPSHOT_NOT_SAVED: ${snapshotId}`);
    }
    return snapshot;
  }

  getCharacterSnapshotById(
    projectId: string,
    snapshotId: string,
  ): CharacterStateSnapshotRecord | null {
    const row = this.projectDatabase.client
      .prepare("select * from character_state_snapshots where project_id = ? and id = ?")
      .get(projectId, snapshotId) as CharacterStateSnapshotRow | undefined;

    return row ? mapCharacterStateSnapshotRow(row) : null;
  }

  listCharacterSnapshots(input: {
    readonly characterId?: string;
    readonly projectId: string;
  }): CharacterStateSnapshotRecord[] {
    const rows = this.projectDatabase.client
      .prepare(
        `
        select * from character_state_snapshots
        where project_id = ?
        order by chapter_index desc, created_at desc
        `,
      )
      .all(input.projectId)
      .map((row) => mapCharacterStateSnapshotRow(row as CharacterStateSnapshotRow));

    return input.characterId
      ? rows.filter((snapshot) => snapshot.characterId === input.characterId)
      : rows;
  }
}

function mapPlotDebtRow(row: PlotDebtRow): PlotDebtRecord {
  return {
    actualPayoffChapterIndex: row.actual_payoff_chapter_index,
    createdAt: row.created_at,
    debtType: row.debt_type,
    expectedPayoffChapterIndex: row.expected_payoff_chapter_index,
    id: row.id,
    lifecycleNotes: parseStringArray(row.lifecycle_notes_json),
    promise: row.promise,
    projectId: row.project_id,
    relatedCharacterIds: parseStringArray(row.related_character_ids_json),
    relatedForeshadowingId: row.related_foreshadowing_id,
    relatedPlotlineId: row.related_plotline_id,
    relatedWorldRuleIds: parseStringArray(row.related_world_rule_ids_json),
    riskLevel: row.risk_level,
    seedChapterIndex: row.seed_chapter_index,
    status: row.status,
    title: row.title,
    updatedAt: row.updated_at,
  };
}

function mapStoryStateSnapshotRow(row: StoryStateSnapshotRow): StoryStateSnapshotRecord {
  return {
    activeConflicts: parseStringArray(row.active_conflicts_json),
    chapterId: row.chapter_id,
    chapterIndex: row.chapter_index,
    createdAt: row.created_at,
    currentArcPlanId: row.current_arc_plan_id,
    currentVolumeId: row.current_volume_id,
    globalSituation: row.global_situation,
    hiddenInformation: parseStringArray(row.hidden_information_json),
    id: row.id,
    locationState: parseRecord(row.location_state_json),
    openQuestions: parseStringArray(row.open_questions_json),
    organizationState: parseRecord(row.organization_state_json),
    projectId: row.project_id,
    resourceState: parseRecord(row.resource_state_json),
    revealedInformation: parseStringArray(row.revealed_information_json),
    sourceChapterVersion: row.source_chapter_version,
    storyTime: row.story_time,
  };
}

function mapCharacterStateSnapshotRow(
  row: CharacterStateSnapshotRow,
): CharacterStateSnapshotRecord {
  return {
    characterId: row.character_id,
    chapterId: row.chapter_id,
    chapterIndex: row.chapter_index,
    createdAt: row.created_at,
    emotionalState: row.emotional_state,
    externalGoal: row.external_goal,
    id: row.id,
    internalNeed: row.internal_need,
    knowledgeState: row.knowledge_state,
    physicalState: row.physical_state,
    position: row.position,
    projectId: row.project_id,
    relationshipState: parseRecord(row.relationship_state_json),
    resourceState: parseRecord(row.resource_state_json),
    riskFlags: parseStringArray(row.risk_flags_json),
    secrets: parseStringArray(row.secrets_json),
    sourceId: row.source_id,
    sourceType: row.source_type,
  };
}

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function parseRecord(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
