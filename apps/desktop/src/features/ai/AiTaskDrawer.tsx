import { CheckCircleOutlined, LoadingOutlined } from "@ant-design/icons";
import { Drawer, Timeline, Typography } from "antd";

const { Paragraph, Text } = Typography;

export interface AiTaskDrawerProps {
  readonly open: boolean;
  onClose(): void;
}

export function AiTaskDrawer({ onClose, open }: AiTaskDrawerProps) {
  return (
    <Drawer onClose={onClose} open={open} placement="right" size="default" title="AI 任务">
      <Paragraph type="secondary">当前工作单集中展示，不作为常驻聊天入口。</Paragraph>
      <Timeline
        items={[
          {
            children: (
              <div>
                <Text strong>构建章节上下文</Text>
                <Paragraph type="secondary">已读取 canon memory 和图谱邻域</Paragraph>
              </div>
            ),
            dot: <CheckCircleOutlined />,
          },
          {
            children: (
              <div>
                <Text strong>生成章节草稿</Text>
                <Paragraph type="secondary">等待模型返回结构化结果</Paragraph>
              </div>
            ),
            dot: <LoadingOutlined />,
          },
        ]}
      />
    </Drawer>
  );
}
