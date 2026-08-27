import { HistoryOutlined } from "@ant-design/icons";
import { Button, Drawer, Flex, Tag, Typography } from "antd";
import { useState } from "react";

const { Text } = Typography;

export interface ChapterVersionItem {
  readonly id: string;
  readonly title: string;
  readonly version: number;
  readonly source: string;
}

export interface ChapterVersionDrawerProps {
  readonly versions: readonly ChapterVersionItem[];
}

export function ChapterVersionDrawer({ versions }: ChapterVersionDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button icon={<HistoryOutlined />} onClick={() => setOpen(true)}>
        版本
      </Button>
      <Drawer onClose={() => setOpen(false)} open={open} placement="right" size="default" title="章节版本">
        <Flex component="ul" gap={10} vertical>
          {versions.map((version) => (
            <li className="chapter-version-item" key={version.id}>
              <Text strong>{`${version.title} · v${version.version}`}</Text>
              <Tag>{version.source}</Tag>
            </li>
          ))}
        </Flex>
      </Drawer>
    </>
  );
}
