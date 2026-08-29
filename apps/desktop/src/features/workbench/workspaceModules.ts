export type WorkspaceModuleKey =
  | "dashboard"
  | "basic"
  | "worldbuilding"
  | "story-core"
  | "characters"
  | "storylines"
  | "book-outline"
  | "plot-nodes"
  | "chapter-planning"
  | "manuscript"
  | "memory";

export interface WorkspaceModuleDefinition {
  readonly key: WorkspaceModuleKey;
  readonly label: string;
  readonly shortLabel: string;
  readonly title: string;
}

export const PRIMARY_WORKSPACE_MODULES = [
  {
    key: "dashboard",
    label: "总控台",
    shortLabel: "总控台",
    title: "作品总控台",
  },
  {
    key: "basic",
    label: "1. 基本信息",
    shortLabel: "基本信息",
    title: "基本信息",
  },
  {
    key: "worldbuilding",
    label: "2. 世界观设计",
    shortLabel: "世界观",
    title: "世界观设计",
  },
  {
    key: "story-core",
    label: "3. 核心故事",
    shortLabel: "核心故事",
    title: "核心故事设计",
  },
  {
    key: "characters",
    label: "4. 角色设计",
    shortLabel: "角色",
    title: "角色设计",
  },
  {
    key: "storylines",
    label: "5. 故事线设计",
    shortLabel: "故事线",
    title: "故事线设计",
  },
  {
    key: "book-outline",
    label: "6. 全书大纲",
    shortLabel: "全书大纲",
    title: "全书大纲",
  },
  {
    key: "plot-nodes",
    label: "7. 剧情节点",
    shortLabel: "剧情节点",
    title: "剧情节点设计",
  },
  {
    key: "chapter-planning",
    label: "8. 章节规划",
    shortLabel: "章节规划",
    title: "章节规划",
  },
  {
    key: "manuscript",
    label: "9. 正文创作",
    shortLabel: "正文",
    title: "正文创作",
  },
] as const satisfies readonly WorkspaceModuleDefinition[];

export const AUXILIARY_WORKSPACE_MODULES = [
  {
    key: "memory",
    label: "记忆确认",
    shortLabel: "记忆",
    title: "记忆确认",
  },
] as const satisfies readonly WorkspaceModuleDefinition[];

export const WORKSPACE_MODULES = [
  ...PRIMARY_WORKSPACE_MODULES,
  ...AUXILIARY_WORKSPACE_MODULES,
] as const satisfies readonly WorkspaceModuleDefinition[];

export function getWorkspaceModuleTitle(moduleKey: WorkspaceModuleKey): string {
  return (
    WORKSPACE_MODULES.find((module) => module.key === moduleKey)?.title ??
    PRIMARY_WORKSPACE_MODULES[0].title
  );
}
