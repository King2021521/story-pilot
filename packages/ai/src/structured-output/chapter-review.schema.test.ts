import { describe, expect, it } from "vitest";

import { ChapterReviewOutputSchema } from "./chapter-review.schema.js";

describe("ChapterReviewOutputSchema", () => {
  it("accepts review dimensions tied to the execution card and canon checks", () => {
    const parsed = ChapterReviewOutputSchema.safeParse({
      blockingIssues: [
        {
          issueType: "canon_conflict",
          message: "正文写成供热系统已经永久稳定，但执行卡只允许第一次短暂启动。",
          relatedEntityIds: ["card-1", "world-rule-heat-loop"],
          severity: "error",
        },
      ],
      dimensions: [
        {
          evidence: "正文完成热泵点亮和第一晚庇护。",
          key: "emotional_reward",
          score: 88,
          suggestion: "保留爽点，但压低稳定程度，为后续升级留空间。",
        },
        {
          evidence: "章末出现冰冠预警编号。",
          key: "hook",
          score: 92,
          suggestion: "把编号和主角旧记忆做一次轻微连接。",
        },
      ],
      rewriteSuggestions: ["弱化永久安全的表述，改成暂时度过第一夜。"],
      score: 84,
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects unknown review dimensions because downstream scoring depends on fixed keys", () => {
    const parsed = ChapterReviewOutputSchema.safeParse({
      blockingIssues: [],
      dimensions: [
        {
          evidence: "x",
          key: "pretty_words",
          score: 70,
          suggestion: "x",
        },
      ],
      rewriteSuggestions: [],
      score: 70,
    });

    expect(parsed.success).toBe(false);
  });
});
