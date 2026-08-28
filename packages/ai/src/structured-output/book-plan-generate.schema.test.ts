import { describe, expect, it } from "vitest";

import { BookPlanGenerateOutputSchema } from "./book-plan-generate.schema.js";

describe("BookPlanGenerateOutputSchema", () => {
  it("accepts layered book, volume, and arc plan output", () => {
    const parsed = BookPlanGenerateOutputSchema.parse({
      bookPlan: {
        corePromise: "每卷完成一次境界突破和一次关系反转。",
        endingDirection: "主角以失去旧身份为代价重塑天道。",
        targetWordCount: 3_000_000,
        title: "星潮纪全书规划",
      },
      riskNotes: ["前期要避免升级节奏过快。"],
      volumePlans: [
        {
          arcs: [
            {
              arcIndex: 1,
              endChapterIndex: 20,
              escalation: ["发现禁令", "第一次越界", "暴露代价"],
              purpose: "建立修行规则和第一重代价。",
              startChapterIndex: 1,
              title: "星潮初醒",
            },
          ],
          climax: "主角公开打破司星阁第一条禁令。",
          majorConflict: "主角想借星潮修行，司星阁禁止底层接触星潮。",
          purpose: "完成世界规则展示和主角初次突破。",
          targetWordCount: 360_000,
          title: "第一卷 星潮初醒",
          volumeIndex: 1,
        },
      ],
    });

    expect(parsed.volumePlans[0]?.arcs[0]?.escalation).toEqual([
      "发现禁令",
      "第一次越界",
      "暴露代价",
    ]);
  });
});
