import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProjectSidebar, type ProjectSidebarProps } from "./ProjectSidebar";

type ProjectSidebarTestProps = ProjectSidebarProps & {
  readonly collapsed?: boolean;
  onToggleCollapsed?(collapsed: boolean): void;
};

describe("ProjectSidebar", () => {
  it("keeps the settings entry anchored outside the scrollable navigation area", () => {
    renderProjectSidebar();

    expect(screen.getByLabelText("侧栏顶部操作")).toHaveClass("project-sidebar__top");
    expect(screen.getByLabelText("侧栏导航内容")).toHaveClass("project-sidebar__scroll");
    expect(screen.getByLabelText("侧栏设置区")).toHaveClass("project-sidebar__footer");
  });

  it("collapses and expands the project and work sections independently", () => {
    renderProjectSidebar();

    expect(screen.getByText("布衣天子")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "收起作品空间" }));
    expect(screen.queryByText("布衣天子")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "展开作品空间" }));
    expect(screen.getByText("布衣天子")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "4. 角色设计" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "收起当前作品" }));
    expect(screen.queryByRole("button", { name: "4. 角色设计" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "展开当前作品" }));
    expect(screen.getByRole("button", { name: "4. 角色设计" })).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "记忆确认" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "收起辅助系统" }));
    expect(screen.queryByRole("button", { name: "记忆确认" })).not.toBeInTheDocument();
  });

  it("shows active project chapters inside the project tree", () => {
    const onSelectChapter = vi.fn();
    renderProjectSidebar({ onSelectChapter, selectedChapterId: undefined });

    fireEvent.click(screen.getByText("第一章 雨夜来信"));

    expect(onSelectChapter).toHaveBeenCalledWith("chapter_1");
  });

  it("supports one-click collapse and a condensed rail state", () => {
    const onToggleCollapsed = vi.fn();

    const { rerender } = renderProjectSidebar({ onToggleCollapsed });
    fireEvent.click(screen.getByRole("button", { name: "收起侧栏" }));
    expect(onToggleCollapsed).toHaveBeenCalledWith(true);

    rerender(
      <ProjectSidebar {...createProjectSidebarProps({ collapsed: true, onToggleCollapsed })} />,
    );

    expect(screen.getByRole("button", { name: "展开侧栏" })).toBeInTheDocument();
    expect(screen.queryByText("小说创作工作台")).not.toBeInTheDocument();
    expect(screen.queryByText("作品空间")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "展开侧栏" }));
    expect(onToggleCollapsed).toHaveBeenLastCalledWith(false);
  });
});

function renderProjectSidebar(overrides: Partial<ProjectSidebarTestProps> = {}) {
  return render(<ProjectSidebar {...createProjectSidebarProps(overrides)} />);
}

function createProjectSidebarProps(
  overrides: Partial<ProjectSidebarTestProps> = {},
): ProjectSidebarTestProps {
  return {
    activeModuleKey: "characters",
    activeProjectId: "project_1",
    chapters: [
      {
        id: "chapter_1",
        title: "第一章 雨夜来信",
      },
    ],
    projects: [
      {
        id: "project_1",
        title: "布衣天子",
      },
    ],
    selectedChapterId: "chapter_1",
    ...overrides,
  };
}
