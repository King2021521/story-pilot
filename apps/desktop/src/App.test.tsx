import { invoke } from "@tauri-apps/api/core";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("App", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockImplementation(async (_tauriCommand, args) => {
      const request = (args as { request: { id: string; command: string } }).request;

      return {
        data: request.command === "project.listRecent" ? [] : null,
        id: request.id,
        ok: true,
      };
    });
  });

  it("renders the desktop workbench shell", async () => {
    render(<App />);

    expect(screen.getByRole("heading", { level: 4, name: "Story Pilot" })).toBeInTheDocument();
    expect(screen.getByLabelText("应用标题栏")).toBeInTheDocument();
    expect(screen.getByLabelText("工作台")).toBeInTheDocument();
    expect(screen.getByLabelText("创作检查器")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "项目看板" })).not.toBeInTheDocument();
    expect(await screen.findByText("暂无打开的作品")).toBeInTheDocument();
  });
});
