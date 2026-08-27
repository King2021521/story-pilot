import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { DomainEventRepository, PlotRepository, type StoryEventRecord } from "@story-pilot/db";

import { ProjectStorageService } from "../storage/project-storage.service.js";

export interface CreateStoryEventInput {
  readonly projectId: string;
  readonly title: string;
  readonly description: string;
  readonly eventType: "decision" | "discovery" | "conflict" | "reveal" | "loss" | "victory" | "betrayal" | "travel" | "custom";
  readonly chapterId?: string;
  readonly sceneId?: string;
  readonly storyTime?: string;
  readonly participants?: readonly CreateStoryEventParticipantInput[];
}

export interface CreateStoryEventParticipantInput {
  readonly entityType: string;
  readonly entityId: string;
  readonly role: string;
}

@Injectable()
export class StoryEventService {
  constructor(private readonly projectStorage: ProjectStorageService) {}

  async createStoryEvent(input: CreateStoryEventInput): Promise<StoryEventRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const event = new PlotRepository(projectDatabase).createStoryEvent({
        description: input.description,
        eventId: randomUUID(),
        eventType: input.eventType,
        participants: (input.participants ?? []).map((participant) => ({
          entityId: participant.entityId,
          entityType: participant.entityType,
          participantId: randomUUID(),
          role: participant.role,
        })),
        projectId: input.projectId,
        title: input.title,
        ...(input.chapterId === undefined ? {} : { chapterId: input.chapterId }),
        ...(input.sceneId === undefined ? {} : { sceneId: input.sceneId }),
        ...(input.storyTime === undefined ? {} : { storyTime: input.storyTime }),
      });

      new DomainEventRepository(projectDatabase).append({
        aggregateId: event.id,
        aggregateType: "story_event",
        eventId: randomUUID(),
        eventType: "story_event.created",
        payload: {
          eventType: event.eventType,
          participants: event.participants.map((participant) => ({
            entityId: participant.entityId,
            entityType: participant.entityType,
            role: participant.role,
          })),
          summary: event.summary,
          title: event.title,
        },
        projectId: input.projectId,
      });

      return event;
    } finally {
      projectDatabase.close();
    }
  }

  async listStoryEvents(projectId: string): Promise<StoryEventRecord[]> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(projectId);
    try {
      return new PlotRepository(projectDatabase).listStoryEvents(projectId);
    } finally {
      projectDatabase.close();
    }
  }
}
