import { randomUUID } from "node:crypto";

import type { ContextPackageItem } from "@story-pilot/ai";
import {
  CharacterRepository,
  ChapterRepository,
  CreativePathRepository,
  LongformPlanRepository,
  OutlineRepository,
  PlotRepository,
  ProjectRepository,
  WorldbuildingRepository,
  WorldRepository,
  type ProjectDatabase,
} from "@story-pilot/db";

export interface CreativeContextItem {
  readonly contextPackageItemId: string;
  readonly itemType: string;
  readonly itemId: string;
  readonly rank: number;
  readonly content: string;
  readonly metadata?: Record<string, unknown>;
}

export interface BuildCreativeContextItemsInput {
  readonly projectDatabase: ProjectDatabase;
  readonly projectId: string;
  readonly includeChapters?: boolean;
  readonly includeLongformPlans?: boolean;
  readonly tokenBudget?: number;
}

export function buildCreativeContextItems(
  input: BuildCreativeContextItemsInput,
): CreativeContextItem[] {
  const projectRepository = new ProjectRepository(input.projectDatabase);
  const creativePathRepository = new CreativePathRepository(input.projectDatabase);
  const worldbuildingRepository = new WorldbuildingRepository(input.projectDatabase);
  const worldRepository = new WorldRepository(input.projectDatabase);
  const characterRepository = new CharacterRepository(input.projectDatabase);
  const plotRepository = new PlotRepository(input.projectDatabase);
  const outlineRepository = new OutlineRepository(input.projectDatabase);
  const chapterRepository = new ChapterRepository(input.projectDatabase);
  const longformPlanRepository = new LongformPlanRepository(input.projectDatabase);

  const project = projectRepository.getOverview(input.projectId);
  const creativePath = creativePathRepository.getPath(input.projectId);
  const worldbuildingProfile = worldbuildingRepository.getProfile(input.projectId);
  const worldRules = worldRepository.listWorldRules(input.projectId);
  const locations = worldRepository.listLocations(input.projectId);
  const organizations = worldRepository.listOrganizations(input.projectId);
  const items = worldRepository.listItems(input.projectId);
  const characters = characterRepository.listCharacters(input.projectId);
  const entityRelations = characterRepository.listRelations({ projectId: input.projectId });
  const plotlines = plotRepository.listPlotlines(input.projectId);
  const storyEvents = plotRepository.listStoryEvents(input.projectId);
  const eventRelations = plotRepository.listEventRelations(input.projectId);
  const conflicts = plotRepository.listConflicts(input.projectId);
  const foreshadowings = plotRepository.listForeshadowings(input.projectId);
  const outlines = outlineRepository.listOutlines(input.projectId);
  const volumeOutlines = outlineRepository.listVolumeOutlines(input.projectId);
  const chapterOutlines = outlineRepository.listChapterOutlines(input.projectId);
  const sceneOutlines = outlineRepository.listSceneOutlines(input.projectId);
  const chapters = input.includeChapters
    ? chapterRepository.listChapters({ projectId: input.projectId }).slice(-30)
    : [];

  const contextItems: Array<CreativeContextItem | undefined> = [
    project
      ? createContextItem({
          itemId: project.id,
          itemType: "creative_project",
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
        })
      : undefined,
    creativePath.brief
      ? createContextItem({
          itemId: creativePath.brief.id,
          itemType: "project_brief",
          rank: 2,
          sectionName: "brief",
          value: creativePath.brief,
        })
      : undefined,
    creativePath.blueprint
      ? createContextItem({
          itemId: creativePath.blueprint.id,
          itemType: "story_blueprint",
          rank: 3,
          sectionName: "blueprint",
          value: creativePath.blueprint,
        })
      : undefined,
    worldbuildingProfile
      ? createContextItem({
          itemId: `${input.projectId}:worldbuilding_profile`,
          itemType: "worldbuilding_profile",
          rank: 4,
          sectionName: "worldbuildingProfile",
          value: worldbuildingProfile.fields,
        })
      : undefined,
    worldRules.length > 0 || locations.length > 0 || organizations.length > 0 || items.length > 0
      ? createContextItem({
          itemId: `${input.projectId}:world_canon`,
          itemType: "world_canon",
          rank: 5,
          sectionName: "worldCanon",
          value: {
            items: items.slice(0, 80).map((item) => ({
              description: item.description,
              id: item.id,
              name: item.name,
              type: item.type,
            })),
            locations: locations.slice(0, 80).map((location) => ({
              description: location.description,
              id: location.id,
              name: location.name,
              type: location.type,
            })),
            organizations: organizations.slice(0, 80).map((organization) => ({
              description: organization.description,
              id: organization.id,
              name: organization.name,
              type: organization.type,
            })),
            worldRules: worldRules.slice(0, 120).map((rule) => ({
              category: rule.category,
              content: rule.content,
              id: rule.id,
              source: rule.source,
              status: rule.status,
              title: rule.title,
            })),
          },
        })
      : undefined,
    characters.length > 0
      ? createContextItem({
          itemId: `${input.projectId}:characters`,
          itemType: "characters",
          rank: 6,
          sectionName: "characters",
          value: characters.slice(0, 120).map((character) => ({
            appearance: character.appearance,
            arcEnd: character.arcEnd,
            arcStart: character.arcStart,
            arcTurn: character.arcTurn,
            archetype: character.archetype,
            firstAppearance: character.firstAppearance,
            genderAge: character.genderAge,
            id: character.id,
            importance: character.importance,
            motivation: character.motivation,
            name: character.name,
            narrativeFunction: character.narrativeFunction,
            profile: character.profile,
            relationshipHook: character.relationshipHook,
            role: character.role,
            storyTask: character.storyTask,
            traits: character.traits.map((trait) => ({
              kind: trait.name,
              value: trait.value,
            })),
          })),
        })
      : undefined,
    entityRelations.length > 0
      ? createContextItem({
          itemId: `${input.projectId}:entity_relations`,
          itemType: "entity_relations",
          rank: 7,
          sectionName: "entityRelations",
          value: entityRelations.slice(0, 180).map((relation) => ({
            description: relation.description,
            id: relation.id,
            polarity: relation.polarity,
            relationType: relation.relationType,
            sourceEntityId: relation.sourceEntityId,
            sourceEntityType: relation.sourceEntityType,
            status: relation.status,
            strength: relation.strength,
            targetEntityId: relation.targetEntityId,
            targetEntityType: relation.targetEntityType,
          })),
        })
      : undefined,
    plotlines.length > 0
      ? createContextItem({
          itemId: `${input.projectId}:plotlines`,
          itemType: "plotlines",
          rank: 8,
          sectionName: "plotlines",
          value: plotlines.slice(0, 80).map((plotline) => ({
            centralQuestion: plotline.centralQuestion,
            driver: plotline.driver,
            emotionalPromise: plotline.emotionalPromise,
            id: plotline.id,
            importance: plotline.importance,
            kind: plotline.type,
            narrativeRole: plotline.narrativeRole,
            nodes: plotline.nodes.map((node) => ({
              chapterHint: node.chapterHint,
              description: node.description,
              id: node.id,
              kind: node.kind,
              position: node.position,
              status: node.status,
              targetChapterId: node.targetChapterId,
              title: node.title,
            })),
            payoffPlan: plotline.payoffPlan,
            priority: plotline.priority,
            relatedCharacterIds: plotline.relatedCharacterIds,
            relatedForeshadowingIds: plotline.relatedForeshadowingIds,
            relatedStoryEventIds: plotline.relatedStoryEventIds,
            relatedWorldRuleIds: plotline.relatedWorldRuleIds,
            startState: plotline.startState,
            status: plotline.status,
            summary: plotline.summary,
            title: plotline.name,
          })),
        })
      : undefined,
    storyEvents.length > 0
      ? createContextItem({
          itemId: `${input.projectId}:story_events`,
          itemType: "story_events",
          rank: 9,
          sectionName: "storyEvents",
          value: storyEvents.slice(0, 160).map((event) => ({
            chapterId: event.chapterId,
            eventType: event.eventType,
            id: event.id,
            outcome: event.outcome,
            participants: event.participants.map((participant) => ({
              entityId: participant.entityId,
              entityType: participant.entityType,
              role: participant.role,
            })),
            sceneId: event.sceneId,
            status: event.status,
            storyTime: event.storyTime,
            summary: event.summary,
            title: event.title,
          })),
        })
      : undefined,
    eventRelations.length > 0
      ? createContextItem({
          itemId: `${input.projectId}:event_relations`,
          itemType: "event_relations",
          rank: 10,
          sectionName: "eventRelations",
          value: eventRelations.slice(0, 180).map((relation) => ({
            description: relation.description,
            id: relation.id,
            relationType: relation.relationType,
            sourceEventId: relation.sourceEventId,
            targetEventId: relation.targetEventId,
          })),
        })
      : undefined,
    conflicts.length > 0
      ? createContextItem({
          itemId: `${input.projectId}:conflicts`,
          itemType: "conflicts",
          rank: 11,
          sectionName: "conflicts",
          value: conflicts.slice(0, 120).map((conflict) => ({
            conflictType: conflict.conflictType,
            escalationPath: conflict.escalationPath,
            id: conflict.id,
            opposingForces: conflict.opposingForces,
            relatedPlotlineId: conflict.relatedPlotlineId,
            stakes: conflict.stakes,
            status: conflict.status,
            title: conflict.title,
          })),
        })
      : undefined,
    foreshadowings.length > 0
      ? createContextItem({
          itemId: `${input.projectId}:foreshadowings`,
          itemType: "foreshadowings",
          rank: 12,
          sectionName: "foreshadowings",
          value: foreshadowings.slice(0, 120).map((foreshadowing) => ({
            id: foreshadowing.id,
            importance: foreshadowing.importance,
            links: foreshadowing.links.map((link) => ({
              eventId: link.eventId,
              note: link.note,
              role: link.role,
            })),
            payoffText: foreshadowing.payoffText,
            seedText: foreshadowing.seedText,
            status: foreshadowing.status,
            title: foreshadowing.title,
          })),
        })
      : undefined,
    outlines.length > 0 ||
    volumeOutlines.length > 0 ||
    chapterOutlines.length > 0 ||
    sceneOutlines.length > 0
      ? createContextItem({
          itemId: `${input.projectId}:outline_plans`,
          itemType: "outline_plans",
          rank: 13,
          sectionName: "outlinePlans",
          value: {
            chapterOutlines: chapterOutlines.slice(0, 80).map((outline) => ({
              chapterGoal: outline.chapterGoal,
              conflict: outline.conflict,
              emotionalTurn: outline.emotionalTurn,
              hook: outline.hook,
              id: outline.id,
              informationGain: outline.informationGain,
              outlineId: outline.outlineId,
              relatedForeshadowingIds: outline.relatedForeshadowingIds,
              relatedPlotlineNodeIds: outline.relatedPlotlineNodeIds,
              requiredCharacterIds: outline.requiredCharacterIds,
              sortOrder: outline.sortOrder,
              status: outline.status,
              targetWordCount: outline.targetWordCount,
              title: outline.title,
              volumeOutlineId: outline.volumeOutlineId,
            })),
            outlines: outlines.slice(0, 10).map((outline) => ({
              basis: outline.basis,
              id: outline.id,
              scope: outline.scope,
              status: outline.status,
              title: outline.title,
              version: outline.version,
            })),
            sceneOutlines: sceneOutlines.slice(0, 120).map((outline) => ({
              beatType: outline.beatType,
              chapterOutlineId: outline.chapterOutlineId,
              conflict: outline.conflict,
              entryState: outline.entryState,
              exitState: outline.exitState,
              id: outline.id,
              locationId: outline.locationId,
              povCharacterId: outline.povCharacterId,
              purpose: outline.purpose,
              sortOrder: outline.sortOrder,
              status: outline.status,
              title: outline.title,
            })),
            volumeOutlines: volumeOutlines.slice(0, 40).map((outline) => ({
              climax: outline.climax,
              id: outline.id,
              majorConflict: outline.majorConflict,
              outlineId: outline.outlineId,
              purpose: outline.purpose,
              sortOrder: outline.sortOrder,
              status: outline.status,
              title: outline.title,
              wordCountGoal: outline.wordCountGoal,
            })),
          },
        })
      : undefined,
    input.includeLongformPlans
      ? createContextItem({
          itemId: `${input.projectId}:longform_plans`,
          itemType: "longform_plans",
          rank: 14,
          sectionName: "longformPlans",
          value: {
            arcPlans: longformPlanRepository.listArcPlans(input.projectId).slice(0, 30),
            bookPlans: longformPlanRepository.listBookPlans(input.projectId).slice(0, 5),
            chapterPlans: longformPlanRepository.listChapterPlans(input.projectId).slice(0, 60),
            scenePlans: longformPlanRepository.listScenePlans(input.projectId).slice(0, 120),
            volumePlans: longformPlanRepository.listVolumePlans(input.projectId).slice(0, 20),
          },
        })
      : undefined,
    chapters.length > 0
      ? createContextItem({
          itemId: `${input.projectId}:recent_chapters`,
          itemType: "recent_chapters",
          rank: 15,
          sectionName: "recentChapters",
          value: chapters.map((chapter) => ({
            id: chapter.id,
            status: chapter.status,
            summary: chapter.synopsis,
            title: chapter.title,
            version: chapter.version,
          })),
        })
      : undefined,
  ];

  return trimCreativeContextItems(
    contextItems.filter((item): item is CreativeContextItem => item !== undefined),
    input.tokenBudget ?? 16000,
  );
}

export function creativeContextText(items: readonly CreativeContextItem[]): string {
  return items.map((item) => item.content).join("\n\n");
}

export function toContextBuilderItems(items: readonly CreativeContextItem[]): ContextPackageItem[] {
  return items.map((item) => ({
    content: item.content,
    itemId: item.itemId,
    itemType: item.itemType,
    rank: item.rank,
    ...(item.metadata === undefined ? {} : { metadata: item.metadata }),
  }));
}

function createContextItem(input: {
  readonly itemId: string;
  readonly itemType: string;
  readonly rank: number;
  readonly sectionName: string;
  readonly value: unknown;
}): CreativeContextItem {
  return {
    content: formatSection(input.sectionName, input.value),
    contextPackageItemId: randomUUID(),
    itemId: input.itemId,
    itemType: input.itemType,
    rank: input.rank,
    metadata: { sectionName: input.sectionName },
  };
}

function formatSection(name: string, value: unknown): string {
  return `<${name}>\n${JSON.stringify(value, null, 2)}\n</${name}>`;
}

function trimCreativeContextItems(
  items: readonly CreativeContextItem[],
  tokenBudget: number,
): CreativeContextItem[] {
  const charBudget = Math.max(4000, tokenBudget * 4);
  const kept: CreativeContextItem[] = [];
  let used = 0;

  for (const item of items) {
    const cost = item.content.length;
    if (used + cost > charBudget && kept.length > 0) {
      continue;
    }
    kept.push(item);
    used += cost;
  }

  return kept;
}
