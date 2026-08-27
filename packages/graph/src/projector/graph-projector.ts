import type { GraphStore } from "../graph-store.js";
import { executeGraphQuery } from "../graph-store.js";

export interface DomainGraphEvent {
  readonly id: string;
  readonly projectId: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
}

export class GraphProjector {
  constructor(private readonly store: GraphStore) {}

  async project(event: DomainGraphEvent): Promise<void> {
    switch (event.eventType) {
      case "character.created":
        await this.upsertEntity({
          entityType: "character",
          id: event.aggregateId,
          label: getString(event.payload.name) ?? event.aggregateId,
          metadata: event.payload,
          projectId: event.projectId,
        });
        return;
      case "entity_relation.confirmed":
        await this.projectEntityRelation(event);
        return;
      case "story_event.created":
        await this.projectStoryEvent(event);
        return;
      case "foreshadowing.seeded":
        await this.projectForeshadowing(event);
        return;
      default:
        return;
    }
  }

  private async upsertEntity(input: {
    readonly id: string;
    readonly projectId: string;
    readonly entityType: string;
    readonly label: string;
    readonly metadata: unknown;
  }): Promise<void> {
    await executeGraphQuery(
      this.store,
      `
      MERGE (entity:Entity {id: $id})
      SET entity.projectId = $projectId,
          entity.entityType = $entityType,
          entity.name = $label,
          entity.metadata = $metadata
      `,
      {
        entityType: input.entityType,
        id: input.id,
        label: input.label,
        metadata: JSON.stringify(input.metadata),
        projectId: input.projectId,
      },
    );
  }

  private async projectEntityRelation(event: DomainGraphEvent): Promise<void> {
    const sourceEntityId = requireString(event.payload.sourceEntityId, "sourceEntityId");
    const targetEntityId = requireString(event.payload.targetEntityId, "targetEntityId");
    const relationType = requireString(event.payload.relationType, "relationType");
    const sourceEntityType = getString(event.payload.sourceEntityType) ?? "entity";
    const targetEntityType = getString(event.payload.targetEntityType) ?? "entity";

    await this.ensureEntity({
      entityType: sourceEntityType,
      id: sourceEntityId,
      label: sourceEntityId,
      metadata: { inferredFrom: event.id },
      projectId: event.projectId,
    });
    await this.ensureEntity({
      entityType: targetEntityType,
      id: targetEntityId,
      label: targetEntityId,
      metadata: { inferredFrom: event.id },
      projectId: event.projectId,
    });
    await executeGraphQuery(
      this.store,
      `
      MATCH (source:Entity), (target:Entity)
      WHERE source.id = $sourceEntityId AND target.id = $targetEntityId
      MERGE (source)-[relation:RELATES {relationId: $relationId}]->(target)
      SET relation.relationType = $relationType,
          relation.description = $description,
          relation.polarity = $polarity,
          relation.strength = $strength
      `,
      {
        description: getString(event.payload.description) ?? "",
        polarity: getNumber(event.payload.polarity) ?? 0,
        relationId: event.aggregateId,
        relationType,
        sourceEntityId,
        strength: getNumber(event.payload.strength) ?? 0.5,
        targetEntityId,
      },
    );
  }

  private async ensureEntity(input: {
    readonly id: string;
    readonly projectId: string;
    readonly entityType: string;
    readonly label: string;
    readonly metadata: unknown;
  }): Promise<void> {
    const rows = await executeGraphQuery(
      this.store,
      `
      MATCH (entity:Entity)
      WHERE entity.id = $id AND entity.projectId = $projectId
      RETURN entity.id AS id
      `,
      {
        id: input.id,
        projectId: input.projectId,
      },
    );

    if (rows.length === 0) {
      await this.upsertEntity(input);
    }
  }

  private async projectStoryEvent(event: DomainGraphEvent): Promise<void> {
    await executeGraphQuery(
      this.store,
      `
      MERGE (storyEvent:StoryEvent {id: $id})
      SET storyEvent.projectId = $projectId,
          storyEvent.title = $title,
          storyEvent.eventType = $eventType,
          storyEvent.summary = $summary,
          storyEvent.metadata = $metadata
      `,
      {
        eventType: getString(event.payload.eventType) ?? "custom",
        id: event.aggregateId,
        metadata: JSON.stringify(event.payload),
        projectId: event.projectId,
        summary: getString(event.payload.summary) ?? "",
        title: getString(event.payload.title) ?? event.aggregateId,
      },
    );

    const participants = Array.isArray(event.payload.participants) ? event.payload.participants : [];
    for (const participant of participants) {
      if (!isRecord(participant)) {
        continue;
      }
      const entityId = getString(participant.entityId);
      if (!entityId) {
        continue;
      }
      await this.upsertEntity({
        entityType: getString(participant.entityType) ?? "entity",
        id: entityId,
        label: entityId,
        metadata: { inferredFrom: event.id },
        projectId: event.projectId,
      });
      await executeGraphQuery(
        this.store,
        `
        MATCH (entity:Entity), (storyEvent:StoryEvent)
        WHERE entity.id = $entityId AND storyEvent.id = $eventId
        MERGE (entity)-[participation:PARTICIPATES_IN]->(storyEvent)
        SET participation.role = $role
        `,
        {
          entityId,
          eventId: event.aggregateId,
          role: getString(participant.role) ?? "participant",
        },
      );
    }
  }

  private async projectForeshadowing(event: DomainGraphEvent): Promise<void> {
    await executeGraphQuery(
      this.store,
      `
      MERGE (foreshadowing:Foreshadowing {id: $id})
      SET foreshadowing.projectId = $projectId,
          foreshadowing.title = $title,
          foreshadowing.status = $status,
          foreshadowing.metadata = $metadata
      `,
      {
        id: event.aggregateId,
        metadata: JSON.stringify(event.payload),
        projectId: event.projectId,
        status: getString(event.payload.status) ?? "seeded",
        title: getString(event.payload.title) ?? event.aggregateId,
      },
    );

    const links = Array.isArray(event.payload.links) ? event.payload.links : [];
    for (const link of links) {
      if (!isRecord(link)) {
        continue;
      }
      const eventId = getString(link.eventId);
      const role = getString(link.role);
      if (!eventId || !role) {
        continue;
      }

      const relationLabel = role === "payoff" ? "PAYS_OFF" : "SEEDS";
      await executeGraphQuery(
        this.store,
        `
        MATCH (foreshadowing:Foreshadowing), (storyEvent:StoryEvent)
        WHERE foreshadowing.id = $foreshadowingId AND storyEvent.id = $eventId
        MERGE (foreshadowing)-[relation:${relationLabel}]->(storyEvent)
        SET relation.note = $note
        `,
        {
          eventId,
          foreshadowingId: event.aggregateId,
          note: getString(link.note) ?? "",
        },
      );
    }
  }
}

function requireString(value: unknown, field: string): string {
  const stringValue = getString(value);
  if (!stringValue) {
    throw new Error(`INVALID_GRAPH_EVENT_PAYLOAD: ${field}`);
  }

  return stringValue;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
