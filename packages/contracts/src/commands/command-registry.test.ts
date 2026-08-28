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
        style: "悬疑推理",
      }),
    ).toEqual({
      title: "长夜序章",
      genre: "悬疑",
      style: "悬疑推理",
    });
  });

  it("parses element candidate generation and acceptance payloads", () => {
    expect(
      parseCommandPayload("element.generateCandidates", {
        constraints: ["不使用现代科技词"],
        count: 10,
        elementType: "weapon",
        genre: "玄幻",
        projectId: "proj_1",
        style: "热血",
        worldRuleIds: ["rule_1"],
      }),
    ).toEqual({
      constraints: ["不使用现代科技词"],
      count: 10,
      elementType: "weapon",
      genre: "玄幻",
      projectId: "proj_1",
      style: "热血",
      worldRuleIds: ["rule_1"],
    });

    expect(
      parseCommandPayload("element.acceptCandidates", {
        items: [
          {
            description: "旧城禁军遗失的短刃。",
            name: "夜照",
            rationale: "适合悬疑题材里的线索武器。",
            tags: ["旧城", "线索"],
            type: "weapon",
          },
        ],
        projectId: "proj_1",
      }),
    ).toEqual({
      items: [
        {
          description: "旧城禁军遗失的短刃。",
          name: "夜照",
          rationale: "适合悬疑题材里的线索武器。",
          tags: ["旧城", "线索"],
          type: "weapon",
        },
      ],
      projectId: "proj_1",
    });
  });

  it("parses creative path and outline payloads", () => {
    expect(
      parseCommandPayload("brief.save", {
        emotionalRewards: ["爽点", "悬疑"],
        forbiddenDirections: ["不要系统流"],
        genre: "玄幻",
        initialIdea: "少年发现旧都遗物。",
        lengthProfile: "长篇连载",
        narrativePov: "第三人称",
        platformProfile: "男频",
        projectId: "proj_1",
        subgenres: ["废柴逆袭"],
        targetAudience: "男频爽文",
      }),
    ).toMatchObject({
      genre: "玄幻",
      initialIdea: "少年发现旧都遗物。",
      subgenres: ["废柴逆袭"],
      targetAudience: "男频爽文",
    });

    expect(
      parseCommandPayload("outline.generate", {
        chapterCount: 10,
        projectId: "proj_1",
        scope: "chapter_batch",
      }),
    ).toEqual({
      chapterCount: 10,
      projectId: "proj_1",
      scope: "chapter_batch",
    });

    expect(
      parseCommandPayload("chapter.generateDraftFromOutline", {
        chapterOutlineId: "chapter_outline_1",
        instruction: "强化悬疑钩子",
        projectId: "proj_1",
      }),
    ).toEqual({
      chapterOutlineId: "chapter_outline_1",
      instruction: "强化悬疑钩子",
      projectId: "proj_1",
    });
  });

  it("rejects unsupported element candidate counts and empty acceptance batches", () => {
    expect(() =>
      parseCommandPayload("element.generateCandidates", {
        count: 7,
        elementType: "weapon",
        projectId: "proj_1",
      }),
    ).toThrow();

    expect(() =>
      parseCommandPayload("element.acceptCandidates", {
        items: [],
        projectId: "proj_1",
      }),
    ).toThrow();
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

  it("parses story events with participants", () => {
    expect(
      parseCommandPayload("storyEvent.create", {
        projectId: "proj_1",
        title: "雨夜来信",
        description: "主角收到关键线索。",
        eventType: "discovery",
        participants: [
          {
            entityType: "character",
            entityId: "char_1",
            role: "discoverer",
          },
        ],
      }),
    ).toMatchObject({
      participants: [
        {
          entityType: "character",
          entityId: "char_1",
          role: "discoverer",
        },
      ],
    });
  });

  it("parses foreshadowings with seed and payoff event links", () => {
    expect(
      parseCommandPayload("foreshadowing.create", {
        projectId: "proj_1",
        title: "旧报纸日期",
        description: "门缝下露出的旧报纸日期。",
        payoffExpectation: "揭示十年前的火灾不是事故。",
        seedEventId: "event_seed",
        payoffEventId: "event_payoff",
      }),
    ).toMatchObject({
      payoffEventId: "event_payoff",
      seedEventId: "event_seed",
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
