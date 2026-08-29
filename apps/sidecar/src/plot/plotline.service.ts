import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import {
  DomainEventRepository,
  PlotRepository,
  type PlotlineNodeRecord,
  type PlotlineRecord,
  type UpdatePlotlineRecordInput,
} from "@story-pilot/db";

import { ProjectStorageService } from "../storage/project-storage.service.js";

export interface CreatePlotlineInput {
  readonly projectId: string;
  readonly title: string;
  readonly kind: "main" | "branch" | "romance" | "mystery" | "growth" | "world" | "antagonist";
  readonly narrativeRole?: string;
  readonly importance?: string;
  readonly status?: string;
  readonly summary?: string;
  readonly centralQuestion?: string;
  readonly driver?: string;
  readonly startState?: string;
  readonly midEscalation?: string;
  readonly payoffPlan?: string;
  readonly emotionalPromise?: string;
  readonly relatedCharacterIds?: readonly string[];
  readonly relatedWorldRuleIds?: readonly string[];
  readonly relatedForeshadowingIds?: readonly string[];
  readonly relatedStoryEventIds?: readonly string[];
  readonly priority: number;
}

export interface UpdatePlotlineInput {
  readonly projectId: string;
  readonly plotlineId: string;
  readonly patch: Record<string, unknown>;
}

export interface CreatePlotlineNodeInput {
  readonly projectId: string;
  readonly plotlineId: string;
  readonly title: string;
  readonly kind: string;
  readonly status?: string;
  readonly description?: string;
  readonly chapterHint?: string;
  readonly targetChapterId?: string;
  readonly position?: number;
}

export interface UpdatePlotlineNodeInput {
  readonly projectId: string;
  readonly plotlineNodeId: string;
  readonly patch: Record<string, unknown>;
}

type MutableUpdatePlotlineRecordInput = {
  -readonly [Key in keyof UpdatePlotlineRecordInput]: UpdatePlotlineRecordInput[Key];
};

@Injectable()
export class PlotlineService {
  constructor(private readonly projectStorage: ProjectStorageService) {}

  async createPlotline(input: CreatePlotlineInput): Promise<PlotlineRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const plotline = new PlotRepository(projectDatabase).createPlotline({
        ...(input.centralQuestion === undefined ? {} : { centralQuestion: input.centralQuestion }),
        ...(input.driver === undefined ? {} : { driver: input.driver }),
        ...(input.emotionalPromise === undefined
          ? {}
          : { emotionalPromise: input.emotionalPromise }),
        ...(input.importance === undefined ? {} : { importance: input.importance }),
        kind: input.kind,
        ...(input.midEscalation === undefined ? {} : { midEscalation: input.midEscalation }),
        ...(input.narrativeRole === undefined ? {} : { narrativeRole: input.narrativeRole }),
        ...(input.payoffPlan === undefined ? {} : { payoffPlan: input.payoffPlan }),
        plotlineId: randomUUID(),
        priority: input.priority,
        projectId: input.projectId,
        ...(input.relatedCharacterIds === undefined
          ? {}
          : { relatedCharacterIds: input.relatedCharacterIds }),
        ...(input.relatedForeshadowingIds === undefined
          ? {}
          : { relatedForeshadowingIds: input.relatedForeshadowingIds }),
        ...(input.relatedStoryEventIds === undefined
          ? {}
          : { relatedStoryEventIds: input.relatedStoryEventIds }),
        ...(input.relatedWorldRuleIds === undefined
          ? {}
          : { relatedWorldRuleIds: input.relatedWorldRuleIds }),
        ...(input.startState === undefined ? {} : { startState: input.startState }),
        ...(input.status === undefined ? {} : { status: input.status }),
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

  async updatePlotline(input: UpdatePlotlineInput): Promise<PlotlineRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const patch = input.patch;
      const updateInput: MutableUpdatePlotlineRecordInput = {
        plotlineId: input.plotlineId,
        projectId: input.projectId,
      };

      applyTextPatch(updateInput, patch, "centralQuestion");
      applyTextPatch(updateInput, patch, "driver");
      applyTextPatch(updateInput, patch, "emotionalPromise");
      applyTextPatch(updateInput, patch, "importance");
      applyTextPatch(updateInput, patch, "kind");
      applyTextPatch(updateInput, patch, "midEscalation");
      applyTextPatch(updateInput, patch, "narrativeRole");
      applyTextPatch(updateInput, patch, "payoffPlan");
      applyNumberPatch(updateInput, patch, "priority");
      applyStringArrayPatch(updateInput, patch, "relatedCharacterIds");
      applyStringArrayPatch(updateInput, patch, "relatedForeshadowingIds");
      applyStringArrayPatch(updateInput, patch, "relatedStoryEventIds");
      applyStringArrayPatch(updateInput, patch, "relatedWorldRuleIds");
      applyTextPatch(updateInput, patch, "startState");
      applyTextPatch(updateInput, patch, "status");
      applyTextPatch(updateInput, patch, "summary");
      applyTextPatch(updateInput, patch, "title");

      const plotline = new PlotRepository(projectDatabase).updatePlotline(updateInput);

      new DomainEventRepository(projectDatabase).append({
        aggregateId: plotline.id,
        aggregateType: "plotline",
        eventId: randomUUID(),
        eventType: "plotline.updated",
        payload: {
          status: plotline.status,
          title: plotline.name,
        },
        projectId: input.projectId,
      });

      return plotline;
    } finally {
      projectDatabase.close();
    }
  }

  async createNode(input: CreatePlotlineNodeInput): Promise<PlotlineNodeRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const node = new PlotRepository(projectDatabase).createPlotlineNode({
        ...(input.chapterHint === undefined ? {} : { chapterHint: input.chapterHint }),
        ...(input.description === undefined ? {} : { description: input.description }),
        kind: input.kind,
        plotlineId: input.plotlineId,
        plotlineNodeId: randomUUID(),
        ...(input.position === undefined ? {} : { position: input.position }),
        projectId: input.projectId,
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.targetChapterId === undefined ? {} : { targetChapterId: input.targetChapterId }),
        title: input.title,
      });

      new DomainEventRepository(projectDatabase).append({
        aggregateId: node.id,
        aggregateType: "plotline_node",
        eventId: randomUUID(),
        eventType: "plotline_node.created",
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

  async updateNode(input: UpdatePlotlineNodeInput): Promise<unknown> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const description = getStringPatch(input.patch, "description");
      const chapterHint = getStringPatch(input.patch, "chapterHint");
      const kind = getStringPatch(input.patch, "kind");
      const status = getStringPatch(input.patch, "status");
      const targetChapterId = getStringPatch(input.patch, "targetChapterId");
      const title = getStringPatch(input.patch, "title");
      const position = getNumberPatch(input.patch, "position");
      const node = new PlotRepository(projectDatabase).updatePlotlineNode({
        plotlineNodeId: input.plotlineNodeId,
        projectId: input.projectId,
        ...(chapterHint === undefined ? {} : { chapterHint }),
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

function getTextPatch(patch: Record<string, unknown>, key: string): string | undefined {
  if (!Object.prototype.hasOwnProperty.call(patch, key)) {
    return undefined;
  }

  const value = patch[key];
  return typeof value === "string" ? value.trim() : undefined;
}

function applyTextPatch(
  input: MutableUpdatePlotlineRecordInput,
  patch: Record<string, unknown>,
  key: keyof MutableUpdatePlotlineRecordInput,
): void {
  const value = getTextPatch(patch, key);
  if (value !== undefined) {
    input[key] = value as never;
  }
}

function getNumberPatch(patch: Record<string, unknown>, key: string): number | undefined {
  const value = patch[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function applyNumberPatch(
  input: MutableUpdatePlotlineRecordInput,
  patch: Record<string, unknown>,
  key: keyof MutableUpdatePlotlineRecordInput,
): void {
  const value = getNumberPatch(patch, key);
  if (value !== undefined) {
    input[key] = value as never;
  }
}

function getStringArrayPatch(patch: Record<string, unknown>, key: string): string[] | undefined {
  if (!Object.prototype.hasOwnProperty.call(patch, key)) {
    return undefined;
  }

  const value = patch[key];
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function applyStringArrayPatch(
  input: MutableUpdatePlotlineRecordInput,
  patch: Record<string, unknown>,
  key: keyof MutableUpdatePlotlineRecordInput,
): void {
  const value = getStringArrayPatch(patch, key);
  if (value !== undefined) {
    input[key] = value as never;
  }
}
