# P4 长期记忆与知识图谱一致性 Spec

## 目标

把当前记忆候选和 Kuzu 投影升级为长篇创作的连续性系统：人物状态、人物关系、事件因果、时间线、地点、物品、世界规则、伏笔生命周期都能被长期记录、检索、校验和反哺生成。

## 当前缺口

- 记忆有 canon/hypothesis/candidate，但缺少作用范围、有效时间、证据、取代关系和冲突状态。
- Kuzu 图谱可以投影事件，但主要是基础邻域查询，缺少面向创作的连续性规则。
- 图谱 rebuild 当前偏全量重建，不适合百万字项目高频运行。
- 章节生成的上下文检索还不够智能，容易漏掉远期但关键的设定。

## 生产级补强重点

P4 的生产级目标是建立长篇连续性的事实系统。记忆和图谱不能只是“好看的资料库”，必须参与生成前上下文选择、生成后校验和阶段门禁。

必须补强：

- 记忆必须包含来源、证据、适用范围、有效章节、状态、置信度、取代关系和冲突分组。
- 候选记忆必须经用户确认才能进入 canon，hypothesis 只能作为风险提示。
- Kuzu 图谱要覆盖人物、关系、事件、地点、物品、组织、世界规则、伏笔、章节计划和 artifact。
- 图谱投影要支持按 domain event 增量更新，全量 rebuild 只作为修复命令。
- 连续性规则必须在章节生成前和生成后运行，输出可定位、可处理、可审计的问题。
- context package 必须由混合检索生成，兼顾 canon、图谱邻域、FTS、embedding、最近摘要和当前章纲。

不可降级项：

- AI 不能自动把候选记忆写成 canon。
- 图谱不能只用于展示，必须参与连续性校验。
- 与 canon 冲突的 hypothesis 不能作为正文生成事实。
- 图谱投影失败必须进入诊断和看板，不能静默失败。

## 生产投入补强方案

P4 的目标是让系统具备长期一致性。完成 P4 后，记忆和知识图谱不只是资料陈列，而是章节生成、章节审稿、阶段门禁和复盘的事实来源。

必须补强的闭环：

| 补强项     | 生产标准                                              | 失败处理                                      |
| ---------- | ----------------------------------------------------- | --------------------------------------------- |
| Memory V2  | 每条记忆有来源、证据、范围、有效章节、状态、置信度    | 缺来源或状态不合法的记忆不能入 canon          |
| 用户确认   | AI 抽取结果先进入 candidate 或 hypothesis             | 未确认记忆只用于风险提示，不作为正文事实      |
| 图谱投影   | 人物、事件、关系、地点、物品、规则、伏笔、plan 可投影 | 增量失败进入看板和 diagnostics                |
| 连续性规则 | 生成前后检查死亡行动、物品归属、规则违反、伏笔顺序等  | error 级问题阻断 ready 状态                   |
| 混合检索   | context package 结合 canon、图谱邻域、FTS、embedding  | 超预算时保留结构化摘要，舍弃全文              |
| 冲突处理   | contradiction group、supersedes、deprecated 可追溯    | 冲突未处理时看板提示并影响 memory_review gate |

工程落点：

- `packages/db` 扩展 memory、continuity issue、projection checkpoint 和检索索引。
- `apps/sidecar` 新增 context retrieval、continuity rule、graph projection service。
- `packages/graph` 或 sidecar graph adapter 负责 Kuzu schema、增量投影和邻域查询。
- 前端升级“记忆与图谱校验”工作台，提供候选确认、冲突处理和来源追溯。

阶段出口：

- 章节生成前能构建包含相关 canon、近期摘要、章纲引用和图谱邻域的 context package。
- 章节生成后能抽取记忆候选、跑连续性检查、更新图谱 checkpoint。
- 至少覆盖死亡后行动、物品无转移双归属、payoff 早于 seed、世界规则违反四类 error。

## 范围

本阶段必须完成：

- 长期记忆增强模型。
- 混合检索：结构化图谱 + FTS + embedding。
- 图谱增量投影。
- 连续性规则引擎。
- 章节生成前上下文预算器。
- 记忆确认工作台升级。

本阶段不做：

- 云端向量数据库。
- 自动改写已确认 canon。
- 多项目共享记忆。

## 长期记忆模型

新增字段或迁移到 `memories_v2`：

```ts
memories(
  id text primary key,
  project_id text not null,
  entity_type text not null,
  entity_id text,
  kind text not null,
  content text not null,
  scope text not null,              -- project | volume | arc | chapter | scene | entity
  valid_from_chapter_index integer,
  valid_to_chapter_index integer,
  source_type text not null,
  source_id text not null,
  source_quote text,
  evidence_json text not null,
  confidence real not null,
  status text not null,             -- canon | hypothesis | deprecated | contradicted
  supersedes_memory_id text,
  contradiction_group_id text,
  embedding_ref text,
  created_at integer not null,
  updated_at integer not null
)
```

候选记忆必须包含：

- 来源 artifact/chapter/scene。
- 支撑短引用或来源摘要。
- 建议实体。
- 建议关系。
- 置信度。
- 可能冲突的 canon IDs。

## 图谱节点

必须支持的节点类型：

- Project
- BookPlan
- VolumePlan
- ArcPlan
- ChapterPlan
- Chapter
- Scene
- Character
- CharacterState
- Relationship
- WorldRule
- PowerSystem
- Location
- Organization
- Item
- Plotline
- StoryEvent
- Conflict
- Foreshadowing
- Memory
- Artifact

## 图谱边

必须支持的边类型：

- `PART_OF`
- `OCCURS_IN`
- `OCCURS_BEFORE`
- `CAUSES`
- `CONTRADICTS`
- `PARTICIPATES_IN`
- `AFFECTS`
- `OWNS`
- `LOCATED_IN`
- `MEMBER_OF`
- `CONSTRAINS`
- `SEEDED_IN`
- `REINFORCED_IN`
- `PAID_OFF_IN`
- `SUPPORTS`
- `SUPERSEDES`
- `MENTIONS`

## 连续性规则

第一批硬规则：

1. 同一人物在同一章节范围内不能同时处于互斥状态。
2. 物品不能在没有转移事件的情况下同时由两个人持有。
3. 已死亡人物不能在后续章节无解释地行动。
4. 世界规则不能被正文事件违反，除非存在例外规则或代价记录。
5. 伏笔 seeded 后长期未 reinforced/payoff 时进入 warning。
6. payoff 不能早于 seed。
7. 事件因果链不能形成循环。
8. 人物关系公开标签和隐藏标签可以不同，但同一时间范围内不能互相矛盾。

规则输出：

```ts
interface ContinuityIssue {
  id: string;
  projectId: string;
  issueType:
    | "timeline"
    | "causality"
    | "character_state"
    | "relationship"
    | "world_rule"
    | "item_ownership"
    | "foreshadowing";
  severity: "info" | "warning" | "error";
  evidence: string;
  relatedNodeIds: string[];
  suggestion: string;
  status: "open" | "acknowledged" | "resolved" | "ignored";
}
```

## 混合检索

章节生成前使用 `ContextRetrievalService`：

```ts
buildContext(input: {
  projectId: string;
  targetType: "chapter_plan" | "chapter" | "scene";
  targetId: string;
  tokenBudget: number;
  relatedEntityIds?: string[];
}): ContextPackage
```

检索来源：

- 当前 chapter plan。
- 所属 arc/volume/book plan。
- 最近章节摘要。
- 相关人物 canon memory。
- 相关世界规则。
- 相关伏笔。
- 图谱邻域 1-2 跳。
- FTS 命中的历史摘要。
- embedding 命中的远期记忆。

预算规则：

- 关键 canon 永远优先。
- 当前章纲优先级高于远期相似文本。
- hypothesis 只能进入风险区。
- 超预算时保留摘要，不保留全文。

## 图谱增量投影

当前全量 rebuild 只保留为修复命令。生产态新增：

```ts
graph.projectSinceCheckpoint(input: {
  projectId: string;
  projectionName: "kuzu_main";
}): {
  projectedEvents: number;
  lastDomainEventId: string | null;
}

graph.rebuild(input: {
  projectId: string;
  reason: string;
}): GraphRebuildResult
```

规则：

- 正常写入 domain event 后触发增量投影。
- 投影失败不阻断用户保存正文，但必须进入 diagnostics 和看板。
- memory_review 阶段要求 checkpoint 最新。

## 前端设计

升级“记忆确认”：

- 候选按 entityType、source、confidence、冲突状态分组。
- 支持批量接受为 canon。
- 支持保留为 hypothesis。
- 支持合并到已有 memory。
- 支持查看来源引用。
- 支持查看关联图谱邻域。

新增“连续性问题”面板：

- 按 error/warning/info 排序。
- 点击问题定位到人物、事件、章节或设定。
- 用户可标记 acknowledged/ignored，但必须记录 reason。

## 当前可复用实现

- `packages/db/src/schema/memory.ts`：已有 memory candidates、memories、context packages、projection checkpoints。
- `packages/db/src/schema/character.ts`：已有 characters、traits、entity relations。
- `packages/db/src/schema/plot.ts`：已有 story events、event relations、foreshadowings。
- `packages/graph/src/projector/graph-projector.ts`：已有 domain events 到 Kuzu 的投影基础。
- `packages/graph/src/queries/neighborhood.ts`：已有邻域、伏笔、因果、规则影响、矛盾查询基础。
- `apps/sidecar/src/memory/memory.service.ts`：已有候选确认、拒绝、合并。
- `apps/sidecar/src/graph/graph.service.ts`：已有 rebuild、neighborhood、contradiction 入口。
- `packages/ai/src/context-builder/context-builder.ts`：已有章节上下文包基础。

## 实施切片

### P4.1 Memory V2

产物：

- memory 增加 scope、valid chapter range、source、evidence、supersedes、contradiction group。
- memory candidate 增加 conflict candidates 和 source quote。
- migration 保留旧 memory 数据。

验证：

- repository test 覆盖创建、合并、取代、冲突分组。

### P4.2 图谱增量投影

产物：

- `graph.projectSinceCheckpoint` 按 domain event checkpoint 增量投影。
- rebuild 只作为修复命令。
- 投影失败进入 diagnostics 和看板。

验证：

- 集成测试覆盖新增 event 后只投影增量。
- projection checkpoint 与最新 domain event 对齐。

### P4.3 连续性规则引擎

产物：

- 实现首批 8 条硬规则。
- `continuity.review` 支持 target scope。
- issue 可 acknowledged、resolved、ignored。

验证：

- 每条硬规则至少一个单元测试。
- hypothesis 冲突降级为 warning。

### P4.4 混合检索 Context Retrieval

产物：

- FTS、embedding、graph neighborhood、recent summaries 合并排序。
- token budget 可控。
- context package 记录每个 item 的来源和 rank。

验证：

- 10000 memories 下 context package 构建低于 1500ms，不含模型调用。

## 测试用例

单元测试：

- 已死亡人物后续行动返回 `character_state/error`。
- 物品同时归属两人返回 `item_ownership/error`。
- payoff 早于 seed 返回 `foreshadowing/error`。
- hypothesis 冲突只返回 warning。

集成测试：

```text
1. 创建人物 A。
2. 创建事件：A 死亡，chapterIndex=10。
3. 创建事件：A 战斗，chapterIndex=12。
4. 运行 continuity review。
5. 返回 error，relatedNodeIds 包含两个事件。
```

长篇压测：

```text
1. 构造 1000 章、5000 memories、2000 story events。
2. 增量投影全部 domain events。
3. 查询任一关键人物两跳邻域。
4. 查询耗时低于 1000ms。
5. context package 在 16000 token budget 内稳定生成。
```

## 阶段验证清单

完成 P4 时必须保存以下证据：

- `pnpm --filter @story-pilot/db test`
- `pnpm --filter @story-pilot/graph test`
- `pnpm --filter @story-pilot/ai test`
- `pnpm --filter @story-pilot/sidecar test`
- `pnpm verify:longform` 中的 memory/graph 子集通过。
- 连续性规则测试报告。

## 验收标准

- 记忆具备来源、范围、有效期、证据和取代关系。
- 图谱投影支持增量更新。
- 连续性规则能在章节生成前和生成后运行。
- 章节生成上下文来自混合检索，而不是简单拿最近记忆。
- 百万字级 synthetic project 下记忆和图谱查询仍可用。
