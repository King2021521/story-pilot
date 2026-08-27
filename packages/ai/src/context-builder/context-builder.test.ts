import { describe, expect, it } from "vitest";

import { ContextBuilder } from "./context-builder.js";

describe("ContextBuilder", () => {
  it("builds chapter draft context from chapter, canon memory, and graph neighborhood", async () => {
    const builder = new ContextBuilder({
      async getChapter() {
        return {
          id: "chapter_1",
          title: "第一章 雨夜来信",
          summary: "主角收到一封来自十年前的信。",
          content: "旧城区的雨下了一整夜。",
          version: 1,
        };
      },
      async getGraphNeighborhood() {
        return {
          edges: [{ label: "knows", sourceId: "char_a", targetId: "char_b" }],
          nodes: [
            { id: "char_a", label: "林鸢", type: "character" },
            { id: "char_b", label: "周砚", type: "character" },
          ],
        };
      },
      async listMemories() {
        return [
          {
            id: "memory_1",
            content: "林鸢一直隐瞒自己认识周砚。",
            entityType: "character",
            kind: "relation",
            status: "canon",
          },
        ];
      },
    });

    const context = await builder.buildChapterDraftContext({
      chapterId: "chapter_1",
      instruction: "写出主角第一次发现信件异常的场景。",
      projectId: "project_1",
      relatedEntityIds: ["char_a"],
    });

    expect(context.package.purpose).toBe("chapter_draft");
    expect(context.text).toContain("第一章 雨夜来信");
    expect(context.text).toContain("canon memory");
    expect(context.text).toContain("林鸢一直隐瞒自己认识周砚");
    expect(context.text).toContain("graph neighborhood");
    expect(context.text).toContain("林鸢 -[knows]-> 周砚");
    expect(context.items.map((item) => item.itemType)).toEqual([
      "chapter",
      "canon_memory",
      "graph_neighborhood",
      "instruction",
    ]);
  });
});
