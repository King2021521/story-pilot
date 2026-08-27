import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import {
  DomainEventRepository,
  MemoryRepository,
  type ProjectDatabase,
  type MemoryCandidateRecord,
  type MemoryRecord,
} from "@story-pilot/db";

import { GraphService } from "../graph/graph.service.js";
import { ProjectStorageService } from "../storage/project-storage.service.js";

export type MemoryConfirmDecision = "canon" | "hypothesis" | "merge" | "reject";

export interface ConfirmMemoryInput {
  readonly projectId: string;
  readonly candidateId: string;
  readonly decision: MemoryConfirmDecision;
  readonly mergeTargetMemoryId?: string;
  readonly editedStatement?: string;
}

export interface RejectMemoryInput {
  readonly projectId: string;
  readonly candidateId: string;
}

export interface MergeMemoryInput {
  readonly projectId: string;
  readonly candidateId: string;
  readonly targetMemoryId: string;
  readonly editedStatement?: string;
}

export interface MemoryDecisionResult {
  readonly candidate: MemoryCandidateRecord;
  readonly memory?: MemoryRecord;
}

@Injectable()
export class MemoryService {
  constructor(
    private readonly projectStorage: ProjectStorageService,
    private readonly graphService: GraphService,
  ) {}

  async listCandidates(input: {
    readonly projectId: string;
    readonly status?: string;
  }): Promise<MemoryCandidateRecord[]> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      return new MemoryRepository(projectDatabase).listCandidates({
        projectId: input.projectId,
        ...(input.status === undefined ? {} : { status: input.status }),
      });
    } finally {
      projectDatabase.close();
    }
  }

  async searchMemories(input: {
    readonly projectId: string;
    readonly query: string;
    readonly status?: string;
    readonly limit?: number;
  }): Promise<MemoryRecord[]> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      return new MemoryRepository(projectDatabase).searchMemories({
        projectId: input.projectId,
        query: input.query,
        ...(input.limit === undefined ? {} : { limit: input.limit }),
        ...(input.status === undefined ? {} : { status: input.status }),
      });
    } finally {
      projectDatabase.close();
    }
  }

  async confirm(input: ConfirmMemoryInput): Promise<MemoryDecisionResult> {
    if (input.decision === "reject") {
      return this.reject(input);
    }
    if (input.decision === "merge") {
      if (!input.mergeTargetMemoryId) {
        throw new Error("MEMORY_MERGE_TARGET_REQUIRED");
      }
      return this.merge({
        candidateId: input.candidateId,
        projectId: input.projectId,
        targetMemoryId: input.mergeTargetMemoryId,
        ...(input.editedStatement === undefined ? {} : { editedStatement: input.editedStatement }),
      });
    }

    const memoryStatus = input.decision;
    const result = await this.resolveInTransaction(input.projectId, (projectDatabase) => {
      const { candidate, events, repository } = this.getPendingCandidate(
        projectDatabase,
        input.projectId,
        input.candidateId,
      );
      const memory = repository.createMemory({
        confidence: candidate.confidence,
        content: input.editedStatement?.trim() || candidate.content,
        entityId: candidate.entityId,
        entityType: candidate.entityType,
        kind: candidate.kind,
        memoryId: randomUUID(),
        projectId: input.projectId,
        sourceCandidateId: candidate.id,
        status: memoryStatus,
      });
      const resolvedCandidate = repository.updateCandidateStatus({
        candidateId: candidate.id,
        projectId: input.projectId,
        status: "accepted",
      });
      events.append({
        aggregateId: memory.id,
        aggregateType: "memory",
        eventId: randomUUID(),
        eventType: "memory.confirmed",
        payload: memory,
        projectId: input.projectId,
      });

      return {
        candidate: resolvedCandidate,
        memory,
      };
    });
    await this.graphService.rebuild(input.projectId);

    return result;
  }

  async reject(input: RejectMemoryInput): Promise<MemoryDecisionResult> {
    return this.resolveInTransaction(input.projectId, (projectDatabase) => {
      const { candidate, events, repository } = this.getPendingCandidate(
        projectDatabase,
        input.projectId,
        input.candidateId,
      );
      const resolvedCandidate = repository.updateCandidateStatus({
        candidateId: candidate.id,
        projectId: input.projectId,
        status: "rejected",
      });
      events.append({
        aggregateId: candidate.id,
        aggregateType: "memory_candidate",
        eventId: randomUUID(),
        eventType: "memory_candidate.rejected",
        payload: {
          candidateId: candidate.id,
          content: candidate.content,
        },
        projectId: input.projectId,
      });

      return { candidate: resolvedCandidate };
    });
  }

  async merge(input: MergeMemoryInput): Promise<MemoryDecisionResult> {
    const result = await this.resolveInTransaction(input.projectId, (projectDatabase) => {
      const { candidate, events, repository } = this.getPendingCandidate(
        projectDatabase,
        input.projectId,
        input.candidateId,
      );
      const target = repository.getMemory(input.projectId, input.targetMemoryId);
      if (!target) {
        throw new Error(`MEMORY_NOT_FOUND: ${input.targetMemoryId}`);
      }

      const memory = repository.updateMemoryContent({
        confidence: Math.max(target.confidence, candidate.confidence),
        content: input.editedStatement?.trim() || candidate.content,
        memoryId: target.id,
        projectId: input.projectId,
      });
      const resolvedCandidate = repository.updateCandidateStatus({
        candidateId: candidate.id,
        projectId: input.projectId,
        status: "merged",
      });
      events.append({
        aggregateId: memory.id,
        aggregateType: "memory",
        eventId: randomUUID(),
        eventType: "memory.merged",
        payload: {
          ...memory,
          sourceCandidateId: candidate.id,
        },
        projectId: input.projectId,
      });

      return {
        candidate: resolvedCandidate,
        memory,
      };
    });
    await this.graphService.rebuild(input.projectId);

    return result;
  }

  private async resolveInTransaction<T>(
    projectId: string,
    operation: (projectDatabase: ProjectDatabase) => T,
  ): Promise<T> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(projectId);
    try {
      return projectDatabase.client.transaction(() => operation(projectDatabase))();
    } finally {
      projectDatabase.close();
    }
  }

  private getPendingCandidate(
    projectDatabase: ProjectDatabase,
    projectId: string,
    candidateId: string,
  ): {
    readonly candidate: MemoryCandidateRecord;
    readonly events: DomainEventRepository;
    readonly repository: MemoryRepository;
  } {
    const repository = new MemoryRepository(projectDatabase);
    const candidate = repository.getCandidate(projectId, candidateId);
    if (!candidate) {
      throw new Error(`MEMORY_CANDIDATE_NOT_FOUND: ${candidateId}`);
    }
    if (candidate.status !== "pending") {
      throw new Error(`MEMORY_CANDIDATE_ALREADY_RESOLVED: ${candidateId}`);
    }

    return {
      candidate,
      events: new DomainEventRepository(projectDatabase),
      repository,
    };
  }
}
