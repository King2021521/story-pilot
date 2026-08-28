import { describe, expect, it } from "vitest";

import { OutlineGenerateOutputSchema } from "./outline-generate.schema.js";

describe("OutlineGenerateOutputSchema", () => {
  it("parses chapter outline drafts before prose generation", () => {
    const parsed = OutlineGenerateOutputSchema.parse({
      chapterOutlines: [
        {
          chapterGoal: "用星潮异象建立主角危机。",
          conflict: "主角想藏起遗物，巡城司要求搜查。",
          hook: "遗物在双月下亮起第二道星纹。",
          informationGain: "读者知道遗物与旧宗门有关。",
          targetWordCount: 3000,
          title: "第 1 章：星潮遗物",
        },
      ],
      outline: {
        basis: { blueprintId: "blueprint_1" },
        scope: "chapter_batch",
        title: "前十章章纲",
      },
      riskNotes: [],
    });

    expect(parsed.chapterOutlines[0]).toMatchObject({
      chapterGoal: expect.stringContaining("危机"),
      title: "第 1 章：星潮遗物",
    });
  });
});
