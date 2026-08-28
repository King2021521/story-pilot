export type MemoryCandidateDecision = "accept_as_canon" | "keep_as_hypothesis" | "reject" | "merge";

export type MemoryCandidateStatus = "accepted" | "rejected" | "merged";

export type MemoryStatus = "canon" | "hypothesis";

export type MemoryCandidateDecisionResult = {
  candidateStatus: MemoryCandidateStatus;
  memoryStatus?: MemoryStatus;
};

export function resolveMemoryCandidateDecision(
  decision: MemoryCandidateDecision,
): MemoryCandidateDecisionResult {
  switch (decision) {
    case "accept_as_canon":
      return { candidateStatus: "accepted", memoryStatus: "canon" };
    case "keep_as_hypothesis":
      return { candidateStatus: "accepted", memoryStatus: "hypothesis" };
    case "reject":
      return { candidateStatus: "rejected" };
    case "merge":
      return { candidateStatus: "merged" };
  }
}
