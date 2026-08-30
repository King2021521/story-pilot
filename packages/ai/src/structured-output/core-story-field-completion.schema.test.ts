import { describe, expect, it } from "vitest";

import { CoreStoryFieldCompletionOutputSchema } from "./core-story-field-completion.schema.js";

describe("CoreStoryFieldCompletionOutputSchema", () => {
  it("parses editable core story form completions", () => {
    const longText = buildTextOfLength(260);

    expect(
      CoreStoryFieldCompletionOutputSchema.parse({
        fields: {
          antagonistForce: longText,
          corePromise: longText,
          differentiators: ["旧信谜题与人物成长绑定", "钟楼档案形成连续线索网"],
          emotionalAxes: ["悬疑", "反转"],
          logline: buildTextOfLength(80),
          mainConflict: longText,
          mainGoal: longText,
          premise: longText,
          protagonistArc: longText,
          risks: ["线索密度不足会削弱追读", "旧案反转不能只靠隐瞒信息"],
          stakes: longText,
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

  it("rejects underdeveloped long-text fields", () => {
    expect(() =>
      CoreStoryFieldCompletionOutputSchema.parse({
        fields: {
          antagonistForce: buildTextOfLength(199),
          corePromise: buildTextOfLength(260),
          differentiators: ["旧信谜题与人物成长绑定"],
          emotionalAxes: ["悬疑"],
          logline: buildTextOfLength(80),
          mainConflict: buildTextOfLength(260),
          mainGoal: buildTextOfLength(260),
          premise: buildTextOfLength(260),
          protagonistArc: buildTextOfLength(260),
          risks: ["线索密度不足"],
          stakes: buildTextOfLength(260),
          storyDriver: "mystery",
        },
      }),
    ).toThrow();
  });

  it("rejects overlong long-text fields", () => {
    expect(() =>
      CoreStoryFieldCompletionOutputSchema.parse({
        fields: {
          antagonistForce: buildTextOfLength(260),
          corePromise: buildTextOfLength(260),
          differentiators: ["旧信谜题与人物成长绑定"],
          emotionalAxes: ["悬疑"],
          logline: buildTextOfLength(80),
          mainConflict: buildTextOfLength(260),
          mainGoal: buildTextOfLength(260),
          premise: "故".repeat(801),
          protagonistArc: buildTextOfLength(260),
          risks: ["线索密度不足"],
          stakes: buildTextOfLength(260),
          storyDriver: "mystery",
        },
      }),
    ).toThrow();
  });

  it("rejects extra output fields that do not map to the form", () => {
    const longText = buildTextOfLength(260);

    expect(() =>
      CoreStoryFieldCompletionOutputSchema.parse({
        fields: {
          antagonistForce: longText,
          corePromise: longText,
          differentiators: ["旧信谜题与人物成长绑定"],
          emotionalAxes: ["悬疑"],
          logline: buildTextOfLength(80),
          mainConflict: longText,
          mainGoal: longText,
          premise: longText,
          protagonistArc: longText,
          risks: ["线索密度不足"],
          stakes: longText,
          storyDriver: "mystery",
          qualityCheck: "不要把质量检查混进业务表单。",
        },
      }),
    ).toThrow();
  });
});

function buildTextOfLength(length: number): string {
  return "故".repeat(length);
}
