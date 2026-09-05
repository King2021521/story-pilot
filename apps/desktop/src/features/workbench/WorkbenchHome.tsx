import {
  BranchesOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  DeploymentUnitOutlined,
  EditOutlined,
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
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";

import type { ArtifactReviewItem } from "../ai/ArtifactReviewPanel";
import {
  ChapterEditorPage,
  type CreateChapterRequest,
  type ExtractStoryStateDeltaRequest,
  type GenerateChapterDraftRequest,
  type LoadChapterVersionsRequest,
  type ReviewChapterDraftRequest,
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
  type CreatePlotlineNodeValues,
  type CreatePlotlineValues,
  type CreateWorldRuleValues,
  type ElementCandidateItem,
  type ForeshadowingElement,
  type GenerateElementCandidatesResult,
  type GenerateElementCandidatesValues,
  type PlotlineNodeElement,
  type PlotlineElement,
  type UpdatePlotlineNodeValues,
  type UpdatePlotlineValues,
  type WorldElement,
  type WorldRuleElement,
} from "../creative/CreativeElementsPanel";
import type {
  ArcPlanItem,
  BookPlanItem,
  ChapterPlanItem,
  CompletableCreativeStageKey,
  CreativePathBoard,
  CreativeStageKey,
  SaveBriefValues,
  VolumePlanItem,
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

const PLOTLINE_KIND_OPTIONS: ReadonlyArray<{
  readonly label: string;
  readonly value: CreatePlotlineValues["kind"];
}> = [
  { label: "支线", value: "branch" },
  { label: "主线", value: "main" },
  { label: "悬疑线", value: "mystery" },
  { label: "成长线", value: "growth" },
  { label: "感情线", value: "romance" },
  { label: "反派线", value: "antagonist" },
  { label: "世界线", value: "world" },
];

const PLOTLINE_NARRATIVE_ROLE_OPTIONS: ReadonlyArray<{
  readonly label: string;
  readonly value: CreatePlotlineValues["narrativeRole"];
}> = [
  { label: "主线驱动", value: "main_drive" },
  { label: "制造阻力", value: "obstacle" },
  { label: "揭示秘密", value: "secret_reveal" },
  { label: "关系拉扯", value: "relationship_tension" },
  { label: "情绪奖励", value: "emotional_reward" },
  { label: "世界观展开", value: "worldbuilding" },
  { label: "对照映衬", value: "contrast" },
  { label: "自定义", value: "custom" },
];

const PLOTLINE_IMPORTANCE_OPTIONS: ReadonlyArray<{
  readonly label: string;
  readonly value: CreatePlotlineValues["importance"];
}> = [
  { label: "核心线", value: "core" },
  { label: "重要线", value: "major" },
  { label: "辅助线", value: "minor" },
  { label: "背景线", value: "background" },
];

const PLOTLINE_STATUS_OPTIONS: ReadonlyArray<{
  readonly label: string;
  readonly value: CreatePlotlineValues["status"];
}> = [
  { label: "构思中", value: "idea" },
  { label: "规划中", value: "planning" },
  { label: "推进中", value: "active" },
  { label: "已回收", value: "resolved" },
  { label: "归档", value: "archived" },
];

const PLOTLINE_NODE_KIND_OPTIONS: ReadonlyArray<{
  readonly label: string;
  readonly value: CreatePlotlineNodeValues["kind"];
}> = [
  { label: "铺垫", value: "seed" },
  { label: "推进", value: "advance" },
  { label: "误导", value: "mislead" },
  { label: "转折", value: "turn" },
  { label: "揭示", value: "reveal" },
  { label: "高潮", value: "climax" },
  { label: "回收", value: "payoff" },
];

const PLOTLINE_NODE_STATUS_OPTIONS: ReadonlyArray<{
  readonly label: string;
  readonly value: CreatePlotlineNodeValues["status"];
}> = [
  { label: "已规划", value: "planned" },
  { label: "已写入", value: "drafted" },
  { label: "已使用", value: "used" },
  { label: "已回收", value: "resolved" },
  { label: "裁剪", value: "cut" },
];

const PLOTLINE_KIND_LABELS = Object.fromEntries(
  PLOTLINE_KIND_OPTIONS.map((option) => [option.value, option.label]),
) as Record<CreatePlotlineValues["kind"], string>;

const PLOTLINE_NARRATIVE_ROLE_LABELS = Object.fromEntries(
  PLOTLINE_NARRATIVE_ROLE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<CreatePlotlineValues["narrativeRole"], string>;

const PLOTLINE_IMPORTANCE_LABELS = Object.fromEntries(
  PLOTLINE_IMPORTANCE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<CreatePlotlineValues["importance"], string>;

const PLOTLINE_STATUS_LABELS = Object.fromEntries(
  PLOTLINE_STATUS_OPTIONS.map((option) => [option.value, option.label]),
) as Record<CreatePlotlineValues["status"], string>;

const PLOTLINE_NODE_KIND_LABELS = Object.fromEntries(
  PLOTLINE_NODE_KIND_OPTIONS.map((option) => [option.value, option.label]),
) as Record<CreatePlotlineNodeValues["kind"], string>;

const PLOTLINE_NODE_STATUS_LABELS = Object.fromEntries(
  PLOTLINE_NODE_STATUS_OPTIONS.map((option) => [option.value, option.label]),
) as Record<CreatePlotlineNodeValues["status"], string>;

const PLOTLINE_FORM_DEFAULTS = {
  importance: "major",
  kind: "branch",
  narrativeRole: "main_drive",
  priority: 0,
  relatedCharacterIds: [],
  relatedForeshadowingIds: [],
  relatedStoryEventIds: [],
  relatedWorldRuleIds: [],
  status: "planning",
} satisfies Pick<
  CreatePlotlineValues,
  | "importance"
  | "kind"
  | "narrativeRole"
  | "priority"
  | "relatedCharacterIds"
  | "relatedForeshadowingIds"
  | "relatedStoryEventIds"
  | "relatedWorldRuleIds"
  | "status"
>;

const PLOTLINE_NODE_FORM_DEFAULTS = {
  kind: "seed",
  status: "planned",
} satisfies Pick<CreatePlotlineNodeValues, "kind" | "status">;

const OUTLINE_PLAN_STATUS_OPTIONS: Array<{
  readonly label: string;
  readonly value: SaveBookPlanDraftValues["status"];
}> = [
  { label: "草稿", value: "draft" },
  { label: "进行中", value: "active" },
  { label: "已确认", value: "approved" },
  { label: "归档", value: "archived" },
];

const OUTLINE_PLAN_STATUS_LABELS = Object.fromEntries(
  OUTLINE_PLAN_STATUS_OPTIONS.map((option) => [option.value, option.label]),
) as Record<SaveBookPlanDraftValues["status"], string>;

const BOOK_PLAN_FIELD_HELP = {
  corePromise: {
    description: "写给读者的长期回报：爽点、悬念、情感奖励、升级节奏或关系反转。",
    question: "这本书每一大段要持续兑现什么？",
  },
  endingDirection: {
    description: "不用写死结局细节，明确终局代价、终局胜利方式和主角最后状态即可。",
    question: "故事最终要把读者带到哪里？",
  },
  mainPlotlineId: {
    description: "选择驱动全书结构的主故事线，卷规划和阶段弧线会围绕它拆解。",
    question: "哪条故事线是全书发动机？",
  },
  targetWordCount: {
    description: "用于估算卷数、阶段密度和每卷体量，后续章节规划会继承这个约束。",
    question: "全书大概要写多长？",
  },
} as const;

const VOLUME_PLAN_FIELD_HELP = {
  climax: {
    description: "写清卷末最强场面或决定性反转，用来校准中段铺垫。",
    question: "这一卷用什么高潮收束？",
  },
  majorConflict: {
    description: "这一卷的主要对抗关系，最好能写成双方目标不可兼得的冲突。",
    question: "这一卷最大的对抗是什么？",
  },
  purpose: {
    description: "这一卷承担的叙事任务，例如开局入局、地图扩张、反派压迫或关系破裂。",
    question: "这一卷在全书中负责什么？",
  },
  targetWordCount: {
    description: "控制分卷体量，避免某一卷承载过多剧情或中段过长。",
    question: "这一卷计划写多少字？",
  },
} as const;

const ARC_PLAN_FIELD_HELP = {
  chapterRange: {
    description: "用起止章节限定阶段边界，后续滚动章纲会按这个区间分配节奏。",
    question: "这条弧线覆盖哪些章节？",
  },
  escalation: {
    description: "每行一个升级节点，从诱因、误导、受挫、反击到阶段回收。",
    question: "冲突如何一层层升级？",
  },
  plotlineId: {
    description: "关联到前面设计的故事线，保证阶段弧线不是孤立事件。",
    question: "这条阶段弧线服务哪条故事线？",
  },
  purpose: {
    description: "写清阶段完成的转向，例如从被动到主动、从怀疑到确认、从结盟到决裂。",
    question: "这一阶段要改变什么？",
  },
} as const;

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

type StoryEventTypeValue = CommandPayload<"storyEvent.create">["eventType"];
type StoryEventStatusValue = CommandPayload<"storyEvent.create">["status"];
type ForeshadowingStatusValue = CommandPayload<"foreshadowing.create">["status"];
type PlotDebtValues = CommandPayload<"plotDebt.save">["values"];
type PlotDebtStatusValue = PlotDebtValues["status"];
type PlotDebtRiskLevelValue = PlotDebtValues["riskLevel"];
type PlotDebtTypeValue = PlotDebtValues["debtType"];

const STORY_EVENT_STATUS_OPTIONS: ReadonlyArray<{
  readonly label: string;
  readonly value: StoryEventStatusValue;
}> = [
  { label: "草稿", value: "draft" },
  { label: "已规划", value: "planned" },
  { label: "正史", value: "canon" },
  { label: "归档", value: "archived" },
];

const FORESHADOWING_STATUS_OPTIONS: ReadonlyArray<{
  readonly label: string;
  readonly value: ForeshadowingStatusValue;
}> = [
  { label: "已埋设", value: "seeded" },
  { label: "待回收", value: "payoff_ready" },
  { label: "已回收", value: "paid_off" },
  { label: "归档", value: "archived" },
];

const PLOT_DEBT_TYPE_OPTIONS: ReadonlyArray<{
  readonly label: string;
  readonly value: PlotDebtTypeValue;
}> = [
  { label: "伏笔", value: "foreshadowing" },
  { label: "谜题", value: "mystery" },
  { label: "读者承诺", value: "reader_promise" },
  { label: "关系债", value: "relationship" },
  { label: "世界规则", value: "world_rule" },
  { label: "冲突债", value: "conflict" },
  { label: "奖励兑现", value: "reward" },
];

const PLOT_DEBT_STATUS_OPTIONS: ReadonlyArray<{
  readonly label: string;
  readonly value: PlotDebtStatusValue;
}> = [
  { label: "打开", value: "open" },
  { label: "已强化", value: "reinforced" },
  { label: "待回收", value: "payoff_ready" },
  { label: "已回收", value: "paid_off" },
  { label: "已放弃", value: "dropped" },
];

const PLOT_DEBT_RISK_LEVEL_OPTIONS: ReadonlyArray<{
  readonly label: string;
  readonly value: PlotDebtRiskLevelValue;
}> = [
  { label: "低", value: "low" },
  { label: "中", value: "medium" },
  { label: "高", value: "high" },
  { label: "严重", value: "critical" },
];

const EVENT_TYPE_LABELS = Object.fromEntries(
  EVENT_TYPE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<StoryEventTypeValue, string>;

const STORY_EVENT_STATUS_LABELS = Object.fromEntries(
  STORY_EVENT_STATUS_OPTIONS.map((option) => [option.value, option.label]),
) as Record<StoryEventStatusValue, string>;

const FORESHADOWING_STATUS_LABELS = Object.fromEntries(
  FORESHADOWING_STATUS_OPTIONS.map((option) => [option.value, option.label]),
) as Record<ForeshadowingStatusValue, string>;

const PLOT_DEBT_TYPE_LABELS = Object.fromEntries(
  PLOT_DEBT_TYPE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<PlotDebtTypeValue, string>;

const PLOT_DEBT_STATUS_LABELS = Object.fromEntries(
  PLOT_DEBT_STATUS_OPTIONS.map((option) => [option.value, option.label]),
) as Record<PlotDebtStatusValue, string>;

const PLOT_DEBT_RISK_LEVEL_LABELS = Object.fromEntries(
  PLOT_DEBT_RISK_LEVEL_OPTIONS.map((option) => [option.value, option.label]),
) as Record<PlotDebtRiskLevelValue, string>;

const STORY_EVENT_FORM_DEFAULTS = {
  eventType: "discovery",
  participants: [],
  status: "draft",
} satisfies Pick<StoryEventFormValues, "eventType" | "participants" | "status">;

const FORESHADOWING_FORM_DEFAULTS = {
  importance: 3,
  status: "seeded",
} satisfies Pick<ForeshadowingFormValues, "importance" | "status">;

const PLOT_DEBT_FORM_DEFAULTS = {
  debtType: "reader_promise",
  lifecycleNotes: [],
  promise: "",
  relatedCharacterIds: [],
  relatedWorldRuleIds: [],
  riskLevel: "medium",
  status: "open",
  title: "",
} satisfies PlotDebtFormValues;

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
  readonly chapterId?: string | null;
  readonly eventType: string;
  readonly id: string;
  readonly participants?: readonly StoryEventParticipantElement[];
  readonly outcome?: string | null;
  readonly sceneId?: string | null;
  readonly status: string;
  readonly storyTime?: string | null;
  readonly summary: string;
  readonly title: string;
}

export interface StoryEventParticipantElement {
  readonly entityId: string;
  readonly entityType: string;
  readonly id?: string;
  readonly role: string;
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
  readonly status?: StoryEventStatusValue;
  readonly chapterId?: string;
  readonly participants?: readonly CreateStoryEventParticipantValues[];
  readonly title: string;
}

export interface CreateStoryEventParticipantValues {
  readonly entityType: string;
  readonly entityId: string;
  readonly role: string;
}

export type UpdateStoryEventValues = Omit<CommandPayload<"storyEvent.update">, "projectId">;
export type UpdateForeshadowingValues = Omit<CommandPayload<"foreshadowing.update">, "projectId">;
export type PlanForeshadowingValues = Omit<CommandPayload<"foreshadowing.plan">, "projectId">;
export type SavePlotDebtValues = Omit<CommandPayload<"plotDebt.save">, "projectId">;

interface StoryEventFormValues {
  readonly title: string;
  readonly description: string;
  readonly eventType: StoryEventTypeValue;
  readonly status: StoryEventStatusValue;
  readonly chapterId: string | undefined;
  readonly storyTime: string;
  readonly participants: readonly string[];
}

interface ForeshadowingFormValues {
  readonly title: string;
  readonly description: string;
  readonly payoffExpectation: string;
  readonly importance: number;
  readonly seedEventId: string | undefined;
  readonly payoffEventId: string | undefined;
  readonly status: ForeshadowingStatusValue;
}

interface PlotDebtFormValues {
  readonly actualPayoffChapterIndex?: number | null;
  readonly debtType: PlotDebtTypeValue;
  readonly expectedPayoffChapterIndex?: number | null;
  readonly lifecycleNotes: readonly string[];
  readonly promise: string;
  readonly relatedCharacterIds: readonly string[];
  readonly relatedForeshadowingId?: string | null;
  readonly relatedPlotlineId?: string | null;
  readonly relatedWorldRuleIds: readonly string[];
  readonly riskLevel: PlotDebtRiskLevelValue;
  readonly seedChapterIndex?: number | null;
  readonly status: PlotDebtStatusValue;
  readonly title: string;
}

export interface UpdateCharacterValues {
  readonly characterId: string;
  readonly patch: Partial<CreateCharacterValues>;
}

export type DeleteCharacterValues = Omit<CommandPayload<"character.delete">, "projectId">;
export type DeletePlotlineValues = Omit<CommandPayload<"plotline.delete">, "projectId">;

export type WorldbuildingFields = CommandPayload<"worldbuilding.saveFields">["fields"];
export type CoreStoryFields = CommandPayload<"blueprint.saveForm">["fields"];
export type SaveBookPlanDraftValues = Omit<CommandPayload<"plot.saveBookPlanDraft">, "projectId">;
export type SaveVolumePlanValues = Omit<CommandPayload<"plot.saveVolumePlan">, "projectId">;
export type SaveArcPlanValues = Omit<CommandPayload<"plot.saveArcPlan">, "projectId">;
export type DeleteBookPlanValues = Omit<CommandPayload<"plot.deleteBookPlan">, "projectId">;
export type DeleteVolumePlanValues = Omit<CommandPayload<"plot.deleteVolumePlan">, "projectId">;
export type DeleteArcPlanValues = Omit<CommandPayload<"plot.deleteArcPlan">, "projectId">;

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

export interface PlotDebtItem extends PlotDebtValues {
  readonly createdAt?: number;
  readonly id: string;
  readonly projectId?: string;
  readonly updatedAt?: number;
}

export interface StoryStateSnapshotItem {
  readonly activeConflicts: readonly string[];
  readonly chapterId: string | null;
  readonly chapterIndex: number;
  readonly createdAt: number;
  readonly currentArcPlanId: string | null;
  readonly currentVolumeId: string | null;
  readonly globalSituation: string;
  readonly hiddenInformation: readonly string[];
  readonly id: string;
  readonly locationState: Record<string, unknown>;
  readonly openQuestions: readonly string[];
  readonly organizationState: Record<string, unknown>;
  readonly projectId: string;
  readonly resourceState: Record<string, unknown>;
  readonly revealedInformation: readonly string[];
  readonly sourceChapterVersion: number | null;
  readonly storyTime: string | null;
}

export interface CharacterStateSnapshotItem {
  readonly characterId: string;
  readonly chapterId: string | null;
  readonly chapterIndex: number;
  readonly createdAt: number;
  readonly emotionalState: string;
  readonly externalGoal: string;
  readonly id: string;
  readonly internalNeed: string;
  readonly knowledgeState: string;
  readonly physicalState: string;
  readonly position: string;
  readonly projectId: string;
  readonly relationshipState: Record<string, unknown>;
  readonly resourceState: Record<string, unknown>;
  readonly riskFlags: readonly string[];
  readonly secrets: readonly string[];
  readonly sourceId: string;
  readonly sourceType: string;
}

export interface CompleteWorldbuildingFieldsResult {
  readonly fields: WorldbuildingFields;
}

export interface WorkbenchBoard {
  readonly artifacts: readonly ArtifactReviewItem[];
  readonly chapters: readonly WorkbenchChapter[];
  readonly characterStateSnapshots?: readonly CharacterStateSnapshotItem[];
  readonly characters?: readonly CharacterElement[];
  readonly conflicts?: readonly unknown[];
  readonly creativePath?: CreativePathBoard;
  readonly entityRelations?: readonly unknown[];
  readonly eventRelations?: readonly unknown[];
  readonly foreshadowings?: readonly ForeshadowingElement[];
  readonly items?: readonly WorldElement[];
  readonly locations?: readonly WorldElement[];
  readonly memoryCandidates: readonly MemoryCandidateItem[];
  readonly organizations?: readonly WorldElement[];
  readonly plotDebts?: readonly PlotDebtItem[];
  readonly plotlines?: readonly PlotlineElement[];
  readonly project: WorkbenchProject;
  readonly storyEvents?: readonly StoryEventElement[];
  readonly storyStateSnapshots?: readonly StoryStateSnapshotItem[];
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
  onExtractStoryStateDelta(input: ExtractStoryStateDeltaRequest): Promise<void> | void;
  onGenerateDraft(input: GenerateChapterDraftRequest): Promise<void> | void;
  onConfirmMemory(input: MemoryCandidateDecisionInput): Promise<void> | void;
  onRejectMemory(candidateId: string): Promise<void> | void;
  onSaveChapter(input: SaveChapterRequest): Promise<void> | void;
  onSelectChapter(chapterId: string): void;
  onCreateChapter(input: CreateChapterRequest): Promise<void> | void;
  onCreateCharacter(input: CreateCharacterValues): Promise<void> | void;
  onDeleteCharacter(input: DeleteCharacterValues): Promise<void> | void;
  onDeletePlotline(input: DeletePlotlineValues): Promise<void> | void;
  onCreateForeshadowing(input: CreateForeshadowingValues): Promise<void> | void;
  onCreatePlotline(input: CreatePlotlineValues): Promise<void> | void;
  onCreatePlotlineNode(input: CreatePlotlineNodeValues): Promise<void> | void;
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
  onGenerateChapterExecutionCard(input: {
    readonly chapterPlanId: string;
    readonly instruction?: string;
  }): Promise<void> | void;
  onSaveBookPlanDraft(input: SaveBookPlanDraftValues): Promise<void> | void;
  onSaveVolumePlan(input: SaveVolumePlanValues): Promise<void> | void;
  onSaveArcPlan(input: SaveArcPlanValues): Promise<void> | void;
  onDeleteBookPlan(input: DeleteBookPlanValues): Promise<void> | void;
  onDeleteVolumePlan(input: DeleteVolumePlanValues): Promise<void> | void;
  onDeleteArcPlan(input: DeleteArcPlanValues): Promise<void> | void;
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
  onGenerateSerialReview(input: {
    readonly scope: "chapter_batch" | "arc" | "volume";
    readonly startChapterIndex: number;
    readonly endChapterIndex: number;
  }): Promise<void> | void;
  onPlanForeshadowing(input: PlanForeshadowingValues): Promise<void> | void;
  onReopenStage(input: {
    readonly stageKey: CreativeStageKey;
    readonly reason?: string;
  }): Promise<void> | void;
  onSaveBrief(input: SaveBriefValues): Promise<void> | void;
  onSavePlotDebt(input: SavePlotDebtValues): Promise<void> | void;
  onReviewChapterDraft(input: ReviewChapterDraftRequest): Promise<void> | void;
  onUpdateCharacter(input: UpdateCharacterValues): Promise<void> | void;
  onUpdateForeshadowing(input: UpdateForeshadowingValues): Promise<void> | void;
  onUpdatePlotline(input: UpdatePlotlineValues): Promise<void> | void;
  onUpdatePlotlineNode(input: UpdatePlotlineNodeValues): Promise<void> | void;
  onUpdateStoryEvent(input: UpdateStoryEventValues): Promise<void> | void;
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
  onDeleteArcPlan,
  onDeleteBookPlan,
  onDeleteCharacter,
  onDeleteVolumePlan,
  onDeletePlotline,
  onCreateForeshadowing,
  onCreatePlotline,
  onCreatePlotlineNode,
  onCreateStoryEvent,
  onCreateWorldRule,
  onCompleteCoreStoryFields,
  onCompleteWorldbuildingFields,
  onExtractStoryStateDelta,
  onGenerateDraft,
  onGenerateBlueprint,
  onGenerateBookPlan,
  onGenerateChapterExecutionCard,
  onGenerateDraftFromOutline,
  onGenerateDraftFromPlan,
  onGenerateElementCandidates,
  onGenerateOutline,
  onGenerateRollingOutline,
  onGenerateSerialReview,
  onLoadChapterVersions,
  onPlanForeshadowing,
  onRejectMemory,
  onRestoreChapterVersion,
  onSaveChapter,
  onSaveBrief,
  onSaveBookPlanDraft,
  onSavePlotDebt,
  onReviewChapterDraft,
  onSaveVolumePlan,
  onSaveArcPlan,
  onSaveCoreStoryFields,
  onSaveWorldbuildingFields,
  onSelectChapter,
  onUpdateCharacter,
  onUpdateForeshadowing,
  onUpdatePlotline,
  onUpdatePlotlineNode,
  onUpdateStoryEvent,
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
    <main aria-label={moduleTitle} className="workbench-home">
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
        onDeleteArcPlan,
        onDeleteBookPlan,
        onDeleteCharacter,
        onDeleteVolumePlan,
        onDeletePlotline,
        onCreateForeshadowing,
        onCreatePlotline,
        onCreatePlotlineNode,
        onCreateStoryEvent,
        onCreateWorldRule,
        onCompleteCoreStoryFields,
        onCompleteWorldbuildingFields,
        onExtractStoryStateDelta,
        onGenerateBlueprint,
        onGenerateBookPlan,
        onGenerateChapterExecutionCard,
        onGenerateDraft,
        onGenerateDraftFromOutline,
        onGenerateDraftFromPlan,
        onGenerateElementCandidates,
        onGenerateOutline,
        onGenerateRollingOutline,
        onGenerateSerialReview,
        onLoadChapterVersions,
        onPlanForeshadowing,
        onRejectMemory,
        onRestoreChapterVersion,
        onSaveBrief,
        onSaveBookPlanDraft,
        onSavePlotDebt,
        onReviewChapterDraft,
        onSaveVolumePlan,
        onSaveArcPlan,
        onSaveChapter,
        onSaveCoreStoryFields,
        onSaveWorldbuildingFields,
        onSelectChapter,
        onUpdateCharacter,
        onUpdateForeshadowing,
        onUpdatePlotline,
        onUpdatePlotlineNode,
        onUpdateStoryEvent,
        savingChapter,
        selectedChapter,
      })}
    </main>
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
  onDeleteArcPlan(input: DeleteArcPlanValues): Promise<void> | void;
  onDeleteBookPlan(input: DeleteBookPlanValues): Promise<void> | void;
  onDeleteCharacter(input: DeleteCharacterValues): Promise<void> | void;
  onDeleteVolumePlan(input: DeleteVolumePlanValues): Promise<void> | void;
  onDeletePlotline(input: DeletePlotlineValues): Promise<void> | void;
  onCreateForeshadowing(input: CreateForeshadowingValues): Promise<void> | void;
  onCreatePlotline(input: CreatePlotlineValues): Promise<void> | void;
  onCreatePlotlineNode(input: CreatePlotlineNodeValues): Promise<void> | void;
  onCreateStoryEvent(input: CreateStoryEventValues): Promise<void> | void;
  onCreateWorldRule(input: CreateWorldRuleValues): Promise<void> | void;
  onCompleteCoreStoryFields(input: {
    readonly fields: CoreStoryFields;
  }): Promise<CompleteCoreStoryFieldsResult> | CompleteCoreStoryFieldsResult;
  onCompleteWorldbuildingFields(input: {
    readonly fields: WorldbuildingFields;
  }): Promise<CompleteWorldbuildingFieldsResult> | CompleteWorldbuildingFieldsResult;
  onExtractStoryStateDelta(input: ExtractStoryStateDeltaRequest): Promise<void> | void;
  onGenerateBlueprint(): Promise<void> | void;
  onGenerateBookPlan(input: {
    readonly targetWordCount: number;
    readonly volumeCount: number;
  }): Promise<void> | void;
  onGenerateChapterExecutionCard(input: {
    readonly chapterPlanId: string;
    readonly instruction?: string;
  }): Promise<void> | void;
  onSaveBookPlanDraft(input: SaveBookPlanDraftValues): Promise<void> | void;
  onSaveVolumePlan(input: SaveVolumePlanValues): Promise<void> | void;
  onSaveArcPlan(input: SaveArcPlanValues): Promise<void> | void;
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
  onGenerateSerialReview(input: {
    readonly scope: "chapter_batch" | "arc" | "volume";
    readonly startChapterIndex: number;
    readonly endChapterIndex: number;
  }): Promise<void> | void;
  onLoadChapterVersions(input: LoadChapterVersionsRequest): Promise<void> | void;
  onPlanForeshadowing(input: PlanForeshadowingValues): Promise<void> | void;
  onRejectMemory(candidateId: string): Promise<void> | void;
  onRestoreChapterVersion(input: RestoreChapterVersionRequest): Promise<void> | void;
  onSaveBrief(input: SaveBriefValues): Promise<void> | void;
  onSaveChapter(input: SaveChapterRequest): Promise<void> | void;
  onSaveCoreStoryFields(input: {
    readonly fields: CoreStoryFields;
  }): Promise<SaveCoreStoryFieldsResult> | SaveCoreStoryFieldsResult;
  onSavePlotDebt(input: SavePlotDebtValues): Promise<void> | void;
  onReviewChapterDraft(input: ReviewChapterDraftRequest): Promise<void> | void;
  onSaveWorldbuildingFields(input: { readonly fields: WorldbuildingFields }): Promise<void> | void;
  onSelectChapter(chapterId: string): void;
  onUpdateCharacter(input: UpdateCharacterValues): Promise<void> | void;
  onUpdateForeshadowing(input: UpdateForeshadowingValues): Promise<void> | void;
  onUpdatePlotline(input: UpdatePlotlineValues): Promise<void> | void;
  onUpdatePlotlineNode(input: UpdatePlotlineNodeValues): Promise<void> | void;
  onUpdateStoryEvent(input: UpdateStoryEventValues): Promise<void> | void;
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
          characterStateSnapshots={input.board.characterStateSnapshots ?? []}
          characters={input.board.characters ?? []}
          onAcceptElementCandidates={input.onAcceptElementCandidates}
          onAdvanceStage={input.onAdvanceStage}
          onCreateCharacter={input.onCreateCharacter}
          onDeleteCharacter={input.onDeleteCharacter}
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
          onCreatePlotlineNode={input.onCreatePlotlineNode}
          onDeletePlotline={input.onDeletePlotline}
          onUpdatePlotline={input.onUpdatePlotline}
          onUpdatePlotlineNode={input.onUpdatePlotlineNode}
          plotlines={input.board.plotlines ?? []}
          characters={input.board.characters ?? []}
          foreshadowings={input.board.foreshadowings ?? []}
          storyEvents={input.board.storyEvents ?? []}
          worldRules={input.board.worldRules ?? []}
        />
      );
    case "book-outline":
      return (
        <BookOutlineModuleV2
          creativePath={input.creativePath}
          onDeleteArcPlan={input.onDeleteArcPlan}
          onDeleteBookPlan={input.onDeleteBookPlan}
          onDeleteVolumePlan={input.onDeleteVolumePlan}
          onGenerateBookPlan={input.onGenerateBookPlan}
          onSaveArcPlan={input.onSaveArcPlan}
          onSaveBookPlanDraft={input.onSaveBookPlanDraft}
          onSaveVolumePlan={input.onSaveVolumePlan}
          plotlines={input.board.plotlines ?? []}
          project={input.board.project}
        />
      );
    case "plot-nodes":
      return (
        <PlotNodesModule
          chapters={input.board.chapters}
          characters={input.board.characters ?? []}
          foreshadowings={input.board.foreshadowings ?? []}
          onCreateForeshadowing={input.onCreateForeshadowing}
          onCreateStoryEvent={input.onCreateStoryEvent}
          onPlanForeshadowing={input.onPlanForeshadowing}
          onSavePlotDebt={input.onSavePlotDebt}
          onUpdateForeshadowing={input.onUpdateForeshadowing}
          onUpdateStoryEvent={input.onUpdateStoryEvent}
          plotDebts={input.board.plotDebts ?? []}
          plotlines={input.board.plotlines ?? []}
          storyEvents={input.board.storyEvents ?? []}
          worldRules={input.board.worldRules ?? []}
        />
      );
    case "chapter-planning":
      return (
        <ChapterPlanningModule
          creativePath={input.creativePath}
          onApplyChapterOutline={input.onApplyChapterOutline}
          onApproveChapterOutline={input.onApproveChapterOutline}
          onGenerateChapterExecutionCard={input.onGenerateChapterExecutionCard}
          onGenerateDraftFromOutline={input.onGenerateDraftFromOutline}
          onGenerateDraftFromPlan={input.onGenerateDraftFromPlan}
          onGenerateOutline={input.onGenerateOutline}
          onGenerateRollingOutline={input.onGenerateRollingOutline}
          onGenerateSerialReview={input.onGenerateSerialReview}
        />
      );
    case "manuscript":
      return (
        <ChapterEditorPage
          chapter={input.selectedChapter}
          chapters={input.board.chapters}
          loadingVersions={input.loadingChapterVersions}
          onCreateChapter={input.onCreateChapter}
          onExtractStateDelta={input.onExtractStoryStateDelta}
          onGenerateDraft={input.onGenerateDraft}
          onLoadVersions={input.onLoadChapterVersions}
          onReviewDraft={input.onReviewChapterDraft}
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
  characterStateSnapshots,
  characters,
  onAcceptElementCandidates,
  onAdvanceStage,
  onCreateCharacter,
  onDeleteCharacter,
  onGenerateElementCandidates,
  onUpdateCharacter,
  project,
  worldRules,
}: {
  readonly characterStateSnapshots: readonly CharacterStateSnapshotItem[];
  readonly characters: readonly CharacterElement[];
  readonly project: WorkbenchProject;
  readonly worldRules: readonly WorldRuleElement[];
  onAcceptElementCandidates(input: AcceptElementCandidatesValues): Promise<void> | void;
  onAdvanceStage(input: {
    readonly stageKey: CreativeStageKey;
    readonly mode: "strict" | "force";
  }): Promise<void> | void;
  onCreateCharacter(input: CreateCharacterValues): Promise<void> | void;
  onDeleteCharacter(input: DeleteCharacterValues): Promise<void> | void;
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
  const [characterModalMode, setCharacterModalMode] = useState<"create" | "edit" | null>(null);
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [characterAiModalOpen, setCharacterAiModalOpen] = useState(false);
  const [deletingCharacter, setDeletingCharacter] = useState<CharacterElement | null>(null);
  const [stateCharacterId, setStateCharacterId] = useState<string | null>(null);
  const editingCharacter =
    editingCharacterId === null
      ? null
      : (characters.find((character) => character.id === editingCharacterId) ?? null);
  const isEditingCharacter = characterModalMode === "edit" && editingCharacter !== null;
  const stateCharacter =
    stateCharacterId === null
      ? null
      : (characters.find((character) => character.id === stateCharacterId) ?? null);

  useEffect(() => {
    if (characterModalMode === "edit" && editingCharacter) {
      form.setFieldsValue(characterToFormValues(editingCharacter));
      return;
    }

    if (characterModalMode === "create") {
      form.resetFields();
      form.setFieldsValue(CHARACTER_FORM_DEFAULTS);
    }
  }, [characterModalMode, editingCharacter, form]);

  const closeCharacterModal = () => {
    setCharacterModalMode(null);
    setEditingCharacterId(null);
    form.resetFields();
    form.setFieldsValue(CHARACTER_FORM_DEFAULTS);
  };

  const openCreateCharacterModal = () => {
    setEditingCharacterId(null);
    setCharacterModalMode("create");
  };

  const openEditCharacterModal = (character: CharacterElement) => {
    setEditingCharacterId(character.id);
    setCharacterModalMode("edit");
  };

  const handleCharacterSubmit = async (values: CreateCharacterValues) => {
    if (isEditingCharacter) {
      await onUpdateCharacter({
        characterId: editingCharacter.id,
        patch: normalizeCharacterPatchValues(values),
      });
      closeCharacterModal();
      return;
    }

    await onCreateCharacter(normalizeCharacterValues(values));
    closeCharacterModal();
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
              <div>
                <Title level={5}>角色列表</Title>
                <Text type="secondary">先管理人物清单，再进入单个角色的档案编辑。</Text>
              </div>
              <Text type="secondary">{characters.length} 个角色</Text>
            </header>
            <Space className="character-list-actions" wrap>
              <Button
                aria-label="新建角色"
                icon={<PlusOutlined />}
                onClick={openCreateCharacterModal}
                type="primary"
              >
                新建角色
              </Button>
              <Button
                aria-label="AI 生成角色候选"
                icon={<ThunderboltOutlined />}
                onClick={() => setCharacterAiModalOpen(true)}
              >
                AI 生成角色候选
              </Button>
              <Button
                aria-label="完成角色设计"
                icon={<CheckCircleOutlined />}
                onClick={() => onAdvanceStage({ mode: "strict", stageKey: "characters" })}
              >
                完成角色设计
              </Button>
            </Space>
            <CharacterRoster
              characters={characters}
              onDeleteCharacter={setDeletingCharacter}
              onEditCharacter={openEditCharacterModal}
              onShowState={(character) => setStateCharacterId(character.id)}
            />
          </section>

          {characterModalMode !== null ? (
            <Modal
              className="creative-form-modal"
              footer={null}
              onCancel={closeCharacterModal}
              open
              title={
                isEditingCharacter && editingCharacter
                  ? `编辑角色：${editingCharacter.name}`
                  : "新建角色"
              }
              width={960}
            >
              <section aria-label="角色档案表单" className="creative-form-modal__body">
                <header className="character-design-pane__header">
                  <Title level={5}>角色档案</Title>
                  <Text type="secondary">先确定人物在故事里的作用，再补外形、弧线和声音。</Text>
                </header>
                <Form
                  form={form}
                  initialValues={CHARACTER_FORM_DEFAULTS}
                  layout="vertical"
                  onFinish={handleCharacterSubmit}
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
                    <Button aria-label="取消" onClick={closeCharacterModal}>
                      取消
                    </Button>
                  </Space>
                </Form>
              </section>
            </Modal>
          ) : null}
        </div>

        {characterAiModalOpen ? (
          <Modal
            className="creative-form-modal"
            footer={null}
            onCancel={() => setCharacterAiModalOpen(false)}
            open
            title="AI 生成角色候选"
            width={720}
          >
            <ElementCandidateSection
              className="character-design-candidate"
              defaultElementType="character_name"
              generateButtonLabel="生成角色候选"
              onAcceptElementCandidates={async (input) => {
                await onAcceptElementCandidates(input);
                setCharacterAiModalOpen(false);
              }}
              onGenerateElementCandidates={onGenerateElementCandidates}
              project={project}
              title="AI 辅助"
              worldRules={worldRules}
            />
          </Modal>
        ) : null}
      </div>
      {stateCharacter ? (
        <CharacterStateTimelineModal
          character={stateCharacter}
          onClose={() => setStateCharacterId(null)}
          snapshots={characterStateSnapshots.filter(
            (snapshot) => snapshot.characterId === stateCharacter.id,
          )}
        />
      ) : null}
      {deletingCharacter ? (
        <Modal
          cancelText="取消"
          okButtonProps={{ danger: true }}
          okText="确认删除"
          onCancel={() => setDeletingCharacter(null)}
          onOk={async () => {
            await onDeleteCharacter({ characterId: deletingCharacter.id });
            setDeletingCharacter(null);
          }}
          open
          title="删除角色"
        >
          <Text>删除后会从当前作品的角色列表中移除。</Text>
        </Modal>
      ) : null}
    </div>
  );
}

function StorylinesModule({
  characters,
  foreshadowings,
  onAdvanceStage,
  onCreatePlotline,
  onCreatePlotlineNode,
  onDeletePlotline,
  onUpdatePlotline,
  onUpdatePlotlineNode,
  plotlines,
  storyEvents,
  worldRules,
}: {
  readonly characters: readonly CharacterElement[];
  readonly foreshadowings: readonly ForeshadowingElement[];
  readonly plotlines: readonly PlotlineElement[];
  readonly storyEvents: readonly StoryEventElement[];
  readonly worldRules: readonly WorldRuleElement[];
  onAdvanceStage(input: {
    readonly stageKey: CreativeStageKey;
    readonly mode: "strict" | "force";
  }): Promise<void> | void;
  onCreatePlotlineNode(input: CreatePlotlineNodeValues): Promise<void> | void;
  onCreatePlotline(input: CreatePlotlineValues): Promise<void> | void;
  onDeletePlotline(input: DeletePlotlineValues): Promise<void> | void;
  onUpdatePlotline(input: UpdatePlotlineValues): Promise<void> | void;
  onUpdatePlotlineNode(input: UpdatePlotlineNodeValues): Promise<void> | void;
}) {
  const [plotlineForm] = Form.useForm<CreatePlotlineValues>();
  const [nodeForm] = Form.useForm<Omit<CreatePlotlineNodeValues, "plotlineId">>();
  const [plotlineModalMode, setPlotlineModalMode] = useState<"create" | "edit" | null>(null);
  const [editingPlotlineId, setEditingPlotlineId] = useState<string | null>(null);
  const [nodeTargetPlotlineId, setNodeTargetPlotlineId] = useState<string | null>(null);
  const [deletingPlotline, setDeletingPlotline] = useState<PlotlineElement | null>(null);
  const editingPlotline =
    editingPlotlineId === null
      ? null
      : (plotlines.find((plotline) => plotline.id === editingPlotlineId) ?? null);
  const nodeTargetPlotline =
    nodeTargetPlotlineId === null
      ? null
      : (plotlines.find((plotline) => plotline.id === nodeTargetPlotlineId) ?? null);
  const isEditingPlotline = plotlineModalMode === "edit" && editingPlotline !== null;
  const characterOptions = useMemo(
    () => characters.map((character) => ({ label: character.name, value: character.id })),
    [characters],
  );
  const worldRuleOptions = useMemo(
    () => worldRules.map((rule) => ({ label: rule.title, value: rule.id })),
    [worldRules],
  );
  const foreshadowingOptions = useMemo(
    () =>
      foreshadowings.map((foreshadowing) => ({
        label: foreshadowing.title,
        value: foreshadowing.id,
      })),
    [foreshadowings],
  );
  const storyEventOptions = useMemo(
    () => storyEvents.map((event) => ({ label: event.title, value: event.id })),
    [storyEvents],
  );

  useLayoutEffect(() => {
    if (plotlineModalMode === "edit" && editingPlotline) {
      plotlineForm.setFieldsValue(plotlineToFormValues(editingPlotline));
      return;
    }

    if (plotlineModalMode === "create") {
      plotlineForm.resetFields();
      plotlineForm.setFieldsValue(PLOTLINE_FORM_DEFAULTS);
    }
  }, [editingPlotline, plotlineForm, plotlineModalMode]);

  useLayoutEffect(() => {
    if (nodeTargetPlotlineId !== null) {
      nodeForm.resetFields();
      nodeForm.setFieldsValue(PLOTLINE_NODE_FORM_DEFAULTS);
    }
  }, [nodeForm, nodeTargetPlotlineId]);

  const closePlotlineModal = () => {
    setPlotlineModalMode(null);
    setEditingPlotlineId(null);
    plotlineForm.resetFields();
    plotlineForm.setFieldsValue(PLOTLINE_FORM_DEFAULTS);
  };

  const openCreatePlotlineModal = () => {
    setEditingPlotlineId(null);
    setPlotlineModalMode("create");
  };

  const openEditPlotlineModal = (plotline: PlotlineElement) => {
    setEditingPlotlineId(plotline.id);
    setPlotlineModalMode("edit");
  };

  const closeNodeModal = () => {
    setNodeTargetPlotlineId(null);
    nodeForm.resetFields();
    nodeForm.setFieldsValue(PLOTLINE_NODE_FORM_DEFAULTS);
  };

  const handlePlotlineSubmit = async (values: CreatePlotlineValues) => {
    const normalizedValues = normalizePlotlineValues(values);
    if (isEditingPlotline) {
      await onUpdatePlotline({
        patch: normalizedValues,
        plotlineId: editingPlotline.id,
      });
      closePlotlineModal();
      return;
    }

    await onCreatePlotline(normalizedValues);
    closePlotlineModal();
  };

  const handlePlotlineNodeSubmit = async (values: Omit<CreatePlotlineNodeValues, "plotlineId">) => {
    if (!nodeTargetPlotline) {
      return;
    }

    await onCreatePlotlineNode(normalizePlotlineNodeValues(values, nodeTargetPlotline.id));
    closeNodeModal();
  };

  return (
    <div className="module-stack">
      <ModuleHeader eyebrow="5 / 9" title="故事线设计" />
      <div className="storyline-design-workspace">
        <div className="storyline-design-primary">
          <section
            aria-label="故事线列表面板"
            className="storyline-design-pane storyline-design-list"
          >
            <header className="storyline-design-pane__header">
              <div>
                <Title level={5}>故事线列表</Title>
                <Text type="secondary">先管理故事线清单，再进入单条线和节点编排。</Text>
              </div>
              <Text type="secondary">{plotlines.length} 条线</Text>
            </header>
            <Space className="storyline-list-actions" wrap>
              <Button
                aria-label="新建故事线"
                icon={<PlusOutlined />}
                onClick={openCreatePlotlineModal}
                type="primary"
              >
                新建故事线
              </Button>
              <Button
                aria-label="完成故事线设计"
                icon={<CheckCircleOutlined />}
                onClick={() => onAdvanceStage({ mode: "strict", stageKey: "plot_arcs" })}
              >
                完成故事线设计
              </Button>
            </Space>
            <StorylineRoster
              plotlines={plotlines}
              onAddNode={(plotline) => setNodeTargetPlotlineId(plotline.id)}
              onDeletePlotline={setDeletingPlotline}
              onEditPlotline={openEditPlotlineModal}
              onResolveNode={(nodeId) =>
                onUpdatePlotlineNode({
                  patch: { status: "resolved" },
                  plotlineNodeId: nodeId,
                })
              }
            />
          </section>

          {plotlineModalMode !== null ? (
            <Modal
              className="creative-form-modal"
              footer={null}
              onCancel={closePlotlineModal}
              open
              title={
                isEditingPlotline && editingPlotline
                  ? `编辑故事线：${editingPlotline.name}`
                  : "新建故事线"
              }
              width={960}
            >
              <section aria-label="故事线档案表单" className="creative-form-modal__body">
                <header className="storyline-design-pane__header">
                  <Title level={5}>故事线档案</Title>
                  <Text type="secondary">
                    先确定追问、阻力、情绪承诺和回收方式，再落到章节节点。
                  </Text>
                </header>
                <Form
                  form={plotlineForm}
                  initialValues={PLOTLINE_FORM_DEFAULTS}
                  layout="vertical"
                  name="storylineProfileForm"
                  onFinish={handlePlotlineSubmit}
                >
                  <div className="storyline-form-grid">
                    <Form.Item
                      label={characterFieldLabel(
                        "故事线名称",
                        "用短名称帮助作者和 AI 识别这条线，例如旧信谜团、师徒裂痕、王都夺权。",
                      )}
                      name="title"
                      rules={[
                        { required: true, message: "请输入故事线名称" },
                        { max: 80, message: "故事线名称最多 80 字" },
                      ]}
                    >
                      <Input aria-label="故事线名称" placeholder="如：旧信谜团" />
                    </Form.Item>
                    <Form.Item label="故事线类型" name="kind">
                      <Select aria-label="故事线类型" options={[...PLOTLINE_KIND_OPTIONS]} />
                    </Form.Item>
                    <Form.Item label="叙事作用" name="narrativeRole">
                      <Select
                        aria-label="叙事作用"
                        options={[...PLOTLINE_NARRATIVE_ROLE_OPTIONS]}
                      />
                    </Form.Item>
                    <Form.Item label="重要程度" name="importance">
                      <Select aria-label="重要程度" options={[...PLOTLINE_IMPORTANCE_OPTIONS]} />
                    </Form.Item>
                    <Form.Item label="状态" name="status">
                      <Select aria-label="状态" options={[...PLOTLINE_STATUS_OPTIONS]} />
                    </Form.Item>
                    <Form.Item label="排序权重" name="priority">
                      <InputNumber aria-label="排序权重" min={0} style={{ width: "100%" }} />
                    </Form.Item>
                    <Form.Item
                      className="storyline-form-grid__wide"
                      label={characterFieldLabel(
                        "故事线摘要",
                        "一句话说明这条线的范围，不需要写成完整大纲。",
                      )}
                      name="summary"
                      rules={[{ max: 500, message: "故事线摘要最多 500 字" }]}
                    >
                      <Input.TextArea
                        aria-label="故事线摘要"
                        autoSize={{ maxRows: 5, minRows: 3 }}
                        maxLength={500}
                        placeholder="如：围绕旧信来源展开的调查线。"
                        showCount
                      />
                    </Form.Item>
                    <Form.Item
                      label={characterFieldLabel(
                        "核心问题",
                        "读者会持续追问的问题。悬疑线是谜面，成长线是人物能否改变，权谋线是谁会赢。",
                      )}
                      name="centralQuestion"
                      rules={[{ max: 500, message: "核心问题最多 500 字" }]}
                    >
                      <Input.TextArea
                        aria-label="核心问题"
                        autoSize={{ maxRows: 4, minRows: 2 }}
                        maxLength={500}
                        placeholder="如：旧信到底是谁寄出的？"
                        showCount
                      />
                    </Form.Item>
                    <Form.Item
                      label={characterFieldLabel(
                        "推进机制",
                        "这条线靠什么持续前进：线索投放、目标受阻、关系变化、资源争夺或规则升级。",
                      )}
                      name="driver"
                      rules={[{ max: 500, message: "推进机制最多 500 字" }]}
                    >
                      <Input.TextArea
                        aria-label="推进机制"
                        autoSize={{ maxRows: 4, minRows: 2 }}
                        maxLength={500}
                        placeholder="如：每三章投放一条可验证线索，并用一次误导制造新的问题。"
                        showCount
                      />
                    </Form.Item>
                    <Form.Item
                      label={characterFieldLabel(
                        "起点状态",
                        "这条线开始时，人物知道什么、不知道什么，局面停在哪个不稳定状态。",
                      )}
                      name="startState"
                      rules={[{ max: 500, message: "起点状态最多 500 字" }]}
                    >
                      <Input.TextArea
                        aria-label="起点状态"
                        autoSize={{ maxRows: 4, minRows: 2 }}
                        maxLength={500}
                        placeholder="如：主角只知道旧信存在，不知道背后牵连旧案。"
                        showCount
                      />
                    </Form.Item>
                    <Form.Item
                      label={characterFieldLabel(
                        "中段升级",
                        "中段必须扩大的阻力或信息量，避免故事线停留在同一种重复事件里。",
                      )}
                      name="midEscalation"
                      rules={[{ max: 500, message: "中段升级最多 500 字" }]}
                    >
                      <Input.TextArea
                        aria-label="中段升级"
                        autoSize={{ maxRows: 4, minRows: 2 }}
                        maxLength={500}
                        placeholder="如：线索从旧信转向档案伪造和证人追杀。"
                        showCount
                      />
                    </Form.Item>
                    <Form.Item
                      label={characterFieldLabel(
                        "回收方式",
                        "说明这条线最终如何兑现：揭示真相、改变关系、造成代价或打开更大矛盾。",
                      )}
                      name="payoffPlan"
                      rules={[{ max: 500, message: "回收方式最多 500 字" }]}
                    >
                      <Input.TextArea
                        aria-label="回收方式"
                        autoSize={{ maxRows: 4, minRows: 2 }}
                        maxLength={500}
                        placeholder="如：卷末揭示寄信人身份，并回收信纸水印伏笔。"
                        showCount
                      />
                    </Form.Item>
                    <Form.Item
                      className="storyline-form-grid__wide"
                      label={characterFieldLabel(
                        "情绪承诺",
                        "这条线给读者的追读奖励，例如解谜、反转、甜虐、热血、压迫感或成长满足。",
                      )}
                      name="emotionalPromise"
                      rules={[{ max: 500, message: "情绪承诺最多 500 字" }]}
                    >
                      <Input.TextArea
                        aria-label="情绪承诺"
                        autoSize={{ maxRows: 4, minRows: 2 }}
                        maxLength={500}
                        placeholder="如：持续解谜、反转和真相逼近。"
                        showCount
                      />
                    </Form.Item>
                    <Form.Item label="关联角色" name="relatedCharacterIds">
                      <Select
                        allowClear
                        aria-label="关联角色"
                        mode="multiple"
                        options={characterOptions}
                        placeholder="选择和这条线强相关的人物"
                      />
                    </Form.Item>
                    <Form.Item label="关联世界观" name="relatedWorldRuleIds">
                      <Select
                        allowClear
                        aria-label="关联世界观"
                        mode="multiple"
                        options={worldRuleOptions}
                        placeholder="选择支撑这条线的规则"
                      />
                    </Form.Item>
                    <Form.Item label="关联伏笔" name="relatedForeshadowingIds">
                      <Select
                        allowClear
                        aria-label="关联伏笔"
                        mode="multiple"
                        options={foreshadowingOptions}
                        placeholder="选择要投放或回收的伏笔"
                      />
                    </Form.Item>
                    <Form.Item label="关联剧情节点" name="relatedStoryEventIds">
                      <Select
                        allowClear
                        aria-label="关联剧情节点"
                        mode="multiple"
                        options={storyEventOptions}
                        placeholder="选择已经存在的关键事件"
                      />
                    </Form.Item>
                  </div>
                  <Space className="storyline-form-actions" wrap>
                    <Button
                      aria-label={isEditingPlotline ? "保存修改" : "创建故事线"}
                      htmlType="submit"
                      icon={isEditingPlotline ? <SaveOutlined /> : <PlusOutlined />}
                      type="primary"
                    >
                      {isEditingPlotline ? "保存修改" : "创建故事线"}
                    </Button>
                    <Button aria-label="取消" onClick={closePlotlineModal}>
                      取消
                    </Button>
                  </Space>
                </Form>
              </section>
            </Modal>
          ) : null}
        </div>

        {nodeTargetPlotline ? (
          <Modal
            className="creative-form-modal"
            footer={null}
            onCancel={closeNodeModal}
            open
            title={`添加故事线节点：${nodeTargetPlotline.name}`}
            width={820}
          >
            <section aria-label="故事线节点编排" className="creative-form-modal__body">
              <header className="storyline-design-pane__header">
                <Title level={5}>节点编排</Title>
                <Text type="secondary">把这条线拆成可落到章节里的信息、选择和回收节点。</Text>
              </header>
              <Form
                form={nodeForm}
                initialValues={PLOTLINE_NODE_FORM_DEFAULTS}
                layout="vertical"
                name="storylineNodeForm"
                onFinish={handlePlotlineNodeSubmit}
              >
                <div className="storyline-node-form-grid">
                  <Form.Item
                    label={characterFieldLabel(
                      "节点标题",
                      "写清这一步对故事线的作用，例如水印出现、证人翻供、反派反将一军。",
                    )}
                    name="title"
                    rules={[
                      { required: true, message: "请输入节点标题" },
                      { max: 80, message: "节点标题最多 80 字" },
                    ]}
                  >
                    <Input aria-label="节点标题" placeholder="如：信纸水印出现" />
                  </Form.Item>
                  <Form.Item label="节点类型" name="kind">
                    <Select aria-label="节点类型" options={[...PLOTLINE_NODE_KIND_OPTIONS]} />
                  </Form.Item>
                  <Form.Item label="节点状态" name="status">
                    <Select aria-label="节点状态" options={[...PLOTLINE_NODE_STATUS_OPTIONS]} />
                  </Form.Item>
                  <Form.Item
                    label={characterFieldLabel(
                      "章节提示",
                      "先写预计章节、卷名或阶段，用来帮助后续章节规划承接这条线。",
                    )}
                    name="chapterHint"
                    rules={[{ max: 80, message: "章节提示最多 80 字" }]}
                  >
                    <Input aria-label="章节提示" placeholder="如：第 3 章" />
                  </Form.Item>
                  <Form.Item
                    className="storyline-node-form-grid__wide"
                    label={characterFieldLabel(
                      "节点说明",
                      "说明该节点带来的信息增量、人物选择、阻力变化或伏笔回收。",
                    )}
                    name="description"
                    rules={[{ max: 500, message: "节点说明最多 500 字" }]}
                  >
                    <Input.TextArea
                      aria-label="节点说明"
                      autoSize={{ maxRows: 4, minRows: 2 }}
                      maxLength={500}
                      placeholder="如：让读者看到信纸水印，但暂时不解释来源。"
                      showCount
                    />
                  </Form.Item>
                </div>
                <Space className="storyline-form-actions" wrap>
                  <Button
                    aria-label="添加节点"
                    htmlType="submit"
                    icon={<PlusOutlined />}
                    type="primary"
                  >
                    添加节点
                  </Button>
                  <Button aria-label="取消" onClick={closeNodeModal}>
                    取消
                  </Button>
                </Space>
              </Form>
            </section>
          </Modal>
        ) : null}
      </div>
      {deletingPlotline ? (
        <Modal
          cancelText="取消"
          okButtonProps={{ danger: true }}
          okText="确认删除"
          onCancel={() => setDeletingPlotline(null)}
          onOk={async () => {
            await onDeletePlotline({ plotlineId: deletingPlotline.id });
            setDeletingPlotline(null);
          }}
          open
          title="删除故事线"
        >
          <Text>删除后会从当前作品的故事线列表中移除。</Text>
        </Modal>
      ) : null}
    </div>
  );
}

function StorylineRoster({
  onAddNode,
  onDeletePlotline,
  onEditPlotline,
  onResolveNode,
  plotlines,
}: {
  readonly plotlines: readonly PlotlineElement[];
  onAddNode(plotline: PlotlineElement): void;
  onDeletePlotline(plotline: PlotlineElement): void;
  onEditPlotline(plotline: PlotlineElement): void;
  onResolveNode(nodeId: string): Promise<void> | void;
}) {
  if (plotlines.length === 0) {
    return <Empty description="暂无故事线" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <ul className="storyline-roster">
      {plotlines.map((plotline) => (
        <li key={plotline.id}>
          <article className="storyline-roster__item">
            <div className="storyline-roster__title-row">
              <strong>{plotline.name}</strong>
              <span>{plotline.nodes?.length ?? 0} 节点</span>
            </div>
            <Space size={[6, 4]} wrap>
              <Tag>{getPlotlineKindLabel(plotline.type)}</Tag>
              <Tag>{getPlotlineNarrativeRoleLabel(plotline.narrativeRole)}</Tag>
              <Tag>{getPlotlineImportanceLabel(plotline.importance)}</Tag>
              <Tag>{getPlotlineStatusLabel(plotline.status)}</Tag>
            </Space>
            {plotline.centralQuestion ? (
              <Text type="secondary">{plotline.centralQuestion}</Text>
            ) : plotline.summary ? (
              <Text type="secondary">{plotline.summary}</Text>
            ) : null}
            <span
              aria-label={`${plotline.name} 完成度 ${getPlotlineCompletionScore(plotline)}%`}
              className="storyline-roster__progress"
            >
              <span style={{ width: `${getPlotlineCompletionScore(plotline)}%` }} />
            </span>
            <Space className="storyline-roster__actions" size={8} wrap>
              <Button
                aria-label={`编辑故事线 ${plotline.name}`}
                icon={<EditOutlined />}
                onClick={() => onEditPlotline(plotline)}
              >
                编辑
              </Button>
              <Button
                aria-label={`添加节点 ${plotline.name}`}
                icon={<PlusOutlined />}
                onClick={() => onAddNode(plotline)}
              >
                添加节点
              </Button>
              <Button
                aria-label={`删除故事线 ${plotline.name}`}
                danger
                icon={<DeleteOutlined />}
                onClick={() => onDeletePlotline(plotline)}
              >
                删除
              </Button>
            </Space>
            {(plotline.nodes?.length ?? 0) > 0 ? (
              <div className="storyline-roster__nodes">
                <StorylineNodeList nodes={plotline.nodes ?? []} onResolveNode={onResolveNode} />
              </div>
            ) : null}
          </article>
        </li>
      ))}
    </ul>
  );
}

function StorylineNodeList({
  nodes,
  onResolveNode,
}: {
  readonly nodes: readonly PlotlineNodeElement[];
  onResolveNode(nodeId: string): Promise<void> | void;
}) {
  if (nodes.length === 0) {
    return <Empty description="暂无节点" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <ul className="storyline-node-list">
      {nodes.map((node) => (
        <li className="storyline-node-list__item" key={node.id}>
          <div className="storyline-node-list__main">
            <span className="storyline-node-list__title-row">
              <strong>{node.title}</strong>
              {node.chapterHint ? <Text type="secondary">{node.chapterHint}</Text> : null}
            </span>
            <Space size={[6, 4]} wrap>
              <Tag>{getPlotlineNodeKindLabel(node.kind)}</Tag>
              <Tag>{getPlotlineNodeStatusLabel(node.status)}</Tag>
            </Space>
            {node.description ? <Text type="secondary">{node.description}</Text> : null}
          </div>
          <Button
            aria-label={`标记节点已回收 ${node.title}`}
            disabled={node.status === "resolved"}
            onClick={() => onResolveNode(node.id)}
          >
            标记回收
          </Button>
        </li>
      ))}
    </ul>
  );
}

interface BookPlanFormValues {
  readonly corePromise?: string;
  readonly endingDirection?: string | null | undefined;
  readonly mainPlotlineId?: string | null | undefined;
  readonly status?: SaveBookPlanDraftValues["status"];
  readonly targetWordCount?: number;
  readonly title?: string;
}

interface VolumePlanFormValues {
  readonly bookPlanId?: string;
  readonly climax?: string | null | undefined;
  readonly majorConflict?: string;
  readonly purpose?: string;
  readonly status?: SaveVolumePlanValues["status"];
  readonly targetWordCount?: number;
  readonly title?: string;
  readonly volumeIndex?: number;
}

interface ArcPlanFormValues {
  readonly arcIndex?: number;
  readonly characterArcId?: string | null | undefined;
  readonly endChapterIndex?: number | null | undefined;
  readonly escalationText?: string;
  readonly plotlineId?: string | null | undefined;
  readonly purpose?: string;
  readonly startChapterIndex?: number | null | undefined;
  readonly status?: SaveArcPlanValues["status"];
  readonly title?: string;
  readonly volumePlanId?: string;
}

interface BookPlanGenerateFormValues {
  readonly targetWordCount?: number;
  readonly volumeCount?: number;
}

function bookPlanToFormValues(
  plan: BookPlanItem | null,
  fallback: { readonly estimatedWordCount: number; readonly title: string },
): BookPlanFormValues {
  return {
    corePromise: plan?.corePromise ?? "",
    endingDirection: plan?.endingDirection ?? "",
    mainPlotlineId: plan?.mainPlotlineId ?? undefined,
    status: (plan?.status as SaveBookPlanDraftValues["status"] | undefined) ?? "draft",
    targetWordCount: plan?.targetWordCount ?? fallback.estimatedWordCount,
    title: plan?.title ?? `${fallback.title}全书大纲`,
  };
}

function volumePlanToFormValues(
  plan: VolumePlanItem | null,
  fallback: {
    readonly bookPlanId: string;
    readonly targetWordCount: number;
    readonly volumeIndex: number;
  },
): VolumePlanFormValues {
  return {
    bookPlanId: plan?.bookPlanId ?? fallback.bookPlanId,
    climax: plan?.climax ?? "",
    majorConflict: plan?.majorConflict ?? "",
    purpose: plan?.purpose ?? "",
    status: (plan?.status as SaveVolumePlanValues["status"] | undefined) ?? "draft",
    targetWordCount: plan?.targetWordCount ?? fallback.targetWordCount,
    title: plan?.title ?? "",
    volumeIndex: plan?.volumeIndex ?? fallback.volumeIndex,
  };
}

function arcPlanToFormValues(
  plan: ArcPlanItem | null,
  fallback: { readonly arcIndex: number; readonly volumePlanId: string },
): ArcPlanFormValues {
  return {
    arcIndex: plan?.arcIndex ?? fallback.arcIndex,
    characterArcId: plan?.characterArcId ?? undefined,
    endChapterIndex: plan?.endChapterIndex ?? null,
    escalationText: joinEscalation(plan?.escalation ?? []),
    plotlineId: plan?.plotlineId ?? undefined,
    purpose: plan?.purpose ?? "",
    startChapterIndex: plan?.startChapterIndex ?? null,
    status: (plan?.status as SaveArcPlanValues["status"] | undefined) ?? "draft",
    title: plan?.title ?? "",
    volumePlanId: plan?.volumePlanId ?? fallback.volumePlanId,
  };
}

function parseEscalationText(value: string | undefined): string[] {
  return (value ?? "")
    .split(/\n|；|;|，|,/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 12);
}

function joinEscalation(escalation: readonly string[]): string {
  return escalation.join("\n");
}

function normalizedNullableFormText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function getNextVolumeIndex(volumePlans: readonly VolumePlanItem[]): number {
  return (
    volumePlans.reduce((maxVolumeIndex, plan) => Math.max(maxVolumeIndex, plan.volumeIndex), 0) + 1
  );
}

function getNextArcIndex(
  arcPlans: readonly ArcPlanItem[],
  volumePlanId: string | undefined,
): number {
  return (
    arcPlans
      .filter((plan) => (volumePlanId ? plan.volumePlanId === volumePlanId : true))
      .reduce((maxArcIndex, plan) => Math.max(maxArcIndex, plan.arcIndex), 0) + 1
  );
}

function estimateNextVolumeWordCount(bookPlan: BookPlanItem | null): number {
  return Math.max(10_000, Math.round((bookPlan?.targetWordCount ?? 800_000) / 6));
}

function formatPlanWordCount(wordCount: number): string {
  return `${wordCount.toLocaleString()} 字`;
}

type BookOutlineModalState =
  | { readonly type: "book"; readonly bookPlanId?: string }
  | { readonly type: "volume"; readonly bookPlanId?: string; readonly volumePlanId?: string }
  | { readonly type: "arc"; readonly arcPlanId?: string; readonly volumePlanId?: string }
  | { readonly type: "generate" };

type BookOutlineDeleteTarget =
  | { readonly plan: BookPlanItem; readonly type: "book" }
  | { readonly plan: VolumePlanItem; readonly type: "volume" }
  | { readonly plan: ArcPlanItem; readonly type: "arc" };

function BookOutlineModuleV2({
  creativePath,
  onDeleteArcPlan,
  onDeleteBookPlan,
  onDeleteVolumePlan,
  onGenerateBookPlan,
  onSaveArcPlan,
  onSaveBookPlanDraft,
  onSaveVolumePlan,
  plotlines,
  project,
}: {
  readonly creativePath: CreativePathBoard;
  readonly plotlines: readonly PlotlineElement[];
  readonly project: WorkbenchProject;
  onDeleteBookPlan(input: DeleteBookPlanValues): Promise<void> | void;
  onDeleteVolumePlan(input: DeleteVolumePlanValues): Promise<void> | void;
  onDeleteArcPlan(input: DeleteArcPlanValues): Promise<void> | void;
  onGenerateBookPlan(input: {
    readonly targetWordCount: number;
    readonly volumeCount: number;
  }): Promise<void> | void;
  onSaveBookPlanDraft(input: SaveBookPlanDraftValues): Promise<void> | void;
  onSaveVolumePlan(input: SaveVolumePlanValues): Promise<void> | void;
  onSaveArcPlan(input: SaveArcPlanValues): Promise<void> | void;
}) {
  const [bookForm] = Form.useForm<BookPlanFormValues>();
  const [volumeForm] = Form.useForm<VolumePlanFormValues>();
  const [arcForm] = Form.useForm<ArcPlanFormValues>();
  const [generateForm] = Form.useForm<BookPlanGenerateFormValues>();
  const [outlineModal, setOutlineModal] = useState<BookOutlineModalState | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<BookOutlineDeleteTarget | null>(null);
  const [selectedBookPlanId, setSelectedBookPlanId] = useState<string | null>(
    () => creativePath.bookPlans[0]?.id ?? null,
  );
  const [selectedVolumePlanId, setSelectedVolumePlanId] = useState<string | null>(null);
  const [selectedArcPlanId, setSelectedArcPlanId] = useState<string | null>(null);

  const selectedBookPlan =
    creativePath.bookPlans.find((plan) => plan.id === selectedBookPlanId) ?? null;
  const visibleVolumePlans = selectedBookPlan
    ? creativePath.volumePlans.filter((plan) => plan.bookPlanId === selectedBookPlan.id)
    : creativePath.volumePlans;
  const selectedVolumePlan =
    visibleVolumePlans.find((plan) => plan.id === selectedVolumePlanId) ?? null;
  const visibleArcPlans = selectedVolumePlan
    ? creativePath.arcPlans.filter((plan) => plan.volumePlanId === selectedVolumePlan.id)
    : creativePath.arcPlans;
  const selectedArcPlan = visibleArcPlans.find((plan) => plan.id === selectedArcPlanId) ?? null;
  const editingBookPlan =
    outlineModal?.type === "book" && outlineModal.bookPlanId
      ? (creativePath.bookPlans.find((plan) => plan.id === outlineModal.bookPlanId) ?? null)
      : null;
  const editingVolumePlan =
    outlineModal?.type === "volume" && outlineModal.volumePlanId
      ? (creativePath.volumePlans.find((plan) => plan.id === outlineModal.volumePlanId) ?? null)
      : null;
  const editingArcPlan =
    outlineModal?.type === "arc" && outlineModal.arcPlanId
      ? (creativePath.arcPlans.find((plan) => plan.id === outlineModal.arcPlanId) ?? null)
      : null;
  const bookPlanOptions = creativePath.bookPlans.map((plan) => ({
    label: plan.title,
    value: plan.id,
  }));
  const volumePlanOptions = creativePath.volumePlans.map((plan) => ({
    label: `${plan.volumeIndex}. ${plan.title}`,
    value: plan.id,
  }));
  const plotlineOptions = plotlines.map((plotline) => ({
    label: plotline.name,
    value: plotline.id,
  }));

  useLayoutEffect(() => {
    if (outlineModal?.type !== "book") {
      return;
    }
    bookForm.resetFields();
    bookForm.setFieldsValue(
      bookPlanToFormValues(editingBookPlan, {
        estimatedWordCount:
          creativePath.brief?.estimatedWordCount ?? project.wordCountGoal ?? 800_000,
        title: project.title,
      }),
    );
  }, [
    bookForm,
    creativePath.brief?.estimatedWordCount,
    editingBookPlan,
    outlineModal,
    project.title,
    project.wordCountGoal,
  ]);

  useLayoutEffect(() => {
    if (outlineModal?.type !== "volume") {
      return;
    }
    const fallbackBookPlanId =
      outlineModal.bookPlanId ??
      editingVolumePlan?.bookPlanId ??
      selectedBookPlan?.id ??
      creativePath.bookPlans[0]?.id ??
      "";
    const fallbackBookPlan =
      creativePath.bookPlans.find((plan) => plan.id === fallbackBookPlanId) ?? selectedBookPlan;
    volumeForm.resetFields();
    volumeForm.setFieldsValue(
      volumePlanToFormValues(editingVolumePlan, {
        bookPlanId: fallbackBookPlanId,
        targetWordCount: estimateNextVolumeWordCount(fallbackBookPlan),
        volumeIndex: getNextVolumeIndex(creativePath.volumePlans),
      }),
    );
  }, [
    creativePath.bookPlans,
    creativePath.volumePlans,
    editingVolumePlan,
    outlineModal,
    selectedBookPlan,
    volumeForm,
  ]);

  useLayoutEffect(() => {
    if (outlineModal?.type !== "arc") {
      return;
    }
    const fallbackVolumePlanId =
      outlineModal.volumePlanId ??
      editingArcPlan?.volumePlanId ??
      selectedVolumePlan?.id ??
      creativePath.volumePlans[0]?.id ??
      "";
    arcForm.resetFields();
    arcForm.setFieldsValue(
      arcPlanToFormValues(editingArcPlan, {
        arcIndex: getNextArcIndex(creativePath.arcPlans, fallbackVolumePlanId),
        volumePlanId: fallbackVolumePlanId,
      }),
    );
  }, [
    arcForm,
    creativePath.arcPlans,
    creativePath.volumePlans,
    editingArcPlan,
    outlineModal,
    selectedVolumePlan,
  ]);

  useLayoutEffect(() => {
    if (outlineModal?.type !== "generate") {
      return;
    }
    generateForm.resetFields();
    generateForm.setFieldsValue({
      targetWordCount:
        selectedBookPlan?.targetWordCount ??
        creativePath.brief?.estimatedWordCount ??
        project.wordCountGoal ??
        800_000,
      volumeCount: Math.max(creativePath.volumePlans.length, 6),
    });
  }, [
    creativePath.brief?.estimatedWordCount,
    creativePath.volumePlans.length,
    generateForm,
    outlineModal,
    project.wordCountGoal,
    selectedBookPlan,
  ]);

  const closeOutlineModal = () => setOutlineModal(null);

  const handleSelectBookPlan = (plan: BookPlanItem) => {
    setSelectedBookPlanId(plan.id);
    setSelectedVolumePlanId(null);
    setSelectedArcPlanId(null);
  };

  const handleSelectVolumePlan = (plan: VolumePlanItem) => {
    const bookPlan = creativePath.bookPlans.find((candidate) => candidate.id === plan.bookPlanId);
    setSelectedBookPlanId(bookPlan?.id ?? null);
    setSelectedVolumePlanId(plan.id);
    setSelectedArcPlanId(null);
  };

  const handleSelectArcPlan = (plan: ArcPlanItem) => {
    const volumePlan = creativePath.volumePlans.find(
      (candidate) => candidate.id === plan.volumePlanId,
    );
    const bookPlan = volumePlan
      ? creativePath.bookPlans.find((candidate) => candidate.id === volumePlan.bookPlanId)
      : undefined;
    setSelectedBookPlanId(bookPlan?.id ?? null);
    setSelectedVolumePlanId(volumePlan?.id ?? null);
    setSelectedArcPlanId(plan.id);
  };

  const handleSaveBookPlan = async (values: BookPlanFormValues) => {
    const payload: SaveBookPlanDraftValues = {
      corePromise: values.corePromise?.trim() ?? "",
      endingDirection: normalizedNullableFormText(values.endingDirection),
      mainPlotlineId: normalizedNullableFormText(values.mainPlotlineId),
      status: values.status ?? "draft",
      targetWordCount: values.targetWordCount ?? 800_000,
      title: values.title?.trim() ?? project.title,
      ...(outlineModal?.type === "book" && outlineModal.bookPlanId
        ? { bookPlanId: outlineModal.bookPlanId }
        : {}),
    };
    await onSaveBookPlanDraft(payload);
    closeOutlineModal();
  };

  const handleSaveVolumePlan = async (values: VolumePlanFormValues) => {
    const payload: SaveVolumePlanValues = {
      bookPlanId: values.bookPlanId ?? selectedBookPlan?.id ?? "",
      climax: normalizedNullableFormText(values.climax),
      majorConflict: values.majorConflict?.trim() ?? "",
      purpose: values.purpose?.trim() ?? "",
      status: values.status ?? "draft",
      targetWordCount: values.targetWordCount ?? estimateNextVolumeWordCount(selectedBookPlan),
      title: values.title?.trim() ?? "未命名卷",
      volumeIndex: values.volumeIndex ?? getNextVolumeIndex(creativePath.volumePlans),
      ...(outlineModal?.type === "volume" && outlineModal.volumePlanId
        ? { volumePlanId: outlineModal.volumePlanId }
        : {}),
    };
    await onSaveVolumePlan(payload);
    closeOutlineModal();
  };

  const handleSaveArcPlan = async (values: ArcPlanFormValues) => {
    const payload: SaveArcPlanValues = {
      arcIndex: values.arcIndex ?? getNextArcIndex(creativePath.arcPlans, values.volumePlanId),
      characterArcId: normalizedNullableFormText(values.characterArcId),
      endChapterIndex: values.endChapterIndex ?? null,
      escalation: parseEscalationText(values.escalationText),
      plotlineId: normalizedNullableFormText(values.plotlineId),
      purpose: values.purpose?.trim() ?? "",
      startChapterIndex: values.startChapterIndex ?? null,
      status: values.status ?? "draft",
      title: values.title?.trim() ?? "未命名阶段弧线",
      volumePlanId: values.volumePlanId ?? selectedVolumePlan?.id ?? "",
      ...(outlineModal?.type === "arc" && outlineModal.arcPlanId
        ? { arcPlanId: outlineModal.arcPlanId }
        : {}),
    };
    await onSaveArcPlan(payload);
    closeOutlineModal();
  };

  const handleConfirmDelete = async () => {
    if (!deletingPlan) {
      return;
    }
    if (deletingPlan.type === "book") {
      await onDeleteBookPlan({ bookPlanId: deletingPlan.plan.id });
      if (selectedBookPlanId === deletingPlan.plan.id) {
        setSelectedBookPlanId(null);
        setSelectedVolumePlanId(null);
        setSelectedArcPlanId(null);
      }
    } else if (deletingPlan.type === "volume") {
      await onDeleteVolumePlan({ volumePlanId: deletingPlan.plan.id });
      if (selectedVolumePlanId === deletingPlan.plan.id) {
        setSelectedVolumePlanId(null);
        setSelectedArcPlanId(null);
      }
    } else {
      await onDeleteArcPlan({ arcPlanId: deletingPlan.plan.id });
      if (selectedArcPlanId === deletingPlan.plan.id) {
        setSelectedArcPlanId(null);
      }
    }
    setDeletingPlan(null);
  };

  const deleteTitle =
    deletingPlan?.type === "book"
      ? "删除全书规划"
      : deletingPlan?.type === "volume"
        ? "删除卷规划"
        : "删除阶段弧线";
  const deleteDescription =
    deletingPlan?.type === "book"
      ? "删除后会同时移除该全书规划下的卷规划和阶段弧线。"
      : deletingPlan?.type === "volume"
        ? "删除后会同时移除该卷下的阶段弧线。"
        : "删除后会从当前卷规划中移除这条阶段弧线。";

  return (
    <div className="module-stack book-outline-workspace">
      <ModuleHeader eyebrow="6 / 9" title="全书大纲" />
      <div className="book-outline-primary">
        <section aria-label="大纲层级列表" className="book-outline-pane book-outline-tier-list">
          <header className="book-outline-pane__header">
            <Title level={5}>大纲层级</Title>
            <Space size={6}>
              <Tag>{creativePath.bookPlans.length} 本</Tag>
              <Tag>{creativePath.volumePlans.length} 卷</Tag>
              <Tag>{creativePath.arcPlans.length} 弧线</Tag>
            </Space>
          </header>
          <BookOutlineTierGroupV2
            emptyText="暂无全书计划"
            items={creativePath.bookPlans}
            renderActions={(plan) => (
              <BookOutlineRowActionsV2
                deleteLabel={`删除全书规划 ${plan.title}`}
                editLabel={`编辑全书规划 ${plan.title}`}
                extraLabel={`新增卷 ${plan.title}`}
                onDelete={() => setDeletingPlan({ plan, type: "book" })}
                onEdit={() => setOutlineModal({ bookPlanId: plan.id, type: "book" })}
                onExtra={() => setOutlineModal({ bookPlanId: plan.id, type: "volume" })}
              />
            )}
            renderMeta={(plan) => formatPlanWordCount(plan.targetWordCount)}
            renderTitle={(plan) => plan.title}
            selectedId={selectedBookPlan?.id ?? null}
            title="全书计划"
            toSelectAriaLabel={(plan) => `查看全书规划 ${plan.title}`}
            onSelect={handleSelectBookPlan}
          />
          <BookOutlineTierGroupV2
            emptyText="暂无卷规划"
            items={visibleVolumePlans}
            renderActions={(plan) => (
              <BookOutlineRowActionsV2
                deleteLabel={`删除卷规划 ${plan.title}`}
                editLabel={`编辑卷规划 ${plan.title}`}
                extraLabel={`新增阶段弧线 ${plan.title}`}
                onDelete={() => setDeletingPlan({ plan, type: "volume" })}
                onEdit={() => setOutlineModal({ type: "volume", volumePlanId: plan.id })}
                onExtra={() => setOutlineModal({ type: "arc", volumePlanId: plan.id })}
              />
            )}
            renderMeta={(plan) =>
              `${OUTLINE_PLAN_STATUS_LABELS[plan.status as SaveBookPlanDraftValues["status"]] ?? plan.status} · ${formatPlanWordCount(plan.targetWordCount)}`
            }
            renderTitle={(plan) => `${plan.volumeIndex}. ${plan.title}`}
            selectedId={selectedVolumePlan?.id ?? null}
            title="卷规划"
            toSelectAriaLabel={(plan) => `查看卷规划 ${plan.title}`}
            onSelect={handleSelectVolumePlan}
          />
          <BookOutlineTierGroupV2
            emptyText="暂无阶段弧线"
            items={visibleArcPlans}
            renderActions={(plan) => (
              <BookOutlineRowActionsV2
                deleteLabel={`删除阶段弧线 ${plan.title}`}
                editLabel={`编辑阶段弧线 ${plan.title}`}
                onDelete={() => setDeletingPlan({ plan, type: "arc" })}
                onEdit={() => setOutlineModal({ arcPlanId: plan.id, type: "arc" })}
              />
            )}
            renderMeta={(plan) => `第 ${plan.arcIndex} 段 · ${plan.escalation.length} 个升级点`}
            renderTitle={(plan) => plan.title}
            selectedId={selectedArcPlan?.id ?? null}
            title="阶段弧线"
            toSelectAriaLabel={(plan) => `查看阶段弧线 ${plan.title}`}
            onSelect={handleSelectArcPlan}
          />
        </section>

        <section aria-label="大纲详情" className="book-outline-pane book-outline-detail">
          <header className="book-outline-pane__header">
            <Title level={5}>
              {selectedArcPlan
                ? "阶段弧线详情"
                : selectedVolumePlan
                  ? "卷规划详情"
                  : selectedBookPlan
                    ? "全书规划详情"
                    : "大纲总览"}
            </Title>
            <Space size={8} wrap>
              <Button
                aria-label="新建全书规划"
                icon={<PlusOutlined />}
                onClick={() => setOutlineModal({ type: "book" })}
              >
                新建全书
              </Button>
              <Button
                aria-label="AI 生成全书规划"
                icon={<ThunderboltOutlined />}
                onClick={() => setOutlineModal({ type: "generate" })}
                type="primary"
              >
                AI 生成全书规划
              </Button>
              {selectedBookPlan ? (
                <Button
                  aria-label="新增当前全书的卷规划"
                  icon={<PlusOutlined />}
                  onClick={() =>
                    setOutlineModal({ bookPlanId: selectedBookPlan.id, type: "volume" })
                  }
                >
                  新增卷
                </Button>
              ) : null}
              {selectedVolumePlan ? (
                <Button
                  aria-label="新增当前卷的阶段弧线"
                  icon={<PlusOutlined />}
                  onClick={() =>
                    setOutlineModal({ type: "arc", volumePlanId: selectedVolumePlan.id })
                  }
                >
                  新增弧线
                </Button>
              ) : null}
              <Button
                aria-label="编辑当前大纲"
                disabled={!selectedBookPlan && !selectedVolumePlan && !selectedArcPlan}
                icon={<EditOutlined />}
                onClick={() => {
                  if (selectedArcPlan) {
                    setOutlineModal({ arcPlanId: selectedArcPlan.id, type: "arc" });
                    return;
                  }
                  if (selectedVolumePlan) {
                    setOutlineModal({ type: "volume", volumePlanId: selectedVolumePlan.id });
                    return;
                  }
                  if (selectedBookPlan) {
                    setOutlineModal({ bookPlanId: selectedBookPlan.id, type: "book" });
                  }
                }}
              >
                编辑
              </Button>
              <Button
                aria-label="删除当前大纲"
                danger
                disabled={!selectedBookPlan && !selectedVolumePlan && !selectedArcPlan}
                icon={<DeleteOutlined />}
                onClick={() => {
                  if (selectedArcPlan) {
                    setDeletingPlan({ plan: selectedArcPlan, type: "arc" });
                    return;
                  }
                  if (selectedVolumePlan) {
                    setDeletingPlan({ plan: selectedVolumePlan, type: "volume" });
                    return;
                  }
                  if (selectedBookPlan) {
                    setDeletingPlan({ plan: selectedBookPlan, type: "book" });
                  }
                }}
              >
                删除
              </Button>
            </Space>
          </header>
          <BookOutlineDetailBody
            bookPlan={selectedBookPlan}
            plotlines={plotlines}
            selectedArcPlan={selectedArcPlan}
            selectedVolumePlan={selectedVolumePlan}
            volumePlans={creativePath.volumePlans}
          />
        </section>
      </div>

      {outlineModal?.type === "book" ? (
        <Modal
          className="creative-form-modal"
          footer={null}
          onCancel={closeOutlineModal}
          open
          title={
            outlineModal.bookPlanId && editingBookPlan
              ? `编辑全书规划：${editingBookPlan.title}`
              : "新建全书规划"
          }
          width={760}
        >
          <Form form={bookForm} layout="vertical" onFinish={handleSaveBookPlan}>
            <BookPlanFieldsV2 plotlineOptions={plotlineOptions} />
            <BookOutlineModalActionsV2 submitLabel="保存全书规划" onCancel={closeOutlineModal} />
          </Form>
        </Modal>
      ) : null}

      {outlineModal?.type === "volume" ? (
        <Modal
          className="creative-form-modal"
          footer={null}
          onCancel={closeOutlineModal}
          open
          title={
            outlineModal.volumePlanId && editingVolumePlan
              ? `编辑卷规划：${editingVolumePlan.title}`
              : "新建卷规划"
          }
          width={760}
        >
          <Form form={volumeForm} layout="vertical" onFinish={handleSaveVolumePlan}>
            <VolumePlanFieldsV2 bookPlanOptions={bookPlanOptions} />
            <BookOutlineModalActionsV2 submitLabel="保存卷规划" onCancel={closeOutlineModal} />
          </Form>
        </Modal>
      ) : null}

      {outlineModal?.type === "arc" ? (
        <Modal
          className="creative-form-modal"
          footer={null}
          onCancel={closeOutlineModal}
          open
          title={
            outlineModal.arcPlanId && editingArcPlan
              ? `编辑阶段弧线：${editingArcPlan.title}`
              : "新建阶段弧线"
          }
          width={760}
        >
          <Form form={arcForm} layout="vertical" onFinish={handleSaveArcPlan}>
            <ArcPlanFieldsV2
              plotlineOptions={plotlineOptions}
              volumePlanOptions={volumePlanOptions}
            />
            <BookOutlineModalActionsV2 submitLabel="保存阶段弧线" onCancel={closeOutlineModal} />
          </Form>
        </Modal>
      ) : null}

      {outlineModal?.type === "generate" ? (
        <Modal
          className="creative-form-modal"
          footer={null}
          onCancel={closeOutlineModal}
          open
          title="AI 生成全书规划"
          width={640}
        >
          <Form
            form={generateForm}
            layout="vertical"
            onFinish={async (values) => {
              await onGenerateBookPlan({
                targetWordCount: values.targetWordCount ?? 800_000,
                volumeCount: values.volumeCount ?? 6,
              });
              closeOutlineModal();
            }}
          >
            <div className="book-outline-form-grid book-outline-form-grid--single">
              <Form.Item label="生成目标字数" name="targetWordCount">
                <InputNumber
                  aria-label="生成目标字数"
                  max={10_000_000}
                  min={100_000}
                  step={100_000}
                />
              </Form.Item>
              <Form.Item label="生成预计卷数" name="volumeCount">
                <InputNumber aria-label="生成预计卷数" max={30} min={1} />
              </Form.Item>
            </div>
            <BookOutlineModalActionsV2
              icon={<ThunderboltOutlined />}
              submitLabel="生成全书规划"
              onCancel={closeOutlineModal}
            />
          </Form>
        </Modal>
      ) : null}

      {deletingPlan ? (
        <Modal
          cancelText="取消"
          okButtonProps={{ danger: true }}
          okText="确认删除"
          onCancel={() => setDeletingPlan(null)}
          onOk={handleConfirmDelete}
          open
          title={deleteTitle}
        >
          <Text>{deleteDescription}</Text>
        </Modal>
      ) : null}
    </div>
  );
}

function BookOutlineTierGroupV2<TItem extends { readonly id: string }>({
  emptyText,
  items,
  onSelect,
  renderActions,
  renderMeta,
  renderTitle,
  selectedId,
  title,
  toSelectAriaLabel,
}: {
  readonly emptyText: string;
  readonly items: readonly TItem[];
  readonly selectedId: string | null;
  readonly title: string;
  renderActions(item: TItem): ReactNode;
  renderMeta(item: TItem): string;
  renderTitle(item: TItem): string;
  toSelectAriaLabel(item: TItem): string;
  onSelect(item: TItem): void;
}) {
  return (
    <section className="book-outline-tier-list__section">
      <header>
        <Text strong>{title}</Text>
        <Tag>{items.length}</Tag>
      </header>
      {items.length === 0 ? (
        <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <ul className="book-outline-tier-list__items">
          {items.map((item) => (
            <li key={item.id}>
              <article
                className={[
                  "book-outline-tier-list__item",
                  selectedId === item.id ? "book-outline-tier-list__item--selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <button
                  aria-label={toSelectAriaLabel(item)}
                  className="book-outline-tier-list__select"
                  type="button"
                  onClick={() => onSelect(item)}
                >
                  <strong>{renderTitle(item)}</strong>
                  <span>{renderMeta(item)}</span>
                </button>
                <div className="book-outline-tier-list__actions">{renderActions(item)}</div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BookOutlineRowActionsV2({
  deleteLabel,
  editLabel,
  extraLabel,
  onDelete,
  onEdit,
  onExtra,
}: {
  readonly deleteLabel: string;
  readonly editLabel: string;
  readonly extraLabel?: string;
  onDelete(): void;
  onEdit(): void;
  onExtra?(): void;
}) {
  return (
    <Space size={2}>
      {extraLabel && onExtra ? (
        <Tooltip title="新增下级">
          <Button
            aria-label={extraLabel}
            icon={<PlusOutlined />}
            size="small"
            type="text"
            onClick={onExtra}
          />
        </Tooltip>
      ) : null}
      <Tooltip title="编辑">
        <Button
          aria-label={editLabel}
          icon={<EditOutlined />}
          size="small"
          type="text"
          onClick={onEdit}
        />
      </Tooltip>
      <Tooltip title="删除">
        <Button
          aria-label={deleteLabel}
          danger
          icon={<DeleteOutlined />}
          size="small"
          type="text"
          onClick={onDelete}
        />
      </Tooltip>
    </Space>
  );
}

function BookOutlineDetailBody({
  bookPlan,
  plotlines,
  selectedArcPlan,
  selectedVolumePlan,
  volumePlans,
}: {
  readonly bookPlan: BookPlanItem | null;
  readonly plotlines: readonly PlotlineElement[];
  readonly selectedArcPlan: ArcPlanItem | null;
  readonly selectedVolumePlan: VolumePlanItem | null;
  readonly volumePlans: readonly VolumePlanItem[];
}) {
  if (selectedArcPlan) {
    const volumePlan = volumePlans.find((plan) => plan.id === selectedArcPlan.volumePlanId) ?? null;
    const plotline = plotlines.find((item) => item.id === selectedArcPlan.plotlineId) ?? null;

    return (
      <div className="book-outline-detail__body">
        <div className="book-outline-detail__title-row">
          <Title level={4}>{selectedArcPlan.title}</Title>
          <Tag>
            {OUTLINE_PLAN_STATUS_LABELS[
              selectedArcPlan.status as SaveBookPlanDraftValues["status"]
            ] ?? selectedArcPlan.status}
          </Tag>
        </div>
        <dl className="book-outline-detail-list">
          <BookOutlineDetailItem label="所属卷" value={volumePlan?.title ?? "未关联"} />
          <BookOutlineDetailItem label="弧线序号" value={`第 ${selectedArcPlan.arcIndex} 段`} />
          <BookOutlineDetailItem label="章节范围" value={formatChapterRange(selectedArcPlan)} />
          <BookOutlineDetailItem label="关联故事线" value={plotline?.name ?? "未关联"} />
          <BookOutlineDetailItem label="弧线作用" value={selectedArcPlan.purpose} wide />
          <BookOutlineDetailItem
            label="升级链"
            value={
              selectedArcPlan.escalation.length > 0 ? (
                <ol className="book-outline-detail-list__ordered">
                  {selectedArcPlan.escalation.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ol>
              ) : (
                "未填写"
              )
            }
            wide
          />
        </dl>
      </div>
    );
  }

  if (selectedVolumePlan) {
    return (
      <div className="book-outline-detail__body">
        <div className="book-outline-detail__title-row">
          <Title level={4}>
            {selectedVolumePlan.volumeIndex}. {selectedVolumePlan.title}
          </Title>
          <Tag>
            {OUTLINE_PLAN_STATUS_LABELS[
              selectedVolumePlan.status as SaveBookPlanDraftValues["status"]
            ] ?? selectedVolumePlan.status}
          </Tag>
        </div>
        <dl className="book-outline-detail-list">
          <BookOutlineDetailItem
            label="目标字数"
            value={formatPlanWordCount(selectedVolumePlan.targetWordCount)}
          />
          <BookOutlineDetailItem label="叙事任务" value={selectedVolumePlan.purpose} wide />
          <BookOutlineDetailItem label="核心冲突" value={selectedVolumePlan.majorConflict} wide />
          <BookOutlineDetailItem
            label="卷末高潮"
            value={selectedVolumePlan.climax ?? "未填写"}
            wide
          />
        </dl>
      </div>
    );
  }

  if (bookPlan) {
    const mainPlotline = plotlines.find((plotline) => plotline.id === bookPlan.mainPlotlineId);

    return (
      <div className="book-outline-detail__body">
        <div className="book-outline-detail__title-row">
          <Title level={4}>{bookPlan.title}</Title>
          <Tag>
            {OUTLINE_PLAN_STATUS_LABELS[bookPlan.status as SaveBookPlanDraftValues["status"]] ??
              bookPlan.status}
          </Tag>
        </div>
        <dl className="book-outline-detail-list">
          <BookOutlineDetailItem
            label="目标字数"
            value={formatPlanWordCount(bookPlan.targetWordCount)}
          />
          <BookOutlineDetailItem label="主故事线" value={mainPlotline?.name ?? "未关联"} />
          <BookOutlineDetailItem label="核心承诺" value={bookPlan.corePromise} wide />
          <BookOutlineDetailItem
            label="结局方向"
            value={bookPlan.endingDirection ?? "未填写"}
            wide
          />
        </dl>
      </div>
    );
  }

  return (
    <div className="book-outline-detail__empty">
      <Empty description="暂无大纲规划" image={Empty.PRESENTED_IMAGE_SIMPLE} />
    </div>
  );
}

function BookOutlineDetailItem({
  label,
  value,
  wide = false,
}: {
  readonly label: string;
  readonly value: ReactNode;
  readonly wide?: boolean;
}) {
  return (
    <div
      className={
        wide
          ? "book-outline-detail-list__item book-outline-detail-list__item--wide"
          : "book-outline-detail-list__item"
      }
    >
      <dt>{label}</dt>
      <dd>{isEmptyDetailValue(value) ? <Text type="secondary">未填写</Text> : value}</dd>
    </div>
  );
}

function BookPlanFieldsV2({
  plotlineOptions,
}: {
  readonly plotlineOptions: ReadonlyArray<{ readonly label: string; readonly value: string }>;
}) {
  return (
    <div className="book-outline-form-grid book-outline-form-grid--single">
      <Form.Item
        label="全书标题"
        name="title"
        rules={[{ message: "请输入全书标题", required: true }]}
      >
        <Input aria-label="全书标题" maxLength={120} placeholder="如：布衣天子全书大纲" />
      </Form.Item>
      <Form.Item
        label={
          <FieldLabelWithHelp
            description={BOOK_PLAN_FIELD_HELP.targetWordCount.description}
            label="目标字数"
            question={BOOK_PLAN_FIELD_HELP.targetWordCount.question}
          />
        }
        name="targetWordCount"
        rules={[{ message: "请输入目标字数", required: true }]}
      >
        <InputNumber aria-label="目标字数" max={10_000_000} min={100_000} step={100_000} />
      </Form.Item>
      <Form.Item
        label={
          <FieldLabelWithHelp
            description={BOOK_PLAN_FIELD_HELP.mainPlotlineId.description}
            label="主故事线"
            question={BOOK_PLAN_FIELD_HELP.mainPlotlineId.question}
          />
        }
        name="mainPlotlineId"
      >
        <Select
          allowClear
          aria-label="主故事线"
          options={[...plotlineOptions]}
          placeholder="选择主故事线"
        />
      </Form.Item>
      <Form.Item label="状态" name="status">
        <Select aria-label="全书状态" options={OUTLINE_PLAN_STATUS_OPTIONS} />
      </Form.Item>
      <Form.Item
        label={
          <FieldLabelWithHelp
            description={BOOK_PLAN_FIELD_HELP.corePromise.description}
            label="核心承诺"
            question={BOOK_PLAN_FIELD_HELP.corePromise.question}
          />
        }
        name="corePromise"
        rules={[{ message: "请输入核心承诺", required: true }]}
      >
        <Input.TextArea
          aria-label="核心承诺"
          autoSize={{ maxRows: 6, minRows: 3 }}
          maxLength={800}
          placeholder="如：每卷一次公开胜利和一次隐藏损失。"
          showCount
        />
      </Form.Item>
      <Form.Item
        label={
          <FieldLabelWithHelp
            description={BOOK_PLAN_FIELD_HELP.endingDirection.description}
            label="结局方向"
            question={BOOK_PLAN_FIELD_HELP.endingDirection.question}
          />
        }
        name="endingDirection"
      >
        <Input.TextArea
          aria-label="结局方向"
          autoSize={{ maxRows: 5, minRows: 2 }}
          maxLength={800}
          placeholder="如：公开真相后，主角放弃旧身份。"
          showCount
        />
      </Form.Item>
    </div>
  );
}

function VolumePlanFieldsV2({
  bookPlanOptions,
}: {
  readonly bookPlanOptions: ReadonlyArray<{ readonly label: string; readonly value: string }>;
}) {
  return (
    <div className="book-outline-form-grid book-outline-form-grid--single">
      <Form.Item
        label="所属全书规划"
        name="bookPlanId"
        rules={[{ message: "请先选择全书规划", required: true }]}
      >
        <Select
          aria-label="所属全书规划"
          disabled={bookPlanOptions.length === 0}
          options={[...bookPlanOptions]}
        />
      </Form.Item>
      <Form.Item
        label="卷序号"
        name="volumeIndex"
        rules={[{ message: "请输入卷序号", required: true }]}
      >
        <InputNumber aria-label="卷序号" max={100} min={1} />
      </Form.Item>
      <Form.Item label="卷标题" name="title" rules={[{ message: "请输入卷标题", required: true }]}>
        <Input aria-label="卷标题" maxLength={120} placeholder="如：第一卷 寒门入局" />
      </Form.Item>
      <Form.Item
        label={
          <FieldLabelWithHelp
            description={VOLUME_PLAN_FIELD_HELP.targetWordCount.description}
            label="卷目标字数"
            question={VOLUME_PLAN_FIELD_HELP.targetWordCount.question}
          />
        }
        name="targetWordCount"
        rules={[{ message: "请输入卷目标字数", required: true }]}
      >
        <InputNumber aria-label="卷目标字数" max={2_000_000} min={10_000} step={10_000} />
      </Form.Item>
      <Form.Item
        label={
          <FieldLabelWithHelp
            description={VOLUME_PLAN_FIELD_HELP.purpose.description}
            label="卷叙事任务"
            question={VOLUME_PLAN_FIELD_HELP.purpose.question}
          />
        }
        name="purpose"
        rules={[{ message: "请输入卷叙事任务", required: true }]}
      >
        <Input.TextArea
          aria-label="卷叙事任务"
          autoSize={{ maxRows: 5, minRows: 2 }}
          maxLength={800}
          placeholder="如：完成身份压迫、入局动机和第一次公开胜利。"
          showCount
        />
      </Form.Item>
      <Form.Item
        label={
          <FieldLabelWithHelp
            description={VOLUME_PLAN_FIELD_HELP.majorConflict.description}
            label="卷核心冲突"
            question={VOLUME_PLAN_FIELD_HELP.majorConflict.question}
          />
        }
        name="majorConflict"
        rules={[{ message: "请输入卷核心冲突", required: true }]}
      >
        <Input.TextArea
          aria-label="卷核心冲突"
          autoSize={{ maxRows: 5, minRows: 2 }}
          maxLength={800}
          placeholder="如：寒门新官必须用民案撬动旧贵族封锁。"
          showCount
        />
      </Form.Item>
      <Form.Item
        label={
          <FieldLabelWithHelp
            description={VOLUME_PLAN_FIELD_HELP.climax.description}
            label="卷末高潮"
            question={VOLUME_PLAN_FIELD_HELP.climax.question}
          />
        }
        name="climax"
      >
        <Input.TextArea
          aria-label="卷末高潮"
          autoSize={{ maxRows: 5, minRows: 2 }}
          maxLength={800}
          placeholder="如：主角在公堂反杀第一次构陷。"
          showCount
        />
      </Form.Item>
      <Form.Item label="卷状态" name="status">
        <Select aria-label="卷状态" options={OUTLINE_PLAN_STATUS_OPTIONS} />
      </Form.Item>
    </div>
  );
}

function ArcPlanFieldsV2({
  plotlineOptions,
  volumePlanOptions,
}: {
  readonly plotlineOptions: ReadonlyArray<{ readonly label: string; readonly value: string }>;
  readonly volumePlanOptions: ReadonlyArray<{ readonly label: string; readonly value: string }>;
}) {
  return (
    <>
      <Form.Item hidden name="characterArcId">
        <Input aria-label="关联人物弧线" />
      </Form.Item>
      <div className="book-outline-form-grid book-outline-form-grid--single">
        <Form.Item
          label="所属卷规划"
          name="volumePlanId"
          rules={[{ message: "请先选择卷规划", required: true }]}
        >
          <Select
            aria-label="所属卷规划"
            disabled={volumePlanOptions.length === 0}
            options={[...volumePlanOptions]}
          />
        </Form.Item>
        <Form.Item
          label="弧线序号"
          name="arcIndex"
          rules={[{ message: "请输入弧线序号", required: true }]}
        >
          <InputNumber aria-label="弧线序号" max={300} min={1} />
        </Form.Item>
        <Form.Item
          label="弧线标题"
          name="title"
          rules={[{ message: "请输入弧线标题", required: true }]}
        >
          <Input aria-label="弧线标题" maxLength={120} placeholder="如：旧案破口" />
        </Form.Item>
        <Form.Item
          label={
            <FieldLabelWithHelp
              description={ARC_PLAN_FIELD_HELP.plotlineId.description}
              label="关联故事线"
              question={ARC_PLAN_FIELD_HELP.plotlineId.question}
            />
          }
          name="plotlineId"
        >
          <Select
            allowClear
            aria-label="关联故事线"
            options={[...plotlineOptions]}
            placeholder="选择故事线"
          />
        </Form.Item>
        <Form.Item
          label={
            <FieldLabelWithHelp
              description={ARC_PLAN_FIELD_HELP.chapterRange.description}
              label="起始章节"
              question={ARC_PLAN_FIELD_HELP.chapterRange.question}
            />
          }
          name="startChapterIndex"
        >
          <InputNumber aria-label="起始章节" min={1} />
        </Form.Item>
        <Form.Item label="结束章节" name="endChapterIndex">
          <InputNumber aria-label="结束章节" min={1} />
        </Form.Item>
        <Form.Item label="弧线状态" name="status">
          <Select aria-label="弧线状态" options={OUTLINE_PLAN_STATUS_OPTIONS} />
        </Form.Item>
        <Form.Item
          label={
            <FieldLabelWithHelp
              description={ARC_PLAN_FIELD_HELP.purpose.description}
              label="弧线作用"
              question={ARC_PLAN_FIELD_HELP.purpose.question}
            />
          }
          name="purpose"
          rules={[{ message: "请输入弧线作用", required: true }]}
        >
          <Input.TextArea
            aria-label="弧线作用"
            autoSize={{ maxRows: 5, minRows: 2 }}
            maxLength={800}
            placeholder="如：让主角从被动受害转为主动查案。"
            showCount
          />
        </Form.Item>
        <Form.Item
          label={
            <FieldLabelWithHelp
              description={ARC_PLAN_FIELD_HELP.escalation.description}
              label="升级链"
              question={ARC_PLAN_FIELD_HELP.escalation.question}
            />
          }
          name="escalationText"
        >
          <Input.TextArea
            aria-label="升级链"
            autoSize={{ maxRows: 8, minRows: 4 }}
            maxLength={1200}
            placeholder={"旧案开场\n证人失踪\n公堂反杀"}
          />
        </Form.Item>
      </div>
    </>
  );
}

function BookOutlineModalActionsV2({
  icon,
  onCancel,
  submitLabel,
}: {
  readonly icon?: ReactNode;
  readonly submitLabel: string;
  onCancel(): void;
}) {
  return (
    <Space className="book-outline-modal-actions" wrap>
      <Button
        aria-label={submitLabel}
        htmlType="submit"
        icon={icon ?? <SaveOutlined />}
        type="primary"
      >
        {submitLabel}
      </Button>
      <Button aria-label="取消" onClick={onCancel}>
        取消
      </Button>
    </Space>
  );
}

function formatChapterRange(plan: ArcPlanItem): string {
  if (plan.startChapterIndex && plan.endChapterIndex) {
    return `第 ${plan.startChapterIndex} - ${plan.endChapterIndex} 章`;
  }
  if (plan.startChapterIndex) {
    return `第 ${plan.startChapterIndex} 章起`;
  }
  if (plan.endChapterIndex) {
    return `截至第 ${plan.endChapterIndex} 章`;
  }
  return "未设置";
}

function isEmptyDetailValue(value: ReactNode): boolean {
  return typeof value === "string" && value.trim().length === 0;
}

type PlotNodeSelection =
  | { readonly eventId: string; readonly type: "event" }
  | { readonly foreshadowingId: string; readonly type: "foreshadowing" };

type PlotNodeModalState =
  | { readonly eventId?: string; readonly type: "event" }
  | { readonly foreshadowingId?: string; readonly type: "foreshadowing" }
  | { readonly type: "assistant" };

function PlotNodesModule({
  chapters,
  characters,
  foreshadowings,
  onCreateForeshadowing,
  onCreateStoryEvent,
  onPlanForeshadowing,
  onSavePlotDebt,
  onUpdateForeshadowing,
  onUpdateStoryEvent,
  plotDebts,
  plotlines,
  storyEvents,
  worldRules,
}: {
  readonly chapters: readonly WorkbenchChapter[];
  readonly characters: readonly CharacterElement[];
  readonly foreshadowings: readonly ForeshadowingElement[];
  readonly plotDebts: readonly PlotDebtItem[];
  readonly plotlines: readonly PlotlineElement[];
  readonly storyEvents: readonly StoryEventElement[];
  readonly worldRules: readonly WorldRuleElement[];
  onCreateForeshadowing(input: CreateForeshadowingValues): Promise<void> | void;
  onCreateStoryEvent(input: CreateStoryEventValues): Promise<void> | void;
  onPlanForeshadowing(input: PlanForeshadowingValues): Promise<void> | void;
  onSavePlotDebt(input: SavePlotDebtValues): Promise<void> | void;
  onUpdateForeshadowing(input: UpdateForeshadowingValues): Promise<void> | void;
  onUpdateStoryEvent(input: UpdateStoryEventValues): Promise<void> | void;
}) {
  const [eventForm] = Form.useForm<StoryEventFormValues>();
  const [foreshadowingForm] = Form.useForm<ForeshadowingFormValues>();
  const [assistantForm] = Form.useForm<PlanForeshadowingValues>();
  const [plotDebtForm] = Form.useForm<PlotDebtFormValues>();
  const [plotNodeModal, setPlotNodeModal] = useState<PlotNodeModalState | null>(null);
  const [editingPlotDebtId, setEditingPlotDebtId] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<PlotNodeSelection | null>(() =>
    storyEvents[0]
      ? { eventId: storyEvents[0].id, type: "event" }
      : foreshadowings[0]
        ? { foreshadowingId: foreshadowings[0].id, type: "foreshadowing" }
        : null,
  );

  const effectiveSelection =
    selectedTarget?.type === "event" &&
    storyEvents.some((event) => event.id === selectedTarget.eventId)
      ? selectedTarget
      : selectedTarget?.type === "foreshadowing" &&
          foreshadowings.some(
            (foreshadowing) => foreshadowing.id === selectedTarget.foreshadowingId,
          )
        ? selectedTarget
        : storyEvents[0]
          ? { eventId: storyEvents[0].id, type: "event" }
          : foreshadowings[0]
            ? { foreshadowingId: foreshadowings[0].id, type: "foreshadowing" }
            : null;
  const selectedEventId =
    effectiveSelection?.type === "event" ? effectiveSelection.eventId : undefined;
  const selectedForeshadowingId =
    effectiveSelection?.type === "foreshadowing" ? effectiveSelection.foreshadowingId : undefined;
  const selectedEvent = storyEvents.find((event) => event.id === selectedEventId);
  const selectedForeshadowing = foreshadowings.find(
    (foreshadowing) => foreshadowing.id === selectedForeshadowingId,
  );
  const editingEvent =
    plotNodeModal?.type === "event" && plotNodeModal.eventId
      ? storyEvents.find((event) => event.id === plotNodeModal.eventId)
      : undefined;
  const editingForeshadowing =
    plotNodeModal?.type === "foreshadowing" && plotNodeModal.foreshadowingId
      ? foreshadowings.find((foreshadowing) => foreshadowing.id === plotNodeModal.foreshadowingId)
      : undefined;
  const chapterOptions = useMemo(
    () => chapters.map((chapter) => ({ label: chapter.title, value: chapter.id })),
    [chapters],
  );
  const characterOptions = useMemo(
    () => characters.map((character) => ({ label: character.name, value: character.id })),
    [characters],
  );
  const storyEventOptions = useMemo(
    () => storyEvents.map((event) => ({ label: event.title, value: event.id })),
    [storyEvents],
  );
  const foreshadowingOptions = useMemo(
    () =>
      foreshadowings.map((foreshadowing) => ({
        label: foreshadowing.title,
        value: foreshadowing.id,
      })),
    [foreshadowings],
  );
  const plotlineOptions = useMemo(
    () => plotlines.map((plotline) => ({ label: plotline.name, value: plotline.id })),
    [plotlines],
  );
  const worldRuleOptions = useMemo(
    () => worldRules.map((rule) => ({ label: rule.title, value: rule.id })),
    [worldRules],
  );
  const editingPlotDebt =
    editingPlotDebtId === null
      ? null
      : (plotDebts.find((plotDebt) => plotDebt.id === editingPlotDebtId) ?? null);

  useLayoutEffect(() => {
    if (plotNodeModal?.type !== "event") {
      return;
    }
    eventForm.resetFields();
    eventForm.setFieldsValue(
      editingEvent
        ? storyEventToFormValues(editingEvent)
        : {
            ...STORY_EVENT_FORM_DEFAULTS,
            chapterId: undefined,
            description: "",
            storyTime: "",
            title: "",
          },
    );
  }, [editingEvent, eventForm, plotNodeModal]);

  useLayoutEffect(() => {
    if (plotNodeModal?.type !== "foreshadowing") {
      return;
    }
    foreshadowingForm.resetFields();
    foreshadowingForm.setFieldsValue(
      editingForeshadowing
        ? foreshadowingToFormValues(editingForeshadowing)
        : {
            ...FORESHADOWING_FORM_DEFAULTS,
            description: "",
            payoffEventId: undefined,
            payoffExpectation: "",
            seedEventId: undefined,
            title: "",
          },
    );
  }, [editingForeshadowing, foreshadowingForm, plotNodeModal]);

  useLayoutEffect(() => {
    if (plotNodeModal?.type !== "assistant") {
      return;
    }
    assistantForm.resetFields();
  }, [assistantForm, plotNodeModal]);

  const closePlotNodeModal = () => setPlotNodeModal(null);
  const closePlotDebtModal = () => {
    setEditingPlotDebtId(null);
    plotDebtForm.resetFields();
    plotDebtForm.setFieldsValue(PLOT_DEBT_FORM_DEFAULTS);
  };

  useLayoutEffect(() => {
    if (editingPlotDebtId === null) {
      return;
    }
    plotDebtForm.resetFields();
    plotDebtForm.setFieldsValue(
      editingPlotDebt ? plotDebtToFormValues(editingPlotDebt) : PLOT_DEBT_FORM_DEFAULTS,
    );
  }, [editingPlotDebt, editingPlotDebtId, plotDebtForm]);

  const openCreatePlotDebtModal = () => {
    plotDebtForm.resetFields();
    plotDebtForm.setFieldsValue(PLOT_DEBT_FORM_DEFAULTS);
    setEditingPlotDebtId("");
  };

  const openEditPlotDebtModal = (plotDebt: PlotDebtItem) => {
    setEditingPlotDebtId(plotDebt.id);
  };

  const handleSaveStoryEvent = async (values: StoryEventFormValues) => {
    const normalized = normalizeStoryEventFormValues(values);

    if (plotNodeModal?.type === "event" && plotNodeModal.eventId) {
      await onUpdateStoryEvent({
        patch: storyEventFormValuesToPatch(normalized),
        storyEventId: plotNodeModal.eventId,
      });
      closePlotNodeModal();
      return;
    }

    await onCreateStoryEvent(storyEventFormValuesToCreateInput(normalized));
    closePlotNodeModal();
  };

  const handleSaveForeshadowing = async (values: ForeshadowingFormValues) => {
    const normalized = normalizeForeshadowingFormValues(values);

    if (plotNodeModal?.type === "foreshadowing" && plotNodeModal.foreshadowingId) {
      await onUpdateForeshadowing({
        foreshadowingId: plotNodeModal.foreshadowingId,
        patch: foreshadowingFormValuesToPatch(normalized),
      });
      closePlotNodeModal();
      return;
    }

    await onCreateForeshadowing(foreshadowingFormValuesToCreateInput(normalized));
    closePlotNodeModal();
  };

  const handleSavePlotDebt = async (values: PlotDebtFormValues) => {
    await onSavePlotDebt(plotDebtFormValuesToSaveInput(values, editingPlotDebt?.id));
    closePlotDebtModal();
  };

  return (
    <div className="module-stack plot-node-design-workspace">
      <ModuleHeader eyebrow="7 / 9" title="剧情节点设计" />
      <div className="plot-node-design-primary">
        <section
          aria-label="剧情节点列表面板"
          className="plot-node-design-pane plot-node-design-list"
        >
          <header className="plot-node-design-pane__header">
            <Title level={5}>节点与伏笔</Title>
            <Text type="secondary">{storyEvents.length + foreshadowings.length} 项</Text>
          </header>
          <div className="plot-node-roster-group">
            <header>
              <Text strong>剧情节点</Text>
              <Text type="secondary">{storyEvents.length} 个</Text>
            </header>
            <PlotNodeEventList
              events={storyEvents}
              selectedEventId={selectedEventId}
              onEditEvent={(eventId) => setPlotNodeModal({ eventId, type: "event" })}
              onSelectEvent={(eventId) => setSelectedTarget({ eventId, type: "event" })}
            />
          </div>
          <div className="plot-node-roster-group">
            <header>
              <Text strong>伏笔池</Text>
              <Text type="secondary">{foreshadowings.length} 条</Text>
            </header>
            <PlotNodeForeshadowingList
              foreshadowings={foreshadowings}
              selectedForeshadowingId={selectedForeshadowingId}
              onEditForeshadowing={(foreshadowingId) =>
                setPlotNodeModal({ foreshadowingId, type: "foreshadowing" })
              }
              onSelectForeshadowing={(foreshadowingId) =>
                setSelectedTarget({ foreshadowingId, type: "foreshadowing" })
              }
            />
          </div>
        </section>

        <section
          aria-label="剧情节点详情面板"
          className="plot-node-design-pane plot-node-design-detail"
        >
          <header className="plot-node-design-pane__header">
            <div>
              <Title level={5}>{selectedForeshadowing ? "伏笔详情" : "剧情节点详情"}</Title>
              <Text type="secondary">先浏览节点和伏笔，再进入弹窗处理创建或编辑。</Text>
            </div>
            <Space size={8} wrap>
              <Button
                aria-label="新建剧情节点"
                icon={<PlusOutlined />}
                onClick={() => setPlotNodeModal({ type: "event" })}
              >
                新建剧情节点
              </Button>
              <Button
                aria-label="新建伏笔"
                icon={<PlusOutlined />}
                onClick={() => setPlotNodeModal({ type: "foreshadowing" })}
              >
                新建伏笔
              </Button>
              <Button
                aria-label="AI 规划回收"
                icon={<ThunderboltOutlined />}
                onClick={() => setPlotNodeModal({ type: "assistant" })}
                type="primary"
              >
                AI 规划回收
              </Button>
              <Button
                aria-label="编辑当前节点或伏笔"
                disabled={!selectedEvent && !selectedForeshadowing}
                icon={<EditOutlined />}
                onClick={() => {
                  if (selectedEvent) {
                    setPlotNodeModal({ eventId: selectedEvent.id, type: "event" });
                    return;
                  }
                  if (selectedForeshadowing) {
                    setPlotNodeModal({
                      foreshadowingId: selectedForeshadowing.id,
                      type: "foreshadowing",
                    });
                  }
                }}
              >
                编辑
              </Button>
            </Space>
          </header>
          <PlotNodeDetailBody
            chapters={chapters}
            characters={characters}
            foreshadowings={foreshadowings}
            selectedEvent={selectedEvent}
            selectedForeshadowing={selectedForeshadowing}
            storyEvents={storyEvents}
          />
        </section>
      </div>

      <PlotDebtLedger
        plotDebts={plotDebts}
        onCreatePlotDebt={openCreatePlotDebtModal}
        onEditPlotDebt={openEditPlotDebtModal}
      />

      {plotNodeModal?.type === "event" ? (
        <Modal
          className="creative-form-modal"
          footer={null}
          onCancel={closePlotNodeModal}
          open
          title={
            plotNodeModal.eventId && editingEvent
              ? `编辑剧情节点：${editingEvent.title}`
              : "新建剧情节点"
          }
          width={760}
        >
          <Form
            form={eventForm}
            initialValues={STORY_EVENT_FORM_DEFAULTS}
            layout="vertical"
            onFinish={handleSaveStoryEvent}
          >
            <PlotNodeEventFields
              chapterOptions={chapterOptions}
              characterOptions={characterOptions}
            />
            <PlotNodeModalActions
              icon={plotNodeModal.eventId ? <SaveOutlined /> : <PlusOutlined />}
              submitLabel={plotNodeModal.eventId ? "保存剧情节点" : "创建剧情节点"}
              onCancel={closePlotNodeModal}
            />
          </Form>
        </Modal>
      ) : null}

      {plotNodeModal?.type === "foreshadowing" ? (
        <Modal
          className="creative-form-modal"
          footer={null}
          onCancel={closePlotNodeModal}
          open
          title={
            plotNodeModal.foreshadowingId && editingForeshadowing
              ? `编辑伏笔：${editingForeshadowing.title}`
              : "新建伏笔"
          }
          width={760}
        >
          <Form
            form={foreshadowingForm}
            initialValues={FORESHADOWING_FORM_DEFAULTS}
            layout="vertical"
            onFinish={handleSaveForeshadowing}
          >
            <PlotNodeForeshadowingFields storyEventOptions={storyEventOptions} />
            <PlotNodeModalActions
              icon={plotNodeModal.foreshadowingId ? <SaveOutlined /> : <PlusOutlined />}
              submitLabel={plotNodeModal.foreshadowingId ? "保存伏笔" : "创建伏笔"}
              onCancel={closePlotNodeModal}
            />
          </Form>
        </Modal>
      ) : null}

      {plotNodeModal?.type === "assistant" ? (
        <Modal
          className="creative-form-modal"
          footer={null}
          onCancel={closePlotNodeModal}
          open
          title="AI 规划回收"
          width={640}
        >
          <Form
            form={assistantForm}
            layout="vertical"
            onFinish={async (values) => {
              const chapterId = trimOptionalText(values.chapterId);
              await onPlanForeshadowing(chapterId === undefined ? {} : { chapterId });
              closePlotNodeModal();
            }}
          >
            <div className="plot-node-form-grid plot-node-form-grid--single">
              <Form.Item
                label={characterFieldLabel(
                  "章节范围",
                  "可选。指定章节后，AI 会优先为这一段设计埋设与回收。",
                )}
                name="chapterId"
              >
                <Select
                  allowClear
                  aria-label="章节范围"
                  options={chapterOptions}
                  placeholder="全书范围"
                />
              </Form.Item>
            </div>
            <PlotNodeModalActions
              icon={<ThunderboltOutlined />}
              submitLabel="生成伏笔回收方案"
              onCancel={closePlotNodeModal}
            />
          </Form>
        </Modal>
      ) : null}

      {editingPlotDebtId !== null ? (
        <Modal
          className="creative-form-modal"
          footer={null}
          onCancel={closePlotDebtModal}
          open
          title={editingPlotDebt ? `编辑剧情债：${editingPlotDebt.title}` : "新增剧情债"}
          width={820}
        >
          <Form
            form={plotDebtForm}
            initialValues={PLOT_DEBT_FORM_DEFAULTS}
            layout="vertical"
            onFinish={handleSavePlotDebt}
          >
            <PlotDebtFields
              characterOptions={characterOptions}
              foreshadowingOptions={foreshadowingOptions}
              plotlineOptions={plotlineOptions}
              worldRuleOptions={worldRuleOptions}
            />
            <PlotNodeModalActions
              icon={editingPlotDebt ? <SaveOutlined /> : <PlusOutlined />}
              submitLabel={editingPlotDebt ? "保存剧情债" : "创建剧情债"}
              onCancel={closePlotDebtModal}
            />
          </Form>
        </Modal>
      ) : null}
    </div>
  );
}

function PlotNodeEventList({
  events,
  onEditEvent,
  onSelectEvent,
  selectedEventId,
}: {
  readonly events: readonly StoryEventElement[];
  readonly selectedEventId: string | undefined;
  onEditEvent(eventId: string): void;
  onSelectEvent(eventId: string): void;
}) {
  if (events.length === 0) {
    return <Empty description="暂无剧情节点" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <ul className="plot-node-roster">
      {events.map((event) => (
        <li key={event.id}>
          <article
            className={[
              "plot-node-roster__item",
              selectedEventId === event.id ? "plot-node-roster__item--selected" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <button
              aria-label={`查看剧情节点 ${event.title}`}
              className="plot-node-roster__select"
              type="button"
              onClick={() => onSelectEvent(event.id)}
            >
              <span className="plot-node-roster__title-row">
                <Text strong>{event.title}</Text>
                <Text type="secondary">{getStoryEventStatusLabel(event.status)}</Text>
              </span>
              {event.summary ? <Text type="secondary">{event.summary}</Text> : null}
              <Space size={6} wrap>
                <Tag>{getStoryEventTypeLabel(event.eventType)}</Tag>
                {event.storyTime ? <Tag>{event.storyTime}</Tag> : null}
              </Space>
            </button>
            <Button
              aria-label={`编辑剧情节点 ${event.title}`}
              icon={<EditOutlined />}
              size="small"
              type="text"
              onClick={() => onEditEvent(event.id)}
            />
          </article>
        </li>
      ))}
    </ul>
  );
}

function PlotNodeForeshadowingList({
  foreshadowings,
  onEditForeshadowing,
  onSelectForeshadowing,
  selectedForeshadowingId,
}: {
  readonly foreshadowings: readonly ForeshadowingElement[];
  readonly selectedForeshadowingId: string | undefined;
  onEditForeshadowing(foreshadowingId: string): void;
  onSelectForeshadowing(foreshadowingId: string): void;
}) {
  if (foreshadowings.length === 0) {
    return <Empty description="暂无伏笔" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <ul className="plot-node-roster">
      {foreshadowings.map((foreshadowing) => (
        <li key={foreshadowing.id}>
          <article
            className={[
              "plot-node-roster__item",
              selectedForeshadowingId === foreshadowing.id
                ? "plot-node-roster__item--selected"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <button
              aria-label={`查看伏笔 ${foreshadowing.title}`}
              className="plot-node-roster__select"
              type="button"
              onClick={() => onSelectForeshadowing(foreshadowing.id)}
            >
              <span className="plot-node-roster__title-row">
                <Text strong>{foreshadowing.title}</Text>
                <Text type="secondary">{getForeshadowingStatusLabel(foreshadowing.status)}</Text>
              </span>
              {foreshadowing.seedText ? (
                <Text type="secondary">{foreshadowing.seedText}</Text>
              ) : null}
              <Space size={6} wrap>
                <Tag>重要性 {normalizeForeshadowingImportance(foreshadowing.importance)}</Tag>
                {getForeshadowingEventId(foreshadowing, "payoff") ? <Tag>已有回收点</Tag> : null}
              </Space>
            </button>
            <Button
              aria-label={`编辑伏笔 ${foreshadowing.title}`}
              icon={<EditOutlined />}
              size="small"
              type="text"
              onClick={() => onEditForeshadowing(foreshadowing.id)}
            />
          </article>
        </li>
      ))}
    </ul>
  );
}

function PlotNodeDetailBody({
  chapters,
  characters,
  foreshadowings,
  selectedEvent,
  selectedForeshadowing,
  storyEvents,
}: {
  readonly chapters: readonly WorkbenchChapter[];
  readonly characters: readonly CharacterElement[];
  readonly foreshadowings: readonly ForeshadowingElement[];
  readonly selectedEvent: StoryEventElement | undefined;
  readonly selectedForeshadowing: ForeshadowingElement | undefined;
  readonly storyEvents: readonly StoryEventElement[];
}) {
  if (selectedEvent) {
    const chapterTitle =
      chapters.find((chapter) => chapter.id === selectedEvent.chapterId)?.title ?? "未指定";
    const participantNames = (selectedEvent.participants ?? [])
      .filter((participant) => participant.entityType === "character")
      .map(
        (participant) =>
          characters.find((character) => character.id === participant.entityId)?.name ??
          participant.entityId,
      )
      .join("、");
    const relatedForeshadowings = foreshadowings.filter((foreshadowing) =>
      foreshadowing.links?.some((link) => link.eventId === selectedEvent.id),
    );

    return (
      <div className="plot-node-detail">
        <div className="plot-node-detail__title-row">
          <div>
            <Title level={4}>{selectedEvent.title}</Title>
            <Space size={6} wrap>
              <Tag>{getStoryEventTypeLabel(selectedEvent.eventType)}</Tag>
              <Tag>{getStoryEventStatusLabel(selectedEvent.status)}</Tag>
            </Space>
          </div>
        </div>
        <dl className="plot-node-detail-list">
          <PlotNodeDetailItem label="节点描述" value={selectedEvent.summary} wide />
          <PlotNodeDetailItem label="故事时间" value={selectedEvent.storyTime ?? ""} />
          <PlotNodeDetailItem label="所在章节" value={chapterTitle} />
          <PlotNodeDetailItem label="涉及角色" value={participantNames} />
          <PlotNodeDetailItem
            label="关联伏笔"
            value={
              relatedForeshadowings.length > 0 ? (
                <Space size={[6, 6]} wrap>
                  {relatedForeshadowings.map((foreshadowing) => (
                    <Tag key={foreshadowing.id}>{foreshadowing.title}</Tag>
                  ))}
                </Space>
              ) : (
                ""
              )
            }
            wide
          />
        </dl>
      </div>
    );
  }

  if (selectedForeshadowing) {
    return (
      <div className="plot-node-detail">
        <div className="plot-node-detail__title-row">
          <div>
            <Title level={4}>{selectedForeshadowing.title}</Title>
            <Space size={6} wrap>
              <Tag>{getForeshadowingStatusLabel(selectedForeshadowing.status)}</Tag>
              <Tag>重要性 {normalizeForeshadowingImportance(selectedForeshadowing.importance)}</Tag>
            </Space>
          </div>
        </div>
        <dl className="plot-node-detail-list">
          <PlotNodeDetailItem label="伏笔内容" value={selectedForeshadowing.seedText ?? ""} wide />
          <PlotNodeDetailItem
            label="埋设事件"
            value={getLinkedStoryEventTitle(selectedForeshadowing, storyEvents, "seed")}
          />
          <PlotNodeDetailItem
            label="回收事件"
            value={getLinkedStoryEventTitle(selectedForeshadowing, storyEvents, "payoff")}
          />
          <PlotNodeDetailItem
            label="回收方案"
            value={selectedForeshadowing.payoffText ?? ""}
            wide
          />
        </dl>
      </div>
    );
  }

  return (
    <div className="plot-node-detail__empty">
      <Empty description="暂无剧情节点或伏笔" image={Empty.PRESENTED_IMAGE_SIMPLE} />
    </div>
  );
}

function PlotDebtLedger({
  onCreatePlotDebt,
  onEditPlotDebt,
  plotDebts,
}: {
  readonly plotDebts: readonly PlotDebtItem[];
  onCreatePlotDebt(): void;
  onEditPlotDebt(plotDebt: PlotDebtItem): void;
}) {
  return (
    <section aria-label="剧情债账本" className="plot-debt-ledger">
      <header className="plot-debt-ledger__header">
        <div>
          <Title level={5}>剧情债账本</Title>
          <Text type="secondary">记录读者承诺、谜题和关系冲突，防止长篇连载中遗忘埋设与回收。</Text>
        </div>
        <Space size={8} wrap>
          <Text type="secondary">{plotDebts.length} 条</Text>
          <Button
            aria-label="新增剧情债"
            icon={<PlusOutlined />}
            onClick={onCreatePlotDebt}
            type="primary"
          >
            新增剧情债
          </Button>
        </Space>
      </header>
      {plotDebts.length === 0 ? (
        <Empty description="暂无剧情债" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <ul className="plot-debt-list">
          {plotDebts.map((plotDebt) => (
            <li key={plotDebt.id}>
              <article className="plot-debt-list__item">
                <div className="plot-debt-list__main">
                  <span className="plot-debt-list__title-row">
                    <Text strong>{plotDebt.title}</Text>
                    <Text type="secondary">{getPlotDebtStatusLabel(plotDebt.status)}</Text>
                  </span>
                  <Text type="secondary">{plotDebt.promise}</Text>
                  <Space size={6} wrap>
                    <Tag>{getPlotDebtTypeLabel(plotDebt.debtType)}</Tag>
                    <Tag color={getPlotDebtRiskColor(plotDebt.riskLevel)}>
                      风险 {getPlotDebtRiskLevelLabel(plotDebt.riskLevel)}
                    </Tag>
                    {plotDebt.seedChapterIndex ? <Tag>埋设 {plotDebt.seedChapterIndex}</Tag> : null}
                    {plotDebt.expectedPayoffChapterIndex ? (
                      <Tag>预期回收 {plotDebt.expectedPayoffChapterIndex}</Tag>
                    ) : null}
                  </Space>
                </div>
                <Button
                  aria-label={`编辑剧情债 ${plotDebt.title}`}
                  icon={<EditOutlined />}
                  onClick={() => onEditPlotDebt(plotDebt)}
                >
                  编辑
                </Button>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PlotNodeDetailItem({
  label,
  value,
  wide = false,
}: {
  readonly label: string;
  readonly value: ReactNode;
  readonly wide?: boolean;
}) {
  return (
    <div
      className={
        wide
          ? "plot-node-detail-list__item plot-node-detail-list__item--wide"
          : "plot-node-detail-list__item"
      }
    >
      <dt>{label}</dt>
      <dd>{isEmptyDetailValue(value) ? <Text type="secondary">未填写</Text> : value}</dd>
    </div>
  );
}

function PlotDebtFields({
  characterOptions,
  foreshadowingOptions,
  plotlineOptions,
  worldRuleOptions,
}: {
  readonly characterOptions: ReadonlyArray<{ readonly label: string; readonly value: string }>;
  readonly foreshadowingOptions: ReadonlyArray<{ readonly label: string; readonly value: string }>;
  readonly plotlineOptions: ReadonlyArray<{ readonly label: string; readonly value: string }>;
  readonly worldRuleOptions: ReadonlyArray<{ readonly label: string; readonly value: string }>;
}) {
  return (
    <div className="plot-node-form-grid">
      <Form.Item
        label={characterFieldLabel("剧情债标题", "用短名称记录这个待兑现事项，便于长期追踪。")}
        name="title"
        rules={[
          { message: "请输入剧情债标题", required: true },
          { max: 120, message: "剧情债标题最多 120 字" },
        ]}
      >
        <Input aria-label="剧情债标题" placeholder="如：炉芯热信号追踪者" />
      </Form.Item>
      <Form.Item
        label={characterFieldLabel(
          "剧情债类型",
          "选择这条债的本质：伏笔、谜题、读者承诺、关系冲突或规则代价。",
        )}
        name="debtType"
      >
        <Select aria-label="剧情债类型" options={[...PLOT_DEBT_TYPE_OPTIONS]} />
      </Form.Item>
      <Form.Item label="状态" name="status">
        <Select aria-label="剧情债状态" options={[...PLOT_DEBT_STATUS_OPTIONS]} />
      </Form.Item>
      <Form.Item
        label={characterFieldLabel("风险等级", "越高代表越容易造成断线、遗忘、重复或回收不充分。")}
        name="riskLevel"
      >
        <Select aria-label="风险等级" options={[...PLOT_DEBT_RISK_LEVEL_OPTIONS]} />
      </Form.Item>
      <Form.Item
        label={characterFieldLabel("埋设章节", "第一次让读者感知这个承诺或问题的章节序号。")}
        name="seedChapterIndex"
      >
        <InputNumber aria-label="埋设章节" min={1} precision={0} />
      </Form.Item>
      <Form.Item
        label={characterFieldLabel("预期回收章节", "预计解释、兑现或反转这条债的章节序号。")}
        name="expectedPayoffChapterIndex"
      >
        <InputNumber aria-label="预期回收章节" min={1} precision={0} />
      </Form.Item>
      <Form.Item
        label={characterFieldLabel("实际回收章节", "已经完成回收后记录章节序号，未回收可留空。")}
        name="actualPayoffChapterIndex"
      >
        <InputNumber aria-label="实际回收章节" min={1} precision={0} />
      </Form.Item>
      <Form.Item label="关联故事线" name="relatedPlotlineId">
        <Select
          allowClear
          aria-label="关联故事线"
          options={[...plotlineOptions]}
          placeholder="未关联"
        />
      </Form.Item>
      <Form.Item label="关联角色" name="relatedCharacterIds">
        <Select
          allowClear
          aria-label="关联角色"
          mode="multiple"
          options={[...characterOptions]}
          placeholder="选择被这条债影响的角色"
        />
      </Form.Item>
      <Form.Item label="关联伏笔" name="relatedForeshadowingId">
        <Select
          allowClear
          aria-label="关联伏笔"
          options={[...foreshadowingOptions]}
          placeholder="未关联"
        />
      </Form.Item>
      <Form.Item label="关联世界规则" name="relatedWorldRuleIds">
        <Select
          allowClear
          aria-label="关联世界规则"
          mode="multiple"
          options={[...worldRuleOptions]}
          placeholder="选择支撑这条债的规则"
        />
      </Form.Item>
      <Form.Item
        className="plot-node-form-grid__wide"
        label={characterFieldLabel(
          "承诺内容",
          "写清读者已经被告知或期待得到回答的内容，以及不回收会造成什么落差。",
        )}
        name="promise"
        rules={[
          { message: "请输入承诺内容", required: true },
          { max: 800, message: "承诺内容最多 800 字" },
        ]}
      >
        <Input.TextArea
          aria-label="承诺内容"
          autoSize={{ maxRows: 5, minRows: 3 }}
          maxLength={800}
          placeholder="如：首次炉芯启动兑现升级爽点，但热信号来源和追踪者身份必须后续回收。"
          showCount
        />
      </Form.Item>
      <Form.Item
        className="plot-node-form-grid__wide"
        label={characterFieldLabel(
          "生命周期记录",
          "记录强化、误导、风险升高或回收过程。每条记录最好对应一个章节动作。",
        )}
        name="lifecycleNotes"
      >
        <Select
          aria-label="生命周期记录"
          mode="tags"
          open={false}
          placeholder="输入后回车，例如：第 6 章热信号再次出现"
        />
      </Form.Item>
    </div>
  );
}

function PlotNodeEventFields({
  chapterOptions,
  characterOptions,
}: {
  readonly chapterOptions: ReadonlyArray<{ readonly label: string; readonly value: string }>;
  readonly characterOptions: ReadonlyArray<{ readonly label: string; readonly value: string }>;
}) {
  return (
    <div className="plot-node-form-grid">
      <Form.Item
        label={characterFieldLabel("节点标题", "用一句话写清读者会如何记住这个事件。")}
        name="title"
        rules={[{ message: "请输入节点标题", required: true }]}
      >
        <Input aria-label="节点标题" placeholder="如：旧信出现" />
      </Form.Item>
      <Form.Item
        label={characterFieldLabel(
          "节点类型",
          "选择事件在故事里的功能：发现、冲突、揭示、决定、失败、胜利等。",
        )}
        name="eventType"
      >
        <Select aria-label="节点类型" options={[...EVENT_TYPE_OPTIONS]} />
      </Form.Item>
      <Form.Item
        label={characterFieldLabel("事件状态", "区分草稿、已规划、已写入正史或归档。")}
        name="status"
      >
        <Select aria-label="事件状态" options={[...STORY_EVENT_STATUS_OPTIONS]} />
      </Form.Item>
      <Form.Item
        label={characterFieldLabel("所在章节", "可选。用于把节点落到具体章节，方便后续章纲引用。")}
        name="chapterId"
      >
        <Select
          allowClear
          aria-label="所在章节"
          options={[...chapterOptions]}
          placeholder="未指定"
        />
      </Form.Item>
      <Form.Item
        label={characterFieldLabel("故事时间", "写故事内时间，例如“第 3 章夜雨”或“十年前”。")}
        name="storyTime"
      >
        <Input aria-label="故事时间" placeholder="如：第 3 章夜雨" />
      </Form.Item>
      <Form.Item
        label={characterFieldLabel("涉及角色", "选择实际参与或被这个事件影响的角色。")}
        name="participants"
      >
        <Select
          allowClear
          aria-label="涉及角色"
          mode="multiple"
          options={[...characterOptions]}
          placeholder="未指定"
        />
      </Form.Item>
      <Form.Item
        className="plot-node-form-grid__wide"
        label={characterFieldLabel(
          "节点描述",
          "写清事件事实、冲突变化、读者新获得的信息和人物状态变化。",
        )}
        name="description"
        rules={[{ message: "请输入节点描述", required: true }]}
      >
        <Input.TextArea
          aria-label="节点描述"
          autoSize={{ maxRows: 6, minRows: 4 }}
          maxLength={500}
          showCount
        />
      </Form.Item>
    </div>
  );
}

function PlotNodeForeshadowingFields({
  storyEventOptions,
}: {
  readonly storyEventOptions: ReadonlyArray<{ readonly label: string; readonly value: string }>;
}) {
  return (
    <div className="plot-node-form-grid">
      <Form.Item
        label={characterFieldLabel("伏笔标题", "给这个伏笔一个便于长期追踪的名称。")}
        name="title"
        rules={[{ message: "请输入伏笔标题", required: true }]}
      >
        <Input aria-label="伏笔标题" placeholder="如：信纸水印" />
      </Form.Item>
      <Form.Item
        label={characterFieldLabel("重要性", "1 到 5 级，数值越高越需要在主线中明确回收。")}
        name="importance"
      >
        <InputNumber aria-label="伏笔重要性" max={5} min={1} />
      </Form.Item>
      <Form.Item
        label={characterFieldLabel("伏笔状态", "已埋设、待回收、已回收或归档。")}
        name="status"
      >
        <Select aria-label="伏笔状态" options={[...FORESHADOWING_STATUS_OPTIONS]} />
      </Form.Item>
      <Form.Item
        label={characterFieldLabel("埋设事件", "这个伏笔第一次出现或被读者感知的剧情节点。")}
        name="seedEventId"
      >
        <Select
          allowClear
          aria-label="埋设事件"
          options={[...storyEventOptions]}
          placeholder="未指定"
        />
      </Form.Item>
      <Form.Item
        label={characterFieldLabel("回收事件", "这个伏笔最终解释、兑现或反转的剧情节点。")}
        name="payoffEventId"
      >
        <Select
          allowClear
          aria-label="回收事件"
          options={[...storyEventOptions]}
          placeholder="未指定"
        />
      </Form.Item>
      <Form.Item
        className="plot-node-form-grid__wide"
        label={characterFieldLabel("伏笔内容", "写读者当下能看到的表层信息，避免提前解释谜底。")}
        name="description"
        rules={[{ message: "请输入伏笔内容", required: true }]}
      >
        <Input.TextArea
          aria-label="伏笔内容"
          autoSize={{ maxRows: 5, minRows: 3 }}
          maxLength={500}
          showCount
        />
      </Form.Item>
      <Form.Item
        className="plot-node-form-grid__wide"
        label={characterFieldLabel("回收方案", "写清什么时候回收、回收后改变什么信息或人物处境。")}
        name="payoffExpectation"
      >
        <Input.TextArea
          aria-label="回收方案"
          autoSize={{ maxRows: 5, minRows: 3 }}
          maxLength={500}
          showCount
        />
      </Form.Item>
    </div>
  );
}

function PlotNodeModalActions({
  icon,
  onCancel,
  submitLabel,
}: {
  readonly icon: ReactNode;
  readonly submitLabel: string;
  onCancel(): void;
}) {
  return (
    <Space className="plot-node-form-actions" wrap>
      <Button onClick={onCancel}>取消</Button>
      <Button aria-label={submitLabel} htmlType="submit" icon={icon} type="primary">
        {submitLabel}
      </Button>
    </Space>
  );
}

function getLinkedStoryEventTitle(
  foreshadowing: ForeshadowingElement,
  storyEvents: readonly StoryEventElement[],
  role: "payoff" | "seed",
): string {
  const eventId = getForeshadowingEventId(foreshadowing, role);
  if (!eventId) {
    return "";
  }
  return storyEvents.find((event) => event.id === eventId)?.title ?? eventId;
}

function storyEventToFormValues(event: StoryEventElement): StoryEventFormValues {
  return {
    chapterId: event.chapterId ?? undefined,
    description: event.summary,
    eventType: getStoryEventTypeValue(event.eventType),
    participants: (event.participants ?? [])
      .filter((participant) => participant.entityType === "character")
      .map((participant) => participant.entityId),
    status: getStoryEventStatusValue(event.status),
    storyTime: event.storyTime ?? "",
    title: event.title,
  };
}

function normalizeStoryEventFormValues(values: StoryEventFormValues): StoryEventFormValues {
  return {
    chapterId: trimOptionalText(values.chapterId),
    description: values.description.trim(),
    eventType: getStoryEventTypeValue(values.eventType),
    participants: normalizeStringList(values.participants),
    status: getStoryEventStatusValue(values.status),
    storyTime: trimOptionalText(values.storyTime) ?? "",
    title: values.title.trim(),
  };
}

function storyEventFormValuesToCreateInput(values: StoryEventFormValues): CreateStoryEventValues {
  const chapterId = trimOptionalText(values.chapterId);
  const storyTime = trimOptionalText(values.storyTime);

  return {
    description: values.description,
    eventType: values.eventType,
    participants: storyEventParticipantInputs(values.participants),
    status: values.status,
    title: values.title,
    ...(chapterId === undefined ? {} : { chapterId }),
    ...(storyTime === undefined ? {} : { storyTime }),
  };
}

function storyEventFormValuesToPatch(
  values: StoryEventFormValues,
): UpdateStoryEventValues["patch"] {
  return {
    chapterId: normalizedNullableFormText(values.chapterId),
    description: values.description,
    eventType: values.eventType,
    participants: storyEventParticipantInputs(values.participants),
    status: values.status,
    storyTime: normalizedNullableFormText(values.storyTime),
    title: values.title,
  };
}

function storyEventParticipantInputs(
  participantIds: readonly string[],
): CreateStoryEventParticipantValues[] {
  return participantIds.map((entityId) => ({
    entityId,
    entityType: "character",
    role: "actor",
  }));
}

function foreshadowingToFormValues(foreshadowing: ForeshadowingElement): ForeshadowingFormValues {
  return {
    description: foreshadowing.seedText ?? "",
    importance: normalizeForeshadowingImportance(foreshadowing.importance),
    payoffEventId: getForeshadowingEventId(foreshadowing, "payoff"),
    payoffExpectation: foreshadowing.payoffText ?? "",
    seedEventId: getForeshadowingEventId(foreshadowing, "seed"),
    status: getForeshadowingStatusValue(foreshadowing.status),
    title: foreshadowing.title,
  };
}

function normalizeForeshadowingFormValues(
  values: ForeshadowingFormValues,
): ForeshadowingFormValues {
  return {
    description: values.description.trim(),
    importance: normalizeForeshadowingImportance(values.importance),
    payoffEventId: trimOptionalText(values.payoffEventId),
    payoffExpectation: trimOptionalText(values.payoffExpectation) ?? "",
    seedEventId: trimOptionalText(values.seedEventId),
    status: getForeshadowingStatusValue(values.status),
    title: values.title.trim(),
  };
}

function foreshadowingFormValuesToCreateInput(
  values: ForeshadowingFormValues,
): CreateForeshadowingValues {
  const payoffExpectation = trimOptionalText(values.payoffExpectation);
  const payoffEventId = trimOptionalText(values.payoffEventId);
  const seedEventId = trimOptionalText(values.seedEventId);

  return {
    description: values.description,
    importance: values.importance,
    status: values.status,
    title: values.title,
    ...(payoffExpectation === undefined ? {} : { payoffExpectation }),
    ...(payoffEventId === undefined ? {} : { payoffEventId }),
    ...(seedEventId === undefined ? {} : { seedEventId }),
  };
}

function foreshadowingFormValuesToPatch(
  values: ForeshadowingFormValues,
): UpdateForeshadowingValues["patch"] {
  return {
    description: normalizedNullableFormText(values.description),
    importance: values.importance,
    payoffEventId: normalizedNullableFormText(values.payoffEventId),
    payoffExpectation: normalizedNullableFormText(values.payoffExpectation),
    seedEventId: normalizedNullableFormText(values.seedEventId),
    status: values.status,
    title: values.title,
  };
}

function getStoryEventTypeLabel(value: string | null | undefined): string {
  return EVENT_TYPE_LABELS[getStoryEventTypeValue(value)];
}

function getStoryEventStatusLabel(value: string | null | undefined): string {
  return STORY_EVENT_STATUS_LABELS[getStoryEventStatusValue(value)];
}

function getForeshadowingStatusLabel(value: string | null | undefined): string {
  return FORESHADOWING_STATUS_LABELS[getForeshadowingStatusValue(value)];
}

function getStoryEventTypeValue(value: string | null | undefined): StoryEventTypeValue {
  return isKeyOf(EVENT_TYPE_LABELS, value) ? value : STORY_EVENT_FORM_DEFAULTS.eventType;
}

function getStoryEventStatusValue(value: string | null | undefined): StoryEventStatusValue {
  return isKeyOf(STORY_EVENT_STATUS_LABELS, value) ? value : STORY_EVENT_FORM_DEFAULTS.status;
}

function getForeshadowingStatusValue(value: string | null | undefined): ForeshadowingStatusValue {
  return isKeyOf(FORESHADOWING_STATUS_LABELS, value) ? value : FORESHADOWING_FORM_DEFAULTS.status;
}

function getForeshadowingEventId(
  foreshadowing: ForeshadowingElement,
  role: "payoff" | "seed",
): string | undefined {
  return foreshadowing.links?.find((link) => link.role === role)?.eventId;
}

function normalizeForeshadowingImportance(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return FORESHADOWING_FORM_DEFAULTS.importance;
  }

  return Math.min(5, Math.max(1, Math.round(value)));
}

function plotDebtToFormValues(plotDebt: PlotDebtItem): PlotDebtFormValues {
  return {
    actualPayoffChapterIndex: plotDebt.actualPayoffChapterIndex ?? null,
    debtType: getPlotDebtTypeValue(plotDebt.debtType),
    expectedPayoffChapterIndex: plotDebt.expectedPayoffChapterIndex ?? null,
    lifecycleNotes: normalizeStringList(plotDebt.lifecycleNotes),
    promise: plotDebt.promise,
    relatedCharacterIds: normalizeStringList(plotDebt.relatedCharacterIds),
    relatedForeshadowingId: plotDebt.relatedForeshadowingId ?? null,
    relatedPlotlineId: plotDebt.relatedPlotlineId ?? null,
    relatedWorldRuleIds: normalizeStringList(plotDebt.relatedWorldRuleIds),
    riskLevel: getPlotDebtRiskLevelValue(plotDebt.riskLevel),
    seedChapterIndex: plotDebt.seedChapterIndex ?? null,
    status: getPlotDebtStatusValue(plotDebt.status),
    title: plotDebt.title,
  };
}

function plotDebtFormValuesToSaveInput(
  values: PlotDebtFormValues,
  debtId: string | undefined,
): SavePlotDebtValues {
  const normalized = normalizePlotDebtFormValues(values);
  return {
    ...(debtId ? { debtId } : {}),
    values: normalized,
  };
}

function normalizePlotDebtFormValues(values: PlotDebtFormValues): PlotDebtValues {
  return {
    actualPayoffChapterIndex: normalizedNullableNumber(values.actualPayoffChapterIndex),
    debtType: getPlotDebtTypeValue(values.debtType),
    expectedPayoffChapterIndex: normalizedNullableNumber(values.expectedPayoffChapterIndex),
    lifecycleNotes: normalizeStringList(values.lifecycleNotes),
    promise: values.promise.trim(),
    relatedCharacterIds: normalizeStringList(values.relatedCharacterIds),
    relatedForeshadowingId: normalizedNullableFormText(values.relatedForeshadowingId),
    relatedPlotlineId: normalizedNullableFormText(values.relatedPlotlineId),
    relatedWorldRuleIds: normalizeStringList(values.relatedWorldRuleIds),
    riskLevel: getPlotDebtRiskLevelValue(values.riskLevel),
    seedChapterIndex: normalizedNullableNumber(values.seedChapterIndex),
    status: getPlotDebtStatusValue(values.status),
    title: values.title.trim(),
  };
}

function normalizedNullableNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : null;
}

function getPlotDebtTypeLabel(value: string | null | undefined): string {
  return PLOT_DEBT_TYPE_LABELS[getPlotDebtTypeValue(value)];
}

function getPlotDebtStatusLabel(value: string | null | undefined): string {
  return PLOT_DEBT_STATUS_LABELS[getPlotDebtStatusValue(value)];
}

function getPlotDebtRiskLevelLabel(value: string | null | undefined): string {
  return PLOT_DEBT_RISK_LEVEL_LABELS[getPlotDebtRiskLevelValue(value)];
}

function getPlotDebtTypeValue(value: string | null | undefined): PlotDebtTypeValue {
  return isKeyOf(PLOT_DEBT_TYPE_LABELS, value) ? value : PLOT_DEBT_FORM_DEFAULTS.debtType;
}

function getPlotDebtStatusValue(value: string | null | undefined): PlotDebtStatusValue {
  return isKeyOf(PLOT_DEBT_STATUS_LABELS, value) ? value : PLOT_DEBT_FORM_DEFAULTS.status;
}

function getPlotDebtRiskLevelValue(value: string | null | undefined): PlotDebtRiskLevelValue {
  return isKeyOf(PLOT_DEBT_RISK_LEVEL_LABELS, value) ? value : PLOT_DEBT_FORM_DEFAULTS.riskLevel;
}

function getPlotDebtRiskColor(value: string | null | undefined): string {
  const riskLevel = getPlotDebtRiskLevelValue(value);
  if (riskLevel === "critical") {
    return "red";
  }
  if (riskLevel === "high") {
    return "orange";
  }
  if (riskLevel === "medium") {
    return "gold";
  }
  return "green";
}

function ChapterPlanningModule({
  creativePath,
  onApplyChapterOutline,
  onApproveChapterOutline,
  onGenerateChapterExecutionCard,
  onGenerateDraftFromOutline,
  onGenerateDraftFromPlan,
  onGenerateOutline,
  onGenerateRollingOutline,
  onGenerateSerialReview,
}: {
  readonly creativePath: CreativePathBoard;
  onApplyChapterOutline(input: { readonly chapterOutlineId: string }): Promise<void> | void;
  onApproveChapterOutline(input: { readonly chapterOutlineId: string }): Promise<void> | void;
  onGenerateChapterExecutionCard(input: {
    readonly chapterPlanId: string;
    readonly instruction?: string;
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
  onGenerateSerialReview(input: {
    readonly scope: "chapter_batch" | "arc" | "volume";
    readonly startChapterIndex: number;
    readonly endChapterIndex: number;
  }): Promise<void> | void;
}) {
  const [serialReviewOpen, setSerialReviewOpen] = useState(false);
  const [serialReviewForm] = Form.useForm<{
    readonly endChapterIndex: number;
    readonly scope: "chapter_batch" | "arc" | "volume";
    readonly startChapterIndex: number;
  }>();
  const firstVolumePlanId = creativePath.volumePlans[0]?.id;
  const firstArcPlanId = creativePath.arcPlans[0]?.id;
  const nextChapterIndex = getNextChapterPlanIndex(creativePath.chapterPlans);
  const lastPlannedChapterIndex = Math.max(1, nextChapterIndex - 1);
  const defaultReviewStartChapterIndex = Math.max(1, lastPlannedChapterIndex - 9);

  const openSerialReviewDialog = () => {
    serialReviewForm.setFieldsValue({
      endChapterIndex: lastPlannedChapterIndex,
      scope: "chapter_batch",
      startChapterIndex: defaultReviewStartChapterIndex,
    });
    setSerialReviewOpen(true);
  };

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
          <Button
            aria-label="生成阶段复盘"
            icon={<CheckCircleOutlined />}
            onClick={openSerialReviewDialog}
          >
            生成阶段复盘
          </Button>
        </Space>
      </ModuleSection>

      <ModuleSection title="结构化章节规划">
        <StructuredPlanList
          executionCards={creativePath.chapterExecutionCards ?? []}
          chapterPlans={creativePath.chapterPlans}
          onGenerateChapterExecutionCard={onGenerateChapterExecutionCard}
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

      <Modal
        footer={null}
        forceRender
        onCancel={() => setSerialReviewOpen(false)}
        open={serialReviewOpen}
        title="生成阶段复盘"
      >
        <Form
          form={serialReviewForm}
          initialValues={{
            endChapterIndex: lastPlannedChapterIndex,
            scope: "chapter_batch",
            startChapterIndex: defaultReviewStartChapterIndex,
          }}
          layout="vertical"
          onFinish={async (values) => {
            await onGenerateSerialReview(values);
            setSerialReviewOpen(false);
          }}
        >
          <Form.Item label="复盘范围" name="scope">
            <Select
              aria-label="复盘范围"
              options={[
                { label: "章节批次", value: "chapter_batch" },
                { label: "阶段弧线", value: "arc" },
                { label: "整卷", value: "volume" },
              ]}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="起始章节"
                name="startChapterIndex"
                rules={[{ required: true, message: "请输入起始章节" }]}
              >
                <InputNumber aria-label="起始章节" min={1} precision={0} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                dependencies={["startChapterIndex"]}
                label="结束章节"
                name="endChapterIndex"
                rules={[
                  { required: true, message: "请输入结束章节" },
                  ({ getFieldValue }) => ({
                    validator(_, value: number | undefined) {
                      const startChapterIndex = getFieldValue("startChapterIndex") as
                        number | undefined;
                      if (
                        value === undefined ||
                        startChapterIndex === undefined ||
                        value >= startChapterIndex
                      ) {
                        return Promise.resolve();
                      }

                      return Promise.reject(new Error("结束章节不能小于起始章节"));
                    },
                  }),
                ]}
              >
                <InputNumber aria-label="结束章节" min={1} precision={0} />
              </Form.Item>
            </Col>
          </Row>
          <Space>
            <Button onClick={() => setSerialReviewOpen(false)}>取消</Button>
            <Button htmlType="submit" icon={<CheckCircleOutlined />} type="primary">
              生成复盘报告
            </Button>
          </Space>
        </Form>
      </Modal>
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
    readonly description?: string;
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
              ...(values.description?.trim() ? { description: values.description.trim() } : {}),
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
            <Form.Item label="创作描述" name="description">
              <Input.TextArea
                aria-label="创作描述"
                autoSize={{ maxRows: 5, minRows: 3 }}
                maxLength={500}
                placeholder="例如：生成安全屋外部补给线上的地下势力名称。"
                showCount
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

function StructuredPlanList({
  chapterPlans,
  executionCards,
  onGenerateChapterExecutionCard,
  onGenerateDraftFromPlan,
}: {
  readonly chapterPlans: readonly ChapterPlanItem[];
  readonly executionCards: NonNullable<CreativePathBoard["chapterExecutionCards"]>;
  onGenerateChapterExecutionCard(input: {
    readonly chapterPlanId: string;
    readonly instruction?: string;
  }): Promise<void> | void;
  onGenerateDraftFromPlan(input: { readonly chapterPlanId: string }): Promise<void> | void;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [rangeStart, setRangeStart] = useState<number | null>(null);
  const [rangeEnd, setRangeEnd] = useState<number | null>(null);
  const pageSize = 30;
  const filteredChapterPlans = useMemo(
    () =>
      chapterPlans.filter((plan) => {
        if (rangeStart !== null && plan.chapterIndex < rangeStart) {
          return false;
        }

        if (rangeEnd !== null && plan.chapterIndex > rangeEnd) {
          return false;
        }

        return true;
      }),
    [chapterPlans, rangeEnd, rangeStart],
  );
  const pageCount = Math.max(1, Math.ceil(filteredChapterPlans.length / pageSize));
  const effectiveCurrentPage = Math.min(currentPage, pageCount);
  const visibleChapterPlans = useMemo(
    () =>
      filteredChapterPlans.slice(
        (effectiveCurrentPage - 1) * pageSize,
        effectiveCurrentPage * pageSize,
      ),
    [effectiveCurrentPage, filteredChapterPlans],
  );
  const executionCardByChapterPlanId = useMemo(
    () => new Map(executionCards.map((card) => [card.chapterPlanId, card])),
    [executionCards],
  );

  if (chapterPlans.length === 0) {
    return <Empty description="暂无结构化章节规划" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <div className="structured-plan">
      <div className="structured-plan__toolbar" aria-label="章节规划筛选">
        <Space size={10} wrap>
          <InputNumber
            aria-label="筛选起始章节"
            min={1}
            onChange={(value) => {
              setCurrentPage(1);
              setRangeStart(typeof value === "number" ? value : null);
            }}
            placeholder="起始章"
            precision={0}
            value={rangeStart}
          />
          <InputNumber
            aria-label="筛选结束章节"
            min={1}
            onChange={(value) => {
              setCurrentPage(1);
              setRangeEnd(typeof value === "number" ? value : null);
            }}
            placeholder="结束章"
            precision={0}
            value={rangeEnd}
          />
          <Button
            aria-label="清除章节筛选"
            disabled={rangeStart === null && rangeEnd === null}
            onClick={() => {
              setCurrentPage(1);
              setRangeStart(null);
              setRangeEnd(null);
            }}
          >
            清除筛选
          </Button>
        </Space>
        <Text type="secondary">
          显示 {visibleChapterPlans.length} / {filteredChapterPlans.length} 章，共{" "}
          {chapterPlans.length} 章
        </Text>
      </div>
      {filteredChapterPlans.length === 0 ? (
        <Empty description="当前筛选下暂无章节规划" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <ul className="chapter-outline-list">
          {visibleChapterPlans.map((plan) => {
            const title = formatChapterPlanTitle(plan);
            const executionCard = executionCardByChapterPlanId.get(plan.id);

            return (
              <li className="chapter-outline-list__item" key={plan.id}>
                <div className="chapter-outline-list__body">
                  <Text strong>{title}</Text>
                  <Text type="secondary">{plan.chapterGoal}</Text>
                  <Space size={6} wrap>
                    <Tag>{plan.status}</Tag>
                    <Tag color={executionCard ? "green" : "default"}>
                      {executionCard ? "执行卡已确认" : "待生成执行卡"}
                    </Tag>
                  </Space>
                </div>
                <Space wrap>
                  <Button
                    aria-label={`生成执行卡 ${title}`}
                    icon={<FileProtectOutlined />}
                    onClick={() => onGenerateChapterExecutionCard({ chapterPlanId: plan.id })}
                  >
                    生成执行卡
                  </Button>
                  <Button
                    aria-label={`基于结构章纲生成草稿 ${title}`}
                    onClick={() => onGenerateDraftFromPlan({ chapterPlanId: plan.id })}
                  >
                    基于结构章纲生成草稿
                  </Button>
                </Space>
              </li>
            );
          })}
        </ul>
      )}
      {filteredChapterPlans.length > pageSize ? (
        <Pagination
          aria-label="章节规划分页"
          current={effectiveCurrentPage}
          onChange={setCurrentPage}
          pageSize={pageSize}
          showSizeChanger={false}
          total={filteredChapterPlans.length}
        />
      ) : null}
    </div>
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

function CharacterRoster({
  characters,
  onDeleteCharacter,
  onEditCharacter,
  onShowState,
}: {
  readonly characters: readonly CharacterElement[];
  onDeleteCharacter(character: CharacterElement): void;
  onEditCharacter(character: CharacterElement): void;
  onShowState(character: CharacterElement): void;
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
            <article className="character-roster__item">
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
              <Space className="character-roster__actions" size={8} wrap>
                <Button
                  aria-label={`查看角色状态 ${character.name}`}
                  icon={<DatabaseOutlined />}
                  onClick={() => onShowState(character)}
                >
                  状态
                </Button>
                <Button
                  aria-label={`编辑角色 ${character.name}`}
                  icon={<EditOutlined />}
                  onClick={() => onEditCharacter(character)}
                >
                  编辑
                </Button>
                <Button
                  aria-label={`删除角色 ${character.name}`}
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => onDeleteCharacter(character)}
                >
                  删除
                </Button>
              </Space>
            </article>
          </li>
        );
      })}
    </ul>
  );
}

function CharacterStateTimelineModal({
  character,
  onClose,
  snapshots,
}: {
  readonly character: CharacterElement;
  readonly snapshots: readonly CharacterStateSnapshotItem[];
  onClose(): void;
}) {
  const orderedSnapshots = [...snapshots].sort((left, right) => {
    if (left.chapterIndex !== right.chapterIndex) {
      return left.chapterIndex - right.chapterIndex;
    }
    return left.createdAt - right.createdAt;
  });

  return (
    <Modal
      className="creative-form-modal"
      footer={null}
      onCancel={onClose}
      open
      title={`状态时间线：${character.name}`}
      width={760}
    >
      <section aria-label="角色状态时间线" className="character-state-timeline">
        {orderedSnapshots.length === 0 ? (
          <Empty description="暂无角色状态快照" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <ul className="character-state-timeline__list">
            {orderedSnapshots.map((snapshot) => (
              <li key={snapshot.id}>
                <article className="character-state-timeline__item">
                  <header>
                    <Text strong>第 {snapshot.chapterIndex} 章</Text>
                  </header>
                  <dl className="character-state-timeline__fields">
                    <PlotNodeDetailItem label="位置" value={snapshot.position} />
                    <PlotNodeDetailItem label="外在目标" value={snapshot.externalGoal} />
                    <PlotNodeDetailItem label="内在需求" value={snapshot.internalNeed} />
                    <PlotNodeDetailItem label="情绪状态" value={snapshot.emotionalState} />
                    <PlotNodeDetailItem label="身体状态" value={snapshot.physicalState} />
                    <PlotNodeDetailItem label="已知信息" value={snapshot.knowledgeState} />
                    <PlotNodeDetailItem
                      label="风险标记"
                      value={snapshot.riskFlags.join("、")}
                      wide
                    />
                    <PlotNodeDetailItem label="隐藏秘密" value={snapshot.secrets.join("、")} wide />
                  </dl>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Modal>
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

function plotlineToFormValues(plotline: PlotlineElement): CreatePlotlineValues {
  return {
    centralQuestion: plotline.centralQuestion ?? "",
    driver: plotline.driver ?? "",
    emotionalPromise: plotline.emotionalPromise ?? "",
    importance: getPlotlineImportanceValue(plotline.importance),
    kind: getPlotlineKindValue(plotline.type),
    midEscalation: plotline.midEscalation ?? "",
    narrativeRole: getPlotlineNarrativeRoleValue(plotline.narrativeRole),
    payoffPlan: plotline.payoffPlan ?? "",
    priority: plotline.priority,
    relatedCharacterIds: [...(plotline.relatedCharacterIds ?? [])],
    relatedForeshadowingIds: [...(plotline.relatedForeshadowingIds ?? [])],
    relatedStoryEventIds: [...(plotline.relatedStoryEventIds ?? [])],
    relatedWorldRuleIds: [...(plotline.relatedWorldRuleIds ?? [])],
    startState: plotline.startState ?? "",
    status: getPlotlineStatusValue(plotline.status),
    summary: plotline.summary ?? "",
    title: plotline.name,
  };
}

function normalizePlotlineValues(values: CreatePlotlineValues): CreatePlotlineValues {
  return {
    centralQuestion: trimOptionalText(values.centralQuestion) ?? "",
    driver: trimOptionalText(values.driver) ?? "",
    emotionalPromise: trimOptionalText(values.emotionalPromise) ?? "",
    importance: getPlotlineImportanceValue(values.importance),
    kind: getPlotlineKindValue(values.kind),
    midEscalation: trimOptionalText(values.midEscalation) ?? "",
    narrativeRole: getPlotlineNarrativeRoleValue(values.narrativeRole),
    payoffPlan: trimOptionalText(values.payoffPlan) ?? "",
    priority:
      typeof values.priority === "number" && Number.isFinite(values.priority) ? values.priority : 0,
    relatedCharacterIds: normalizeStringList(values.relatedCharacterIds),
    relatedForeshadowingIds: normalizeStringList(values.relatedForeshadowingIds),
    relatedStoryEventIds: normalizeStringList(values.relatedStoryEventIds),
    relatedWorldRuleIds: normalizeStringList(values.relatedWorldRuleIds),
    startState: trimOptionalText(values.startState) ?? "",
    status: getPlotlineStatusValue(values.status),
    summary: trimOptionalText(values.summary) ?? "",
    title: values.title.trim(),
  };
}

function normalizePlotlineNodeValues(
  values: Omit<CreatePlotlineNodeValues, "plotlineId">,
  plotlineId: string,
): CreatePlotlineNodeValues {
  return {
    chapterHint: trimOptionalText(values.chapterHint) ?? "",
    description: trimOptionalText(values.description) ?? "",
    kind: getPlotlineNodeKindValue(values.kind),
    plotlineId,
    status: getPlotlineNodeStatusValue(values.status),
    title: values.title.trim(),
  };
}

function getPlotlineCompletionScore(plotline: PlotlineElement): number {
  const fields = [
    plotline.name,
    plotline.summary,
    plotline.centralQuestion,
    plotline.driver,
    plotline.startState,
    plotline.midEscalation,
    plotline.payoffPlan,
    plotline.emotionalPromise,
  ];
  const filledCount = fields.filter((field) => field?.trim()).length;
  return Math.round((filledCount / fields.length) * 100);
}

function getPlotlineKindLabel(value: string | null | undefined): string {
  return PLOTLINE_KIND_LABELS[getPlotlineKindValue(value)];
}

function getPlotlineNarrativeRoleLabel(value: string | null | undefined): string {
  return PLOTLINE_NARRATIVE_ROLE_LABELS[getPlotlineNarrativeRoleValue(value)];
}

function getPlotlineImportanceLabel(value: string | null | undefined): string {
  return PLOTLINE_IMPORTANCE_LABELS[getPlotlineImportanceValue(value)];
}

function getPlotlineStatusLabel(value: string | null | undefined): string {
  return PLOTLINE_STATUS_LABELS[getPlotlineStatusValue(value)];
}

function getPlotlineNodeKindLabel(value: string | null | undefined): string {
  return PLOTLINE_NODE_KIND_LABELS[getPlotlineNodeKindValue(value)];
}

function getPlotlineNodeStatusLabel(value: string | null | undefined): string {
  return PLOTLINE_NODE_STATUS_LABELS[getPlotlineNodeStatusValue(value)];
}

function getPlotlineKindValue(value: string | null | undefined): CreatePlotlineValues["kind"] {
  return isKeyOf(PLOTLINE_KIND_LABELS, value) ? value : PLOTLINE_FORM_DEFAULTS.kind;
}

function getPlotlineNarrativeRoleValue(
  value: string | null | undefined,
): CreatePlotlineValues["narrativeRole"] {
  return isKeyOf(PLOTLINE_NARRATIVE_ROLE_LABELS, value)
    ? value
    : PLOTLINE_FORM_DEFAULTS.narrativeRole;
}

function getPlotlineImportanceValue(
  value: string | null | undefined,
): CreatePlotlineValues["importance"] {
  return isKeyOf(PLOTLINE_IMPORTANCE_LABELS, value) ? value : PLOTLINE_FORM_DEFAULTS.importance;
}

function getPlotlineStatusValue(value: string | null | undefined): CreatePlotlineValues["status"] {
  return isKeyOf(PLOTLINE_STATUS_LABELS, value) ? value : PLOTLINE_FORM_DEFAULTS.status;
}

function getPlotlineNodeKindValue(
  value: string | null | undefined,
): CreatePlotlineNodeValues["kind"] {
  return isKeyOf(PLOTLINE_NODE_KIND_LABELS, value) ? value : PLOTLINE_NODE_FORM_DEFAULTS.kind;
}

function getPlotlineNodeStatusValue(
  value: string | null | undefined,
): CreatePlotlineNodeValues["status"] {
  return isKeyOf(PLOTLINE_NODE_STATUS_LABELS, value) ? value : PLOTLINE_NODE_FORM_DEFAULTS.status;
}

function normalizeStringList(value: readonly string[] | undefined): string[] {
  return Array.from(new Set((value ?? []).map((item) => item.trim()).filter(Boolean)));
}

function isKeyOf<T extends Record<string, unknown>>(
  record: T,
  value: string | null | undefined,
): value is Extract<keyof T, string> {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(record, value);
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
    sceneOutlines: [],
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
    volumeOutlines: [],
    volumePlans: [],
  };
}
