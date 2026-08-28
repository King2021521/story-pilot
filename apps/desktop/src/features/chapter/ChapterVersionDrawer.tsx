import { HistoryOutlined, RollbackOutlined } from "@ant-design/icons";
import { Button, Drawer, Flex, Space, Tag, Typography } from "antd";
import { useState } from "react";

const { Text } = Typography;

export interface ChapterVersionItem {
  readonly content?: string;
  readonly createdAt?: number;
  readonly id: string;
  readonly source: string;
  readonly title?: string;
  readonly version: number;
}

export interface ChapterVersionDrawerProps {
  readonly loading?: boolean;
  readonly versions: readonly ChapterVersionItem[];
  onOpen?: (() => Promise<void> | void) | undefined;
  onRestore?: ((versionId: string) => Promise<void> | void) | undefined;
}

export function ChapterVersionDrawer({
  loading = false,
  onOpen,
  onRestore,
  versions,
}: ChapterVersionDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        aria-label="版本"
        icon={<HistoryOutlined />}
        loading={loading}
        onClick={() => {
          setOpen(true);
          void onOpen?.();
        }}
      >
        版本
      </Button>
      <Drawer
        onClose={() => setOpen(false)}
        open={open}
        placement="right"
        size="default"
        title="章节版本"
      >
        <Flex component="ul" gap={10} vertical>
          {versions.map((version) => (
            <li className="chapter-version-item" key={version.id}>
              <Space direction="vertical" size={4}>
                <Text strong>
                  {version.title ? `${version.title} · v${version.version}` : `v${version.version}`}
                </Text>
                <Tag>{version.source}</Tag>
              </Space>
              {onRestore ? (
                <Button
                  aria-label={`恢复 v${version.version}`}
                  icon={<RollbackOutlined />}
                  onClick={() => {
                    void Promise.resolve(onRestore(version.id)).then(() => setOpen(false));
                  }}
                >
                  恢复
                </Button>
              ) : null}
            </li>
          ))}
        </Flex>
      </Drawer>
    </>
  );
}
