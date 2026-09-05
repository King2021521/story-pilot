import { describe, expect, it } from "vitest";

import { PromptRegistry, buildPromptMessages } from "./prompt-registry.js";

describe("PromptRegistry", () => {
  it("builds chapter draft prompts with canon boundary and output contract", () => {
    const prompt = PromptRegistry.getPrompt("chapter_draft", "v1");
    const messages = buildPromptMessages({
      capability: "chapter_draft",
      context: "人物：林澈。伏笔：旧报纸日期。",
      instruction: "写第一章。",
      version: "v1",
    });
    const content = messages.map((message) => message.content).join("\n");

    expect(prompt.version).toBe("v1");
    expect(prompt.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(content).toContain("不得直接修改正文章节");
    expect(content).toContain("输出必须是 JSON");
    expect(content).toContain("chapter_draft");
    expect(content).toContain("人物：林澈");
  });

  it("keeps chapter draft prompt aligned with structured output fields", () => {
    const prompt = PromptRegistry.getPrompt("chapter_draft", "v1");

    expect(prompt.content).toContain('"body"');
    expect(prompt.content).toContain('"summary"');
    expect(prompt.content).toContain('"reviewNotes"');
    expect(prompt.content).not.toContain('"content": "章节正文草稿"');
    expect(prompt.content).not.toContain("continuityNotes");
  });

  it("keeps extracted memories as candidates until user confirmation", () => {
    const prompt = PromptRegistry.getPrompt("memory_extract", "v1");

    expect(prompt.content).toContain("候选记忆");
    expect(prompt.content).toContain("不得写入正式 canon");
    expect(prompt.content).toContain("sourceQuote");
    expect(prompt.content).toContain("sourceSummary");
    expect(prompt.content).toContain("等待用户确认");
  });

  it("loads continuity review prompt with structured issue contract", () => {
    const prompt = PromptRegistry.getPrompt("continuity_review", "v1");

    expect(prompt.content).toContain("连续性审阅器");
    expect(prompt.content).toContain("canon");
    expect(prompt.content).toContain("hypothesis");
    expect(prompt.content).toContain("issues");
    expect(prompt.content).toContain("severity");
  });

  it("loads foreshadowing plan prompt with actionable suggestion contract", () => {
    const prompt = PromptRegistry.getPrompt("foreshadowing_plan", "v1");

    expect(prompt.content).toContain("伏笔规划器");
    expect(prompt.content).toContain("suggestions");
    expect(prompt.content).toContain("action");
  });

  it("loads element generation prompt for non-canon candidate batches", () => {
    const prompt = PromptRegistry.getPrompt("element_generate", "v1");

    expect(prompt.content).toContain("要素候选生成器");
    expect(prompt.content).toContain("items");
    expect(prompt.content).toContain("不得写入正式 canon");
    expect(prompt.content).toContain("避免同质化命名");
  });

  it("loads worldbuilding form completion prompt with fixed 12-dimension JSON contract", () => {
    const prompt = PromptRegistry.getPrompt("worldbuilding_generate", "v1");

    expect(prompt.content).toContain("世界观表单补全器");
    expect(prompt.content).toContain("模板变量");
    expect(prompt.content).toContain("currentFields");
    expect(prompt.content).toContain('"worldBase"');
    expect(prompt.content).toContain('"specialMechanism"');
    expect(prompt.content).toContain("每个字段 300 到 500 字");
    expect(prompt.content).toContain("整体闭环");
    expect(prompt.content).toContain("设定描述、运行规则、叙事冲突、代价限制、剧情接口");
    expect(prompt.content).not.toContain('"items"');
  });

  it("loads core story form completion prompt with editable field JSON contract", () => {
    const prompt = PromptRegistry.getPrompt("core_story_complete", "v1");

    expect(prompt.content).toContain("核心故事表单补全器");
    expect(prompt.content).toContain("模板变量");
    expect(prompt.content).toContain("currentFields");
    expect(prompt.content).toContain("worldbuildingProfile");
    expect(prompt.content).toContain('"mainGoal"');
    expect(prompt.content).toContain('"storyDriver"');
    expect(prompt.content).toContain("200 到 800 字");
    expect(prompt.content).toContain("只输出 JSON");
  });

  it("loads longform planning prompts with layered outline contracts", () => {
    const bookPlanPrompt = PromptRegistry.getPrompt("book_plan_generate", "v1");
    const rollingPrompt = PromptRegistry.getPrompt("rolling_chapter_plan_generate", "v1");

    expect(bookPlanPrompt.content).toContain("Book Plan");
    expect(bookPlanPrompt.content).toContain("Volume Plan");
    expect(bookPlanPrompt.content).toContain("Arc Plan");
    expect(bookPlanPrompt.content).toContain("JSON");
    expect(rollingPrompt.content).toContain("Chapter Plan");
    expect(rollingPrompt.content).toContain("Scene Plan");
    expect(rollingPrompt.content).toContain("10-20");
    expect(rollingPrompt.content).toContain("JSON");
  });

  it("keeps plot debt risk levels aligned with business enums", () => {
    const prompt = PromptRegistry.getPrompt("plot_debt_update", "v1");

    expect(prompt.content).toContain("low|medium|high|critical");
    expect(prompt.content).not.toContain("low|medium|high|error");
  });
});
