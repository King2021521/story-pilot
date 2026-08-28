import { rmSync } from "node:fs";

import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import {
  createGraphStore,
  GraphProjector,
  getNeighborhood,
  initializeGraphSchema,
  listContradictions,
  type GraphNeighborhood,
  type GraphStore,
} from "@story-pilot/graph";

import { ProjectStorageService } from "../storage/project-storage.service.js";

export interface GraphNeighborhoodRequest {
  readonly projectId: string;
  readonly entityId: string;
  readonly nodeType?: string;
  readonly depth?: number;
}

export interface GraphRebuildResult {
  readonly projectId: string;
  readonly projectedEvents: number;
  readonly lastDomainEventId?: string | null;
  readonly projectionName?: string;
}

export interface GraphContradictionResult {
  readonly items: readonly unknown[];
}

export interface GraphContradictionRequest {
  readonly projectId: string;
  readonly scope?: string;
  readonly targetId?: string;
}

interface DomainEventRow {
  readonly row_id: number;
  readonly id: string;
  readonly project_id: string;
  readonly aggregate_type: string;
  readonly aggregate_id: string;
  readonly event_type: string;
  readonly payload: string;
}

interface ProjectionCheckpointRow {
  readonly last_domain_event_id: string | null;
}

@Injectable()
export class GraphService implements OnModuleDestroy {
  private readonly graphStores = new Map<string, GraphStore>();

  constructor(private readonly projectStorage: ProjectStorageService) {}

  async onModuleDestroy(): Promise<void> {
    await Promise.all(
      [...this.graphStores.keys()].map((projectId) => this.closeProjectStore(projectId)),
    );
  }

  async rebuild(projectId: string): Promise<GraphRebuildResult> {
    const graphPath = this.projectStorage.getGraphPath(projectId);
    await this.closeProjectStore(projectId);
    rmSync(graphPath, { force: true, recursive: true });

    const projectDatabase = await this.projectStorage.openProjectDatabase(projectId);
    const store = await this.getProjectStore(projectId);

    try {
      const events = projectDatabase.client
        .prepare(
          `
          select rowid as row_id, id, project_id, aggregate_type, aggregate_id, event_type, payload
          from domain_events
          where project_id = ?
          order by created_at asc
          `,
        )
        .all(projectId) as DomainEventRow[];
      const projector = new GraphProjector(store);

      for (const event of events) {
        await projector.project({
          aggregateId: event.aggregate_id,
          aggregateType: event.aggregate_type,
          eventType: event.event_type,
          id: event.id,
          payload: parsePayload(event.payload),
          projectId: event.project_id,
        });
      }

      const now = Date.now();
      const lastEventId = events.at(-1)?.id ?? null;
      projectDatabase.client
        .prepare("delete from projection_checkpoints where project_id = ? and projection_name = ?")
        .run(projectId, "kuzu_main");
      projectDatabase.client
        .prepare(
          `
          insert into projection_checkpoints (
            id, project_id, projection_name, last_domain_event_id, rebuilt_at, updated_at
          )
          values (?, ?, ?, ?, ?, ?)
        `,
        )
        .run(`kuzu_main:${projectId}`, projectId, "kuzu_main", lastEventId, now, now);

      return {
        lastDomainEventId: lastEventId,
        projectId,
        projectionName: "kuzu_main",
        projectedEvents: events.length,
      };
    } finally {
      projectDatabase.close();
    }
  }

  async getNeighborhood(input: GraphNeighborhoodRequest): Promise<GraphNeighborhood> {
    const store = await this.getProjectStore(input.projectId);
    return getNeighborhood(store, input);
  }

  async projectSinceCheckpoint(projectId: string): Promise<GraphRebuildResult> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(projectId);
    try {
      const checkpoint = projectDatabase.client
        .prepare(
          `
          select last_domain_event_id
          from projection_checkpoints
          where project_id = ? and projection_name = ?
          `,
        )
        .get(projectId, "kuzu_main") as ProjectionCheckpointRow | undefined;
      if (!checkpoint) {
        await this.closeProjectStore(projectId);
        rmSync(this.projectStorage.getGraphPath(projectId), { force: true, recursive: true });
      }
      const store = await this.getProjectStore(projectId);
      const lastRowId = checkpoint?.last_domain_event_id
        ? ((
            projectDatabase.client
              .prepare("select rowid as row_id from domain_events where project_id = ? and id = ?")
              .get(projectId, checkpoint.last_domain_event_id) as { row_id: number } | undefined
          )?.row_id ?? 0)
        : 0;
      const events = projectDatabase.client
        .prepare(
          `
          select rowid as row_id, id, project_id, aggregate_type, aggregate_id, event_type, payload
          from domain_events
          where project_id = ? and rowid > ?
          order by rowid asc
          `,
        )
        .all(projectId, lastRowId) as DomainEventRow[];
      const projector = new GraphProjector(store);

      for (const event of events) {
        await projector.project({
          aggregateId: event.aggregate_id,
          aggregateType: event.aggregate_type,
          eventType: event.event_type,
          id: event.id,
          payload: parsePayload(event.payload),
          projectId: event.project_id,
        });
      }

      const lastEventId = events.at(-1)?.id ?? checkpoint?.last_domain_event_id ?? null;
      projectDatabase.client
        .prepare(
          `
          insert into projection_checkpoints (
            id, project_id, projection_name, last_domain_event_id, rebuilt_at, updated_at
          )
          values (?, ?, ?, ?, null, ?)
          on conflict(id) do update set
            last_domain_event_id = excluded.last_domain_event_id,
            updated_at = excluded.updated_at
          `,
        )
        .run(`kuzu_main:${projectId}`, projectId, "kuzu_main", lastEventId, Date.now());

      return {
        lastDomainEventId: lastEventId,
        projectId,
        projectionName: "kuzu_main",
        projectedEvents: events.length,
      };
    } finally {
      projectDatabase.close();
    }
  }

  async findContradictions(input: GraphContradictionRequest): Promise<GraphContradictionResult> {
    const store = await this.getProjectStore(input.projectId);
    return {
      items: await listContradictions(store, {
        projectId: input.projectId,
        ...(input.targetId === undefined ? {} : { targetId: input.targetId }),
      }),
    };
  }

  private async getProjectStore(projectId: string): Promise<GraphStore> {
    const existingStore = this.graphStores.get(projectId);
    if (existingStore) {
      return existingStore;
    }

    const store = await createGraphStore(this.projectStorage.getGraphPath(projectId));
    await initializeGraphSchema(store);
    this.graphStores.set(projectId, store);
    return store;
  }

  private async closeProjectStore(projectId: string): Promise<void> {
    const store = this.graphStores.get(projectId);
    if (!store) {
      return;
    }

    this.graphStores.delete(projectId);
    await store.close();
  }
}

function parsePayload(payload: string): Record<string, unknown> {
  const parsed = JSON.parse(payload) as unknown;
  return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
}
