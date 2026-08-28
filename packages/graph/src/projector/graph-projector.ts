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

const semanticNodeTableByEntityType: Readonly<Record<string, string>> = {
  artifact: "Artifact",
  chapter: "Chapter",
  character: "Character",
  item: "Item",
  location: "Location",
  memory_candidate: "MemoryCandidate",
  organization: "Organization",
  plot_node: "PlotNode",
  plotline: "Plotline",
  project: "Project",
  scene: "Scene",
  volume: "Volume",
  work: "Work",
  work_order: "WorkOrder",
  world_rule: "WorldRule",
};

export class GraphProjector {
  constructor(private readonly store: GraphStore) {}

  async project(event: DomainGraphEvent): Promise<void> {
    switch (event.eventType) {
      case "project.created":
        await this.projectGenericEntity(event, "project", getString(event.payload.title));
        return;
      case "work.created":
        await this.projectGenericEntity(event, "work", getString(event.payload.title));
        return;
      case "volume.created":
        await this.projectGenericEntity(event, "volume", getString(event.payload.title));
        return;
      case "chapter.created":
        await this.projectGenericEntity(event, "chapter", getString(event.payload.title));
        return;
      case "character.created":
      case "character.updated":
        await this.projectGenericEntity(event, "character", getString(event.payload.name));
        return;
      case "world_rule.created":
      case "world_rule.updated":
        await this.projectWorldRule(event);
        return;
      case "artifact.created":
      case "artifact.applied":
        await this.projectGenericEntity(event, "artifact", getString(event.payload.title));
        return;
      case "memory_candidate.created":
        await this.projectMemoryCandidate(event);
        return;
      case "entity_relation.confirmed":
        await this.projectEntityRelation(event);
        return;
      case "story_event.created":
        await this.projectStoryEvent(event);
        return;
      case "event_relation.confirmed":
        await this.projectEventRelation(event);
        return;
      case "foreshadowing.seeded":
      case "foreshadowing.updated":
        await this.projectForeshadowing(event);
        return;
      case "memory.confirmed":
      case "memory.merged":
        await this.projectMemory(event);
        return;
      default:
        return;
    }
  }

  private async projectGenericEntity(
    event: DomainGraphEvent,
    entityType: string,
    label?: string,
  ): Promise<void> {
    await this.upsertEntity({
      entityType,
      id: event.aggregateId,
      label: label ?? event.aggregateId,
      metadata: event.payload,
      projectId: event.projectId,
      sourceEventId: event.id,
      sourceId: event.aggregateId,
      sourceTable: event.aggregateType,
    });
  }

  private async upsertEntity(input: {
    readonly id: string;
    readonly projectId: string;
    readonly entityType: string;
    readonly label: string;
    readonly metadata: unknown;
    readonly sourceTable?: string;
    readonly sourceId?: string;
    readonly sourceEventId?: string;
  }): Promise<void> {
    const metadata = JSON.stringify(input.metadata);
    const sourceTable = input.sourceTable ?? input.entityType;
    const sourceId = input.sourceId ?? input.id;
    const sourceEventId = input.sourceEventId ?? "";

    await executeGraphQuery(
      this.store,
      `
      MERGE (entity:Entity {id: $id})
      SET entity.projectId = $projectId,
          entity.entityType = $entityType,
          entity.name = $label,
          entity.metadata = $metadata,
          entity.sourceTable = $sourceTable,
          entity.sourceId = $sourceId,
          entity.sourceEventId = $sourceEventId
      `,
      {
        entityType: input.entityType,
        id: input.id,
        label: input.label,
        metadata,
        projectId: input.projectId,
        sourceEventId,
        sourceId,
        sourceTable,
      },
    );

    const tableName = semanticNodeTableByEntityType[input.entityType];
    if (!tableName) {
      return;
    }

    await executeGraphQuery(
      this.store,
      `
      MERGE (node:${tableName} {id: $id})
      SET node.projectId = $projectId,
          node.label = $label,
          node.metadata = $metadata,
          node.sourceTable = $sourceTable,
          node.sourceId = $sourceId,
          node.sourceEventId = $sourceEventId
      `,
      {
        id: input.id,
        label: input.label,
        metadata,
        projectId: input.projectId,
        sourceEventId,
        sourceId,
        sourceTable,
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
      sourceEventId: event.id,
      sourceId: sourceEntityId,
      sourceTable: sourceEntityType,
    });
    await this.ensureEntity({
      entityType: targetEntityType,
      id: targetEntityId,
      label: targetEntityId,
      metadata: { inferredFrom: event.id },
      projectId: event.projectId,
      sourceEventId: event.id,
      sourceId: targetEntityId,
      sourceTable: targetEntityType,
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
          relation.strength = $strength,
          relation.sourceTable = $sourceTable,
          relation.sourceId = $sourceId,
          relation.sourceEventId = $sourceEventId
      `,
      {
        description: getString(event.payload.description) ?? "",
        polarity: getNumber(event.payload.polarity) ?? 0,
        relationId: event.aggregateId,
        relationType,
        sourceEntityId,
        sourceEventId: event.id,
        sourceId: event.aggregateId,
        sourceTable: event.aggregateType,
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
    readonly sourceTable?: string;
    readonly sourceId?: string;
    readonly sourceEventId?: string;
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
          storyEvent.metadata = $metadata,
          storyEvent.sourceTable = $sourceTable,
          storyEvent.sourceId = $sourceId,
          storyEvent.sourceEventId = $sourceEventId
      `,
      {
        eventType: getString(event.payload.eventType) ?? "custom",
        id: event.aggregateId,
        metadata: JSON.stringify(event.payload),
        projectId: event.projectId,
        sourceEventId: event.id,
        sourceId: event.aggregateId,
        sourceTable: event.aggregateType,
        summary: getString(event.payload.summary) ?? "",
        title: getString(event.payload.title) ?? event.aggregateId,
      },
    );

    await this.projectStoryEventEntityLinks(event);
    await this.projectStoryEventParticipants(event);
  }

  private async projectStoryEventEntityLinks(event: DomainGraphEvent): Promise<void> {
    const chapterId = getString(event.payload.chapterId);
    if (chapterId) {
      await this.ensureEntity({
        entityType: "chapter",
        id: chapterId,
        label: getString(event.payload.chapterTitle) ?? chapterId,
        metadata: { inferredFrom: event.id },
        projectId: event.projectId,
        sourceEventId: event.id,
        sourceId: chapterId,
        sourceTable: "chapter",
      });
      await this.createStoryEventOccurrence({
        event,
        scope: "chapter",
        targetEntityId: chapterId,
      });
    }

    const locationId = getString(event.payload.locationId);
    if (locationId) {
      await this.ensureEntity({
        entityType: "location",
        id: locationId,
        label: getString(event.payload.locationName) ?? locationId,
        metadata: { inferredFrom: event.id },
        projectId: event.projectId,
        sourceEventId: event.id,
        sourceId: locationId,
        sourceTable: "location",
      });
      await this.createStoryEventOccurrence({
        event,
        scope: "location",
        targetEntityId: locationId,
      });
    }
  }

  private async createStoryEventOccurrence(input: {
    readonly event: DomainGraphEvent;
    readonly scope: string;
    readonly targetEntityId: string;
  }): Promise<void> {
    await executeGraphQuery(
      this.store,
      `
      MATCH (storyEvent:StoryEvent), (target:Entity)
      WHERE storyEvent.id = $eventId AND target.id = $targetEntityId
      MERGE (storyEvent)-[relation:OCCURS_IN]->(target)
      SET relation.scope = $scope,
          relation.sourceTable = $sourceTable,
          relation.sourceId = $sourceId,
          relation.sourceEventId = $sourceEventId
      `,
      {
        eventId: input.event.aggregateId,
        scope: input.scope,
        sourceEventId: input.event.id,
        sourceId: input.event.aggregateId,
        sourceTable: input.event.aggregateType,
        targetEntityId: input.targetEntityId,
      },
    );
  }

  private async projectStoryEventParticipants(event: DomainGraphEvent): Promise<void> {
    const participants = Array.isArray(event.payload.participants)
      ? event.payload.participants
      : [];
    for (const participant of participants) {
      if (!isRecord(participant)) {
        continue;
      }
      const entityId = getString(participant.entityId);
      if (!entityId) {
        continue;
      }
      await this.ensureEntity({
        entityType: getString(participant.entityType) ?? "entity",
        id: entityId,
        label: entityId,
        metadata: { inferredFrom: event.id },
        projectId: event.projectId,
        sourceEventId: event.id,
        sourceId: entityId,
        sourceTable: getString(participant.entityType) ?? "entity",
      });
      await executeGraphQuery(
        this.store,
        `
        MATCH (entity:Entity), (storyEvent:StoryEvent)
        WHERE entity.id = $entityId AND storyEvent.id = $eventId
        MERGE (entity)-[participation:PARTICIPATES_IN]->(storyEvent)
        SET participation.role = $role,
            participation.sourceTable = $sourceTable,
            participation.sourceId = $sourceId,
            participation.sourceEventId = $sourceEventId
        `,
        {
          entityId,
          eventId: event.aggregateId,
          role: getString(participant.role) ?? "participant",
          sourceEventId: event.id,
          sourceId: event.aggregateId,
          sourceTable: event.aggregateType,
        },
      );
    }
  }

  private async projectEventRelation(event: DomainGraphEvent): Promise<void> {
    const sourceEventId = requireString(event.payload.sourceEventId, "sourceEventId");
    const targetEventId = requireString(event.payload.targetEventId, "targetEventId");
    const relationType = requireString(event.payload.relationType, "relationType");
    const relationshipTable = resolveEventRelationshipTable(relationType);

    await executeGraphQuery(
      this.store,
      `
      MATCH (source:StoryEvent), (target:StoryEvent)
      WHERE source.id = $sourceEventId AND target.id = $targetEventId
      MERGE (source)-[relation:${relationshipTable} {relationId: $relationId}]->(target)
      SET relation.relationType = $relationType,
          relation.description = $description,
          relation.sourceTable = $sourceTable,
          relation.sourceId = $sourceId,
          relation.sourceEventId = $sourceEventIdForProjection
      `,
      {
        description: getString(event.payload.description) ?? "",
        relationId: event.aggregateId,
        relationType,
        sourceEventId,
        sourceEventIdForProjection: event.id,
        sourceId: event.aggregateId,
        sourceTable: event.aggregateType,
        targetEventId,
      },
    );
  }

  private async projectForeshadowing(event: DomainGraphEvent): Promise<void> {
    await executeGraphQuery(
      this.store,
      `
      MERGE (foreshadowing:Foreshadowing {id: $id})
      SET foreshadowing.projectId = $projectId,
          foreshadowing.title = $title,
          foreshadowing.status = $status,
          foreshadowing.metadata = $metadata,
          foreshadowing.sourceTable = $sourceTable,
          foreshadowing.sourceId = $sourceId,
          foreshadowing.sourceEventId = $sourceEventId
      `,
      {
        id: event.aggregateId,
        metadata: JSON.stringify(event.payload),
        projectId: event.projectId,
        sourceEventId: event.id,
        sourceId: event.aggregateId,
        sourceTable: event.aggregateType,
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

      const relationLabel = resolveForeshadowingRelationshipTable(role);
      await executeGraphQuery(
        this.store,
        `
        MATCH (foreshadowing:Foreshadowing), (storyEvent:StoryEvent)
        WHERE foreshadowing.id = $foreshadowingId AND storyEvent.id = $eventId
        MERGE (foreshadowing)-[relation:${relationLabel}]->(storyEvent)
        SET relation.note = $note,
            relation.sourceTable = $sourceTable,
            relation.sourceId = $sourceId,
            relation.sourceEventId = $sourceEventId
        `,
        {
          eventId,
          foreshadowingId: event.aggregateId,
          note: getString(link.note) ?? "",
          sourceEventId: event.id,
          sourceId: event.aggregateId,
          sourceTable: event.aggregateType,
        },
      );
    }
  }

  private async projectWorldRule(event: DomainGraphEvent): Promise<void> {
    await this.upsertEntity({
      entityType: "world_rule",
      id: event.aggregateId,
      label: getString(event.payload.title) ?? event.aggregateId,
      metadata: event.payload,
      projectId: event.projectId,
      sourceEventId: event.id,
      sourceId: event.aggregateId,
      sourceTable: event.aggregateType,
    });

    for (const chapterId of getStringArray(event.payload.impactChapterIds)) {
      await this.ensureEntity({
        entityType: "chapter",
        id: chapterId,
        label: chapterId,
        metadata: { inferredFrom: event.id },
        projectId: event.projectId,
        sourceEventId: event.id,
        sourceId: chapterId,
        sourceTable: "chapter",
      });
      await this.createConstraintRelation(event, chapterId, "Entity");
    }

    for (const eventId of getStringArray(event.payload.impactEventIds)) {
      await this.createConstraintRelation(event, eventId, "StoryEvent");
    }
  }

  private async createConstraintRelation(
    event: DomainGraphEvent,
    targetId: string,
    targetTable: "Entity" | "StoryEvent",
  ): Promise<void> {
    await executeGraphQuery(
      this.store,
      `
      MATCH (rule:Entity), (target:${targetTable})
      WHERE rule.id = $ruleId AND target.id = $targetId
      MERGE (rule)-[relation:CONSTRAINS {relationId: $relationId}]->(target)
      SET relation.description = $description,
          relation.sourceTable = $sourceTable,
          relation.sourceId = $sourceId,
          relation.sourceEventId = $sourceEventId
      `,
      {
        description: getString(event.payload.statement) ?? getString(event.payload.title) ?? "",
        relationId: `${event.aggregateId}:${targetId}`,
        ruleId: event.aggregateId,
        sourceEventId: event.id,
        sourceId: event.aggregateId,
        sourceTable: event.aggregateType,
        targetId,
      },
    );
  }

  private async projectMemoryCandidate(event: DomainGraphEvent): Promise<void> {
    await this.upsertEntity({
      entityType: "memory_candidate",
      id: event.aggregateId,
      label: getString(event.payload.content) ?? event.aggregateId,
      metadata: event.payload,
      projectId: event.projectId,
      sourceEventId: event.id,
      sourceId: event.aggregateId,
      sourceTable: event.aggregateType,
    });

    const artifactId =
      getString(event.payload.artifactId) ?? getString(event.payload.sourceArtifactId);
    if (!artifactId) {
      return;
    }

    await this.ensureEntity({
      entityType: "artifact",
      id: artifactId,
      label: artifactId,
      metadata: { inferredFrom: event.id },
      projectId: event.projectId,
      sourceEventId: event.id,
      sourceId: artifactId,
      sourceTable: "artifact",
    });
    await executeGraphQuery(
      this.store,
      `
      MATCH (artifact:Entity), (candidate:Entity)
      WHERE artifact.id = $artifactId AND candidate.id = $candidateId
      MERGE (artifact)-[relation:GENERATED]->(candidate)
      SET relation.sourceTable = $sourceTable,
          relation.sourceId = $sourceId,
          relation.sourceEventId = $sourceEventId
      `,
      {
        artifactId,
        candidateId: event.aggregateId,
        sourceEventId: event.id,
        sourceId: event.aggregateId,
        sourceTable: event.aggregateType,
      },
    );
  }

  private async projectMemory(event: DomainGraphEvent): Promise<void> {
    const status = getString(event.payload.status) ?? "canon";
    if (status !== "canon") {
      return;
    }

    const entityId = getString(event.payload.entityId);
    const entityType = getString(event.payload.entityType) ?? "entity";
    await executeGraphQuery(
      this.store,
      `
      MERGE (memory:Memory {id: $id})
      SET memory.projectId = $projectId,
          memory.kind = $kind,
          memory.status = $status,
          memory.content = $content,
          memory.entityType = $entityType,
          memory.entityId = $entityId,
          memory.metadata = $metadata,
          memory.sourceTable = $sourceTable,
          memory.sourceId = $sourceId,
          memory.sourceEventId = $sourceEventId
      `,
      {
        content: getString(event.payload.content) ?? event.aggregateId,
        entityId: entityId ?? "",
        entityType,
        id: event.aggregateId,
        kind: getString(event.payload.kind) ?? "fact",
        metadata: JSON.stringify(event.payload),
        projectId: event.projectId,
        sourceEventId: event.id,
        sourceId: event.aggregateId,
        sourceTable: event.aggregateType,
        status,
      },
    );

    if (!entityId) {
      return;
    }

    await this.ensureEntity({
      entityType,
      id: entityId,
      label: entityId,
      metadata: { inferredFrom: event.id },
      projectId: event.projectId,
      sourceEventId: event.id,
      sourceId: entityId,
      sourceTable: entityType,
    });
    await executeGraphQuery(
      this.store,
      `
      MATCH (memory:Memory), (entity:Entity)
      WHERE memory.id = $memoryId AND entity.id = $entityId
      MERGE (memory)-[relation:AFFECTS]->(entity)
      SET relation.predicate = $predicate,
          relation.sourceTable = $sourceTable,
          relation.sourceId = $sourceId,
          relation.sourceEventId = $sourceEventId
      `,
      {
        entityId,
        memoryId: event.aggregateId,
        predicate: getString(event.payload.kind) ?? "fact",
        sourceEventId: event.id,
        sourceId: event.aggregateId,
        sourceTable: event.aggregateType,
      },
    );
  }
}

function resolveEventRelationshipTable(
  relationType: string,
): "CAUSES" | "OCCURS_BEFORE" | "CONTRADICTS" {
  if (relationType === "occurs_before") {
    return "OCCURS_BEFORE";
  }
  if (relationType === "contradicts") {
    return "CONTRADICTS";
  }

  return "CAUSES";
}

function resolveForeshadowingRelationshipTable(
  role: string,
): "SEEDED_IN" | "REINFORCED_IN" | "PAID_OFF_IN" {
  if (role === "payoff") {
    return "PAID_OFF_IN";
  }
  if (role === "reinforce") {
    return "REINFORCED_IN";
  }

  return "SEEDED_IN";
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

function getStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function getNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
