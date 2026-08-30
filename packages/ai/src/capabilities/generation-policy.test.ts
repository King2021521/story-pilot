import { describe, expect, it } from "vitest";

import { getGenerationPolicy } from "./generation-policy.js";

describe("getGenerationPolicy", () => {
  it("allocates larger output budgets for form completion and longform planning", () => {
    expect(getGenerationPolicy("worldbuilding_generate")).toMatchObject({
      maxOutputTokens: 12000,
      temperature: 0.65,
    });
    expect(getGenerationPolicy("core_story_complete")).toMatchObject({
      maxOutputTokens: 8000,
      temperature: 0.7,
    });
    expect(getGenerationPolicy("book_plan_generate")).toMatchObject({
      maxOutputTokens: 12000,
      temperature: 0.5,
    });
    expect(getGenerationPolicy("rolling_chapter_plan_generate")).toMatchObject({
      maxOutputTokens: 12000,
      temperature: 0.45,
    });
    expect(getGenerationPolicy("element_generate")).toMatchObject({
      maxOutputTokens: 5000,
      temperature: 0.8,
    });
  });
});
