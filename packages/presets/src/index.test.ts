import { describe, expect, it } from "vitest";

import { COUNT_PRESETS, ELEMENT_TYPE_PRESETS, GENRE_PRESETS, STYLE_PRESETS } from "./index.js";

describe("creative presets", () => {
  it("exports genre and style presets for selectable project creation", () => {
    expect(GENRE_PRESETS.map((preset) => preset.value)).toContain("悬疑");
    expect(GENRE_PRESETS.map((preset) => preset.value)).toContain("自定义");
    expect(STYLE_PRESETS.map((preset) => preset.value)).toContain("通用");
    expect(STYLE_PRESETS.map((preset) => preset.value)).toContain("悬疑推理");
    expect(STYLE_PRESETS.map((preset) => preset.value)).toContain("自定义");
  });

  it("exports supported AI element candidate types and counts", () => {
    expect(ELEMENT_TYPE_PRESETS.map((preset) => preset.value)).toEqual([
      "character_name",
      "city",
      "location",
      "organization",
      "weapon",
      "technique",
      "item",
      "place_name",
    ]);
    expect(COUNT_PRESETS.map((preset) => preset.value)).toEqual([5, 10, 20]);
  });
});
