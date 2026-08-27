import type { ProjectDatabase } from "../project-database.js";

export interface MemoryCandidateRecord {
  readonly id: string;
  readonly projectId: string;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly kind: string;
  readonly content: string;
  readonly confidence: number;
  readonly status: string;
  readonly proposedRelations: string | null;
  readonly modelCallId: string | null;
  readonly createdAt: number;
  readonly resolvedAt: number | null;
}

export interface MemoryRecord {
  readonly id: string;
  readonly projectId: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly kind: string;
  readonly content: string;
  readonly sourceCandidateId: string | null;
  readonly confidence: number;
  readonly status: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface CreateMemoryCandidateRecordInput {
  readonly candidateId: string;
  readonly projectId: string;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly entityType: string;
  readonly entityId?: string;
  readonly kind: string;
  readonly content: string;
  readonly confidence?: number;
  readonly proposedRelations?: unknown;
  readonly modelCallId?: string;
  readonly now?: number;
}

export interface CreateMemoryRecordInput {
  readonly memoryId: string;
  readonly projectId: string;
  readonly entityType: string;
  readonly entityId?: string | null;
  readonly kind: string;
  readonly content: string;
  readonly sourceCandidateId?: string;
  readonly confidence?: number;
  readonly status: "canon" | "hypothesis";
  readonly now?: number;
}

interface MemoryCandidateRow {
  readonly id: string;
  readonly project_id: string;
  readonly source_type: string;
  readonly source_id: string;
  readonly entity_type: string;
  readonly entity_id: string | null;
  readonly kind: string;
  readonly content: string;
  readonly confidence: number;
  readonly status: string;
  readonly proposed_relations: string | null;
  readonly model_call_id: string | null;
  readonly created_at: number;
  readonly resolved_at: number | null;
}

interface MemoryRow {
  readonly id: string;
  readonly project_id: string;
  readonly entity_type: string;
  readonly entity_id: string | null;
  readonly kind: string;
  readonly content: string;
  readonly source_candidate_id: string | null;
  readonly confidence: number;
  readonly status: string;
  readonly created_at: number;
  readonly updated_at: number;
}

export class MemoryRepository {
  constructor(private readonly projectDatabase: ProjectDatabase) {}

  createCandidate(input: CreateMemoryCandidateRecordInput): MemoryCandidateRecord {
    const now = input.now ?? Date.now();
    this.projectDatabase.client
      .prepare(`
        insert into memory_candidates (
          id, project_id, source_type, source_id, entity_type, entity_id, kind,
          content, confidence, status, proposed_relations, model_call_id, created_at
        )
        values (
          @candidateId, @projectId, @sourceType, @sourceId, @entityType, @entityId, @kind,
          @content, @confidence, 'pending', @proposedRelations, @modelCallId, @now
        )
      `)
      .run({
        candidateId: input.candidateId,
        confidence: input.confidence ?? 0.5,
        content: input.content,
        entityId: input.entityId ?? null,
        entityType: input.entityType,
        kind: input.kind,
        modelCallId: input.modelCallId ?? null,
        now,
        projectId: input.projectId,
        proposedRelations:
          input.proposedRelations === undefined ? null : JSON.stringify(input.proposedRelations),
        sourceId: input.sourceId,
        sourceType: input.sourceType,
      });

    const candidate = this.getCandidate(input.projectId, input.candidateId);
    if (!candidate) {
      throw new Error(`MEMORY_CANDIDATE_NOT_CREATED: ${input.candidateId}`);
    }

    return candidate;
  }

  listCandidates(input: {
    readonly projectId: string;
    readonly status?: string;
    readonly limit?: number;
  }): MemoryCandidateRecord[] {
    if (input.status) {
      return this.projectDatabase.client
        .prepare(
          `
          select * from memory_candidates
          where project_id = ? and status = ?
          order by created_at desc
          limit ?
          `,
        )
        .all(input.projectId, input.status, input.limit ?? 100)
        .map((row) => mapMemoryCandidateRow(row as MemoryCandidateRow));
    }

    return this.projectDatabase.client
      .prepare(
        `
        select * from memory_candidates
        where project_id = ?
        order by created_at desc
        limit ?
        `,
      )
      .all(input.projectId, input.limit ?? 100)
      .map((row) => mapMemoryCandidateRow(row as MemoryCandidateRow));
  }

  listMemories(input: {
    readonly projectId: string;
    readonly statuses?: readonly string[];
    readonly limit?: number;
  }): MemoryRecord[] {
    const statuses = input.statuses ?? ["canon"];
    if (statuses.length === 0) {
      return [];
    }
    const placeholders = statuses.map(() => "?").join(", ");
    return this.projectDatabase.client
      .prepare(
        `
        select * from memories
        where project_id = ? and status in (${placeholders})
        order by updated_at desc
        limit ?
        `,
      )
      .all(input.projectId, ...statuses, input.limit ?? 100)
      .map((row) => mapMemoryRow(row as MemoryRow));
  }

  getCandidate(projectId: string, candidateId: string): MemoryCandidateRecord | undefined {
    const row = this.projectDatabase.client
      .prepare("select * from memory_candidates where project_id = ? and id = ?")
      .get(projectId, candidateId) as MemoryCandidateRow | undefined;

    return row ? mapMemoryCandidateRow(row) : undefined;
  }

  createMemory(input: CreateMemoryRecordInput): MemoryRecord {
    const now = input.now ?? Date.now();
    this.projectDatabase.client
      .prepare(`
        insert into memories (
          id, project_id, entity_type, entity_id, kind, content,
          source_candidate_id, confidence, status, created_at, updated_at
        )
        values (
          @memoryId, @projectId, @entityType, @entityId, @kind, @content,
          @sourceCandidateId, @confidence, @status, @now, @now
        )
      `)
      .run({
        confidence: input.confidence ?? 1,
        content: input.content,
        entityId: input.entityId ?? null,
        entityType: input.entityType,
        kind: input.kind,
        memoryId: input.memoryId,
        now,
        projectId: input.projectId,
        sourceCandidateId: input.sourceCandidateId ?? null,
        status: input.status,
      });

    const memory = this.getMemory(input.projectId, input.memoryId);
    if (!memory) {
      throw new Error(`MEMORY_NOT_CREATED: ${input.memoryId}`);
    }

    return memory;
  }

  getMemory(projectId: string, memoryId: string): MemoryRecord | undefined {
    const row = this.projectDatabase.client
      .prepare("select * from memories where project_id = ? and id = ?")
      .get(projectId, memoryId) as MemoryRow | undefined;

    return row ? mapMemoryRow(row) : undefined;
  }
}

function mapMemoryCandidateRow(row: MemoryCandidateRow): MemoryCandidateRecord {
  return {
    confidence: row.confidence,
    content: row.content,
    createdAt: row.created_at,
    entityId: row.entity_id,
    entityType: row.entity_type,
    id: row.id,
    kind: row.kind,
    modelCallId: row.model_call_id,
    projectId: row.project_id,
    proposedRelations: row.proposed_relations,
    resolvedAt: row.resolved_at,
    sourceId: row.source_id,
    sourceType: row.source_type,
    status: row.status,
  };
}

function mapMemoryRow(row: MemoryRow): MemoryRecord {
  return {
    confidence: row.confidence,
    content: row.content,
    createdAt: row.created_at,
    entityId: row.entity_id,
    entityType: row.entity_type,
    id: row.id,
    kind: row.kind,
    projectId: row.project_id,
    sourceCandidateId: row.source_candidate_id,
    status: row.status,
    updatedAt: row.updated_at,
  };
}
