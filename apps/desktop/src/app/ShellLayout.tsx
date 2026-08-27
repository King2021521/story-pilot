import {
  AppstoreOutlined,
  BarsOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  RobotOutlined,
} from "@ant-design/icons";
import { Button, Descriptions, Drawer, Layout, Space, Tabs, Tag, Timeline, Typography } from "antd";
import { useState } from "react";

import { AiTaskDrawer } from "../features/ai/AiTaskDrawer";
import { ProjectSidebar } from "../features/project/ProjectSidebar";
import { WorkbenchHome } from "../features/workbench/WorkbenchHome";

const { Content, Sider } = Layout;
const { Text, Title } = Typography;

export function ShellLayout() {
  const [boardOpen, setBoardOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  return (
    <Layout className="story-shell">
      <Sider aria-label="作品管理区" className="story-shell__sidebar" width={292}>
        <ProjectSidebar />
      </Sider>

      <Content aria-label="工作台" className="story-shell__content">
        <header className="story-toolbar">
          <div>
            <Text className="story-eyebrow">工作台</Text>
            <Title level={3}>长夜序章</Title>
          </div>
          <Space wrap>
            <Button aria-label="项目看板" icon={<AppstoreOutlined />} onClick={() => setBoardOpen(true)}>
              项目看板
            </Button>
            <Button aria-label="AI 任务" icon={<RobotOutlined />} onClick={() => setAiOpen(true)} type="primary">
              AI 任务
            </Button>
          </Space>
        </header>

        <WorkbenchHome />
      </Content>

      <Drawer
        onClose={() => setBoardOpen(false)}
        open={boardOpen}
        placement="right"
        size="default"
        title="项目看板"
      >
        <Tabs
          items={[
            {
              children: (
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="章节状态">
                    <Tag color="processing">第一章草稿中</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="待确认记忆">5 条</Descriptions.Item>
                  <Descriptions.Item label="未回收伏笔">3 条</Descriptions.Item>
                  <Descriptions.Item label="连续性风险">1 条</Descriptions.Item>
                </Descriptions>
              ),
              key: "overview",
              label: (
                <span>
                  <BarsOutlined /> 概览
                </span>
              ),
            },
            {
              children: (
                <Timeline
                  items={[
                    {
                      children: "旧信出现",
                      dot: <ClockCircleOutlined />,
                    },
                    {
                      children: "父亲失踪线索",
                      dot: <FileTextOutlined />,
                    },
                    {
                      children: "旧城区火灾真相",
                      dot: <CheckCircleOutlined />,
                    },
                  ]}
                />
              ),
              key: "timeline",
              label: (
                <span>
                  <DatabaseOutlined /> 脉络
                </span>
              ),
            },
          ]}
        />
      </Drawer>

      <AiTaskDrawer onClose={() => setAiOpen(false)} open={aiOpen} />
    </Layout>
  );
}
