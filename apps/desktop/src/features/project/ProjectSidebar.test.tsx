import { fireEvent, render, screen, within } from "@testing-library/react";
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

  it("renders project modules as a single nested work tree", () => {
    const onOpenProject = vi.fn();
    const onSelectModule = vi.fn();
    renderProjectSidebar({ onOpenProject, onSelectModule });

    const projectTree = screen.getByRole("tree", { name: "作品树" });
    expect(screen.queryByText("当前作品")).not.toBeInTheDocument();
    expect(
      within(projectTree).getByRole("button", { name: "打开作品 布衣天子" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "收起作品 布衣天子" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    const workModules = screen.getByLabelText("布衣天子的创作模块");
    expect(within(workModules).getByRole("button", { name: "总控台" })).toBeInTheDocument();
    expect(within(workModules).getByRole("button", { name: "4. 角色设计" })).toBeInTheDocument();

    fireEvent.click(within(workModules).getByRole("button", { name: "5. 故事线设计" }));
    expect(onSelectModule).toHaveBeenCalledWith("storylines");

    fireEvent.click(within(projectTree).getByRole("button", { name: "打开作品 布衣天子" }));
    expect(onOpenProject).toHaveBeenCalledWith("project_1");

    expect(
      within(projectTree).getByRole("button", { name: "打开作品 雾城旧案" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "展开作品 雾城旧案" }));
    const secondWorkModules = screen.getByLabelText("雾城旧案的创作模块");
    fireEvent.click(within(secondWorkModules).getByRole("button", { name: "2. 世界观设计" }));
    expect(onOpenProject).toHaveBeenLastCalledWith("project_2", "worldbuilding");
  });

  it("collapses project tree nodes and auxiliary modules independently", () => {
    renderProjectSidebar();

    expect(screen.getByRole("button", { name: "4. 角色设计" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "收起作品 布衣天子" }));
    expect(screen.queryByRole("button", { name: "4. 角色设计" })).not.toBeInTheDocument();
    expect(screen.queryByText("第一章 雨夜来信")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "展开作品 布衣天子" }));
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
      {
        id: "project_2",
        title: "雾城旧案",
      },
    ],
    selectedChapterId: "chapter_1",
    ...overrides,
  };
}
