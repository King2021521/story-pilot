import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppProviders } from "./AppProviders";
import { ShellLayout } from "./ShellLayout";

describe("ShellLayout", () => {
  it("renders project sidebar, workbench, board drawer entry, and AI task drawer entry", () => {
    render(
      <AppProviders>
        <ShellLayout />
      </AppProviders>,
    );

    expect(screen.getByLabelText("作品管理区")).toBeInTheDocument();
    expect(screen.getByLabelText("工作台")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "项目看板" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AI 任务" })).toBeInTheDocument();
  });
});
