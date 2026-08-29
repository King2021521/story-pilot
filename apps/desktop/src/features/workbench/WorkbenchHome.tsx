import {
  BranchesOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  FileProtectOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  SaveOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import type { CommandPayload } from "@story-pilot/contracts";
import {
  COUNT_PRESETS,
  ELEMENT_TYPE_PRESETS,
  GENRE_PRESETS,
  STYLE_PRESETS,
  type CountPresetValue,
  type ElementTypePresetValue,
} from "@story-pilot/presets";
import {
  Button,
  Checkbox,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import type { ArtifactReviewItem } from "../ai/ArtifactReviewPanel";
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
  type AcceptElementCandidatesValues,
  type CharacterElement,
  type CharacterImportanceValue,
  type CharacterNarrativeFunctionValue,
  type CreateCharacterValues,
  type CreateForeshadowingValues,
  type CreatePlotlineValues,
  type CreateWorldRuleValues,
  type ElementCandidateItem,
  type ForeshadowingElement,
  type GenerateElementCandidatesResult,
  type GenerateElementCandidatesValues,
  type PlotlineElement,
  type WorldElement,
  type WorldRuleElement,
} from "../creative/CreativeElementsPanel";
import type {
  ChapterPlanItem,
  CompletableCreativeStageKey,
  CreativePathBoard,
  CreativeStageKey,
  SaveBriefValues,
} from "../creative-path/CreativePathWorkbench";
import { MemoryCandidateList, type MemoryCandidateItem } from "../memory/MemoryCandidateList";
import type { MemoryCandidateDecisionInput } from "../memory/MemoryConfirmDrawer";
import {
  PRIMARY_WORKSPACE_MODULES,
  getWorkspaceModuleTitle,
  type WorkspaceModuleKey,
} from "./workspaceModules";

const { Text, Title } = Typography;

const SUBGENRE_OPTIONS = [
  "废柴逆袭",
  "群像权谋",
  "规则怪谈",
  "探案单元剧",
  "无限副本",
  "学院成长",
  "朝堂权谋",
  "灵气复苏",
].map((value) => ({ label: value, value }));

const TARGET_AUDIENCE_OPTIONS = ["男频爽文", "女频情绪流", "悬疑强钩子", "轻松日常"].map(
  (value) => ({ label: value, value }),
);

const PLATFORM_OPTIONS = ["男频", "女频", "中短篇", "IP 改编潜力"].map((value) => ({
  label: value,
  value,
}));

const LENGTH_OPTIONS = ["中短篇完结", "长篇连载", "百万字长篇", "三百万字长篇"].map((value) => ({
  label: value,
  value,
}));

const POV_OPTIONS = ["第一人称", "第三人称", "多视角"].map((value) => ({ label: value, value }));

const EMOTIONAL_REWARD_OPTIONS = ["爽点", "悬疑", "成长", "情绪拉扯", "反转", "热血"].map(
  (value) => ({ label: value, value }),
);

const FORBIDDEN_DIRECTION_OPTIONS = ["降智反派", "主角被动", "机械爽点", "设定失衡"].map(
  (value) => ({ label: value, value }),
);

const CHARACTER_ROLE_OPTIONS: ReadonlyArray<{
  readonly label: string;
  readonly value: CreateCharacterValues["role"];
}> = [
  { label: "主角", value: "protagonist" },
  { label: "反派 / 对抗者", value: "antagonist" },
  { label: "配角", value: "support" },
  { label: "客串", value: "cameo" },
];

const CHARACTER_IMPORTANCE_OPTIONS: ReadonlyArray<{
  readonly label: string;
  readonly value: CharacterImportanceValue;
}> = [
  { label: "核心角色", value: "core" },
  { label: "重要角色", value: "major" },
  { label: "功能角色", value: "minor" },
  { label: "客串角色", value: "cameo" },
];

const CHARACTER_NARRATIVE_FUNCTION_OPTIONS: ReadonlyArray<{
  readonly label: string;
  readonly value: CharacterNarrativeFunctionValue;
}> = [
  { label: "视角角色", value: "viewpoint" },
  { label: "推动剧情", value: "driver" },
  { label: "制造阻力", value: "opposition" },
  { label: "同盟助力", value: "ally" },
  { label: "指引导师", value: "mentor" },
  { label: "对照角色", value: "foil" },
  { label: "情感关系", value: "love_interest" },
  { label: "调剂节奏", value: "comic_relief" },
  { label: "信息来源", value: "information_source" },
  { label: "自定义", value: "custom" },
];

const CHARACTER_ROLE_LABELS = Object.fromEntries(
  CHARACTER_ROLE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<CreateCharacterValues["role"], string>;

const CHARACTER_IMPORTANCE_LABELS = Object.fromEntries(
  CHARACTER_IMPORTANCE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<CharacterImportanceValue, string>;

const CHARACTER_NARRATIVE_FUNCTION_LABELS = Object.fromEntries(
  CHARACTER_NARRATIVE_FUNCTION_OPTIONS.map((option) => [option.value, option.label]),
) as Record<CharacterNarrativeFunctionValue, string>;

const CHARACTER_FORM_DEFAULTS = {
  importance: "major",
  narrativeFunction: "driver",
  role: "support",
} satisfies Pick<CreateCharacterValues, "importance" | "narrativeFunction" | "role">;

const WORLD_DIMENSIONS = [
  {
    description: "时代、文明程度、现实或架空、世界规模、基本类型。",
    key: "worldBase",
    question: "这是一个什么世界？",
    title: "世界基底",
  },
  {
    description: "国家、城市、宗门、大陆、星球、秘境、交通与资源分布。",
    key: "geography",
    question: "世界由哪些地方组成？",
    title: "空间地理",
  },
  {
    description: "战争、灾难、王朝更替、文明兴衰与当前因果背景。",
    key: "history",
    question: "世界为什么变成今天这样？",
    title: "历史背景",
  },
  {
    description: "修炼、魔法、异能、科技、职业、等级、边界、代价与克制。",
    key: "powerSystem",
    question: "人如何变强？",
    title: "力量体系",
  },
  {
    description: "阶层、身份、家族、宗门、公司、贵族、种族与普通人生存状态。",
    key: "socialStructure",
    question: "人如何组织起来？",
    title: "社会结构",
  },
  {
    description: "皇权、宗门、财团、政府、神明等权力来源与制衡关系。",
    key: "powerOrder",
    question: "谁说了算？",
    title: "权力体系",
  },
  {
    description: "国家、宗门、家族、组织、公司、种族，以及联盟和敌对关系。",
    key: "factions",
    question: "世界有哪些玩家？",
    title: "势力格局",
  },
  {
    description: "金钱、灵石、土地、能源、装备、功法、人口、信息的稀缺与流通。",
    key: "economy",
    question: "大家在争什么？",
    title: "资源与经济",
  },
  {
    description: "宗教、伦理、荣誉、婚姻、身份观念、禁忌、风俗与价值冲突。",
    key: "culture",
    question: "这里的人相信什么？",
    title: "文化与价值观",
  },
  {
    description: "法律、宗门规则、潜规则、契约、社会规范与破坏代价。",
    key: "rules",
    question: "什么事情能做、不能做？",
    title: "秩序与规则",
  },
  {
    description: "穿越、轮回、系统、神明、污染、灵气复苏、时间循环等特殊机制。",
    key: "specialMechanism",
    question: "这个世界最独特的规则是什么？",
    title: "超自然 / 特殊机制",
  },
  {
    description: "阶级、种族、资源、文明、理念、旧秩序与新秩序的长期冲突。",
    key: "coreConflict",
    question: "为什么这个世界一定会产生故事？",
    title: "核心矛盾",
  },
] as const satisfies ReadonlyArray<{
  readonly description: string;
  readonly key: keyof WorldbuildingFields;
  readonly question: string;
  readonly title: string;
}>;

const EMPTY_WORLDBUILDING_FIELDS: WorldbuildingFields = {
  coreConflict: "",
  culture: "",
  economy: "",
  factions: "",
  geography: "",
  history: "",
  powerOrder: "",
  powerSystem: "",
  rules: "",
  socialStructure: "",
  specialMechanism: "",
  worldBase: "",
};

const CORE_STORY_DRIVER_VALUES = [
  "growth_reversal",
  "mystery",
  "power_game",
  "adventure",
  "romance",
  "ensemble_epic",
  "survival",
  "slice_of_life",
  "custom",
] as const;

const CORE_STORY_DRIVER_OPTIONS = [
  { label: "成长逆袭", value: "growth_reversal" },
  { label: "悬疑解谜", value: "mystery" },
  { label: "权谋博弈", value: "power_game" },
  { label: "冒险探索", value: "adventure" },
  { label: "情感拉扯", value: "romance" },
  { label: "群像史诗", value: "ensemble_epic" },
  { label: "生存求生", value: "survival" },
  { label: "日常治愈", value: "slice_of_life" },
  { label: "自定义", value: "custom" },
];

const CORE_STORY_EMOTIONAL_AXIS_OPTIONS = [
  "爽感",
  "悬疑",
  "热血",
  "虐恋",
  "治愈",
  "压迫感",
  "反转",
  "成长",
].map((value) => ({ label: value, value }));

const EVENT_TYPE_OPTIONS = [
  { label: "发现", value: "discovery" },
  { label: "冲突", value: "conflict" },
  { label: "揭示", value: "reveal" },
  { label: "决定", value: "decision" },
  { label: "失败", value: "loss" },
  { label: "胜利", value: "victory" },
  { label: "背叛", value: "betrayal" },
  { label: "转场", value: "travel" },
  { label: "自定义", value: "custom" },
] as const;

const MODULE_STAGE_MAP: Partial<Record<WorkspaceModuleKey, CreativeStageKey>> = {
  basic: "brief",
  "book-outline": "outline",
  characters: "characters",
  "chapter-planning": "chapters",
  manuscript: "chapters",
  "plot-nodes": "outline",
  "story-core": "blueprint",
  storylines: "plot_arcs",
  worldbuilding: "worldbuilding",
};

export interface WorkbenchProject {
  readonly defaultVolumeId: string;
  readonly genre: string;
  readonly id: string;
  readonly status: string;
  readonly style?: string | null;
  readonly title: string;
  readonly wordCountGoal?: number | null;
}

export interface WorkbenchChapter {
  readonly content: string;
  readonly id: string;
  readonly title: string;
  readonly version: number;
}

export interface StoryEventElement {
  readonly eventType: string;
  readonly id: string;
  readonly status: string;
  readonly summary: string;
  readonly title: string;
}

export interface CreateStoryEventValues {
  readonly description: string;
  readonly eventType:
    | "decision"
    | "discovery"
    | "conflict"
    | "reveal"
    | "loss"
    | "victory"
    | "betrayal"
    | "travel"
    | "custom";
  readonly storyTime?: string;
  readonly title: string;
}

export interface UpdateCharacterValues {
  readonly characterId: string;
  readonly patch: Partial<CreateCharacterValues>;
}

export type WorldbuildingFields = CommandPayload<"worldbuilding.saveFields">["fields"];
export type CoreStoryFields = CommandPayload<"blueprint.saveForm">["fields"];

interface CoreStoryFormValues extends Omit<CoreStoryFields, "differentiators" | "risks"> {
  readonly differentiatorsText: string;
  readonly risksText: string;
}

const EMPTY_CORE_STORY_FORM_VALUES: CoreStoryFormValues = {
  antagonistForce: "",
  corePromise: "",
  differentiatorsText: "",
  emotionalAxes: [],
  logline: "",
  mainConflict: "",
  mainGoal: "",
  premise: "",
  protagonistArc: "",
  risksText: "",
  stakes: "",
  storyDriver: "growth_reversal",
};

export interface SaveCoreStoryFieldsResult extends CoreStoryFields {
  readonly id: string;
  readonly status: string;
}

export interface CompleteCoreStoryFieldsResult {
  readonly fields: CoreStoryFields;
}

export interface WorldbuildingProfile {
  readonly createdAt: number;
  readonly fields: WorldbuildingFields;
  readonly projectId: string;
  readonly updatedAt: number;
}

export interface CompleteWorldbuildingFieldsResult {
  readonly fields: WorldbuildingFields;
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
  readonly storyEvents?: readonly StoryEventElement[];
  readonly workOrders: readonly unknown[];
  readonly worldRules?: readonly WorldRuleElement[];
  readonly worldbuildingProfile?: WorldbuildingProfile | null;
}

export interface WorkbenchHomeProps {
  readonly activeModuleKey?: WorkspaceModuleKey;
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
  onCreateStoryEvent(input: CreateStoryEventValues): Promise<void> | void;
  onCreateWorldRule(input: CreateWorldRuleValues): Promise<void> | void;
  onCompleteCoreStoryFields(input: {
    readonly fields: CoreStoryFields;
  }): Promise<CompleteCoreStoryFieldsResult> | CompleteCoreStoryFieldsResult;
  onCompleteWorldbuildingFields(input: {
    readonly fields: WorldbuildingFields;
  }): Promise<CompleteWorldbuildingFieldsResult> | CompleteWorldbuildingFieldsResult;
  onSaveCoreStoryFields(input: {
    readonly fields: CoreStoryFields;
  }): Promise<SaveCoreStoryFieldsResult> | SaveCoreStoryFieldsResult;
  onSaveWorldbuildingFields(input: { readonly fields: WorldbuildingFields }): Promise<void> | void;
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
  onGenerateBookPlan(input: {
    readonly targetWordCount: number;
    readonly volumeCount: number;
  }): Promise<void> | void;
  onGenerateDraftFromOutline(input: { readonly chapterOutlineId: string }): Promise<void> | void;
  onGenerateDraftFromPlan(input: { readonly chapterPlanId: string }): Promise<void> | void;
  onGenerateOutline(input: {
    readonly scope: "chapter_batch";
    readonly chapterCount: 10;
  }): Promise<void> | void;
  onGenerateRollingOutline(input: {
    readonly volumePlanId?: string;
    readonly arcPlanId?: string;
    readonly startChapterIndex: number;
    readonly chapterCount: 10 | 20;
  }): Promise<void> | void;
  onReopenStage(input: {
    readonly stageKey: CreativeStageKey;
    readonly reason?: string;
  }): Promise<void> | void;
  onSaveBrief(input: SaveBriefValues): Promise<void> | void;
  onUpdateCharacter(input: UpdateCharacterValues): Promise<void> | void;
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
  activeModuleKey = "dashboard",
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
  onConfirmBrief,
  onCreateChapter,
  onCreateCharacter,
  onCreateForeshadowing,
  onCreatePlotline,
  onCreateStoryEvent,
  onCreateWorldRule,
  onCompleteCoreStoryFields,
  onCompleteWorldbuildingFields,
  onGenerateDraft,
  onGenerateBlueprint,
  onGenerateBookPlan,
  onGenerateDraftFromOutline,
  onGenerateDraftFromPlan,
  onGenerateElementCandidates,
  onGenerateOutline,
  onGenerateRollingOutline,
  onLoadChapterVersions,
  onRejectMemory,
  onRestoreChapterVersion,
  onSaveChapter,
  onSaveBrief,
  onSaveCoreStoryFields,
  onSaveWorldbuildingFields,
  onSelectChapter,
  onUpdateCharacter,
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

  const creativePath = board.creativePath ?? createFallbackCreativePath(board.project.genre);
  const selectedChapter =
    board.chapters.find((chapter) => chapter.id === selectedChapterId) ?? board.chapters[0];
  const moduleTitle = getWorkspaceModuleTitle(activeModuleKey);

  return (
    <div className="novel-workspace">
      <main aria-label={moduleTitle} className="novel-workspace__main">
        {renderModule({
          activeModuleKey,
          board,
          chapterVersions,
          creativePath,
          loadingChapterVersions,
          onAcceptElementCandidates,
          onApplyBlueprint,
          onApplyChapterOutline,
          onApproveChapterOutline,
          onAdvanceStage,
          onConfirmBrief,
          onConfirmMemory,
          onCreateChapter,
          onCreateCharacter,
          onCreateForeshadowing,
          onCreatePlotline,
          onCreateStoryEvent,
          onCreateWorldRule,
          onCompleteCoreStoryFields,
          onCompleteWorldbuildingFields,
          onGenerateBlueprint,
          onGenerateBookPlan,
          onGenerateDraft,
          onGenerateDraftFromOutline,
          onGenerateDraftFromPlan,
          onGenerateElementCandidates,
          onGenerateOutline,
          onGenerateRollingOutline,
          onLoadChapterVersions,
          onRejectMemory,
          onRestoreChapterVersion,
          onSaveBrief,
          onSaveChapter,
          onSaveCoreStoryFields,
          onSaveWorldbuildingFields,
          onSelectChapter,
          onUpdateCharacter,
          savingChapter,
          selectedChapter,
        })}
      </main>
      <WorkspaceContextPanel
        activeModuleKey={activeModuleKey}
        board={board}
        creativePath={creativePath}
      />
    </div>
  );
}

function renderModule(input: {
  readonly activeModuleKey: WorkspaceModuleKey;
  readonly board: WorkbenchBoard;
  readonly chapterVersions: readonly ChapterVersionItem[];
  readonly creativePath: CreativePathBoard;
  readonly loadingChapterVersions: boolean;
  readonly savingChapter: boolean;
  readonly selectedChapter?: WorkbenchChapter | undefined;
  onAcceptElementCandidates(input: AcceptElementCandidatesValues): Promise<void> | void;
  onApplyBlueprint(input: { readonly blueprintId: string }): Promise<void> | void;
  onApplyChapterOutline(input: { readonly chapterOutlineId: string }): Promise<void> | void;
  onApproveChapterOutline(input: { readonly chapterOutlineId: string }): Promise<void> | void;
  onAdvanceStage(input: {
    readonly stageKey: CreativeStageKey;
    readonly mode: "strict" | "force";
  }): Promise<void> | void;
  onConfirmBrief(input: { readonly briefId: string }): Promise<void> | void;
  onConfirmMemory(input: MemoryCandidateDecisionInput): Promise<void> | void;
  onCreateChapter(input: CreateChapterRequest): Promise<void> | void;
  onCreateCharacter(input: CreateCharacterValues): Promise<void> | void;
  onCreateForeshadowing(input: CreateForeshadowingValues): Promise<void> | void;
  onCreatePlotline(input: CreatePlotlineValues): Promise<void> | void;
  onCreateStoryEvent(input: CreateStoryEventValues): Promise<void> | void;
  onCreateWorldRule(input: CreateWorldRuleValues): Promise<void> | void;
  onCompleteCoreStoryFields(input: {
    readonly fields: CoreStoryFields;
  }): Promise<CompleteCoreStoryFieldsResult> | CompleteCoreStoryFieldsResult;
  onCompleteWorldbuildingFields(input: {
    readonly fields: WorldbuildingFields;
  }): Promise<CompleteWorldbuildingFieldsResult> | CompleteWorldbuildingFieldsResult;
  onGenerateBlueprint(): Promise<void> | void;
  onGenerateBookPlan(input: {
    readonly targetWordCount: number;
    readonly volumeCount: number;
  }): Promise<void> | void;
  onGenerateDraft(input: GenerateChapterDraftRequest): Promise<void> | void;
  onGenerateDraftFromOutline(input: { readonly chapterOutlineId: string }): Promise<void> | void;
  onGenerateDraftFromPlan(input: { readonly chapterPlanId: string }): Promise<void> | void;
  onGenerateElementCandidates(
    input: GenerateElementCandidatesValues,
  ):
    | Promise<GenerateElementCandidatesResult | readonly ElementCandidateItem[] | void>
    | GenerateElementCandidatesResult
    | readonly ElementCandidateItem[]
    | void;
  onGenerateOutline(input: {
    readonly scope: "chapter_batch";
    readonly chapterCount: 10;
  }): Promise<void> | void;
  onGenerateRollingOutline(input: {
    readonly volumePlanId?: string;
    readonly arcPlanId?: string;
    readonly startChapterIndex: number;
    readonly chapterCount: 10 | 20;
  }): Promise<void> | void;
  onLoadChapterVersions(input: LoadChapterVersionsRequest): Promise<void> | void;
  onRejectMemory(candidateId: string): Promise<void> | void;
  onRestoreChapterVersion(input: RestoreChapterVersionRequest): Promise<void> | void;
  onSaveBrief(input: SaveBriefValues): Promise<void> | void;
  onSaveChapter(input: SaveChapterRequest): Promise<void> | void;
  onSaveCoreStoryFields(input: {
    readonly fields: CoreStoryFields;
  }): Promise<SaveCoreStoryFieldsResult> | SaveCoreStoryFieldsResult;
  onSaveWorldbuildingFields(input: { readonly fields: WorldbuildingFields }): Promise<void> | void;
  onSelectChapter(chapterId: string): void;
  onUpdateCharacter(input: UpdateCharacterValues): Promise<void> | void;
}) {
  switch (input.activeModuleKey) {
    case "basic":
      return (
        <BasicInfoModule
          creativePath={input.creativePath}
          project={input.board.project}
          onConfirmBrief={input.onConfirmBrief}
          onSaveBrief={input.onSaveBrief}
        />
      );
    case "worldbuilding":
      return (
        <WorldbuildingModule
          onCompleteWorldbuildingFields={input.onCompleteWorldbuildingFields}
          onSaveWorldbuildingFields={input.onSaveWorldbuildingFields}
          profile={input.board.worldbuildingProfile ?? null}
        />
      );
    case "story-core":
      return (
        <CoreStoryModule
          creativePath={input.creativePath}
          onApplyBlueprint={input.onApplyBlueprint}
          onCompleteCoreStoryFields={input.onCompleteCoreStoryFields}
          onSaveCoreStoryFields={input.onSaveCoreStoryFields}
        />
      );
    case "characters":
      return (
        <CharactersModule
          characters={input.board.characters ?? []}
          onAcceptElementCandidates={input.onAcceptElementCandidates}
          onAdvanceStage={input.onAdvanceStage}
          onCreateCharacter={input.onCreateCharacter}
          onGenerateElementCandidates={input.onGenerateElementCandidates}
          onUpdateCharacter={input.onUpdateCharacter}
          project={input.board.project}
          worldRules={input.board.worldRules ?? []}
        />
      );
    case "storylines":
      return (
        <StorylinesModule
          onAdvanceStage={input.onAdvanceStage}
          onCreatePlotline={input.onCreatePlotline}
          plotlines={input.board.plotlines ?? []}
        />
      );
    case "book-outline":
      return (
        <BookOutlineModule
          creativePath={input.creativePath}
          onGenerateBookPlan={input.onGenerateBookPlan}
        />
      );
    case "plot-nodes":
      return (
        <PlotNodesModule
          foreshadowings={input.board.foreshadowings ?? []}
          onCreateForeshadowing={input.onCreateForeshadowing}
          onCreateStoryEvent={input.onCreateStoryEvent}
          storyEvents={input.board.storyEvents ?? []}
        />
      );
    case "chapter-planning":
      return (
        <ChapterPlanningModule
          creativePath={input.creativePath}
          onApplyChapterOutline={input.onApplyChapterOutline}
          onApproveChapterOutline={input.onApproveChapterOutline}
          onGenerateDraftFromOutline={input.onGenerateDraftFromOutline}
          onGenerateDraftFromPlan={input.onGenerateDraftFromPlan}
          onGenerateOutline={input.onGenerateOutline}
          onGenerateRollingOutline={input.onGenerateRollingOutline}
        />
      );
    case "manuscript":
      return (
        <ChapterEditorPage
          chapter={input.selectedChapter}
          chapters={input.board.chapters}
          loadingVersions={input.loadingChapterVersions}
          onCreateChapter={input.onCreateChapter}
          onGenerateDraft={input.onGenerateDraft}
          onLoadVersions={input.onLoadChapterVersions}
          onRestoreVersion={input.onRestoreChapterVersion}
          onSave={input.onSaveChapter}
          onSelectChapter={input.onSelectChapter}
          saving={input.savingChapter}
          versions={input.chapterVersions}
        />
      );
    case "memory":
      return (
        <ModuleSection title="记忆确认">
          <MemoryCandidateList
            candidates={input.board.memoryCandidates}
            onConfirm={input.onConfirmMemory}
            onReject={input.onRejectMemory}
          />
        </ModuleSection>
      );
    case "dashboard":
    default:
      return <DashboardModule board={input.board} creativePath={input.creativePath} />;
  }
}

function DashboardModule({
  board,
  creativePath,
}: {
  readonly board: WorkbenchBoard;
  readonly creativePath: CreativePathBoard;
}) {
  const metrics = [
    { icon: <FileProtectOutlined />, title: "章节", value: board.chapters.length },
    { icon: <TeamOutlined />, title: "人物", value: board.characters?.length ?? 0 },
    { icon: <BranchesOutlined />, title: "故事线", value: board.plotlines?.length ?? 0 },
    { icon: <DatabaseOutlined />, title: "剧情节点", value: board.storyEvents?.length ?? 0 },
    { icon: <DeploymentUnitOutlined />, title: "AI 任务", value: board.workOrders.length },
  ];

  return (
    <div className="module-stack">
      <ModuleHeader eyebrow="总览" title="作品总控台" />
      <Row gutter={[12, 12]}>
        {metrics.map((metric) => (
          <Col key={metric.title} lg={Math.floor(24 / metrics.length)} sm={12} xs={24}>
            <section className="metric-tile">
              <span className="metric-tile__icon">{metric.icon}</span>
              <Statistic title={metric.title} value={metric.value} />
            </section>
          </Col>
        ))}
      </Row>

      <ModuleSection title="创作模块">
        <div className="module-status-list">
          {PRIMARY_WORKSPACE_MODULES.filter((module) => module.key !== "dashboard").map(
            (module) => {
              const stage = getStageForModule(creativePath, module.key);
              return (
                <div className="module-status-list__item" key={module.key}>
                  <div>
                    <Text strong>{module.label}</Text>
                    <Text type="secondary">{module.title}</Text>
                  </div>
                  <Space size={8}>
                    <Tag color={getStatusColor(stage?.status)}>{stage?.status ?? "available"}</Tag>
                    <Text type="secondary">{stage?.readinessScore ?? 0}%</Text>
                  </Space>
                </div>
              );
            },
          )}
        </div>
      </ModuleSection>
    </div>
  );
}

function BasicInfoModule({
  creativePath,
  onConfirmBrief,
  onSaveBrief,
  project,
}: {
  readonly creativePath: CreativePathBoard;
  readonly project: WorkbenchProject;
  onConfirmBrief(input: { readonly briefId: string }): Promise<void> | void;
  onSaveBrief(input: SaveBriefValues): Promise<void> | void;
}) {
  const brief = creativePath.brief;

  return (
    <div className="module-stack">
      <ModuleHeader eyebrow="1 / 9" title="基本信息" />
      <ModuleSection title="作品基础">
        <Form
          key={brief?.id ?? project.id}
          initialValues={{
            emotionalRewards: brief?.emotionalRewards ?? ["爽点"],
            estimatedChapterCount: brief?.estimatedChapterCount ?? 260,
            estimatedWordCount: brief?.estimatedWordCount ?? project.wordCountGoal ?? 800_000,
            forbiddenDirections: brief?.forbiddenDirections ?? [],
            genre: brief?.genre ?? project.genre,
            initialIdea: brief?.initialIdea ?? "",
            lengthProfile: brief?.lengthProfile ?? "长篇连载",
            narrativePov: brief?.narrativePov ?? "第三人称",
            platformProfile: brief?.platformProfile ?? "男频",
            subgenres: brief?.subgenres ?? [],
            targetAudience: brief?.targetAudience ?? "男频爽文",
          }}
          layout="vertical"
          onFinish={(values: SaveBriefValues) => onSaveBrief(normalizeBriefValues(values))}
        >
          <Row gutter={[14, 0]}>
            <Col lg={12} xs={24}>
              <Form.Item label="作品名称">
                <Input aria-label="作品名称" readOnly value={project.title} />
              </Form.Item>
            </Col>
            <Col lg={6} sm={12} xs={24}>
              <Form.Item label="题材" name="genre">
                <Select aria-label="题材" options={[...GENRE_PRESETS]} />
              </Form.Item>
            </Col>
            <Col lg={6} sm={12} xs={24}>
              <Form.Item label="篇幅目标" name="lengthProfile">
                <Select aria-label="篇幅目标" options={LENGTH_OPTIONS} />
              </Form.Item>
            </Col>
            <Col lg={6} sm={12} xs={24}>
              <Form.Item
                label="预计字数"
                name="estimatedWordCount"
                rules={[{ max: 20_000_000, min: 10_000, type: "number" }]}
              >
                <InputNumber
                  aria-label="预计字数"
                  max={20_000_000}
                  min={10_000}
                  step={10_000}
                  style={{ width: "100%" }}
                />
              </Form.Item>
            </Col>
            <Col lg={6} sm={12} xs={24}>
              <Form.Item
                label="预计章节数"
                name="estimatedChapterCount"
                rules={[{ max: 10_000, min: 1, type: "number" }]}
              >
                <InputNumber
                  aria-label="预计章节数"
                  max={10_000}
                  min={1}
                  step={10}
                  style={{ width: "100%" }}
                />
              </Form.Item>
            </Col>
            <Col lg={12} xs={24}>
              <Form.Item label="子类型" name="subgenres">
                <Select
                  aria-label="子类型"
                  mode="tags"
                  options={SUBGENRE_OPTIONS}
                  tokenSeparators={["，", ","]}
                />
              </Form.Item>
            </Col>
            <Col lg={6} sm={12} xs={24}>
              <Form.Item label="目标读者" name="targetAudience">
                <Select aria-label="目标读者" options={TARGET_AUDIENCE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col lg={6} sm={12} xs={24}>
              <Form.Item label="平台倾向" name="platformProfile">
                <Select aria-label="平台倾向" options={PLATFORM_OPTIONS} />
              </Form.Item>
            </Col>
            <Col lg={6} sm={12} xs={24}>
              <Form.Item label="叙事人称" name="narrativePov">
                <Select aria-label="叙事人称" options={POV_OPTIONS} />
              </Form.Item>
            </Col>
            <Col lg={18} xs={24}>
              <Form.Item label="主情绪回报" name="emotionalRewards">
                <Select
                  aria-label="主情绪回报"
                  mode="multiple"
                  options={EMOTIONAL_REWARD_OPTIONS}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="背景介绍 / 一句话灵感" name="initialIdea">
                <Input.TextArea aria-label="背景介绍" autoSize={{ maxRows: 5, minRows: 3 }} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="禁用方向" name="forbiddenDirections">
                <Select
                  aria-label="禁用方向"
                  mode="tags"
                  options={FORBIDDEN_DIRECTION_OPTIONS}
                  tokenSeparators={["，", ","]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Space wrap>
            <Button
              aria-label="保存基本信息"
              htmlType="submit"
              icon={<SaveOutlined />}
              type="primary"
            >
              保存基本信息
            </Button>
            <Button
              aria-label="确认基本信息"
              disabled={!brief?.id}
              icon={<CheckCircleOutlined />}
              onClick={() => {
                if (brief?.id) {
                  void onConfirmBrief({ briefId: brief.id });
                }
              }}
            >
              确认基本信息
            </Button>
          </Space>
        </Form>
      </ModuleSection>
    </div>
  );
}

function FieldLabelWithHelp({
  description,
  label,
  question,
}: {
  readonly description: string;
  readonly label: string;
  readonly question: string;
}) {
  return (
    <span className="field-label-with-help">
      <span>{label}</span>
      <Tooltip
        mouseEnterDelay={0}
        title={
          <span className="field-help-tooltip">
            <strong>{question}</strong>
            <span>{description}</span>
          </span>
        }
      >
        <span
          aria-label={`说明：${label}`}
          className="field-label-help-trigger"
          role="img"
          tabIndex={0}
        >
          <QuestionCircleOutlined />
        </span>
      </Tooltip>
    </span>
  );
}

function WorldbuildingModule({
  onCompleteWorldbuildingFields,
  onSaveWorldbuildingFields,
  profile,
}: {
  readonly profile: WorldbuildingProfile | null;
  onCompleteWorldbuildingFields(input: {
    readonly fields: WorldbuildingFields;
  }): Promise<CompleteWorldbuildingFieldsResult> | CompleteWorldbuildingFieldsResult;
  onSaveWorldbuildingFields(input: { readonly fields: WorldbuildingFields }): Promise<void> | void;
}) {
  const [form] = Form.useForm<WorldbuildingFields>();
  const [completing, setCompleting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    form.setFieldsValue({
      ...EMPTY_WORLDBUILDING_FIELDS,
      ...(profile?.fields ?? {}),
    });
  }, [form, profile]);

  return (
    <div className="module-stack">
      <ModuleHeader eyebrow="2 / 9" title="世界观设计" />
      <Form
        form={form}
        initialValues={EMPTY_WORLDBUILDING_FIELDS}
        layout="vertical"
        onFinish={async (values) => {
          setSaving(true);
          try {
            await onSaveWorldbuildingFields({
              fields: normalizeWorldbuildingFormFields(values),
            });
          } finally {
            setSaving(false);
          }
        }}
      >
        <ModuleSection title="世界观表单">
          <div className="worldbuilding-field-grid">
            {WORLD_DIMENSIONS.map((dimension) => (
              <Form.Item
                key={dimension.key}
                label={
                  <FieldLabelWithHelp
                    description={dimension.description}
                    label={dimension.title}
                    question={dimension.question}
                  />
                }
                name={dimension.key}
                rules={[{ max: 500, message: `${dimension.title}最多 500 字` }]}
              >
                <Input.TextArea
                  aria-label={dimension.title}
                  autoSize={{ maxRows: 8, minRows: 4 }}
                  maxLength={500}
                  placeholder={`填写${dimension.title}`}
                  showCount
                />
              </Form.Item>
            ))}
          </div>
          <div className="worldbuilding-actions">
            <Button
              aria-label="保存"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={saving}
              type="primary"
            >
              保存
            </Button>
            <Button
              aria-label="AI 辅助补全"
              icon={<ThunderboltOutlined />}
              loading={completing}
              onClick={async () => {
                setCompleting(true);
                try {
                  const result = await onCompleteWorldbuildingFields({
                    fields: normalizeWorldbuildingFormFields(form.getFieldsValue()),
                  });
                  form.setFieldsValue(result.fields);
                } finally {
                  setCompleting(false);
                }
              }}
            >
              AI 辅助补全
            </Button>
          </div>
        </ModuleSection>
      </Form>
    </div>
  );
}

function CoreStoryModule({
  creativePath,
  onApplyBlueprint,
  onCompleteCoreStoryFields,
  onSaveCoreStoryFields,
}: {
  readonly creativePath: CreativePathBoard;
  onApplyBlueprint(input: { readonly blueprintId: string }): Promise<void> | void;
  onCompleteCoreStoryFields(input: {
    readonly fields: CoreStoryFields;
  }): Promise<CompleteCoreStoryFieldsResult> | CompleteCoreStoryFieldsResult;
  onSaveCoreStoryFields(input: {
    readonly fields: CoreStoryFields;
  }): Promise<SaveCoreStoryFieldsResult> | SaveCoreStoryFieldsResult;
}) {
  const blueprint = creativePath.blueprint;
  const [form] = Form.useForm<CoreStoryFormValues>();
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    form.setFieldsValue(coreStoryFormValuesFromBlueprint(blueprint));
  }, [blueprint, form]);

  return (
    <div className="module-stack">
      <ModuleHeader eyebrow="3 / 9" title="核心故事设计" />
      <Form
        form={form}
        initialValues={EMPTY_CORE_STORY_FORM_VALUES}
        layout="vertical"
        onFinish={async (values) => {
          setSaving(true);
          try {
            await onSaveCoreStoryFields({ fields: coreStoryFieldsFromFormValues(values) });
          } finally {
            setSaving(false);
          }
        }}
      >
        <ModuleSection title="故事契约表单">
          <div className="core-story-form-grid">
            <Form.Item
              extra="这个故事成立的基本局面，包含人物、事件和世界压力。"
              label="故事前提"
              name="premise"
              rules={[{ max: 800, message: "故事前提最多 800 字" }]}
            >
              <Input.TextArea
                aria-label="故事前提"
                autoSize={{ maxRows: 8, minRows: 4 }}
                maxLength={800}
                placeholder="例如：旧城钟楼火灾十年后，主角收到一封不该存在的旧信。"
                showCount
              />
            </Form.Item>
            <Form.Item
              extra="面向读者和平台的短概括，尽量一句话说清主角、目标和阻力。"
              label="一句话故事"
              name="logline"
              rules={[{ max: 180, message: "一句话故事最多 180 字" }]}
            >
              <Input.TextArea
                aria-label="一句话故事"
                autoSize={{ maxRows: 4, minRows: 2 }}
                maxLength={180}
                placeholder="例如：雨夜旧信把主角拖回十年前钟楼旧案。"
                showCount
              />
            </Form.Item>
            <Form.Item
              extra="读者持续追读能稳定获得什么：爽点、谜题、情绪、成长或关系张力。"
              label="核心承诺"
              name="corePromise"
              rules={[{ max: 800, message: "核心承诺最多 800 字" }]}
            >
              <Input.TextArea
                aria-label="核心承诺"
                autoSize={{ maxRows: 8, minRows: 4 }}
                maxLength={800}
                placeholder="例如：每个单元都给出硬线索、人物反转和旧案真相推进。"
                showCount
              />
            </Form.Item>
            <Form.Item
              extra="主角或群像在长篇中持续推动的明确目标。"
              label="主线目标"
              name="mainGoal"
              rules={[{ max: 800, message: "主线目标最多 800 字" }]}
            >
              <Input.TextArea
                aria-label="主线目标"
                autoSize={{ maxRows: 8, minRows: 4 }}
                maxLength={800}
                placeholder="例如：找出钟楼火灾真相并迫使旧城公开档案。"
                showCount
              />
            </Form.Item>
            <Form.Item
              extra="目标和阻力为什么不可调和，冲突如何持续升级。"
              label="核心矛盾"
              name="mainConflict"
              rules={[{ max: 800, message: "核心矛盾最多 800 字" }]}
            >
              <Input.TextArea
                aria-label="核心矛盾"
                autoSize={{ maxRows: 8, minRows: 4 }}
                maxLength={800}
                placeholder="例如：主角追查真相时不断触碰旧城秩序。"
                showCount
              />
            </Form.Item>
            <Form.Item
              extra="主角从什么状态出发，最终必须完成什么内在变化。"
              label="主角弧光"
              name="protagonistArc"
              rules={[{ max: 800, message: "主角弧光最多 800 字" }]}
            >
              <Input.TextArea
                aria-label="主角弧光"
                autoSize={{ maxRows: 8, minRows: 4 }}
                maxLength={800}
                placeholder="例如：从逃避旧案到主动承担真相带来的代价。"
                showCount
              />
            </Form.Item>
            <Form.Item
              extra="可以是反派、制度、环境、命运或关系结构，不必只有一个人。"
              label="对抗力量"
              name="antagonistForce"
              rules={[{ max: 800, message: "对抗力量最多 800 字" }]}
            >
              <Input.TextArea
                aria-label="对抗力量"
                autoSize={{ maxRows: 8, minRows: 4 }}
                maxLength={800}
                placeholder="例如：旧警署、钟楼议会和被旧案保护的幸存者。"
                showCount
              />
            </Form.Item>
            <Form.Item
              extra="如果主线失败，人物、世界或情感关系会失去什么。"
              label="失败代价"
              name="stakes"
              rules={[{ max: 800, message: "失败代价最多 800 字" }]}
            >
              <Input.TextArea
                aria-label="失败代价"
                autoSize={{ maxRows: 8, minRows: 4 }}
                maxLength={800}
                placeholder="例如：失败会让旧案幸存者再次被清算。"
                showCount
              />
            </Form.Item>
            <Form.Item label="故事驱动类型" name="storyDriver">
              <Select aria-label="故事驱动类型" options={CORE_STORY_DRIVER_OPTIONS} />
            </Form.Item>
            <Form.Item label="情绪主轴" name="emotionalAxes">
              <Select
                aria-label="情绪主轴"
                mode="multiple"
                options={CORE_STORY_EMOTIONAL_AXIS_OPTIONS}
                placeholder="选择 1-3 个主要追读情绪"
              />
            </Form.Item>
            <Form.Item
              extra="一行一个卖点，写具体做法，不写泛泛口号。"
              label="差异化设计"
              name="differentiatorsText"
              rules={[{ max: 1000, message: "差异化设计最多 1000 字" }]}
            >
              <Input.TextArea
                aria-label="差异化设计"
                autoSize={{ maxRows: 8, minRows: 4 }}
                placeholder={"旧信谜题和人物成长绑定\n钟楼档案构成连续线索网"}
              />
            </Form.Item>
            <Form.Item
              extra="一行一个风险，最好同时写规避动作。"
              label="风险与规避"
              name="risksText"
              rules={[{ max: 1000, message: "风险与规避最多 1000 字" }]}
            >
              <Input.TextArea
                aria-label="风险与规避"
                autoSize={{ maxRows: 8, minRows: 4 }}
                placeholder={"线索密度不足会削弱追读，需要每章有信息增量\n旧案反转不能只靠隐瞒信息"}
              />
            </Form.Item>
          </div>
          <div className="core-story-actions">
            <Button
              aria-label="保存草稿"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={saving}
              type="primary"
            >
              保存草稿
            </Button>
            <Button
              aria-label="AI 辅助补全"
              icon={<ThunderboltOutlined />}
              loading={completing}
              onClick={async () => {
                setCompleting(true);
                try {
                  const result = await onCompleteCoreStoryFields({
                    fields: coreStoryFieldsFromFormValues(form.getFieldsValue()),
                  });
                  form.setFieldsValue(coreStoryFormValuesFromFields(result.fields));
                } finally {
                  setCompleting(false);
                }
              }}
            >
              AI 辅助补全
            </Button>
            <Button
              aria-label="确认核心故事"
              icon={<CheckCircleOutlined />}
              loading={confirming}
              onClick={async () => {
                const values = form.getFieldsValue();
                const fields = coreStoryFieldsFromFormValues(values);
                const invalidFields = getMissingCoreStoryFieldNames(fields);
                if (invalidFields.length > 0) {
                  form.setFields(
                    invalidFields.map((name) => ({
                      errors: ["确认前需要填写"],
                      name,
                    })),
                  );
                  const firstInvalidField = invalidFields[0];
                  if (firstInvalidField) {
                    form.scrollToField(firstInvalidField);
                  }
                  return;
                }

                setConfirming(true);
                try {
                  const saved = await onSaveCoreStoryFields({ fields });
                  await onApplyBlueprint({ blueprintId: saved.id });
                } finally {
                  setConfirming(false);
                }
              }}
            >
              确认核心故事
            </Button>
          </div>
        </ModuleSection>
      </Form>
    </div>
  );
}

function CharactersModule({
  characters,
  onAcceptElementCandidates,
  onAdvanceStage,
  onCreateCharacter,
  onGenerateElementCandidates,
  onUpdateCharacter,
  project,
  worldRules,
}: {
  readonly characters: readonly CharacterElement[];
  readonly project: WorkbenchProject;
  readonly worldRules: readonly WorldRuleElement[];
  onAcceptElementCandidates(input: AcceptElementCandidatesValues): Promise<void> | void;
  onAdvanceStage(input: {
    readonly stageKey: CreativeStageKey;
    readonly mode: "strict" | "force";
  }): Promise<void> | void;
  onCreateCharacter(input: CreateCharacterValues): Promise<void> | void;
  onGenerateElementCandidates(
    input: GenerateElementCandidatesValues,
  ):
    | Promise<GenerateElementCandidatesResult | readonly ElementCandidateItem[] | void>
    | GenerateElementCandidatesResult
    | readonly ElementCandidateItem[]
    | void;
  onUpdateCharacter(input: UpdateCharacterValues): Promise<void> | void;
}) {
  const [form] = Form.useForm<CreateCharacterValues>();
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const selectedCharacter =
    characters.find((character) => character.id === selectedCharacterId) ?? null;
  const isEditingCharacter = selectedCharacterId !== null && selectedCharacter !== null;

  useEffect(() => {
    if (selectedCharacter) {
      form.setFieldsValue(characterToFormValues(selectedCharacter));
    }
  }, [form, selectedCharacter]);

  const resetCharacterForm = () => {
    setSelectedCharacterId(null);
    form.resetFields();
    form.setFieldsValue(CHARACTER_FORM_DEFAULTS);
  };

  return (
    <div className="module-stack">
      <ModuleHeader eyebrow="4 / 9" title="角色设计" />
      <div className="character-design-workspace">
        <div className="character-design-primary">
          <section
            aria-label="角色列表面板"
            className="character-design-pane character-design-list"
          >
            <header className="character-design-pane__header">
              <Title level={5}>角色列表</Title>
              <Text type="secondary">{characters.length} 个角色</Text>
            </header>
            <CharacterRoster
              characters={characters}
              selectedCharacterId={selectedCharacterId}
              onSelectCharacter={setSelectedCharacterId}
            />
          </section>

          <section
            aria-label="角色档案表单"
            className="character-design-pane character-design-form"
          >
            <header className="character-design-pane__header">
              <Title level={5}>角色档案</Title>
              <Text type="secondary">先确定人物在故事里的作用，再补外形、弧线和声音。</Text>
            </header>
            <Form
              form={form}
              initialValues={CHARACTER_FORM_DEFAULTS}
              layout="vertical"
              onFinish={async (values) => {
                if (isEditingCharacter) {
                  await onUpdateCharacter({
                    characterId: selectedCharacterId,
                    patch: normalizeCharacterPatchValues(values),
                  });
                  return;
                }

                await onCreateCharacter(normalizeCharacterValues(values));
                resetCharacterForm();
              }}
            >
              <div className="character-form-grid">
                <Form.Item
                  label={characterFieldLabel(
                    "人物名称",
                    "读者识别人物的第一入口。名称要和题材、时代、阵营气质一致。",
                  )}
                  name="name"
                  rules={[
                    { required: true, message: "请输入人物名称" },
                    { max: 80, message: "人物名称最多 80 字" },
                  ]}
                >
                  <Input aria-label="人物名称" placeholder="如：林鸢" />
                </Form.Item>
                <Form.Item label="人物定位" name="role">
                  <Select aria-label="人物定位" options={[...CHARACTER_ROLE_OPTIONS]} />
                </Form.Item>
                <Form.Item label="重要程度" name="importance">
                  <Select aria-label="重要程度" options={[...CHARACTER_IMPORTANCE_OPTIONS]} />
                </Form.Item>
                <Form.Item label="叙事功能" name="narrativeFunction">
                  <Select
                    aria-label="叙事功能"
                    options={[...CHARACTER_NARRATIVE_FUNCTION_OPTIONS]}
                  />
                </Form.Item>
                <Form.Item
                  label={characterFieldLabel(
                    "年龄/身份",
                    "写清年龄段、社会身份、当前处境，帮助后续判断行为可信度。",
                  )}
                  name="genderAge"
                  rules={[{ max: 80, message: "年龄/身份最多 80 字" }]}
                >
                  <Input aria-label="年龄/身份" placeholder="如：女，27 岁，前刑警" />
                </Form.Item>
                <Form.Item
                  label={characterFieldLabel(
                    "首次登场",
                    "记录角色第一次出现的位置或场景，方便大纲阶段安排铺垫。",
                  )}
                  name="firstAppearance"
                  rules={[{ max: 80, message: "首次登场最多 80 字" }]}
                >
                  <Input aria-label="首次登场" placeholder="如：第 1 章，钟楼旧档案室" />
                </Form.Item>
                <Form.Item
                  label={characterFieldLabel(
                    "原型标签",
                    "用一句话概括角色类型，不等于人设全文，例如离队调查者、沉默继承人。",
                  )}
                  name="archetype"
                  rules={[{ max: 80, message: "原型标签最多 80 字" }]}
                >
                  <Input aria-label="原型标签" placeholder="如：离队调查者" />
                </Form.Item>
                <Form.Item
                  className="character-form-grid__wide"
                  label={characterFieldLabel(
                    "剧情任务",
                    "这个人物必须为主线制造什么信息、选择、冲突或代价。没有剧情任务的角色容易变成装饰。",
                  )}
                  name="storyTask"
                  rules={[{ max: 500, message: "剧情任务最多 500 字" }]}
                >
                  <Input.TextArea
                    aria-label="剧情任务"
                    autoSize={{ maxRows: 5, minRows: 3 }}
                    maxLength={500}
                    placeholder="如：把旧信线索推进成主线调查，并把被掩盖的旧案逼出来。"
                    showCount
                  />
                </Form.Item>
                <Form.Item
                  label={characterFieldLabel(
                    "外在目标",
                    "角色主动追求的可见目标，最好能被阻拦、被误导、被迫付出代价。",
                  )}
                  name="goal"
                  rules={[{ max: 500, message: "外在目标最多 500 字" }]}
                >
                  <Input.TextArea
                    aria-label="外在目标"
                    autoSize={{ maxRows: 4, minRows: 2 }}
                    maxLength={500}
                    placeholder="如：查清旧信来源"
                    showCount
                  />
                </Form.Item>
                <Form.Item
                  label={characterFieldLabel(
                    "内在需求",
                    "角色真正需要补上的心理缺口，通常决定人物弧线是否成立。",
                  )}
                  name="need"
                  rules={[{ max: 500, message: "内在需求最多 500 字" }]}
                >
                  <Input.TextArea
                    aria-label="内在需求"
                    autoSize={{ maxRows: 4, minRows: 2 }}
                    maxLength={500}
                    placeholder="如：重新学会信任他人"
                    showCount
                  />
                </Form.Item>
                <Form.Item
                  label={characterFieldLabel(
                    "致命缺陷",
                    "会反复让角色做错选择的弱点，用来生成冲突而不是贴标签。",
                  )}
                  name="flaw"
                  rules={[{ max: 500, message: "致命缺陷最多 500 字" }]}
                >
                  <Input.TextArea
                    aria-label="致命缺陷"
                    autoSize={{ maxRows: 4, minRows: 2 }}
                    maxLength={500}
                    placeholder="如：过度自责，遇到关键证据时会先怀疑自己"
                    showCount
                  />
                </Form.Item>
                <Form.Item
                  label={characterFieldLabel(
                    "秘密",
                    "角色隐瞒的信息、罪责、身份或误会，应该能在剧情中产生揭示价值。",
                  )}
                  name="secret"
                  rules={[{ max: 500, message: "秘密最多 500 字" }]}
                >
                  <Input.TextArea
                    aria-label="秘密"
                    autoSize={{ maxRows: 4, minRows: 2 }}
                    maxLength={500}
                    placeholder="如：十年前曾到过案发现场"
                    showCount
                  />
                </Form.Item>
                <Form.Item
                  className="character-form-grid__wide"
                  label={characterFieldLabel(
                    "关系钩子",
                    "说明这个人物和主角、反派、组织或核心秘密之间的可持续牵引。",
                  )}
                  name="relationshipHook"
                  rules={[{ max: 500, message: "关系钩子最多 500 字" }]}
                >
                  <Input.TextArea
                    aria-label="关系钩子"
                    autoSize={{ maxRows: 4, minRows: 2 }}
                    maxLength={500}
                    placeholder="如：与钟楼守档人互相试探，既需要合作又互相防备。"
                    showCount
                  />
                </Form.Item>
                <Form.Item
                  label={characterFieldLabel(
                    "初始状态",
                    "故事开始时人物相信什么、害怕什么、困在哪里。",
                  )}
                  name="arcStart"
                  rules={[{ max: 500, message: "初始状态最多 500 字" }]}
                >
                  <Input.TextArea
                    aria-label="初始状态"
                    autoSize={{ maxRows: 4, minRows: 2 }}
                    maxLength={500}
                    placeholder="如：逃避旧案，只想离开旧城。"
                    showCount
                  />
                </Form.Item>
                <Form.Item
                  label={characterFieldLabel(
                    "关键转折",
                    "人物被迫改变的决定性节点，用来指导中段剧情。",
                  )}
                  name="arcTurn"
                  rules={[{ max: 500, message: "关键转折最多 500 字" }]}
                >
                  <Input.TextArea
                    aria-label="关键转折"
                    autoSize={{ maxRows: 4, minRows: 2 }}
                    maxLength={500}
                    placeholder="如：发现证人仍被追杀后决定回头。"
                    showCount
                  />
                </Form.Item>
                <Form.Item
                  label={characterFieldLabel(
                    "结局状态",
                    "经历故事后人物成为怎样的人，或者为什么无法改变。",
                  )}
                  name="arcEnd"
                  rules={[{ max: 500, message: "结局状态最多 500 字" }]}
                >
                  <Input.TextArea
                    aria-label="结局状态"
                    autoSize={{ maxRows: 4, minRows: 2 }}
                    maxLength={500}
                    placeholder="如：愿意公开旧案证据并承担代价。"
                    showCount
                  />
                </Form.Item>
                <Form.Item
                  label={characterFieldLabel(
                    "说话风格",
                    "句式、词汇、节奏和回避话题的习惯，帮助正文保持人物声音稳定。",
                  )}
                  name="voiceProfile"
                  rules={[{ max: 500, message: "说话风格最多 500 字" }]}
                >
                  <Input.TextArea
                    aria-label="说话风格"
                    autoSize={{ maxRows: 4, minRows: 2 }}
                    maxLength={500}
                    placeholder="如：克制、短句、偏观察细节。"
                    showCount
                  />
                </Form.Item>
                <Form.Item
                  label={characterFieldLabel(
                    "外形记忆点",
                    "少量高辨识度视觉细节，便于读者记住角色，不需要堆砌外貌描写。",
                  )}
                  name="appearance"
                  rules={[{ max: 500, message: "外形记忆点最多 500 字" }]}
                >
                  <Input.TextArea
                    aria-label="外形记忆点"
                    autoSize={{ maxRows: 4, minRows: 2 }}
                    maxLength={500}
                    placeholder="如：旧风衣、随身旧笔记本，观察时会按住袖口。"
                    showCount
                  />
                </Form.Item>
                <Form.Item
                  className="character-form-grid__wide"
                  label={characterFieldLabel(
                    "人物小传",
                    "只写影响当前剧情的履历和伤痕，避免把小传写成百科。",
                  )}
                  name="biography"
                  rules={[{ max: 500, message: "人物小传最多 500 字" }]}
                >
                  <Input.TextArea
                    aria-label="人物小传"
                    autoSize={{ maxRows: 5, minRows: 3 }}
                    maxLength={500}
                    placeholder="如：前刑警，因十年前钟楼案离队。"
                    showCount
                  />
                </Form.Item>
              </div>
              <Space className="character-form-actions" wrap>
                <Button
                  aria-label={isEditingCharacter ? "保存修改" : "创建人物"}
                  htmlType="submit"
                  icon={isEditingCharacter ? <SaveOutlined /> : <PlusOutlined />}
                  type="primary"
                >
                  {isEditingCharacter ? "保存修改" : "创建人物"}
                </Button>
                {isEditingCharacter ? (
                  <Button aria-label="新建角色" onClick={resetCharacterForm}>
                    新建角色
                  </Button>
                ) : null}
                <Button
                  aria-label="完成角色设计"
                  icon={<CheckCircleOutlined />}
                  onClick={() => onAdvanceStage({ mode: "strict", stageKey: "characters" })}
                >
                  完成角色设计
                </Button>
              </Space>
            </Form>
          </section>
        </div>

        <ElementCandidateSection
          className="character-design-candidate"
          defaultElementType="character_name"
          generateButtonLabel="生成角色候选"
          onAcceptElementCandidates={onAcceptElementCandidates}
          onGenerateElementCandidates={onGenerateElementCandidates}
          project={project}
          title="AI 辅助"
          worldRules={worldRules}
        />
      </div>
    </div>
  );
}

function StorylinesModule({
  onAdvanceStage,
  onCreatePlotline,
  plotlines,
}: {
  readonly plotlines: readonly PlotlineElement[];
  onAdvanceStage(input: {
    readonly stageKey: CreativeStageKey;
    readonly mode: "strict" | "force";
  }): Promise<void> | void;
  onCreatePlotline(input: CreatePlotlineValues): Promise<void> | void;
}) {
  const [form] = Form.useForm<CreatePlotlineValues>();

  return (
    <div className="module-stack">
      <ModuleHeader eyebrow="5 / 9" title="故事线设计" />
      <ModuleSection title="新增故事线">
        <Form
          form={form}
          initialValues={{ kind: "branch", priority: 0 }}
          layout="vertical"
          onFinish={async (values) => {
            const summary = values.summary?.trim();

            await onCreatePlotline({
              kind: values.kind,
              priority: values.priority,
              title: values.title.trim(),
              ...(summary ? { summary } : {}),
            });
            form.resetFields();
            form.setFieldsValue({ kind: "branch", priority: 0 });
          }}
        >
          <Row gutter={[14, 0]}>
            <Col lg={8} xs={24}>
              <Form.Item
                label="故事线标题"
                name="title"
                rules={[{ required: true, message: "请输入故事线标题" }]}
              >
                <Input aria-label="故事线标题" />
              </Form.Item>
            </Col>
            <Col lg={8} xs={24}>
              <Form.Item label="故事线类型" name="kind">
                <Select
                  aria-label="故事线类型"
                  options={[
                    { label: "主线", value: "main" },
                    { label: "支线", value: "branch" },
                    { label: "悬疑", value: "mystery" },
                    { label: "成长", value: "growth" },
                    { label: "感情", value: "romance" },
                    { label: "世界线", value: "world" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col lg={8} xs={24}>
              <Form.Item label="优先级" name="priority">
                <InputNumber aria-label="故事线优先级" min={0} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="故事线摘要" name="summary">
                <Input.TextArea aria-label="故事线摘要" autoSize={{ maxRows: 4, minRows: 2 }} />
              </Form.Item>
            </Col>
          </Row>
          <Space wrap>
            <Button
              aria-label="创建故事线"
              htmlType="submit"
              icon={<PlusOutlined />}
              type="primary"
            >
              创建故事线
            </Button>
            <Button
              aria-label="完成故事线设计"
              icon={<CheckCircleOutlined />}
              onClick={() => onAdvanceStage({ mode: "strict", stageKey: "plot_arcs" })}
            >
              完成故事线设计
            </Button>
          </Space>
        </Form>
      </ModuleSection>
      <ModuleSection title="故事线列表">
        <CompactList
          emptyText="暂无故事线"
          items={plotlines.map((plotline) => ({
            description: plotline.summary ?? undefined,
            id: plotline.id,
            label: plotline.name,
            tags: [plotline.type, `P${plotline.priority}`],
          }))}
        />
      </ModuleSection>
    </div>
  );
}

function BookOutlineModule({
  creativePath,
  onGenerateBookPlan,
}: {
  readonly creativePath: CreativePathBoard;
  onGenerateBookPlan(input: {
    readonly targetWordCount: number;
    readonly volumeCount: number;
  }): Promise<void> | void;
}) {
  return (
    <div className="module-stack">
      <ModuleHeader eyebrow="6 / 9" title="全书大纲" />
      <ModuleSection title="生成全书规划">
        <Form
          initialValues={{ targetWordCount: 3_000_000, volumeCount: 6 }}
          layout="vertical"
          onFinish={(values: { readonly targetWordCount: number; readonly volumeCount: number }) =>
            onGenerateBookPlan(values)
          }
        >
          <Row gutter={[14, 0]}>
            <Col lg={8} xs={24}>
              <Form.Item label="目标字数" name="targetWordCount">
                <InputNumber aria-label="目标字数" max={10_000_000} min={100_000} step={100_000} />
              </Form.Item>
            </Col>
            <Col lg={8} xs={24}>
              <Form.Item label="预计卷数" name="volumeCount">
                <InputNumber aria-label="预计卷数" max={30} min={1} />
              </Form.Item>
            </Col>
          </Row>
          <Button
            aria-label="生成全书规划"
            htmlType="submit"
            icon={<ThunderboltOutlined />}
            type="primary"
          >
            生成全书规划
          </Button>
        </Form>
      </ModuleSection>
      <Row gutter={[14, 14]}>
        <Col lg={8} xs={24}>
          <PlanList
            emptyText="暂无全书规划"
            items={creativePath.bookPlans}
            title="全书规划"
            toItem={(plan) => ({
              description: `${plan.targetWordCount.toLocaleString()} 字`,
              id: plan.id,
              label: plan.title,
              tags: ["book"],
            })}
          />
        </Col>
        <Col lg={8} xs={24}>
          <PlanList
            emptyText="暂无卷规划"
            items={creativePath.volumePlans}
            title="卷 / 阶段"
            toItem={(plan) => ({
              id: plan.id,
              label: plan.title,
              tags: [`第 ${plan.volumeIndex} 卷`],
            })}
          />
        </Col>
        <Col lg={8} xs={24}>
          <PlanList
            emptyText="暂无弧线规划"
            items={creativePath.arcPlans}
            title="阶段弧线"
            toItem={(plan) => ({
              id: plan.id,
              label: plan.title,
              tags: ["arc"],
            })}
          />
        </Col>
      </Row>
    </div>
  );
}

function PlotNodesModule({
  foreshadowings,
  onCreateForeshadowing,
  onCreateStoryEvent,
  storyEvents,
}: {
  readonly foreshadowings: readonly ForeshadowingElement[];
  readonly storyEvents: readonly StoryEventElement[];
  onCreateForeshadowing(input: CreateForeshadowingValues): Promise<void> | void;
  onCreateStoryEvent(input: CreateStoryEventValues): Promise<void> | void;
}) {
  const [eventForm] = Form.useForm<CreateStoryEventValues>();
  const [foreshadowingForm] = Form.useForm<CreateForeshadowingValues>();

  return (
    <div className="module-stack">
      <ModuleHeader eyebrow="7 / 9" title="剧情节点设计" />
      <ModuleSection title="新增剧情节点">
        <Form
          name="storyEventForm"
          form={eventForm}
          initialValues={{ eventType: "discovery" }}
          layout="vertical"
          onFinish={async (values) => {
            const storyTime = values.storyTime?.trim();

            await onCreateStoryEvent({
              description: values.description.trim(),
              eventType: values.eventType,
              title: values.title.trim(),
              ...(storyTime ? { storyTime } : {}),
            });
            eventForm.resetFields();
            eventForm.setFieldValue("eventType", "discovery");
          }}
        >
          <Row gutter={[14, 0]}>
            <Col lg={8} xs={24}>
              <Form.Item
                label="节点标题"
                name="title"
                rules={[{ required: true, message: "请输入节点标题" }]}
              >
                <Input aria-label="节点标题" />
              </Form.Item>
            </Col>
            <Col lg={8} xs={24}>
              <Form.Item label="节点类型" name="eventType">
                <Select aria-label="节点类型" options={[...EVENT_TYPE_OPTIONS]} />
              </Form.Item>
            </Col>
            <Col lg={8} xs={24}>
              <Form.Item label="故事时间" name="storyTime">
                <Input aria-label="故事时间" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                label="节点描述"
                name="description"
                rules={[{ required: true, message: "请输入节点描述" }]}
              >
                <Input.TextArea aria-label="节点描述" autoSize={{ maxRows: 4, minRows: 2 }} />
              </Form.Item>
            </Col>
          </Row>
          <Button
            aria-label="创建剧情节点"
            htmlType="submit"
            icon={<PlusOutlined />}
            type="primary"
          >
            创建剧情节点
          </Button>
        </Form>
      </ModuleSection>

      <ModuleSection title="新增伏笔 / 回收">
        <Form
          name="foreshadowingForm"
          form={foreshadowingForm}
          initialValues={{ importance: 3 }}
          layout="vertical"
          onFinish={async (values) => {
            const payoffExpectation = values.payoffExpectation?.trim();

            await onCreateForeshadowing({
              description: values.description.trim(),
              importance: values.importance,
              title: values.title.trim(),
              ...(payoffExpectation ? { payoffExpectation } : {}),
            });
            foreshadowingForm.resetFields();
            foreshadowingForm.setFieldValue("importance", 3);
          }}
        >
          <Row gutter={[14, 0]}>
            <Col lg={8} xs={24}>
              <Form.Item
                label="伏笔标题"
                name="title"
                rules={[{ required: true, message: "请输入伏笔标题" }]}
              >
                <Input aria-label="伏笔标题" />
              </Form.Item>
            </Col>
            <Col lg={6} xs={24}>
              <Form.Item label="重要性" name="importance">
                <InputNumber aria-label="伏笔重要性" max={5} min={1} />
              </Form.Item>
            </Col>
            <Col lg={10} xs={24}>
              <Form.Item label="回收预期" name="payoffExpectation">
                <Input aria-label="回收预期" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                label="伏笔内容"
                name="description"
                rules={[{ required: true, message: "请输入伏笔内容" }]}
              >
                <Input.TextArea aria-label="伏笔内容" autoSize={{ maxRows: 4, minRows: 2 }} />
              </Form.Item>
            </Col>
          </Row>
          <Button aria-label="创建伏笔" htmlType="submit" icon={<PlusOutlined />} type="primary">
            创建伏笔
          </Button>
        </Form>
      </ModuleSection>

      <Row gutter={[14, 14]}>
        <Col lg={12} xs={24}>
          <ModuleSection title="剧情节点列表">
            <CompactList
              emptyText="暂无剧情节点"
              items={storyEvents.map((event) => ({
                description: event.summary,
                id: event.id,
                label: event.title,
                tags: [event.eventType, event.status],
              }))}
            />
          </ModuleSection>
        </Col>
        <Col lg={12} xs={24}>
          <ModuleSection title="伏笔列表">
            <CompactList
              emptyText="暂无伏笔"
              items={foreshadowings.map((foreshadowing) => ({
                description: foreshadowing.seedText ?? undefined,
                id: foreshadowing.id,
                label: foreshadowing.title,
                tags: [foreshadowing.status],
              }))}
            />
          </ModuleSection>
        </Col>
      </Row>
    </div>
  );
}

function ChapterPlanningModule({
  creativePath,
  onApplyChapterOutline,
  onApproveChapterOutline,
  onGenerateDraftFromOutline,
  onGenerateDraftFromPlan,
  onGenerateOutline,
  onGenerateRollingOutline,
}: {
  readonly creativePath: CreativePathBoard;
  onApplyChapterOutline(input: { readonly chapterOutlineId: string }): Promise<void> | void;
  onApproveChapterOutline(input: { readonly chapterOutlineId: string }): Promise<void> | void;
  onGenerateDraftFromOutline(input: { readonly chapterOutlineId: string }): Promise<void> | void;
  onGenerateDraftFromPlan(input: { readonly chapterPlanId: string }): Promise<void> | void;
  onGenerateOutline(input: {
    readonly scope: "chapter_batch";
    readonly chapterCount: 10;
  }): Promise<void> | void;
  onGenerateRollingOutline(input: {
    readonly volumePlanId?: string;
    readonly arcPlanId?: string;
    readonly startChapterIndex: number;
    readonly chapterCount: 10 | 20;
  }): Promise<void> | void;
}) {
  const firstVolumePlanId = creativePath.volumePlans[0]?.id;
  const firstArcPlanId = creativePath.arcPlans[0]?.id;
  const nextChapterIndex = getNextChapterPlanIndex(creativePath.chapterPlans);

  return (
    <div className="module-stack">
      <ModuleHeader eyebrow="8 / 9" title="章节规划" />
      <ModuleSection title="章纲生成">
        <Space wrap>
          <Button
            aria-label="生成未来 10 章章纲"
            icon={<ThunderboltOutlined />}
            onClick={() =>
              onGenerateRollingOutline({
                chapterCount: 10,
                startChapterIndex: nextChapterIndex,
                ...(firstArcPlanId === undefined ? {} : { arcPlanId: firstArcPlanId }),
                ...(firstVolumePlanId === undefined ? {} : { volumePlanId: firstVolumePlanId }),
              })
            }
            type="primary"
          >
            生成未来 10 章章纲
          </Button>
          <Button
            aria-label="生成前 10 章章纲"
            icon={<ThunderboltOutlined />}
            onClick={() => onGenerateOutline({ chapterCount: 10, scope: "chapter_batch" })}
          >
            生成前 10 章章纲
          </Button>
        </Space>
      </ModuleSection>

      <ModuleSection title="结构化章节规划">
        <StructuredPlanList
          chapterPlans={creativePath.chapterPlans}
          onGenerateDraftFromPlan={onGenerateDraftFromPlan}
        />
      </ModuleSection>

      <ModuleSection title="待应用章纲">
        <ChapterOutlineList
          chapterOutlines={creativePath.chapterOutlines}
          onApplyChapterOutline={onApplyChapterOutline}
          onApproveChapterOutline={onApproveChapterOutline}
          onGenerateDraftFromOutline={onGenerateDraftFromOutline}
        />
      </ModuleSection>
    </div>
  );
}

function ElementCandidateSection({
  className,
  defaultElementType,
  generateButtonLabel = "批量生成候选",
  onAcceptElementCandidates,
  onGenerateElementCandidates,
  project,
  title,
  worldRules,
}: {
  readonly className?: string;
  readonly defaultElementType: ElementTypePresetValue;
  readonly generateButtonLabel?: string;
  readonly project: WorkbenchProject;
  readonly title: string;
  readonly worldRules: readonly WorldRuleElement[];
  onAcceptElementCandidates(input: AcceptElementCandidatesValues): Promise<void> | void;
  onGenerateElementCandidates(
    input: GenerateElementCandidatesValues,
  ):
    | Promise<GenerateElementCandidatesResult | readonly ElementCandidateItem[] | void>
    | GenerateElementCandidatesResult
    | readonly ElementCandidateItem[]
    | void;
}) {
  const [form] = Form.useForm<{
    readonly constraints?: string[];
    readonly count: CountPresetValue;
    readonly elementType: ElementTypePresetValue;
    readonly style?: string;
    readonly worldRuleIds?: string[];
  }>();
  const [candidateItems, setCandidateItems] = useState<readonly ElementCandidateItem[]>([]);
  const [selectedCandidateKeys, setSelectedCandidateKeys] = useState<readonly string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const worldRuleOptions = useMemo(
    () => worldRules.map((rule) => ({ label: rule.title, value: rule.id })),
    [worldRules],
  );
  const defaultStyle = project.style?.trim() || "通用";
  const selectedCandidates = candidateItems.filter((candidate, index) =>
    selectedCandidateKeys.includes(candidateKey(candidate, index)),
  );

  useEffect(() => {
    form.setFieldsValue({
      elementType: defaultElementType,
      style: defaultStyle,
      worldRuleIds: worldRules.map((rule) => rule.id),
    });
  }, [defaultElementType, defaultStyle, form, worldRules]);

  return (
    <ModuleSection {...(className === undefined ? {} : { className })} title={title}>
      <Form
        form={form}
        initialValues={{
          constraints: [],
          count: 10,
          elementType: defaultElementType,
          style: defaultStyle,
          worldRuleIds: worldRules.map((rule) => rule.id),
        }}
        layout="vertical"
        onFinish={async (values) => {
          setGenerating(true);
          try {
            const result = await onGenerateElementCandidates({
              constraints: values.constraints ?? [],
              count: values.count,
              elementType: values.elementType,
              genre: project.genre,
              ...(values.style === undefined ? {} : { style: values.style }),
              worldRuleIds: values.worldRuleIds ?? [],
            });
            setCandidateItems(normalizeCandidateResult(result));
            setSelectedCandidateKeys([]);
          } finally {
            setGenerating(false);
          }
        }}
      >
        <Row gutter={[14, 0]}>
          <Col lg={6} sm={12} xs={24}>
            <Form.Item label="候选类型" name="elementType">
              <Select aria-label="候选类型" options={[...ELEMENT_TYPE_PRESETS]} />
            </Form.Item>
          </Col>
          <Col lg={4} sm={12} xs={24}>
            <Form.Item label="数量" name="count">
              <Select aria-label="数量" options={[...COUNT_PRESETS]} />
            </Form.Item>
          </Col>
          <Col lg={6} sm={12} xs={24}>
            <Form.Item label="候选风格" name="style">
              <Select aria-label="候选风格" options={[...STYLE_PRESETS]} />
            </Form.Item>
          </Col>
          <Col lg={8} sm={12} xs={24}>
            <Form.Item label="世界观约束" name="worldRuleIds">
              <Select
                aria-label="世界观约束"
                mode="multiple"
                optionFilterProp="label"
                options={worldRuleOptions}
              />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="额外约束" name="constraints">
              <Select
                aria-label="额外约束"
                mode="tags"
                options={[
                  { label: "避免现代感", value: "避免现代感" },
                  { label: "可反复出场", value: "可反复出场" },
                  { label: "适合主线冲突", value: "适合主线冲突" },
                ]}
                tokenSeparators={["，", ","]}
              />
            </Form.Item>
          </Col>
        </Row>
        <Space wrap>
          <Button
            aria-label={generateButtonLabel}
            htmlType="submit"
            icon={<ThunderboltOutlined />}
            loading={generating}
            type="primary"
          >
            {generateButtonLabel}
          </Button>
          <Button
            disabled={selectedCandidates.length === 0}
            loading={accepting}
            onClick={async () => {
              setAccepting(true);
              try {
                await onAcceptElementCandidates({ items: selectedCandidates });
                setCandidateItems((currentItems) =>
                  currentItems.filter(
                    (candidate, index) =>
                      !selectedCandidateKeys.includes(candidateKey(candidate, index)),
                  ),
                );
                setSelectedCandidateKeys([]);
              } finally {
                setAccepting(false);
              }
            }}
          >
            采纳选中
          </Button>
        </Space>
      </Form>
      <CandidateList
        items={candidateItems}
        selectedKeys={selectedCandidateKeys}
        onToggle={(key, checked) => {
          setSelectedCandidateKeys((currentKeys) =>
            checked
              ? [...currentKeys, key]
              : currentKeys.filter((currentKey) => currentKey !== key),
          );
        }}
      />
    </ModuleSection>
  );
}

function WorkspaceContextPanel({
  activeModuleKey,
  board,
  creativePath,
}: {
  readonly activeModuleKey: WorkspaceModuleKey;
  readonly board: WorkbenchBoard;
  readonly creativePath: CreativePathBoard;
}) {
  const stage = getStageForModule(creativePath, activeModuleKey);
  const filledWorldbuildingFieldCount = countFilledWorldbuildingFields(
    board.worldbuildingProfile?.fields,
  );

  return (
    <aside aria-label="上下文面板" className="novel-context-panel">
      <div>
        <Text className="story-section-title">当前模块</Text>
        <Text className="novel-context-panel__title" strong>
          {getWorkspaceModuleTitle(activeModuleKey)}
        </Text>
      </div>
      <Descriptions column={1} size="small">
        <Descriptions.Item label="阶段状态">
          <Tag color={getStatusColor(stage?.status)}>{stage?.status ?? "available"}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="完成度">{stage?.readinessScore ?? 0}%</Descriptions.Item>
        {activeModuleKey === "worldbuilding" ? (
          <Descriptions.Item label="世界观维度">
            {filledWorldbuildingFieldCount}/{WORLD_DIMENSIONS.length}
          </Descriptions.Item>
        ) : (
          <Descriptions.Item label="世界规则">{board.worldRules?.length ?? 0}</Descriptions.Item>
        )}
        <Descriptions.Item label="人物">{board.characters?.length ?? 0}</Descriptions.Item>
        <Descriptions.Item label="故事线">{board.plotlines?.length ?? 0}</Descriptions.Item>
        <Descriptions.Item label="剧情节点">{board.storyEvents?.length ?? 0}</Descriptions.Item>
        <Descriptions.Item label="待审产物">{board.artifacts.length}</Descriptions.Item>
      </Descriptions>
      <div className="novel-context-panel__block">
        <Text className="story-section-title">写作上下文</Text>
        <ul className="context-fact-list">
          <li>题材：{board.project.genre}</li>
          <li>风格：{board.project.style ?? "通用"}</li>
          <li>章节：{board.chapters.length}</li>
          <li>待确认记忆：{board.memoryCandidates.length}</li>
        </ul>
      </div>
    </aside>
  );
}

function ModuleHeader({ eyebrow, title }: { readonly eyebrow: string; readonly title: string }) {
  return (
    <header className="module-header">
      <div>
        <Text className="story-eyebrow">{eyebrow}</Text>
        <Title level={3}>{title}</Title>
      </div>
    </header>
  );
}

function ModuleSection({
  children,
  className,
  extra,
  title,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly extra?: ReactNode;
  readonly title: string;
}) {
  return (
    <section className={["module-section", className].filter(Boolean).join(" ")}>
      <header className="module-section__header">
        <Title level={5}>{title}</Title>
        {extra}
      </header>
      {children}
    </section>
  );
}

function PlanList<TItem>({
  emptyText,
  items,
  title,
  toItem,
}: {
  readonly emptyText: string;
  readonly items: readonly TItem[];
  readonly title: string;
  toItem(item: TItem): CompactListItem;
}) {
  return (
    <ModuleSection title={title}>
      <CompactList emptyText={emptyText} items={items.map(toItem)} />
    </ModuleSection>
  );
}

function StructuredPlanList({
  chapterPlans,
  onGenerateDraftFromPlan,
}: {
  readonly chapterPlans: readonly ChapterPlanItem[];
  onGenerateDraftFromPlan(input: { readonly chapterPlanId: string }): Promise<void> | void;
}) {
  if (chapterPlans.length === 0) {
    return <Empty description="暂无结构化章节规划" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <ul className="chapter-outline-list">
      {chapterPlans.map((plan) => {
        const title = formatChapterPlanTitle(plan);

        return (
          <li className="chapter-outline-list__item" key={plan.id}>
            <div className="chapter-outline-list__body">
              <Text strong>{title}</Text>
              <Text type="secondary">{plan.chapterGoal}</Text>
              <Space size={6} wrap>
                <Tag>{plan.status}</Tag>
              </Space>
            </div>
            <Button
              aria-label={`基于结构章纲生成草稿 ${title}`}
              onClick={() => onGenerateDraftFromPlan({ chapterPlanId: plan.id })}
            >
              基于结构章纲生成草稿
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

function ChapterOutlineList({
  chapterOutlines,
  onApplyChapterOutline,
  onApproveChapterOutline,
  onGenerateDraftFromOutline,
}: {
  readonly chapterOutlines: CreativePathBoard["chapterOutlines"];
  onApplyChapterOutline(input: { readonly chapterOutlineId: string }): Promise<void> | void;
  onApproveChapterOutline(input: { readonly chapterOutlineId: string }): Promise<void> | void;
  onGenerateDraftFromOutline(input: { readonly chapterOutlineId: string }): Promise<void> | void;
}) {
  if (chapterOutlines.length === 0) {
    return <Empty description="暂无待应用章纲" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <ul className="chapter-outline-list">
      {chapterOutlines.map((outline) => (
        <li className="chapter-outline-list__item" key={outline.id}>
          <div className="chapter-outline-list__body">
            <Text strong>{outline.title}</Text>
            <Text type="secondary">{outline.chapterGoal}</Text>
            <Space size={6} wrap>
              {outline.conflict ? <Tag>冲突：{outline.conflict}</Tag> : null}
              {outline.hook ? <Tag>钩子：{outline.hook}</Tag> : null}
              <Tag>{outline.status}</Tag>
            </Space>
          </div>
          <Space wrap>
            <Button
              aria-label={`批准章纲 ${outline.title}`}
              onClick={() => onApproveChapterOutline({ chapterOutlineId: outline.id })}
            >
              批准章纲
            </Button>
            <Button
              aria-label={`应用为空章节 ${outline.title}`}
              onClick={() => onApplyChapterOutline({ chapterOutlineId: outline.id })}
            >
              应用为空章节
            </Button>
            <Button
              aria-label={`基于章纲生成草稿 ${outline.title}`}
              onClick={() => onGenerateDraftFromOutline({ chapterOutlineId: outline.id })}
            >
              基于章纲生成草稿
            </Button>
          </Space>
        </li>
      ))}
    </ul>
  );
}

function CandidateList({
  items,
  onToggle,
  selectedKeys,
}: {
  readonly items: readonly ElementCandidateItem[];
  readonly selectedKeys: readonly string[];
  onToggle(key: string, checked: boolean): void;
}) {
  if (items.length === 0) {
    return <Empty description="暂无 AI 候选" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <ul className="creative-list creative-list--candidate">
      {items.map((item, index) => {
        const key = candidateKey(item, index);
        return (
          <li className="creative-list__item" key={key}>
            <Checkbox
              aria-label={`选择候选 ${item.name}`}
              checked={selectedKeys.includes(key)}
              onChange={(event) => onToggle(key, event.target.checked)}
            />
            <div className="creative-list__content">
              <Text strong>{item.name}</Text>
              {item.description ? <Text type="secondary">{item.description}</Text> : null}
              {item.rationale ? <Text type="secondary">{item.rationale}</Text> : null}
              <Space size={6} wrap>
                <Tag>{item.type}</Tag>
                {(item.tags ?? []).map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </Space>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

interface CompactListItem {
  readonly description?: string | undefined;
  readonly id: string;
  readonly label: string;
  readonly tags: readonly string[];
}

function CompactList({
  emptyText,
  items,
}: {
  readonly emptyText: string;
  readonly items: readonly CompactListItem[];
}) {
  if (items.length === 0) {
    return <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <ul className="creative-list">
      {items.map((item) => (
        <li className="creative-list__item" key={item.id}>
          <div className="creative-list__content">
            <Text strong>{item.label}</Text>
            {item.description ? <Text type="secondary">{item.description}</Text> : null}
            <Space size={6} wrap>
              {item.tags.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </Space>
          </div>
        </li>
      ))}
    </ul>
  );
}

function CharacterRoster({
  characters,
  onSelectCharacter,
  selectedCharacterId,
}: {
  readonly characters: readonly CharacterElement[];
  readonly selectedCharacterId: string | null;
  onSelectCharacter(characterId: string): void;
}) {
  if (characters.length === 0) {
    return <Empty description="暂无人物" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <ul className="character-roster">
      {characters.map((character) => {
        const completionScore = getCharacterCompletionScore(character);
        const narrativeFunctionLabel = getCharacterNarrativeFunctionLabel(
          character.narrativeFunction,
        );
        const importanceLabel = getCharacterImportanceLabel(character.importance);
        const description = pickFirstText(
          character.storyTask,
          character.motivation,
          getCharacterTraitValue(character, "goal"),
          character.profile,
        );
        const tags = [
          getCharacterRoleLabel(character.role),
          narrativeFunctionLabel,
          importanceLabel,
        ].filter((tag): tag is string => Boolean(tag));

        return (
          <li key={character.id}>
            <button
              aria-label={`编辑角色 ${character.name}`}
              className={[
                "character-roster__item",
                selectedCharacterId === character.id ? "character-roster__item--selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              type="button"
              onClick={() => onSelectCharacter(character.id)}
            >
              <span className="character-roster__summary">
                <span className="character-roster__title-row">
                  <Text strong>{character.name}</Text>
                  <Text type="secondary">{completionScore}%</Text>
                </span>
                {description ? <Text type="secondary">{description}</Text> : null}
                <Space size={6} wrap>
                  {tags.map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </Space>
              </span>
              <span
                aria-label={`${character.name} 完成度 ${completionScore}%`}
                className="character-roster__progress"
              >
                <span style={{ width: `${completionScore}%` }} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function characterFieldLabel(title: string, help: string): ReactNode {
  return (
    <span className="field-label-with-help">
      <span>{title}</span>
      <Tooltip
        title={
          <span className="field-help-tooltip">
            <strong>{title}</strong>
            <span>{help}</span>
          </span>
        }
      >
        <span aria-hidden="true" className="field-label-help-trigger">
          <QuestionCircleOutlined />
        </span>
      </Tooltip>
    </span>
  );
}

function normalizeCharacterValues(values: CreateCharacterValues): CreateCharacterValues {
  const appearance = trimOptionalText(values.appearance);
  const arcEnd = trimOptionalText(values.arcEnd);
  const arcStart = trimOptionalText(values.arcStart);
  const arcTurn = trimOptionalText(values.arcTurn);
  const archetype = trimOptionalText(values.archetype);
  const biography = trimOptionalText(values.biography);
  const firstAppearance = trimOptionalText(values.firstAppearance);
  const flaw = trimOptionalText(values.flaw);
  const genderAge = trimOptionalText(values.genderAge);
  const goal = trimOptionalText(values.goal);
  const name = values.name.trim();
  const need = trimOptionalText(values.need);
  const relationshipHook = trimOptionalText(values.relationshipHook);
  const secret = trimOptionalText(values.secret);
  const storyTask = trimOptionalText(values.storyTask);
  const voiceProfile = trimOptionalText(values.voiceProfile);

  return {
    name,
    role: values.role ?? CHARACTER_FORM_DEFAULTS.role,
    importance: values.importance ?? CHARACTER_FORM_DEFAULTS.importance,
    narrativeFunction: values.narrativeFunction ?? CHARACTER_FORM_DEFAULTS.narrativeFunction,
    ...(appearance === undefined ? {} : { appearance }),
    ...(arcEnd === undefined ? {} : { arcEnd }),
    ...(arcStart === undefined ? {} : { arcStart }),
    ...(arcTurn === undefined ? {} : { arcTurn }),
    ...(archetype === undefined ? {} : { archetype }),
    ...(biography === undefined ? {} : { biography }),
    ...(firstAppearance === undefined ? {} : { firstAppearance }),
    ...(flaw === undefined ? {} : { flaw }),
    ...(genderAge === undefined ? {} : { genderAge }),
    ...(goal === undefined ? {} : { goal }),
    ...(need === undefined ? {} : { need }),
    ...(relationshipHook === undefined ? {} : { relationshipHook }),
    ...(secret === undefined ? {} : { secret }),
    ...(storyTask === undefined ? {} : { storyTask }),
    ...(voiceProfile === undefined ? {} : { voiceProfile }),
  };
}

function normalizeCharacterPatchValues(
  values: CreateCharacterValues,
): Partial<CreateCharacterValues> {
  const appearance = trimPatchText(values.appearance);
  const arcEnd = trimPatchText(values.arcEnd);
  const arcStart = trimPatchText(values.arcStart);
  const arcTurn = trimPatchText(values.arcTurn);
  const archetype = trimPatchText(values.archetype);
  const biography = trimPatchText(values.biography);
  const firstAppearance = trimPatchText(values.firstAppearance);
  const flaw = trimPatchText(values.flaw);
  const genderAge = trimPatchText(values.genderAge);
  const goal = trimPatchText(values.goal);
  const name = values.name.trim();
  const need = trimPatchText(values.need);
  const relationshipHook = trimPatchText(values.relationshipHook);
  const secret = trimPatchText(values.secret);
  const storyTask = trimPatchText(values.storyTask);
  const voiceProfile = trimPatchText(values.voiceProfile);

  return {
    ...(name ? { name } : {}),
    role: values.role ?? CHARACTER_FORM_DEFAULTS.role,
    importance: values.importance ?? CHARACTER_FORM_DEFAULTS.importance,
    narrativeFunction: values.narrativeFunction ?? CHARACTER_FORM_DEFAULTS.narrativeFunction,
    ...(appearance === undefined ? {} : { appearance }),
    ...(arcEnd === undefined ? {} : { arcEnd }),
    ...(arcStart === undefined ? {} : { arcStart }),
    ...(arcTurn === undefined ? {} : { arcTurn }),
    ...(archetype === undefined ? {} : { archetype }),
    ...(biography === undefined ? {} : { biography }),
    ...(firstAppearance === undefined ? {} : { firstAppearance }),
    ...(flaw === undefined ? {} : { flaw }),
    ...(genderAge === undefined ? {} : { genderAge }),
    ...(goal === undefined ? {} : { goal }),
    ...(need === undefined ? {} : { need }),
    ...(relationshipHook === undefined ? {} : { relationshipHook }),
    ...(secret === undefined ? {} : { secret }),
    ...(storyTask === undefined ? {} : { storyTask }),
    ...(voiceProfile === undefined ? {} : { voiceProfile }),
  };
}

function characterToFormValues(character: CharacterElement): CreateCharacterValues {
  return {
    appearance: character.appearance ?? "",
    arcEnd: character.arcEnd ?? "",
    arcStart: character.arcStart ?? "",
    arcTurn: character.arcTurn ?? "",
    archetype: character.archetype ?? "",
    biography: character.profile ?? "",
    firstAppearance: character.firstAppearance ?? "",
    flaw: getCharacterTraitValue(character, "flaw") ?? "",
    genderAge: character.genderAge ?? "",
    goal: character.motivation ?? getCharacterTraitValue(character, "goal") ?? "",
    importance: normalizeCharacterImportance(character.importance),
    name: character.name,
    narrativeFunction: normalizeCharacterNarrativeFunction(character.narrativeFunction),
    need: getCharacterTraitValue(character, "need") ?? "",
    relationshipHook: character.relationshipHook ?? "",
    role: normalizeCharacterRole(character.role),
    secret: getCharacterTraitValue(character, "secret") ?? "",
    storyTask: character.storyTask ?? "",
    voiceProfile: getCharacterTraitValue(character, "voice_profile") ?? "",
  };
}

function trimOptionalText(value: string | undefined): string | undefined {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : undefined;
}

function trimPatchText(value: string | undefined): string | undefined {
  return value === undefined ? undefined : value.trim();
}

function getCharacterCompletionScore(character: CharacterElement): number {
  const requiredSignals = [
    character.name,
    character.role,
    character.importance,
    character.narrativeFunction,
    character.storyTask,
    character.motivation ?? getCharacterTraitValue(character, "goal"),
    getCharacterTraitValue(character, "need"),
    getCharacterTraitValue(character, "flaw"),
    character.relationshipHook,
    character.arcStart,
    character.arcTurn,
    character.arcEnd,
    getCharacterTraitValue(character, "voice_profile"),
    character.appearance,
    character.profile,
  ];
  const filledSignals = requiredSignals.filter(isFilledText).length;

  return Math.round((filledSignals / requiredSignals.length) * 100);
}

function getCharacterTraitValue(
  character: CharacterElement,
  traitName: string,
): string | null | undefined {
  return character.traits?.find((trait) => trait.name === traitName)?.value;
}

function getCharacterRoleLabel(role: string): string {
  if (Object.prototype.hasOwnProperty.call(CHARACTER_ROLE_LABELS, role)) {
    return CHARACTER_ROLE_LABELS[role as CreateCharacterValues["role"]];
  }

  return role;
}

function normalizeCharacterRole(role: string): CreateCharacterValues["role"] {
  if (Object.prototype.hasOwnProperty.call(CHARACTER_ROLE_LABELS, role)) {
    return role as CreateCharacterValues["role"];
  }

  return CHARACTER_FORM_DEFAULTS.role;
}

function getCharacterImportanceLabel(
  importance: CharacterElement["importance"],
): string | undefined {
  if (!importance) {
    return undefined;
  }

  if (Object.prototype.hasOwnProperty.call(CHARACTER_IMPORTANCE_LABELS, importance)) {
    return CHARACTER_IMPORTANCE_LABELS[importance];
  }

  return importance;
}

function normalizeCharacterImportance(
  importance: CharacterElement["importance"],
): CharacterImportanceValue {
  if (importance && Object.prototype.hasOwnProperty.call(CHARACTER_IMPORTANCE_LABELS, importance)) {
    return importance;
  }

  return CHARACTER_FORM_DEFAULTS.importance;
}

function getCharacterNarrativeFunctionLabel(
  narrativeFunction: CharacterElement["narrativeFunction"],
): string | undefined {
  if (!narrativeFunction) {
    return undefined;
  }

  if (
    Object.prototype.hasOwnProperty.call(CHARACTER_NARRATIVE_FUNCTION_LABELS, narrativeFunction)
  ) {
    return CHARACTER_NARRATIVE_FUNCTION_LABELS[narrativeFunction];
  }

  return narrativeFunction;
}

function normalizeCharacterNarrativeFunction(
  narrativeFunction: CharacterElement["narrativeFunction"],
): CharacterNarrativeFunctionValue {
  if (
    narrativeFunction &&
    Object.prototype.hasOwnProperty.call(CHARACTER_NARRATIVE_FUNCTION_LABELS, narrativeFunction)
  ) {
    return narrativeFunction;
  }

  return CHARACTER_FORM_DEFAULTS.narrativeFunction;
}

function pickFirstText(...values: ReadonlyArray<string | null | undefined>): string | undefined {
  return values.find(isFilledText);
}

function isFilledText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeBriefValues(values: SaveBriefValues): SaveBriefValues {
  const initialIdea = values.initialIdea?.trim();
  const estimatedChapterCount = normalizeOptionalInteger(values.estimatedChapterCount);
  const estimatedWordCount = normalizeOptionalInteger(values.estimatedWordCount);

  return {
    emotionalRewards: values.emotionalRewards ?? [],
    ...(estimatedChapterCount === undefined ? {} : { estimatedChapterCount }),
    ...(estimatedWordCount === undefined ? {} : { estimatedWordCount }),
    forbiddenDirections: values.forbiddenDirections ?? [],
    genre: values.genre,
    subgenres: values.subgenres ?? [],
    ...(values.lengthProfile === undefined ? {} : { lengthProfile: values.lengthProfile }),
    ...(values.narrativePov === undefined ? {} : { narrativePov: values.narrativePov }),
    ...(values.platformProfile === undefined ? {} : { platformProfile: values.platformProfile }),
    ...(values.targetAudience === undefined ? {} : { targetAudience: values.targetAudience }),
    ...(initialIdea ? { initialIdea } : {}),
  };
}

function normalizeOptionalInteger(value: number | null | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.trunc(value);
}

function normalizeWorldbuildingFormFields(
  values: Partial<WorldbuildingFields>,
): WorldbuildingFields {
  return {
    coreConflict: values.coreConflict?.trim() ?? "",
    culture: values.culture?.trim() ?? "",
    economy: values.economy?.trim() ?? "",
    factions: values.factions?.trim() ?? "",
    geography: values.geography?.trim() ?? "",
    history: values.history?.trim() ?? "",
    powerOrder: values.powerOrder?.trim() ?? "",
    powerSystem: values.powerSystem?.trim() ?? "",
    rules: values.rules?.trim() ?? "",
    socialStructure: values.socialStructure?.trim() ?? "",
    specialMechanism: values.specialMechanism?.trim() ?? "",
    worldBase: values.worldBase?.trim() ?? "",
  };
}

function countFilledWorldbuildingFields(fields: WorldbuildingFields | null | undefined): number {
  if (!fields) {
    return 0;
  }

  return WORLD_DIMENSIONS.filter((dimension) => fields[dimension.key].trim().length > 0).length;
}

function coreStoryFormValuesFromBlueprint(
  blueprint: CreativePathBoard["blueprint"],
): CoreStoryFormValues {
  if (!blueprint) {
    return EMPTY_CORE_STORY_FORM_VALUES;
  }

  return {
    antagonistForce: blueprint.antagonistForce ?? "",
    corePromise: blueprint.corePromise,
    differentiatorsText: blueprint.differentiators.join("\n"),
    emotionalAxes: [...(blueprint.emotionalAxes ?? [])],
    logline: blueprint.logline,
    mainConflict: blueprint.mainConflict,
    mainGoal: blueprint.mainGoal ?? "",
    premise: blueprint.premise,
    protagonistArc: blueprint.protagonistArc ?? "",
    risksText: blueprint.risks.join("\n"),
    stakes: blueprint.stakes ?? "",
    storyDriver: normalizeCoreStoryDriver(blueprint.storyDriver),
  };
}

function coreStoryFormValuesFromFields(fields: CoreStoryFields): CoreStoryFormValues {
  return {
    antagonistForce: fields.antagonistForce,
    corePromise: fields.corePromise,
    differentiatorsText: fields.differentiators.join("\n"),
    emotionalAxes: [...fields.emotionalAxes],
    logline: fields.logline,
    mainConflict: fields.mainConflict,
    mainGoal: fields.mainGoal,
    premise: fields.premise,
    protagonistArc: fields.protagonistArc,
    risksText: fields.risks.join("\n"),
    stakes: fields.stakes,
    storyDriver: fields.storyDriver,
  };
}

function coreStoryFieldsFromFormValues(values: Partial<CoreStoryFormValues>): CoreStoryFields {
  return {
    antagonistForce: values.antagonistForce?.trim() ?? "",
    corePromise: values.corePromise?.trim() ?? "",
    differentiators: splitCoreStoryList(values.differentiatorsText),
    emotionalAxes: (values.emotionalAxes ?? [])
      .map((axis) => axis.trim())
      .filter((axis) => axis.length > 0),
    logline: values.logline?.trim() ?? "",
    mainConflict: values.mainConflict?.trim() ?? "",
    mainGoal: values.mainGoal?.trim() ?? "",
    premise: values.premise?.trim() ?? "",
    protagonistArc: values.protagonistArc?.trim() ?? "",
    risks: splitCoreStoryList(values.risksText),
    stakes: values.stakes?.trim() ?? "",
    storyDriver: normalizeCoreStoryDriver(values.storyDriver),
  };
}

function splitCoreStoryList(value: string | undefined): string[] {
  return (value ?? "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function normalizeCoreStoryDriver(value: string | undefined): CoreStoryFields["storyDriver"] {
  return CORE_STORY_DRIVER_VALUES.includes(value as CoreStoryFields["storyDriver"])
    ? (value as CoreStoryFields["storyDriver"])
    : "growth_reversal";
}

function getMissingCoreStoryFieldNames(fields: CoreStoryFields): Array<keyof CoreStoryFormValues> {
  const missing: Array<keyof CoreStoryFormValues> = [];

  for (const name of [
    "premise",
    "logline",
    "corePromise",
    "mainGoal",
    "mainConflict",
    "protagonistArc",
    "antagonistForce",
    "stakes",
  ] as const) {
    if (fields[name].trim().length === 0) {
      missing.push(name);
    }
  }

  if (fields.emotionalAxes.length === 0) {
    missing.push("emotionalAxes");
  }
  if (fields.differentiators.length === 0) {
    missing.push("differentiatorsText");
  }
  if (fields.risks.length === 0) {
    missing.push("risksText");
  }

  return missing;
}

function candidateKey(item: ElementCandidateItem, index: number): string {
  return `${index}:${item.type}:${item.name}`;
}

function normalizeCandidateResult(
  result: GenerateElementCandidatesResult | readonly ElementCandidateItem[] | void,
): readonly ElementCandidateItem[] {
  if (!result) {
    return [];
  }
  if (hasCandidateItems(result)) {
    return result.items;
  }

  return result;
}

function hasCandidateItems(value: unknown): value is GenerateElementCandidatesResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "items" in value &&
    Array.isArray((value as { readonly items?: unknown }).items)
  );
}

function getStageForModule(
  creativePath: CreativePathBoard,
  moduleKey: WorkspaceModuleKey,
): CreativePathBoard["stages"][number] | undefined {
  const stageKey = MODULE_STAGE_MAP[moduleKey];
  return stageKey ? creativePath.stages.find((stage) => stage.stageKey === stageKey) : undefined;
}

function getStatusColor(status: string | undefined): string {
  switch (status) {
    case "completed":
      return "success";
    case "available":
      return "processing";
    case "locked":
      return "default";
    case "skipped":
      return "warning";
    default:
      return "default";
  }
}

function getNextChapterPlanIndex(chapterPlans: readonly ChapterPlanItem[]): number {
  const lastChapterIndex = chapterPlans.reduce(
    (maxChapterIndex, chapterPlan) => Math.max(maxChapterIndex, chapterPlan.chapterIndex),
    0,
  );
  return lastChapterIndex + 1;
}

function formatChapterPlanTitle(plan: ChapterPlanItem): string {
  const title = plan.title.trim();

  if (/^第\s*\d+\s*章/.test(title)) {
    return title;
  }

  return `第 ${plan.chapterIndex} 章：${title}`;
}

function createFallbackCreativePath(defaultGenre: string): CreativePathBoard {
  return {
    blueprint: null,
    brief: {
      emotionalRewards: ["爽点"],
      estimatedChapterCount: 260,
      estimatedWordCount: 800_000,
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
    arcPlans: [],
    bookPlans: [],
    chapterPlans: [],
    outlines: [],
    reviewIssues: [],
    scenePlans: [],
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
    volumePlans: [],
  };
}
