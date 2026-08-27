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
});
