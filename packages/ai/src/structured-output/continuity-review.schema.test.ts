import { describe, expect, it } from "vitest";

import { ContinuityReviewOutputSchema } from "./continuity-review.schema.js";

describe("ContinuityReviewOutputSchema", () => {
  it("parses review issues with severity, evidence and suggestions", () => {
    const parsed = ContinuityReviewOutputSchema.parse({
      issues: [
        {
          evidence: "第一章说档案馆夜间关闭，草稿中角色深夜自由进入。",
          issueType: "world_rule",
          relatedEntityIds: ["rule_archive_night"],
          severity: "error",
          suggestion: "补充内部通行证或改到白天进入。",
        },
      ],
      summary: "发现 1 个硬性世界规则冲突。",
    });

    expect(parsed.issues).toHaveLength(1);
    expect(parsed.issues[0]).toMatchObject({
      issueType: "world_rule",
      severity: "error",
    });
  });
});
