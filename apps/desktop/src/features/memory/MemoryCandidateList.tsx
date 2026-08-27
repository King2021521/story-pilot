import { CheckOutlined, CloseOutlined } from "@ant-design/icons";
import { Button, Empty, Flex, Space, Tag, Typography } from "antd";

const { Text } = Typography;

export interface MemoryCandidateItem {
  readonly id: string;
  readonly content: string;
  readonly kind: string;
  readonly confidence: number;
  readonly status: string;
}

export interface MemoryCandidateListProps {
  readonly candidates: readonly MemoryCandidateItem[];
  onAccept(candidateId: string): void;
  onReject(candidateId: string): void;
}

export function MemoryCandidateList({ candidates, onAccept, onReject }: MemoryCandidateListProps) {
  if (candidates.length === 0) {
    return <Empty description="暂无待确认记忆" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <Flex className="memory-candidate-list" component="ul" gap={8} vertical>
      {candidates.map((candidate) => (
        <li className="memory-candidate-list__item" key={candidate.id}>
          <div className="memory-candidate-list__content">
            <Text strong>{candidate.content}</Text>
            <Space size={8} wrap>
              <Tag color="blue">{candidate.kind}</Tag>
              <Tag>{candidate.status}</Tag>
              <Text type="secondary">置信度 {Math.round(candidate.confidence * 100)}%</Text>
            </Space>
          </div>
          <Space>
            <Button
              aria-label="接受"
              icon={<CheckOutlined />}
              onClick={() => onAccept(candidate.id)}
              type="primary"
            >
              接受
            </Button>
            <Button aria-label="拒绝" danger icon={<CloseOutlined />} onClick={() => onReject(candidate.id)}>
              拒绝
            </Button>
          </Space>
        </li>
      ))}
    </Flex>
  );
}
