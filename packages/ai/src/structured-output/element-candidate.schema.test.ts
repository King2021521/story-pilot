import { describe, expect, it } from "vitest";

import { ElementCandidateOutputSchema } from "./element-candidate.schema.js";

describe("ElementCandidateOutputSchema", () => {
  it("parses generated creative element candidates", () => {
    expect(
      ElementCandidateOutputSchema.parse({
        items: [
          {
            description: "旧城禁军遗失的短刃，刀身会在雨夜浮出水纹。",
            name: "夜照",
            rationale: "适合作为悬疑玄幻作品中的线索武器。",
            tags: ["旧城", "雨夜", "线索"],
            type: "weapon",
          },
        ],
      }),
    ).toEqual({
      items: [
        {
          description: "旧城禁军遗失的短刃，刀身会在雨夜浮出水纹。",
          name: "夜照",
          rationale: "适合作为悬疑玄幻作品中的线索武器。",
          tags: ["旧城", "雨夜", "线索"],
          type: "weapon",
        },
      ],
    });
  });

  it("rejects candidate batches without usable names", () => {
    expect(() =>
      ElementCandidateOutputSchema.parse({
        items: [
          {
            description: "无名称候选。",
            name: "",
            rationale: "不可直接采纳。",
            type: "item",
          },
        ],
      }),
    ).toThrow();
  });
});
