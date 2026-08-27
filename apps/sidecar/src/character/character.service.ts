import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import {
  CharacterRepository,
  DomainEventRepository,
  type CharacterRecord,
  type CreateCharacterTraitInput,
  type EntityRelationRecord,
} from "@story-pilot/db";

import { ProjectStorageService } from "../storage/project-storage.service.js";

export interface CreateCharacterInput {
  readonly projectId: string;
  readonly name: string;
  readonly role: "protagonist" | "antagonist" | "support" | "cameo";
  readonly archetype?: string;
  readonly goal?: string;
  readonly need?: string;
  readonly flaw?: string;
  readonly secret?: string;
  readonly voiceProfile?: string;
  readonly biography?: string;
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
        ...(input.archetype === undefined ? {} : { archetype: input.archetype }),
        ...(input.biography === undefined ? {} : { biography: input.biography }),
        ...(input.goal === undefined ? {} : { motivation: input.goal }),
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
        ...(input.strength === undefined ? {} : { strength: input.strength }),
      });

      new DomainEventRepository(projectDatabase).append({
        aggregateId: relation.id,
        aggregateType: "entity_relation",
        eventId: randomUUID(),
        eventType: "entity_relation.confirmed",
        payload: {
          relationType: relation.relationType,
          sourceEntityId: relation.sourceEntityId,
          targetEntityId: relation.targetEntityId,
        },
        projectId: input.projectId,
      });

      return relation;
    } finally {
      projectDatabase.close();
    }
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
