import type { ProjectDatabase } from "../project-database.js";

export interface PlotlineRecord {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly type: string;
  readonly status: string;
  readonly narrativeRole: string;
  readonly importance: string;
  readonly summary: string | null;
  readonly centralQuestion: string | null;
  readonly driver: string | null;
  readonly startState: string | null;
  readonly midEscalation: string | null;
  readonly payoffPlan: string | null;
  readonly emotionalPromise: string | null;
  readonly relatedCharacterIds: string[];
  readonly relatedWorldRuleIds: string[];
  readonly relatedForeshadowingIds: string[];
  readonly relatedStoryEventIds: string[];
  readonly priority: number;
  readonly nodes: PlotlineNodeRecord[];
}

export interface StoryEventParticipantRecord {
  readonly id: string;
  readonly projectId: string;
  readonly eventId: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly role: string;
}

export interface StoryEventRecord {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly eventType: string;
  readonly summary: string;
  readonly status: string;
  readonly participants: StoryEventParticipantRecord[];
}

export interface ForeshadowingEventLinkRecord {
  readonly id: string;
  readonly projectId: string;
  readonly foreshadowingId: string;
  readonly eventId: string;
  readonly role: "seed" | "payoff";
  readonly note: string | null;
}

export interface ForeshadowingRecord {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly status: string;
  readonly seedText: string | null;
  readonly payoffText: string | null;
  readonly links: ForeshadowingEventLinkRecord[];
}

export interface PlotlineNodeRecord {
  readonly id: string;
  readonly projectId: string;
  readonly plotlineId: string;
  readonly title: string;
  readonly position: number;
  readonly kind: string;
  readonly status: string;
  readonly description: string | null;
  readonly chapterHint: string | null;
  readonly targetChapterId: string | null;
}

export interface CreatePlotlineRecordInput {
  readonly plotlineId: string;
  readonly projectId: string;
  readonly title: string;
  readonly kind: string;
  readonly narrativeRole?: string;
  readonly importance?: string;
  readonly status?: string;
  readonly summary?: string;
  readonly centralQuestion?: string;
  readonly driver?: string;
  readonly startState?: string;
  readonly midEscalation?: string;
  readonly payoffPlan?: string;
  readonly emotionalPromise?: string;
  readonly relatedCharacterIds?: readonly string[];
  readonly relatedWorldRuleIds?: readonly string[];
  readonly relatedForeshadowingIds?: readonly string[];
  readonly relatedStoryEventIds?: readonly string[];
  readonly priority: number;
  readonly now?: number;
}

export interface UpdatePlotlineRecordInput {
  readonly projectId: string;
  readonly plotlineId: string;
  readonly title?: string;
  readonly kind?: string;
  readonly narrativeRole?: string;
  readonly importance?: string;
  readonly status?: string;
  readonly summary?: string;
  readonly centralQuestion?: string;
  readonly driver?: string;
  readonly startState?: string;
  readonly midEscalation?: string;
  readonly payoffPlan?: string;
  readonly emotionalPromise?: string;
  readonly relatedCharacterIds?: readonly string[];
  readonly relatedWorldRuleIds?: readonly string[];
  readonly relatedForeshadowingIds?: readonly string[];
  readonly relatedStoryEventIds?: readonly string[];
  readonly priority?: number;
  readonly now?: number;
}

export interface CreatePlotlineNodeRecordInput {
  readonly plotlineNodeId: string;
  readonly projectId: string;
  readonly plotlineId: string;
  readonly title: string;
  readonly kind: string;
  readonly status?: string;
  readonly description?: string;
  readonly chapterHint?: string;
  readonly targetChapterId?: string;
  readonly position?: number;
  readonly now?: number;
}

export interface CreateStoryEventRecordInput {
  readonly eventId: string;
  readonly projectId: string;
  readonly title: string;
  readonly description: string;
  readonly eventType: string;
  readonly chapterId?: string;
  readonly sceneId?: string;
  readonly storyTime?: string;
  readonly participants: readonly CreateStoryEventParticipantInput[];
  readonly now?: number;
}

export interface CreateStoryEventParticipantInput {
  readonly participantId: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly role: string;
}

export interface CreateForeshadowingRecordInput {
  readonly foreshadowingId: string;
  readonly projectId: string;
  readonly title: string;
  readonly description: string;
  readonly payoffExpectation?: string;
  readonly seedEventLinkId?: string;
  readonly seedEventId?: string;
  readonly payoffEventLinkId?: string;
  readonly payoffEventId?: string;
  readonly now?: number;
}

export interface UpdatePlotlineNodeRecordInput {
  readonly projectId: string;
  readonly plotlineNodeId: string;
  readonly title?: string;
  readonly description?: string;
  readonly chapterHint?: string;
  readonly kind?: string;
  readonly status?: string;
  readonly targetChapterId?: string;
  readonly position?: number;
  readonly now?: number;
}

interface PlotlineRow {
  readonly id: string;
  readonly project_id: string;
  readonly name: string;
  readonly type: string;
  readonly status: string;
  readonly narrative_role: string;
  readonly importance: string;
  readonly summary: string | null;
  readonly central_question: string | null;
  readonly driver: string | null;
  readonly start_state: string | null;
  readonly mid_escalation: string | null;
  readonly payoff_plan: string | null;
  readonly emotional_promise: string | null;
  readonly related_character_ids_json: string;
  readonly related_world_rule_ids_json: string;
  readonly related_foreshadowing_ids_json: string;
  readonly related_story_event_ids_json: string;
  readonly priority: number;
}

interface StoryEventRow {
  readonly id: string;
  readonly project_id: string;
  readonly title: string;
  readonly event_type: string;
  readonly summary: string;
  readonly status: string;
}

interface StoryEventParticipantRow {
  readonly id: string;
  readonly project_id: string;
  readonly event_id: string;
  readonly entity_type: string;
  readonly entity_id: string;
  readonly role: string;
}

interface ForeshadowingRow {
  readonly id: string;
  readonly project_id: string;
  readonly title: string;
  readonly status: string;
  readonly seed_text: string | null;
  readonly payoff_text: string | null;
}

interface ForeshadowingEventRow {
  readonly id: string;
  readonly project_id: string;
  readonly foreshadowing_id: string;
  readonly event_id: string;
  readonly role: "seed" | "payoff";
  readonly note: string | null;
}

interface PlotlineNodeRow {
  readonly id: string;
  readonly project_id: string;
  readonly plotline_id: string;
  readonly title: string;
  readonly position: number;
  readonly kind: string;
  readonly status: string;
  readonly description: string | null;
  readonly chapter_hint: string | null;
  readonly target_chapter_id: string | null;
}

export class PlotRepository {
  constructor(private readonly projectDatabase: ProjectDatabase) {}

  createPlotline(input: CreatePlotlineRecordInput): PlotlineRecord {
    const now = input.now ?? Date.now();
    this.projectDatabase.client
      .prepare(
        `
        insert into plotlines (
          id, project_id, name, type, status, narrative_role, importance, summary,
          central_question, driver, start_state, mid_escalation, payoff_plan, emotional_promise,
          related_character_ids_json, related_world_rule_ids_json, related_foreshadowing_ids_json,
          related_story_event_ids_json, priority, created_at, updated_at
        )
        values (
          @plotlineId, @projectId, @title, @kind, @status, @narrativeRole, @importance, @summary,
          @centralQuestion, @driver, @startState, @midEscalation, @payoffPlan, @emotionalPromise,
          @relatedCharacterIdsJson, @relatedWorldRuleIdsJson, @relatedForeshadowingIdsJson,
          @relatedStoryEventIdsJson, @priority, @now, @now
        )
      `,
      )
      .run({
        centralQuestion: normalizeNullableText(input.centralQuestion),
        driver: normalizeNullableText(input.driver),
        emotionalPromise: normalizeNullableText(input.emotionalPromise),
        importance: input.importance ?? "major",
        kind: input.kind,
        midEscalation: normalizeNullableText(input.midEscalation),
        narrativeRole: input.narrativeRole ?? "main_drive",
        now,
        payoffPlan: normalizeNullableText(input.payoffPlan),
        plotlineId: input.plotlineId,
        priority: input.priority,
        projectId: input.projectId,
        relatedCharacterIdsJson: stringifyStringArray(input.relatedCharacterIds),
        relatedForeshadowingIdsJson: stringifyStringArray(input.relatedForeshadowingIds),
        relatedStoryEventIdsJson: stringifyStringArray(input.relatedStoryEventIds),
        relatedWorldRuleIdsJson: stringifyStringArray(input.relatedWorldRuleIds),
        startState: normalizeNullableText(input.startState),
        status: input.status ?? "planning",
        summary: normalizeNullableText(input.summary),
        title: input.title,
      });

    const plotline = this.getPlotline(input.projectId, input.plotlineId);
    if (!plotline) {
      throw new Error(`PLOTLINE_NOT_CREATED: ${input.plotlineId}`);
    }

    return plotline;
  }

  listPlotlines(projectId: string): PlotlineRecord[] {
    return this.projectDatabase.client
      .prepare(
        "select * from plotlines where project_id = ? order by priority desc, created_at asc",
      )
      .all(projectId)
      .map((row) =>
        mapPlotlineRow(
          row as PlotlineRow,
          this.listPlotlineNodes(projectId, (row as PlotlineRow).id),
        ),
      );
  }

  updatePlotline(input: UpdatePlotlineRecordInput): PlotlineRecord {
    const now = input.now ?? Date.now();
    const updates = ["updated_at = @now"];
    const params: Record<string, unknown> = {
      now,
      plotlineId: input.plotlineId,
      projectId: input.projectId,
    };

    addTextUpdate(updates, params, "name", "title", input.title);
    addTextUpdate(updates, params, "type", "kind", input.kind);
    addTextUpdate(updates, params, "narrative_role", "narrativeRole", input.narrativeRole);
    addTextUpdate(updates, params, "importance", "importance", input.importance);
    addTextUpdate(updates, params, "status", "status", input.status);
    addNullableTextUpdate(updates, params, "summary", "summary", input.summary);
    addNullableTextUpdate(
      updates,
      params,
      "central_question",
      "centralQuestion",
      input.centralQuestion,
    );
    addNullableTextUpdate(updates, params, "driver", "driver", input.driver);
    addNullableTextUpdate(updates, params, "start_state", "startState", input.startState);
    addNullableTextUpdate(updates, params, "mid_escalation", "midEscalation", input.midEscalation);
    addNullableTextUpdate(updates, params, "payoff_plan", "payoffPlan", input.payoffPlan);
    addNullableTextUpdate(
      updates,
      params,
      "emotional_promise",
      "emotionalPromise",
      input.emotionalPromise,
    );
    addJsonArrayUpdate(
      updates,
      params,
      "related_character_ids_json",
      "relatedCharacterIdsJson",
      input.relatedCharacterIds,
    );
    addJsonArrayUpdate(
      updates,
      params,
      "related_world_rule_ids_json",
      "relatedWorldRuleIdsJson",
      input.relatedWorldRuleIds,
    );
    addJsonArrayUpdate(
      updates,
      params,
      "related_foreshadowing_ids_json",
      "relatedForeshadowingIdsJson",
      input.relatedForeshadowingIds,
    );
    addJsonArrayUpdate(
      updates,
      params,
      "related_story_event_ids_json",
      "relatedStoryEventIdsJson",
      input.relatedStoryEventIds,
    );

    if (input.priority !== undefined) {
      updates.push("priority = @priority");
      params.priority = input.priority;
    }

    this.projectDatabase.client
      .prepare(
        `
        update plotlines
        set ${updates.join(", ")}
        where project_id = @projectId and id = @plotlineId
        `,
      )
      .run(params);

    const plotline = this.getPlotline(input.projectId, input.plotlineId);
    if (!plotline) {
      throw new Error(`PLOTLINE_NOT_FOUND: ${input.plotlineId}`);
    }

    return plotline;
  }

  createPlotlineNode(input: CreatePlotlineNodeRecordInput): PlotlineNodeRecord {
    const now = input.now ?? Date.now();
    const position =
      input.position ??
      (
        this.projectDatabase.client
          .prepare(
            "select coalesce(max(position), 0) + 1 as next_position from plotline_nodes where project_id = ? and plotline_id = ?",
          )
          .get(input.projectId, input.plotlineId) as { next_position: number }
      ).next_position;

    this.projectDatabase.client
      .prepare(
        `
        insert into plotline_nodes (
          id, project_id, plotline_id, title, position, kind, status, description,
          chapter_hint, target_chapter_id, created_at, updated_at
        )
        values (
          @plotlineNodeId, @projectId, @plotlineId, @title, @position, @kind, @status,
          @description, @chapterHint, @targetChapterId, @now, @now
        )
        `,
      )
      .run({
        chapterHint: normalizeNullableText(input.chapterHint),
        description: normalizeNullableText(input.description),
        kind: input.kind,
        now,
        plotlineId: input.plotlineId,
        plotlineNodeId: input.plotlineNodeId,
        position,
        projectId: input.projectId,
        status: input.status ?? "planned",
        targetChapterId: normalizeNullableText(input.targetChapterId),
        title: input.title,
      });

    const row = this.projectDatabase.client
      .prepare("select * from plotline_nodes where project_id = ? and id = ?")
      .get(input.projectId, input.plotlineNodeId) as PlotlineNodeRow | undefined;

    if (!row) {
      throw new Error(`PLOTLINE_NODE_NOT_CREATED: ${input.plotlineNodeId}`);
    }

    return mapPlotlineNodeRow(row);
  }

  createStoryEvent(input: CreateStoryEventRecordInput): StoryEventRecord {
    const now = input.now ?? Date.now();
    const position = (
      this.projectDatabase.client
        .prepare(
          "select coalesce(max(position), 0) + 1 as next_position from story_events where project_id = ?",
        )
        .get(input.projectId) as { next_position: number }
    ).next_position;

    const create = this.projectDatabase.client.transaction(() => {
      this.projectDatabase.client
        .prepare(
          `
          insert into story_events (
            id, project_id, title, event_type, event_time, position, summary,
            chapter_id, scene_id, status, created_at, updated_at
          )
          values (
            @eventId, @projectId, @title, @eventType, @storyTime, @position, @description,
            @chapterId, @sceneId, 'canon', @now, @now
          )
        `,
        )
        .run({
          chapterId: input.chapterId ?? null,
          description: input.description,
          eventId: input.eventId,
          eventType: input.eventType,
          now,
          position,
          projectId: input.projectId,
          sceneId: input.sceneId ?? null,
          storyTime: input.storyTime ?? null,
          title: input.title,
        });

      for (const participant of input.participants) {
        this.projectDatabase.client
          .prepare(
            `
            insert into event_participants (
              id, project_id, event_id, entity_type, entity_id, role, created_at
            )
            values (
              @participantId, @projectId, @eventId, @entityType, @entityId, @role, @now
            )
          `,
          )
          .run({
            entityId: participant.entityId,
            entityType: participant.entityType,
            eventId: input.eventId,
            now,
            participantId: participant.participantId,
            projectId: input.projectId,
            role: participant.role,
          });
      }
    });

    create();

    const event = this.getStoryEvent(input.projectId, input.eventId);
    if (!event) {
      throw new Error(`STORY_EVENT_NOT_CREATED: ${input.eventId}`);
    }

    return event;
  }

  listStoryEvents(projectId: string): StoryEventRecord[] {
    const rows = this.projectDatabase.client
      .prepare(
        "select * from story_events where project_id = ? order by position asc, created_at asc",
      )
      .all(projectId) as StoryEventRow[];

    return rows.map((row) => this.getStoryEvent(projectId, row.id)).filter(isDefined);
  }

  createForeshadowing(input: CreateForeshadowingRecordInput): ForeshadowingRecord {
    const now = input.now ?? Date.now();
    const create = this.projectDatabase.client.transaction(() => {
      this.projectDatabase.client
        .prepare(
          `
          insert into foreshadowings (
            id, project_id, title, status, seed_text, payoff_text, created_at, updated_at
          )
          values (
            @foreshadowingId, @projectId, @title, 'seeded', @description, @payoffExpectation, @now, @now
          )
        `,
        )
        .run({
          description: input.description,
          foreshadowingId: input.foreshadowingId,
          now,
          payoffExpectation: input.payoffExpectation ?? null,
          projectId: input.projectId,
          title: input.title,
        });

      if (input.seedEventId && input.seedEventLinkId) {
        this.insertForeshadowingEvent({
          eventId: input.seedEventId,
          linkId: input.seedEventLinkId,
          foreshadowingId: input.foreshadowingId,
          now,
          projectId: input.projectId,
          role: "seed",
        });
      }

      if (input.payoffEventId && input.payoffEventLinkId) {
        this.insertForeshadowingEvent({
          eventId: input.payoffEventId,
          linkId: input.payoffEventLinkId,
          foreshadowingId: input.foreshadowingId,
          now,
          projectId: input.projectId,
          role: "payoff",
        });
      }
    });

    create();

    const foreshadowing = this.getForeshadowing(input.projectId, input.foreshadowingId);
    if (!foreshadowing) {
      throw new Error(`FORESHADOWING_NOT_CREATED: ${input.foreshadowingId}`);
    }

    return foreshadowing;
  }

  listForeshadowings(projectId: string): ForeshadowingRecord[] {
    const rows = this.projectDatabase.client
      .prepare("select * from foreshadowings where project_id = ? order by created_at asc")
      .all(projectId) as ForeshadowingRow[];

    return rows.map((row) => this.getForeshadowing(projectId, row.id)).filter(isDefined);
  }

  updatePlotlineNode(input: UpdatePlotlineNodeRecordInput): PlotlineNodeRecord {
    const now = input.now ?? Date.now();
    this.projectDatabase.client
      .prepare(
        `
        update plotline_nodes
        set title = coalesce(@title, title),
            description = coalesce(@description, description),
            kind = coalesce(@kind, kind),
            status = coalesce(@status, status),
            chapter_hint = coalesce(@chapterHint, chapter_hint),
            target_chapter_id = coalesce(@targetChapterId, target_chapter_id),
            position = coalesce(@position, position),
            updated_at = @now
        where project_id = @projectId and id = @plotlineNodeId
        `,
      )
      .run({
        description: input.description ?? null,
        chapterHint: input.chapterHint ?? null,
        kind: input.kind ?? null,
        now,
        plotlineNodeId: input.plotlineNodeId,
        position: input.position ?? null,
        projectId: input.projectId,
        status: input.status ?? null,
        targetChapterId: input.targetChapterId ?? null,
        title: input.title ?? null,
      });

    const row = this.projectDatabase.client
      .prepare("select * from plotline_nodes where project_id = ? and id = ?")
      .get(input.projectId, input.plotlineNodeId) as PlotlineNodeRow | undefined;

    if (!row) {
      throw new Error(`PLOTLINE_NODE_NOT_FOUND: ${input.plotlineNodeId}`);
    }

    return mapPlotlineNodeRow(row);
  }

  private insertForeshadowingEvent(input: {
    readonly linkId: string;
    readonly projectId: string;
    readonly foreshadowingId: string;
    readonly eventId: string;
    readonly role: "seed" | "payoff";
    readonly now: number;
  }): void {
    this.projectDatabase.client
      .prepare(
        `
        insert into foreshadowing_events (
          id, project_id, foreshadowing_id, event_id, role, created_at
        )
        values (
          @linkId, @projectId, @foreshadowingId, @eventId, @role, @now
        )
      `,
      )
      .run(input);
  }

  private getStoryEvent(projectId: string, eventId: string): StoryEventRecord | undefined {
    const row = this.projectDatabase.client
      .prepare("select * from story_events where project_id = ? and id = ?")
      .get(projectId, eventId) as StoryEventRow | undefined;

    if (!row) {
      return undefined;
    }

    const participants = this.projectDatabase.client
      .prepare(
        "select * from event_participants where project_id = ? and event_id = ? order by created_at asc",
      )
      .all(projectId, eventId)
      .map((participant) => mapParticipantRow(participant as StoryEventParticipantRow));

    return {
      eventType: row.event_type,
      id: row.id,
      participants,
      projectId: row.project_id,
      status: row.status,
      summary: row.summary,
      title: row.title,
    };
  }

  private getForeshadowing(
    projectId: string,
    foreshadowingId: string,
  ): ForeshadowingRecord | undefined {
    const row = this.projectDatabase.client
      .prepare("select * from foreshadowings where project_id = ? and id = ?")
      .get(projectId, foreshadowingId) as ForeshadowingRow | undefined;

    if (!row) {
      return undefined;
    }

    const links = this.projectDatabase.client
      .prepare(
        "select * from foreshadowing_events where project_id = ? and foreshadowing_id = ? order by created_at asc",
      )
      .all(projectId, foreshadowingId)
      .map((link) => mapForeshadowingEventRow(link as ForeshadowingEventRow));

    return {
      id: row.id,
      links,
      payoffText: row.payoff_text,
      projectId: row.project_id,
      seedText: row.seed_text,
      status: row.status,
      title: row.title,
    };
  }

  private getPlotline(projectId: string, plotlineId: string): PlotlineRecord | undefined {
    const row = this.projectDatabase.client
      .prepare("select * from plotlines where project_id = ? and id = ?")
      .get(projectId, plotlineId) as PlotlineRow | undefined;

    return row ? mapPlotlineRow(row, this.listPlotlineNodes(projectId, plotlineId)) : undefined;
  }

  private listPlotlineNodes(projectId: string, plotlineId: string): PlotlineNodeRecord[] {
    return this.projectDatabase.client
      .prepare(
        "select * from plotline_nodes where project_id = ? and plotline_id = ? order by position asc, created_at asc",
      )
      .all(projectId, plotlineId)
      .map((row) => mapPlotlineNodeRow(row as PlotlineNodeRow));
  }
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function mapPlotlineRow(row: PlotlineRow, nodes: PlotlineNodeRecord[]): PlotlineRecord {
  return {
    centralQuestion: row.central_question,
    driver: row.driver,
    emotionalPromise: row.emotional_promise,
    id: row.id,
    importance: row.importance,
    midEscalation: row.mid_escalation,
    name: row.name,
    narrativeRole: row.narrative_role,
    nodes,
    payoffPlan: row.payoff_plan,
    priority: row.priority,
    projectId: row.project_id,
    relatedCharacterIds: parseStringArray(row.related_character_ids_json),
    relatedForeshadowingIds: parseStringArray(row.related_foreshadowing_ids_json),
    relatedStoryEventIds: parseStringArray(row.related_story_event_ids_json),
    relatedWorldRuleIds: parseStringArray(row.related_world_rule_ids_json),
    startState: row.start_state,
    status: row.status,
    summary: row.summary,
    type: row.type,
  };
}

function mapParticipantRow(row: StoryEventParticipantRow): StoryEventParticipantRecord {
  return {
    entityId: row.entity_id,
    entityType: row.entity_type,
    eventId: row.event_id,
    id: row.id,
    projectId: row.project_id,
    role: row.role,
  };
}

function mapPlotlineNodeRow(row: PlotlineNodeRow): PlotlineNodeRecord {
  return {
    chapterHint: row.chapter_hint,
    description: row.description,
    id: row.id,
    kind: row.kind,
    plotlineId: row.plotline_id,
    position: row.position,
    projectId: row.project_id,
    status: row.status,
    targetChapterId: row.target_chapter_id,
    title: row.title,
  };
}

function addTextUpdate(
  updates: string[],
  params: Record<string, unknown>,
  column: string,
  paramName: string,
  value: string | undefined,
): void {
  if (value === undefined) {
    return;
  }
  updates.push(`${column} = @${paramName}`);
  params[paramName] = value.trim();
}

function addNullableTextUpdate(
  updates: string[],
  params: Record<string, unknown>,
  column: string,
  paramName: string,
  value: string | undefined,
): void {
  if (value === undefined) {
    return;
  }
  updates.push(`${column} = @${paramName}`);
  params[paramName] = normalizeNullableText(value);
}

function addJsonArrayUpdate(
  updates: string[],
  params: Record<string, unknown>,
  column: string,
  paramName: string,
  value: readonly string[] | undefined,
): void {
  if (value === undefined) {
    return;
  }
  updates.push(`${column} = @${paramName}`);
  params[paramName] = stringifyStringArray(value);
}

function normalizeNullableText(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function stringifyStringArray(value: readonly string[] | undefined): string {
  return JSON.stringify(
    Array.from(new Set((value ?? []).map((item) => item.trim()).filter(Boolean))),
  );
}

function parseStringArray(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function mapForeshadowingEventRow(row: ForeshadowingEventRow): ForeshadowingEventLinkRecord {
  return {
    eventId: row.event_id,
    foreshadowingId: row.foreshadowing_id,
    id: row.id,
    note: row.note,
    projectId: row.project_id,
    role: row.role,
  };
}
