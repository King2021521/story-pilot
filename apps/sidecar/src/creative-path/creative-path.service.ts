import { createHash, randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import {
  ArtifactRepository,
  CREATIVE_STAGE_KEYS,
  ContextRepository,
  CreativePathRepository,
  DomainEventRepository,
  ModelCallRepository,
  ProjectRepository,
  type ArtifactRecord,
  type CreativeStageKey,
  type CreativeStageRecord,
  type CreativePathRecord,
  type ProjectDatabase,
  type ProjectBriefRecord,
  type StoryBlueprintRecord,
} from "@story-pilot/db";
import {
  BlueprintGenerateOutputSchema,
  buildPromptMessages,
  type ModelGateway,
} from "@story-pilot/ai";

import { MODEL_GATEWAY } from "../ai/model-gateway.provider.js";
import { ProjectStorageService } from "../storage/project-storage.service.js";

export interface SaveBriefInput {
  readonly projectId: string;
  readonly genre: string;
  readonly subgenres: readonly string[];
  readonly targetAudience?: string;
  readonly platformProfile?: string;
  readonly lengthProfile?: string;
  readonly narrativePov?: string;
  readonly emotionalRewards?: readonly string[];
  readonly initialIdea?: string;
  readonly forbiddenDirections?: readonly string[];
}

export interface ConfirmBriefInput {
  readonly projectId: string;
  readonly briefId: string;
}

export interface CompleteCreativeStageInput {
  readonly projectId: string;
  readonly stageKey: CreativeStageKey;
}

export interface EvaluateCreativeStageGateInput {
  readonly projectId: string;
  readonly stageKey: CreativeStageKey;
}

export interface AdvanceCreativeStageInput extends EvaluateCreativeStageGateInput {
  readonly mode: "strict" | "force";
  readonly reason?: string | undefined;
}

export interface ReopenCreativeStageInput extends EvaluateCreativeStageGateInput {
  readonly reason?: string | undefined;
}

export interface SkipCreativeStageInput extends EvaluateCreativeStageGateInput {
  readonly reason: string;
}

export interface CreativeStageGateRequirement {
  readonly key: string;
  readonly label: string;
  readonly required: number;
  readonly current: number;
  readonly ok: boolean;
  readonly blocking: boolean;
}

export interface CreativeStageGateReport {
  readonly stageKey: CreativeStageKey;
  readonly ok: boolean;
  readonly readinessScore: number;
  readonly checkedAt: number;
  readonly summary: string;
  readonly requirements: readonly CreativeStageGateRequirement[];
  readonly warnings: readonly string[];
}

export interface CreativeStageGateResult {
  readonly stage: CreativeStageRecord;
  readonly gateReport: CreativeStageGateReport;
}

export interface AdvanceCreativeStageResult extends CreativeStageGateResult {
  readonly advanced: boolean;
  readonly path: CreativePathRecord;
}

export interface ReopenCreativeStageResult extends CreativeStageGateResult {
  readonly reopened: true;
  readonly path: CreativePathRecord;
}

export interface SkipCreativeStageResult extends CreativeStageGateResult {
  readonly skipped: true;
  readonly path: CreativePathRecord;
}

export interface GenerateBlueprintInput {
  readonly projectId: string;
  readonly instruction?: string;
  readonly temperature?: number;
  readonly workflowRunId?: string;
  readonly workOrderId?: string;
}

export interface GenerateBlueprintResult {
  readonly artifact: ArtifactRecord;
  readonly blueprint: StoryBlueprintRecord;
}

export interface ApplyBlueprintInput {
  readonly projectId: string;
  readonly blueprintId: string;
}

@Injectable()
export class CreativePathService {
  constructor(
    private readonly projectStorage: ProjectStorageService,
    @Inject(MODEL_GATEWAY) private readonly modelGateway: ModelGateway,
  ) {}

  async getPath(projectId: string): Promise<CreativePathRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(projectId);
    try {
      const repository = new CreativePathRepository(projectDatabase);
      if (repository.listStages(projectId).length === 0) {
        repository.initializePath(projectId);
      }

      return repository.getPath(projectId);
    } finally {
      projectDatabase.close();
    }
  }

  async saveBrief(input: SaveBriefInput): Promise<ProjectBriefRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const now = Date.now();
      const save = projectDatabase.client.transaction(() => {
        const brief = new CreativePathRepository(projectDatabase).saveBrief({
          briefId: randomUUID(),
          emotionalRewards: input.emotionalRewards ?? [],
          forbiddenDirections: input.forbiddenDirections ?? [],
          genre: input.genre,
          projectId: input.projectId,
          subgenres: input.subgenres,
          now,
          ...(input.initialIdea === undefined ? {} : { initialIdea: input.initialIdea }),
          ...(input.lengthProfile === undefined ? {} : { lengthProfile: input.lengthProfile }),
          ...(input.narrativePov === undefined ? {} : { narrativePov: input.narrativePov }),
          ...(input.platformProfile === undefined
            ? {}
            : { platformProfile: input.platformProfile }),
          ...(input.targetAudience === undefined ? {} : { targetAudience: input.targetAudience }),
        });
        new DomainEventRepository(projectDatabase).append({
          aggregateId: brief.id,
          aggregateType: "project_brief",
          eventId: randomUUID(),
          eventType: "project_brief.saved",
          payload: { genre: brief.genre, status: brief.status, version: brief.version },
          projectId: input.projectId,
          now,
        });

        return brief;
      });

      return save();
    } finally {
      projectDatabase.close();
    }
  }

  async confirmBrief(input: ConfirmBriefInput): Promise<ProjectBriefRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const now = Date.now();
      const confirm = projectDatabase.client.transaction(() => {
        const brief = new CreativePathRepository(projectDatabase).confirmBrief(
          input.projectId,
          input.briefId,
          now,
        );
        new DomainEventRepository(projectDatabase).append({
          aggregateId: brief.id,
          aggregateType: "project_brief",
          eventId: randomUUID(),
          eventType: "project_brief.confirmed",
          payload: { genre: brief.genre, version: brief.version },
          projectId: input.projectId,
          now,
        });

        return brief;
      });

      return confirm();
    } finally {
      projectDatabase.close();
    }
  }

  async completeStage(input: CompleteCreativeStageInput): Promise<CreativeStageRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const now = Date.now();
      const complete = projectDatabase.client.transaction(() => {
        const pathRepository = new CreativePathRepository(projectDatabase);
        if (pathRepository.listStages(input.projectId).length === 0) {
          pathRepository.initializePath(input.projectId, now);
        }
        const stage = pathRepository
          .listStages(input.projectId)
          .find((candidate) => candidate.stageKey === input.stageKey);
        if (!stage) {
          throw new Error(`CREATIVE_STAGE_NOT_FOUND: ${input.stageKey}`);
        }
        if (stage.status === "locked") {
          throw new Error(`CREATIVE_STAGE_LOCKED: ${input.stageKey}`);
        }
        if (stage.status === "completed") {
          return stage;
        }

        const completedStage = pathRepository.markStageCompleted(
          input.projectId,
          input.stageKey,
          getNextStageKey(input.stageKey),
          now,
        );
        new DomainEventRepository(projectDatabase).append({
          aggregateId: completedStage.id,
          aggregateType: "creative_stage",
          eventId: randomUUID(),
          eventType: "creative_stage.completed",
          payload: {
            nextStageKey: getNextStageKey(input.stageKey),
            stageKey: input.stageKey,
          },
          projectId: input.projectId,
          now,
        });

        return completedStage;
      });

      return complete();
    } finally {
      projectDatabase.close();
    }
  }

  async evaluateStageGate(input: EvaluateCreativeStageGateInput): Promise<CreativeStageGateResult> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const now = Date.now();
      const evaluate = projectDatabase.client.transaction(() => {
        const pathRepository = new CreativePathRepository(projectDatabase);
        ensureCreativePath(pathRepository, input.projectId, now);
        const report = buildStageGateReport(projectDatabase, pathRepository, input, now);
        const stage = pathRepository.updateStageGateReport(
          input.projectId,
          input.stageKey,
          report.readinessScore,
          report,
          now,
        );

        return { gateReport: report, stage };
      });

      return evaluate();
    } finally {
      projectDatabase.close();
    }
  }

  async advanceStage(input: AdvanceCreativeStageInput): Promise<AdvanceCreativeStageResult> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const now = Date.now();
      const advance = projectDatabase.client.transaction(() => {
        const pathRepository = new CreativePathRepository(projectDatabase);
        ensureCreativePath(pathRepository, input.projectId, now);
        const currentStage = getStageOrThrow(pathRepository, input.projectId, input.stageKey);
        if (currentStage.status === "locked") {
          throw new Error(`CREATIVE_STAGE_LOCKED: ${input.stageKey}`);
        }

        const report = buildStageGateReport(projectDatabase, pathRepository, input, now);
        if (!report.ok && input.mode === "strict") {
          const stage = pathRepository.updateStageGateReport(
            input.projectId,
            input.stageKey,
            report.readinessScore,
            report,
            now,
          );

          return {
            advanced: false,
            gateReport: report,
            path: pathRepository.getPath(input.projectId),
            stage,
          };
        }
        if (!report.ok && !input.reason?.trim()) {
          throw new Error(`CREATIVE_STAGE_FORCE_REASON_REQUIRED: ${input.stageKey}`);
        }

        const completionReport = {
          ...report,
          advancedBy: input.mode,
          forceReason: input.mode === "force" ? input.reason : undefined,
        };
        const stage = pathRepository.markStageCompleted(
          input.projectId,
          input.stageKey,
          getNextStageKey(input.stageKey),
          now,
          completionReport,
        );
        appendCreativeStageEvent(projectDatabase, {
          eventType: "creative_stage.advanced",
          gateReport: completionReport,
          projectId: input.projectId,
          stage,
          now,
        });

        return {
          advanced: true,
          gateReport: completionReport,
          path: pathRepository.getPath(input.projectId),
          stage,
        };
      });

      return advance();
    } finally {
      projectDatabase.close();
    }
  }

  async reopenStage(input: ReopenCreativeStageInput): Promise<ReopenCreativeStageResult> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const now = Date.now();
      const reopen = projectDatabase.client.transaction(() => {
        const pathRepository = new CreativePathRepository(projectDatabase);
        ensureCreativePath(pathRepository, input.projectId, now);
        const report = buildStageGateReport(projectDatabase, pathRepository, input, now);
        const gateReport = {
          ...report,
          reopened: true,
          reopenReason: input.reason ?? null,
        };
        const stage = pathRepository.updateStageState({
          completedAt: null,
          gateReport,
          projectId: input.projectId,
          readinessScore: Math.max(10, report.readinessScore),
          stageKey: input.stageKey,
          status: "available",
          now,
        });
        appendCreativeStageEvent(projectDatabase, {
          eventType: "creative_stage.reopened",
          gateReport,
          projectId: input.projectId,
          stage,
          now,
        });

        return {
          gateReport,
          path: pathRepository.getPath(input.projectId),
          reopened: true as const,
          stage,
        };
      });

      return reopen();
    } finally {
      projectDatabase.close();
    }
  }

  async skipStage(input: SkipCreativeStageInput): Promise<SkipCreativeStageResult> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const now = Date.now();
      const skip = projectDatabase.client.transaction(() => {
        const pathRepository = new CreativePathRepository(projectDatabase);
        ensureCreativePath(pathRepository, input.projectId, now);
        const currentStage = getStageOrThrow(pathRepository, input.projectId, input.stageKey);
        if (currentStage.status === "locked") {
          throw new Error(`CREATIVE_STAGE_LOCKED: ${input.stageKey}`);
        }

        const report = buildStageGateReport(projectDatabase, pathRepository, input, now);
        const gateReport = {
          ...report,
          ok: true,
          skipped: true,
          skipReason: input.reason,
          warnings: [
            ...report.warnings,
            "该阶段由用户跳过，后续一致性校验需要把跳过原因纳入上下文。",
          ],
        };
        const stage = pathRepository.updateStageState({
          completedAt: now,
          gateReport,
          projectId: input.projectId,
          readinessScore: 100,
          stageKey: input.stageKey,
          status: "skipped",
          now,
        });
        unlockNextStage(projectDatabase, input.projectId, getNextStageKey(input.stageKey), now);
        appendCreativeStageEvent(projectDatabase, {
          eventType: "creative_stage.skipped",
          gateReport,
          projectId: input.projectId,
          stage,
          now,
        });

        return {
          gateReport,
          path: pathRepository.getPath(input.projectId),
          skipped: true as const,
          stage,
        };
      });

      return skip();
    } finally {
      projectDatabase.close();
    }
  }

  async generateBlueprint(input: GenerateBlueprintInput): Promise<GenerateBlueprintResult> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const pathRepository = new CreativePathRepository(projectDatabase);
      const project = getProjectOrThrow(new ProjectRepository(projectDatabase), input.projectId);
      const brief = pathRepository.getLatestBrief(input.projectId);
      const contextItems = [
        {
          content: JSON.stringify(
            {
              genre: project.genre,
              style: project.style,
              title: project.title,
            },
            null,
            2,
          ),
          contextPackageItemId: randomUUID(),
          itemId: project.id,
          itemType: "project",
          rank: 1,
        },
        ...(brief
          ? [
              {
                content: JSON.stringify(brief, null, 2),
                contextPackageItemId: randomUUID(),
                itemId: brief.id,
                itemType: "project_brief",
                rank: 2,
              },
            ]
          : []),
      ];
      const contextPackage = new ContextRepository(projectDatabase).createPackage({
        contextPackageId: randomUUID(),
        inputHash: hashGenerationContextInput({
          briefId: brief?.id ?? null,
          capability: "blueprint_generate",
          projectId: input.projectId,
        }),
        items: contextItems,
        projectId: input.projectId,
        purpose: "blueprint_generate",
        targetId: input.projectId,
        targetType: "project",
      });
      const messages = buildPromptMessages({
        capability: "blueprint_generate",
        context: contextItems.map((item) => item.content).join("\n\n"),
        instruction:
          input.instruction?.trim() ||
          "基于已确认立项生成创作蓝图草案，所有字段必须可支撑长篇创作闭环。",
        version: "v1",
      });
      const modelResult = await this.modelGateway.generateObject({
        messages,
        promptVersion: "blueprint-generate.v1",
        purpose: "blueprint_generate",
        schema: BlueprintGenerateOutputSchema,
        schemaName: "BlueprintGenerateOutput",
        ...(input.temperature === undefined ? {} : { temperature: input.temperature }),
      });
      const now = Date.now();
      const generate = projectDatabase.client.transaction(() => {
        const modelCallId = randomUUID();
        new ModelCallRepository(projectDatabase).create({
          latencyMs: modelResult.modelCall.latencyMs,
          model: modelResult.modelCall.model,
          modelCallId,
          projectId: input.projectId,
          provider: modelResult.modelCall.provider,
          purpose: modelResult.modelCall.purpose,
          request: {
            contextPackageId: contextPackage.id,
            messages,
            schemaName: "BlueprintGenerateOutput",
          },
          response: modelResult.raw,
          status: modelResult.modelCall.status,
          ...(input.workflowRunId === undefined ? {} : { workflowRunId: input.workflowRunId }),
          promptVersion: modelResult.modelCall.promptVersion ?? "blueprint-generate.v1",
          ...(modelResult.modelCall.usage === undefined
            ? {}
            : { usage: modelResult.modelCall.usage }),
        });
        const draft = modelResult.object;
        const artifact = new ArtifactRepository(projectDatabase).createArtifact({
          artifactId: randomUUID(),
          body: JSON.stringify(draft, null, 2),
          kind: "story_blueprint_draft",
          metadata: JSON.stringify({
            briefId: brief?.id ?? null,
            contextPackageId: contextPackage.id,
            modelCallId,
          }),
          projectId: input.projectId,
          targetId: input.projectId,
          targetType: "project",
          title: "创作蓝图草案",
          ...(input.workflowRunId === undefined ? {} : { workflowRunId: input.workflowRunId }),
          ...(input.workOrderId === undefined ? {} : { workOrderId: input.workOrderId }),
          now,
        });
        const blueprint = pathRepository.saveBlueprint({
          corePromise: draft.corePromise,
          differentiators: draft.differentiators,
          logline: draft.logline,
          mainConflict: draft.mainConflict,
          premise: draft.premise,
          risks: draft.risks,
          blueprintId: randomUUID(),
          projectId: input.projectId,
          sourceArtifactId: artifact.id,
          now,
          ...(draft.antagonistForce === undefined
            ? {}
            : { antagonistForce: draft.antagonistForce }),
          ...(draft.protagonistArc === undefined ? {} : { protagonistArc: draft.protagonistArc }),
        });
        new DomainEventRepository(projectDatabase).append({
          aggregateId: blueprint.id,
          aggregateType: "story_blueprint",
          eventId: randomUUID(),
          eventType: "story_blueprint.generated",
          payload: { artifactId: artifact.id, status: blueprint.status },
          projectId: input.projectId,
          now,
        });

        return { artifact, blueprint };
      });

      return generate();
    } finally {
      projectDatabase.close();
    }
  }

  async applyBlueprint(input: ApplyBlueprintInput): Promise<StoryBlueprintRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const now = Date.now();
      const apply = projectDatabase.client.transaction(() => {
        const pathRepository = new CreativePathRepository(projectDatabase);
        const blueprint = pathRepository.applyBlueprint(input.projectId, input.blueprintId, now);
        if (blueprint.sourceArtifactId) {
          new ArtifactRepository(projectDatabase).markApplied(
            input.projectId,
            blueprint.sourceArtifactId,
            now,
          );
        }
        new DomainEventRepository(projectDatabase).append({
          aggregateId: blueprint.id,
          aggregateType: "story_blueprint",
          eventId: randomUUID(),
          eventType: "story_blueprint.applied",
          payload: { sourceArtifactId: blueprint.sourceArtifactId },
          projectId: input.projectId,
          now,
        });

        return blueprint;
      });

      return apply();
    } finally {
      projectDatabase.close();
    }
  }
}

function ensureCreativePath(
  repository: CreativePathRepository,
  projectId: string,
  now: number,
): void {
  if (repository.listStages(projectId).length === 0) {
    repository.initializePath(projectId, now);
  }
}

function getStageOrThrow(
  repository: CreativePathRepository,
  projectId: string,
  stageKey: CreativeStageKey,
): CreativeStageRecord {
  const stage = repository
    .listStages(projectId)
    .find((candidate) => candidate.stageKey === stageKey);
  if (!stage) {
    throw new Error(`CREATIVE_STAGE_NOT_FOUND: ${stageKey}`);
  }

  return stage;
}

function buildStageGateReport(
  projectDatabase: ProjectDatabase,
  pathRepository: CreativePathRepository,
  input: EvaluateCreativeStageGateInput,
  now: number,
): CreativeStageGateReport {
  const stages = pathRepository.listStages(input.projectId);
  const requirements = [
    ...buildPreviousStageRequirements(stages, input.stageKey),
    ...buildContentRequirements(projectDatabase, pathRepository, input.projectId, input.stageKey),
  ];
  const blockingFailures = requirements.filter(
    (requirement) => requirement.blocking && !requirement.ok,
  );
  const warnings =
    blockingFailures.length > 0
      ? [`仍缺少 ${blockingFailures.map((requirement) => requirement.label).join("、")}。`]
      : [];
  const readinessScore = calculateReadinessScore(requirements);

  return {
    checkedAt: now,
    ok: blockingFailures.length === 0,
    readinessScore,
    requirements,
    stageKey: input.stageKey,
    summary:
      blockingFailures.length === 0
        ? "阶段门禁已满足，可以进入下一环节。"
        : "阶段门禁未满足，需要补齐关键创作资产或选择强制推进。",
    warnings,
  };
}

function buildPreviousStageRequirements(
  stages: readonly CreativeStageRecord[],
  stageKey: CreativeStageKey,
): CreativeStageGateRequirement[] {
  const stageIndex = CREATIVE_STAGE_KEYS.indexOf(stageKey);
  if (stageIndex <= 0) {
    return [];
  }
  const previousStageKey = CREATIVE_STAGE_KEYS[stageIndex - 1];
  const previousStage = stages.find((stage) => stage.stageKey === previousStageKey);
  const previousCompleted =
    previousStage?.status === "completed" || previousStage?.status === "skipped";

  return [
    {
      blocking: true,
      current: previousCompleted ? 1 : 0,
      key: "previous_stage",
      label: "前置阶段",
      ok: previousCompleted,
      required: 1,
    },
  ];
}

function buildContentRequirements(
  projectDatabase: ProjectDatabase,
  pathRepository: CreativePathRepository,
  projectId: string,
  stageKey: CreativeStageKey,
): CreativeStageGateRequirement[] {
  switch (stageKey) {
    case "brief": {
      const brief = pathRepository.getLatestBrief(projectId);
      return [
        requirement("confirmed_brief", "已确认作品立项", brief?.status === "confirmed" ? 1 : 0, 1),
        requirement("brief_genre", "题材", hasText(brief?.genre) ? 1 : 0, 1),
        requirement("brief_target_audience", "目标读者", hasText(brief?.targetAudience) ? 1 : 0, 1),
        requirement("brief_length", "篇幅目标", hasText(brief?.lengthProfile) ? 1 : 0, 1),
        requirement("brief_pov", "叙事人称", hasText(brief?.narrativePov) ? 1 : 0, 1),
        requirement("brief_rewards", "情绪回报", brief?.emotionalRewards.length ?? 0, 1),
        requirement("brief_idea", "一句话灵感", hasText(brief?.initialIdea) ? 1 : 0, 1),
      ];
    }
    case "blueprint": {
      const blueprint = pathRepository.getActiveBlueprint(projectId);
      return [
        requirement(
          "confirmed_blueprint",
          "已确认创作蓝图",
          blueprint?.status === "confirmed" ? 1 : 0,
          1,
        ),
        requirement(
          "blueprint_core_promise",
          "核心承诺",
          hasText(blueprint?.corePromise) ? 1 : 0,
          1,
        ),
        requirement(
          "blueprint_main_conflict",
          "主冲突",
          hasText(blueprint?.mainConflict) ? 1 : 0,
          1,
        ),
        requirement(
          "blueprint_differentiators",
          "差异化设计",
          blueprint?.differentiators.length ?? 0,
          2,
        ),
        requirement("blueprint_risks", "风险与规避", blueprint?.risks.length ?? 0, 1),
      ];
    }
    case "worldbuilding": {
      const blueprint = pathRepository.getActiveBlueprint(projectId);
      const project = getProjectOrThrow(new ProjectRepository(projectDatabase), projectId);
      const requiresPowerSystem = isPowerSystemGenre(project.genre);
      return [
        requirement(
          "confirmed_blueprint",
          "已确认创作蓝图",
          blueprint?.status === "confirmed" ? 1 : 0,
          1,
        ),
        requirement(
          "world_rules",
          "世界观规则",
          countRows(
            projectDatabase,
            "select count(*) as count from world_rules where project_id = ? and status != 'archived'",
            projectId,
          ),
          3,
        ),
        requirement(
          "locations",
          "地点",
          countRows(
            projectDatabase,
            "select count(*) as count from locations where project_id = ? and status != 'archived'",
            projectId,
          ),
          2,
        ),
        requirement(
          "organizations",
          "组织或社会力量",
          countRows(
            projectDatabase,
            "select count(*) as count from organizations where project_id = ? and status != 'archived'",
            projectId,
          ),
          1,
        ),
        requirement(
          "power_systems",
          "力量体系",
          countRows(
            projectDatabase,
            "select count(*) as count from power_systems where project_id = ? and status != 'archived'",
            projectId,
          ),
          requiresPowerSystem ? 1 : 0,
        ),
        requirement(
          "items",
          "早期冲突道具",
          countRows(
            projectDatabase,
            "select count(*) as count from items where project_id = ? and status != 'archived'",
            projectId,
          ),
          1,
        ),
      ];
    }
    case "characters":
      return [
        requirement(
          "characters",
          "核心人物",
          countRows(
            projectDatabase,
            "select count(*) as count from characters where project_id = ? and status != 'archived'",
            projectId,
          ),
          1,
        ),
        requirement(
          "protagonist",
          "主角",
          countRows(
            projectDatabase,
            "select count(*) as count from characters where project_id = ? and role = 'protagonist' and status != 'archived'",
            projectId,
          ),
          1,
        ),
        requirement(
          "antagonist_or_opposing_force",
          "反派或对抗力量",
          countRows(
            projectDatabase,
            "select count(*) as count from characters where project_id = ? and role = 'antagonist' and status != 'archived'",
            projectId,
          ),
          1,
        ),
        requirement(
          "support_characters",
          "支撑角色",
          countRows(
            projectDatabase,
            "select count(*) as count from characters where project_id = ? and role in ('support', 'supporting') and status != 'archived'",
            projectId,
          ),
          2,
        ),
        requirement(
          "protagonist_drive_traits",
          "主角动机和弱点",
          countRows(
            projectDatabase,
            `
            select count(*) as count
            from (
              select 'motivation' as key
              from characters
              where project_id = ? and role = 'protagonist' and motivation is not null and trim(motivation) != ''
              union all
              select distinct character_traits.name as key
              from character_traits
              join characters on characters.id = character_traits.character_id
              where character_traits.project_id = ?
                and characters.role = 'protagonist'
                and character_traits.name in ('goal', 'need', 'flaw', 'false_belief')
                and trim(character_traits.value) != ''
            )
            `,
            projectId,
            projectId,
          ),
          2,
        ),
        requirement(
          "character_relations",
          "人物关系",
          countRows(
            projectDatabase,
            `
            select (
              (select count(*) from character_relations where project_id = ? and status != 'archived') +
              (select count(*) from entity_relations where project_id = ? and status != 'archived'
                and (source_entity_type = 'character' or target_entity_type = 'character'))
            ) as count
            `,
            projectId,
            projectId,
          ),
          3,
        ),
        requirement(
          "character_world_bindings",
          "关键人物绑定设定",
          countRows(
            projectDatabase,
            `
            select count(*) as count
            from entity_relations
            where project_id = ?
              and status != 'archived'
              and (source_entity_type = 'character' or target_entity_type = 'character')
              and (
                source_entity_type in ('world_rule', 'location', 'organization', 'plotline')
                or target_entity_type in ('world_rule', 'location', 'organization', 'plotline')
              )
            `,
            projectId,
          ),
          1,
        ),
      ];
    case "plot_arcs":
      return [
        requirement(
          "main_plotlines",
          "主线故事线",
          countRows(
            projectDatabase,
            "select count(*) as count from plotlines where project_id = ? and type = 'main' and status != 'archived'",
            projectId,
          ),
          1,
        ),
        requirement(
          "subplots_or_character_arcs",
          "支线或人物弧线",
          countRows(
            projectDatabase,
            `
            select (
              (select count(*) from plotlines where project_id = ? and type != 'main' and status != 'archived') +
              (select count(*) from character_arcs where project_id = ? and status != 'archived')
            ) as count
            `,
            projectId,
            projectId,
          ),
          2,
        ),
        requirement(
          "plotline_nodes",
          "主线节点",
          countRows(
            projectDatabase,
            "select count(*) as count from plotline_nodes where project_id = ? and status != 'archived'",
            projectId,
          ),
          5,
        ),
        requirement(
          "conflicts",
          "冲突设计",
          countRows(
            projectDatabase,
            "select count(*) as count from conflicts where project_id = ? and status != 'archived'",
            projectId,
          ),
          3,
        ),
        requirement(
          "foreshadowings",
          "伏笔设计",
          countRows(
            projectDatabase,
            "select count(*) as count from foreshadowings where project_id = ? and status != 'archived'",
            projectId,
          ),
          3,
        ),
        requirement(
          "story_events",
          "关键事件",
          countRows(
            projectDatabase,
            "select count(*) as count from story_events where project_id = ? and status != 'archived'",
            projectId,
          ),
          5,
        ),
        requirement(
          "event_relations",
          "事件因果或顺序关系",
          countRows(
            projectDatabase,
            "select count(*) as count from event_relations where project_id = ?",
            projectId,
          ),
          1,
        ),
      ];
    case "outline":
      return [
        requirement(
          "full_book_outline",
          "全书大纲",
          countRows(
            projectDatabase,
            "select count(*) as count from outlines where project_id = ? and scope = 'full_book' and status != 'archived'",
            projectId,
          ),
          1,
        ),
        requirement(
          "volume_outline",
          "分卷大纲",
          countRows(
            projectDatabase,
            `
            select count(*) as count
            from volume_outlines
            join outlines on outlines.id = volume_outlines.outline_id
            where outlines.project_id = ?
              and outlines.status != 'archived'
              and volume_outlines.status != 'archived'
            `,
            projectId,
          ),
          1,
        ),
        requirement(
          "chapter_outlines",
          "章节大纲",
          countRows(
            projectDatabase,
            "select count(*) as count from chapter_outlines where project_id = ?",
            projectId,
          ),
          10,
        ),
        requirement(
          "complete_chapter_outlines",
          "章纲关键字段",
          countRows(
            projectDatabase,
            `
            select count(*) as count
            from chapter_outlines
            where project_id = ?
              and trim(chapter_goal) != ''
              and conflict is not null and trim(conflict) != ''
              and information_gain is not null and trim(information_gain) != ''
              and hook is not null and trim(hook) != ''
            `,
            projectId,
          ),
          10,
        ),
        requirement(
          "bound_chapter_outlines",
          "章纲绑定剧情或人物线",
          countRows(
            projectDatabase,
            `
            select count(*) as count
            from chapter_outlines
            where project_id = ?
              and (
                related_plotline_node_ids_json not in ('[]', '')
                or required_character_ids_json not in ('[]', '')
              )
            `,
            projectId,
          ),
          Math.ceil(
            countRows(
              projectDatabase,
              "select count(*) as count from chapter_outlines where project_id = ?",
              projectId,
            ) * 0.8,
          ),
        ),
      ];
    case "chapters":
      return [
        requirement(
          "applied_chapter_outlines",
          "已应用章纲",
          countRows(
            projectDatabase,
            "select count(*) as count from chapter_outlines where project_id = ? and status = 'applied'",
            projectId,
          ),
          1,
        ),
        requirement(
          "drafted_chapters",
          "已写正文",
          countRows(
            projectDatabase,
            "select count(*) as count from chapters where project_id = ? and word_count > 0",
            projectId,
          ),
          1,
        ),
        requirement(
          "chapter_artifacts",
          "章节草稿产物",
          countRows(
            projectDatabase,
            "select count(*) as count from artifacts where project_id = ? and kind = 'chapter_draft' and status in ('pending', 'applied')",
            projectId,
          ),
          1,
        ),
        requirement(
          "chapter_summaries",
          "章节摘要",
          countRows(
            projectDatabase,
            "select count(*) as count from chapter_versions where project_id = ? and summary is not null and trim(summary) != ''",
            projectId,
          ),
          1,
        ),
      ];
    case "memory_review":
      return [
        requirement(
          "resolved_memory_candidates",
          "待确认记忆已处理",
          countRows(
            projectDatabase,
            "select count(*) as count from memory_candidates where project_id = ? and status = 'pending'",
            projectId,
          ),
          0,
          "at_most",
        ),
      ];
    case "retrospective":
      return [
        requirement(
          "canon_memories",
          "已沉淀关键记忆",
          countRows(
            projectDatabase,
            "select count(*) as count from memories where project_id = ? and status = 'canon'",
            projectId,
          ),
          1,
        ),
      ];
  }
}

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isPowerSystemGenre(genre: string | null | undefined): boolean {
  if (!genre) {
    return false;
  }

  return ["玄幻", "仙侠", "科幻", "奇幻", "武侠"].some((keyword) => genre.includes(keyword));
}

function requirement(
  key: string,
  label: string,
  current: number,
  required: number,
  mode: "at_least" | "at_most" = "at_least",
): CreativeStageGateRequirement {
  const ok = mode === "at_least" ? current >= required : current <= required;

  return {
    blocking: true,
    current,
    key,
    label,
    ok,
    required,
  };
}

function calculateReadinessScore(requirements: readonly CreativeStageGateRequirement[]): number {
  if (requirements.length === 0) {
    return 100;
  }

  const score = Math.round(
    (requirements.filter((requirement) => requirement.ok).length / requirements.length) * 100,
  );

  return Math.max(10, score);
}

function countRows(
  projectDatabase: ProjectDatabase,
  sql: string,
  ...parameters: readonly unknown[]
): number {
  return (
    projectDatabase.client.prepare(sql).get(...parameters) as {
      readonly count: number;
    }
  ).count;
}

function unlockNextStage(
  projectDatabase: ProjectDatabase,
  projectId: string,
  nextStageKey: CreativeStageKey | null,
  now: number,
): void {
  if (!nextStageKey) {
    return;
  }

  projectDatabase.client
    .prepare(
      `
      update creative_stages
      set status = case when status = 'locked' then 'available' else status end,
          readiness_score = case when readiness_score = 0 then 10 else readiness_score end,
          updated_at = @now
      where project_id = @projectId and stage_key = @nextStageKey
      `,
    )
    .run({
      nextStageKey,
      now,
      projectId,
    });
}

function appendCreativeStageEvent(
  projectDatabase: ProjectDatabase,
  input: {
    readonly eventType: string;
    readonly projectId: string;
    readonly stage: CreativeStageRecord;
    readonly gateReport: unknown;
    readonly now: number;
  },
): void {
  new DomainEventRepository(projectDatabase).append({
    aggregateId: input.stage.id,
    aggregateType: "creative_stage",
    eventId: randomUUID(),
    eventType: input.eventType,
    payload: {
      gateReport: input.gateReport,
      readinessScore: input.stage.readinessScore,
      stageKey: input.stage.stageKey,
      status: input.stage.status,
    },
    projectId: input.projectId,
    now: input.now,
  });
}

function getProjectOrThrow(repository: ProjectRepository, projectId: string) {
  const project = repository.getOverview(projectId);
  if (!project) {
    throw new Error(`PROJECT_NOT_FOUND: ${projectId}`);
  }

  return project;
}

function hashGenerationContextInput(input: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function getNextStageKey(stageKey: CreativeStageKey): CreativeStageKey | null {
  switch (stageKey) {
    case "brief":
      return "blueprint";
    case "blueprint":
      return "worldbuilding";
    case "worldbuilding":
      return "characters";
    case "characters":
      return "plot_arcs";
    case "plot_arcs":
      return "outline";
    case "outline":
      return "chapters";
    case "chapters":
      return "memory_review";
    case "memory_review":
      return "retrospective";
    case "retrospective":
      return null;
  }
}
