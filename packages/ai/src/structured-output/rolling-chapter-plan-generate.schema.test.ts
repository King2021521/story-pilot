import { describe, expect, it } from "vitest";

import { RollingChapterPlanGenerateOutputSchema } from "./rolling-chapter-plan-generate.schema.js";

describe("RollingChapterPlanGenerateOutputSchema", () => {
  it("accepts chapter plans with scene plans and explicit references", () => {
    const parsed = RollingChapterPlanGenerateOutputSchema.parse({
      chapterPlans: [
        {
          chapterGoal: "主角第一次触碰星潮禁令。",
          chapterIndex: 1,
          conflict: "求生需求与司星阁禁令冲突。",
          emotionalTurn: "从压抑到短暂掌控。",
          hook: "禁令背后的旧名单出现主角父亲名字。",
          informationGain: "星潮不是天灾，而是被人为管控的资源。",
          relatedCharacterIds: ["character_1"],
          relatedForeshadowingIds: ["foreshadowing_1"],
          relatedPlotlineIds: ["plotline_1"],
          scenes: [
            {
              conflictTurn: "守卫发现主角私入禁区。",
              memoryTargets: ["主角触碰星潮禁令"],
              outcome: "主角带走一枚碎星砂。",
              sceneGoal: "展示禁区规则和主角动机。",
              sceneIndex: 1,
            },
          ],
          targetWordCount: 3200,
          title: "第 1 章 星潮禁令",
        },
      ],
      riskNotes: ["注意第一章不要解释过多设定。"],
    });

    expect(parsed.chapterPlans[0]?.scenes[0]?.memoryTargets).toEqual(["主角触碰星潮禁令"]);
  });
});
