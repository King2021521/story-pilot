import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { DomainEventRepository, PlotRepository, type PlotlineRecord } from "@story-pilot/db";

import { ProjectStorageService } from "../storage/project-storage.service.js";

export interface CreatePlotlineInput {
  readonly projectId: string;
  readonly title: string;
  readonly kind: "main" | "branch" | "romance" | "mystery" | "growth" | "world";
  readonly summary?: string;
  readonly priority: number;
}

export interface UpdatePlotlineNodeInput {
  readonly projectId: string;
  readonly plotlineNodeId: string;
  readonly patch: Record<string, unknown>;
}

@Injectable()
export class PlotlineService {
  constructor(private readonly projectStorage: ProjectStorageService) {}

  async createPlotline(input: CreatePlotlineInput): Promise<PlotlineRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const plotline = new PlotRepository(projectDatabase).createPlotline({
        kind: input.kind,
        plotlineId: randomUUID(),
        priority: input.priority,
        projectId: input.projectId,
        title: input.title,
        ...(input.summary === undefined ? {} : { summary: input.summary }),
      });

      new DomainEventRepository(projectDatabase).append({
        aggregateId: plotline.id,
        aggregateType: "plotline",
        eventId: randomUUID(),
        eventType: "plotline.created",
        payload: {
          title: plotline.name,
          type: plotline.type,
        },
        projectId: input.projectId,
      });

      return plotline;
    } finally {
      projectDatabase.close();
    }
  }

  async listPlotlines(projectId: string): Promise<PlotlineRecord[]> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(projectId);
    try {
      return new PlotRepository(projectDatabase).listPlotlines(projectId);
    } finally {
      projectDatabase.close();
    }
  }

  async updateNode(input: UpdatePlotlineNodeInput): Promise<unknown> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const description = getStringPatch(input.patch, "description");
      const kind = getStringPatch(input.patch, "kind");
      const status = getStringPatch(input.patch, "status");
      const targetChapterId = getStringPatch(input.patch, "targetChapterId");
      const title = getStringPatch(input.patch, "title");
      const position = getNumberPatch(input.patch, "position");
      const node = new PlotRepository(projectDatabase).updatePlotlineNode({
        plotlineNodeId: input.plotlineNodeId,
        projectId: input.projectId,
        ...(description === undefined ? {} : { description }),
        ...(kind === undefined ? {} : { kind }),
        ...(position === undefined ? {} : { position }),
        ...(status === undefined ? {} : { status }),
        ...(targetChapterId === undefined ? {} : { targetChapterId }),
        ...(title === undefined ? {} : { title }),
      });

      new DomainEventRepository(projectDatabase).append({
        aggregateId: node.id,
        aggregateType: "plotline_node",
        eventId: randomUUID(),
        eventType: "plotline_node.updated",
        payload: {
          plotlineId: node.plotlineId,
          status: node.status,
          title: node.title,
        },
        projectId: input.projectId,
      });

      return node;
    } finally {
      projectDatabase.close();
    }
  }
}

function getStringPatch(patch: Record<string, unknown>, key: string): string | undefined {
  const value = patch[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function getNumberPatch(patch: Record<string, unknown>, key: string): number | undefined {
  const value = patch[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
