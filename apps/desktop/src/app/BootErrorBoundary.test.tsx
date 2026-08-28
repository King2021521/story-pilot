import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BootErrorBoundary } from "./BootErrorBoundary";

function ThrowingChild(): ReactElement {
  throw new Error("legacy gate report is missing requirements");
}

describe("BootErrorBoundary", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("renders children when the app shell does not throw", () => {
    render(
      <BootErrorBoundary>
        <div>正常工作台</div>
      </BootErrorBoundary>,
    );

    expect(screen.getByText("正常工作台")).toBeInTheDocument();
  });

  it("shows a visible startup failure instead of a blank root when rendering throws", () => {
    render(
      <BootErrorBoundary>
        <ThrowingChild />
      </BootErrorBoundary>,
    );

    expect(screen.getByText("Story Pilot 页面渲染失败")).toBeInTheDocument();
    expect(screen.getByText("legacy gate report is missing requirements")).toBeInTheDocument();
  });
});
