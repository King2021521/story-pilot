import { describe, expect, it } from "vitest";

import { ChapterDraftOutputSchema } from "./chapter-draft.schema.js";

describe("ChapterDraftOutputSchema", () => {
  it("parses draft body and extracted memory candidates", () => {
    expect(
      ChapterDraftOutputSchema.parse({
        draft: {
          body: "雨夜里，林鸢在门缝下发现了那封信。",
          summary: "林鸢发现一封异常来信。",
          title: "雨夜来信",
        },
        memoryCandidates: [
          {
            confidence: 0.82,
            content: "林鸢收到了一封来自十年前的信。",
            entityType: "story_event",
            kind: "event",
            proposedRelations: [
              { predicate: "involves", targetId: "char_a", targetType: "character" },
            ],
          },
        ],
        reviewNotes: ["未直接写入 canon，等待用户确认。"],
      }),
    ).toMatchObject({
      draft: {
        body: expect.stringContaining("门缝"),
      },
      memoryCandidates: [
        {
          status: "pending",
        },
      ],
    });
  });
});
