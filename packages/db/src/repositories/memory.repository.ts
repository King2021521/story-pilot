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
  readonly scope: string;
  readonly validFromChapterIndex: number | null;
  readonly validToChapterIndex: number | null;
  readonly sourceType: string | null;
  readonly sourceId: string | null;
  readonly sourceQuote: string | null;
  readonly evidence: unknown;
  readonly sourceCandidateId: string | null;
  readonly confidence: number;
  readonly status: string;
  readonly supersedesMemoryId: string | null;
  readonly contradictionGroupId: string | null;
  readonly embeddingRef: string | null;
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
  readonly scope?: string;
  readonly validFromChapterIndex?: number;
  readonly validToChapterIndex?: number;
  readonly sourceType?: string;
  readonly sourceId?: string;
  readonly sourceQuote?: string;
  readonly evidence?: unknown;
  readonly confidence?: number;
  readonly status: "canon" | "hypothesis";
  readonly supersedesMemoryId?: string;
  readonly contradictionGroupId?: string;
  readonly embeddingRef?: string;
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
  readonly scope: string;
  readonly valid_from_chapter_index: number | null;
  readonly valid_to_chapter_index: number | null;
  readonly source_type: string | null;
  readonly source_id: string | null;
  readonly source_quote: string | null;
  readonly evidence_json: string;
  readonly source_candidate_id: string | null;
  readonly confidence: number;
  readonly status: string;
  readonly supersedes_memory_id: string | null;
  readonly contradiction_group_id: string | null;
  readonly embedding_ref: string | null;
  readonly created_at: number;
  readonly updated_at: number;
}

export class MemoryRepository {
  constructor(private readonly projectDatabase: ProjectDatabase) {}

  createCandidate(input: CreateMemoryCandidateRecordInput): MemoryCandidateRecord {
    const now = input.now ?? Date.now();
    this.projectDatabase.client
      .prepare(
        `
        insert into memory_candidates (
          id, project_id, source_type, source_id, entity_type, entity_id, kind,
          content, confidence, status, proposed_relations, model_call_id, created_at
        )
        values (
          @candidateId, @projectId, @sourceType, @sourceId, @entityType, @entityId, @kind,
          @content, @confidence, 'pending', @proposedRelations, @modelCallId, @now
        )
      `,
      )
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

  searchMemories(input: {
    readonly projectId: string;
    readonly query: string;
    readonly status?: string;
    readonly limit?: number;
  }): MemoryRecord[] {
    const status = input.status ?? "canon";
    return this.projectDatabase.client
      .prepare(
        `
        select * from memories
        where project_id = ?
          and status = ?
          and content like ?
        order by updated_at desc
        limit ?
        `,
      )
      .all(input.projectId, status, `%${input.query}%`, input.limit ?? 20)
      .map((row) => mapMemoryRow(row as MemoryRow));
  }

  getCandidate(projectId: string, candidateId: string): MemoryCandidateRecord | undefined {
    const row = this.projectDatabase.client
      .prepare("select * from memory_candidates where project_id = ? and id = ?")
      .get(projectId, candidateId) as MemoryCandidateRow | undefined;

    return row ? mapMemoryCandidateRow(row) : undefined;
  }

  updateCandidateStatus(input: {
    readonly projectId: string;
    readonly candidateId: string;
    readonly status: "accepted" | "merged" | "rejected";
    readonly now?: number;
  }): MemoryCandidateRecord {
    const now = input.now ?? Date.now();
    this.projectDatabase.client
      .prepare(
        "update memory_candidates set status = ?, resolved_at = ? where project_id = ? and id = ?",
      )
      .run(input.status, now, input.projectId, input.candidateId);

    const candidate = this.getCandidate(input.projectId, input.candidateId);
    if (!candidate) {
      throw new Error(`MEMORY_CANDIDATE_NOT_FOUND: ${input.candidateId}`);
    }

    return candidate;
  }

  createMemory(input: CreateMemoryRecordInput): MemoryRecord {
    const now = input.now ?? Date.now();
    this.projectDatabase.client
      .prepare(
        `
        insert into memories (
          id, project_id, entity_type, entity_id, kind, content,
          scope, valid_from_chapter_index, valid_to_chapter_index,
          source_type, source_id, source_quote, evidence_json,
          source_candidate_id, confidence, status, supersedes_memory_id,
          contradiction_group_id, embedding_ref, created_at, updated_at
        )
        values (
          @memoryId, @projectId, @entityType, @entityId, @kind, @content,
          @scope, @validFromChapterIndex, @validToChapterIndex,
          @sourceType, @sourceId, @sourceQuote, @evidenceJson,
          @sourceCandidateId, @confidence, @status, @supersedesMemoryId,
          @contradictionGroupId, @embeddingRef, @now, @now
        )
      `,
      )
      .run({
        confidence: input.confidence ?? 1,
        content: input.content,
        contradictionGroupId: input.contradictionGroupId ?? null,
        embeddingRef: input.embeddingRef ?? null,
        entityId: input.entityId ?? null,
        entityType: input.entityType,
        evidenceJson: JSON.stringify(input.evidence ?? {}),
        kind: input.kind,
        memoryId: input.memoryId,
        now,
        projectId: input.projectId,
        scope: input.scope ?? "project",
        sourceCandidateId: input.sourceCandidateId ?? null,
        sourceId: input.sourceId ?? input.sourceCandidateId ?? null,
        sourceQuote: input.sourceQuote ?? null,
        sourceType:
          input.sourceType ?? (input.sourceCandidateId === undefined ? null : "memory_candidate"),
        status: input.status,
        supersedesMemoryId: input.supersedesMemoryId ?? null,
        validFromChapterIndex: input.validFromChapterIndex ?? null,
        validToChapterIndex: input.validToChapterIndex ?? null,
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

  updateMemoryContent(input: {
    readonly projectId: string;
    readonly memoryId: string;
    readonly content: string;
    readonly confidence?: number;
    readonly now?: number;
  }): MemoryRecord {
    const now = input.now ?? Date.now();
    this.projectDatabase.client
      .prepare(
        `
        update memories
        set content = @content,
            confidence = coalesce(@confidence, confidence),
            updated_at = @now
        where project_id = @projectId and id = @memoryId
        `,
      )
      .run({
        confidence: input.confidence ?? null,
        content: input.content,
        memoryId: input.memoryId,
        now,
        projectId: input.projectId,
      });

    const memory = this.getMemory(input.projectId, input.memoryId);
    if (!memory) {
      throw new Error(`MEMORY_NOT_FOUND: ${input.memoryId}`);
    }

    return memory;
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
    scope: row.scope,
    sourceId: row.source_id,
    sourceCandidateId: row.source_candidate_id,
    sourceQuote: row.source_quote,
    sourceType: row.source_type,
    status: row.status,
    supersedesMemoryId: row.supersedes_memory_id,
    contradictionGroupId: row.contradiction_group_id,
    embeddingRef: row.embedding_ref,
    evidence: parseJson(row.evidence_json, {}),
    validFromChapterIndex: row.valid_from_chapter_index,
    validToChapterIndex: row.valid_to_chapter_index,
    updatedAt: row.updated_at,
  };
}

function parseJson(value: string, fallback: unknown): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return fallback;
  }
}
