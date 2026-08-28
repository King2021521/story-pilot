import { describe, expect, it } from "vitest";

import { DEFAULT_PROMPT_EVAL_FIXTURES, runPromptEvals } from "./prompt-eval.js";

describe("prompt eval runner", () => {
  it("passes deterministic prompt quality fixtures for production capabilities", () => {
    const results = runPromptEvals(DEFAULT_PROMPT_EVAL_FIXTURES);

    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          capability: "blueprint_generate",
          fixtureId: "blueprint-longform-methodology",
          passed: true,
        }),
        expect.objectContaining({
          capability: "chapter_draft",
          fixtureId: "chapter-canon-boundary",
          passed: true,
        }),
        expect.objectContaining({
          capability: "memory_extract",
          fixtureId: "memory-candidate-boundary",
          passed: true,
        }),
      ]),
    );
    expect(results.every((result) => result.passed)).toBe(true);
  });
});
