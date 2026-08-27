import { CheckOutlined, CloseOutlined } from "@ant-design/icons";
import { Button, Empty, Flex, Space, Tag, Typography } from "antd";

const { Paragraph, Text } = Typography;

export interface ArtifactReviewItem {
  readonly body: string;
  readonly id: string;
  readonly kind: string;
  readonly status: string;
  readonly targetId?: string | null;
  readonly targetType?: string | null;
  readonly title: string;
}

export interface ArtifactReviewPanelProps {
  readonly artifacts: readonly ArtifactReviewItem[];
  onApply(artifact: ArtifactReviewItem): Promise<void> | void;
  onReject(artifact: ArtifactReviewItem): Promise<void> | void;
}

export function ArtifactReviewPanel({ artifacts, onApply, onReject }: ArtifactReviewPanelProps) {
  if (artifacts.length === 0) {
    return <Empty description="暂无 AI 产物" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <Flex className="artifact-review-list" component="ul" gap={8} vertical>
      {artifacts.map((artifact) => {
        const pending = artifact.status === "pending";

        return (
          <li className="artifact-review-list__item" key={artifact.id}>
            <div className="artifact-review-list__content">
              <Text strong>{artifact.title}</Text>
              <Paragraph ellipsis={{ rows: 3 }} type="secondary">
                {artifact.body}
              </Paragraph>
              <Space size={8} wrap>
                <Tag color={pending ? "blue" : "default"}>{artifact.status}</Tag>
                <Tag>{artifact.kind}</Tag>
                {artifact.targetType ? <Tag>{artifact.targetType}</Tag> : null}
              </Space>
            </div>
            <Space>
              <Button
                aria-label="应用"
                disabled={!pending}
                icon={<CheckOutlined />}
                onClick={() => onApply(artifact)}
                type="primary"
              >
                应用
              </Button>
              <Button
                aria-label="拒绝"
                danger
                disabled={!pending}
                icon={<CloseOutlined />}
                onClick={() => onReject(artifact)}
              >
                拒绝
              </Button>
            </Space>
          </li>
        );
      })}
    </Flex>
  );
}
