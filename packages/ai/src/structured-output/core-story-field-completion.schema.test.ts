import { describe, expect, it } from "vitest";

import { CoreStoryFieldCompletionOutputSchema } from "./core-story-field-completion.schema.js";

describe("CoreStoryFieldCompletionOutputSchema", () => {
  it("parses editable core story form completions", () => {
    expect(
      CoreStoryFieldCompletionOutputSchema.parse({
        fields: {
          antagonistForce: "旧城钟楼背后的既得利益者和被旧案保护的制度。",
          corePromise: "每个单元都提供硬线索、身份反转和旧案真相的一次推进。",
          differentiators: ["旧信谜题与人物成长绑定", "钟楼档案形成连续线索网"],
          emotionalAxes: ["悬疑", "反转"],
          logline: "雨夜旧信把主角拖回十年前钟楼旧案。",
          mainConflict: "主角追查真相时不断触碰旧城秩序。",
          mainGoal: "找出钟楼火灾真相并保护仍被旧案威胁的人。",
          premise: "旧城钟楼火灾十年后，主角收到一封不该存在的旧信。",
          protagonistArc: "从逃避旧案到主动承担真相带来的代价。",
          risks: ["线索密度不足会削弱追读", "旧案反转不能只靠隐瞒信息"],
          stakes: "失败会让旧案幸存者再次被清算，主角也会失去替亲人翻案的机会。",
          storyDriver: "mystery",
        },
      }),
    ).toMatchObject({
      fields: {
        emotionalAxes: ["悬疑", "反转"],
        storyDriver: "mystery",
      },
    });
  });

  it("rejects overlong long-text fields", () => {
    expect(() =>
      CoreStoryFieldCompletionOutputSchema.parse({
        fields: {
          antagonistForce: "旧城钟楼背后的既得利益者。",
          corePromise: "每个单元都提供硬线索。",
          differentiators: ["旧信谜题与人物成长绑定"],
          emotionalAxes: ["悬疑"],
          logline: "雨夜旧信把主角拖回十年前钟楼旧案。",
          mainConflict: "主角追查真相时不断触碰旧城秩序。",
          mainGoal: "找出钟楼火灾真相。",
          premise: "故".repeat(801),
          protagonistArc: "从逃避旧案到主动承担代价。",
          risks: ["线索密度不足"],
          stakes: "失败会让旧案幸存者再次被清算。",
          storyDriver: "mystery",
        },
      }),
    ).toThrow();
  });
});
