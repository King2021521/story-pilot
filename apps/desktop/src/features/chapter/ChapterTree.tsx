import { Tree } from "antd";

export interface ChapterTreeItem {
  readonly id: string;
  readonly title: string;
}

export interface ChapterTreeProps {
  readonly chapters: readonly ChapterTreeItem[];
  readonly selectedChapterId?: string | undefined;
  onSelectChapter?: ((chapterId: string) => void) | undefined;
}

export function ChapterTree({ chapters, selectedChapterId, onSelectChapter }: ChapterTreeProps) {
  return (
    <aside aria-label="章节树" className="chapter-tree">
      <Tree
        blockNode
        defaultExpandAll
        onSelect={(selectedKeys) => {
          const selectedKey = String(selectedKeys[0] ?? "");
          if (selectedKey) {
            onSelectChapter?.(selectedKey);
          }
        }}
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
