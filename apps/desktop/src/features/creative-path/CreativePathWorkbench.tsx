import {
  AppstoreOutlined,
  BranchesOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  ProfileOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { GENRE_PRESETS } from "@story-pilot/presets";
import { Alert, Button, Descriptions, Empty, Form, Input, Select, Space, Steps, Tag } from "antd";
import type { ReactNode } from "react";
import { useMemo } from "react";

const STAGE_LABELS: Record<CreativeStageKey, string> = {
  brief: "作品立项",
  blueprint: "创作蓝图",
  worldbuilding: "世界观与要素",
  characters: "人物与关系网",
  plot_arcs: "剧情弧线",
  outline: "大纲设计",
  chapters: "章节生产",
  memory_review: "记忆与图谱校验",
  retrospective: "阶段复盘",
};

const STAGE_ORDER = Object.keys(STAGE_LABELS) as CreativeStageKey[];

const SUBGENRE_OPTIONS = [
  "废柴逆袭",
  "群像权谋",
  "规则怪谈",
  "探案单元剧",
  "无限副本",
  "学院成长",
].map((value) => ({ label: value, value }));

const TARGET_AUDIENCE_OPTIONS = ["男频爽文", "女频情绪流", "悬疑强钩子", "轻松日常"].map(
  (value) => ({ label: value, value }),
);

const PLATFORM_OPTIONS = ["男频", "女频", "中短篇", "IP 改编潜力"].map((value) => ({
  label: value,
  value,
}));

const LENGTH_OPTIONS = ["中短篇完结", "长篇连载", "百万字长篇"].map((value) => ({
  label: value,
  value,
}));

const POV_OPTIONS = ["第一人称", "第三人称", "多视角"].map((value) => ({ label: value, value }));

const EMOTIONAL_REWARD_OPTIONS = ["爽点", "悬疑", "成长", "情绪拉扯", "反转", "热血"].map(
  (value) => ({ label: value, value }),
);

const MIDDLE_STAGE_ITEMS = [
  {
    completeLabel: "完成世界观与要素",
    description: "规则、城市、地点、组织、道具、武器、功法",
    icon: <AppstoreOutlined />,
    stageKey: "worldbuilding",
    title: "世界观与要素",
  },
  {
    completeLabel: "完成人物与关系网",
    description: "人物、动机、角色定位、人物关系",
    icon: <TeamOutlined />,
    stageKey: "characters",
    title: "人物与关系网",
  },
  {
    completeLabel: "完成剧情弧线",
    description: "主线、支线、伏笔、冲突升级",
    icon: <BranchesOutlined />,
    stageKey: "plot_arcs",
    title: "剧情弧线",
  },
] as const satisfies ReadonlyArray<{
  readonly completeLabel: string;
  readonly description: string;
  readonly icon: ReactNode;
  readonly stageKey: CompletableCreativeStageKey;
  readonly title: string;
}>;

export type CreativeStageKey =
  | "brief"
  | "blueprint"
  | "worldbuilding"
  | "characters"
  | "plot_arcs"
  | "outline"
  | "chapters"
  | "memory_review"
  | "retrospective";

export type CompletableCreativeStageKey =
  "worldbuilding" | "characters" | "plot_arcs" | "chapters" | "memory_review" | "retrospective";

export interface CreativeStageItem {
  readonly stageKey: CreativeStageKey;
  readonly status: string;
  readonly readinessScore: number;
}

export interface ProjectBriefItem {
  readonly id: string;
  readonly genre: string;
  readonly subgenres: readonly string[];
  readonly targetAudience: string | null;
  readonly platformProfile: string | null;
  readonly lengthProfile: string | null;
  readonly narrativePov: string | null;
  readonly emotionalRewards: readonly string[];
  readonly initialIdea: string | null;
  readonly forbiddenDirections: readonly string[];
  readonly status: string;
}

export interface StoryBlueprintItem {
  readonly id: string;
  readonly premise: string;
  readonly logline: string;
  readonly corePromise: string;
  readonly mainConflict: string;
  readonly protagonistArc: string | null;
  readonly antagonistForce: string | null;
  readonly differentiators: readonly string[];
  readonly risks: readonly string[];
  readonly status: string;
}

export interface OutlineItem {
  readonly id: string;
  readonly title: string;
  readonly scope: string;
  readonly status: string;
}

export interface ChapterOutlineItem {
  readonly id: string;
  readonly chapterId: string | null;
  readonly title: string;
  readonly chapterGoal: string;
  readonly conflict: string | null;
  readonly informationGain: string | null;
  readonly hook: string | null;
  readonly status: string;
}

export interface CreativePathBoard {
  readonly stages: readonly CreativeStageItem[];
  readonly brief: ProjectBriefItem | null;
  readonly blueprint: StoryBlueprintItem | null;
  readonly outlines: readonly OutlineItem[];
  readonly chapterOutlines: readonly ChapterOutlineItem[];
  readonly reviewIssues: readonly unknown[];
}

export interface SaveBriefValues {
  readonly genre: string;
  readonly subgenres: readonly string[];
  readonly targetAudience?: string;
  readonly platformProfile?: string;
  readonly lengthProfile?: string;
  readonly narrativePov?: string;
  readonly emotionalRewards: readonly string[];
  readonly initialIdea?: string;
  readonly forbiddenDirections: readonly string[];
}

export interface CreativePathWorkbenchProps {
  readonly board: CreativePathBoard;
  readonly defaultGenre?: string;
  onSaveBrief(input: SaveBriefValues): Promise<void> | void;
  onConfirmBrief(input: { readonly briefId: string }): Promise<void> | void;
  onGenerateBlueprint(): Promise<void> | void;
  onApplyBlueprint(input: { readonly blueprintId: string }): Promise<void> | void;
  onGenerateOutline(input: {
    readonly scope: "chapter_batch";
    readonly chapterCount: 10;
  }): Promise<void> | void;
  onApproveChapterOutline(input: { readonly chapterOutlineId: string }): Promise<void> | void;
  onApplyChapterOutline(input: { readonly chapterOutlineId: string }): Promise<void> | void;
  onGenerateDraftFromOutline(input: { readonly chapterOutlineId: string }): Promise<void> | void;
  onCompleteStage(input: { readonly stageKey: CompletableCreativeStageKey }): Promise<void> | void;
  onOpenCreativeElements(): void;
}

export function CreativePathWorkbench({
  board,
  defaultGenre = "玄幻",
  onApplyBlueprint,
  onApplyChapterOutline,
  onApproveChapterOutline,
  onConfirmBrief,
  onCompleteStage,
  onGenerateBlueprint,
  onGenerateDraftFromOutline,
  onGenerateOutline,
  onOpenCreativeElements,
  onSaveBrief,
}: CreativePathWorkbenchProps) {
  const [form] = Form.useForm<SaveBriefValues>();
  const currentStage = useMemo(() => getCurrentStageIndex(board.stages), [board.stages]);

  return (
    <div className="creative-path-workbench">
      <section className="creative-path-header">
        <Space align="center">
          <ProfileOutlined />
          <h2>创作路径</h2>
        </Space>
        <Tag color="blue">先设计作品，再生产正文</Tag>
      </section>

      <Steps
        className="creative-path-steps"
        current={currentStage}
        items={STAGE_ORDER.map((stageKey) => ({
          content: getStageDescription(board.stages, stageKey),
          title: STAGE_LABELS[stageKey],
        }))}
        size="small"
      />

      <section className="creative-stage-section">
        <h3>作品立项</h3>
        <Form
          form={form}
          initialValues={{
            emotionalRewards: board.brief?.emotionalRewards ?? ["爽点"],
            forbiddenDirections: board.brief?.forbiddenDirections ?? [],
            genre: board.brief?.genre ?? defaultGenre,
            initialIdea: board.brief?.initialIdea ?? "",
            lengthProfile: board.brief?.lengthProfile ?? "长篇连载",
            narrativePov: board.brief?.narrativePov ?? "第三人称",
            platformProfile: board.brief?.platformProfile ?? "男频",
            subgenres: board.brief?.subgenres.length ? board.brief.subgenres : ["废柴逆袭"],
            targetAudience: board.brief?.targetAudience ?? "男频爽文",
          }}
          layout="vertical"
        >
          <div className="creative-brief-grid">
            <Form.Item label="题材" name="genre" rules={[{ required: true }]}>
              <Select options={[...GENRE_PRESETS]} />
            </Form.Item>
            <Form.Item label="子类型" name="subgenres">
              <Select mode="multiple" options={SUBGENRE_OPTIONS} />
            </Form.Item>
            <Form.Item label="目标读者" name="targetAudience">
              <Select options={TARGET_AUDIENCE_OPTIONS} />
            </Form.Item>
            <Form.Item label="平台倾向" name="platformProfile">
              <Select options={PLATFORM_OPTIONS} />
            </Form.Item>
            <Form.Item label="篇幅目标" name="lengthProfile">
              <Select options={LENGTH_OPTIONS} />
            </Form.Item>
            <Form.Item label="叙事人称" name="narrativePov">
              <Select options={POV_OPTIONS} />
            </Form.Item>
            <Form.Item label="主情绪回报" name="emotionalRewards">
              <Select mode="multiple" options={EMOTIONAL_REWARD_OPTIONS} />
            </Form.Item>
            <Form.Item label="禁用方向" name="forbiddenDirections">
              <Select mode="tags" tokenSeparators={[",", "，"]} />
            </Form.Item>
          </div>
          <Form.Item label="一句话灵感" name="initialIdea">
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
          </Form.Item>
        </Form>
        <Space>
          <Button
            aria-label="保存立项"
            icon={<FileTextOutlined />}
            onClick={() => {
              void form.validateFields().then((values) =>
                onSaveBrief({
                  ...values,
                  emotionalRewards: values.emotionalRewards ?? [],
                  forbiddenDirections: values.forbiddenDirections ?? [],
                  subgenres: values.subgenres ?? [],
                }),
              );
            }}
          >
            保存立项
          </Button>
          <Button
            aria-label="确认立项"
            disabled={!board.brief?.id}
            icon={<CheckCircleOutlined />}
            onClick={() => board.brief?.id && onConfirmBrief({ briefId: board.brief.id })}
            type="primary"
          >
            确认立项
          </Button>
        </Space>
      </section>

      <section className="creative-stage-section">
        <h3>创作蓝图</h3>
        {board.blueprint ? (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="故事前提">{board.blueprint.premise}</Descriptions.Item>
            <Descriptions.Item label="核心承诺">{board.blueprint.corePromise}</Descriptions.Item>
            <Descriptions.Item label="主冲突">{board.blueprint.mainConflict}</Descriptions.Item>
          </Descriptions>
        ) : (
          <Empty description="尚未生成创作蓝图" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
        <Space className="creative-path-actions">
          <Button
            aria-label="生成创作蓝图"
            icon={<BulbOutlined />}
            onClick={() => onGenerateBlueprint()}
          >
            生成创作蓝图
          </Button>
          <Button
            aria-label="应用蓝图"
            disabled={!board.blueprint}
            onClick={() => board.blueprint && onApplyBlueprint({ blueprintId: board.blueprint.id })}
            type="primary"
          >
            应用蓝图
          </Button>
        </Space>
      </section>

      <section className="creative-stage-section">
        <header className="creative-stage-section__header">
          <h3>世界观与人物剧情</h3>
          <Button
            aria-label="进入创作要素"
            disabled={!isAnyMiddleStageOpen(board.stages)}
            icon={<AppstoreOutlined />}
            onClick={onOpenCreativeElements}
          >
            进入创作要素
          </Button>
        </header>
        <div className="creative-middle-stage-grid">
          {MIDDLE_STAGE_ITEMS.map((item) => {
            const stage = getStage(board.stages, item.stageKey);
            const disabled = !isStageActionable(stage);

            return (
              <article className="creative-middle-stage" key={item.stageKey}>
                <div className="creative-middle-stage__icon">{item.icon}</div>
                <div className="creative-middle-stage__body">
                  <Space>
                    <h3>{item.title}</h3>
                    <Tag color={getStageColor(stage)}>{stage?.status ?? "locked"}</Tag>
                  </Space>
                  <span>{item.description}</span>
                </div>
                <Button
                  aria-label={item.completeLabel}
                  disabled={disabled}
                  onClick={() => onCompleteStage({ stageKey: item.stageKey })}
                  type={disabled ? "default" : "primary"}
                >
                  {item.completeLabel}
                </Button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="creative-stage-section">
        <h3>大纲设计</h3>
        <Alert
          title="章节正文必须基于已批准章纲生成。剧情弧线负责故事推进，大纲负责落到卷、章和场景。"
          showIcon
          type="info"
        />
        <Space className="creative-path-actions">
          <Button
            aria-label="生成前 10 章章纲"
            icon={<FileTextOutlined />}
            onClick={() => onGenerateOutline({ chapterCount: 10, scope: "chapter_batch" })}
            type="primary"
          >
            生成前 10 章章纲
          </Button>
        </Space>
        {board.chapterOutlines.length === 0 ? (
          <Empty description="尚无章纲" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <ul className="chapter-outline-list">
            {board.chapterOutlines.map((chapterOutline) => (
              <li className="chapter-outline-list__item" key={chapterOutline.id}>
                <div className="chapter-outline-list__body">
                  <Space>
                    <strong>{chapterOutline.title}</strong>
                    <Tag>{chapterOutline.status}</Tag>
                  </Space>
                  <span>{chapterOutline.chapterGoal}</span>
                  <span>信息增量：{chapterOutline.informationGain ?? "待补充"}</span>
                  <span>钩子：{chapterOutline.hook ?? "待补充"}</span>
                </div>
                <Space wrap>
                  <Button
                    aria-label={`批准章纲 ${chapterOutline.title}`}
                    onClick={() => onApproveChapterOutline({ chapterOutlineId: chapterOutline.id })}
                  >
                    批准章纲
                  </Button>
                  <Button
                    aria-label={`应用为空章节 ${chapterOutline.title}`}
                    onClick={() => onApplyChapterOutline({ chapterOutlineId: chapterOutline.id })}
                  >
                    应用为空章节
                  </Button>
                  <Button
                    aria-label={`基于章纲生成草稿 ${chapterOutline.title}`}
                    onClick={() =>
                      onGenerateDraftFromOutline({ chapterOutlineId: chapterOutline.id })
                    }
                    type="primary"
                  >
                    基于章纲生成草稿
                  </Button>
                </Space>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function getCurrentStageIndex(stages: readonly CreativeStageItem[]): number {
  const firstOpenStage = stages.findIndex(
    (stage) => stage.status === "available" || stage.status === "in_progress",
  );

  return firstOpenStage >= 0 ? firstOpenStage : 0;
}

function getStageDescription(
  stages: readonly CreativeStageItem[],
  stageKey: CreativeStageKey,
): string {
  const stage = stages.find((candidate) => candidate.stageKey === stageKey);
  if (!stage) {
    return "未初始化";
  }

  return `${stage.status} · ${stage.readinessScore}%`;
}

function getStage(
  stages: readonly CreativeStageItem[],
  stageKey: CreativeStageKey,
): CreativeStageItem | undefined {
  return stages.find((stage) => stage.stageKey === stageKey);
}

function isAnyMiddleStageOpen(stages: readonly CreativeStageItem[]): boolean {
  return MIDDLE_STAGE_ITEMS.some((item) => isStageActionable(getStage(stages, item.stageKey)));
}

function isStageActionable(stage: CreativeStageItem | undefined): boolean {
  return stage?.status === "available" || stage?.status === "in_progress";
}

function getStageColor(stage: CreativeStageItem | undefined): string {
  switch (stage?.status) {
    case "completed":
      return "green";
    case "available":
    case "in_progress":
      return "blue";
    default:
      return "default";
  }
}
