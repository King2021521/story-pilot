import {
  BranchesOutlined,
  CheckCircleOutlined,
  PlusOutlined,
  SaveOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { Button, Empty, Form, Input, Modal, Space, Tag, Typography } from "antd";
import { useState } from "react";

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

export interface ReviewChapterDraftRequest {
  readonly chapterId: string;
  readonly chapterVersion?: number;
}

export interface ExtractStoryStateDeltaRequest {
  readonly chapterId: string;
  readonly chapterVersion: number;
}

export interface CreateChapterRequest {
  readonly summary?: string;
  readonly title: string;
}

export interface LoadChapterVersionsRequest {
  readonly chapterId: string;
}

export interface RestoreChapterVersionRequest {
  readonly chapterId: string;
  readonly versionId: string;
}

export interface ChapterEditorPageProps {
  readonly chapter?: ChapterEditorModel | undefined;
  readonly chapters?: readonly ChapterEditorModel[];
  readonly loadingVersions?: boolean;
  readonly saving?: boolean;
  readonly versions?: readonly ChapterVersionItem[];
  onCreateChapter?: ((input: CreateChapterRequest) => Promise<void> | void) | undefined;
  onExtractStateDelta?:
    ((input: ExtractStoryStateDeltaRequest) => Promise<void> | void) | undefined;
  onGenerateDraft(input: GenerateChapterDraftRequest): Promise<void> | void;
  onLoadVersions?: ((input: LoadChapterVersionsRequest) => Promise<void> | void) | undefined;
  onRestoreVersion?: ((input: RestoreChapterVersionRequest) => Promise<void> | void) | undefined;
  onReviewDraft?: ((input: ReviewChapterDraftRequest) => Promise<void> | void) | undefined;
  onSave(input: SaveChapterRequest): Promise<void> | void;
  onSelectChapter?: ((chapterId: string) => void) | undefined;
}

export function ChapterEditorPage({
  chapter,
  chapters,
  loadingVersions = false,
  onCreateChapter,
  onExtractStateDelta,
  onGenerateDraft,
  onLoadVersions,
  onReviewDraft,
  onRestoreVersion,
  onSave,
  onSelectChapter,
  saving = false,
  versions,
}: ChapterEditorPageProps) {
  const [createChapterOpen, setCreateChapterOpen] = useState(false);
  const [createChapterForm] = Form.useForm<CreateChapterRequest>();
  const createChapterAction = onCreateChapter ? (
    <Button
      aria-label="新建章节"
      icon={<PlusOutlined />}
      onClick={() => setCreateChapterOpen(true)}
    >
      新建章节
    </Button>
  ) : null;
  const createChapterModal = onCreateChapter ? (
    <Modal
      footer={null}
      onCancel={() => setCreateChapterOpen(false)}
      open={createChapterOpen}
      title="新建章节"
    >
      <Form
        form={createChapterForm}
        layout="vertical"
        onFinish={async (values) => {
          const title = values.title.trim();
          const summary = values.summary?.trim();
          await onCreateChapter({
            ...(summary ? { summary } : {}),
            title,
          });
          createChapterForm.resetFields();
          setCreateChapterOpen(false);
        }}
      >
        <Form.Item
          label="章节标题"
          name="title"
          rules={[{ required: true, message: "请输入章节标题" }]}
        >
          <Input autoFocus />
        </Form.Item>
        <Form.Item label="章节摘要" name="summary">
          <Input.TextArea autoSize={{ maxRows: 4, minRows: 3 }} />
        </Form.Item>
        <Space>
          <Button onClick={() => setCreateChapterOpen(false)}>取消</Button>
          <Button htmlType="submit" type="primary">
            创建章节
          </Button>
        </Space>
      </Form>
    </Modal>
  ) : null;

  if (!chapter) {
    return (
      <>
        <section className="chapter-editor-page">
          <ChapterTree chapters={chapters ?? []} onSelectChapter={onSelectChapter} />
          <div className="chapter-editor-page__main chapter-editor-page__main--empty">
            <Empty description="暂无章节" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            {createChapterAction}
          </div>
        </section>
        {createChapterModal}
      </>
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
    <>
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
              {createChapterAction}
              <ChapterVersionDrawer
                loading={loadingVersions}
                onOpen={() => onLoadVersions?.({ chapterId: chapter.id })}
                onRestore={
                  onRestoreVersion
                    ? (versionId) => onRestoreVersion({ chapterId: chapter.id, versionId })
                    : undefined
                }
                versions={chapterVersions}
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
              {onReviewDraft ? (
                <Button
                  aria-label="审阅当前版本"
                  icon={<CheckCircleOutlined />}
                  onClick={() =>
                    onReviewDraft({
                      chapterId: chapter.id,
                      chapterVersion: chapter.version,
                    })
                  }
                >
                  审阅当前版本
                </Button>
              ) : null}
              {onExtractStateDelta ? (
                <Button
                  aria-label="抽取状态变化"
                  icon={<BranchesOutlined />}
                  onClick={() =>
                    onExtractStateDelta({
                      chapterId: chapter.id,
                      chapterVersion: chapter.version,
                    })
                  }
                >
                  抽取状态变化
                </Button>
              ) : null}
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
      {createChapterModal}
    </>
  );
}
