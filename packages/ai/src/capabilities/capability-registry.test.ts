import { describe, expect, it } from "vitest";

import { AI_CAPABILITY_NAMES, CapabilityRegistry } from "./capability-registry.js";
import { PromptRegistry } from "../prompts/prompt-registry.js";

describe("CapabilityRegistry", () => {
  it("registers every production creative capability with stable prompt metadata", () => {
    expect(AI_CAPABILITY_NAMES).toEqual([
      "brief.refine",
      "blueprint.generate",
      "worldbuilding.generate",
      "character.generate",
      "relationship.generate",
      "plotArc.generate",
      "outline.generate",
      "chapter.draft",
      "chapter.rewrite",
      "continuity.review",
      "foreshadowing.plan",
      "memory.extract",
      "retrospective.generate",
      "element.generateCandidates",
    ]);

    for (const capabilityName of AI_CAPABILITY_NAMES) {
      const capability = CapabilityRegistry.get(capabilityName);
      expect(capability.defaultPromptVersion).toBe("v1");
      expect(capability.outputSchemaName).toMatch(/Output$/);
      expect(capability.promptCapability).toBeDefined();

      const prompt = PromptRegistry.getPrompt(capability.promptCapability, "v1");
      expect(prompt.content).toContain("JSON");
      expect(prompt.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    }

    expect(CapabilityRegistry.get("chapter.draft")).toMatchObject({
      name: "chapter.draft",
      outputSchemaName: "ChapterDraftOutput",
      promptCapability: "chapter_draft",
      purpose: "chapter_draft",
    });
    expect(CapabilityRegistry.get("memory.extract")).toMatchObject({
      name: "memory.extract",
      outputSchemaName: "MemoryExtractOutput",
      promptCapability: "memory_extract",
      purpose: "memory_extract",
    });
    expect(CapabilityRegistry.get("element.generateCandidates")).toMatchObject({
      name: "element.generateCandidates",
      outputSchemaName: "ElementCandidateOutput",
      promptCapability: "element_generate",
      purpose: "element_generate",
    });
  });
});
