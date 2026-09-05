import {
  BookOutlined,
  BranchesOutlined,
  BulbOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  DownOutlined,
  FileTextOutlined,
  FolderAddOutlined,
  FolderOpenOutlined,
  GlobalOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  OrderedListOutlined,
  ProfileOutlined,
  ReadOutlined,
  SettingOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Button, Empty, Tooltip, Typography } from "antd";
import { useState, type ReactNode } from "react";

import {
  AUXILIARY_WORKSPACE_MODULES,
  PRIMARY_WORKSPACE_MODULES,
  type WorkspaceModuleDefinition,
  type WorkspaceModuleKey,
} from "../workbench/workspaceModules";
import storyPilotLogoUrl from "../../assets/story-pilot-logo.png";

const { Text, Title } = Typography;

const MODULE_ICONS: Record<WorkspaceModuleKey, ReactNode> = {
  "book-outline": <ReadOutlined />,
  "chapter-planning": <OrderedListOutlined />,
  "story-core": <BulbOutlined />,
  basic: <ProfileOutlined />,
  characters: <TeamOutlined />,
  dashboard: <DashboardOutlined />,
  manuscript: <FileTextOutlined />,
  memory: <DatabaseOutlined />,
  "plot-nodes": <DeploymentUnitOutlined />,
  storylines: <BranchesOutlined />,
  worldbuilding: <GlobalOutlined />,
};

type SidebarSectionKey = "auxiliary" | "workspace";

export interface ProjectSidebarProject {
  readonly id: string;
  readonly title: string;
}

export interface ProjectSidebarChapter {
  readonly id: string;
  readonly title: string;
}

export interface ProjectSidebarProps {
  readonly activeProjectId?: string | undefined;
  readonly activeModuleKey?: WorkspaceModuleKey | undefined;
  readonly chapters?: readonly ProjectSidebarChapter[];
  readonly collapsed?: boolean;
  readonly projects?: readonly ProjectSidebarProject[];
  readonly selectedChapterId?: string | undefined;
  readonly showCollapseControl?: boolean;
  onCreateProject?(): void;
  onOpenProject?(projectId: string, moduleKey?: WorkspaceModuleKey): void;
  onOpenSettings?(): void;
  onSelectModule?(moduleKey: WorkspaceModuleKey): void;
  onSelectChapter?(chapterId: string): void;
  onToggleCollapsed?(collapsed: boolean): void;
}

export function ProjectSidebar({
  activeProjectId,
  activeModuleKey = "dashboard",
  chapters = [],
  collapsed = false,
  projects = [],
  selectedChapterId,
  showCollapseControl = true,
  onCreateProject,
  onOpenProject,
  onOpenSettings,
  onSelectModule,
  onSelectChapter,
  onToggleCollapsed,
}: ProjectSidebarProps) {
  const [openSections, setOpenSections] = useState<Record<SidebarSectionKey, boolean>>({
    auxiliary: true,
    workspace: true,
  });
  const [projectExpansionOverrides, setProjectExpansionOverrides] = useState<
    Record<string, boolean>
  >({});
  const sidebarClassName = collapsed
    ? "project-sidebar project-sidebar--collapsed"
    : "project-sidebar";

  const isProjectExpanded = (projectId: string) =>
    projectExpansionOverrides[projectId] ?? projectId === activeProjectId;

  const toggleSection = (sectionKey: SidebarSectionKey) => {
    setOpenSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }));
  };

  const toggleProject = (projectId: string) => {
    setProjectExpansionOverrides((current) => ({
      ...current,
      [projectId]: !(current[projectId] ?? projectId === activeProjectId),
    }));
  };

  const selectProjectModule = (projectId: string, moduleKey: WorkspaceModuleKey) => {
    if (projectId !== activeProjectId) {
      onOpenProject?.(projectId, moduleKey);
      return;
    }

    onSelectModule?.(moduleKey);
  };

  const selectChapter = (chapterId: string) => {
    onSelectModule?.("manuscript");
    onSelectChapter?.(chapterId);
  };

  return (
    <div className={sidebarClassName}>
      <div aria-label="侧栏顶部操作" className="project-sidebar__top">
        <div className="project-sidebar__brand">
          <div className="project-sidebar__mark" aria-hidden="true">
            <img className="project-sidebar__mark-image" src={storyPilotLogoUrl} alt="" />
          </div>
          {collapsed ? null : (
            <div className="project-sidebar__brand-copy">
              <Title level={4}>Story Pilot</Title>
              <Text type="secondary">小说创作工作台</Text>
            </div>
          )}
          {showCollapseControl ? (
            <Tooltip title={collapsed ? "展开侧栏" : "收起侧栏"}>
              <Button
                aria-label={collapsed ? "展开侧栏" : "收起侧栏"}
                className="project-sidebar__collapse-button"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => onToggleCollapsed?.(!collapsed)}
                type="text"
              />
            </Tooltip>
          ) : null}
        </div>

        <Tooltip title={collapsed ? "新建作品" : undefined}>
          <Button
            aria-label="新建作品"
            block={!collapsed}
            className="project-sidebar__new-button"
            icon={<FolderAddOutlined />}
            onClick={onCreateProject}
            type="primary"
          >
            {collapsed ? null : "新建作品"}
          </Button>
        </Tooltip>
      </div>

      {collapsed ? (
        <div aria-label="侧栏快捷导航" className="project-sidebar__collapsed-nav">
          {activeProjectId
            ? [...PRIMARY_WORKSPACE_MODULES, ...AUXILIARY_WORKSPACE_MODULES].map((module) => (
                <SidebarModuleButton
                  active={activeModuleKey === module.key}
                  collapsed
                  key={module.key}
                  module={module}
                  onSelectModule={onSelectModule}
                />
              ))
            : null}
        </div>
      ) : (
        <div aria-label="侧栏导航内容" className="project-sidebar__scroll">
          <SidebarSection
            onToggle={() => toggleSection("workspace")}
            open={openSections.workspace}
            sectionKey="workspace"
            title="作品空间"
          >
            {projects.length === 0 ? (
              <Empty description="暂无作品" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div aria-label="作品树" className="project-sidebar-tree" role="tree">
                {projects.map((project) => {
                  const active = project.id === activeProjectId;
                  const expanded = isProjectExpanded(project.id);

                  return (
                    <div
                      aria-expanded={expanded}
                      aria-selected={active}
                      className={
                        active
                          ? "project-sidebar-tree__project project-sidebar-tree__project--active"
                          : "project-sidebar-tree__project"
                      }
                      key={project.id}
                      role="treeitem"
                    >
                      <div className="project-sidebar-tree__project-row">
                        <Tooltip title={expanded ? "收起作品" : "展开作品"}>
                          <button
                            aria-controls={`project-sidebar-project-${project.id}`}
                            aria-expanded={expanded}
                            aria-label={`${expanded ? "收起" : "展开"}作品 ${project.title}`}
                            className="project-sidebar-tree__toggle"
                            onClick={() => toggleProject(project.id)}
                            type="button"
                          >
                            <DownOutlined />
                          </button>
                        </Tooltip>
                        <button
                          aria-current={active ? "page" : undefined}
                          aria-label={`打开作品 ${project.title}`}
                          className="project-sidebar-tree__project-button"
                          onClick={() => onOpenProject?.(project.id)}
                          type="button"
                        >
                          {active ? <FolderOpenOutlined /> : <BookOutlined />}
                          <span>{project.title}</span>
                        </button>
                      </div>
                      {expanded ? (
                        <div
                          aria-label={`${project.title}的创作模块`}
                          className="project-sidebar-tree__children"
                          id={`project-sidebar-project-${project.id}`}
                          role="group"
                        >
                          {PRIMARY_WORKSPACE_MODULES.map((module) => (
                            <div className="project-sidebar-tree__child" key={module.key}>
                              <SidebarModuleButton
                                active={active && activeModuleKey === module.key}
                                module={module}
                                onClick={() => selectProjectModule(project.id, module.key)}
                              />
                              {active && module.key === "manuscript" && chapters.length > 0 ? (
                                <div
                                  aria-label={`${project.title}的正文章节`}
                                  className="project-sidebar-tree__chapters"
                                >
                                  {chapters.map((chapter) => (
                                    <SidebarChapterButton
                                      active={chapter.id === selectedChapterId}
                                      chapter={chapter}
                                      key={chapter.id}
                                      onSelectChapter={selectChapter}
                                    />
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </SidebarSection>

          {activeProjectId ? (
            <SidebarSection
              onToggle={() => toggleSection("auxiliary")}
              open={openSections.auxiliary}
              sectionKey="auxiliary"
              title="辅助系统"
            >
              <div className="project-sidebar__modules-list">
                {AUXILIARY_WORKSPACE_MODULES.map((module) => (
                  <SidebarModuleButton
                    active={activeModuleKey === module.key}
                    key={module.key}
                    module={module}
                    onSelectModule={onSelectModule}
                  />
                ))}
              </div>
            </SidebarSection>
          ) : null}
        </div>
      )}

      <div aria-label="侧栏设置区" className="project-sidebar__footer">
        <Tooltip title={collapsed ? "设置" : undefined}>
          <Button
            aria-label="设置"
            block={!collapsed}
            icon={<SettingOutlined />}
            onClick={onOpenSettings}
          >
            {collapsed ? null : "设置"}
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}

function SidebarSection({
  children,
  onToggle,
  open,
  sectionKey,
  title,
}: {
  readonly children: ReactNode;
  onToggle(): void;
  readonly open: boolean;
  readonly sectionKey: SidebarSectionKey;
  readonly title: string;
}) {
  const contentId = `project-sidebar-${sectionKey}`;

  return (
    <section aria-label={`${title}分区`} className="project-sidebar-section">
      <button
        aria-controls={contentId}
        aria-expanded={open}
        aria-label={`${open ? "收起" : "展开"}${title}`}
        className="project-sidebar-section__header"
        onClick={onToggle}
        type="button"
      >
        <Text className="story-section-title">{title}</Text>
        <DownOutlined className="project-sidebar-section__chevron" />
      </button>
      {open ? (
        <div className="project-sidebar-section__body" id={contentId}>
          {children}
        </div>
      ) : null}
    </section>
  );
}

function SidebarModuleButton({
  active,
  collapsed = false,
  module,
  onClick,
  onSelectModule,
}: {
  readonly active: boolean;
  readonly collapsed?: boolean;
  readonly module: WorkspaceModuleDefinition;
  onClick?(): void;
  readonly onSelectModule?: ((moduleKey: WorkspaceModuleKey) => void) | undefined;
}) {
  const button = (
    <Button
      aria-label={module.label}
      block={!collapsed}
      className="project-sidebar__module-button"
      icon={MODULE_ICONS[module.key]}
      onClick={onClick ?? (() => onSelectModule?.(module.key))}
      type={active ? "primary" : "text"}
    >
      {collapsed ? null : module.label}
    </Button>
  );

  return collapsed ? (
    <Tooltip placement="right" title={module.label}>
      {button}
    </Tooltip>
  ) : (
    button
  );
}

function SidebarChapterButton({
  active,
  chapter,
  onSelectChapter,
}: {
  readonly active: boolean;
  readonly chapter: ProjectSidebarChapter;
  onSelectChapter(chapterId: string): void;
}) {
  return (
    <Button
      block
      className={
        active
          ? "project-sidebar-tree__chapter-button project-sidebar-tree__chapter-button--active"
          : "project-sidebar-tree__chapter-button"
      }
      icon={<FileTextOutlined />}
      onClick={() => onSelectChapter(chapter.id)}
      type="text"
    >
      {chapter.title}
    </Button>
  );
}
