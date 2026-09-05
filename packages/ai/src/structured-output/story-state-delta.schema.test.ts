import { describe, expect, it } from "vitest";

import { StoryStateDeltaOutputSchema } from "./story-state-delta.schema.js";

describe("StoryStateDeltaOutputSchema", () => {
  it("accepts explicit state changes extracted from an applied chapter", () => {
    const parsed = StoryStateDeltaOutputSchema.safeParse({
      characterDeltas: [
        {
          characterId: "character-shen-yan",
          emotionalState: "从封闭独行转为愿意有限信任周苓。",
          externalGoal: "在三天内完成安全屋主热源稳定。",
          knowledgeState: "确认冰冠预警编号与旧工程日志有关。",
          physicalState: "轻微冻伤，右手操作精度下降。",
          relationshipChanges: ["开始把周苓视为医疗系统负责人候选"],
          resourceChanges: ["获得旧堡垒仓库维修权限"],
          riskFlags: ["过度暴露工程权限"],
        },
      ],
      memoryCandidates: ["沈砚在第 1 章发现冰冠计划预警编号。"],
      plotDebtDeltas: [
        {
          action: "create",
          note: "冰冠计划编号首次出现但未解释来源。",
          title: "冰冠预警编号真相",
        },
      ],
      storyDelta: {
        globalSituationChange: "冻雨导致城区供暖崩溃，霜脊山旧堡垒成为附近少数可避难地点。",
        hiddenInformation: ["冰冠计划可能早于灾变启动"],
        locationChanges: ["旧堡垒备用热泵短暂恢复"],
        organizationChanges: ["临时管委会失去仓库绝对控制"],
        resourceChanges: ["柴油库存被确认只能支撑三天"],
        revealedInformation: ["极寒并非普通寒潮"],
      },
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects payloads without storyDelta because global state is required for the next chapter", () => {
    const parsed = StoryStateDeltaOutputSchema.safeParse({
      characterDeltas: [],
      memoryCandidates: [],
      plotDebtDeltas: [],
    });

    expect(parsed.success).toBe(false);
  });
});
