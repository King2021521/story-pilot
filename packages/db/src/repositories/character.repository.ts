import type { ProjectDatabase } from "../project-database.js";

export interface CharacterTraitRecord {
  readonly id: string;
  readonly projectId: string;
  readonly characterId: string;
  readonly name: string;
  readonly value: string;
  readonly evidence: string | null;
  readonly confidence: number;
}

export interface CharacterRecord {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly role: string;
  readonly archetype: string | null;
  readonly genderAge: string | null;
  readonly importance: string | null;
  readonly firstAppearance: string | null;
  readonly narrativeFunction: string | null;
  readonly storyTask: string | null;
  readonly relationshipHook: string | null;
  readonly profile: string | null;
  readonly appearance: string | null;
  readonly arcStart: string | null;
  readonly arcTurn: string | null;
  readonly arcEnd: string | null;
  readonly motivation: string | null;
  readonly traits: CharacterTraitRecord[];
}

export interface EntityRelationRecord {
  readonly id: string;
  readonly projectId: string;
  readonly sourceEntityType: string;
  readonly sourceEntityId: string;
  readonly relationType: string;
  readonly targetEntityType: string;
  readonly targetEntityId: string;
  readonly description: string | null;
  readonly polarity: number;
  readonly strength: number;
  readonly status: string;
}

export interface CreateCharacterRecordInput {
  readonly characterId: string;
  readonly projectId: string;
  readonly name: string;
  readonly role: string;
  readonly archetype?: string;
  readonly genderAge?: string;
  readonly importance?: string;
  readonly firstAppearance?: string;
  readonly narrativeFunction?: string;
  readonly storyTask?: string;
  readonly relationshipHook?: string;
  readonly biography?: string;
  readonly appearance?: string;
  readonly arcStart?: string;
  readonly arcTurn?: string;
  readonly arcEnd?: string;
  readonly motivation?: string;
  readonly traits: readonly CreateCharacterTraitInput[];
  readonly now?: number;
}

export interface CreateCharacterTraitInput {
  readonly traitId: string;
  readonly name: string;
  readonly value: string;
}

export interface UpdateCharacterTraitInput {
  readonly traitId: string;
  readonly name: string;
  readonly value: string;
}

export interface CreateEntityRelationRecordInput {
  readonly relationId: string;
  readonly projectId: string;
  readonly sourceEntityType: string;
  readonly sourceEntityId: string;
  readonly relationType: string;
  readonly targetEntityType: string;
  readonly targetEntityId: string;
  readonly description?: string;
  readonly polarity?: number;
  readonly strength?: number;
  readonly now?: number;
}

export interface UpdateCharacterRecordInput {
  readonly projectId: string;
  readonly characterId: string;
  readonly name?: string;
  readonly role?: string;
  readonly archetype?: string;
  readonly genderAge?: string;
  readonly importance?: string;
  readonly firstAppearance?: string;
  readonly narrativeFunction?: string;
  readonly storyTask?: string;
  readonly relationshipHook?: string;
  readonly biography?: string;
  readonly appearance?: string;
  readonly arcStart?: string;
  readonly arcTurn?: string;
  readonly arcEnd?: string;
  readonly motivation?: string;
  readonly traits?: readonly UpdateCharacterTraitInput[];
  readonly now?: number;
}

interface CharacterRow {
  readonly id: string;
  readonly project_id: string;
  readonly display_name: string;
  readonly role: string;
  readonly archetype: string | null;
  readonly gender_age: string | null;
  readonly importance: string | null;
  readonly first_appearance: string | null;
  readonly narrative_function: string | null;
  readonly story_task: string | null;
  readonly relationship_hook: string | null;
  readonly profile: string | null;
  readonly appearance: string | null;
  readonly arc_start: string | null;
  readonly arc_turn: string | null;
  readonly arc_end: string | null;
  readonly motivation: string | null;
}

interface CharacterTraitRow {
  readonly id: string;
  readonly project_id: string;
  readonly character_id: string;
  readonly name: string;
  readonly value: string;
  readonly evidence: string | null;
  readonly confidence: number;
}

interface EntityRelationRow {
  readonly id: string;
  readonly project_id: string;
  readonly source_entity_type: string;
  readonly source_entity_id: string;
  readonly relation_type: string;
  readonly target_entity_type: string;
  readonly target_entity_id: string;
  readonly description: string | null;
  readonly polarity: number;
  readonly strength: number;
  readonly status: string;
}

export class CharacterRepository {
  constructor(private readonly projectDatabase: ProjectDatabase) {}

  createCharacter(input: CreateCharacterRecordInput): CharacterRecord {
    const now = input.now ?? Date.now();
    const create = this.projectDatabase.client.transaction(() => {
      this.projectDatabase.client
        .prepare(
          `
          insert into characters (
            id, project_id, display_name, role, archetype, gender_age, importance,
            first_appearance, narrative_function, story_task, relationship_hook,
            profile, appearance, arc_start, arc_turn, arc_end, motivation,
            created_at, updated_at
          )
          values (
            @characterId, @projectId, @name, @role, @archetype, @genderAge, @importance,
            @firstAppearance, @narrativeFunction, @storyTask, @relationshipHook,
            @profile, @appearance, @arcStart, @arcTurn, @arcEnd, @motivation,
            @now, @now
          )
        `,
        )
        .run({
          appearance: input.appearance ?? null,
          arcEnd: input.arcEnd ?? null,
          arcStart: input.arcStart ?? null,
          arcTurn: input.arcTurn ?? null,
          archetype: input.archetype ?? null,
          characterId: input.characterId,
          firstAppearance: input.firstAppearance ?? null,
          genderAge: input.genderAge ?? null,
          importance: input.importance ?? null,
          motivation: input.motivation ?? null,
          name: input.name,
          narrativeFunction: input.narrativeFunction ?? null,
          now,
          profile: input.biography ?? null,
          projectId: input.projectId,
          relationshipHook: input.relationshipHook ?? null,
          role: input.role,
          storyTask: input.storyTask ?? null,
        });

      for (const trait of input.traits) {
        this.projectDatabase.client
          .prepare(
            `
            insert into character_traits (
              id, project_id, character_id, name, value, confidence, created_at, updated_at
            )
            values (
              @traitId, @projectId, @characterId, @name, @value, 1, @now, @now
            )
          `,
          )
          .run({
            characterId: input.characterId,
            name: trait.name,
            now,
            projectId: input.projectId,
            traitId: trait.traitId,
            value: trait.value,
          });
      }
    });

    create();

    const character = this.getCharacter(input.projectId, input.characterId);
    if (!character) {
      throw new Error(`CHARACTER_NOT_CREATED: ${input.characterId}`);
    }

    return character;
  }

  createRelation(input: CreateEntityRelationRecordInput): EntityRelationRecord {
    const now = input.now ?? Date.now();
    this.projectDatabase.client
      .prepare(
        `
        insert into entity_relations (
          id, project_id, source_entity_type, source_entity_id, relation_type,
          target_entity_type, target_entity_id, description, polarity, strength,
          status, created_at, updated_at
        )
        values (
          @relationId, @projectId, @sourceEntityType, @sourceEntityId, @relationType,
          @targetEntityType, @targetEntityId, @description, @polarity, @strength,
          'confirmed', @now, @now
        )
      `,
      )
      .run({
        description: input.description ?? null,
        now,
        polarity: input.polarity ?? 0,
        projectId: input.projectId,
        relationId: input.relationId,
        relationType: input.relationType,
        sourceEntityId: input.sourceEntityId,
        sourceEntityType: input.sourceEntityType,
        strength: input.strength ?? 0.5,
        targetEntityId: input.targetEntityId,
        targetEntityType: input.targetEntityType,
      });

    const relation = this.projectDatabase.client
      .prepare("select * from entity_relations where project_id = ? and id = ?")
      .get(input.projectId, input.relationId) as EntityRelationRow | undefined;

    if (!relation) {
      throw new Error(`ENTITY_RELATION_NOT_CREATED: ${input.relationId}`);
    }

    return mapRelationRow(relation);
  }

  getCharacter(projectId: string, characterId: string): CharacterRecord | undefined {
    const row = this.projectDatabase.client
      .prepare("select * from characters where project_id = ? and id = ?")
      .get(projectId, characterId) as CharacterRow | undefined;

    if (!row) {
      return undefined;
    }

    const traits = this.projectDatabase.client
      .prepare(
        "select * from character_traits where project_id = ? and character_id = ? order by created_at asc",
      )
      .all(projectId, characterId)
      .map((trait) => mapTraitRow(trait as CharacterTraitRow));

    return {
      appearance: row.appearance,
      arcEnd: row.arc_end,
      arcStart: row.arc_start,
      arcTurn: row.arc_turn,
      archetype: row.archetype,
      firstAppearance: row.first_appearance,
      genderAge: row.gender_age,
      id: row.id,
      importance: row.importance,
      motivation: row.motivation,
      name: row.display_name,
      narrativeFunction: row.narrative_function,
      profile: row.profile,
      projectId: row.project_id,
      relationshipHook: row.relationship_hook,
      role: row.role,
      storyTask: row.story_task,
      traits,
    };
  }

  listCharacters(projectId: string): CharacterRecord[] {
    return this.projectDatabase.client
      .prepare("select * from characters where project_id = ? order by display_name asc")
      .all(projectId)
      .map((row) =>
        mapCharacterRow(row as CharacterRow, this.listTraits(projectId, (row as CharacterRow).id)),
      );
  }

  updateCharacter(input: UpdateCharacterRecordInput): CharacterRecord {
    const now = input.now ?? Date.now();
    const update = this.projectDatabase.client.transaction(() => {
      this.projectDatabase.client
        .prepare(
          `
          update characters
          set display_name = coalesce(@name, display_name),
              role = coalesce(@role, role),
              archetype = coalesce(@archetype, archetype),
              gender_age = coalesce(@genderAge, gender_age),
              importance = coalesce(@importance, importance),
              first_appearance = coalesce(@firstAppearance, first_appearance),
              narrative_function = coalesce(@narrativeFunction, narrative_function),
              story_task = coalesce(@storyTask, story_task),
              relationship_hook = coalesce(@relationshipHook, relationship_hook),
              profile = coalesce(@biography, profile),
              appearance = coalesce(@appearance, appearance),
              arc_start = coalesce(@arcStart, arc_start),
              arc_turn = coalesce(@arcTurn, arc_turn),
              arc_end = coalesce(@arcEnd, arc_end),
              motivation = coalesce(@motivation, motivation),
              updated_at = @now
          where project_id = @projectId and id = @characterId
          `,
        )
        .run({
          appearance: input.appearance ?? null,
          arcEnd: input.arcEnd ?? null,
          arcStart: input.arcStart ?? null,
          arcTurn: input.arcTurn ?? null,
          archetype: input.archetype ?? null,
          biography: input.biography ?? null,
          characterId: input.characterId,
          firstAppearance: input.firstAppearance ?? null,
          genderAge: input.genderAge ?? null,
          importance: input.importance ?? null,
          motivation: input.motivation ?? null,
          name: input.name ?? null,
          narrativeFunction: input.narrativeFunction ?? null,
          now,
          projectId: input.projectId,
          relationshipHook: input.relationshipHook ?? null,
          role: input.role ?? null,
          storyTask: input.storyTask ?? null,
        });

      for (const trait of input.traits ?? []) {
        this.upsertCharacterTrait({
          characterId: input.characterId,
          now,
          projectId: input.projectId,
          trait,
        });
      }
    });

    update();

    const character = this.getCharacter(input.projectId, input.characterId);
    if (!character) {
      throw new Error(`CHARACTER_NOT_FOUND: ${input.characterId}`);
    }

    return character;
  }

  private listTraits(projectId: string, characterId: string): CharacterTraitRecord[] {
    return this.projectDatabase.client
      .prepare(
        "select * from character_traits where project_id = ? and character_id = ? order by created_at asc",
      )
      .all(projectId, characterId)
      .map((trait) => mapTraitRow(trait as CharacterTraitRow));
  }

  private upsertCharacterTrait(input: {
    readonly characterId: string;
    readonly now: number;
    readonly projectId: string;
    readonly trait: UpdateCharacterTraitInput;
  }): void {
    const value = input.trait.value.trim();

    if (!value) {
      this.projectDatabase.client
        .prepare(
          "delete from character_traits where project_id = ? and character_id = ? and name = ?",
        )
        .run(input.projectId, input.characterId, input.trait.name);
      return;
    }

    const existingTrait = this.projectDatabase.client
      .prepare(
        "select id from character_traits where project_id = ? and character_id = ? and name = ? limit 1",
      )
      .get(input.projectId, input.characterId, input.trait.name) as
      { readonly id: string } | undefined;

    if (existingTrait) {
      this.projectDatabase.client
        .prepare(
          `
          update character_traits
          set value = @value, confidence = 1, updated_at = @now
          where project_id = @projectId and character_id = @characterId and name = @name
          `,
        )
        .run({
          characterId: input.characterId,
          name: input.trait.name,
          now: input.now,
          projectId: input.projectId,
          value,
        });
      return;
    }

    this.projectDatabase.client
      .prepare(
        `
        insert into character_traits (
          id, project_id, character_id, name, value, confidence, created_at, updated_at
        )
        values (
          @traitId, @projectId, @characterId, @name, @value, 1, @now, @now
        )
        `,
      )
      .run({
        characterId: input.characterId,
        name: input.trait.name,
        now: input.now,
        projectId: input.projectId,
        traitId: input.trait.traitId,
        value,
      });
  }
}

function mapCharacterRow(row: CharacterRow, traits: CharacterTraitRecord[]): CharacterRecord {
  return {
    appearance: row.appearance,
    arcEnd: row.arc_end,
    arcStart: row.arc_start,
    arcTurn: row.arc_turn,
    archetype: row.archetype,
    firstAppearance: row.first_appearance,
    genderAge: row.gender_age,
    id: row.id,
    importance: row.importance,
    motivation: row.motivation,
    name: row.display_name,
    narrativeFunction: row.narrative_function,
    profile: row.profile,
    projectId: row.project_id,
    relationshipHook: row.relationship_hook,
    role: row.role,
    storyTask: row.story_task,
    traits,
  };
}

function mapTraitRow(row: CharacterTraitRow): CharacterTraitRecord {
  return {
    characterId: row.character_id,
    confidence: row.confidence,
    evidence: row.evidence,
    id: row.id,
    name: row.name,
    projectId: row.project_id,
    value: row.value,
  };
}

function mapRelationRow(row: EntityRelationRow): EntityRelationRecord {
  return {
    description: row.description,
    id: row.id,
    polarity: row.polarity,
    projectId: row.project_id,
    relationType: row.relation_type,
    sourceEntityId: row.source_entity_id,
    sourceEntityType: row.source_entity_type,
    status: row.status,
    strength: row.strength,
    targetEntityId: row.target_entity_id,
    targetEntityType: row.target_entity_type,
  };
}
