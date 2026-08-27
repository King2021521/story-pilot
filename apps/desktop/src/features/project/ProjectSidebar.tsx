import { BookOutlined, FolderAddOutlined, FolderOpenOutlined } from "@ant-design/icons";
import { Button, Empty, Space, Tree, Typography } from "antd";

const { Text, Title } = Typography;

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
  readonly chapters?: readonly ProjectSidebarChapter[];
  readonly projects?: readonly ProjectSidebarProject[];
  readonly selectedChapterId?: string | undefined;
  onCreateProject?(): void;
  onOpenProject?(projectId: string): void;
  onSelectChapter?(chapterId: string): void;
}

export function ProjectSidebar({
  activeProjectId,
  chapters = [],
  projects = [],
  selectedChapterId,
  onCreateProject,
  onOpenProject,
  onSelectChapter,
}: ProjectSidebarProps) {
  const projectTreeData = projects.map((project) => ({
    children:
      project.id === activeProjectId
        ? chapters.map((chapter) => ({
            key: chapterKey(chapter.id),
            title: chapter.title,
          }))
        : undefined,
    icon: project.id === activeProjectId ? <FolderOpenOutlined /> : <BookOutlined />,
    key: projectKey(project.id),
    title: project.title,
  }));

  return (
    <div className="project-sidebar">
      <div className="project-sidebar__brand">
        <div className="project-sidebar__mark" aria-hidden="true">
          SP
        </div>
        <div>
          <Title level={4}>Story Pilot</Title>
          <Text type="secondary">小说创作工作台</Text>
        </div>
      </div>

      <Space className="project-sidebar__actions" orientation="vertical" size={10}>
        <Button
          aria-label="新建作品"
          block
          icon={<FolderAddOutlined />}
          onClick={onCreateProject}
          type="primary"
        >
          新建作品
        </Button>
      </Space>

      <div>
        <Text className="story-section-title">作品空间</Text>
        {projectTreeData.length === 0 ? (
          <Empty description="暂无作品" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Tree
            blockNode
            defaultExpandAll
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
            selectedKeys={
              selectedChapterId
                ? [chapterKey(selectedChapterId)]
                : activeProjectId
                  ? [projectKey(activeProjectId)]
                  : []
            }
            showIcon
            treeData={projectTreeData}
          />
        )}
      </div>
    </div>
  );
}

function projectKey(projectId: string): string {
  return `project:${projectId}`;
}

function chapterKey(chapterId: string): string {
  return `chapter:${chapterId}`;
}
