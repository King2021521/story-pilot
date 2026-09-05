import { describe, expect, it } from "vitest";

import { PromptTemplateRegistry, buildPromptTemplateMessages } from "./prompt-template-registry.js";

describe("PromptTemplateRegistry", () => {
  it("renders every longform template through the shared template pipeline", () => {
    const cases = [
      {
        defaultInstruction: "生成全书规划",
        requiredVariables: ["project", "brief", "worldbuildingProfile", "blueprint"],
        templateId: "book-plan.generate",
      },
      {
        defaultInstruction: "生成滚动章节规划",
        requiredVariables: [
          "project",
          "brief",
          "worldbuildingProfile",
          "blueprint",
          "longformPlans",
        ],
        templateId: "rolling-chapter-plan.generate",
      },
      {
        defaultInstruction: "生成章节执行卡",
        requiredVariables: ["project", "chapterPlan", "contextPackage"],
        templateId: "chapter-execution-card.generate",
      },
      {
        defaultInstruction: "生成章节正文草稿",
        requiredVariables: ["project", "chapterExecutionCard", "contextPackage"],
        templateId: "chapter-draft.generate",
      },
      {
        defaultInstruction: "审阅章节草稿",
        requiredVariables: ["project", "chapterExecutionCard", "currentArtifact", "contextPackage"],
        templateId: "chapter-review.generate",
      },
      {
        defaultInstruction: "抽取故事状态变化",
        requiredVariables: ["project", "chapter", "contextPackage"],
        templateId: "story-state-delta.extract",
      },
      {
        defaultInstruction: "更新剧情债",
        requiredVariables: ["project", "currentArtifact", "contextPackage"],
        templateId: "plot-debt.update",
      },
      {
        defaultInstruction: "生成阶段复盘",
        requiredVariables: ["project", "reviewScope", "contextPackage"],
        templateId: "serial-review.generate",
      },
      {
        defaultInstruction: "生成创作要素候选",
        requiredVariables: ["project", "brief", "generationRequest"],
        templateId: "element-candidate.generate",
      },
    ] as const;

    for (const testCase of cases) {
      const template = PromptTemplateRegistry.getTemplate(testCase.templateId, "v1");
      const variables = Object.fromEntries(
        [...testCase.requiredVariables, "userInstruction"].map((name) => [
          name,
          name === "project" ? { title: "雪境堡垒", genre: "冰雪末世" } : `${name}-fixture`,
        ]),
      );
      const messages = buildPromptTemplateMessages({
        templateId: testCase.templateId,
        variables,
      });
      const promptText = messages.map((message) => message.content).join("\n");

      expect(template.requiredVariables).toEqual(testCase.requiredVariables);
      expect(template.defaultInstruction).toContain(testCase.defaultInstruction);
      expect(promptText).toContain(`模板：${testCase.templateId}@v1`);
      expect(promptText).toContain("你是 Story Pilot 的文学创作引擎");
      expect(promptText).toContain("Canon 边界");
      expect(promptText).toContain("<project>");
      expect(promptText).toContain('"title": "雪境堡垒"');
      for (const variableName of testCase.requiredVariables) {
        expect(promptText).toContain(`<${variableName}>`);
      }
    }
  });

  it("rejects missing required variables for execution card generation", () => {
    expect(() =>
      buildPromptTemplateMessages({
        templateId: "chapter-execution-card.generate",
        variables: {
          chapterPlan: { title: "第一章 白灾入屋" },
          project: { title: "雪境堡垒" },
        },
      }),
    ).toThrow(
      "PROMPT_TEMPLATE_MISSING_VARIABLES: chapter-execution-card.generate@v1 missing contextPackage",
    );
  });

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
