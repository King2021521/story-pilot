import type { ProjectDatabase } from "../project-database.js";

export interface AppendDomainEventInput {
  readonly eventId: string;
  readonly projectId: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly payload?: unknown;
  readonly now?: number;
}

export class DomainEventRepository {
  constructor(private readonly projectDatabase: ProjectDatabase) {}

  append(input: AppendDomainEventInput): void {
    this.projectDatabase.client
      .prepare(`
        insert into domain_events (
          id, project_id, aggregate_type, aggregate_id, event_type, payload, created_at
        )
        values (
          @eventId, @projectId, @aggregateType, @aggregateId, @eventType, @payload, @now
        )
      `)
      .run({
        aggregateId: input.aggregateId,
        aggregateType: input.aggregateType,
        eventId: input.eventId,
        eventType: input.eventType,
        now: input.now ?? Date.now(),
        payload: JSON.stringify(input.payload ?? {}),
        projectId: input.projectId,
      });
  }
}
