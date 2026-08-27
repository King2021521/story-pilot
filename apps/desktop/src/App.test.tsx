import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("App", () => {
  it("renders the desktop workbench shell", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Story Pilot" })).toBeInTheDocument();
    expect(screen.getByText("工作台")).toBeInTheDocument();
    expect(screen.getByText("项目看板")).toBeInTheDocument();
  });
});

