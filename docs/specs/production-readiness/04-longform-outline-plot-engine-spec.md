# P3 长篇大纲与剧情引擎 Spec

## 目标

建立能支撑百万字长篇小说的分层规划系统：全书蓝图、分卷规划、剧情弧线、章节大纲、场景节奏、伏笔投放和回收都可被结构化管理、AI 生成、用户调整和持续迭代。

## 当前缺口

- 当前章纲生成只覆盖固定 10 章模板。
- 缺少全书目标字数、分卷结构、剧情弧线与章纲之间的绑定。
- 伏笔、冲突、人物弧线虽然有表，但没有成为大纲生成的硬输入。
- 没有滚动规划机制，百万字长篇不能一次性只靠全书大纲，也不能每章临时写。

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

## 验收标准

- 大纲不再只是 10 章模板，而是全书、分卷、弧线、章节、场景的分层系统。
- 章节生成必须绑定 chapter plan。
- 每个 chapter plan 至少绑定一条剧情线或人物弧线。
- 未回收伏笔和未完成冲突能在大纲工作台中被看见。
- 百万字级 synthetic project 可以正常打开、检索和继续规划。
