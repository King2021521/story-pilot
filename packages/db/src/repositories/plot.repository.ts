import type { ProjectDatabase } from "../project-database.js";

export interface PlotlineRecord {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly type: string;
  readonly status: string;
  readonly summary: string | null;
  readonly priority: number;
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
  readonly targetChapterId: string | null;
}

export interface CreatePlotlineRecordInput {
  readonly plotlineId: string;
  readonly projectId: string;
  readonly title: string;
  readonly kind: string;
  readonly summary?: string;
  readonly priority: number;
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
  readonly summary: string | null;
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
  readonly target_chapter_id: string | null;
}

export class PlotRepository {
  constructor(private readonly projectDatabase: ProjectDatabase) {}

  createPlotline(input: CreatePlotlineRecordInput): PlotlineRecord {
    const now = input.now ?? Date.now();
    this.projectDatabase.client
      .prepare(`
        insert into plotlines (
          id, project_id, name, type, status, summary, priority, created_at, updated_at
        )
        values (
          @plotlineId, @projectId, @title, @kind, 'planning', @summary, @priority, @now, @now
        )
      `)
      .run({
        kind: input.kind,
        now,
        plotlineId: input.plotlineId,
        priority: input.priority,
        projectId: input.projectId,
        summary: input.summary ?? null,
        title: input.title,
      });

    const row = this.projectDatabase.client
      .prepare("select * from plotlines where project_id = ? and id = ?")
      .get(input.projectId, input.plotlineId) as PlotlineRow | undefined;

    if (!row) {
      throw new Error(`PLOTLINE_NOT_CREATED: ${input.plotlineId}`);
    }

    return mapPlotlineRow(row);
  }

  listPlotlines(projectId: string): PlotlineRecord[] {
    return this.projectDatabase.client
      .prepare("select * from plotlines where project_id = ? order by priority desc, created_at asc")
      .all(projectId)
      .map((row) => mapPlotlineRow(row as PlotlineRow));
  }

  createStoryEvent(input: CreateStoryEventRecordInput): StoryEventRecord {
    const now = input.now ?? Date.now();
    const position = (this.projectDatabase.client
      .prepare("select coalesce(max(position), 0) + 1 as next_position from story_events where project_id = ?")
      .get(input.projectId) as { next_position: number }).next_position;

    const create = this.projectDatabase.client.transaction(() => {
      this.projectDatabase.client
        .prepare(`
          insert into story_events (
            id, project_id, title, event_type, event_time, position, summary,
            chapter_id, scene_id, status, created_at, updated_at
          )
          values (
            @eventId, @projectId, @title, @eventType, @storyTime, @position, @description,
            @chapterId, @sceneId, 'canon', @now, @now
          )
        `)
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
          .prepare(`
            insert into event_participants (
              id, project_id, event_id, entity_type, entity_id, role, created_at
            )
            values (
              @participantId, @projectId, @eventId, @entityType, @entityId, @role, @now
            )
          `)
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
      .prepare("select * from story_events where project_id = ? order by position asc, created_at asc")
      .all(projectId) as StoryEventRow[];

    return rows.map((row) => this.getStoryEvent(projectId, row.id)).filter(isDefined);
  }

  createForeshadowing(input: CreateForeshadowingRecordInput): ForeshadowingRecord {
    const now = input.now ?? Date.now();
    const create = this.projectDatabase.client.transaction(() => {
      this.projectDatabase.client
        .prepare(`
          insert into foreshadowings (
            id, project_id, title, status, seed_text, payoff_text, created_at, updated_at
          )
          values (
            @foreshadowingId, @projectId, @title, 'seeded', @description, @payoffExpectation, @now, @now
          )
        `)
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
            target_chapter_id = coalesce(@targetChapterId, target_chapter_id),
            position = coalesce(@position, position),
            updated_at = @now
        where project_id = @projectId and id = @plotlineNodeId
        `,
      )
      .run({
        description: input.description ?? null,
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
      .prepare(`
        insert into foreshadowing_events (
          id, project_id, foreshadowing_id, event_id, role, created_at
        )
        values (
          @linkId, @projectId, @foreshadowingId, @eventId, @role, @now
        )
      `)
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
      .prepare("select * from event_participants where project_id = ? and event_id = ? order by created_at asc")
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

  private getForeshadowing(projectId: string, foreshadowingId: string): ForeshadowingRecord | undefined {
    const row = this.projectDatabase.client
      .prepare("select * from foreshadowings where project_id = ? and id = ?")
      .get(projectId, foreshadowingId) as ForeshadowingRow | undefined;

    if (!row) {
      return undefined;
    }

    const links = this.projectDatabase.client
      .prepare("select * from foreshadowing_events where project_id = ? and foreshadowing_id = ? order by created_at asc")
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
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function mapPlotlineRow(row: PlotlineRow): PlotlineRecord {
  return {
    id: row.id,
    name: row.name,
    priority: row.priority,
    projectId: row.project_id,
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
