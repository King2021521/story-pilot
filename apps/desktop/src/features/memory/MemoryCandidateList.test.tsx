import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "../../app/AppProviders";
import { MemoryCandidateList } from "./MemoryCandidateList";

describe("MemoryCandidateList", () => {
  it("renders candidates and calls accept or reject callbacks", () => {
    const onAccept = vi.fn();
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
          onAccept={onAccept}
          onReject={onReject}
        />
      </AppProviders>,
    );

    expect(screen.getByText("林鸢发现一封来历异常的旧信。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "接受" }));
    fireEvent.click(screen.getByRole("button", { name: "拒绝" }));

    expect(onAccept).toHaveBeenCalledWith("candidate_1");
    expect(onReject).toHaveBeenCalledWith("candidate_1");
  });
});
