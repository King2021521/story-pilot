import { describe, expect, it } from "vitest";

import { BlueprintGenerateOutputSchema } from "./blueprint-generate.schema.js";

describe("BlueprintGenerateOutputSchema", () => {
  it("parses production blueprint drafts", () => {
    expect(
      BlueprintGenerateOutputSchema.parse({
        antagonistForce: "垄断星潮历法的宗门。",
        corePromise: "持续提供升级、争夺和阶段爽点。",
        differentiators: ["力量体系和主角选择绑定。"],
        logline: "少年在潮汐异象中发现旧宗门遗物。",
        mainConflict: "主角争夺星潮资源时触碰宗门秩序。",
        premise: "星潮时代，旧宗门遗物重新出现。",
        protagonistArc: "从求生到主动承担宗门兴亡。",
        risks: ["升级节奏失控会削弱主冲突。"],
      }),
    ).toMatchObject({
      corePromise: expect.stringContaining("升级"),
      risks: ["升级节奏失控会削弱主冲突。"],
    });
  });
});
