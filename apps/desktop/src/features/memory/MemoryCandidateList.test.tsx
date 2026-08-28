import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "../../app/AppProviders";
import { MemoryCandidateList } from "./MemoryCandidateList";

describe("MemoryCandidateList", () => {
  it("renders candidates and supports canon, hypothesis, merge and reject decisions", async () => {
    const onConfirm = vi.fn();
    const onReject = vi.fn();

    render(
      <AppProviders>
        <MemoryCandidateList
          candidates={[
            {
              confidence: 0.8,
              content: "林鸢发现一封来历异常的旧信。",
              id: "candidate_1",
              kind: "event",
              status: "pending",
            },
          ]}
          onConfirm={onConfirm}
          onReject={onReject}
        />
      </AppProviders>,
    );

    expect(screen.getByText("林鸢发现一封来历异常的旧信。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "确认" }));
    fireEvent.change(screen.getByRole("textbox", { name: "记忆陈述" }), {
      target: { value: "林鸢在雨夜发现旧信。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认记忆" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "确认" }));
    fireEvent.click(screen.getByRole("radio", { name: "假设" }));
    fireEvent.click(screen.getByRole("button", { name: "确认记忆" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole("button", { name: "确认" }));
    fireEvent.click(screen.getByRole("radio", { name: "合并" }));
    fireEvent.change(screen.getByRole("textbox", { name: "目标记忆 ID" }), {
      target: { value: "memory_1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认记忆" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(3));

    fireEvent.click(screen.getByRole("button", { name: "拒绝" }));

    expect(onConfirm).toHaveBeenNthCalledWith(1, {
      candidateId: "candidate_1",
      decision: "canon",
      editedStatement: "林鸢在雨夜发现旧信。",
    });
    expect(onConfirm).toHaveBeenNthCalledWith(2, {
      candidateId: "candidate_1",
      decision: "hypothesis",
      editedStatement: "林鸢发现一封来历异常的旧信。",
    });
    expect(onConfirm).toHaveBeenNthCalledWith(3, {
      candidateId: "candidate_1",
      decision: "merge",
      editedStatement: "林鸢发现一封来历异常的旧信。",
      mergeTargetMemoryId: "memory_1",
    });
    expect(onReject).toHaveBeenCalledWith("candidate_1");
  });
});
