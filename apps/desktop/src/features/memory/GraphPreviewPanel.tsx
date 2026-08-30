import { Empty, Flex, List, Skeleton, Space, Statistic, Tag, Typography } from "antd";

const { Text } = Typography;

export interface GraphPreviewNode {
  readonly id: string;
  readonly label: string;
  readonly type: string;
}

export interface GraphPreviewEdge {
  readonly label: string;
  readonly sourceId: string;
  readonly targetId: string;
}

export interface GraphPreviewData {
  readonly nodes: readonly GraphPreviewNode[];
  readonly edges: readonly GraphPreviewEdge[];
}

export interface GraphPreviewPanelProps {
  readonly loading?: boolean;
  readonly neighborhood?: GraphPreviewData | undefined;
}

export function GraphPreviewPanel({ loading = false, neighborhood }: GraphPreviewPanelProps) {
  if (loading) {
    return <Skeleton active paragraph={{ rows: 4 }} />;
  }

  if (!neighborhood || neighborhood.nodes.length === 0) {
    return <Empty description="暂无图谱邻域" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <Flex className="graph-preview-panel" gap={16} vertical>
      <Space size={24}>
        <Statistic title="节点" value={neighborhood.nodes.length} />
        <Statistic suffix="条关系" title="关系" value={neighborhood.edges.length} />
      </Space>
      <Text type="secondary">{neighborhood.edges.length} 条关系</Text>
      <List
        dataSource={[...neighborhood.nodes]}
        renderItem={(node) => (
          <List.Item>
            <Space orientation="vertical" size={4}>
              <Text strong>{node.label}</Text>
              <Space size={8}>
                <Tag color="geekblue">{node.type}</Tag>
                <Text type="secondary">{node.id}</Text>
              </Space>
            </Space>
          </List.Item>
        )}
      />
    </Flex>
  );
}
