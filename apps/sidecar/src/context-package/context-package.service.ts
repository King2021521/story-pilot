import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import type { CommandPayload } from "@story-pilot/contracts";
import {
  CharacterRepository,
  ChapterRepository,
  ContextPackageRepository,
  CreativePathRepository,
  LongformPlanRepository,
  PlotRepository,
  ProjectRepository,
  SerialStateRepository,
  WorldbuildingRepository,
  WorldRepository,
  type GenerationContextPackageItem,
  type GenerationContextPackageRecord,
  type OmittedGenerationContextPackageItem,
  type ProjectDatabase,
} from "@story-pilot/db";

import { ProjectStorageService } from "../storage/project-storage.service.js";

export type BuildContextPackageInput = CommandPayload<"context.buildPackage">;

const DEFAULT_GENERATION_CONTEXT_TOKEN_BUDGET = 12_000;
const RECENT_CHAPTER_LIMIT = 5;

@Injectable()
export class ContextPackageService {
  constructor(private readonly projectStorage: ProjectStorageService) {}

  async buildPackage(input: BuildContextPackageInput): Promise<GenerationContextPackageRecord> {
    const projectDatabase = await this.projectStorage.openProjectDatabase(input.projectId);
    try {
      const tokenBudget = input.tokenBudget ?? DEFAULT_GENERATION_CONTEXT_TOKEN_BUDGET;
      const { items, omittedItems } = buildContextItems(projectDatabase, input);
      const budgeted = applyTokenBudget(items, omittedItems, tokenBudget);

      return new ContextPackageRepository(projectDatabase).create({
        contextPackageId: randomUUID(),
        estimatedTokens: budgeted.estimatedTokens,
        items: budgeted.items,
        omittedItems: budgeted.omittedItems,
        projectId: input.projectId,
        purpose: input.purpose,
        strategy: "priority_budget_v1",
        targetId: input.targetId,
        targetType: input.targetType,
        tokenBudget,
      });
    } finally {
      projectDatabase.close();
    }
  }
}

function buildContextItems(
  projectDatabase: ProjectDatabase,
  input: BuildContextPackageInput,
): {
  readonly items: readonly GenerationContextPackageItem[];
  readonly omittedItems: readonly OmittedGenerationContextPackageItem[];
} {
  const projectRepository = new ProjectRepository(projectDatabase);
  const creativePathRepository = new CreativePathRepository(projectDatabase);
  const worldbuildingRepository = new WorldbuildingRepository(projectDatabase);
  const worldRepository = new WorldRepository(projectDatabase);
  const characterRepository = new CharacterRepository(projectDatabase);
  const plotRepository = new PlotRepository(projectDatabase);
  const longformPlanRepository = new LongformPlanRepository(projectDatabase);
  const chapterRepository = new ChapterRepository(projectDatabase);
  const serialStateRepository = new SerialStateRepository(projectDatabase);

  const project = projectRepository.getOverview(input.projectId);
  if (!project) {
    throw new Error(`PROJECT_NOT_FOUND: ${input.projectId}`);
  }

  const creativePath = creativePathRepository.getPath(input.projectId);
  const worldbuildingProfile = worldbuildingRepository.getProfile(input.projectId);
  const worldRules = worldRepository.listWorldRules(input.projectId);
  const locations = worldRepository.listLocations(input.projectId);
  const organizations = worldRepository.listOrganizations(input.projectId);
  const items = worldRepository.listItems(input.projectId);
  const characters = characterRepository.listCharacters(input.projectId);
  const plotlines = plotRepository.listPlotlines(input.projectId);
  const storyEvents = plotRepository.listStoryEvents(input.projectId);
  const conflicts = plotRepository.listConflicts(input.projectId);
  const foreshadowings = plotRepository.listForeshadowings(input.projectId);
  const bookPlans = longformPlanRepository.listBookPlans(input.projectId);
  const volumePlans = longformPlanRepository.listVolumePlans(input.projectId);
  const arcPlans = longformPlanRepository.listArcPlans(input.projectId);
  const chapterPlans = longformPlanRepository.listChapterPlans(input.projectId);
  const scenePlans = longformPlanRepository.listScenePlans(input.projectId);
  const chapters = chapterRepository.listChapters({ projectId: input.projectId });
  const latestStoryState = serialStateRepository.getLatestStorySnapshot(input.projectId);
  const plotDebts = serialStateRepository
    .listPlotDebts({ projectId: input.projectId })
    .filter((debt) => debt.status !== "paid_off" && debt.status !== "dropped");

  const contextItems: GenerationContextPackageItem[] = [
    contextItem({
      itemId: project.id,
      itemType: "project",
      rank: 1,
      sectionName: "project",
      value: {
        defaultVolumeId: project.defaultVolumeId,
        genre: project.genre,
        status: project.status,
        style: project.style,
        title: project.title,
        workId: project.workId,
      },
    }),
  ];

  if (creativePath.brief) {
    contextItems.push(
      contextItem({
        itemId: creativePath.brief.id,
        itemType: "project_brief",
        rank: 2,
        sectionName: "brief",
        value: creativePath.brief,
      }),
    );
  }

  if (worldbuildingProfile) {
    contextItems.push(
      contextItem({
        itemId: `${input.projectId}:worldbuilding_profile`,
        itemType: "worldbuilding_profile",
        rank: 3,
        sectionName: "worldbuildingProfile",
        value: worldbuildingProfile.fields,
      }),
    );
  }

  if (creativePath.blueprint) {
    contextItems.push(
      contextItem({
        itemId: creativePath.blueprint.id,
        itemType: "story_blueprint",
        rank: 4,
        sectionName: "blueprint",
        value: creativePath.blueprint,
      }),
    );
  }

  if (latestStoryState) {
    contextItems.push(
      contextItem({
        itemId: latestStoryState.id,
        itemType: "story_state_snapshot",
        rank: 5,
        sectionName: "currentStates",
        value: latestStoryState,
      }),
    );
  }

  for (const [index, bookPlan] of bookPlans.slice(0, 5).entries()) {
    contextItems.push(
      contextItem({
        itemId: bookPlan.id,
        itemType: "book_plan",
        rank: 10 + index,
        sectionName: "bookPlan",
        value: bookPlan,
      }),
    );
  }

  for (const [index, volumePlan] of volumePlans.slice(0, 20).entries()) {
    contextItems.push(
      contextItem({
        itemId: volumePlan.id,
        itemType: "volume_plan",
        rank: 30 + index,
        sectionName: "volumePlan",
        value: volumePlan,
      }),
    );
  }

  for (const [index, arcPlan] of arcPlans.slice(0, 40).entries()) {
    contextItems.push(
      contextItem({
        itemId: arcPlan.id,
        itemType: "arc_plan",
        rank: 60 + index,
        sectionName: "arcPlan",
        value: arcPlan,
      }),
    );
  }

  for (const [index, character] of characters.slice(0, 80).entries()) {
    contextItems.push(
      contextItem({
        itemId: character.id,
        itemType: "character",
        rank: 120 + index,
        sectionName: "character",
        value: character,
      }),
    );
  }

  for (const [index, plotDebt] of plotDebts.slice(0, 80).entries()) {
    contextItems.push(
      contextItem({
        itemId: plotDebt.id,
        itemType: "plot_debt",
        rank: 200 + index,
        sectionName: "plotDebt",
        value: plotDebt,
      }),
    );
  }

  for (const [index, plotline] of plotlines.slice(0, 60).entries()) {
    contextItems.push(
      contextItem({
        itemId: plotline.id,
        itemType: "plotline",
        rank: 220 + index,
        sectionName: "plotline",
        value: plotline,
      }),
    );
  }

  for (const [index, conflict] of conflicts.slice(0, 80).entries()) {
    contextItems.push(
      contextItem({
        itemId: conflict.id,
        itemType: "conflict",
        rank: 300 + index,
        sectionName: "conflict",
        value: conflict,
      }),
    );
  }

  for (const [index, chapterPlan] of prioritizeTarget(chapterPlans, input.targetId).entries()) {
    contextItems.push(
      contextItem({
        itemId: chapterPlan.id,
        itemType: "chapter_plan",
        rank: 400 + index,
        sectionName: "chapterPlan",
        value: chapterPlan,
      }),
    );
  }

  const targetScenePlans =
    input.targetType === "chapter_plan"
      ? scenePlans.filter((scenePlan) => scenePlan.chapterPlanId === input.targetId)
      : scenePlans.slice(0, 40);
  for (const [index, scenePlan] of targetScenePlans.entries()) {
    contextItems.push(
      contextItem({
        itemId: scenePlan.id,
        itemType: "scene_plan",
        rank: 500 + index,
        sectionName: "scenePlan",
        value: scenePlan,
      }),
    );
  }

  for (const [index, event] of storyEvents.slice(0, 80).entries()) {
    contextItems.push(
      contextItem({
        itemId: event.id,
        itemType: "story_event",
        rank: 600 + index,
        sectionName: "storyEvent",
        value: event,
      }),
    );
  }

  for (const [index, foreshadowing] of foreshadowings.slice(0, 80).entries()) {
    contextItems.push(
      contextItem({
        itemId: foreshadowing.id,
        itemType: "foreshadowing",
        rank: 700 + index,
        sectionName: "foreshadowing",
        value: foreshadowing,
      }),
    );
  }

  if (
    worldRules.length > 0 ||
    locations.length > 0 ||
    organizations.length > 0 ||
    items.length > 0
  ) {
    contextItems.push(
      contextItem({
        itemId: `${input.projectId}:world_canon`,
        itemType: "world_canon",
        rank: 800,
        sectionName: "worldCanon",
        value: {
          items: items.slice(0, 80),
          locations: locations.slice(0, 80),
          organizations: organizations.slice(0, 80),
          worldRules: worldRules.slice(0, 120),
        },
      }),
    );
  }

  const omittedItems: OmittedGenerationContextPackageItem[] = [];
  for (const [index, chapter] of chapters.slice(-RECENT_CHAPTER_LIMIT).entries()) {
    contextItems.push(
      contextItem({
        itemId: chapter.id,
        itemType: "recent_chapter_summary",
        rank: 900 + index,
        sectionName: "recentChapterSummary",
        value: {
          id: chapter.id,
          position: chapter.position,
          status: chapter.status,
          summary: chapter.synopsis,
          title: chapter.title,
          version: chapter.version,
          wordCount: chapter.wordCount,
        },
      }),
    );

    if (chapter.content.trim().length > 0) {
      omittedItems.push({
        reason: "最近章节正文不直接进入上下文包，只保留摘要和状态字段。",
        sourceId: chapter.id,
        sourceType: "chapter_full_text",
        tokenEstimate: estimateTokens(chapter.content),
      });
    }
  }

  return { items: contextItems, omittedItems };
}

function applyTokenBudget(
  items: readonly GenerationContextPackageItem[],
  omittedItems: readonly OmittedGenerationContextPackageItem[],
  tokenBudget: number,
): {
  readonly estimatedTokens: number;
  readonly items: readonly GenerationContextPackageItem[];
  readonly omittedItems: readonly OmittedGenerationContextPackageItem[];
} {
  const sortedItems = [...items].sort((left, right) => left.rank - right.rank);
  const kept: GenerationContextPackageItem[] = [];
  const omitted: OmittedGenerationContextPackageItem[] = [...omittedItems];
  let estimatedTokens = 0;

  for (const item of sortedItems) {
    const tokenEstimate = estimateTokens(item.content);
    if (estimatedTokens + tokenEstimate > tokenBudget && kept.length > 0) {
      omitted.push({
        reason: "超出本次上下文预算，按优先级省略。",
        sourceId: item.itemId,
        sourceType: item.itemType,
        tokenEstimate,
      });
      continue;
    }

    kept.push(item);
    estimatedTokens += tokenEstimate;
  }

  return {
    estimatedTokens,
    items: kept,
    omittedItems: omitted,
  };
}

function contextItem(input: {
  readonly itemId: string;
  readonly itemType: string;
  readonly rank: number;
  readonly sectionName: string;
  readonly value: unknown;
}): GenerationContextPackageItem {
  return {
    content: `<${input.sectionName}>\n${JSON.stringify(input.value, null, 2)}\n</${
      input.sectionName
    }>`,
    itemId: input.itemId,
    itemType: input.itemType,
    metadata: { sectionName: input.sectionName },
    rank: input.rank,
  };
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2);
}

function prioritizeTarget<T extends { readonly id: string }>(
  records: readonly T[],
  targetId: string,
): T[] {
  const target = records.find((record) => record.id === targetId);
  const rest = records.filter((record) => record.id !== targetId).slice(0, 39);

  return target ? [target, ...rest] : rest;
}
