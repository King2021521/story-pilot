# P5 正文生产与创作者编辑工作台 Spec

## 目标

把章节页从基础文本编辑器升级为生产级创作者工作台：用户可以从章纲生成正文、审阅 AI 产物、局部改写、保存版本、抽取记忆、确认 canon，并继续下一章。

## 当前缺口

- 章节编辑器已有基础保存、版本和生成草稿，但缺少局部改写、diff、质量审阅和批量生产。
- AI 草稿应用后没有足够强的“生成后校验 -> 记忆抽取 -> 用户确认 -> 图谱更新 -> 下一章上下文”闭环。
- 章节与 chapter plan、scene plan、plotline、foreshadowing 的绑定还不够强。
- 对百万字连载需要的批次生产、复盘和节奏控制不足。

## 范围

本阶段必须完成：

- 章纲驱动正文生成。
- artifact diff 和应用。
- 局部改写。
- 章节质量审阅。
- 生成后记忆抽取。
- 章节摘要和下一章提示。
- 批量章节生产队列。
- 编辑器状态持久化。

本阶段不做：

- 实时多人协同编辑。
- 富文本排版编辑器。
- 网文平台直发。

## 正文生产主流程

```text
选择 chapter plan
生成 chapter draft artifact
AI continuity review
AI quality review
用户预览 artifact
用户局部改写或整体重试
用户应用正文到 chapter
保存 chapter version
抽取 memory candidates
用户确认 memory
图谱增量投影
生成 chapter summary
刷新下一章 context readiness
```

任何一步失败都必须保留已完成产物，不能丢失用户正文。

## 编辑器能力

### 章节编辑区

- 章节树。
- 当前章节标题、状态、版本。
- 正文 textarea 或 Monaco/CodeMirror 文本编辑器。
- 自动保存草稿。
- 手动保存正式版本。
- 版本列表和恢复。

### AI 产物区

- artifact 列表。
- 草稿预览。
- 与当前正文 diff。
- 应用全部。
- 应用选中段落。
- 拒绝并记录原因。

### 局部改写

输入：

- 选中文本。
- 改写目标：润色、扩写、压缩、增强冲突、增强钩子、调整人物语气、修复连续性。
- 风格强度。

输出：

- patch artifact。
- 修改说明。
- 风险提示。

### 质量审阅

维度：

- 章节目标完成度。
- 冲突强度。
- 信息增量。
- 情绪回报。
- 章末钩子。
- 人物语气一致性。
- 设定一致性。
- 重复表达。
- 节奏拖沓。

评分：

```ts
interface ChapterQualityReport {
  score: number;
  dimensions: Array<{
    key: string;
    label: string;
    score: number;
    evidence: string;
    suggestion: string;
  }>;
  blockingIssues: ContinuityIssue[];
  rewriteSuggestions: string[];
}
```

## 数据模型

新增或强化表：

```ts
chapter_drafts(
  id text primary key,
  project_id text not null,
  chapter_id text not null,
  chapter_plan_id text,
  artifact_id text not null,
  status text not null,             -- generated | applied | rejected | superseded
  quality_report_id text,
  continuity_report_id text,
  created_at integer not null,
  updated_at integer not null
)

rewrite_patches(
  id text primary key,
  project_id text not null,
  chapter_id text not null,
  source_version integer not null,
  selected_range_json text not null,
  instruction text not null,
  patch_text text not null,
  artifact_id text not null,
  status text not null,             -- proposed | applied | rejected
  created_at integer not null,
  updated_at integer not null
)

chapter_summaries(
  id text primary key,
  project_id text not null,
  chapter_id text not null,
  chapter_version integer not null,
  short_summary text not null,
  long_summary text not null,
  key_events_json text not null,
  changed_entities_json text not null,
  open_hooks_json text not null,
  created_at integer not null
)

writing_batches(
  id text primary key,
  project_id text not null,
  start_chapter_index integer not null,
  chapter_count integer not null,
  status text not null,             -- planned | running | waiting_user | completed | failed
  created_at integer not null,
  updated_at integer not null
)
```

## API

```ts
chapter.generateDraftFromPlan(input: {
  projectId: string;
  chapterPlanId: string;
  instruction?: string;
}): {
  workOrderId: string;
  workflowRunId: string;
}

chapter.applyDraft(input: {
  projectId: string;
  chapterId: string;
  draftId: string;
  mode: "replace" | "append" | "selected_ranges";
  selectedRanges?: Array<{ start: number; end: number }>;
}): ChapterRecord

chapter.rewriteSelection(input: {
  projectId: string;
  chapterId: string;
  baseVersion: number;
  range: { start: number; end: number };
  mode:
    | "polish"
    | "expand"
    | "compress"
    | "strengthen_conflict"
    | "strengthen_hook"
    | "voice_fix"
    | "continuity_fix";
  instruction?: string;
}): ArtifactRecord

chapter.reviewQuality(input: {
  projectId: string;
  chapterId: string;
  version: number;
}): ChapterQualityReport

writingBatch.create(input: {
  projectId: string;
  startChapterPlanId: string;
  chapterCount: 3 | 5 | 10;
  mode: "draft_only" | "draft_and_review";
}): WritingBatchRecord
```

## 前端设计

章节工作台采用三栏：

- 左栏：章节树和大纲状态。
- 中栏：正文编辑器。
- 右栏：AI 产物、质量报告、连续性问题、记忆候选。

关键交互：

- 未绑定 chapter plan 的章节，生成按钮禁用并提示先创建章纲。
- 生成草稿后默认进入 artifact 预览，不直接覆盖正文。
- 应用正文后立即生成摘要和记忆候选。
- 用户离开页面前，未保存修改必须提示。

## 测试用例

单元测试：

- `chapter.applyDraft` 在 base version 过期时拒绝覆盖。
- `rewriteSelection` 对非法 range 返回校验错误。
- 质量报告 score 必须在 0-100。
- 应用 draft 后创建 chapter version。

集成测试：

```text
1. 创建 chapter plan。
2. 调用 chapter.generateDraftFromPlan。
3. 生成 chapter_draft artifact。
4. 应用 draft。
5. 创建 chapter version。
6. 抽取 memory candidates。
7. graph.projectSinceCheckpoint 执行。
```

E2E：

```text
1. 从大纲页选择第 1 章。
2. 点击生成正文。
3. 打开 artifact 预览。
4. 查看质量报告。
5. 选中一段执行“增强冲突”。
6. 应用 patch。
7. 保存章节。
8. 确认记忆候选。
9. 进入第 2 章时上下文 readiness 更新。
```

## 验收标准

- 正文生成必须从 chapter plan 进入。
- AI 产物不会直接覆盖用户正文。
- 每次应用 draft 或 patch 都生成版本。
- 生成后必须有摘要和记忆候选流程。
- 用户可以连续完成至少 10 章的生产、审阅、保存和记忆确认。
