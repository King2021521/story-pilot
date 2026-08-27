import {
  BranchesOutlined,
  DeploymentUnitOutlined,
  FileProtectOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Col, Empty, Row, Spin, Statistic, Tabs } from "antd";

import {
  ChapterEditorPage,
  type GenerateChapterDraftRequest,
  type SaveChapterRequest,
} from "../chapter/ChapterEditorPage";
import {
  CreativeElementsPanel,
  type CharacterElement,
  type CreateCharacterValues,
  type CreateForeshadowingValues,
  type CreatePlotlineValues,
  type CreateWorldRuleValues,
  type ForeshadowingElement,
  type PlotlineElement,
  type WorldRuleElement,
} from "../creative/CreativeElementsPanel";
import { MemoryCandidateList, type MemoryCandidateItem } from "../memory/MemoryCandidateList";

export interface WorkbenchProject {
  readonly defaultVolumeId: string;
  readonly genre: string;
  readonly id: string;
  readonly status: string;
  readonly title: string;
}

export interface WorkbenchChapter {
  readonly content: string;
  readonly id: string;
  readonly title: string;
  readonly version: number;
}

export interface WorkbenchBoard {
  readonly artifacts: readonly unknown[];
  readonly chapters: readonly WorkbenchChapter[];
  readonly characters?: readonly CharacterElement[];
  readonly foreshadowings?: readonly ForeshadowingElement[];
  readonly memoryCandidates: readonly MemoryCandidateItem[];
  readonly plotlines?: readonly PlotlineElement[];
  readonly project: WorkbenchProject;
  readonly workOrders: readonly unknown[];
  readonly worldRules?: readonly WorldRuleElement[];
}

export interface WorkbenchHomeProps {
  readonly board?: WorkbenchBoard | undefined;
  readonly loading?: boolean;
  readonly selectedChapterId?: string | undefined;
  readonly savingChapter?: boolean;
  onGenerateDraft(input: GenerateChapterDraftRequest): Promise<void> | void;
  onRejectMemory(candidateId: string): Promise<void> | void;
  onSaveChapter(input: SaveChapterRequest): Promise<void> | void;
  onSelectChapter(chapterId: string): void;
  onAcceptMemory(candidateId: string): Promise<void> | void;
  onCreateCharacter(input: CreateCharacterValues): Promise<void> | void;
  onCreateForeshadowing(input: CreateForeshadowingValues): Promise<void> | void;
  onCreatePlotline(input: CreatePlotlineValues): Promise<void> | void;
  onCreateWorldRule(input: CreateWorldRuleValues): Promise<void> | void;
}

export function WorkbenchHome({
  board,
  loading = false,
  onAcceptMemory,
  onCreateCharacter,
  onCreateForeshadowing,
  onCreatePlotline,
  onCreateWorldRule,
  onGenerateDraft,
  onRejectMemory,
  onSaveChapter,
  onSelectChapter,
  savingChapter = false,
  selectedChapterId,
}: WorkbenchHomeProps) {
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
        className="workbench-tabs"
        items={[
          {
            children: (
              <ChapterEditorPage
                chapter={selectedChapter}
                chapters={board.chapters}
                onGenerateDraft={onGenerateDraft}
                onSave={onSaveChapter}
                onSelectChapter={onSelectChapter}
                saving={savingChapter}
              />
            ),
            key: "chapter",
            label: "章节",
          },
          {
            children: (
              <CreativeElementsPanel
                characters={board.characters ?? []}
                foreshadowings={board.foreshadowings ?? []}
                onCreateCharacter={onCreateCharacter}
                onCreateForeshadowing={onCreateForeshadowing}
                onCreatePlotline={onCreatePlotline}
                onCreateWorldRule={onCreateWorldRule}
                plotlines={board.plotlines ?? []}
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
                onAccept={onAcceptMemory}
                onReject={onRejectMemory}
              />
            ),
            key: "memory",
            label: "记忆确认",
          },
        ]}
      />
    </div>
  );
}
