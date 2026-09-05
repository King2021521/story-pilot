import { randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import type { ModelGateway } from "@story-pilot/ai";
import {
  buildPromptTemplateMessages,
  ElementCandidateOutputSchema,
  type ElementCandidateOutput,
  type ElementCandidateType,
} from "@story-pilot/ai";
import type { CommandPayload } from "@story-pilot/contracts";
import {
  CharacterRepository,
  CreativePathRepository,
  DomainEventRepository,
  type ProjectDatabase,
  ProjectRepository,
  type ProjectOverviewRecord,
  WorldbuildingRepository,
  WorldRepository,
  type WorldRuleRecord,
} from "@story-pilot/db";

import { MODEL_GATEWAY } from "../ai/model-gateway.provider.js";
import { ProjectStorageService } from "../storage/project-storage.service.js";

export type GenerateElementCandidatesInput = CommandPayload<"element.generateCandidates">;
export type AcceptElementCandidatesInput = CommandPayload<"element.acceptCandidates">;

export interface AcceptedElement {
  readonly id: string;
  readonly name: string;
  readonly type: ElementCandidateType;
  readonly target: "character" | "location" | "organization" | "item";
}

export interface AcceptElementCandidatesResult {
  readonly accepted: readonly AcceptedElement[];
}

@Injectable()
export class ElementCandidateService {
  constructor(
    private readonly projectStorage: ProjectStorageService,
    @Inject(MODEL_GATEWAY) private readonly modelGateway: ModelGateway,
  ) {}

  async generateCandidates(input: GenerateElementCandidatesInput): Promise<ElementCandidateOutput> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const project = new ProjectRepository(projectDatabase).getOverview(input.projectId);
      if (!project) {
        throw new Error(`PROJECT_NOT_FOUND: ${input.projectId}`);
      }

      const worldRepository = new WorldRepository(projectDatabase);
      const worldRules = input.worldRuleIds
        .map((worldRuleId) => worldRepository.getWorldRule(input.projectId, worldRuleId))
        .filter((rule): rule is WorldRuleRecord => rule !== undefined);
      const genre = input.genre?.trim() || project.genre;
      const style = input.style?.trim() || project.style || "通用";
      const messages = buildPromptTemplateMessages({
        templateId: "element-candidate.generate",
        variables: buildElementGenerationVariables({
          count: input.count,
          constraints: input.constraints,
          description: input.description,
          elementType: input.elementType,
          genre,
          project,
          projectDatabase,
          style,
          worldRules,
        }),
        instruction: `生成 ${input.count} 个可供用户选择的「${input.elementType}」候选。候选不得直接写入正式设定。`,
      });

      const generated = await this.modelGateway.generateObject({
        messages,
        promptVersion: "element-candidate.generate@v1",
        purpose: "element_generate",
        schema: ElementCandidateOutputSchema,
        schemaName: "ElementCandidateOutput",
        temperature: 0.8,
      });

      return {
        items: normalizeGeneratedCandidates({
          count: input.count,
          elementType: input.elementType,
          genre,
          items: generated.object.items,
          style,
        }),
      };
    } finally {
      projectDatabase.close();
    }
  }

  async acceptCandidates(
    input: AcceptElementCandidatesInput,
  ): Promise<AcceptElementCandidatesResult> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const project = new ProjectRepository(projectDatabase).getOverview(input.projectId);
      if (!project) {
        throw new Error(`PROJECT_NOT_FOUND: ${input.projectId}`);
      }

      const characterRepository = new CharacterRepository(projectDatabase);
      const domainEventRepository = new DomainEventRepository(projectDatabase);
      const worldRepository = new WorldRepository(projectDatabase);
      const acceptBatch = projectDatabase.client.transaction(() => {
        const accepted: AcceptedElement[] = [];

        for (const candidate of input.items) {
          const description = getCandidateDescription(candidate);
          if (candidate.type === "character_name") {
            const character = characterRepository.createCharacter({
              characterId: randomUUID(),
              name: candidate.name,
              projectId: input.projectId,
              role: "support",
              traits: [],
              ...(description === undefined ? {} : { biography: description }),
            });
            domainEventRepository.append({
              aggregateId: character.id,
              aggregateType: "character",
              eventId: randomUUID(),
              eventType: "character.created",
              payload: buildCandidateEventPayload(candidate, { role: character.role }),
              projectId: input.projectId,
            });
            accepted.push({
              id: character.id,
              name: character.name,
              target: "character",
              type: candidate.type,
            });
            continue;
          }

          if (
            candidate.type === "city" ||
            candidate.type === "location" ||
            candidate.type === "place_name"
          ) {
            const location = worldRepository.createLocation({
              locationId: randomUUID(),
              name: candidate.name,
              projectId: input.projectId,
              type: mapLocationType(candidate.type),
              ...(description === undefined ? {} : { description }),
            });
            domainEventRepository.append({
              aggregateId: location.id,
              aggregateType: "location",
              eventId: randomUUID(),
              eventType: "location.created",
              payload: buildCandidateEventPayload(candidate, { type: location.type }),
              projectId: input.projectId,
            });
            accepted.push({
              id: location.id,
              name: location.name,
              target: "location",
              type: candidate.type,
            });
            continue;
          }

          if (isOrganizationCandidateType(candidate.type)) {
            const organization = worldRepository.createOrganization({
              name: candidate.name,
              organizationId: randomUUID(),
              projectId: input.projectId,
              type: candidate.type,
              ...(description === undefined ? {} : { description }),
            });
            domainEventRepository.append({
              aggregateId: organization.id,
              aggregateType: "organization",
              eventId: randomUUID(),
              eventType: "organization.created",
              payload: buildCandidateEventPayload(candidate, { type: organization.type }),
              projectId: input.projectId,
            });
            accepted.push({
              id: organization.id,
              name: organization.name,
              target: "organization",
              type: candidate.type,
            });
            continue;
          }

          const item = worldRepository.createItem({
            itemId: randomUUID(),
            name: candidate.name,
            projectId: input.projectId,
            type: candidate.type,
            ...(description === undefined ? {} : { description }),
          });
          domainEventRepository.append({
            aggregateId: item.id,
            aggregateType: "item",
            eventId: randomUUID(),
            eventType: "item.created",
            payload: buildCandidateEventPayload(candidate, { type: item.type }),
            projectId: input.projectId,
          });
          accepted.push({
            id: item.id,
            name: item.name,
            target: "item",
            type: candidate.type,
          });
        }

        return accepted;
      });

      return { accepted: acceptBatch() };
    } finally {
      projectDatabase.close();
    }
  }
}

function buildElementGenerationVariables(input: {
  readonly project: ProjectOverviewRecord;
  readonly genre: string;
  readonly style: string;
  readonly elementType: ElementCandidateType;
  readonly count: number;
  readonly description?: string | undefined;
  readonly worldRules: readonly WorldRuleRecord[];
  readonly constraints: readonly string[];
  readonly projectDatabase: ProjectDatabase;
}): Record<string, unknown> {
  const pathRepository = new CreativePathRepository(input.projectDatabase);
  const worldbuildingProfile = new WorldbuildingRepository(input.projectDatabase).getProfile(
    input.project.id,
  );
  const blueprint = pathRepository.getActiveBlueprint(input.project.id);
  const brief =
    pathRepository.getLatestBrief(input.project.id) ??
    ({
      genre: input.genre,
      style: input.style,
      title: input.project.title,
    } as const);

  return {
    project: buildProjectPromptVariable({
      project: input.project,
      style: input.style,
    }),
    brief,
    generationRequest: {
      constraints: input.constraints,
      count: input.count,
      description: input.description?.trim() ?? "",
      elementType: input.elementType,
      genre: input.genre,
      style: input.style,
      worldRuleIds: input.worldRules.map((rule) => rule.id),
    },
    blueprint,
    worldbuildingProfile: worldbuildingProfile?.fields ?? null,
    existingCanon: {
      selectedWorldRules: input.worldRules.map((rule) => ({
        category: rule.category,
        content: rule.content,
        id: rule.id,
        source: rule.source,
        title: rule.title,
      })),
    },
    userInstruction: input.description?.trim() ?? null,
  };
}

function buildProjectPromptVariable(input: {
  readonly project: ProjectOverviewRecord;
  readonly style: string;
}): Record<string, unknown> {
  return {
    genre: input.project.genre,
    id: input.project.id,
    status: input.project.status,
    style: input.style,
    title: input.project.title,
  };
}

function normalizeGeneratedCandidates(input: {
  readonly count: number;
  readonly elementType: ElementCandidateType;
  readonly genre: string;
  readonly items: ElementCandidateOutput["items"];
  readonly style: string;
}): ElementCandidateOutput["items"] {
  const items = input.items.filter((item) => item.type === input.elementType).slice(0, input.count);
  const usedNames = new Set(items.map((item) => item.name));
  let nextIndex = 0;

  while (items.length < input.count) {
    const candidate = buildFallbackCandidate({
      elementType: input.elementType,
      genre: input.genre,
      index: nextIndex,
      style: input.style,
    });
    nextIndex += 1;
    if (usedNames.has(candidate.name)) {
      continue;
    }
    usedNames.add(candidate.name);
    items.push(candidate);
  }

  return items;
}

const fallbackCandidateNames = {
  character_name: ["沈逐星", "陆照寒", "云惊澜", "闻楚砚", "秦问潮"],
  city: ["照潮城", "玄烛城", "望星城", "玉衡城", "断海城"],
  faction: ["白线同盟", "炉火商会", "雪脊联防会", "黑温票号", "北墙议事团"],
  item: ["月魄铜铃", "旧星罗盘", "潮汐玉符", "玄铁残页", "归墟灯芯"],
  location: ["落星台", "潮声渡", "玄烛塔", "问剑崖", "沉月港"],
  organization: ["司星阁", "潮生盟", "玄衡院", "烛夜司", "断海楼"],
  place_name: ["星回原", "照潮湾", "无烬岭", "月沉泽", "归墟渡"],
  sect: ["玄霜门", "寒炉宗", "封雪观", "听冰阁", "北辰门"],
  technique: ["星潮九转", "玄烛观心诀", "断海归元功", "月魄凝锋诀", "潮声炼骨法"],
  weapon: ["潮汐断星刃", "破晓玄枪", "月魄长弓", "烛夜环刀", "断海重剑"],
} as const satisfies Record<ElementCandidateType, readonly string[]>;

function buildFallbackCandidate(input: {
  readonly elementType: ElementCandidateType;
  readonly genre: string;
  readonly index: number;
  readonly style: string;
}): ElementCandidateOutput["items"][number] {
  const names = fallbackCandidateNames[input.elementType];
  const cycle = Math.floor(input.index / names.length);
  const baseName =
    names[input.index % names.length] ?? `${getCandidateTypeLabel(input.elementType)}候选`;
  const name = cycle === 0 ? baseName : `${baseName}${cycle + 1}`;

  return {
    description: `${input.genre}${input.style}风格下可直接纳入设定库的${getCandidateTypeLabel(input.elementType)}候选。`,
    name,
    rationale: `用于补足本轮候选数量，并保持类型为${input.elementType}。`,
    tags: [getCandidateTypeLabel(input.elementType), input.genre, input.style],
    type: input.elementType,
  };
}

function getCandidateTypeLabel(type: ElementCandidateType): string {
  switch (type) {
    case "character_name":
      return "人物名称";
    case "city":
      return "城市";
    case "location":
      return "地点";
    case "organization":
      return "组织";
    case "faction":
      return "势力";
    case "sect":
      return "门派";
    case "weapon":
      return "武器";
    case "technique":
      return "功法";
    case "item":
      return "道具";
    case "place_name":
      return "地名";
  }
}

function getCandidateDescription(candidate: {
  readonly description?: string | undefined;
  readonly rationale?: string | undefined;
}): string | undefined {
  const description = candidate.description?.trim();
  if (description) {
    return description;
  }

  const rationale = candidate.rationale?.trim();
  return rationale || undefined;
}

function mapLocationType(type: ElementCandidateType): string {
  if (type === "city") {
    return "city";
  }
  if (type === "location") {
    return "location";
  }
  return "place";
}

function isOrganizationCandidateType(type: ElementCandidateType): boolean {
  return type === "organization" || type === "faction" || type === "sect";
}

function buildCandidateEventPayload(
  candidate: {
    readonly description?: string | undefined;
    readonly name: string;
    readonly rationale?: string | undefined;
    readonly tags: readonly string[];
  },
  extra: Record<string, unknown>,
): Record<string, unknown> {
  return {
    description: candidate.description,
    name: candidate.name,
    rationale: candidate.rationale,
    source: "element_candidate",
    tags: candidate.tags,
    ...extra,
  };
}
