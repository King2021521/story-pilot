import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import type { CommandPayload } from "@story-pilot/contracts";
import {
  CharacterRepository,
  DomainEventRepository,
  type CharacterRecord,
  type CreateCharacterTraitInput,
  type EntityRelationRecord,
  type UpdateCharacterTraitInput,
} from "@story-pilot/db";

import { ProjectStorageService } from "../storage/project-storage.service.js";

export interface CreateCharacterInput {
  readonly projectId: string;
  readonly name: string;
  readonly role: "protagonist" | "antagonist" | "support" | "cameo";
  readonly archetype?: string;
  readonly genderAge?: string;
  readonly importance?: "core" | "major" | "minor" | "cameo";
  readonly firstAppearance?: string;
  readonly narrativeFunction?:
    | "viewpoint"
    | "driver"
    | "opposition"
    | "ally"
    | "mentor"
    | "foil"
    | "love_interest"
    | "comic_relief"
    | "information_source"
    | "custom";
  readonly storyTask?: string;
  readonly relationshipHook?: string;
  readonly goal?: string;
  readonly need?: string;
  readonly flaw?: string;
  readonly secret?: string;
  readonly voiceProfile?: string;
  readonly biography?: string;
  readonly appearance?: string;
  readonly arcStart?: string;
  readonly arcTurn?: string;
  readonly arcEnd?: string;
}

type EntityRelationStatus = CommandPayload<"entityRelation.create">["status"];

export interface ListEntityRelationsInput {
  readonly projectId: string;
  readonly entityType?: string;
  readonly entityId?: string;
  readonly status?: EntityRelationStatus;
}

export interface CreateEntityRelationInput {
  readonly projectId: string;
  readonly sourceEntityType: string;
  readonly sourceEntityId: string;
  readonly relationType: string;
  readonly targetEntityType: string;
  readonly targetEntityId: string;
  readonly description?: string;
  readonly polarity?: number;
  readonly strength?: number;
  readonly status?: EntityRelationStatus;
}

export type UpdateEntityRelationInput = CommandPayload<"entityRelation.update">;

export interface UpdateCharacterInput {
  readonly projectId: string;
  readonly characterId: string;
  readonly patch: Record<string, unknown>;
}

export type DeleteCharacterInput = CommandPayload<"character.delete">;

export interface GeneratedCharacterNames {
  readonly items: readonly {
    readonly name: string;
    readonly rationale: string;
  }[];
}

@Injectable()
export class CharacterService {
  constructor(private readonly projectStorage: ProjectStorageService) {}

  async createCharacter(input: CreateCharacterInput): Promise<CharacterRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const repository = new CharacterRepository(projectDatabase);
      const character = repository.createCharacter({
        characterId: randomUUID(),
        projectId: input.projectId,
        name: input.name,
        role: input.role,
        traits: buildCharacterTraits(input),
        ...(input.appearance === undefined ? {} : { appearance: input.appearance }),
        ...(input.arcEnd === undefined ? {} : { arcEnd: input.arcEnd }),
        ...(input.arcStart === undefined ? {} : { arcStart: input.arcStart }),
        ...(input.arcTurn === undefined ? {} : { arcTurn: input.arcTurn }),
        ...(input.archetype === undefined ? {} : { archetype: input.archetype }),
        ...(input.biography === undefined ? {} : { biography: input.biography }),
        ...(input.firstAppearance === undefined ? {} : { firstAppearance: input.firstAppearance }),
        ...(input.genderAge === undefined ? {} : { genderAge: input.genderAge }),
        ...(input.goal === undefined ? {} : { motivation: input.goal }),
        ...(input.importance === undefined ? {} : { importance: input.importance }),
        ...(input.narrativeFunction === undefined
          ? {}
          : { narrativeFunction: input.narrativeFunction }),
        ...(input.relationshipHook === undefined
          ? {}
          : { relationshipHook: input.relationshipHook }),
        ...(input.storyTask === undefined ? {} : { storyTask: input.storyTask }),
      });

      new DomainEventRepository(projectDatabase).append({
        aggregateId: character.id,
        aggregateType: "character",
        eventId: randomUUID(),
        eventType: "character.created",
        payload: {
          name: character.name,
          role: character.role,
          traitNames: character.traits.map((trait) => trait.name),
        },
        projectId: input.projectId,
      });

      return character;
    } finally {
      projectDatabase.close();
    }
  }

  async createRelation(input: CreateEntityRelationInput): Promise<EntityRelationRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const relation = new CharacterRepository(projectDatabase).createRelation({
        projectId: input.projectId,
        relationId: randomUUID(),
        relationType: input.relationType,
        sourceEntityId: input.sourceEntityId,
        sourceEntityType: input.sourceEntityType,
        targetEntityId: input.targetEntityId,
        targetEntityType: input.targetEntityType,
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.polarity === undefined ? {} : { polarity: input.polarity }),
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.strength === undefined ? {} : { strength: input.strength }),
      });

      new DomainEventRepository(projectDatabase).append({
        aggregateId: relation.id,
        aggregateType: "entity_relation",
        eventId: randomUUID(),
        eventType: "entity_relation.confirmed",
        payload: {
          description: relation.description,
          polarity: relation.polarity,
          relationType: relation.relationType,
          sourceEntityId: relation.sourceEntityId,
          sourceEntityType: relation.sourceEntityType,
          status: relation.status,
          strength: relation.strength,
          targetEntityId: relation.targetEntityId,
          targetEntityType: relation.targetEntityType,
        },
        projectId: input.projectId,
      });

      return relation;
    } finally {
      projectDatabase.close();
    }
  }

  async listRelations(input: ListEntityRelationsInput): Promise<EntityRelationRecord[]> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      return new CharacterRepository(projectDatabase).listRelations({
        projectId: input.projectId,
        ...(input.entityId === undefined ? {} : { entityId: input.entityId }),
        ...(input.entityType === undefined ? {} : { entityType: input.entityType }),
        ...(input.status === undefined ? {} : { status: input.status }),
      });
    } finally {
      projectDatabase.close();
    }
  }

  async updateRelation(input: UpdateEntityRelationInput): Promise<EntityRelationRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const relation = new CharacterRepository(projectDatabase).updateRelation({
        projectId: input.projectId,
        relationId: input.entityRelationId,
        ...(input.patch.description === undefined ? {} : { description: input.patch.description }),
        ...(input.patch.polarity === undefined ? {} : { polarity: input.patch.polarity }),
        ...(input.patch.relationType === undefined
          ? {}
          : { relationType: input.patch.relationType }),
        ...(input.patch.status === undefined ? {} : { status: input.patch.status }),
        ...(input.patch.strength === undefined ? {} : { strength: input.patch.strength }),
      });

      new DomainEventRepository(projectDatabase).append({
        aggregateId: relation.id,
        aggregateType: "entity_relation",
        eventId: randomUUID(),
        eventType: "entity_relation.updated",
        payload: {
          description: relation.description,
          polarity: relation.polarity,
          relationType: relation.relationType,
          status: relation.status,
          strength: relation.strength,
        },
        projectId: input.projectId,
      });

      return relation;
    } finally {
      projectDatabase.close();
    }
  }

  async listCharacters(projectId: string): Promise<CharacterRecord[]> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(projectId);
    try {
      return new CharacterRepository(projectDatabase).listCharacters(projectId);
    } finally {
      projectDatabase.close();
    }
  }

  async updateCharacter(input: UpdateCharacterInput): Promise<CharacterRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const repository = new CharacterRepository(projectDatabase);
      const appearance = getStringPatch(input.patch, "appearance");
      const arcEnd = getStringPatch(input.patch, "arcEnd");
      const arcStart = getStringPatch(input.patch, "arcStart");
      const arcTurn = getStringPatch(input.patch, "arcTurn");
      const archetype = getStringPatch(input.patch, "archetype");
      const biography = getStringPatch(input.patch, "biography");
      const firstAppearance = getStringPatch(input.patch, "firstAppearance");
      const flaw = getStringPatch(input.patch, "flaw");
      const genderAge = getStringPatch(input.patch, "genderAge");
      const goal = getStringPatch(input.patch, "goal");
      const importance = getStringPatch(input.patch, "importance");
      const name = getStringPatch(input.patch, "name");
      const narrativeFunction = getStringPatch(input.patch, "narrativeFunction");
      const need = getStringPatch(input.patch, "need");
      const relationshipHook = getStringPatch(input.patch, "relationshipHook");
      const role = getStringPatch(input.patch, "role");
      const secret = getStringPatch(input.patch, "secret");
      const storyTask = getStringPatch(input.patch, "storyTask");
      const voiceProfile = getStringPatch(input.patch, "voiceProfile");
      const character = repository.updateCharacter({
        characterId: input.characterId,
        projectId: input.projectId,
        traits: buildCharacterPatchTraits({ flaw, goal, need, secret, voiceProfile }),
        ...(appearance === undefined ? {} : { appearance }),
        ...(arcEnd === undefined ? {} : { arcEnd }),
        ...(arcStart === undefined ? {} : { arcStart }),
        ...(arcTurn === undefined ? {} : { arcTurn }),
        ...(archetype === undefined ? {} : { archetype }),
        ...(biography === undefined ? {} : { biography }),
        ...(firstAppearance === undefined ? {} : { firstAppearance }),
        ...(genderAge === undefined ? {} : { genderAge }),
        ...(goal === undefined ? {} : { motivation: goal }),
        ...(importance === undefined ? {} : { importance }),
        ...(name === undefined ? {} : { name }),
        ...(narrativeFunction === undefined ? {} : { narrativeFunction }),
        ...(relationshipHook === undefined ? {} : { relationshipHook }),
        ...(role === undefined ? {} : { role }),
        ...(storyTask === undefined ? {} : { storyTask }),
      });

      new DomainEventRepository(projectDatabase).append({
        aggregateId: character.id,
        aggregateType: "character",
        eventId: randomUUID(),
        eventType: "character.updated",
        payload: {
          name: character.name,
          role: character.role,
        },
        projectId: input.projectId,
      });

      return character;
    } finally {
      projectDatabase.close();
    }
  }

  async deleteCharacter(input: DeleteCharacterInput): Promise<{ readonly characterId: string }> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const repository = new CharacterRepository(projectDatabase);
      const character = repository.getCharacter(input.projectId, input.characterId);
      repository.deleteCharacter({
        characterId: input.characterId,
        projectId: input.projectId,
      });

      new DomainEventRepository(projectDatabase).append({
        aggregateId: input.characterId,
        aggregateType: "character",
        eventId: randomUUID(),
        eventType: "character.deleted",
        payload: {
          name: character?.name ?? null,
          role: character?.role ?? null,
        },
        projectId: input.projectId,
      });

      return { characterId: input.characterId };
    } finally {
      projectDatabase.close();
    }
  }

  generateNames(input: {
    readonly count: number;
    readonly style?: string;
    readonly constraints: readonly string[];
  }): GeneratedCharacterNames {
    const familyNames = ["林", "顾", "沈", "陆", "江", "程", "许", "闻", "秦", "宋"];
    const givenNames = ["鸢", "澈", "晏", "疏", "衡", "砚", "微", "宁", "舟", "栀"];
    const style = input.style?.trim() || "通用";
    const constraintHint =
      input.constraints.length > 0 ? input.constraints.join("、") : "符合人物定位";

    return {
      items: Array.from({ length: input.count }, (_, index) => {
        const name = `${familyNames[index % familyNames.length]}${givenNames[(index * 3) % givenNames.length]}`;
        return {
          name,
          rationale: `${style}风格，${constraintHint}`,
        };
      }),
    };
  }
}

function buildCharacterTraits(input: CreateCharacterInput): CreateCharacterTraitInput[] {
  const traits: CreateCharacterTraitInput[] = [];

  if (input.goal !== undefined) {
    traits.push({ traitId: randomUUID(), name: "goal", value: input.goal });
  }
  if (input.need !== undefined) {
    traits.push({ traitId: randomUUID(), name: "need", value: input.need });
  }
  if (input.flaw !== undefined) {
    traits.push({ traitId: randomUUID(), name: "flaw", value: input.flaw });
  }
  if (input.secret !== undefined) {
    traits.push({ traitId: randomUUID(), name: "secret", value: input.secret });
  }
  if (input.voiceProfile !== undefined) {
    traits.push({ traitId: randomUUID(), name: "voice_profile", value: input.voiceProfile });
  }

  return traits;
}

function buildCharacterPatchTraits(input: {
  readonly flaw: string | undefined;
  readonly goal: string | undefined;
  readonly need: string | undefined;
  readonly secret: string | undefined;
  readonly voiceProfile: string | undefined;
}): UpdateCharacterTraitInput[] {
  const traits: UpdateCharacterTraitInput[] = [];

  if (input.goal !== undefined) {
    traits.push({ traitId: randomUUID(), name: "goal", value: input.goal });
  }
  if (input.need !== undefined) {
    traits.push({ traitId: randomUUID(), name: "need", value: input.need });
  }
  if (input.flaw !== undefined) {
    traits.push({ traitId: randomUUID(), name: "flaw", value: input.flaw });
  }
  if (input.secret !== undefined) {
    traits.push({ traitId: randomUUID(), name: "secret", value: input.secret });
  }
  if (input.voiceProfile !== undefined) {
    traits.push({ traitId: randomUUID(), name: "voice_profile", value: input.voiceProfile });
  }

  return traits;
}

function getStringPatch(patch: Record<string, unknown>, key: string): string | undefined {
  const value = patch[key];
  return typeof value === "string" ? value.trim() : undefined;
}
