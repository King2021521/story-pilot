import type { KuzuValue } from "kuzu";

import type { GraphStore } from "../graph-store.js";
import { executeGraphQuery } from "../graph-store.js";

export interface GraphNeighborhoodInput {
  readonly projectId: string;
  readonly entityId: string;
  readonly depth?: number;
}

export interface GraphNeighborhoodNode {
  readonly id: string;
  readonly type: string;
  readonly label: string;
}

export interface GraphNeighborhoodEdge {
  readonly sourceId: string;
  readonly targetId: string;
  readonly label: string;
}

export interface GraphNeighborhood {
  readonly nodes: GraphNeighborhoodNode[];
  readonly edges: GraphNeighborhoodEdge[];
}

export interface ProjectGraphInput {
  readonly projectId: string;
}

export interface EventCauseInput extends ProjectGraphInput {
  readonly eventId: string;
}

export interface WorldRuleImpactInput extends ProjectGraphInput {
  readonly worldRuleId: string;
}

export interface ArtifactMemoryCandidateInput extends ProjectGraphInput {
  readonly artifactId: string;
}

export interface ContradictionInput extends ProjectGraphInput {
  readonly targetId?: string;
}

interface GraphEdgeRow {
  readonly sourceId: string;
  readonly sourceLabel: string;
  readonly sourceType: string;
  readonly targetId: string;
  readonly targetLabel: string;
  readonly targetType: string;
  readonly edgeLabel: string;
}

export async function getNeighborhood(
  store: GraphStore,
  input: GraphNeighborhoodInput,
): Promise<GraphNeighborhood> {
  const allEdges = await queryNeighborhoodEdges(store, input.projectId);
  const maxDepth = Math.max(1, Math.min(input.depth ?? 1, 3));
  const nodes = new Map<string, GraphNeighborhoodNode>();
  const edges = new Map<string, GraphNeighborhoodEdge>();
  const visited = new Set<string>([input.entityId]);
  let frontier = new Set<string>([input.entityId]);

  for (let currentDepth = 0; currentDepth < maxDepth; currentDepth += 1) {
    const nextFrontier = new Set<string>();

    for (const row of allEdges) {
      if (!frontier.has(row.sourceId) && !frontier.has(row.targetId)) {
        continue;
      }

      upsertEdgeNodes(nodes, row);
      edges.set(`${row.sourceId}:${row.edgeLabel}:${row.targetId}`, {
        label: row.edgeLabel,
        sourceId: row.sourceId,
        targetId: row.targetId,
      });

      for (const nodeId of [row.sourceId, row.targetId]) {
        if (!visited.has(nodeId)) {
          visited.add(nodeId);
          nextFrontier.add(nodeId);
        }
      }
    }

    frontier = nextFrontier;
    if (frontier.size === 0) {
      break;
    }
  }

  return {
    edges: [...edges.values()],
    nodes: [...nodes.values()],
  };
}

export async function listOpenForeshadowings(
  store: GraphStore,
  input: ProjectGraphInput,
): Promise<GraphNeighborhoodNode[]> {
  const foreshadowings = await executeGraphQuery(
    store,
    `
    MATCH (foreshadowing:Foreshadowing)
    WHERE foreshadowing.projectId = $projectId AND foreshadowing.status <> 'paid_off'
    RETURN foreshadowing.id AS id,
           foreshadowing.title AS label,
           foreshadowing.status AS status
    `,
    { projectId: input.projectId },
  );
  const paidOffRows = await executeGraphQuery(
    store,
    `
    MATCH (foreshadowing:Foreshadowing)-[relation:PAID_OFF_IN]->(storyEvent:StoryEvent)
    WHERE foreshadowing.projectId = $projectId
    RETURN foreshadowing.id AS id
    `,
    { projectId: input.projectId },
  );
  const paidOffIds = new Set(paidOffRows.map((row) => String(row.id)));

  return foreshadowings
    .filter((row) => !paidOffIds.has(String(row.id)))
    .map(
      (row) =>
        ({
          id: String(row.id),
          label: String(row.label),
          type: "foreshadowing",
          status: String(row.status),
        }) as GraphNeighborhoodNode & { readonly status: string },
    );
}

export async function listEventCauses(
  store: GraphStore,
  input: EventCauseInput,
): Promise<GraphNeighborhoodEdge[]> {
  const rows = await executeGraphQuery(
    store,
    `
    MATCH (source:StoryEvent)-[relation:CAUSES]->(target:StoryEvent)
    WHERE source.projectId = $projectId AND target.projectId = $projectId AND target.id = $eventId
    RETURN source.id AS sourceId,
           target.id AS targetId,
           relation.relationType AS edgeLabel
    `,
    {
      eventId: input.eventId,
      projectId: input.projectId,
    },
  );

  return rows.map((row) => ({
    label: String(row.edgeLabel),
    sourceId: String(row.sourceId),
    targetId: String(row.targetId),
  }));
}

export async function listWorldRuleImpacts(
  store: GraphStore,
  input: WorldRuleImpactInput,
): Promise<Array<GraphNeighborhoodEdge & { readonly targetType: string }>> {
  const rows = [
    ...(await queryEntityConstraints(store, input)),
    ...(await queryStoryEventConstraints(store, input)),
  ];

  return rows.map((row) => ({
    label: String(row.edgeLabel),
    sourceId: String(row.sourceId),
    targetId: String(row.targetId),
    targetType: String(row.targetType),
  }));
}

export async function listArtifactMemoryCandidates(
  store: GraphStore,
  input: ArtifactMemoryCandidateInput,
): Promise<GraphNeighborhoodNode[]> {
  const rows = await executeGraphQuery(
    store,
    `
    MATCH (artifact:Entity)-[relation:GENERATED]->(candidate:Entity)
    WHERE artifact.projectId = $projectId
      AND artifact.id = $artifactId
      AND candidate.entityType = 'memory_candidate'
    RETURN candidate.id AS id,
           candidate.name AS label,
           candidate.entityType AS type
    `,
    {
      artifactId: input.artifactId,
      projectId: input.projectId,
    },
  );

  return rows.map((row) => ({
    id: String(row.id),
    label: String(row.label),
    type: String(row.type),
  }));
}

export async function listContradictions(
  store: GraphStore,
  input: ContradictionInput,
): Promise<GraphNeighborhoodEdge[]> {
  const targetFilter = input.targetId ? "AND (source.id = $targetId OR target.id = $targetId)" : "";
  const rows = await executeGraphQuery(
    store,
    `
    MATCH (source:StoryEvent)-[relation:CONTRADICTS]->(target:StoryEvent)
    WHERE source.projectId = $projectId AND target.projectId = $projectId ${targetFilter}
    RETURN source.id AS sourceId,
           target.id AS targetId,
           relation.relationType AS edgeLabel
    `,
    input.targetId
      ? { projectId: input.projectId, targetId: input.targetId }
      : { projectId: input.projectId },
  );

  return rows.map((row) => ({
    label: String(row.edgeLabel),
    sourceId: String(row.sourceId),
    targetId: String(row.targetId),
  }));
}

async function queryNeighborhoodEdges(
  store: GraphStore,
  projectId: string,
): Promise<GraphEdgeRow[]> {
  const rowGroups = [
    await queryEntityRelations(store, projectId),
    await queryMemoryAffects(store, projectId),
    await queryParticipants(store, projectId),
    await queryOccurrences(store, projectId),
    await queryForeshadowingLinks(store, projectId, "SEEDED_IN", "seeds"),
    await queryForeshadowingLinks(store, projectId, "REINFORCED_IN", "reinforces"),
    await queryForeshadowingLinks(store, projectId, "PAID_OFF_IN", "pays_off"),
    await queryEventRelationshipEdges(store, projectId, "CAUSES"),
    await queryEventRelationshipEdges(store, projectId, "OCCURS_BEFORE"),
    await queryEventRelationshipEdges(store, projectId, "CONTRADICTS"),
    await queryEntityConstraints(store, { projectId, worldRuleId: "" }),
    await queryStoryEventConstraints(store, { projectId, worldRuleId: "" }),
    await queryGeneratedCandidates(store, projectId),
  ];

  return rowGroups.flat().map(mapEdgeRow);
}

async function queryMemoryAffects(
  store: GraphStore,
  projectId: string,
): Promise<Record<string, KuzuValue>[]> {
  return executeGraphQuery(
    store,
    `
    MATCH (source:Memory)-[relation:AFFECTS]->(target:Entity)
    WHERE source.projectId = $projectId
    RETURN source.id AS sourceId,
           source.content AS sourceLabel,
           'memory' AS sourceType,
           target.id AS targetId,
           target.name AS targetLabel,
           target.entityType AS targetType,
           relation.predicate AS edgeLabel
    `,
    { projectId },
  );
}

async function queryEntityRelations(
  store: GraphStore,
  projectId: string,
): Promise<Record<string, KuzuValue>[]> {
  return executeGraphQuery(
    store,
    `
    MATCH (source:Entity)-[relation:RELATES]->(target:Entity)
    WHERE source.projectId = $projectId
    RETURN source.id AS sourceId,
           source.name AS sourceLabel,
           source.entityType AS sourceType,
           target.id AS targetId,
           target.name AS targetLabel,
           target.entityType AS targetType,
           relation.relationType AS edgeLabel
    `,
    { projectId },
  );
}

async function queryParticipants(
  store: GraphStore,
  projectId: string,
): Promise<Record<string, KuzuValue>[]> {
  return executeGraphQuery(
    store,
    `
    MATCH (source:Entity)-[relation:PARTICIPATES_IN]->(target:StoryEvent)
    WHERE source.projectId = $projectId
    RETURN source.id AS sourceId,
           source.name AS sourceLabel,
           source.entityType AS sourceType,
           target.id AS targetId,
           target.title AS targetLabel,
           'story_event' AS targetType,
           relation.role AS edgeLabel
    `,
    { projectId },
  );
}

async function queryOccurrences(
  store: GraphStore,
  projectId: string,
): Promise<Record<string, KuzuValue>[]> {
  return executeGraphQuery(
    store,
    `
    MATCH (source:StoryEvent)-[relation:OCCURS_IN]->(target:Entity)
    WHERE source.projectId = $projectId
    RETURN source.id AS sourceId,
           source.title AS sourceLabel,
           'story_event' AS sourceType,
           target.id AS targetId,
           target.name AS targetLabel,
           target.entityType AS targetType,
           relation.scope AS edgeLabel
    `,
    { projectId },
  );
}

async function queryForeshadowingLinks(
  store: GraphStore,
  projectId: string,
  relationshipTable: "SEEDED_IN" | "REINFORCED_IN" | "PAID_OFF_IN",
  label: "seeds" | "reinforces" | "pays_off",
): Promise<Record<string, KuzuValue>[]> {
  return executeGraphQuery(
    store,
    `
    MATCH (source:Foreshadowing)-[relation:${relationshipTable}]->(target:StoryEvent)
    WHERE source.projectId = $projectId
    RETURN source.id AS sourceId,
           source.title AS sourceLabel,
           'foreshadowing' AS sourceType,
           target.id AS targetId,
           target.title AS targetLabel,
           'story_event' AS targetType,
           $label AS edgeLabel
    `,
    {
      label,
      projectId,
    },
  );
}

async function queryEventRelationshipEdges(
  store: GraphStore,
  projectId: string,
  relationshipTable: "CAUSES" | "OCCURS_BEFORE" | "CONTRADICTS",
): Promise<Record<string, KuzuValue>[]> {
  return executeGraphQuery(
    store,
    `
    MATCH (source:StoryEvent)-[relation:${relationshipTable}]->(target:StoryEvent)
    WHERE source.projectId = $projectId AND target.projectId = $projectId
    RETURN source.id AS sourceId,
           source.title AS sourceLabel,
           'story_event' AS sourceType,
           target.id AS targetId,
           target.title AS targetLabel,
           'story_event' AS targetType,
           relation.relationType AS edgeLabel
    `,
    { projectId },
  );
}

async function queryEntityConstraints(
  store: GraphStore,
  input: WorldRuleImpactInput,
): Promise<Record<string, KuzuValue>[]> {
  const ruleFilter = input.worldRuleId ? "AND source.id = $worldRuleId" : "";
  return executeGraphQuery(
    store,
    `
    MATCH (source:Entity)-[relation:CONSTRAINS]->(target:Entity)
    WHERE source.projectId = $projectId ${ruleFilter}
    RETURN source.id AS sourceId,
           source.name AS sourceLabel,
           source.entityType AS sourceType,
           target.id AS targetId,
           target.name AS targetLabel,
           target.entityType AS targetType,
           'constrains' AS edgeLabel
    `,
    input.worldRuleId
      ? { projectId: input.projectId, worldRuleId: input.worldRuleId }
      : { projectId: input.projectId },
  );
}

async function queryStoryEventConstraints(
  store: GraphStore,
  input: WorldRuleImpactInput,
): Promise<Record<string, KuzuValue>[]> {
  const ruleFilter = input.worldRuleId ? "AND source.id = $worldRuleId" : "";
  return executeGraphQuery(
    store,
    `
    MATCH (source:Entity)-[relation:CONSTRAINS]->(target:StoryEvent)
    WHERE source.projectId = $projectId ${ruleFilter}
    RETURN source.id AS sourceId,
           source.name AS sourceLabel,
           source.entityType AS sourceType,
           target.id AS targetId,
           target.title AS targetLabel,
           'story_event' AS targetType,
           'constrains' AS edgeLabel
    `,
    input.worldRuleId
      ? { projectId: input.projectId, worldRuleId: input.worldRuleId }
      : { projectId: input.projectId },
  );
}

async function queryGeneratedCandidates(
  store: GraphStore,
  projectId: string,
): Promise<Record<string, KuzuValue>[]> {
  return executeGraphQuery(
    store,
    `
    MATCH (source:Entity)-[relation:GENERATED]->(target:Entity)
    WHERE source.projectId = $projectId
    RETURN source.id AS sourceId,
           source.name AS sourceLabel,
           source.entityType AS sourceType,
           target.id AS targetId,
           target.name AS targetLabel,
           target.entityType AS targetType,
           'generated' AS edgeLabel
    `,
    { projectId },
  );
}

function upsertEdgeNodes(nodes: Map<string, GraphNeighborhoodNode>, row: GraphEdgeRow): void {
  nodes.set(row.sourceId, {
    id: row.sourceId,
    label: row.sourceLabel,
    type: row.sourceType,
  });
  nodes.set(row.targetId, {
    id: row.targetId,
    label: row.targetLabel,
    type: row.targetType,
  });
}

function mapEdgeRow(row: Record<string, KuzuValue>): GraphEdgeRow {
  return {
    edgeLabel: String(row.edgeLabel),
    sourceId: String(row.sourceId),
    sourceLabel: String(row.sourceLabel),
    sourceType: String(row.sourceType),
    targetId: String(row.targetId),
    targetLabel: String(row.targetLabel),
    targetType: String(row.targetType),
  };
}
