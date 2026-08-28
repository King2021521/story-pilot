import {
  BranchesOutlined,
  DeploymentUnitOutlined,
  FileProtectOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Col, Empty, Row, Spin, Statistic, Tabs } from "antd";
import { useState } from "react";

import {
  ChapterEditorPage,
  type CreateChapterRequest,
  type GenerateChapterDraftRequest,
  type LoadChapterVersionsRequest,
  type RestoreChapterVersionRequest,
  type SaveChapterRequest,
} from "../chapter/ChapterEditorPage";
import type { ChapterVersionItem } from "../chapter/ChapterVersionDrawer";
import {
  CreativeElementsPanel,
  type AcceptElementCandidatesValues,
  type CharacterElement,
  type CreateCharacterValues,
  type CreateForeshadowingValues,
  type CreatePlotlineValues,
  type CreateWorldRuleValues,
  type GenerateElementCandidatesResult,
  type GenerateElementCandidatesValues,
  type ElementCandidateItem,
  type ForeshadowingElement,
  type PlotlineElement,
  type WorldElement,
  type WorldRuleElement,
} from "../creative/CreativeElementsPanel";
import type { ArtifactReviewItem } from "../ai/ArtifactReviewPanel";
import { MemoryCandidateList, type MemoryCandidateItem } from "../memory/MemoryCandidateList";
import type { MemoryCandidateDecisionInput } from "../memory/MemoryConfirmDrawer";
import {
  CreativePathWorkbench,
  type CompletableCreativeStageKey,
  type CreativeStageKey,
  type CreativePathBoard,
  type SaveBriefValues,
} from "../creative-path/CreativePathWorkbench";

export interface WorkbenchProject {
  readonly defaultVolumeId: string;
  readonly genre: string;
  readonly id: string;
  readonly status: string;
  readonly style?: string | null;
  readonly title: string;
}

export interface WorkbenchChapter {
  readonly content: string;
  readonly id: string;
  readonly title: string;
  readonly version: number;
}

export interface WorkbenchBoard {
  readonly artifacts: readonly ArtifactReviewItem[];
  readonly chapters: readonly WorkbenchChapter[];
  readonly characters?: readonly CharacterElement[];
  readonly creativePath?: CreativePathBoard;
  readonly foreshadowings?: readonly ForeshadowingElement[];
  readonly items?: readonly WorldElement[];
  readonly locations?: readonly WorldElement[];
  readonly memoryCandidates: readonly MemoryCandidateItem[];
  readonly organizations?: readonly WorldElement[];
  readonly plotlines?: readonly PlotlineElement[];
  readonly project: WorkbenchProject;
  readonly workOrders: readonly unknown[];
  readonly worldRules?: readonly WorldRuleElement[];
}

export interface WorkbenchHomeProps {
  readonly board?: WorkbenchBoard | undefined;
  readonly chapterVersions?: readonly ChapterVersionItem[];
  readonly loadingChapterVersions?: boolean;
  readonly loading?: boolean;
  readonly selectedChapterId?: string | undefined;
  readonly savingChapter?: boolean;
  onGenerateDraft(input: GenerateChapterDraftRequest): Promise<void> | void;
  onConfirmMemory(input: MemoryCandidateDecisionInput): Promise<void> | void;
  onRejectMemory(candidateId: string): Promise<void> | void;
  onSaveChapter(input: SaveChapterRequest): Promise<void> | void;
  onSelectChapter(chapterId: string): void;
  onCreateChapter(input: CreateChapterRequest): Promise<void> | void;
  onCreateCharacter(input: CreateCharacterValues): Promise<void> | void;
  onCreateForeshadowing(input: CreateForeshadowingValues): Promise<void> | void;
  onCreatePlotline(input: CreatePlotlineValues): Promise<void> | void;
  onCreateWorldRule(input: CreateWorldRuleValues): Promise<void> | void;
  onApplyBlueprint(input: { readonly blueprintId: string }): Promise<void> | void;
  onApplyChapterOutline(input: { readonly chapterOutlineId: string }): Promise<void> | void;
  onApproveChapterOutline(input: { readonly chapterOutlineId: string }): Promise<void> | void;
  onAdvanceStage(input: {
    readonly stageKey: CreativeStageKey;
    readonly mode: "strict" | "force";
  }): Promise<void> | void;
  onCompleteStage(input: { readonly stageKey: CompletableCreativeStageKey }): Promise<void> | void;
  onConfirmBrief(input: { readonly briefId: string }): Promise<void> | void;
  onEvaluateStageGate(input: { readonly stageKey: CreativeStageKey }): Promise<void> | void;
  onGenerateBlueprint(): Promise<void> | void;
  onGenerateDraftFromOutline(input: { readonly chapterOutlineId: string }): Promise<void> | void;
  onGenerateOutline(input: {
    readonly scope: "chapter_batch";
    readonly chapterCount: 10;
  }): Promise<void> | void;
  onReopenStage(input: {
    readonly stageKey: CreativeStageKey;
    readonly reason?: string;
  }): Promise<void> | void;
  onSaveBrief(input: SaveBriefValues): Promise<void> | void;
  onSkipStage(input: {
    readonly stageKey: CreativeStageKey;
    readonly reason: string;
  }): Promise<void> | void;
  onAcceptElementCandidates(input: AcceptElementCandidatesValues): Promise<void> | void;
  onGenerateElementCandidates(
    input: GenerateElementCandidatesValues,
  ):
    | Promise<GenerateElementCandidatesResult | readonly ElementCandidateItem[] | void>
    | GenerateElementCandidatesResult
    | readonly ElementCandidateItem[]
    | void;
  onLoadChapterVersions(input: LoadChapterVersionsRequest): Promise<void> | void;
  onRestoreChapterVersion(input: RestoreChapterVersionRequest): Promise<void> | void;
}

export function WorkbenchHome({
  board,
  chapterVersions = [],
  loadingChapterVersions = false,
  loading = false,
  onConfirmMemory,
  onAcceptElementCandidates,
  onApplyBlueprint,
  onApplyChapterOutline,
  onApproveChapterOutline,
  onAdvanceStage,
  onCompleteStage,
  onConfirmBrief,
  onEvaluateStageGate,
  onCreateChapter,
  onCreateCharacter,
  onCreateForeshadowing,
  onCreatePlotline,
  onCreateWorldRule,
  onGenerateDraft,
  onGenerateBlueprint,
  onGenerateDraftFromOutline,
  onGenerateElementCandidates,
  onGenerateOutline,
  onLoadChapterVersions,
  onRejectMemory,
  onRestoreChapterVersion,
  onReopenStage,
  onSaveChapter,
  onSaveBrief,
  onSelectChapter,
  onSkipStage,
  savingChapter = false,
  selectedChapterId,
}: WorkbenchHomeProps) {
  const [activeTabKey, setActiveTabKey] = useState("creative-path");

  if (loading) {
    return (
      <div className="workbench-home workbench-home--centered">
        <Spin />
      </div>
    );
  }

  if (!board) {
    return (
      <div className="workbench-home workbench-home--centered">
        <Empty description="暂无打开的作品" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    );
  }

  const selectedChapter =
    board.chapters.find((chapter) => chapter.id === selectedChapterId) ?? board.chapters[0];
  const creativePath = board.creativePath ?? createFallbackCreativePath(board.project.genre);
  const chapterProductionBlocked =
    board.chapters.length === 0 &&
    !creativePath.chapterOutlines.some((chapterOutline) => chapterOutline.status === "applied");
  const metrics = [
    { icon: <FileProtectOutlined />, title: "章节", value: board.chapters.length },
    { icon: <TeamOutlined />, title: "人物", value: board.characters?.length ?? 0 },
    { icon: <BranchesOutlined />, title: "故事线", value: board.plotlines?.length ?? 0 },
    { icon: <DeploymentUnitOutlined />, title: "AI 任务", value: board.workOrders.length },
  ];

  return (
    <div className="workbench-home">
      <Row gutter={[12, 12]}>
        {metrics.map((metric) => (
          <Col key={metric.title} lg={6} sm={12} xs={24}>
            <section className="metric-tile">
              <span className="metric-tile__icon">{metric.icon}</span>
              <Statistic title={metric.title} value={metric.value} />
            </section>
          </Col>
        ))}
      </Row>

      <Tabs
        activeKey={activeTabKey}
        className="workbench-tabs"
        items={[
          {
            children: (
              <CreativePathWorkbench
                board={creativePath}
                defaultGenre={board.project.genre}
                onApplyBlueprint={onApplyBlueprint}
                onApplyChapterOutline={onApplyChapterOutline}
                onApproveChapterOutline={onApproveChapterOutline}
                onAdvanceStage={onAdvanceStage}
                onCompleteStage={onCompleteStage}
                onConfirmBrief={onConfirmBrief}
                onEvaluateStageGate={onEvaluateStageGate}
                onGenerateBlueprint={onGenerateBlueprint}
                onGenerateDraftFromOutline={onGenerateDraftFromOutline}
                onGenerateOutline={onGenerateOutline}
                onOpenCreativeElements={() => setActiveTabKey("creative")}
                onReopenStage={onReopenStage}
                onSaveBrief={onSaveBrief}
                onSkipStage={onSkipStage}
              />
            ),
            key: "creative-path",
            label: "创作路径",
          },
          {
            children: (
              <ChapterEditorPage
                chapter={selectedChapter}
                chapters={board.chapters}
                loadingVersions={loadingChapterVersions}
                onCreateChapter={onCreateChapter}
                onGenerateDraft={onGenerateDraft}
                onLoadVersions={onLoadChapterVersions}
                onRestoreVersion={onRestoreChapterVersion}
                onSave={onSaveChapter}
                onSelectChapter={onSelectChapter}
                saving={savingChapter}
                versions={chapterVersions}
              />
            ),
            disabled: chapterProductionBlocked,
            key: "chapter",
            label: "章节生产",
          },
          {
            children: (
              <CreativeElementsPanel
                characters={board.characters ?? []}
                foreshadowings={board.foreshadowings ?? []}
                items={board.items ?? []}
                locations={board.locations ?? []}
                onAcceptElementCandidates={onAcceptElementCandidates}
                onCreateCharacter={onCreateCharacter}
                onCreateForeshadowing={onCreateForeshadowing}
                onCreatePlotline={onCreatePlotline}
                onCreateWorldRule={onCreateWorldRule}
                onGenerateElementCandidates={onGenerateElementCandidates}
                organizations={board.organizations ?? []}
                plotlines={board.plotlines ?? []}
                projectGenre={board.project.genre}
                projectStyle={board.project.style}
                worldRules={board.worldRules ?? []}
              />
            ),
            key: "creative",
            label: "创作要素",
          },
          {
            children: (
              <MemoryCandidateList
                candidates={board.memoryCandidates}
                onConfirm={onConfirmMemory}
                onReject={onRejectMemory}
              />
            ),
            key: "memory",
            label: "记忆确认",
          },
        ]}
        onChange={setActiveTabKey}
      />
    </div>
  );
}

function createFallbackCreativePath(defaultGenre: string): CreativePathBoard {
  return {
    blueprint: null,
    brief: {
      emotionalRewards: ["爽点"],
      forbiddenDirections: [],
      genre: defaultGenre,
      id: "",
      initialIdea: null,
      lengthProfile: "长篇连载",
      narrativePov: "第三人称",
      platformProfile: "男频",
      status: "draft",
      subgenres: [],
      targetAudience: "男频爽文",
    },
    chapterOutlines: [],
    outlines: [],
    reviewIssues: [],
    stages: [
      { readinessScore: 10, stageKey: "brief", status: "available" },
      { readinessScore: 0, stageKey: "blueprint", status: "locked" },
      { readinessScore: 0, stageKey: "worldbuilding", status: "locked" },
      { readinessScore: 0, stageKey: "characters", status: "locked" },
      { readinessScore: 0, stageKey: "plot_arcs", status: "locked" },
      { readinessScore: 0, stageKey: "outline", status: "locked" },
      { readinessScore: 0, stageKey: "chapters", status: "locked" },
      { readinessScore: 0, stageKey: "memory_review", status: "locked" },
      { readinessScore: 0, stageKey: "retrospective", status: "locked" },
    ],
  };
}
