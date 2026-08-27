import { describe, expect, it } from "vitest";

import { ForeshadowingPlanOutputSchema } from "./foreshadowing-plan.schema.js";

describe("ForeshadowingPlanOutputSchema", () => {
  it("parses actionable foreshadowing suggestions", () => {
    const parsed = ForeshadowingPlanOutputSchema.parse({
      suggestions: [
        {
          action: "reinforce",
          chapterId: "chapter_3",
          foreshadowingId: "foreshadowing_1",
          priority: 1,
          proposedText: "旧信上的水印在灯下短暂浮现。",
          rationale: "第三章适合加深读者记忆，但还不到回收时机。",
        },
      ],
      summary: "建议在第三章强化旧信水印伏笔。",
    });

    expect(parsed.suggestions).toEqual([
      expect.objectContaining({
        action: "reinforce",
        foreshadowingId: "foreshadowing_1",
      }),
    ]);
  });
});
