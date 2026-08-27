import { describe, expect, it } from "vitest";

import { MVP_COMMAND_NAMES, commandSchemas, parseCommandPayload } from "./index.js";

describe("command registry", () => {
  it("contains the MVP command set", () => {
    expect(MVP_COMMAND_NAMES).toEqual([
      "app.health",
      "project.create",
      "project.listRecent",
      "project.open",
      "project.getOverview",
      "project.backup",
      "workbench.getSnapshot",
      "workbench.getBoard",
      "chapter.list",
      "chapter.get",
      "chapter.create",
      "chapter.saveContent",
      "chapter.listVersions",
      "chapter.restoreVersion",
      "chapter.generateDraft",
      "chapter.reviewContinuity",
      "character.list",
      "character.create",
      "character.update",
      "character.generateNames",
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
    ]);
  });

  it("keeps command names and schemas aligned", () => {
    expect(Object.keys(commandSchemas)).toEqual([...MVP_COMMAND_NAMES]);
  });

  it("parses project.create payloads", () => {
    expect(
      parseCommandPayload("project.create", {
        title: "长夜序章",
        genre: "悬疑",
      }),
    ).toEqual({
      title: "长夜序章",
      genre: "悬疑",
    });
  });

  it("parses chapter.saveContent payloads", () => {
    expect(
      parseCommandPayload("chapter.saveContent", {
        projectId: "proj_1",
        chapterId: "chapter_1",
        content: "雨夜来信",
        baseVersion: 1,
      }),
    ).toEqual({
      projectId: "proj_1",
      chapterId: "chapter_1",
      content: "雨夜来信",
      baseVersion: 1,
    });
  });

  it("rejects unknown commands", () => {
    expect(() => parseCommandPayload("unknown.command", {})).toThrow("UNKNOWN_COMMAND");
  });

  it("rejects invalid command payloads", () => {
    expect(() =>
      parseCommandPayload("memory.confirm", {
        projectId: "proj_1",
        candidateId: "candidate_1",
        decision: "auto_canon",
      }),
    ).toThrow();
  });
});
