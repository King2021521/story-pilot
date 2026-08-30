import { describe, expect, it } from "vitest";

import { PromptTemplateRegistry, buildPromptTemplateMessages } from "./prompt-template-registry.js";

describe("PromptTemplateRegistry", () => {
  it("renders a task-specific template with declared variables", () => {
    const template = PromptTemplateRegistry.getTemplate("worldbuilding.complete", "v1");
    const messages = buildPromptTemplateMessages({
      templateId: "worldbuilding.complete",
      variables: {
        brief: {
          estimatedWordCount: 5_000_000,
          genre: "冰雪末世",
          initialIdea: "极寒纪元降临，主角提前打造山顶安全屋。",
        },
        currentFields: {
          worldBase: "冰雪末世，安全屋是故事核心舞台。",
        },
        existingCanon: {
          worldRules: [{ title: "热源闭环", content: "热量不能凭空产生。" }],
        },
        project: {
          genre: "冰雪末世",
          style: "硬核生存、基地经营",
          title: "雪境堡垒",
        },
      },
    });
    const promptText = messages.map((message) => message.content).join("\n");

    expect(template).toMatchObject({
      capability: "worldbuilding_generate",
      id: "worldbuilding.complete",
      requiredVariables: ["project", "brief", "currentFields"],
      version: "v1",
    });
    expect(promptText).toContain("模板：worldbuilding.complete@v1");
    expect(promptText).toContain("<project>");
    expect(promptText).toContain('"title": "雪境堡垒"');
    expect(promptText).toContain("<currentFields>");
    expect(promptText).toContain("热源闭环");
    expect(promptText).toContain("补全 12 个世界观表单字段");
  });

  it("rejects missing required variables before model calls", () => {
    expect(() =>
      buildPromptTemplateMessages({
        templateId: "worldbuilding.complete",
        variables: {
          currentFields: {},
          project: { title: "雪境堡垒" },
        },
      }),
    ).toThrow("PROMPT_TEMPLATE_MISSING_VARIABLES: worldbuilding.complete@v1 missing brief");
  });

  it("keeps core story completion on a separate template contract", () => {
    const template = PromptTemplateRegistry.getTemplate("core-story.complete", "v1");

    expect(template).toMatchObject({
      capability: "core_story_complete",
      id: "core-story.complete",
      requiredVariables: ["project", "currentFields"],
    });
    expect(template.defaultInstruction).toContain("补全核心故事表单");
    expect(template.optionalVariables).toEqual(
      expect.arrayContaining(["brief", "worldbuildingProfile", "currentBlueprint"]),
    );
  });
});
