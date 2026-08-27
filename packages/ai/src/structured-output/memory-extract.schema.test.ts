import { describe, expect, it } from "vitest";

import { MemoryExtractOutputSchema } from "./memory-extract.schema.js";

describe("MemoryExtractOutputSchema", () => {
  it("parses pending candidate memories with source evidence", () => {
    expect(
      MemoryExtractOutputSchema.parse({
        conflictNotes: [],
        memoryCandidates: [
          {
            confidence: 0.82,
            content: "林鸢发现一封来自十年前的旧信。",
            entityType: "story_event",
            kind: "event",
            sourceQuote: "林鸢发现门缝下有一封旧信。",
          },
        ],
      }),
    ).toMatchObject({
      memoryCandidates: [
        {
          status: "pending",
        },
      ],
    });
  });

  it("rejects candidate memories without source quote or source summary", () => {
    expect(() =>
      MemoryExtractOutputSchema.parse({
        memoryCandidates: [
          {
            content: "林鸢发现一封来自十年前的旧信。",
            entityType: "story_event",
            kind: "event",
          },
        ],
      }),
    ).toThrow();
  });
});
