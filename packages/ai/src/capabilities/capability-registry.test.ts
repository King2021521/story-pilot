import { describe, expect, it } from "vitest";

import { AI_CAPABILITY_NAMES, CapabilityRegistry } from "./capability-registry.js";

describe("CapabilityRegistry", () => {
  it("registers every MVP AI capability with a stable purpose and prompt capability", () => {
    expect(AI_CAPABILITY_NAMES).toEqual([
      "idea.generateConcepts",
      "storyBible.generate",
      "outline.generate",
      "chapter.draft",
      "text.rewrite",
      "memory.extract",
      "continuity.review",
      "foreshadowing.plan",
      "element.generateCandidates",
    ]);
    expect(CapabilityRegistry.get("chapter.draft")).toMatchObject({
      name: "chapter.draft",
      promptCapability: "chapter_draft",
      purpose: "chapter_draft",
    });
    expect(CapabilityRegistry.get("memory.extract")).toMatchObject({
      name: "memory.extract",
      promptCapability: "memory_extract",
      purpose: "memory_extract",
    });
    expect(CapabilityRegistry.get("element.generateCandidates")).toMatchObject({
      name: "element.generateCandidates",
      promptCapability: "element_generate",
      purpose: "element_generate",
    });
  });
});
