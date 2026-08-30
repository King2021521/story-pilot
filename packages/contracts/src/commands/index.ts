import type { z } from "zod";

import { aiCommandSchemas } from "./ai.js";
import { chapterCommandSchemas } from "./chapter.js";
import { creativeCommandSchemas, creativePathCommandSchemas } from "./creative.js";
import { memoryCommandSchemas } from "./memory.js";
import { projectCommandSchemas } from "./project.js";
import { settingsCommandSchemas } from "./settings.js";
import { workflowCommandSchemas } from "./workflow.js";

export const MVP_COMMAND_NAMES = [
  "app.health",
  "settings.get",
  "settings.update",
  "settings.validateModel",
  "diagnostics.getHealth",
  "diagnostics.export",
  "project.create",
  "project.listRecent",
  "project.open",
  "project.getOverview",
  "project.backup",
  "backup.createProject",
  "backup.restoreProject",
  "workbench.getSnapshot",
  "workbench.getBoard",
  "ai.generate",
  "ai.getRun",
  "ai.cancelRun",
  "ai.listArtifacts",
  "creativeStage.getPath",
  "creativeStage.evaluateGate",
  "creativeStage.advance",
  "creativeStage.reopen",
  "creativeStage.skip",
  "creativeStage.complete",
  "brief.save",
  "brief.confirm",
  "blueprint.generate",
  "blueprint.saveForm",
  "blueprint.completeForm",
  "blueprint.apply",
  "outline.generate",
  "outline.saveDraft",
  "outline.saveVolumeOutline",
  "outline.saveChapterOutline",
  "outline.saveSceneOutline",
  "outline.approveChapterOutline",
  "outline.applyChapterOutline",
  "plot.generateBookPlan",
  "plot.applyBookPlan",
  "plot.saveBookPlanDraft",
  "plot.saveVolumePlan",
  "plot.saveArcPlan",
  "plot.saveChapterPlan",
  "plot.saveScenePlan",
  "plot.generateRollingOutline",
  "plot.applyChapterPlans",
  "plot.analyzeOutlineImpact",
  "chapter.list",
  "chapter.get",
  "chapter.create",
  "chapter.saveContent",
  "chapter.listVersions",
  "chapter.restoreVersion",
  "chapter.generateDraft",
  "chapter.generateDraftFromOutline",
  "chapter.generateDraftFromPlan",
  "chapter.reviewContinuity",
  "character.list",
  "character.create",
  "character.update",
  "entityRelation.list",
  "entityRelation.create",
  "entityRelation.update",
  "character.generateNames",
  "element.generateCandidates",
  "element.acceptCandidates",
  "worldRule.list",
  "worldRule.create",
  "worldRule.update",
  "worldbuilding.saveFields",
  "worldbuilding.completeFields",
  "plotline.list",
  "plotline.create",
  "plotline.update",
  "plotline.createNode",
  "plotline.updateNode",
  "storyEvent.list",
  "storyEvent.create",
  "storyEvent.update",
  "eventRelation.list",
  "eventRelation.create",
  "eventRelation.update",
  "conflict.list",
  "conflict.create",
  "conflict.update",
  "foreshadowing.list",
  "foreshadowing.create",
  "foreshadowing.update",
  "foreshadowing.plan",
  "workOrder.list",
  "workOrder.get",
  "workflow.run",
  "workflow.cancel",
  "workflow.retry",
  "artifact.get",
  "artifact.apply",
  "artifact.reject",
  "memory.listCandidates",
  "memory.confirm",
  "memory.reject",
  "memory.merge",
  "memory.search",
  "graph.getNeighborhood",
  "graph.findContradictions",
  "graph.rebuild",
  "graph.projectSinceCheckpoint",
] as const;

export type CommandName = (typeof MVP_COMMAND_NAMES)[number];

const { "app.health": appHealthCommandSchema, ...projectFeatureCommandSchemas } =
  projectCommandSchemas;

export const commandSchemas = {
  "app.health": appHealthCommandSchema,
  ...settingsCommandSchemas,
  ...projectFeatureCommandSchemas,
  ...aiCommandSchemas,
  ...creativePathCommandSchemas,
  ...chapterCommandSchemas,
  ...creativeCommandSchemas,
  ...workflowCommandSchemas,
  ...memoryCommandSchemas,
} satisfies Record<string, z.ZodType>;

export type CommandSchemas = typeof commandSchemas;

export type CommandPayload<TCommand extends keyof CommandSchemas> = z.infer<
  CommandSchemas[TCommand]
>;

export function isCommandName(command: string): command is CommandName {
  return Object.prototype.hasOwnProperty.call(commandSchemas, command);
}

export function parseCommandPayload<TCommand extends CommandName>(
  command: TCommand,
  payload: unknown,
): CommandPayload<TCommand>;
export function parseCommandPayload(command: string, payload: unknown): unknown;
export function parseCommandPayload(command: string, payload: unknown): unknown {
  if (!isCommandName(command)) {
    throw new Error(`UNKNOWN_COMMAND: ${command}`);
  }

  return commandSchemas[command].parse(payload ?? {});
}
