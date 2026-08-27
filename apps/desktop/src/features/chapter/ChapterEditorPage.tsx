import { BranchesOutlined, SaveOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { Button, Empty, Form, Input, Space, Tag, Typography } from "antd";

import { ChapterTree } from "./ChapterTree";
import { ChapterVersionDrawer, type ChapterVersionItem } from "./ChapterVersionDrawer";

const { Text, Title } = Typography;

export interface ChapterEditorModel {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly version: number;
}

export interface SaveChapterRequest {
  readonly chapterId: string;
  readonly content: string;
  readonly baseVersion: number;
}

export interface GenerateChapterDraftRequest {
  readonly chapterId: string;
  readonly instruction: string;
}

export interface ChapterEditorPageProps {
  readonly chapter?: ChapterEditorModel | undefined;
  readonly chapters?: readonly ChapterEditorModel[];
  readonly saving?: boolean;
  readonly versions?: readonly ChapterVersionItem[];
  onGenerateDraft(input: GenerateChapterDraftRequest): Promise<void> | void;
  onSave(input: SaveChapterRequest): Promise<void> | void;
  onSelectChapter?: ((chapterId: string) => void) | undefined;
}

export function ChapterEditorPage({
  chapter,
  chapters,
  onGenerateDraft,
  onSave,
  onSelectChapter,
  saving = false,
  versions,
}: ChapterEditorPageProps) {
  if (!chapter) {
    return (
      <section className="chapter-editor-page">
        <ChapterTree chapters={chapters ?? []} onSelectChapter={onSelectChapter} />
        <div className="chapter-editor-page__main">
          <Empty description="暂无章节" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      </section>
    );
  }

  const chapterVersions = versions ?? [
    {
      id: `${chapter.id}-v${chapter.version}`,
      source: "current",
      title: `${chapter.title} v${chapter.version}`,
      version: chapter.version,
    },
  ];

  return (
    <section className="chapter-editor-page">
      <ChapterTree
        chapters={chapters ?? [chapter]}
        onSelectChapter={onSelectChapter}
        selectedChapterId={chapter.id}
      />

      <div className="chapter-editor-page__main">
        <header className="chapter-editor-page__header">
          <div>
            <Title level={4}>{chapter.title}</Title>
            <Space size={8}>
              <Tag color="processing">v{chapter.version}</Tag>
              <Text type="secondary">草稿</Text>
            </Space>
          </div>
          <Space wrap>
            <ChapterVersionDrawer versions={chapterVersions} />
            <Button
              aria-label="生成草稿"
              icon={<ThunderboltOutlined />}
              onClick={() =>
                onGenerateDraft({
                  chapterId: chapter.id,
                  instruction: "基于当前章节目标生成草稿",
                })
              }
            >
              生成草稿
            </Button>
          </Space>
        </header>

        <Form
          key={`${chapter.id}:${chapter.version}`}
          initialValues={{ content: chapter.content }}
          layout="vertical"
          onFinish={(values: { content: string }) =>
            onSave({
              baseVersion: chapter.version,
              chapterId: chapter.id,
              content: values.content,
            })
          }
        >
          <Form.Item
            label="章节正文"
            name="content"
            rules={[{ required: true, message: "请输入章节正文" }]}
          >
            <Input.TextArea
              aria-label="章节正文"
              autoSize={{ maxRows: 18, minRows: 12 }}
              className="chapter-editor-page__textarea"
            />
          </Form.Item>
          <Space>
            <Button
              aria-label="保存章节"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={saving}
              type="primary"
            >
              保存章节
            </Button>
            <Button icon={<BranchesOutlined />}>查看脉络</Button>
          </Space>
        </Form>
      </div>
    </section>
  );
}
