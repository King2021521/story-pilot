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
import { Button, Empty, Tooltip, Tree, Typography } from "antd";
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

type SidebarSectionKey = "auxiliary" | "modules" | "workspace";

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
  onOpenProject?(projectId: string): void;
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
    modules: true,
    workspace: true,
  });
  const projectTreeData = projects.map((project) => ({
    children:
      project.id === activeProjectId
        ? chapters.map((chapter) => ({
            icon: <FileTextOutlined />,
            key: chapterKey(chapter.id),
            title: chapter.title,
          }))
        : undefined,
    icon: project.id === activeProjectId ? <FolderOpenOutlined /> : <BookOutlined />,
    key: projectKey(project.id),
    title: project.title,
  }));
  const selectedKeys = selectedChapterId
    ? [chapterKey(selectedChapterId)]
    : activeProjectId
      ? [projectKey(activeProjectId)]
      : [];
  const sidebarClassName = collapsed
    ? "project-sidebar project-sidebar--collapsed"
    : "project-sidebar";

  const toggleSection = (sectionKey: SidebarSectionKey) => {
    setOpenSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }));
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
            {projectTreeData.length === 0 ? (
              <Empty description="暂无作品" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Tree
                blockNode
                defaultExpandedKeys={activeProjectId ? [projectKey(activeProjectId)] : []}
                onSelect={(selectedKeys) => {
                  const selectedKey = String(selectedKeys[0] ?? "");
                  if (selectedKey.startsWith("chapter:")) {
                    onSelectChapter?.(selectedKey.slice("chapter:".length));
                    return;
                  }
                  if (selectedKey.startsWith("project:")) {
                    onOpenProject?.(selectedKey.slice("project:".length));
                  }
                }}
                selectedKeys={selectedKeys}
                showIcon
                treeData={projectTreeData}
              />
            )}
          </SidebarSection>

          {activeProjectId ? (
            <SidebarSection
              onToggle={() => toggleSection("modules")}
              open={openSections.modules}
              sectionKey="modules"
              title="当前作品"
            >
              <div className="project-sidebar__modules-list">
                {PRIMARY_WORKSPACE_MODULES.map((module) => (
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
  onSelectModule,
}: {
  readonly active: boolean;
  readonly collapsed?: boolean;
  readonly module: WorkspaceModuleDefinition;
  readonly onSelectModule?: ((moduleKey: WorkspaceModuleKey) => void) | undefined;
}) {
  const button = (
    <Button
      aria-label={module.label}
      block={!collapsed}
      className="project-sidebar__module-button"
      icon={MODULE_ICONS[module.key]}
      onClick={() => onSelectModule?.(module.key)}
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

function projectKey(projectId: string): string {
  return `project:${projectId}`;
}

function chapterKey(chapterId: string): string {
  return `chapter:${chapterId}`;
}
