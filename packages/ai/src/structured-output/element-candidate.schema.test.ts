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
          {
            description: "活跃在安全屋外圈补给线上的半地下互助联盟。",
            name: "白线同盟",
            rationale: "能持续制造末世资源交易、背叛和秩序争夺。",
            tags: ["末世", "补给线", "势力"],
            type: "faction",
          },
          {
            description: "把极寒修行和避难秩序绑定在一起的封闭门派。",
            name: "玄霜门",
            rationale: "适合作为长期世界观规则和角色成长的制度来源。",
            tags: ["门派", "秩序"],
            type: "sect",
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
        {
          description: "活跃在安全屋外圈补给线上的半地下互助联盟。",
          name: "白线同盟",
          rationale: "能持续制造末世资源交易、背叛和秩序争夺。",
          tags: ["末世", "补给线", "势力"],
          type: "faction",
        },
        {
          description: "把极寒修行和避难秩序绑定在一起的封闭门派。",
          name: "玄霜门",
          rationale: "适合作为长期世界观规则和角色成长的制度来源。",
          tags: ["门派", "秩序"],
          type: "sect",
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
