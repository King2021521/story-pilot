# P5 正文生产与创作者编辑工作台 Spec

## 目标

把章节页从基础文本编辑器升级为生产级创作者工作台：用户可以从章纲生成正文、审阅 AI 产物、局部改写、保存版本、抽取记忆、确认 canon，并继续下一章。

## 当前缺口

- 章节编辑器已有基础保存、版本和生成草稿，但缺少局部改写、diff、质量审阅和批量生产。
- AI 草稿应用后没有足够强的“生成后校验 -> 记忆抽取 -> 用户确认 -> 图谱更新 -> 下一章上下文”闭环。
- 章节与 chapter plan、scene plan、plotline、foreshadowing 的绑定还不够强。
- 对百万字连载需要的批次生产、复盘和节奏控制不足。

## 生产级补强重点

P5 的生产级目标是让创作者每天都能稳定推进正文，而不是偶尔生成一段文本。正文工作台必须保护用户文本、承接大纲和记忆，并把章节变化回流到下一章上下文。

必须补强：

- 正文生成必须从 chapter plan 进入，并在生成前构建 context package。
- AI 草稿以 artifact 预览，不直接覆盖正文。
- artifact 支持 diff、应用全部、应用选中段落、拒绝、重试和原因记录。
- 局部改写必须绑定 base version 和选区，避免覆盖用户新写内容。
- 应用草稿或 patch 后必须创建 chapter version、章节摘要、memory candidates 和图谱投影任务。
- 批量生产以 3/5/10 章为单位，但每章默认停在用户审稿节点。

不可降级项：

- AI 不能直接覆盖用户正文。
- 没有版本和恢复能力时不能开放批量生产。
- 应用正文后没有摘要和记忆候选时，下一章上下文不能标记 ready。
- 过期 base version 的 patch 必须拒绝应用。

## 生产投入补强方案

P5 的目标是让创作者能日常连续生产正文。完成 P5 后，平台不只是“生成一章”，而是能从章纲进入草稿、审稿、改写、应用、记忆回流、下一章准备的闭环。

必须补强的闭环：

| 补强项     | 生产标准                                                    | 失败处理                                      |
| ---------- | ----------------------------------------------------------- | --------------------------------------------- |
| 章纲驱动   | 正文生成只能从 ready chapter plan 发起                      | chapter plan 不完整时返回 gate 错误           |
| 草稿隔离   | AI 正文先进入 artifact 和 chapter_draft                     | 不能直接覆盖 chapter.content                  |
| Diff 应用  | 支持整章应用、选段应用、拒绝、重试和原因记录                | base version 不一致时拒绝 patch               |
| 局部改写   | polish、expand、compress、conflict、hook、voice、continuity | 改写结果仍以 patch artifact 形式等待确认      |
| 版本恢复   | 每次应用草稿或 patch 都生成 chapter version                 | 保存失败时保留 artifact 和原正文              |
| 生成后回流 | 摘要、记忆候选、连续性问题和图谱投影任务自动生成            | 回流失败时下一章 context readiness 不可 ready |
| 批量生产   | 3/5/10 章批次排队，每章停在用户审稿节点                     | 任一章 error 不阻断已完成章，但暂停后续生产   |

工程落点：

- `apps/sidecar` 的 chapter production service 编排生成、审稿、diff、apply、summary、memory extraction。
- `packages/db` 新增 draft、patch、summary、batch 表和版本一致性约束。
- `packages/ai` 新增章节正文、局部改写、质量审稿、记忆抽取 prompt、schema、eval。
- 前端编辑器提供章节树、正文编辑、artifact 预览、diff、版本、质量报告和批次队列。

阶段出口：

- 用户可以连续完成至少 10 章“章纲 -> 草稿 -> 审稿 -> 应用 -> 摘要 -> 记忆候选”的闭环。
- 任意 AI 改写都不能覆盖用户在新版本中的手工修改。
- 进入下一章前，系统能显示上一章摘要、已确认记忆、未处理风险和上下文 ready 状态。

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

## 当前可复用实现

- `apps/desktop/src/features/chapter/ChapterEditorPage.tsx`：已有章节编辑、保存、生成草稿、版本抽屉基础。
- `apps/desktop/src/features/ai/ArtifactReviewPanel.tsx`：已有 artifact 预览和应用基础。
- `apps/desktop/src/features/memory/MemoryCandidateList.tsx`：已有记忆候选确认基础。
- `apps/sidecar/src/chapter/chapter.service.ts`：已有章节 CRUD、版本、基于章纲生成草稿。
- `apps/sidecar/src/artifact/artifact.service.ts`：已有 artifact 应用基础。
- `apps/sidecar/src/memory/memory.service.ts`：已有记忆确认和图谱 rebuild。
- `packages/domain/src/chapter-version.ts`：已有章节版本递增规则。

## 实施切片

### P5.1 章纲驱动正文生产

产物：

- `chapter.generateDraftFromPlan` 替代临时 chapterId 生成。
- 章节生成前强制检查 chapter plan gate。
- draft artifact 绑定 chapterPlanId、contextPackageId、workflowRunId。

验证：

- 没有 chapter plan 时生成失败。
- draft 不直接覆盖 chapter content。

### P5.2 Artifact Diff 和 Patch

产物：

- artifact 与当前正文 diff。
- 支持应用全部、应用选中段落、拒绝并记录原因。
- 局部改写产物为 `rewrite_patches`。

验证：

- 应用 patch 后创建新 chapter version。
- 过期 baseVersion 拒绝覆盖。

### P5.3 质量审阅和记忆回流

产物：

- `chapter.reviewQuality` 输出 score 和维度。
- 应用正文后生成 chapter summary。
- memory_extract 产生候选，用户确认后增量投影图谱。

验证：

- 应用 draft 后一定生成 summary 或失败原因。
- pending memory candidates 出现在右侧面板。

### P5.4 写作批次

产物：

- `writingBatch.create` 创建 3/5/10 章批次。
- 批次状态可暂停、继续、失败重试。
- 批次完成后进入 retrospective。

验证：

- 连续 10 章 draft_and_review E2E 通过。

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

## 阶段验证清单

完成 P5 时必须保存以下证据：

- `pnpm --filter @story-pilot/domain test`
- `pnpm --filter @story-pilot/db test`
- `pnpm --filter @story-pilot/ai test`
- `pnpm --filter @story-pilot/sidecar test`
- `pnpm --filter @story-pilot/desktop test`
- 10 章连续生产 E2E 输出。

## 验收标准

- 正文生成必须从 chapter plan 进入。
- AI 产物不会直接覆盖用户正文。
- 每次应用 draft 或 patch 都生成版本。
- 生成后必须有摘要和记忆候选流程。
- 用户可以连续完成至少 10 章的生产、审阅、保存和记忆确认。
