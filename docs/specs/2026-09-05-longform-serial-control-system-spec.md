# Story Pilot 500 万字长篇连载控制系统 Spec

## 1. 背景与目标

Story Pilot 当前已经具备 9 个创作步骤：总控台、基本信息、世界观设计、核心故事、角色设计、故事线设计、全书大纲、剧情节点、章节规划、正文创作。现有流程可以完成长篇小说的前期策划，并通过 AI 生成世界观、核心故事、人物候选、故事线、全书规划、滚动章纲和正文草稿。

但 500 万字级连载不是一次性生成长大纲的问题。它需要系统持续管理故事燃料、人物状态、剧情债、伏笔回收、节奏疲劳、上下文预算和章节质量。本文档定义一层新增的“长篇连载控制系统”，在不推翻当前 9 步流程的前提下，把 Story Pilot 从单点生成器升级为可持续创作系统。

目标：

- 支撑 300 万到 500 万字级长篇项目的规划、滚动创作和连续性维护。
- 让 AI 生成依赖结构化上下文，而不是只依赖用户当前页面输入。
- 每章生成前有明确执行卡，每章生成后有状态更新、剧情债更新、记忆抽取和质量审阅。
- 前端保持大众创作软件的使用习惯：列表优先、表单弹窗、长文本单列、右侧 Inspector 辅助，不把用户困在复杂卡片堆里。
- 所有 AI 输出先进入可审阅产物或候选区，用户确认后再进入正式创作数据。

## 2. 当前实现衔接

当前实现中可以复用的基础：

- `project_briefs` 已包含题材、平台、篇幅、预计字数、预计章节数、目标读者和初始灵感。
- `worldbuilding_profiles` 已保存 12 个世界观维度，字段上限 500 字。
- `story_blueprints` 已保存核心故事契约，包括 premise、logline、corePromise、mainGoal、mainConflict、protagonistArc、antagonistForce、stakes、storyDriver、emotionalAxes、differentiators、risks。
- `characters` 已覆盖人物定位、重要程度、叙事功能、剧情任务、关系钩子、三段弧光、外貌和小传。
- `plotlines`、`plotline_nodes` 已覆盖故事线档案和节点编排。
- `story_events`、`foreshadowings`、`conflicts` 已能承载剧情节点、伏笔和冲突对象。
- `book_plans`、`volume_plans`、`arc_plans`、`chapter_plans`、`scene_plans` 已能承载全书、分卷、阶段弧线、章节和场景规划。
- `review_issues` 可以复用为质量问题、连续性问题和门禁问题的统一承载表。
- `retrospectives` 可以复用为阶段复盘结果表，但需要扩展结构化字段。
- `model_calls`、`artifacts`、`workflow_runs` 已经支持 AI 调用审计、产物隔离和工作流状态。
- `PromptTemplateRegistry` 当前只覆盖 `worldbuilding.complete` 与 `core-story.complete`，后续新增能力必须迁移到同一模板体系。

需要补齐的关键缺口：

- 缺少章节执行卡，正文生成入口仍不够强约束。
- 缺少每章后的故事状态快照和人物状态快照。
- 伏笔、悬念、承诺和爽点没有统一成为“剧情债务账本”。
- 冲突池存在表基础，但没有成为章节规划和复盘的核心发动机。
- 阶段复盘粒度不够结构化，不能稳定判断水化、重复和读者承诺兑现。
- 上下文包缺少可审计的构建记录，不利于定位 AI 生成质量问题。

## 3. 产品信息架构

保留当前左侧作品树和 9 个主创作步骤，不新增复杂一级菜单。新增能力按使用场景落在现有页面里。

| 位置           | 调整方向                           | 目的                                                       |
| -------------- | ---------------------------------- | ---------------------------------------------------------- |
| 总控台         | 升级为“连载总控台”                 | 展示故事健康度、当前阶段、剧情债、人物状态风险、下一步建议 |
| 角色设计       | 保持列表优先，增加“状态时间线”入口 | 区分静态人物档案和动态连载状态                             |
| 故事线设计     | 增加冲突池、剧情债关联视图         | 让故事线持续生产冲突，而不是只做静态说明                   |
| 全书大纲       | 保持 Book/Volume/Arc 分层          | 作为长期结构，不承担每章细节                               |
| 剧情节点       | 统一管理事件、伏笔、剧情债和回收   | 让节点服务后续章纲和审稿                                   |
| 章节规划       | 新增章节执行卡和滚动规划批次       | 生成正文前的必经步骤                                       |
| 正文创作       | 新增审稿、状态更新、记忆抽取回流   | 形成每章闭环                                               |
| 右侧 Inspector | 增加状态、剧情债、AI 产物、工具箱  | 保持窄侧栏辅助，不抢占主工作区                             |

## 4. 前端交互设计

### 4.1 总控台

总控台是长篇项目的默认入口。它不再只是状态数字，而是创作者每天打开应用后判断“今天该写什么、哪里有风险”的页面。

布局：

- 顶部：作品标题、目标字数、预计章节、当前章节、当前卷、当前阶段。
- 第一行：故事健康度、上下文准备度、剧情债风险、人物状态风险。
- 第二行：下一步行动，包括生成下一批章纲、补齐人物状态、处理剧情债、开始正文。
- 主区域：当前卷进度、未来 20 章规划摘要、打开的剧情债、最近 5 章状态变化。
- 右侧 Inspector：状态、剧情债、AI 产物、工具箱。

交互规则：

- 卡片只用于状态摘要和列表项，不用于堆砌表单。
- 所有“处理风险”按钮必须能跳转到具体对象或打开对应弹窗。
- 总控台的 AI 建议只给下一步动作，不直接修改 canon。

### 4.2 角色设计

角色设计继续采用“列表页 + 新建/编辑弹窗”的通用模式。

新增交互：

- 角色行展示：姓名、定位、重要程度、当前状态摘要、最近变化、风险标记。
- 行操作：查看状态、编辑档案、更新状态、删除。
- “状态时间线”以抽屉或弹窗展示，按章节列出目标、资源、关系、认知、情绪和伤势变化。
- 新建角色和 AI 生成角色候选仍使用弹窗，不回到左右两栏强行并排的设计。

### 4.3 故事线设计

故事线设计继续采用列表优先。

新增交互：

- 故事线列表展示主线、支线、反派线、情感线、世界线和状态。
- 故事线详情展示核心问题、驱动力、阶段升级、回收计划、关联剧情债。
- “新增节点”“新增剧情债”“生成冲突升级”都通过弹窗完成。
- 用户点击故事线行进入详情，不在同一屏塞满多个编辑表单。

### 4.4 全书大纲

全书大纲负责宏观结构，不负责单章正文细节。

页面结构：

- 左侧或顶部为层级筛选：全书、卷、阶段弧线。
- 主区域默认展示列表和详情。
- 新建全书计划、新建卷、新建弧线、AI 生成全书规划均使用弹窗。
- 详情区域展示结构化字段和影响范围，不直接把所有字段铺成巨大表单。

### 4.5 剧情节点

剧情节点页面要统一事件、伏笔和剧情债。

页面结构：

- 顶部筛选：事件、伏笔、剧情债、待回收、风险高。
- 默认展示列表，行内提供查看、编辑、删除、标记回收。
- 新建事件、新建伏笔、新建剧情债都使用弹窗。
- 详情页展示关联故事线、角色、章节计划、当前状态和回收建议。

### 4.6 章节规划

章节规划是正文生产前的核心入口。

新增“滚动规划批次”：

- 用户选择目标卷、阶段弧线、起始章节、生成章数。
- AI 生成未来 10 到 20 章 chapter plan 和 scene plan。
- 用户可以逐章编辑、批量采纳、批量退回。

新增“章节执行卡”：

- 每章进入正文前必须有执行卡。
- 执行卡默认从 chapter plan 生成，用户可编辑。
- 执行卡字段以单列长文本为主，必要枚举用下拉选择。

### 4.7 正文创作

正文创作页面以“章节文本”为中心，AI 产物在旁边作为候选。

交互流程：

1. 选择已通过门禁的章节执行卡。
2. 点击生成正文草稿。
3. AI 草稿进入 artifact，不覆盖正文。
4. 用户查看 diff，可以应用全文、应用选段、拒绝或重试。
5. 应用后创建 chapter version。
6. 系统抽取记忆候选、剧情债变化和人物状态变化。
7. 用户确认后进入 canon 或状态快照。

## 5. 业务流程

### 5.1 新作品到正文前

```text
创建作品
填写基本信息
AI 补全世界观
AI 补全核心故事
创建主要角色
创建故事线和冲突池
生成全书规划
生成当前卷和阶段弧线
生成未来 10-20 章章纲
生成第 1 章执行卡
进入正文创作
```

### 5.2 单章生产闭环

```text
选择 chapter plan
构建 context package
生成 chapter execution card
用户确认执行卡
生成正文 draft artifact
执行连续性审阅
执行章节质量审阅
用户应用或退回 AI 产物
保存 chapter version
抽取 memory candidates
抽取 state deltas
更新 plot debts
生成 chapter summary
刷新下一章 context readiness
```

### 5.3 阶段复盘

每 10、20、50 章触发一次不同粒度复盘。

| 复盘粒度 | 触发点           | 重点                               |
| -------- | ---------------- | ---------------------------------- |
| 10 章    | 每批滚动章纲结束 | 节奏、钩子、信息增量、重复冲突     |
| 20 章    | 一个小弧线结束   | 人物变化、伏笔强化、支线推进       |
| 50 章    | 一个阶段结束     | 读者承诺兑现、阶段高潮、下阶段升级 |

复盘结果不自动改写大纲，而是生成可采纳建议和待处理风险。

## 6. 数据模型设计

### 6.1 章节执行卡

```sql
create table if not exists chapter_execution_cards (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  chapter_plan_id text not null references chapter_plans(id) on delete cascade,
  chapter_id text references chapters(id) on delete set null,
  chapter_index integer not null,
  title text not null,
  narrative_goal text not null,
  core_conflict text not null,
  information_gain text not null,
  emotional_turn text not null,
  reader_reward text not null,
  hook text not null,
  pov_character_id text,
  required_character_ids_json text not null default '[]',
  required_location_ids_json text not null default '[]',
  related_plotline_ids_json text not null default '[]',
  related_foreshadowing_ids_json text not null default '[]',
  related_plot_debt_ids_json text not null default '[]',
  scene_brief_json text not null default '[]',
  forbidden_moves_json text not null default '[]',
  target_word_count integer not null,
  status text not null default 'draft',
  version integer not null default 1,
  source_artifact_id text,
  created_at integer not null,
  updated_at integer not null
);
```

### 6.2 故事状态快照

```sql
create table if not exists story_state_snapshots (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  chapter_id text references chapters(id) on delete set null,
  chapter_index integer not null,
  story_time text,
  current_volume_id text,
  current_arc_plan_id text,
  global_situation text not null,
  active_conflicts_json text not null default '[]',
  open_questions_json text not null default '[]',
  revealed_information_json text not null default '[]',
  hidden_information_json text not null default '[]',
  resource_state_json text not null default '{}',
  location_state_json text not null default '{}',
  organization_state_json text not null default '{}',
  source_chapter_version integer,
  created_at integer not null
);
```

### 6.3 人物状态快照

```sql
create table if not exists character_state_snapshots (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  character_id text not null references characters(id) on delete cascade,
  chapter_id text references chapters(id) on delete set null,
  chapter_index integer not null,
  external_goal text not null default '',
  internal_need text not null default '',
  physical_state text not null default '',
  emotional_state text not null default '',
  knowledge_state text not null default '',
  relationship_state_json text not null default '{}',
  resource_state_json text not null default '{}',
  secrets_json text not null default '[]',
  position text not null default '',
  risk_flags_json text not null default '[]',
  source_type text not null,
  source_id text not null,
  created_at integer not null
);
```

### 6.4 剧情债务账本

```sql
create table if not exists plot_debts (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  title text not null,
  debt_type text not null,
  promise text not null,
  seed_chapter_index integer,
  expected_payoff_chapter_index integer,
  actual_payoff_chapter_index integer,
  status text not null default 'open',
  risk_level text not null default 'medium',
  related_plotline_id text,
  related_character_ids_json text not null default '[]',
  related_foreshadowing_id text,
  related_world_rule_ids_json text not null default '[]',
  lifecycle_notes_json text not null default '[]',
  created_at integer not null,
  updated_at integer not null
);
```

`debt_type` 枚举：

- `foreshadowing`
- `mystery`
- `reader_promise`
- `relationship`
- `world_rule`
- `conflict`
- `reward`

`status` 枚举：

- `open`
- `reinforced`
- `payoff_ready`
- `paid_off`
- `dropped`

### 6.5 上下文包审计

```sql
create table if not exists generation_context_packages (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  target_type text not null,
  target_id text not null,
  purpose text not null,
  token_budget integer not null,
  estimated_tokens integer not null,
  strategy text not null,
  items_json text not null,
  omitted_items_json text not null default '[]',
  created_at integer not null
);
```

### 6.6 复盘结构化扩展

优先复用 `retrospectives`，新增结构化字段或建立伴随表：

```sql
create table if not exists serial_reviews (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  scope text not null,
  start_chapter_index integer not null,
  end_chapter_index integer not null,
  progress_summary text not null,
  promise_delivery_json text not null default '[]',
  rhythm_report_json text not null default '{}',
  repetition_risks_json text not null default '[]',
  character_stagnation_json text not null default '[]',
  plot_debt_risks_json text not null default '[]',
  next_actions_json text not null default '[]',
  status text not null default 'draft',
  source_artifact_id text,
  created_at integer not null,
  updated_at integer not null
);
```

## 7. RPC 与服务设计

### 7.1 新增命令

```ts
serial.getDashboard(input: { projectId: string }): SerialDashboardView

context.buildPackage(input: {
  projectId: string;
  targetType: "chapter_plan" | "execution_card" | "chapter";
  targetId: string;
  purpose:
    | "execution_card_generate"
    | "chapter_draft"
    | "chapter_review"
    | "state_extract"
    | "retrospective_generate";
  tokenBudget?: number;
}): GenerationContextPackage

chapterExecutionCard.generate(input: {
  projectId: string;
  chapterPlanId: string;
  instruction?: string;
}): ArtifactRecord

chapterExecutionCard.apply(input: {
  projectId: string;
  artifactId: string;
}): ChapterExecutionCardRecord

chapterExecutionCard.save(input: {
  projectId: string;
  cardId?: string;
  values: ChapterExecutionCardValues;
}): ChapterExecutionCardRecord

chapter.reviewDraft(input: {
  projectId: string;
  chapterId: string;
  artifactId?: string;
  chapterVersion?: number;
}): ArtifactRecord

storyState.extractDelta(input: {
  projectId: string;
  chapterId: string;
  chapterVersion: number;
}): ArtifactRecord

storyState.applyDelta(input: {
  projectId: string;
  artifactId: string;
}): {
  storySnapshot: StoryStateSnapshotRecord;
  characterSnapshots: CharacterStateSnapshotRecord[];
  plotDebtChanges: PlotDebtRecord[];
}

plotDebt.list(input: {
  projectId: string;
  status?: PlotDebtStatus[];
  riskLevel?: PlotDebtRiskLevel[];
}): { items: PlotDebtRecord[] }

plotDebt.save(input: {
  projectId: string;
  debtId?: string;
  values: PlotDebtValues;
}): PlotDebtRecord

serialReview.generate(input: {
  projectId: string;
  scope: "chapter_batch" | "arc" | "volume";
  startChapterIndex: number;
  endChapterIndex: number;
}): ArtifactRecord

serialReview.apply(input: {
  projectId: string;
  artifactId: string;
}): SerialReviewRecord
```

### 7.2 服务边界

| 服务                          | 职责                                           |
| ----------------------------- | ---------------------------------------------- |
| `ContextPackageService`       | 决定每次 AI 调用注入哪些上下文，并写入审计记录 |
| `ChapterExecutionCardService` | 生成、保存、采纳章节执行卡                     |
| `StoryStateService`           | 管理故事状态快照和人物状态快照                 |
| `PlotDebtService`             | 管理伏笔、悬念、承诺和爽点债务                 |
| `SerialReviewService`         | 生成和采纳阶段复盘                             |
| `ChapterProductionService`    | 编排执行卡、正文草稿、审稿、状态抽取、回流     |
| `CreativeGateService`         | 判断章节是否具备进入正文生成的条件             |

## 8. AI Prompt 与 Schema 设计

### 8.1 模板注册策略

所有正式生成能力必须进入 `PromptTemplateRegistry`，不再把核心 prompt 分散在业务服务中拼接。

新增模板 ID：

```ts
export const PROMPT_TEMPLATE_IDS = [
  "worldbuilding.complete",
  "core-story.complete",
  "book-plan.generate",
  "rolling-chapter-plan.generate",
  "chapter-execution-card.generate",
  "chapter-draft.generate",
  "chapter-review.generate",
  "story-state-delta.extract",
  "plot-debt.update",
  "serial-review.generate",
  "element-candidate.generate",
] as const;
```

模板组成：

- shared system：`global-writer-system.v1.md`
- shared canon：`canon-boundary.v1.md`
- capability system：独立 Markdown prompt
- user message：由模板变量渲染，不在服务里手写长 prompt

### 8.2 通用变量

所有长篇相关模板共享这些变量名：

| 变量                   | 含义                                   |
| ---------------------- | -------------------------------------- |
| `project`              | 标题、题材、风格、目标字数、预计章节   |
| `brief`                | 立项信息和读者定位                     |
| `worldbuildingProfile` | 12 维世界观                            |
| `blueprint`            | 核心故事契约                           |
| `characters`           | 静态人物档案                           |
| `characterStates`      | 当前人物状态快照                       |
| `plotlines`            | 故事线档案和节点                       |
| `plotDebts`            | 当前未完成剧情债                       |
| `conflicts`            | 冲突池                                 |
| `longformPlans`        | book、volume、arc、chapter、scene plan |
| `recentChapters`       | 最近章节摘要，不直接传全部正文         |
| `contextPackage`       | 本次生成实际采用的上下文包             |
| `currentArtifact`      | 当前待审阅 AI 产物                     |
| `userInstruction`      | 用户在页面输入的额外要求               |

### 8.3 章节执行卡模板

能力：`chapter_execution_card_generate`

目的：把 chapter plan 转成可直接约束正文生成的执行卡。

输入变量：

- `project`
- `brief`
- `worldbuildingProfile`
- `blueprint`
- `chapterPlan`
- `scenePlans`
- `characterStates`
- `plotDebts`
- `conflicts`
- `recentChapters`
- `userInstruction`

输出 schema：

```ts
const ChapterExecutionCardOutputSchema = z.object({
  card: z.object({
    chapterIndex: z.number().int().positive(),
    title: z.string().min(1).max(80),
    narrativeGoal: z.string().min(80).max(500),
    coreConflict: z.string().min(80).max(500),
    informationGain: z.string().min(50).max(400),
    emotionalTurn: z.string().min(50).max(400),
    readerReward: z.string().min(50).max(400),
    hook: z.string().min(40).max(240),
    povCharacterId: z.string().optional(),
    requiredCharacterIds: z.array(z.string()).default([]),
    requiredLocationIds: z.array(z.string()).default([]),
    relatedPlotlineIds: z.array(z.string()).default([]),
    relatedForeshadowingIds: z.array(z.string()).default([]),
    relatedPlotDebtIds: z.array(z.string()).default([]),
    sceneBriefs: z
      .array(
        z.object({
          sceneIndex: z.number().int().positive(),
          sceneGoal: z.string().min(30).max(240),
          conflictTurn: z.string().min(30).max(240),
          outcome: z.string().min(30).max(240),
          memoryTargets: z.array(z.string().min(1).max(120)).default([]),
        }),
      )
      .min(1),
    forbiddenMoves: z.array(z.string().min(1).max(160)).default([]),
    targetWordCount: z.number().int().min(1000).max(12000),
  }),
  riskNotes: z.array(z.string().min(1).max(200)).default([]),
});
```

Prompt 约束：

- 不写正文。
- 不创造已存在设定的反向事实。
- 每章必须有明确读者回报和章末钩子。
- 如果上下文不足，必须写入 `riskNotes`，不能用空泛设定补洞。

### 8.4 正文草稿模板

能力：`chapter_draft`

输入必须以 `chapterExecutionCard` 为核心，不允许只用宏观设定生成正文。

输出 schema 保持 artifact 隔离：

```ts
const ChapterDraftOutputSchema = z.object({
  title: z.string().min(1).max(80),
  content: z.string().min(1500),
  summary: z.string().min(80).max(800),
  usedContext: z.array(z.string().min(1)).default([]),
  memoryTargets: z.array(z.string().min(1).max(160)).default([]),
  riskNotes: z.array(z.string().min(1).max(200)).default([]),
});
```

参数建议：

- `maxOutputTokens`: 12000 起，允许用户在设置中提高到 20000。
- `temperature`: 0.75 到 0.85。
- `topP`: 默认不设置，除非 provider 需要。
- 长正文生成失败时只重试 schema 解析，不自动改变故事事实。

### 8.5 审稿模板

能力：`chapter_review`

输出：

```ts
const ChapterReviewOutputSchema = z.object({
  score: z.number().min(0).max(100),
  dimensions: z.array(
    z.object({
      key: z.enum([
        "plan_fit",
        "conflict",
        "information_gain",
        "emotional_reward",
        "hook",
        "character_voice",
        "canon_consistency",
        "pacing",
      ]),
      score: z.number().min(0).max(100),
      evidence: z.string().min(1).max(500),
      suggestion: z.string().min(1).max(500),
    }),
  ),
  blockingIssues: z.array(
    z.object({
      issueType: z.string().min(1),
      severity: z.enum(["info", "warning", "error"]),
      message: z.string().min(1).max(500),
      relatedEntityIds: z.array(z.string()).default([]),
    }),
  ),
  rewriteSuggestions: z.array(z.string().min(1).max(200)).default([]),
});
```

Prompt 约束：

- 必须逐项检查执行卡目标是否兑现。
- `error` 级问题必须能定位到文本证据或 canon 冲突。
- 不直接改写正文，只给审稿报告和改写建议。

### 8.6 状态抽取模板

能力：`story_state_delta_extract`

职责：

- 从已应用章节中抽取状态变化。
- 只抽取正文明确发生或强暗示的信息。
- 未确认信息进入候选，不直接成为 canon。

输出：

```ts
const StoryStateDeltaOutputSchema = z.object({
  storyDelta: z.object({
    globalSituationChange: z.string().max(800).default(""),
    revealedInformation: z.array(z.string().max(160)).default([]),
    hiddenInformation: z.array(z.string().max(160)).default([]),
    resourceChanges: z.array(z.string().max(160)).default([]),
    locationChanges: z.array(z.string().max(160)).default([]),
    organizationChanges: z.array(z.string().max(160)).default([]),
  }),
  characterDeltas: z.array(
    z.object({
      characterId: z.string().min(1),
      externalGoal: z.string().max(300).optional(),
      internalNeed: z.string().max(300).optional(),
      physicalState: z.string().max(300).optional(),
      emotionalState: z.string().max(300).optional(),
      knowledgeState: z.string().max(300).optional(),
      relationshipChanges: z.array(z.string().max(160)).default([]),
      resourceChanges: z.array(z.string().max(160)).default([]),
      riskFlags: z.array(z.string().max(120)).default([]),
    }),
  ),
  plotDebtDeltas: z.array(
    z.object({
      plotDebtId: z.string().optional(),
      title: z.string().min(1).max(120),
      action: z.enum(["create", "reinforce", "payoff", "drop", "risk_raise"]),
      note: z.string().min(1).max(300),
    }),
  ),
  memoryCandidates: z.array(z.string().min(1).max(300)).default([]),
});
```

### 8.7 阶段复盘模板

能力：`serial_review_generate`

职责：

- 判断过去一批章节是否兑现读者承诺。
- 识别重复冲突、水化、人物停滞、剧情债拖延。
- 给出下一阶段可执行建议。

参数建议：

- `maxOutputTokens`: 8000。
- `temperature`: 0.35。
- 复盘是诊断任务，不追求高随机性。

## 9. 上下文包策略

AI 生成质量的关键不是一次塞入更多文本，而是每次有稳定的上下文预算策略。

上下文优先级：

1. 当前目标对象：执行卡、章纲或待审稿正文。
2. 当前 Book/Volume/Arc 规划。
3. 世界观 12 维和核心故事契约的摘要。
4. 当前章节相关人物状态。
5. 当前剧情债和伏笔。
6. 最近 3 到 5 章摘要。
7. 图谱邻域和相关 canon。
8. 相似历史摘要。
9. 用户本次额外指令。

预算规则：

- 不把 500 万字正文全文塞入模型。
- 最近章节用摘要和状态变化，不默认用全文。
- canon 优先于 hypothesis。
- 如果超预算，保留结构化事实，舍弃长自然语言说明。
- 每次生成都保存 `generation_context_packages`，便于追查 AI 为什么写偏。

## 10. 门禁规则

进入正文生成前必须满足：

- 当前章节有 chapter plan。
- 当前章节有 chapter execution card。
- 至少一个相关角色有最新状态快照，或系统明确标记无相关角色。
- 当前章关联的 plot debt 风险没有 error。
- 当前上下文包可构建成功。

正文应用后必须触发：

- 创建 chapter version。
- 生成 chapter summary。
- 抽取 memory candidates。
- 抽取 story state delta。
- 更新 plot debt。
- 写入 review issues。

如果后置流程部分失败，章节正文不能丢失，但下一章 readiness 必须显示未完成项。

## 11. 前端验收标准

通用 UI 标准：

- 长文本表单默认单列展示。
- 列表对象默认列表页展示，新建和编辑通过弹窗完成。
- 删除动作必须二次确认。
- 右侧 Inspector 可折叠，只承载辅助状态、工具和 AI 产物，不放主编辑表单。
- 页面不能出现横向挤压、文字重叠或主区域被 Inspector 挤到不可用。
- AI 生成按钮必须明确说明生成对象，例如“生成章节执行卡”“生成阶段复盘”，不能只写“AI 生成”。
- AI 产物必须能预览、采纳、退回或重试。

章节执行卡页面标准：

- 默认进入章节计划列表。
- 点击章节行展示执行卡状态。
- “生成执行卡”打开弹窗确认上下文和用户补充要求。
- 执行卡生成后进入产物预览，不直接覆盖已有执行卡。
- 用户采纳后才写入 `chapter_execution_cards`。

剧情债页面标准：

- 列表支持按状态、风险等级、类型过滤。
- 行内显示埋设章节、预计回收章节、风险等级和关联对象。
- 编辑剧情债使用弹窗。
- 已拖延的高风险债务在总控台和 Inspector 同步提示。

状态快照页面标准：

- 用户主要从角色详情或总控台进入状态时间线。
- 时间线按章节展示变化，不要求用户手动维护所有字段。
- AI 抽取结果作为候选，用户确认后写入状态快照。

## 12. 端到端测试用例

### 12.1 新作品到执行卡

场景：创建一部“冰雪末世，打造安全屋，500 万字”的作品。

步骤：

1. 新建作品，填写题材、预计字数 5000000、预计章节数 1500、背景灵感。
2. 进入世界观设计，AI 补全 12 个字段，采纳后保存。
3. 进入核心故事，AI 补全故事契约，保存。
4. 进入角色设计，新建主角、关键盟友、主要对抗势力角色。
5. 进入故事线设计，新建主线、资源线、内部治理线、反派线。
6. 进入全书大纲，生成并采纳 Book/Volume/Arc 规划。
7. 进入章节规划，生成未来 20 章章纲。
8. 对第 1 章生成章节执行卡。

断言：

- `worldbuilding_profiles` 12 个字段全部非空。
- `story_blueprints` 有核心故事契约。
- `characters`、`plotlines`、`book_plans`、`chapter_plans` 均有记录。
- 第 1 章执行卡存在，且包含 readerReward、hook、relatedPlotDebtIds。
- 页面无重叠，主工作区可滚动，Inspector 可折叠。

### 12.2 单章生产闭环

步骤：

1. 从第 1 章执行卡点击生成正文草稿。
2. 草稿进入 artifact 预览。
3. 执行章节审稿。
4. 应用草稿到正文。
5. 系统生成 chapter version。
6. 系统抽取状态变化和记忆候选。
7. 用户确认状态变化。
8. 回到总控台查看下一章 readiness。

断言：

- 草稿未直接覆盖 `chapters.content`。
- 应用后 `chapter_versions` 新增一条记录。
- `story_state_snapshots` 新增记录。
- `character_state_snapshots` 至少新增主角记录。
- `plot_debts` 有 create、reinforce 或 payoff 变化。
- 总控台下一章 readiness 变为可继续或显示明确阻断项。

### 12.3 阶段复盘

步骤：

1. 构造 20 章已完成章节摘要和状态快照。
2. 触发 `serialReview.generate`。
3. 查看复盘产物。
4. 采纳复盘建议中的下一阶段动作。

断言：

- `serial_reviews` 新增记录。
- 复盘包含 promiseDelivery、rhythmReport、repetitionRisks、plotDebtRisks、nextActions。
- 高风险建议能跳转到剧情债、人物状态或章纲对象。

### 12.4 长篇性能合成测试

数据规模：

- 1 个项目。
- 10 个卷规划。
- 200 个阶段弧线。
- 1500 个章节计划。
- 4500 个场景计划。
- 120 个角色。
- 10000 条记忆或状态变化。
- 1000 条剧情债。

断言：

- 总控台加载小于 2 秒。
- 章节规划列表筛选小于 1 秒。
- 单个上下文包构建小于 3 秒。
- Inspector 展示剧情债和状态摘要无明显卡顿。
- E2E 不出现布局重叠或无法滚动区域。

### 12.5 Prompt 与 schema 测试

测试范围：

- 每个新增 PromptTemplateId 都能构建 messages。
- 缺少 requiredVariables 时抛出明确错误。
- fake provider 返回 schema 外字段时会被拒绝或清洗。
- `model_calls` 记录 purpose、promptVersion、request、response 和 token 使用量。
- worldbuilding、core story、execution card、review、state delta 的输出字段能映射到业务表。

## 13. 实施分期

第一期：模板和上下文包底座。

- 扩展 `PromptTemplateRegistry`。
- 新增 `ContextPackageService` 和 `generation_context_packages`。
- 把 book plan、rolling outline、element candidates 迁移到模板渲染。
- 补 prompt registry、schema、model_calls 集成测试。

第二期：章节执行卡。

- 新增表、repository、RPC、service。
- 章节规划页增加执行卡入口。
- AI 生成执行卡先落 artifact，用户采纳后入库。
- 补 Playwright E2E。

第三期：状态快照和剧情债。

- 新增 `story_state_snapshots`、`character_state_snapshots`、`plot_debts`。
- 剧情节点页增加剧情债视图。
- 角色页增加状态时间线。
- 正文应用后抽取状态 delta。

第四期：审稿和复盘。

- 新增 `chapter.reviewDraft` 和 `serialReview.generate`。
- 总控台展示故事健康度、重复风险、剧情债风险和下一步动作。
- Inspector 增加剧情债与复盘建议入口。

第五期：长篇压测和真实流程验证。

- 增加 500 万字合成数据。
- 增加从新建作品到第一章闭环的 E2E。
- 增加 20 章复盘 E2E。
- 增加上下文包性能预算测试。

## 14. 不做范围

本 spec 不做以下内容：

- 网文平台自动发布。
- 多人实时协作。
- 富文本排版编辑器。
- 云同步和账号体系。
- 自动把 AI 候选写入 canon。
- 一次性生成 1500 章完整正文。

## 15. 完成标准

这个长篇连载控制系统完成后，应满足：

- 用户可以从一个题材灵感走到第 1 章正文生成前，并且每一步都有结构化数据支撑。
- 第 1 章正文应用后，系统能自动形成摘要、状态变化、剧情债变化和记忆候选。
- 第 2 章生成前，系统能读取第 1 章产生的状态和上下文。
- 每 10 到 20 章可以做阶段复盘，明确下一阶段升级方向。
- 500 万字合成项目在总控台、章节规划、剧情债和上下文构建路径上性能可接受。
- 前端交互符合创作者习惯：列表优先、弹窗编辑、单列长文本、Inspector 辅助、AI 产物可审阅。
