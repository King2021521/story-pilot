# P3 长篇大纲与剧情引擎 Spec

## 目标

建立能支撑百万字长篇小说的分层规划系统：全书蓝图、分卷规划、剧情弧线、章节大纲、场景节奏、伏笔投放和回收都可被结构化管理、AI 生成、用户调整和持续迭代。

## 当前缺口

- 当前章纲生成只覆盖固定 10 章模板。
- 缺少全书目标字数、分卷结构、剧情弧线与章纲之间的绑定。
- 伏笔、冲突、人物弧线虽然有表，但没有成为大纲生成的硬输入。
- 没有滚动规划机制，百万字长篇不能一次性只靠全书大纲，也不能每章临时写。

## 生产级补强重点

P3 的生产级目标是让产品真正支撑百万字长篇，而不是只生成短篇样章。百万字项目需要分层规划和滚动推进，否则后期会出现主线漂移、人物弧线失控、伏笔遗忘和章节注水。

必须补强：

- 规划层级固定为 Book Plan、Volume Plan、Arc Plan、Chapter Plan、Scene Plan。
- 剧情线、人物弧线、冲突、伏笔、世界规则必须成为章纲生成的硬输入和引用对象。
- 未来 10-20 章采用高细节滚动规划，当前卷保持中等细节，全书规划保持低频稳定。
- 大纲变更必须输出影响分析，标记受影响章节、人物、事件、伏笔和世界规则。
- 章节生成只能从通过 gate 的 chapter plan 发起。

不可降级项：

- 固定 10 章模板不能作为正式长篇规划能力。
- 大纲不能只存自然语言，必须保存结构化目标、冲突、信息增量、情绪转折、钩子和引用关系。
- 没有章纲引用关系时不能宣称支持剧情连续性。

## 生产投入补强方案

P3 是百万字长篇能力的核心分界点。完成 P3 后，Story Pilot 应能先设计全书和分卷，再规划剧情弧线，最后生成可执行的章节大纲；正文生产必须依赖章纲，而不是直接从宏观设定跳到正文。

必须补强的闭环：

| 补强项       | 生产标准                                              | 失败处理                             |
| ------------ | ----------------------------------------------------- | ------------------------------------ |
| 五层规划     | Book/Volume/Arc/Chapter/Scene Plan 全部结构化存储     | 缺少上层 plan 时禁止生成下层 plan    |
| 滚动规划     | 全书低频稳定，当前卷中等细节，未来 10-20 章高细节     | 章数不足时提示先生成 rolling outline |
| 引用关系     | Chapter Plan 引用人物、剧情线、伏笔、世界规则、冲突   | 引用对象不存在或过期时 gate 不通过   |
| 影响分析     | 修改 book、volume、arc、chapter plan 时输出受影响对象 | 影响分析失败时不能把下游标记为 ready |
| 大纲工作台   | 支持树状导航、节点编辑、AI 生成、采纳、修订、影响查看 | 只展示文本大纲不算完成               |
| 长篇性能基线 | 1000 章 plan 查询、定位、过滤和打开满足 P6 性能预算   | 超预算时需要索引或分页优化           |

工程落点：

- `packages/db` 新增 plan 层级表和 repository，保证结构化字段、引用关系和版本可查。
- `apps/sidecar` 新增长篇规划 service，负责 book plan、rolling outline、apply 和 impact。
- `packages/ai` 新增 book plan 与 rolling chapter plan 的 prompt、schema、eval。
- 前端新增“大纲设计”工作台，位于“剧情弧线”和“章节生产”之间。

阶段出口：

- 一部目标百万字作品可以生成全书规划、分卷规划、至少一个 arc，以及未来 10-20 章详细章纲。
- 每个 chapter plan 有目标、冲突、信息增量、情绪转折、钩子、字数和引用对象。
- 章节生产入口只对通过 gate 的 chapter plan 开放。

## 范围

本阶段必须完成：

- 全书规划。
- 分卷规划。
- 剧情弧线规划。
- 章节大纲规划。
- 场景规划。
- 伏笔投放/强化/回收计划。
- 大纲变更影响分析。
- 滚动规划机制。

本阶段不做：

- 自动发布到网文平台。
- 多作者协同。
- 复杂日历排期。

## 规划层级

```text
Book Plan
  Volume Plan
    Arc Plan
      Chapter Plan
        Scene Plan
```

层级规则：

- Book Plan 解决全书核心承诺、终局方向、总字数、主线结构。
- Volume Plan 解决阶段目标、阶段反派、阶段高潮、读者回报。
- Arc Plan 解决连续 10-30 章的冲突推进。
- Chapter Plan 解决单章目标、冲突、信息增量、钩子和字数。
- Scene Plan 解决正文内场景目标、出场人物、场景转折和记忆提取点。

## 滚动规划策略

百万字长篇采用三层清晰度：

| 范围          | 清晰度             | 维护方式                 |
| ------------- | ------------------ | ------------------------ |
| 全书          | 低频更新，高层稳定 | 只在大转向时修改         |
| 当前卷        | 中等细节           | 每 20-50 章复盘          |
| 未来 10-20 章 | 高细节             | 每批章节生产前生成和修订 |

AI 生成正文时不能只看当前章纲，必须读取：

- 全书目标。
- 当前卷目标。
- 当前 arc。
- 当前章纲。
- 最近 3-5 章摘要。
- 相关人物状态。
- 相关世界规则。
- 未回收伏笔。

## 数据模型

新增或强化表：

```ts
book_plans(
  id text primary key,
  project_id text not null,
  title text not null,
  target_word_count integer not null,
  core_promise text not null,
  ending_direction text,
  main_plotline_id text,
  status text not null,
  version integer not null,
  source_artifact_id text,
  created_at integer not null,
  updated_at integer not null
)

volume_plans(
  id text primary key,
  project_id text not null,
  book_plan_id text not null,
  title text not null,
  volume_index integer not null,
  purpose text not null,
  major_conflict text not null,
  climax text,
  target_word_count integer not null,
  status text not null,
  created_at integer not null,
  updated_at integer not null
)

arc_plans(
  id text primary key,
  project_id text not null,
  volume_plan_id text not null,
  title text not null,
  arc_index integer not null,
  plotline_id text,
  character_arc_id text,
  start_chapter_index integer,
  end_chapter_index integer,
  purpose text not null,
  escalation_json text not null,
  status text not null,
  created_at integer not null,
  updated_at integer not null
)

chapter_plans(
  id text primary key,
  project_id text not null,
  arc_plan_id text,
  chapter_id text,
  chapter_index integer not null,
  title text not null,
  chapter_goal text not null,
  conflict text not null,
  information_gain text not null,
  emotional_turn text not null,
  hook text not null,
  target_word_count integer not null,
  related_plotline_ids_json text not null,
  related_character_ids_json text not null,
  related_foreshadowing_ids_json text not null,
  status text not null,
  version integer not null,
  created_at integer not null,
  updated_at integer not null
)

scene_plans(
  id text primary key,
  project_id text not null,
  chapter_plan_id text not null,
  scene_index integer not null,
  pov_character_id text,
  location_id text,
  scene_goal text not null,
  conflict_turn text not null,
  outcome text not null,
  memory_targets_json text not null,
  status text not null,
  created_at integer not null,
  updated_at integer not null
)
```

已有 `outlines`、`volume_outlines`、`chapter_outlines` 可以迁移或作为兼容视图。新开发优先使用 plan 命名，保留旧表读取以兼容已有项目。

## API

```ts
plot.generateBookPlan(input: {
  projectId: string;
  targetWordCount: number;
  volumeCount: number;
}): ArtifactRecord

plot.applyBookPlan(input: {
  projectId: string;
  artifactId: string;
}): BookPlanRecord

plot.generateRollingOutline(input: {
  projectId: string;
  volumePlanId?: string;
  arcPlanId?: string;
  startChapterIndex: number;
  chapterCount: 10 | 20;
}): ArtifactRecord

plot.applyChapterPlans(input: {
  projectId: string;
  artifactId: string;
  selectedChapterPlanIds: string[];
}): ChapterPlanRecord[]

plot.analyzeOutlineImpact(input: {
  projectId: string;
  targetType: "book_plan" | "volume_plan" | "arc_plan" | "chapter_plan";
  targetId: string;
  patch: Record<string, unknown>;
}): {
  impactedTargets: Array<{
    targetType: string;
    targetId: string;
    reason: string;
    severity: "info" | "warning" | "error";
  }>;
}
```

## AI 工作流

`outline_generate` 必须分两类：

- `book_plan_generate`：全书和分卷级规划。
- `rolling_chapter_plan_generate`：未来 10-20 章详细章纲。

输入上下文：

- brief。
- blueprint。
- world rules。
- core characters。
- plotlines。
- open conflicts。
- open foreshadowings。
- accepted memories。
- existing chapter summaries。

输出必须包含：

- 分层结构。
- 每个章节的目标、冲突、信息增量、钩子。
- 与人物、剧情线、伏笔、世界规则的引用 ID。
- 风险报告：节奏过快、人物缺席、伏笔过密、主线偏离。

## 前端设计

新增“大纲与剧情”工作台：

- 左侧：Book/Volume/Arc/Chapter 树。
- 中间：选中节点的结构化编辑器。
- 右侧：剧情线、伏笔、人物弧线、门禁缺口。
- 顶部：生成全书规划、生成下一批章纲、影响分析、应用草案。

章节树节点状态：

- `draft`
- `approved`
- `applied`
- `needs_revision`
- `written`

## 当前可复用实现

- `packages/db/src/schema/creative-path.ts`：已有 outlines、volumeOutlines、chapterOutlines、powerSystems、characterRelations、characterArcs、conflicts。
- `packages/db/src/schema/plot.ts`：已有 plotlines、plotlineNodes、storyEvents、eventRelations、foreshadowings。
- `apps/sidecar/src/outline/outline.service.ts`：已有章纲生成、批准、应用基础，但当前是固定模板。
- `apps/sidecar/src/plot/*`：已有剧情线、事件、伏笔服务基础。
- `apps/desktop/src/features/creative-path/CreativePathWorkbench.tsx`：已有章纲列表和正文生成入口。

## 实施切片

### P3.1 分层规划数据模型

产物：

- 新增或迁移 `book_plans`、`volume_plans`、`arc_plans`、`chapter_plans`、`scene_plans`。
- 建立 repository 和 migration。
- 保留旧 `outlines`/`chapter_outlines` 兼容读取。

验证：

- schema test 确认表存在。
- repository test 覆盖创建、查询、状态变更和版本。

### P3.2 长篇规划 AI Workflow

产物：

- `book_plan_generate` 生成全书和分卷规划 artifact。
- `rolling_chapter_plan_generate` 生成未来 10-20 章 detailed plans。
- 输出必须引用 plotline、character、foreshadowing、world rule。

验证：

- mock provider 集成测试确认 artifact 不直接写 canon。
- apply 后写入 plan 表和 domain events。

### P3.3 大纲与剧情工作台

产物：

- 大纲树支持 book、volume、arc、chapter、scene。
- 节点详情可编辑结构化字段。
- 支持生成下一批章纲、应用草案、影响分析。

验证：

- React 测试覆盖树渲染、节点选择、生成按钮、影响报告。

### P3.4 长篇压测

产物：

- synthetic data generator 生成 1000 章规划。
- 大纲查询和章节定位有性能测试。

验证：

- 第 700 章定位到 volume/arc/plotline 耗时低于 500ms。

## 测试用例

单元测试：

- 100 万字目标、5 卷输入时，生成的分卷字数总和误差不超过 10%。
- 每个 chapter plan 必须有 hook 和 informationGain。
- 修改 volume majorConflict 时，相关 arc/chapter 标记 `needs_revision`。

集成测试：

```text
1. 创建项目并完成 brief/blueprint/world/characters/plot_arcs。
2. 生成 book plan artifact。
3. 应用 book plan。
4. 生成第 1-20 章 rolling outline。
5. 应用 10 个 chapter plans。
6. creativeStage.evaluateGate(outline) 通过。
```

长篇压测：

```text
1. 使用 deterministic provider 生成 5 卷、1000 章 chapter plans。
2. 写入 SQLite。
3. 打开大纲树。
4. 查询第 700 章所在 volume/arc/plotline。
5. 单次查询耗时低于 500ms。
```

## 阶段验证清单

完成 P3 时必须保存以下证据：

- `pnpm --filter @story-pilot/db test`
- `pnpm --filter @story-pilot/sidecar test`
- `pnpm --filter @story-pilot/desktop test`
- `pnpm verify:longform` 中的大纲子集通过。
- 至少一个 100 万字目标项目生成全书规划和 20 章滚动章纲。

## 验收标准

- 大纲不再只是 10 章模板，而是全书、分卷、弧线、章节、场景的分层系统。
- 章节生成必须绑定 chapter plan。
- 每个 chapter plan 至少绑定一条剧情线或人物弧线。
- 未回收伏笔和未完成冲突能在大纲工作台中被看见。
- 百万字级 synthetic project 可以正常打开、检索和继续规划。
