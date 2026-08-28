# 小说创作主路径整改 Spec

## 1. 背景

当前 Story Pilot 的 MVP 已具备作品创建、章节编辑、创作要素维护、AI 候选生成、记忆确认和看板抽屉。但用户进入作品后的默认路径偏向“章节写作工作台”：新建作品后直接看到章节页，如果没有章节，就显示“暂无章节”。

这不符合 AI 小说创作平台的核心使用路径。真实创作流程不是先写正文，而是先完成作品立项、创作蓝图、世界观、人物、剧情弧线、章节大纲，再进入正文生产。否则用户会在空白章节页前失去方向，AI 也缺少足够的结构化上下文。

本 spec 定义一轮产品与工程整改：把 Story Pilot 从“章节编辑器 + AI 工具”调整为“结构化小说创作工作台”。

## 2. 整改目标

目标：

- 新项目默认进入“创作路径”而不是章节页。
- 创作路径覆盖从立项到正文的完整闭环。
- 在剧情结构和章节生产之间新增“大纲设计”阶段。
- 每个阶段都必须有后台数据结构、数据库落点、状态和版本策略。
- 所有 AI 输出先成为候选、草稿、报告或工单产物，不直接污染 canon。
- 用户确认后的数据进入正式对象表、记忆库和图谱投影。
- E2E 覆盖从空项目到首章正文草稿的主路径。

非目标：

- 本轮不实现协同编辑。
- 本轮不实现云同步。
- 本轮不实现商业化、账户体系和在线发布。
- 本轮不把聊天作为一级主界面。
- 本轮不把全部图谱可视化做成高级编辑器，只要求数据和基础预览可用。

## 3. 新的用户主路径

用户进入平台后的主路径调整为九步：

```text
1. 作品立项
2. 创作蓝图生成
3. 世界观与要素构建
4. 人物与关系网构建
5. 剧情弧线设计
6. 大纲设计
7. 章节生产
8. 记忆与图谱校验
9. 阶段复盘与持续迭代
```

其中第 6 步“大纲设计”是独立阶段，不能合并到剧情弧线或章节生产里。

原因：

- 剧情弧线解决“故事如何推进、冲突如何升级、人物如何变化”。
- 大纲设计解决“这些剧情如何落到卷、章、场景、节奏和信息释放”。
- 章节生产解决“基于章节大纲写出正文”。

如果没有独立大纲阶段，AI 会直接从宏观剧情跳到正文，容易出现章节目标不清、信息密度失衡、伏笔无法规划、前后章因果断裂。

## 4. 工作台信息架构整改

### 4.1 左侧

左侧仍是作品空间：

- 作品列表。
- 新建作品。
- 最近打开。
- 作品状态标记。

### 4.2 中间主区

新项目默认显示“创作路径工作台”，而不是章节页。

中间主区建议使用阶段式布局：

- 顶部：当前作品名、阶段进度、下一步主按钮。
- 左侧或顶部：九步创作路径 stepper。
- 主区域：当前阶段的结构化表单、候选列表、AI 产物、确认区。
- 底部或侧栏：本阶段数据完整度、风险、可进入下一阶段的条件。

章节页仍然保留，但只在完成大纲设计后作为主要生产界面。

### 4.3 右侧看板

右侧看板从“辅助展示”升级为“闭环监控”：

- 当前阶段完成度。
- 未确认 AI 产物。
- canon 冲突和设定风险。
- 未回收伏笔。
- 人物关系变化。
- 章节大纲覆盖率。
- 记忆候选待确认数量。
- 下一步建议。

看板中的每个项目必须能跳转到中间主区的处理位置。

## 5. 阶段数据模型

### 5.1 通用阶段状态

每个阶段都应写入 `creative_stages`，用于控制路径进度。

| 字段                  | 类型             | 说明                                                                                                    |
| --------------------- | ---------------- | ------------------------------------------------------------------------------------------------------- |
| id                    | text pk          | 阶段记录 id                                                                                             |
| project_id            | text             | 项目 id                                                                                                 |
| stage_key             | text             | brief, blueprint, worldbuilding, characters, plot_arcs, outline, chapters, memory_review, retrospective |
| status                | text             | locked, available, in_progress, waiting_user, completed, needs_revision                                 |
| readiness_score       | integer          | 0-100 完整度                                                                                            |
| gate_report_json      | text             | 阶段准入/完成检查结果                                                                                   |
| current_work_order_id | text nullable    | 当前关联工单                                                                                            |
| completed_at          | integer nullable | 完成时间                                                                                                |
| created_at            | integer          | 创建时间                                                                                                |
| updated_at            | integer          | 更新时间                                                                                                |

阶段推进规则：

- 新建项目后只有 `brief` 为 `available`。
- 当前阶段达到最低完整度后，下一个阶段变为 `available`。
- 用户可跳过阶段，但系统必须记录 `gate_report_json.skipped = true`。
- 上游关键设定变更时，下游阶段标记为 `needs_revision`，并在看板提示影响范围。

### 5.2 作品立项

用户目标：确定这本书面向谁、写什么、以什么节奏和风格写。

核心 UI：

- 题材：下拉。
- 子类型：多选下拉。
- 目标读者：下拉。
- 平台倾向：下拉。
- 篇幅目标：下拉或数字输入。
- 叙事人称：下拉。
- 主情绪回报：多选下拉。
- 一句话灵感：文本域。
- 禁用方向：标签输入。

数据库表：`project_briefs`。

| 字段                      | 类型          | 说明                         |
| ------------------------- | ------------- | ---------------------------- |
| id                        | text pk       | brief id                     |
| project_id                | text          | 项目 id                      |
| genre                     | text          | 题材                         |
| subgenres_json            | text          | 子类型                       |
| target_audience           | text          | 目标读者                     |
| platform_profile          | text nullable | 平台倾向                     |
| length_profile            | text nullable | 篇幅策略                     |
| narrative_pov             | text nullable | 叙事人称                     |
| emotional_rewards_json    | text          | 爽点/情绪回报                |
| initial_idea              | text nullable | 一句话灵感                   |
| forbidden_directions_json | text          | 禁用方向                     |
| status                    | text          | draft, confirmed, deprecated |
| version                   | integer       | 版本                         |
| created_at                | integer       | 创建时间                     |
| updated_at                | integer       | 更新时间                     |

确认后写入：

- `creative_stages.brief.completed`
- `domain_events.project_brief.confirmed`
- `context_packages` 可引用的项目基础约束

### 5.3 创作蓝图生成

用户目标：确认作品的核心承诺、主冲突、差异化点和整体方向。

AI 产物：`story_blueprint_draft` artifact。

数据库表：`story_blueprints`。

| 字段                 | 类型          | 说明                         |
| -------------------- | ------------- | ---------------------------- |
| id                   | text pk       | 蓝图 id                      |
| project_id           | text          | 项目 id                      |
| premise              | text          | 故事前提                     |
| logline              | text          | 一句话故事                   |
| core_promise         | text          | 读者承诺                     |
| main_conflict        | text          | 主冲突                       |
| protagonist_arc      | text nullable | 主角成长方向                 |
| antagonist_force     | text nullable | 反派或阻力                   |
| differentiators_json | text          | 差异化设计                   |
| risks_json           | text          | 套路化和可写性风险           |
| status               | text          | draft, confirmed, deprecated |
| version              | integer       | 版本                         |
| source_artifact_id   | text nullable | 来源 AI 产物                 |
| created_at           | integer       | 创建时间                     |
| updated_at           | integer       | 更新时间                     |

确认后写入：

- `domain_events.story_blueprint.confirmed`
- `memories.memory_type = style | project_promise`
- 图谱节点 `StoryBlueprint`

### 5.4 世界观与要素构建

用户目标：构建能支撑冲突和章节生产的世界规则、地点、组织、物品、能力体系。

复用已有表：

- `world_rules`
- `locations`
- `organizations`
- `items`

新增表：`power_systems`。

| 字段                | 类型          | 说明                                                             |
| ------------------- | ------------- | ---------------------------------------------------------------- |
| id                  | text pk       | 体系 id                                                          |
| project_id          | text          | 项目 id                                                          |
| name                | text          | 体系名称                                                         |
| kind                | text          | magic, cultivation, technology, supernatural, social_rule, other |
| source              | text nullable | 力量来源                                                         |
| cost                | text nullable | 使用代价                                                         |
| levels_json         | text          | 等级或阶段                                                       |
| taboos_json         | text          | 禁忌                                                             |
| conflict_hooks_json | text          | 可制造冲突                                                       |
| status              | text          | draft, canon, deprecated                                         |
| created_at          | integer       | 创建时间                                                         |
| updated_at          | integer       | 更新时间                                                         |

AI 候选生成要求：

- 候选类型使用下拉，不允许默认纯手填。
- 支持城市、地点、组织、武器、功法、道具、资源、禁忌规则。
- 候选必须读取 `project_briefs`、`story_blueprints`、已确认 `world_rules` 和已存在元素。
- 用户采纳后才写入正式表。

### 5.5 人物与关系网构建

用户目标：形成主角、反派、关键配角和人物关系网。

复用已有表：

- `characters`

新增表：`character_relations`。

| 字段                | 类型          | 说明                                                             |
| ------------------- | ------------- | ---------------------------------------------------------------- |
| id                  | text pk       | 关系 id                                                          |
| project_id          | text          | 项目 id                                                          |
| source_character_id | text          | 主体人物                                                         |
| target_character_id | text          | 客体人物                                                         |
| relation_type       | text          | ally, enemy, family, mentor, romance, rival, secret, debt, other |
| public_label        | text nullable | 表面关系                                                         |
| hidden_label        | text nullable | 隐藏关系                                                         |
| tension             | integer       | 张力 1-5                                                         |
| status              | text          | draft, canon, deprecated                                         |
| created_at          | integer       | 创建时间                                                         |
| updated_at          | integer       | 更新时间                                                         |

新增表：`character_arcs`。

| 字段                | 类型          | 说明                                 |
| ------------------- | ------------- | ------------------------------------ |
| id                  | text pk       | 人物弧光 id                          |
| project_id          | text          | 项目 id                              |
| character_id        | text          | 人物 id                              |
| start_state         | text          | 起点状态                             |
| false_belief        | text nullable | 错误信念                             |
| desire              | text nullable | 外在欲望                             |
| need                | text nullable | 内在需求                             |
| turning_points_json | text          | 关键转折                             |
| end_state           | text nullable | 终点状态                             |
| status              | text          | planned, active, resolved, abandoned |
| created_at          | integer       | 创建时间                             |
| updated_at          | integer       | 更新时间                             |

图谱投影：

- `(:Character)-[:RELATES_TO]->(:Character)`
- `(:Character)-[:HAS_ARC]->(:CharacterArc)`
- `(:Character)-[:BELONGS_TO]->(:Organization)`
- `(:Character)-[:LOCATED_IN]->(:Location)`

### 5.6 剧情弧线设计

用户目标：设计故事如何推进、冲突如何升级、人物如何变化、伏笔如何分布。

复用已有表：

- `plotlines`
- `plotline_nodes`
- `foreshadowings`
- `foreshadowing_events`

新增表：`conflicts`。

| 字段                 | 类型          | 说明                                                             |
| -------------------- | ------------- | ---------------------------------------------------------------- |
| id                   | text pk       | 冲突 id                                                          |
| project_id           | text          | 项目 id                                                          |
| title                | text          | 冲突名称                                                         |
| conflict_type        | text          | internal, interpersonal, social, survival, mystery, moral, power |
| opposing_forces_json | text          | 对立力量                                                         |
| stakes               | text          | 失败代价                                                         |
| escalation_path_json | text          | 升级路径                                                         |
| related_plotline_id  | text nullable | 关联故事线                                                       |
| status               | text          | planned, active, resolved, abandoned                             |
| created_at           | integer       | 创建时间                                                         |
| updated_at           | integer       | 更新时间                                                         |

剧情弧线完成条件：

- 至少有一条主线 `plotlines.kind = main`。
- 至少有一个主冲突。
- 主角弧光与主线有关联。
- 至少定义 3 个关键转折：引爆点、中点、高潮。
- 重要伏笔有埋设和回收意图。

### 5.7 大纲设计

用户目标：把剧情弧线落到卷、章、场景和写作任务。

这是独立阶段，位于剧情弧线设计之后、章节生产之前。

新增表：`outlines`。

| 字段               | 类型          | 说明                                  |
| ------------------ | ------------- | ------------------------------------- |
| id                 | text pk       | 大纲 id                               |
| project_id         | text          | 项目 id                               |
| title              | text          | 大纲名称                              |
| scope              | text          | full_book, volume, arc, chapter_batch |
| basis_json         | text          | 来源蓝图、人物、故事线、世界规则      |
| status             | text          | draft, active, archived               |
| version            | integer       | 版本                                  |
| source_artifact_id | text nullable | 来源 AI 产物                          |
| created_at         | integer       | 创建时间                              |
| updated_at         | integer       | 更新时间                              |

新增表：`volume_outlines`。

| 字段            | 类型             | 说明                       |
| --------------- | ---------------- | -------------------------- |
| id              | text pk          | 卷纲 id                    |
| outline_id      | text             | 大纲 id                    |
| volume_id       | text nullable    | 应用后的卷 id              |
| title           | text             | 卷名                       |
| purpose         | text             | 本卷叙事目标               |
| major_conflict  | text nullable    | 本卷主冲突                 |
| climax          | text nullable    | 本卷高潮                   |
| word_count_goal | integer nullable | 目标字数                   |
| sort_order      | integer          | 排序                       |
| status          | text             | draft, applied, deprecated |

新增表：`chapter_outlines`。

| 字段                           | 类型             | 说明                                 |
| ------------------------------ | ---------------- | ------------------------------------ |
| id                             | text pk          | 章纲 id                              |
| outline_id                     | text             | 大纲 id                              |
| volume_outline_id              | text nullable    | 所属卷纲                             |
| chapter_id                     | text nullable    | 应用后的章节 id                      |
| title                          | text             | 章节标题                             |
| chapter_goal                   | text             | 本章目标                             |
| conflict                       | text nullable    | 本章冲突                             |
| information_gain               | text nullable    | 本章新增信息                         |
| emotional_turn                 | text nullable    | 情绪转折                             |
| hook                           | text nullable    | 开章/结尾钩子                        |
| required_character_ids_json    | text             | 出场人物                             |
| required_location_ids_json     | text             | 场景地点                             |
| related_plotline_node_ids_json | text             | 关联剧情节点                         |
| related_foreshadowing_ids_json | text             | 关联伏笔                             |
| target_word_count              | integer nullable | 目标字数                             |
| sort_order                     | integer          | 排序                                 |
| status                         | text             | draft, approved, applied, deprecated |
| created_at                     | integer          | 创建时间                             |
| updated_at                     | integer          | 更新时间                             |

新增表：`scene_outlines`。

| 字段               | 类型          | 说明                                                       |
| ------------------ | ------------- | ---------------------------------------------------------- |
| id                 | text pk       | 场景纲 id                                                  |
| chapter_outline_id | text          | 章纲 id                                                    |
| scene_id           | text nullable | 应用后的场景 id                                            |
| title              | text          | 场景名                                                     |
| purpose            | text          | 场景目的                                                   |
| beat_type          | text          | setup, confrontation, reveal, reversal, payoff, transition |
| pov_character_id   | text nullable | 视角人物                                                   |
| location_id        | text nullable | 地点                                                       |
| conflict           | text nullable | 场景冲突                                                   |
| entry_state        | text nullable | 入场状态                                                   |
| exit_state         | text nullable | 离场状态                                                   |
| sort_order         | integer       | 排序                                                       |
| status             | text          | draft, approved, applied, deprecated                       |

大纲应用规则：

- 应用卷纲时写入或更新 `volumes`。
- 应用章纲时写入或更新 `chapters`，但 `chapters.content` 为空。
- 应用场景纲时写入或更新 `scenes`。
- 应用动作必须记录 `domain_events.outline.applied`。
- 被应用的 `chapter_outlines` 是后续章节生成的第一优先级上下文。

### 5.8 章节生产

用户目标：基于已批准章纲生成、编辑、润色和审校正文。

复用已有表：

- `chapters`
- `chapter_versions`
- `scenes`
- `artifacts`
- `artifact_versions`

章节生成前置条件：

- 当前章节必须存在对应 `chapter_outlines.status in approved, applied`。
- 当前章节至少包含 `chapter_goal`。
- ContextBuilder 必须注入章纲、相关人物、地点、故事线、伏笔和 canon memory。

章节 AI 输出：

- `artifacts.kind = chapter_draft`
- `artifacts.target_type = chapter`
- `memory_candidates`
- `review_issues`

应用正文规则：

- 用户点击应用后写入 `chapter_versions`。
- 更新 `chapters.content`、字数、版本号。
- 记录 `domain_events.chapter.updated`。
- 异步更新搜索索引和图谱投影。

### 5.9 记忆与图谱校验

用户目标：把正文中的新增事实、人物变化、事件、关系和伏笔变化沉淀为可约束后续创作的 canon。

复用已有表：

- `memory_candidates`
- `memories`
- `domain_events`
- `context_packages`

新增表：`review_issues`。

| 字段               | 类型          | 说明                                                               |
| ------------------ | ------------- | ------------------------------------------------------------------ |
| id                 | text pk       | 问题 id                                                            |
| project_id         | text          | 项目 id                                                            |
| target_type        | text          | chapter, outline, character, world_rule, plotline                  |
| target_id          | text          | 目标 id                                                            |
| issue_type         | text          | continuity, style, canon_conflict, pacing, missing_context, safety |
| severity           | text          | info, warning, error                                               |
| message            | text          | 问题说明                                                           |
| evidence_json      | text          | 证据                                                               |
| suggested_fix_json | text nullable | 修复建议                                                           |
| status             | text          | open, accepted, ignored, resolved                                  |
| created_at         | integer       | 创建时间                                                           |
| updated_at         | integer       | 更新时间                                                           |

图谱投影规则：

- SQLite 仍是事实源。
- Kuzu 作为关系读模型。
- 所有投影都由 `domain_events` 或显式重建任务驱动。
- 记忆确认后才能投影为 canon 边。

### 5.10 阶段复盘与持续迭代

用户目标：每完成一批章节后，确认作品是否偏离蓝图、大纲和读者承诺。

新增表：`retrospectives`。

| 字段                  | 类型          | 说明                                         |
| --------------------- | ------------- | -------------------------------------------- |
| id                    | text pk       | 复盘 id                                      |
| project_id            | text          | 项目 id                                      |
| scope                 | text          | chapter, chapter_batch, volume, full_project |
| scope_ref_json        | text          | 复盘范围                                     |
| progress_summary      | text          | 进展总结                                     |
| deviation_report_json | text          | 偏离蓝图/大纲情况                            |
| unresolved_items_json | text          | 未解决事项                                   |
| next_actions_json     | text          | 下一步建议                                   |
| status                | text          | draft, confirmed, archived                   |
| source_artifact_id    | text nullable | 来源 AI 产物                                 |
| created_at            | integer       | 创建时间                                     |
| updated_at            | integer       | 更新时间                                     |

复盘输出可以创建新的工作单：

- 修订人物关系。
- 补充世界规则。
- 调整大纲。
- 生成下一批章纲。
- 审校已有章节。

## 6. 后端模块与职责

### 6.1 新增模块

建议在 NestJS sidecar 中新增或扩展以下模块：

| 模块                      | 职责                                 |
| ------------------------- | ------------------------------------ |
| `CreativeStageModule`     | 管理九步阶段状态、准入检查、影响范围 |
| `BriefModule`             | 作品立项表单、预设组合、brief 版本   |
| `BlueprintModule`         | 创作蓝图生成、确认、版本             |
| `WorldbuildingModule`     | 世界观、地点、组织、物品、能力体系   |
| `CharacterDesignModule`   | 人物卡、人物关系、人物弧光           |
| `PlotDesignModule`        | 剧情线、冲突、伏笔、关键转折         |
| `OutlineModule`           | 全书大纲、卷纲、章纲、场景纲         |
| `ChapterProductionModule` | 章节生成、应用、版本、局部润色       |
| `ReviewModule`            | 连续性、节奏、风格和 canon 冲突检查  |
| `RetrospectiveModule`     | 阶段复盘与下一步计划                 |

### 6.2 API 命令草案

沿用当前 typed RPC 协议，新增命令按业务对象分组：

```ts
creativeStage.getPath;
creativeStage.updateStatus;
creativeStage.getGateReport;

brief.save;
brief.confirm;
brief.generateSuggestions;

blueprint.generate;
blueprint.apply;
blueprint.update;

world.generateCandidates;
world.acceptCandidates;
world.savePowerSystem;

character.generateCast;
character.acceptCandidates;
character.saveRelation;
character.saveArc;

plot.generateArcs;
plot.saveConflict;
plot.applyArc;

outline.generate;
outline.applyVolumeOutlines;
outline.applyChapterOutlines;
outline.applySceneOutlines;
outline.approveChapterOutline;

chapter.generateDraftFromOutline;
chapter.reviewAgainstOutline;

memory.extractFromChapter;
memory.confirmBatch;

retrospective.generate;
retrospective.confirm;
```

命名原则：

- `generate` 只生成 artifact/candidate。
- `apply` 表示把 AI 产物应用到正式业务对象。
- `confirm` 表示用户确认阶段、记忆或复盘。
- `save` 表示用户直接编辑结构化对象。

### 6.3 事务边界

必须使用事务的操作：

- 确认 brief 并推进阶段。
- 应用创作蓝图。
- 采纳世界观或人物候选。
- 保存人物关系并写入图谱事件。
- 应用大纲到 `volumes`、`chapters`、`scenes`。
- 应用章节草稿到正文版本。
- 批量确认记忆。

事务内写：

- 正式业务表。
- `domain_events`。
- 阶段状态。
- 相关 artifact/candidate 状态。

事务外异步：

- Kuzu 投影。
- FTS/embedding 更新。
- 上下文缓存失效。

## 7. AI 工作流设计

### 7.1 工作流清单

| 工作流                       | 输入                    | 输出                       | 入库方式                        |
| ---------------------------- | ----------------------- | -------------------------- | ------------------------------- |
| `brief_suggestion`           | 初始灵感、题材预设      | brief 补全建议             | 用户采纳后写 `project_briefs`   |
| `blueprint_generate`         | brief、预设             | 蓝图草案                   | 用户应用后写 `story_blueprints` |
| `worldbuilding_generate`     | brief、blueprint、genre | 世界规则和元素候选         | 用户采纳后写世界观表            |
| `character_cast_generate`    | blueprint、世界观       | 人物候选、关系建议         | 用户采纳后写人物表和关系表      |
| `plot_arc_generate`          | 蓝图、人物、世界观      | 主线、支线、冲突、伏笔建议 | 用户应用后写剧情表              |
| `outline_generate`           | 剧情弧线、人物、世界观  | 全书/卷/章/场景大纲        | 用户应用后写大纲和章节结构      |
| `chapter_draft_from_outline` | 章纲、上下文包          | 章节正文草稿               | 用户应用后写章节版本            |
| `chapter_review`             | 正文、章纲、canon       | 审校问题                   | 用户处理后更新 issue 状态       |
| `memory_extract`             | 正文、变更 diff         | 记忆候选                   | 用户确认后写 memories           |
| `retrospective_generate`     | 阶段产物、进度          | 复盘报告和下一步计划       | 用户确认后写 retrospective      |

### 7.2 系统提示词要求

所有 prompt 必须版本化，保存在 `packages/ai/src/prompts/<workflow>/system.vN.md`。

通用约束：

- 必须输出结构化 JSON。
- 必须区分 `draft`、`candidate`、`canon_reference`。
- 不得声明 AI 结果已成为正式设定。
- 不得绕过用户确认。
- 必须列出创作理由和潜在风险。
- 必须引用输入中的 canon 事实，不得擅自修改 canon。
- 对不确定信息使用 `hypothesis` 或 `needs_user_decision`。

大纲生成 prompt 额外要求：

- 明确每章 `chapter_goal`。
- 明确每章信息增量。
- 明确每章冲突和情绪转折。
- 明确与人物弧光、故事线、伏笔的关联。
- 不允许直接输出正文。
- 不允许在章纲中新增未定义关键人物或核心规则，除非标记为候选。

章节生成 prompt 额外要求：

- 必须以章纲为最高优先级任务约束。
- 不得跳过本章目标。
- 不得提前回收未计划回收的伏笔。
- 不得引入会破坏 canon 的设定。
- 输出必须包含正文、摘要、涉及事实变化、记忆候选和审校风险。

## 8. 前端开发细节

### 8.1 新项目默认页

当 `creativeStage.getPath` 返回当前阶段不是 `chapters.completed` 时，中间主区默认显示 `CreativePathWorkbench`。

组件建议：

- `CreativePathStepper`
- `StageGateSummary`
- `BriefStagePanel`
- `BlueprintStagePanel`
- `WorldbuildingStagePanel`
- `CharacterStagePanel`
- `PlotArcStagePanel`
- `OutlineStagePanel`
- `ChapterProductionPanel`
- `MemoryReviewPanel`
- `RetrospectivePanel`

### 8.2 表单控件原则

- 题材、子类型、目标读者、平台倾向、文风、叙事人称、节奏、冲突类型、人物原型、关系类型、地点类型、组织类型、物品类型、功法体系类型都使用预设选择。
- 允许自定义，但自定义入口是“添加自定义选项”，不是默认手填。
- AI 生成候选优先展示为可选择列表，不直接落库。
- 每个阶段都有“生成候选”“采纳选中”“确认本阶段”“进入下一步”。

### 8.3 大纲阶段 UI

大纲阶段必须有三层视图：

- 卷纲：展示每卷目标、冲突、高潮、字数。
- 章纲：展示章节目标、冲突、信息增量、钩子、关联人物/伏笔。
- 场景纲：展示场景目的、节拍、视角人物、地点、进出场状态。

用户可以：

- 生成全书大纲。
- 只生成当前卷章纲。
- 编辑单章章纲。
- 批准章纲。
- 应用章纲生成空章节。
- 从某章章纲进入正文生产。

## 9. E2E 用例

### 9.1 空项目到首章草稿

步骤：

1. 启动应用。
2. 点击新建作品。
3. 使用下拉选择题材、子类型、目标读者、风格。
4. 输入一句话灵感。
5. 确认作品立项。
6. 点击生成创作蓝图。
7. 采纳蓝图中的核心承诺和主冲突。
8. 生成世界观候选，采纳至少 1 条世界规则、1 个地点、1 个组织。
9. 生成人物候选，采纳主角、反派、关键配角，并确认一条人物关系。
10. 生成剧情弧线，确认主线、主冲突和至少一个伏笔。
11. 进入大纲设计，生成前 10 章章纲。
12. 批准第 1 章章纲并应用为空章节。
13. 进入第 1 章正文生产，点击基于章纲生成草稿。
14. 应用草稿。
15. 确认记忆候选。

断言：

- 默认入口不是空章节页，而是创作路径工作台。
- 每一步都有对应 `creative_stages` 状态变化。
- 每一步确认后刷新仍可恢复。
- 第 1 章正文生成时上下文包包含章纲 id。
- 应用正文后存在 `chapter_versions`。
- 确认记忆后存在 `memories.status = canon`。
- 看板显示当前进度、待处理风险和下一步。

### 9.2 大纲不可跳过校验

步骤：

1. 创建作品并完成剧情弧线。
2. 不生成章纲，直接尝试生成章节正文。

断言：

- UI 禁用“生成正文”或弹出缺少章纲提示。
- 后端 `chapter.generateDraftFromOutline` 返回业务错误。
- 不创建 `chapter_draft` artifact。
- 看板提示需要先完成大纲设计。

### 9.3 上游设定变更影响下游

步骤：

1. 完成蓝图、世界观、人物、剧情弧线和大纲。
2. 修改已确认的主冲突或世界规则。
3. 保存变更。

断言：

- 下游 `outline` 和 `chapters` 阶段标记为 `needs_revision`。
- 看板展示影响范围。
- 系统创建或建议创建修订工单。
- 已有正文不被自动覆盖。

### 9.4 AI 候选不直接入库

步骤：

1. 在世界观阶段生成 10 个地点候选。
2. 不采纳，刷新应用。
3. 再进入世界观阶段。

断言：

- 候选以 artifact 或 candidate 形式保留。
- `locations` 表没有未采纳候选。
- 采纳后才写入 `locations` 和 `domain_events.location.created`。

### 9.5 图谱与记忆闭环

步骤：

1. 生成并应用第 1 章正文。
2. 运行记忆抽取。
3. 确认一个人物事件和一条人物关系变化。
4. 打开图谱预览。

断言：

- `memory_candidates` 状态从 pending 变为 accepted。
- `memories` 写入 canon 事实。
- `domain_events` 有记忆确认事件。
- 图谱读模型能查询到人物、事件、章节之间关系。

### 9.6 应用重启恢复

步骤：

1. 完成到大纲阶段，批准 3 个章纲。
2. 退出应用。
3. 重新启动应用并打开项目。

断言：

- 左侧项目列表恢复该作品。
- 创作路径停留在大纲或章节生产阶段。
- 已批准章纲仍存在。
- 未处理 AI 产物仍在看板中。

## 10. 开发阶段建议

### Phase 1：数据模型与迁移

- 新增 `creative_stages`、`project_briefs`、`story_blueprints`。
- 新增人物关系、人物弧光、冲突、大纲、复盘、审校问题相关表。
- 为每个确认动作补 `domain_events`。
- 补项目打开时的兼容性 migration。

### Phase 2：RPC 与服务层

- 增加阶段路径 API。
- 增加 brief、blueprint、outline 等核心命令。
- 把 AI 生成和应用动作拆成不同 command。
- 所有应用类 command 使用事务。

### Phase 3：创作路径工作台

- 新增 `CreativePathWorkbench`。
- 新项目默认进入立项阶段。
- 章节页入口后移到大纲完成后。
- 右侧看板改为按阶段和工单展示。

### Phase 4：AI 工作流与 prompt

- 实现 `blueprint_generate`、`plot_arc_generate`、`outline_generate`、`chapter_draft_from_outline`。
- 每个工作流定义 input schema、output schema、prompt 版本。
- fake provider 覆盖 E2E fixture。

### Phase 5：图谱、记忆和审校

- 将人物关系、剧情节点、伏笔、章纲、章节、记忆投影到 Kuzu。
- 章节生成后自动产生记忆候选和 review issues。
- 看板展示待确认记忆和冲突。

### Phase 6：E2E 自动化

- 使用 Playwright 或 Tauri 可控测试覆盖主路径。
- 保留 Vitest 单元/集成测试覆盖 contract、service、repository。
- fake model provider 固定输出，避免 E2E 依赖真实模型。

## 11. 验收标准

- 新建作品后默认进入创作路径工作台。
- 创作路径展示九个阶段，其中“大纲设计”独立存在。
- 用户无法在没有章纲的情况下直接生成正式章节草稿。
- 每个阶段至少有一个后台持久化对象。
- 每个 AI 生成动作都有 artifact/candidate/work_order 记录。
- 每个确认或应用动作都有 domain event。
- 应用重启后能恢复当前阶段和已确认数据。
- E2E 能跑通“空项目到首章草稿”。
- 单元测试覆盖新增 schema、repository、service 和 typed RPC。
- 前端测试覆盖阶段导航、下拉预设、候选采纳、大纲准入和看板跳转。

## 12. 自检

- 本 spec 不把聊天作为核心路径。
- 本 spec 明确把大纲设计独立放在剧情弧线和章节生产之间。
- 本 spec 为每个阶段定义了数据库落点。
- 本 spec 区分 AI 产物、候选、草稿和 canon。
- 本 spec 明确 SQLite 是事实源，Kuzu 是图谱读模型。
- 本 spec 包含可执行的 E2E 用例。
