import { getTableName } from "drizzle-orm";

import { chapterVersions, chapters, scenes } from "./chapter.js";
import { characterTraits, characters, entityRelations } from "./character.js";
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
import { artifacts, modelCalls, workflowRuns, workflowSteps, workOrders } from "./workflow.js";

export * from "./chapter.js";
export * from "./character.js";
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
  contextPackages,
  contextPackageItems,
  files,
  domainEvents,
  projectionCheckpoints,
} as const;

export const projectSchemaTables = Object.values(projectSchema);

export const schemaTableNames = projectSchemaTables.map((table) => getTableName(table));
