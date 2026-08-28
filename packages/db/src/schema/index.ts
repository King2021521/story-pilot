import { getTableName } from "drizzle-orm";

import { chapterVersions, chapters, scenes } from "./chapter.js";
import { characterTraits, characters, entityRelations } from "./character.js";
import {
  characterArcs,
  characterRelations,
  arcPlans,
  bookPlans,
  chapterOutlines,
  chapterPlans,
  conflicts,
  creativeStages,
  outlines,
  powerSystems,
  projectBriefs,
  retrospectives,
  reviewIssues,
  sceneOutlines,
  scenePlans,
  storyBlueprints,
  volumePlans,
  volumeOutlines,
} from "./creative-path.js";
import { domainEvents } from "./events.js";
import {
  contextPackageItems,
  contextPackages,
  memories,
  memoryCandidates,
  projectionCheckpoints,
} from "./memory.js";
import {
  eventParticipants,
  eventRelations,
  foreshadowingEvents,
  foreshadowings,
  plotlineNodes,
  plotlines,
  storyEvents,
} from "./plot.js";
import { files, projects, volumes, works } from "./project.js";
import { items, locations, organizations, worldRules } from "./world.js";
import {
  aiCapabilities,
  aiEvalRuns,
  artifacts,
  modelCalls,
  promptVersions,
  qualityReports,
  workflowRuns,
  workflowSteps,
  workOrders,
} from "./workflow.js";

export * from "./chapter.js";
export * from "./character.js";
export * from "./creative-path.js";
export * from "./events.js";
export * from "./memory.js";
export * from "./plot.js";
export * from "./project.js";
export * from "./workflow.js";
export * from "./world.js";

export const projectSchema = {
  projects,
  works,
  volumes,
  chapters,
  chapterVersions,
  scenes,
  characters,
  characterTraits,
  entityRelations,
  creativeStages,
  projectBriefs,
  storyBlueprints,
  powerSystems,
  characterRelations,
  characterArcs,
  conflicts,
  outlines,
  volumeOutlines,
  chapterOutlines,
  sceneOutlines,
  bookPlans,
  volumePlans,
  arcPlans,
  chapterPlans,
  scenePlans,
  reviewIssues,
  retrospectives,
  worldRules,
  locations,
  organizations,
  items,
  plotlines,
  plotlineNodes,
  storyEvents,
  eventParticipants,
  eventRelations,
  foreshadowings,
  foreshadowingEvents,
  workOrders,
  workflowRuns,
  workflowSteps,
  artifacts,
  memoryCandidates,
  memories,
  modelCalls,
  aiCapabilities,
  promptVersions,
  qualityReports,
  aiEvalRuns,
  contextPackages,
  contextPackageItems,
  files,
  domainEvents,
  projectionCheckpoints,
} as const;

export const projectSchemaTables = Object.values(projectSchema);

export const schemaTableNames = projectSchemaTables.map((table) => getTableName(table));
