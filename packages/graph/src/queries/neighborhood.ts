import type { KuzuValue } from "kuzu";

import type { GraphStore } from "../graph-store.js";
import { executeGraphQuery } from "../graph-store.js";

export interface GraphNeighborhoodInput {
  readonly projectId: string;
  readonly entityId: string;
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

export async function getNeighborhood(
  store: GraphStore,
  input: GraphNeighborhoodInput,
): Promise<GraphNeighborhood> {
  const rows = [
    ...(await queryEntityRelations(store, input)),
    ...(await queryForeshadowingLinks(store, input, "SEEDS", "seeds")),
    ...(await queryForeshadowingLinks(store, input, "PAYS_OFF", "pays_off")),
  ];
  const nodes = new Map<string, GraphNeighborhoodNode>();
  const edges: GraphNeighborhoodEdge[] = [];

  for (const row of rows) {
    const sourceId = String(row.sourceId);
    const targetId = String(row.targetId);
    nodes.set(sourceId, {
      id: sourceId,
      label: String(row.sourceLabel),
      type: String(row.sourceType),
    });
    nodes.set(targetId, {
      id: targetId,
      label: String(row.targetLabel),
      type: String(row.targetType),
    });
    edges.push({
      label: String(row.edgeLabel),
      sourceId,
      targetId,
    });
  }

  return {
    edges,
    nodes: [...nodes.values()],
  };
}

async function queryEntityRelations(
  store: GraphStore,
  input: GraphNeighborhoodInput,
): Promise<Record<string, KuzuValue>[]> {
  return executeGraphQuery(
    store,
    `
    MATCH (source:Entity)-[relation:RELATES]->(target:Entity)
    WHERE source.id = $entityId AND source.projectId = $projectId
    RETURN source.id AS sourceId,
           source.name AS sourceLabel,
           source.entityType AS sourceType,
           target.id AS targetId,
           target.name AS targetLabel,
           target.entityType AS targetType,
           relation.relationType AS edgeLabel
    `,
    {
      entityId: input.entityId,
      projectId: input.projectId,
    },
  );
}

async function queryForeshadowingLinks(
  store: GraphStore,
  input: GraphNeighborhoodInput,
  relationshipTable: "SEEDS" | "PAYS_OFF",
  label: "seeds" | "pays_off",
): Promise<Record<string, KuzuValue>[]> {
  return executeGraphQuery(
    store,
    `
    MATCH (source:Foreshadowing)-[relation:${relationshipTable}]->(target:StoryEvent)
    WHERE source.id = $entityId AND source.projectId = $projectId
    RETURN source.id AS sourceId,
           source.title AS sourceLabel,
           'foreshadowing' AS sourceType,
           target.id AS targetId,
           target.title AS targetLabel,
           'story_event' AS targetType,
           $label AS edgeLabel
    `,
    {
      entityId: input.entityId,
      label,
      projectId: input.projectId,
    },
  );
}
