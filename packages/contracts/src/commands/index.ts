import type { z } from "zod";

import { chapterCommandSchemas } from "./chapter.js";
import { creativeCommandSchemas, creativePathCommandSchemas } from "./creative.js";
import { memoryCommandSchemas } from "./memory.js";
import { projectCommandSchemas } from "./project.js";
import { workflowCommandSchemas } from "./workflow.js";

export const MVP_COMMAND_NAMES = [
  "app.health",
  "project.create",
  "project.listRecent",
  "project.open",
  "project.getOverview",
  "project.backup",
  "workbench.getSnapshot",
  "workbench.getBoard",
  "creativeStage.getPath",
  "brief.save",
  "brief.confirm",
  "blueprint.generate",
  "blueprint.apply",
  "outline.generate",
  "outline.approveChapterOutline",
  "outline.applyChapterOutline",
  "chapter.list",
  "chapter.get",
  "chapter.create",
  "chapter.saveContent",
  "chapter.listVersions",
  "chapter.restoreVersion",
  "chapter.generateDraft",
  "chapter.generateDraftFromOutline",
  "chapter.reviewContinuity",
  "character.list",
  "character.create",
  "character.update",
  "character.generateNames",
  "element.generateCandidates",
  "element.acceptCandidates",
  "worldRule.list",
  "worldRule.create",
  "worldRule.update",
  "plotline.list",
  "plotline.create",
  "plotline.updateNode",
  "storyEvent.list",
  "storyEvent.create",
  "foreshadowing.list",
  "foreshadowing.create",
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
] as const;

export type CommandName = (typeof MVP_COMMAND_NAMES)[number];

export const commandSchemas = {
  ...projectCommandSchemas,
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
