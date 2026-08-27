import { BookOutlined, FolderAddOutlined, FolderOpenOutlined } from "@ant-design/icons";
import { Button, Space, Tree, Typography } from "antd";

const { Text, Title } = Typography;

const projectTreeData = [
  {
    children: [
      { key: "project-long-night/chapter-1", title: "第一章 雨夜来信" },
      { key: "project-long-night/chapter-2", title: "第二章 旧报纸" },
    ],
    icon: <FolderOpenOutlined />,
    key: "project-long-night",
    title: "长夜序章",
  },
  {
    icon: <BookOutlined />,
    key: "project-mirror-city",
    title: "镜城纪事",
  },
  {
    icon: <BookOutlined />,
    key: "project-untitled",
    title: "未命名新作",
  },
];

export function ProjectSidebar() {
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
        <Button block icon={<FolderAddOutlined />} type="primary">
          新建作品
        </Button>
      </Space>

      <div>
        <Text className="story-section-title">作品空间</Text>
        <Tree
          blockNode
          defaultExpandAll
          defaultSelectedKeys={["project-long-night/chapter-1"]}
          showIcon
          treeData={projectTreeData}
        />
      </div>
    </div>
  );
}
