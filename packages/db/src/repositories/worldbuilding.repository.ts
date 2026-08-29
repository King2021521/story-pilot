import type { ProjectDatabase } from "../project-database.js";

export const WORLDBUILDING_FIELD_KEYS = [
  "worldBase",
  "geography",
  "history",
  "powerSystem",
  "socialStructure",
  "powerOrder",
  "factions",
  "economy",
  "culture",
  "rules",
  "specialMechanism",
  "coreConflict",
] as const;

export type WorldbuildingFieldKey = (typeof WORLDBUILDING_FIELD_KEYS)[number];

export type WorldbuildingFields = Record<WorldbuildingFieldKey, string>;

const WORLDBUILDING_FIELD_MAX_LENGTH = 500;

export interface WorldbuildingProfileRecord {
  readonly projectId: string;
  readonly fields: WorldbuildingFields;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface SaveWorldbuildingProfileInput {
  readonly projectId: string;
  readonly fields: Partial<WorldbuildingFields>;
  readonly now?: number;
}

interface WorldbuildingProfileRow {
  readonly project_id: string;
  readonly world_base: string;
  readonly geography: string;
  readonly history: string;
  readonly power_system: string;
  readonly social_structure: string;
  readonly power_order: string;
  readonly factions: string;
  readonly economy: string;
  readonly culture: string;
  readonly rules: string;
  readonly special_mechanism: string;
  readonly core_conflict: string;
  readonly created_at: number;
  readonly updated_at: number;
}

export class WorldbuildingRepository {
  constructor(private readonly projectDatabase: ProjectDatabase) {}

  getProfile(projectId: string): WorldbuildingProfileRecord | null {
    const row = this.projectDatabase.client
      .prepare("select * from worldbuilding_profiles where project_id = ?")
      .get(projectId) as WorldbuildingProfileRow | undefined;

    return row ? mapWorldbuildingProfileRow(row) : null;
  }

  saveProfile(input: SaveWorldbuildingProfileInput): WorldbuildingProfileRecord {
    const now = input.now ?? Date.now();
    const fields = normalizeWorldbuildingFields(input.fields);
    const existing = this.getProfile(input.projectId);

    this.projectDatabase.client
      .prepare(
        `
        insert into worldbuilding_profiles (
          project_id, world_base, geography, history, power_system, social_structure,
          power_order, factions, economy, culture, rules, special_mechanism,
          core_conflict, created_at, updated_at
        )
        values (
          @projectId, @worldBase, @geography, @history, @powerSystem, @socialStructure,
          @powerOrder, @factions, @economy, @culture, @rules, @specialMechanism,
          @coreConflict, @createdAt, @updatedAt
        )
        on conflict(project_id) do update set
          world_base = excluded.world_base,
          geography = excluded.geography,
          history = excluded.history,
          power_system = excluded.power_system,
          social_structure = excluded.social_structure,
          power_order = excluded.power_order,
          factions = excluded.factions,
          economy = excluded.economy,
          culture = excluded.culture,
          rules = excluded.rules,
          special_mechanism = excluded.special_mechanism,
          core_conflict = excluded.core_conflict,
          updated_at = excluded.updated_at
        `,
      )
      .run({
        ...fields,
        createdAt: existing?.createdAt ?? now,
        projectId: input.projectId,
        updatedAt: now,
      });

    const profile = this.getProfile(input.projectId);
    if (!profile) {
      throw new Error(`WORLDBUILDING_PROFILE_NOT_SAVED: ${input.projectId}`);
    }

    return profile;
  }
}

export function normalizeWorldbuildingFields(
  fields: Partial<WorldbuildingFields> | null | undefined,
): WorldbuildingFields {
  const normalized = {
    coreConflict: fields?.coreConflict?.trim() ?? "",
    culture: fields?.culture?.trim() ?? "",
    economy: fields?.economy?.trim() ?? "",
    factions: fields?.factions?.trim() ?? "",
    geography: fields?.geography?.trim() ?? "",
    history: fields?.history?.trim() ?? "",
    powerOrder: fields?.powerOrder?.trim() ?? "",
    powerSystem: fields?.powerSystem?.trim() ?? "",
    rules: fields?.rules?.trim() ?? "",
    socialStructure: fields?.socialStructure?.trim() ?? "",
    specialMechanism: fields?.specialMechanism?.trim() ?? "",
    worldBase: fields?.worldBase?.trim() ?? "",
  };

  for (const key of WORLDBUILDING_FIELD_KEYS) {
    if (normalized[key].length > WORLDBUILDING_FIELD_MAX_LENGTH) {
      throw new Error(`WORLDBUILDING_FIELD_TOO_LONG: ${key}`);
    }
  }

  return normalized;
}

function mapWorldbuildingProfileRow(row: WorldbuildingProfileRow): WorldbuildingProfileRecord {
  return {
    createdAt: row.created_at,
    fields: {
      coreConflict: row.core_conflict,
      culture: row.culture,
      economy: row.economy,
      factions: row.factions,
      geography: row.geography,
      history: row.history,
      powerOrder: row.power_order,
      powerSystem: row.power_system,
      rules: row.rules,
      socialStructure: row.social_structure,
      specialMechanism: row.special_mechanism,
      worldBase: row.world_base,
    },
    projectId: row.project_id,
    updatedAt: row.updated_at,
  };
}
