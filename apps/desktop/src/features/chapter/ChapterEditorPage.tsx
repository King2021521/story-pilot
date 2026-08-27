import { BranchesOutlined, SaveOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { Button, Form, Input, Space, Tag, Typography } from "antd";

import { ChapterTree } from "./ChapterTree";
import { ChapterVersionDrawer } from "./ChapterVersionDrawer";

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
  readonly chapter: ChapterEditorModel;
  onSave(input: SaveChapterRequest): void;
  onGenerateDraft(input: GenerateChapterDraftRequest): void;
}

export function ChapterEditorPage({ chapter, onGenerateDraft, onSave }: ChapterEditorPageProps) {
  return (
    <section className="chapter-editor-page">
      <ChapterTree
        chapters={[
          { id: chapter.id, title: chapter.title },
          { id: "chapter_2", title: "第二章 旧报纸" },
        ]}
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
            <ChapterVersionDrawer
              versions={[
                {
                  id: "version_1",
                  source: "user",
                  title: `${chapter.title} v${chapter.version}`,
                  version: chapter.version,
                },
              ]}
            />
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
          <Form.Item label="章节正文" name="content" rules={[{ required: true, message: "请输入章节正文" }]}>
            <Input.TextArea
              aria-label="章节正文"
              autoSize={{ maxRows: 18, minRows: 12 }}
              className="chapter-editor-page__textarea"
            />
          </Form.Item>
          <Space>
            <Button aria-label="保存章节" htmlType="submit" icon={<SaveOutlined />} type="primary">
              保存章节
            </Button>
            <Button icon={<BranchesOutlined />}>查看脉络</Button>
          </Space>
        </Form>
      </div>
    </section>
  );
}
