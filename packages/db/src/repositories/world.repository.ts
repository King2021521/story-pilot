import type { ProjectDatabase } from "../project-database.js";

export interface WorldRuleRecord {
  readonly id: string;
  readonly projectId: string;
  readonly category: string;
  readonly title: string;
  readonly content: string;
  readonly status: string;
  readonly source: string | null;
}

export interface LocationRecord {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly type: string;
  readonly description: string | null;
  readonly status: string;
}

export interface OrganizationRecord {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly type: string;
  readonly description: string | null;
  readonly status: string;
}

export interface ItemRecord {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly type: string;
  readonly description: string | null;
  readonly status: string;
}

export interface CreateWorldRuleRecordInput {
  readonly worldRuleId: string;
  readonly projectId: string;
  readonly category: string;
  readonly title: string;
  readonly statement: string;
  readonly constraintLevel: string;
  readonly now?: number;
}

export interface UpdateWorldRuleRecordInput {
  readonly projectId: string;
  readonly worldRuleId: string;
  readonly category?: string;
  readonly title?: string;
  readonly statement?: string;
  readonly constraintLevel?: string;
  readonly now?: number;
}

export interface CreateLocationRecordInput {
  readonly locationId: string;
  readonly projectId: string;
  readonly name: string;
  readonly type: string;
  readonly description?: string;
  readonly now?: number;
}

export interface CreateOrganizationRecordInput {
  readonly organizationId: string;
  readonly projectId: string;
  readonly name: string;
  readonly type: string;
  readonly description?: string;
  readonly now?: number;
}

export interface CreateItemRecordInput {
  readonly itemId: string;
  readonly projectId: string;
  readonly name: string;
  readonly type: string;
  readonly description?: string;
  readonly now?: number;
}

interface WorldRuleRow {
  readonly id: string;
  readonly project_id: string;
  readonly category: string;
  readonly title: string;
  readonly content: string;
  readonly status: string;
  readonly source: string | null;
}

interface LocationRow {
  readonly id: string;
  readonly project_id: string;
  readonly name: string;
  readonly type: string;
  readonly description: string | null;
  readonly status: string;
}

interface OrganizationRow {
  readonly id: string;
  readonly project_id: string;
  readonly name: string;
  readonly type: string;
  readonly description: string | null;
  readonly status: string;
}

interface ItemRow {
  readonly id: string;
  readonly project_id: string;
  readonly name: string;
  readonly type: string;
  readonly description: string | null;
  readonly status: string;
}

export class WorldRepository {
  constructor(private readonly projectDatabase: ProjectDatabase) {}

  createWorldRule(input: CreateWorldRuleRecordInput): WorldRuleRecord {
    const now = input.now ?? Date.now();
    this.projectDatabase.client
      .prepare(
        `
        insert into world_rules (
          id, project_id, category, title, content, status, source, created_at, updated_at
        )
        values (
          @worldRuleId, @projectId, @category, @title, @statement, 'canon', @constraintLevel, @now, @now
        )
      `,
      )
      .run({
        category: input.category,
        constraintLevel: input.constraintLevel,
        now,
        projectId: input.projectId,
        statement: input.statement,
        title: input.title,
        worldRuleId: input.worldRuleId,
      });

    const rule = this.projectDatabase.client
      .prepare("select * from world_rules where project_id = ? and id = ?")
      .get(input.projectId, input.worldRuleId) as WorldRuleRow | undefined;

    if (!rule) {
      throw new Error(`WORLD_RULE_NOT_CREATED: ${input.worldRuleId}`);
    }

    return mapWorldRuleRow(rule);
  }

  listWorldRules(projectId: string): WorldRuleRecord[] {
    return this.projectDatabase.client
      .prepare("select * from world_rules where project_id = ? order by created_at asc")
      .all(projectId)
      .map((row) => mapWorldRuleRow(row as WorldRuleRow));
  }

  getWorldRule(projectId: string, worldRuleId: string): WorldRuleRecord | undefined {
    const rule = this.projectDatabase.client
      .prepare("select * from world_rules where project_id = ? and id = ?")
      .get(projectId, worldRuleId) as WorldRuleRow | undefined;

    return rule ? mapWorldRuleRow(rule) : undefined;
  }

  updateWorldRule(input: UpdateWorldRuleRecordInput): WorldRuleRecord {
    const now = input.now ?? Date.now();
    this.projectDatabase.client
      .prepare(
        `
        update world_rules
        set category = coalesce(@category, category),
            title = coalesce(@title, title),
            content = coalesce(@statement, content),
            source = coalesce(@constraintLevel, source),
            updated_at = @now
        where project_id = @projectId and id = @worldRuleId
        `,
      )
      .run({
        category: input.category ?? null,
        constraintLevel: input.constraintLevel ?? null,
        now,
        projectId: input.projectId,
        statement: input.statement ?? null,
        title: input.title ?? null,
        worldRuleId: input.worldRuleId,
      });

    const rule = this.getWorldRule(input.projectId, input.worldRuleId);
    if (!rule) {
      throw new Error(`WORLD_RULE_NOT_FOUND: ${input.worldRuleId}`);
    }

    return rule;
  }

  createLocation(input: CreateLocationRecordInput): LocationRecord {
    const now = input.now ?? Date.now();
    this.projectDatabase.client
      .prepare(
        `
        insert into locations (
          id, project_id, name, type, description, status, created_at, updated_at
        )
        values (
          @locationId, @projectId, @name, @type, @description, 'active', @now, @now
        )
      `,
      )
      .run({
        description: input.description ?? null,
        locationId: input.locationId,
        name: input.name,
        now,
        projectId: input.projectId,
        type: input.type,
      });

    const row = this.projectDatabase.client
      .prepare("select * from locations where project_id = ? and id = ?")
      .get(input.projectId, input.locationId) as LocationRow | undefined;
    if (!row) {
      throw new Error(`LOCATION_NOT_CREATED: ${input.locationId}`);
    }

    return mapLocationRow(row);
  }

  listLocations(projectId: string): LocationRecord[] {
    return this.projectDatabase.client
      .prepare("select * from locations where project_id = ? order by name asc")
      .all(projectId)
      .map((row) => mapLocationRow(row as LocationRow));
  }

  createOrganization(input: CreateOrganizationRecordInput): OrganizationRecord {
    const now = input.now ?? Date.now();
    this.projectDatabase.client
      .prepare(
        `
        insert into organizations (
          id, project_id, name, type, description, status, created_at, updated_at
        )
        values (
          @organizationId, @projectId, @name, @type, @description, 'active', @now, @now
        )
      `,
      )
      .run({
        description: input.description ?? null,
        name: input.name,
        now,
        organizationId: input.organizationId,
        projectId: input.projectId,
        type: input.type,
      });

    const row = this.projectDatabase.client
      .prepare("select * from organizations where project_id = ? and id = ?")
      .get(input.projectId, input.organizationId) as OrganizationRow | undefined;
    if (!row) {
      throw new Error(`ORGANIZATION_NOT_CREATED: ${input.organizationId}`);
    }

    return mapOrganizationRow(row);
  }

  listOrganizations(projectId: string): OrganizationRecord[] {
    return this.projectDatabase.client
      .prepare("select * from organizations where project_id = ? order by name asc")
      .all(projectId)
      .map((row) => mapOrganizationRow(row as OrganizationRow));
  }

  createItem(input: CreateItemRecordInput): ItemRecord {
    const now = input.now ?? Date.now();
    this.projectDatabase.client
      .prepare(
        `
        insert into items (
          id, project_id, name, type, description, status, created_at, updated_at
        )
        values (
          @itemId, @projectId, @name, @type, @description, 'active', @now, @now
        )
      `,
      )
      .run({
        description: input.description ?? null,
        itemId: input.itemId,
        name: input.name,
        now,
        projectId: input.projectId,
        type: input.type,
      });

    const row = this.projectDatabase.client
      .prepare("select * from items where project_id = ? and id = ?")
      .get(input.projectId, input.itemId) as ItemRow | undefined;
    if (!row) {
      throw new Error(`ITEM_NOT_CREATED: ${input.itemId}`);
    }

    return mapItemRow(row);
  }

  listItems(projectId: string): ItemRecord[] {
    return this.projectDatabase.client
      .prepare("select * from items where project_id = ? order by name asc")
      .all(projectId)
      .map((row) => mapItemRow(row as ItemRow));
  }
}

function mapWorldRuleRow(row: WorldRuleRow): WorldRuleRecord {
  return {
    category: row.category,
    content: row.content,
    id: row.id,
    projectId: row.project_id,
    source: row.source,
    status: row.status,
    title: row.title,
  };
}

function mapLocationRow(row: LocationRow): LocationRecord {
  return {
    description: row.description,
    id: row.id,
    name: row.name,
    projectId: row.project_id,
    status: row.status,
    type: row.type,
  };
}

function mapOrganizationRow(row: OrganizationRow): OrganizationRecord {
  return {
    description: row.description,
    id: row.id,
    name: row.name,
    projectId: row.project_id,
    status: row.status,
    type: row.type,
  };
}

function mapItemRow(row: ItemRow): ItemRecord {
  return {
    description: row.description,
    id: row.id,
    name: row.name,
    projectId: row.project_id,
    status: row.status,
    type: row.type,
  };
}
