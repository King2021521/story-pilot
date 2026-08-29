import { createHash, randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import {
  buildPromptMessages,
  type ModelGateway,
  WorldbuildingFieldCompletionOutputSchema,
  type WorldbuildingFieldCompletionOutput,
} from "@story-pilot/ai";
import type { CommandPayload } from "@story-pilot/contracts";
import {
  CreativePathRepository,
  DomainEventRepository,
  ModelCallRepository,
  ProjectRepository,
  type ProjectOverviewRecord,
  WorldbuildingRepository,
  type WorldbuildingProfileRecord,
  WorldRepository,
  type WorldbuildingFields,
} from "@story-pilot/db";

import { MODEL_GATEWAY } from "../ai/model-gateway.provider.js";
import { ProjectStorageService } from "../storage/project-storage.service.js";

export type SaveWorldbuildingFieldsInput = CommandPayload<"worldbuilding.saveFields">;
export type CompleteWorldbuildingFieldsInput = CommandPayload<"worldbuilding.completeFields">;

const WORLDBUILDING_COMPLETION_TEMPERATURE = 0.65;

@Injectable()
export class WorldbuildingService {
  constructor(
    private readonly projectStorage: ProjectStorageService,
    @Inject(MODEL_GATEWAY) private readonly modelGateway: ModelGateway,
  ) {}

  async saveFields(input: SaveWorldbuildingFieldsInput): Promise<WorldbuildingProfileRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const project = new ProjectRepository(projectDatabase).getOverview(input.projectId);
      if (!project) {
        throw new Error(`PROJECT_NOT_FOUND: ${input.projectId}`);
      }

      const now = Date.now();
      const save = projectDatabase.client.transaction(() => {
        const profile = new WorldbuildingRepository(projectDatabase).saveProfile({
          fields: input.fields,
          projectId: input.projectId,
          now,
        });
        new DomainEventRepository(projectDatabase).append({
          aggregateId: input.projectId,
          aggregateType: "worldbuilding_profile",
          eventId: randomUUID(),
          eventType: "worldbuilding_profile.saved",
          payload: {
            filledFieldCount: Object.values(profile.fields).filter((value) => value.length > 0)
              .length,
          },
          projectId: input.projectId,
          now,
        });

        return profile;
      });

      return save();
    } finally {
      projectDatabase.close();
    }
  }

  async completeFields(
    input: CompleteWorldbuildingFieldsInput,
  ): Promise<WorldbuildingFieldCompletionOutput> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const project = new ProjectRepository(projectDatabase).getOverview(input.projectId);
      if (!project) {
        throw new Error(`PROJECT_NOT_FOUND: ${input.projectId}`);
      }

      const creativePathRepository = new CreativePathRepository(projectDatabase);
      const profile = new WorldbuildingRepository(projectDatabase).getProfile(input.projectId);
      const context = buildWorldbuildingCompletionContext({
        currentFields: input.fields,
        profile,
        project,
        repository: new WorldRepository(projectDatabase),
        pathRepository: creativePathRepository,
      });
      const messages = buildPromptMessages({
        capability: "worldbuilding_generate",
        context,
        instruction:
          "基于动态上下文补全 12 个世界观表单字段。保留用户已填写内容的核心含义，返回可直接填入表单的 JSON。",
        version: "v1",
      });
      const modelResult = await this.modelGateway.generateObject({
        messages,
        promptVersion: "worldbuilding-form.v1",
        purpose: "worldbuilding_generate",
        schema: WorldbuildingFieldCompletionOutputSchema,
        schemaName: "WorldbuildingFieldCompletionOutput",
        temperature: WORLDBUILDING_COMPLETION_TEMPERATURE,
      });
      const now = Date.now();
      new ModelCallRepository(projectDatabase).create({
        latencyMs: modelResult.modelCall.latencyMs,
        model: modelResult.modelCall.model,
        modelCallId: randomUUID(),
        projectId: input.projectId,
        provider: modelResult.modelCall.provider,
        purpose: modelResult.modelCall.purpose,
        request: {
          inputHash: hashWorldbuildingInput(input.fields),
          messages,
          schemaName: "WorldbuildingFieldCompletionOutput",
          temperature: WORLDBUILDING_COMPLETION_TEMPERATURE,
        },
        response: modelResult.raw,
        status: modelResult.modelCall.status,
        promptVersion: modelResult.modelCall.promptVersion ?? "worldbuilding-form.v1",
        ...(modelResult.modelCall.usage === undefined
          ? {}
          : { usage: modelResult.modelCall.usage }),
        now,
      });

      return modelResult.object;
    } finally {
      projectDatabase.close();
    }
  }
}

function buildWorldbuildingCompletionContext(input: {
  readonly currentFields: WorldbuildingFields;
  readonly pathRepository: CreativePathRepository;
  readonly profile: WorldbuildingProfileRecord | null;
  readonly project: ProjectOverviewRecord;
  readonly repository: WorldRepository;
}): string {
  const projectId = input.project.id;
  const brief = input.pathRepository.getLatestBrief(projectId);
  const blueprint = input.pathRepository.getActiveBlueprint(projectId);

  return JSON.stringify(
    {
      project: {
        genre: input.project.genre,
        style: input.project.style,
        title: input.project.title,
      },
      brief,
      blueprint,
      currentFields: input.currentFields,
      savedProfile: input.profile?.fields ?? null,
      existingCanon: {
        items: input.repository.listItems(projectId).map((item) => ({
          description: item.description,
          name: item.name,
          type: item.type,
        })),
        locations: input.repository.listLocations(projectId).map((location) => ({
          description: location.description,
          name: location.name,
          type: location.type,
        })),
        organizations: input.repository.listOrganizations(projectId).map((organization) => ({
          description: organization.description,
          name: organization.name,
          type: organization.type,
        })),
        worldRules: input.repository.listWorldRules(projectId).map((rule) => ({
          category: rule.category,
          content: rule.content,
          source: rule.source,
          title: rule.title,
        })),
      },
    },
    null,
    2,
  );
}

function hashWorldbuildingInput(fields: WorldbuildingFields): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(fields)).digest("hex")}`;
}
