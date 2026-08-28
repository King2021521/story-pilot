import type { ProjectDatabase } from "../project-database.js";

export const CREATIVE_STAGE_KEYS = [
  "brief",
  "blueprint",
  "worldbuilding",
  "characters",
  "plot_arcs",
  "outline",
  "chapters",
  "memory_review",
  "retrospective",
] as const;

export type CreativeStageKey = (typeof CREATIVE_STAGE_KEYS)[number];

export interface CreativeStageRecord {
  readonly id: string;
  readonly projectId: string;
  readonly stageKey: CreativeStageKey;
  readonly status: string;
  readonly readinessScore: number;
  readonly gateReport: Record<string, unknown>;
  readonly currentWorkOrderId: string | null;
  readonly completedAt: number | null;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface ProjectBriefRecord {
  readonly id: string;
  readonly projectId: string;
  readonly genre: string;
  readonly subgenres: readonly string[];
  readonly targetAudience: string | null;
  readonly platformProfile: string | null;
  readonly lengthProfile: string | null;
  readonly narrativePov: string | null;
  readonly emotionalRewards: readonly string[];
  readonly initialIdea: string | null;
  readonly forbiddenDirections: readonly string[];
  readonly status: string;
  readonly version: number;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface StoryBlueprintRecord {
  readonly id: string;
  readonly projectId: string;
  readonly premise: string;
  readonly logline: string;
  readonly corePromise: string;
  readonly mainConflict: string;
  readonly protagonistArc: string | null;
  readonly antagonistForce: string | null;
  readonly differentiators: readonly string[];
  readonly risks: readonly string[];
  readonly status: string;
  readonly version: number;
  readonly sourceArtifactId: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface CreativePathRecord {
  readonly stages: readonly CreativeStageRecord[];
  readonly brief: ProjectBriefRecord | null;
  readonly blueprint: StoryBlueprintRecord | null;
}

export interface SaveProjectBriefInput {
  readonly briefId: string;
  readonly projectId: string;
  readonly genre: string;
  readonly subgenres: readonly string[];
  readonly targetAudience?: string;
  readonly platformProfile?: string;
  readonly lengthProfile?: string;
  readonly narrativePov?: string;
  readonly emotionalRewards?: readonly string[];
  readonly initialIdea?: string;
  readonly forbiddenDirections?: readonly string[];
  readonly now?: number;
}

export interface SaveStoryBlueprintInput {
  readonly blueprintId: string;
  readonly projectId: string;
  readonly premise: string;
  readonly logline: string;
  readonly corePromise: string;
  readonly mainConflict: string;
  readonly protagonistArc?: string;
  readonly antagonistForce?: string;
  readonly differentiators?: readonly string[];
  readonly risks?: readonly string[];
  readonly sourceArtifactId?: string;
  readonly now?: number;
}

interface CreativeStageRow {
  readonly id: string;
  readonly project_id: string;
  readonly stage_key: string;
  readonly status: string;
  readonly readiness_score: number;
  readonly gate_report_json: string;
  readonly current_work_order_id: string | null;
  readonly completed_at: number | null;
  readonly created_at: number;
  readonly updated_at: number;
}

interface ProjectBriefRow {
  readonly id: string;
  readonly project_id: string;
  readonly genre: string;
  readonly subgenres_json: string;
  readonly target_audience: string | null;
  readonly platform_profile: string | null;
  readonly length_profile: string | null;
  readonly narrative_pov: string | null;
  readonly emotional_rewards_json: string;
  readonly initial_idea: string | null;
  readonly forbidden_directions_json: string;
  readonly status: string;
  readonly version: number;
  readonly created_at: number;
  readonly updated_at: number;
}

interface StoryBlueprintRow {
  readonly id: string;
  readonly project_id: string;
  readonly premise: string;
  readonly logline: string;
  readonly core_promise: string;
  readonly main_conflict: string;
  readonly protagonist_arc: string | null;
  readonly antagonist_force: string | null;
  readonly differentiators_json: string;
  readonly risks_json: string;
  readonly status: string;
  readonly version: number;
  readonly source_artifact_id: string | null;
  readonly created_at: number;
  readonly updated_at: number;
}

export class CreativePathRepository {
  constructor(private readonly projectDatabase: ProjectDatabase) {}

  initializePath(projectId: string, now = Date.now()): CreativeStageRecord[] {
    const insert = this.projectDatabase.client.prepare(`
      insert or ignore into creative_stages (
        id, project_id, stage_key, status, readiness_score, gate_report_json,
        created_at, updated_at
      )
      values (
        @id, @projectId, @stageKey, @status, @readinessScore, @gateReportJson,
        @now, @now
      )
    `);

    const initialize = this.projectDatabase.client.transaction(() => {
      for (const [index, stageKey] of CREATIVE_STAGE_KEYS.entries()) {
        insert.run({
          gateReportJson: JSON.stringify({ initialized: true }),
          id: `${projectId}:${stageKey}`,
          now,
          projectId,
          readinessScore: stageKey === "brief" ? 10 : 0,
          stageKey,
          status: index === 0 ? "available" : "locked",
        });
      }
    });

    initialize();

    return this.listStages(projectId);
  }

  getPath(projectId: string): CreativePathRecord {
    return {
      blueprint: this.getActiveBlueprint(projectId),
      brief: this.getLatestBrief(projectId),
      stages: this.listStages(projectId),
    };
  }

  listStages(projectId: string): CreativeStageRecord[] {
    const rows = this.projectDatabase.client
      .prepare("select * from creative_stages where project_id = ?")
      .all(projectId)
      .map((row) => mapCreativeStageRow(row as CreativeStageRow));

    return [...rows].sort(
      (left, right) =>
        CREATIVE_STAGE_KEYS.indexOf(left.stageKey) - CREATIVE_STAGE_KEYS.indexOf(right.stageKey),
    );
  }

  saveBrief(input: SaveProjectBriefInput): ProjectBriefRecord {
    const now = input.now ?? Date.now();
    const nextVersion = this.getNextBriefVersion(input.projectId);

    this.projectDatabase.client
      .prepare(
        `
        insert into project_briefs (
          id, project_id, genre, subgenres_json, target_audience, platform_profile,
          length_profile, narrative_pov, emotional_rewards_json, initial_idea,
          forbidden_directions_json, status, version, created_at, updated_at
        )
        values (
          @briefId, @projectId, @genre, @subgenresJson, @targetAudience, @platformProfile,
          @lengthProfile, @narrativePov, @emotionalRewardsJson, @initialIdea,
          @forbiddenDirectionsJson, 'draft', @version, @now, @now
        )
      `,
      )
      .run({
        briefId: input.briefId,
        emotionalRewardsJson: JSON.stringify(input.emotionalRewards ?? []),
        forbiddenDirectionsJson: JSON.stringify(input.forbiddenDirections ?? []),
        genre: input.genre,
        initialIdea: input.initialIdea ?? null,
        lengthProfile: input.lengthProfile ?? null,
        narrativePov: input.narrativePov ?? null,
        now,
        platformProfile: input.platformProfile ?? null,
        projectId: input.projectId,
        subgenresJson: JSON.stringify(input.subgenres),
        targetAudience: input.targetAudience ?? null,
        version: nextVersion,
      });

    const brief = this.getBriefById(input.projectId, input.briefId);
    if (!brief) {
      throw new Error(`PROJECT_BRIEF_NOT_CREATED: ${input.briefId}`);
    }

    return brief;
  }

  confirmBrief(projectId: string, briefId: string, now = Date.now()): ProjectBriefRecord {
    const confirm = this.projectDatabase.client.transaction(() => {
      this.projectDatabase.client
        .prepare(
          "update project_briefs set status = 'deprecated', updated_at = ? where project_id = ? and status = 'confirmed'",
        )
        .run(now, projectId);
      this.projectDatabase.client
        .prepare(
          "update project_briefs set status = 'confirmed', updated_at = ? where project_id = ? and id = ?",
        )
        .run(now, projectId, briefId);
      this.completeStage(projectId, "brief", "blueprint", now);
    });

    confirm();

    const brief = this.getBriefById(projectId, briefId);
    if (!brief || brief.status !== "confirmed") {
      throw new Error(`PROJECT_BRIEF_NOT_FOUND: ${briefId}`);
    }

    return brief;
  }

  saveBlueprint(input: SaveStoryBlueprintInput): StoryBlueprintRecord {
    const now = input.now ?? Date.now();
    const nextVersion = this.getNextBlueprintVersion(input.projectId);

    this.projectDatabase.client
      .prepare(
        `
        insert into story_blueprints (
          id, project_id, premise, logline, core_promise, main_conflict,
          protagonist_arc, antagonist_force, differentiators_json, risks_json,
          status, version, source_artifact_id, created_at, updated_at
        )
        values (
          @blueprintId, @projectId, @premise, @logline, @corePromise, @mainConflict,
          @protagonistArc, @antagonistForce, @differentiatorsJson, @risksJson,
          'draft', @version, @sourceArtifactId, @now, @now
        )
      `,
      )
      .run({
        antagonistForce: input.antagonistForce ?? null,
        blueprintId: input.blueprintId,
        corePromise: input.corePromise,
        differentiatorsJson: JSON.stringify(input.differentiators ?? []),
        logline: input.logline,
        mainConflict: input.mainConflict,
        now,
        premise: input.premise,
        projectId: input.projectId,
        protagonistArc: input.protagonistArc ?? null,
        risksJson: JSON.stringify(input.risks ?? []),
        sourceArtifactId: input.sourceArtifactId ?? null,
        version: nextVersion,
      });

    const blueprint = this.getBlueprintById(input.projectId, input.blueprintId);
    if (!blueprint) {
      throw new Error(`STORY_BLUEPRINT_NOT_CREATED: ${input.blueprintId}`);
    }

    return blueprint;
  }

  applyBlueprint(projectId: string, blueprintId: string, now = Date.now()): StoryBlueprintRecord {
    const apply = this.projectDatabase.client.transaction(() => {
      this.projectDatabase.client
        .prepare(
          "update story_blueprints set status = 'archived', updated_at = ? where project_id = ? and status = 'confirmed'",
        )
        .run(now, projectId);
      this.projectDatabase.client
        .prepare(
          "update story_blueprints set status = 'confirmed', updated_at = ? where project_id = ? and id = ?",
        )
        .run(now, projectId, blueprintId);
      this.completeStage(projectId, "blueprint", "worldbuilding", now);
    });

    apply();

    const blueprint = this.getBlueprintById(projectId, blueprintId);
    if (!blueprint || blueprint.status !== "confirmed") {
      throw new Error(`STORY_BLUEPRINT_NOT_FOUND: ${blueprintId}`);
    }

    return blueprint;
  }

  markStageCompleted(
    projectId: string,
    stageKey: CreativeStageKey,
    nextStageKey: CreativeStageKey | null,
    now = Date.now(),
  ): CreativeStageRecord {
    this.completeStage(projectId, stageKey, nextStageKey, now);
    const stage = this.listStages(projectId).find((candidate) => candidate.stageKey === stageKey);
    if (!stage) {
      throw new Error(`CREATIVE_STAGE_NOT_FOUND: ${stageKey}`);
    }

    return stage;
  }

  getLatestBrief(projectId: string): ProjectBriefRecord | null {
    const row = this.projectDatabase.client
      .prepare(
        "select * from project_briefs where project_id = ? order by updated_at desc, version desc limit 1",
      )
      .get(projectId) as ProjectBriefRow | undefined;

    return row ? mapProjectBriefRow(row) : null;
  }

  getActiveBlueprint(projectId: string): StoryBlueprintRecord | null {
    const row = this.projectDatabase.client
      .prepare(
        `
        select * from story_blueprints
        where project_id = ?
        order by case status when 'confirmed' then 0 when 'draft' then 1 else 2 end, updated_at desc, version desc
        limit 1
        `,
      )
      .get(projectId) as StoryBlueprintRow | undefined;

    return row ? mapStoryBlueprintRow(row) : null;
  }

  getBriefById(projectId: string, briefId: string): ProjectBriefRecord | null {
    const row = this.projectDatabase.client
      .prepare("select * from project_briefs where project_id = ? and id = ?")
      .get(projectId, briefId) as ProjectBriefRow | undefined;

    return row ? mapProjectBriefRow(row) : null;
  }

  getBlueprintById(projectId: string, blueprintId: string): StoryBlueprintRecord | null {
    const row = this.projectDatabase.client
      .prepare("select * from story_blueprints where project_id = ? and id = ?")
      .get(projectId, blueprintId) as StoryBlueprintRow | undefined;

    return row ? mapStoryBlueprintRow(row) : null;
  }

  private completeStage(
    projectId: string,
    stageKey: CreativeStageKey,
    nextStageKey: CreativeStageKey | null,
    now: number,
  ): void {
    this.projectDatabase.client
      .prepare(
        `
        update creative_stages
        set status = 'completed',
            readiness_score = 100,
            gate_report_json = @gateReportJson,
            completed_at = @now,
            updated_at = @now
        where project_id = @projectId and stage_key = @stageKey
      `,
      )
      .run({
        gateReportJson: JSON.stringify({ completed: true }),
        now,
        projectId,
        stageKey,
      });

    if (nextStageKey) {
      this.projectDatabase.client
        .prepare(
          `
          update creative_stages
          set status = case when status = 'locked' then 'available' else status end,
              readiness_score = case when readiness_score = 0 then 10 else readiness_score end,
              updated_at = @now
          where project_id = @projectId and stage_key = @nextStageKey
        `,
        )
        .run({
          nextStageKey,
          now,
          projectId,
        });
    }
  }

  private getNextBriefVersion(projectId: string): number {
    return (
      this.projectDatabase.client
        .prepare(
          "select coalesce(max(version), 0) + 1 as next_version from project_briefs where project_id = ?",
        )
        .get(projectId) as { next_version: number }
    ).next_version;
  }

  private getNextBlueprintVersion(projectId: string): number {
    return (
      this.projectDatabase.client
        .prepare(
          "select coalesce(max(version), 0) + 1 as next_version from story_blueprints where project_id = ?",
        )
        .get(projectId) as { next_version: number }
    ).next_version;
  }
}

function mapCreativeStageRow(row: CreativeStageRow): CreativeStageRecord {
  const stageKey = row.stage_key as CreativeStageKey;
  if (!CREATIVE_STAGE_KEYS.includes(stageKey)) {
    throw new Error(`UNKNOWN_CREATIVE_STAGE: ${row.stage_key}`);
  }

  return {
    completedAt: row.completed_at,
    createdAt: row.created_at,
    currentWorkOrderId: row.current_work_order_id,
    gateReport: parseJsonRecord(row.gate_report_json),
    id: row.id,
    projectId: row.project_id,
    readinessScore: row.readiness_score,
    stageKey,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

function mapProjectBriefRow(row: ProjectBriefRow): ProjectBriefRecord {
  return {
    createdAt: row.created_at,
    emotionalRewards: parseJsonArray(row.emotional_rewards_json),
    forbiddenDirections: parseJsonArray(row.forbidden_directions_json),
    genre: row.genre,
    id: row.id,
    initialIdea: row.initial_idea,
    lengthProfile: row.length_profile,
    narrativePov: row.narrative_pov,
    platformProfile: row.platform_profile,
    projectId: row.project_id,
    status: row.status,
    subgenres: parseJsonArray(row.subgenres_json),
    targetAudience: row.target_audience,
    updatedAt: row.updated_at,
    version: row.version,
  };
}

function mapStoryBlueprintRow(row: StoryBlueprintRow): StoryBlueprintRecord {
  return {
    antagonistForce: row.antagonist_force,
    corePromise: row.core_promise,
    createdAt: row.created_at,
    differentiators: parseJsonArray(row.differentiators_json),
    id: row.id,
    logline: row.logline,
    mainConflict: row.main_conflict,
    premise: row.premise,
    projectId: row.project_id,
    protagonistArc: row.protagonist_arc,
    risks: parseJsonArray(row.risks_json),
    sourceArtifactId: row.source_artifact_id,
    status: row.status,
    updatedAt: row.updated_at,
    version: row.version,
  };
}

function parseJsonArray(value: string): readonly string[] {
  const parsed: unknown = JSON.parse(value || "[]");
  return Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === "string")
    : [];
}

function parseJsonRecord(value: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value || "{}");
  return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}
