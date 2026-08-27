import { Tree } from "antd";

export interface ChapterTreeItem {
  readonly id: string;
  readonly title: string;
}

export interface ChapterTreeProps {
  readonly chapters: readonly ChapterTreeItem[];
  readonly selectedChapterId?: string;
}

export function ChapterTree({ chapters, selectedChapterId }: ChapterTreeProps) {
  return (
    <aside aria-label="章节树" className="chapter-tree">
      <Tree
        blockNode
        defaultExpandAll
        selectedKeys={selectedChapterId ? [selectedChapterId] : []}
        treeData={[
          {
            children: chapters.map((chapter) => ({
              key: chapter.id,
              title: chapter.title,
            })),
            key: "volume_1",
            title: "第一卷",
          },
        ]}
      />
    </aside>
  );
}
