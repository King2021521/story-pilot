import { describe, expect, it } from "vitest";

import { SerialReviewOutputSchema } from "./serial-review.schema.js";

describe("SerialReviewOutputSchema", () => {
  it("accepts a structured serial review with next actions", () => {
    const parsed = SerialReviewOutputSchema.safeParse({
      characterStagnation: [
        {
          characterId: "character-zhou-ling",
          evidence: "近 10 章只提供医疗解释，没有主动选择。",
          suggestion: "让她在下一批章纲里提出与沈砚相反的隔离策略。",
        },
      ],
      nextActions: [
        {
          actionType: "adjust_chapter_plan",
          targetId: "chapter-plan-21",
          title: "把热源争夺升级成内部治理冲突",
        },
      ],
      plotDebtRisks: [
        {
          plotDebtId: "debt-ice-crown-warning",
          riskLevel: "high",
          suggestion: "第 22 章至少强化一次冰冠计划编号。",
        },
      ],
      progressSummary: "前 20 章完成安全屋第一阶段建立，但外部势力压力不足。",
      promiseDelivery: [
        {
          evidence: "安全屋完成热源闭环、净水和第一道外墙。",
          promise: "基地升级爽点",
          score: 86,
        },
      ],
      repetitionRisks: ["连续三章都是资源短缺，需要换成制度冲突或背叛冲突。"],
      rhythmReport: {
        issue: "中段冲突类型重复",
        score: 78,
        suggestion: "下一批章节按资源、关系、外敌、真相四类轮换。",
      },
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects reviews without next actions because retrospectives must be actionable", () => {
    const parsed = SerialReviewOutputSchema.safeParse({
      characterStagnation: [],
      nextActions: [],
      plotDebtRisks: [],
      progressSummary: "前 20 章节奏稳定。",
      promiseDelivery: [],
      repetitionRisks: [],
      rhythmReport: {
        score: 80,
      },
    });

    expect(parsed.success).toBe(false);
  });
});
