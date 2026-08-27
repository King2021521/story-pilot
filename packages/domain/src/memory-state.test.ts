import { describe, expect, it } from "vitest";

import { resolveMemoryCandidateDecision } from "./index.js";

describe("memory state transitions", () => {
  it("keeps AI extracted facts as candidates until user confirmation", () => {
    expect(resolveMemoryCandidateDecision("accept_as_canon")).toEqual({
      candidateStatus: "accepted",
      memoryStatus: "canon",
    });

    expect(resolveMemoryCandidateDecision("keep_as_hypothesis")).toEqual({
      candidateStatus: "accepted",
      memoryStatus: "hypothesis",
    });
  });

  it("supports rejecting and merging memory candidates", () => {
    expect(resolveMemoryCandidateDecision("reject")).toEqual({
      candidateStatus: "rejected",
    });

    expect(resolveMemoryCandidateDecision("merge")).toEqual({
      candidateStatus: "merged",
    });
  });
});

