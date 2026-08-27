# Story Pilot MVP 可执行规格

## 目标

本规格定义 Story Pilot 第一阶段 MVP 的可开发范围。目标不是一次性做完整小说平台，而是先打通一个真实可用的创作闭环：

```text
新建作品
  -> 维护人物/世界观/剧情线/伏笔
  -> 编辑章节
  -> AI 生成章节草稿
  -> 用户应用为章节版本
  -> AI 提取记忆候选
  -> 用户确认 canon
  -> 后续生成读取 canon 和图谱关系
```

## 关键决策

| 主题 | 决策 |
| --- | --- |
| 桌面框架 | Tauri v2 |
| 前端框架 | React + TypeScript + Ant Design |
| 后端框架 | NestJS + TypeScript |
| 后端运行形态 | Tauri 管理的本地 sidecar |
| HTTP 平台 | NestJS 默认平台适配层，不引入 Fastify |
| 关系数据库 | SQLite + Drizzle ORM |
| 图数据库 | Kuzu embedded |
| AI 调用 | ModelGateway 统一封装，MVP 支持 OpenAI compatible 和 Fake provider |
| AI 产物边界 | AI 只生成 artifact、patch、review、memory candidate，不直接写 canon |
| 记忆事实源 | SQLite |
| 图谱用途 | Kuzu 作为关系读模型，可从 SQLite 重建 |

## 非目标

MVP 不做：

- 多人协作。
- 云同步。
- 插件市场。
- 社区发布和商业化分发。
- 完整 epub/docx/PDF 排版系统。
- 复杂聊天 Agent 作为主入口。
- 自动把 AI 生成内容写入正式设定。

## 工程分层

```text
apps/desktop
  React + Ant Design
  Tauri invoke / event

apps/sidecar
  NestJS AppModule
  Controller -> ApplicationService -> Domain -> Repository / Adapter

packages/contracts
  RPC schema
  Event schema
  Error codes

packages/domain
  Pure domain rules
  State machines

packages/db
  SQLite schema
  Drizzle migrations
  Repositories

packages/graph
  Kuzu schema
  Graph projector
  Graph queries

packages/ai
  ModelGateway
  PromptRegistry
  StructuredOutputParser
  ContextBuilder
  ReviewEngine

packages/workflow-runtime
  WorkflowEngine
  WorkOrder state
  Step execution
  Recovery
```

规则：

- 前端不能直接访问 SQLite、Kuzu 或模型 provider。
- Rust bridge 不写业务逻辑，只负责 Tauri 能力和 sidecar 安全边界。
- NestJS Controller 不拼 prompt，不直接写数据库。
- AI package 不直接修改正式业务表。
- Repository 不调用 LLM。
- Graph 是 projection，不是事实源。

## NestJS 后端模块

### `AppModule`

组合所有模块，负责应用启动配置。

依赖：

- `ConfigModule`
- `HealthModule`
- `RpcModule`
- `ProjectModule`
- `WorkbenchModule`
- `ChapterModule`
- `CharacterModule`
- `WorldModule`
- `PlotModule`
- `MemoryModule`
- `WorkflowModule`
- `AiModule`
- `StorageModule`
- `GraphModule`
- `SearchModule`

### `RpcModule`

职责：

- 暴露 `POST /rpc`。
- 校验 RPC envelope。
- 校验 sidecar bridge token。
- 按 `command` 分发到 application service。
- 统一返回 success/error envelope。

### `ProjectModule`

职责：

- 创建项目目录。
- 初始化 `project.sqlite`。
- 初始化 `graph.kuzu`。
- 维护 `global.sqlite` 中的项目索引。
- 打开和关闭项目。
- 创建项目备份和快照。

### `ChapterModule`

职责：

- 管理 work、volume、chapter、scene。
- 保存章节正文。
- 创建章节版本。
- 处理 AI artifact 应用。
- 提供章节上下文所需聚合数据。

### `CharacterModule`

职责：

- 管理人物基础信息。
- 管理人物特点、目标、缺陷、秘密、声线。
- 管理人物关系的关系型事实。
- 为图谱投影提供 domain events。

### `WorldModule`

职责：

- 管理地点、组织、物品和世界规则。
- 区分 hard rule、soft rule、optional idea。
- 对 AI 输出做规则冲突检查。

### `PlotModule`

职责：

- 管理故事线、剧情节点、故事事件、冲突和伏笔。
- 维护剧情脉络和事件因果。
- 输出图谱关系。

### `MemoryModule`

职责：

- 管理 `memory_candidates`。
- 管理 `memories`。
- 提供确认、拒绝、合并、转 hypothesis 操作。
- 触发图谱和搜索索引更新。

### `WorkflowModule`

职责：

- 管理 work order。
- 执行 AI workflow。
- 持久化 workflow run 和 step。
- 支持暂停、恢复、取消、重试。
- 发布工作流事件。

### `AiModule`

职责：

- 模型 provider 配置。
- ModelGateway。
- PromptRegistry。
- ContextBuilder。
- StructuredOutputParser。
- ReviewEngine。
- MemoryExtractor。

## 数据模型

## 项目和作品

### `projects`

MVP 字段：

- `id`
- `title`
- `subtitle`
- `genre`
- `target_audience`
- `logline`
- `status`: `planning | drafting | revising | completed | archived`
- `word_count_goal`
- `current_word_count`
- `metadata_json`
- `created_at`
- `updated_at`

### `works`

MVP 字段：

- `id`
- `project_id`
- `title`
- `kind`: `main | side_story | extra`
- `status`: `active | archived`
- `sort_order`
- `created_at`
- `updated_at`

### `volumes`

MVP 字段：

- `id`
- `work_id`
- `title`
- `summary`
- `status`: `planned | drafting | done`
- `sort_order`
- `created_at`
- `updated_at`

## 章节和场景

### `chapters`

MVP 字段：

- `id`
- `volume_id`
- `title`
- `summary`
- `target_word_count`
- `current_word_count`
- `status`: `planned | drafting | reviewing | revised | locked`
- `content`
- `sort_order`
- `version`
- `created_at`
- `updated_at`

规则：

- 章节正文当前版本保存在 `chapters.content`。
- 每次用户保存和 AI 应用都写 `chapter_versions`。
- `version` 用于乐观锁，防止 AI 产物覆盖用户新改动。

### `chapter_versions`

MVP 字段：

- `id`
- `chapter_id`
- `version_no`
- `content`
- `summary`
- `source`: `user | ai | import | restore`
- `artifact_id`
- `created_at`

### `scenes`

MVP 字段：

- `id`
- `chapter_id`
- `title`
- `summary`
- `pov_character_id`
- `location_id`
- `story_time`
- `conflict_type`
- `emotional_turn`
- `sort_order`
- `metadata_json`
- `created_at`
- `updated_at`

## 人物、关系和特点

### `characters`

MVP 字段：

- `id`
- `project_id`
- `name`
- `aliases_json`
- `role`: `protagonist | antagonist | support | cameo`
- `archetype`
- `goal`
- `need`
- `flaw`
- `secret`
- `voice_profile`
- `biography`
- `status`: `draft | canon | deprecated`
- `created_at`
- `updated_at`

### `character_traits`

用于把人物特点结构化，避免都塞在小传里。

字段：

- `id`
- `character_id`
- `trait_type`: `personality | ability | weakness | habit | belief | fear | desire`
- `title`
- `description`
- `status`: `draft | canon | deprecated`
- `source_memory_id`
- `created_at`
- `updated_at`

### `entity_relations`

统一记录人物、组织、地点、物品之间的关系事实。

字段：

- `id`
- `project_id`
- `subject_type`
- `subject_id`
- `predicate`: `knows | hides_from | allied_with | opposes | belongs_to | owns | located_in | protects | betrays`
- `object_type`
- `object_id`
- `description`
- `status`: `draft | canon | hypothesis | deprecated`
- `source_memory_id`
- `created_at`
- `updated_at`

规则：

- 人物关系优先写入 `entity_relations`，再投影到 Kuzu。
- `status = canon` 才进入默认上下文。
- `hypothesis` 进入上下文时必须显式标注不确定。

## 世界观

### `world_rules`

字段：

- `id`
- `project_id`
- `category`: `magic | tech | society | history | geography | economy | custom`
- `title`
- `statement`
- `constraint_level`: `hard | soft | optional`
- `status`: `draft | canon | deprecated`
- `source_memory_id`
- `created_at`
- `updated_at`

### `locations`

字段：

- `id`
- `project_id`
- `name`
- `kind`: `city | room | realm | planet | region | other`
- `description`
- `parent_location_id`
- `status`
- `created_at`
- `updated_at`

### `organizations`

字段：

- `id`
- `project_id`
- `name`
- `kind`: `family | sect | company | kingdom | faction | school | other`
- `description`
- `status`
- `created_at`
- `updated_at`

### `items`

字段：

- `id`
- `project_id`
- `name`
- `kind`: `artifact | weapon | clue | resource | document | other`
- `description`
- `owner_character_id`
- `status`
- `created_at`
- `updated_at`

## 剧情脉络、事件和伏笔

### `plotlines`

字段：

- `id`
- `project_id`
- `title`
- `kind`: `main | branch | romance | mystery | growth | world`
- `summary`
- `status`: `planned | active | resolved | abandoned`
- `priority`
- `created_at`
- `updated_at`

### `plotline_nodes`

字段：

- `id`
- `plotline_id`
- `title`
- `description`
- `node_type`: `setup | turn | midpoint | climax | resolution`
- `chapter_id`
- `scene_id`
- `sort_order`
- `status`: `planned | drafted | done`
- `created_at`
- `updated_at`

### `story_events`

用于记录剧情事实和故事时间线。

字段：

- `id`
- `project_id`
- `title`
- `description`
- `event_type`: `decision | discovery | conflict | reveal | loss | victory | betrayal | travel | custom`
- `story_time`
- `chapter_id`
- `scene_id`
- `location_id`
- `outcome`
- `status`: `draft | canon | hypothesis | deprecated`
- `source_memory_id`
- `created_at`
- `updated_at`

### `event_participants`

字段：

- `id`
- `event_id`
- `character_id`
- `role`: `actor | target | witness | beneficiary | victim`
- `knowledge_state`: `knows | unaware | misled | uncertain`

### `event_relations`

字段：

- `id`
- `project_id`
- `source_event_id`
- `predicate`: `causes | enables | blocks | mirrors | contradicts | occurs_before`
- `target_event_id`
- `description`
- `status`: `canon | hypothesis | deprecated`

### `foreshadowings`

字段：

- `id`
- `project_id`
- `title`
- `description`
- `payoff_expectation`
- `status`: `planned | seeded | reinforced | paid_off | abandoned`
- `importance`
- `created_at`
- `updated_at`

### `foreshadowing_events`

字段：

- `id`
- `foreshadowing_id`
- `event_type`: `seed | reinforce | misdirect | payoff`
- `chapter_id`
- `scene_id`
- `description`
- `quote`
- `created_at`

## AI 工作流数据

### `work_orders`

字段：

- `id`
- `project_id`
- `title`
- `kind`: `story_bible | outline | chapter_draft | rewrite | review | memory_extract | foreshadowing_plan | element_generate`
- `target_type`
- `target_id`
- `status`: `queued | running | waiting_user | completed | failed | canceled`
- `priority`
- `created_by`: `user | system`
- `created_at`
- `updated_at`

### `workflow_runs`

字段：

- `id`
- `work_order_id`
- `workflow_type`
- `status`
- `input_json`
- `output_json`
- `started_at`
- `finished_at`
- `error_json`

### `workflow_steps`

字段：

- `id`
- `run_id`
- `step_key`
- `status`: `pending | running | completed | failed | skipped`
- `input_json`
- `output_json`
- `attempt`
- `started_at`
- `finished_at`
- `error_json`

### `artifacts`

字段：

- `id`
- `project_id`
- `work_order_id`
- `target_type`
- `target_id`
- `kind`: `story_bible | outline | chapter_draft | rewrite_patch | review_report | export`
- `title`
- `content`
- `file_id`
- `status`: `draft | applied | rejected | archived`
- `created_at`
- `updated_at`

### `memory_candidates`

字段：

- `id`
- `project_id`
- `work_order_id`
- `candidate_json`
- `source_text`
- `status`: `pending | accepted | merged | rejected`
- `created_at`
- `resolved_at`

### `memories`

字段：

- `id`
- `project_id`
- `memory_type`: `character_fact | relation | world_rule | event | foreshadowing | style`
- `subject_type`
- `subject_id`
- `predicate`
- `object_type`
- `object_id`
- `statement`
- `status`: `canon | hypothesis | deprecated | rejected`
- `confidence`
- `source_ref_json`
- `created_at`
- `updated_at`

## 知识图谱设计

### 事实源和投影

- SQLite 是事实源。
- Kuzu 是图谱读模型。
- 图谱所有节点和边都必须有 `source_table`、`source_id` 或 `source_event_id`。
- 图谱可从 SQLite 和 `domain_events` 重建。

### 节点

MVP 节点：

- `Project`
- `Work`
- `Volume`
- `Chapter`
- `Scene`
- `Character`
- `Location`
- `Organization`
- `Item`
- `WorldRule`
- `Plotline`
- `PlotNode`
- `StoryEvent`
- `Foreshadowing`
- `Memory`
- `Artifact`
- `WorkOrder`

### 边

MVP 边：

- `CONTAINS`
- `APPEARS_IN`
- `PARTICIPATES_IN`
- `OCCURS_IN`
- `OCCURS_BEFORE`
- `CAUSES`
- `KNOWS`
- `HIDES_FROM`
- `ALLIED_WITH`
- `OPPOSES`
- `BELONGS_TO`
- `LOCATED_IN`
- `OWNS`
- `CONSTRAINS`
- `SEEDED_IN`
- `REINFORCED_IN`
- `PAID_OFF_IN`
- `CONTRADICTS`
- `SUPPORTED_BY`
- `GENERATED`
- `AFFECTS`

### 图谱查询能力

MVP 必须支持：

- 查询人物一到二跳关系。
- 查询某章涉及的人物、地点、事件、伏笔。
- 查询未回收伏笔。
- 查询某个事件的前置因果。
- 查询某个世界规则影响的章节和事件。
- 查询某个 AI artifact 生成了哪些候选记忆。

## AI 能力设计

## 能力注册表

所有 AI 能力必须注册为 capability。

| Capability | 输入 | 输出 |
| --- | --- | --- |
| `idea.generateConcepts` | 题材、风格、目标读者 | 故事概念候选 |
| `storyBible.generate` | project brief、预设 | 故事圣经草案 |
| `outline.generate` | 故事圣经、故事线 | 卷纲、章纲、剧情节点 |
| `chapter.draft` | 章节目标、上下文包 | 章节草稿、记忆候选、审阅提示 |
| `text.rewrite` | 选中文本、修改目标 | patch proposal |
| `memory.extract` | 正文或 artifact | memory candidates |
| `continuity.review` | 检查范围、图谱邻域 | review issues |
| `foreshadowing.plan` | 大纲、伏笔状态 | 伏笔行动建议 |
| `element.generateNames` | 类型、风格、限制 | 名称候选 |

## ModelGateway

接口：

```ts
export interface ModelGateway {
  generateText(input: GenerateTextInput): Promise<GenerateTextResult>;
  generateObject<T>(input: GenerateObjectInput<T>): Promise<GenerateObjectResult<T>>;
  streamText(input: StreamTextInput): AsyncIterable<ModelStreamEvent>;
  embed(input: EmbedInput): Promise<EmbedResult>;
}
```

规则：

- 所有模型调用必须经过 ModelGateway。
- `model_calls` 必须记录 provider、model、purpose、prompt version、输入输出文件引用、token、耗时和状态。
- 测试环境必须使用 `FakeModelProvider`。
- provider 密钥从系统 keychain 读取，不进入前端和日志。

## Prompt 系统

目录：

```text
packages/ai/src/prompts/
  shared/
    global-writer-system.v1.md
    canon-boundary.v1.md
    output-contract.v1.md
  chapter-draft/
    system.v1.md
    user.v1.md
    output.schema.ts
  memory-extract/
    system.v1.md
    user.v1.md
    output.schema.ts
  continuity-review/
    system.v1.md
    user.v1.md
    output.schema.ts
  story-bible/
    system.v1.md
    user.v1.md
    output.schema.ts
```

### Prompt 分层

每次 AI 调用由以下层组成：

1. 全局创作角色  
   定义模型是“文学创作协作者”，关注长篇连续性、人物动机、叙事节奏和文本可读性。

2. Canon 边界  
   明确 canon、hypothesis、candidate、draft 的语义。模型不得把未确认信息当作事实。

3. 任务约束  
   明确当前任务，例如章节草稿、记忆提取、连续性检查。

4. 项目上下文  
   注入 project brief、故事圣经、人物、世界规则、剧情线、伏笔和相关章节摘要。

5. 输出契约  
   要求输出严格匹配 JSON schema 或 patch schema。

6. 禁止事项  
   禁止绕过设定、禁止引入未解释的重大新事实、禁止修改 canon、禁止丢失来源引用。

### 章节草稿系统提示词 v1

```text
你是 Story Pilot 的长篇小说章节草稿生成器。你的任务是基于用户确认的 canon 设定、章节目标、人物关系、世界规则、故事线和伏笔计划，生成当前章节草稿。

你必须遵守：
1. canon 是正式事实，必须遵守。
2. hypothesis 是不确定信息，只能作为可能方向，不能写成确定事实。
3. candidate 是未确认候选，不得作为事实基础。
4. 如果需要引入新人物、地点、物品、规则或重大剧情事实，必须在输出中放入 memory_candidates 或 review_notes，不得假装它们已经存在。
5. 不要修改用户未要求修改的设定。
6. 不要解释你的工作过程，只返回符合 schema 的结构化结果。
7. 章节正文需要体现人物目标、冲突推进、情绪转折和结尾钩子。
```

### 记忆提取系统提示词 v1

```text
你是 Story Pilot 的创作记忆提取器。你的任务是从章节正文或 AI 草稿中提取值得长期保存的事实、关系、事件、世界规则、伏笔和风格信息。

你必须遵守：
1. 只提取文本中明确出现或强支撑的信息。
2. 不要把猜测、隐喻、氛围描写提取为 canon 事实。
3. 每个候选都必须包含 source_quote 或 source_summary。
4. 每个候选都必须说明 memory_type、subject、predicate、object 或 statement。
5. 发现和已有 canon 冲突时，输出 conflict_notes。
6. 所有结果都是 candidate，不是 canon。
```

### 连续性检查系统提示词 v1

```text
你是 Story Pilot 的长篇连续性审阅器。你的任务是检查指定章节或范围是否违反已确认设定、人物状态、人物关系、世界规则、事件因果和伏笔计划。

你必须遵守：
1. 优先使用 canon memory 和图谱关系。
2. 对 hypothesis 只能提示风险，不能判定为硬性矛盾。
3. 每个问题必须给出 issue_type、severity、evidence、suggestion。
4. 不要重写正文，除非任务要求输出 patch。
5. 严重程度分为 info、warning、error。
```

## 上下文包设计

`ContextBuilder` 输出 `context_packages` 和 `context_package_items`。

上下文排序：

1. 用户当前选择内容。
2. 当前章节目标和摘要。
3. 前后章节摘要。
4. 相关 canon memory。
5. 图谱邻域。
6. 世界规则和风格规范。
7. FTS/semantic recall。
8. hypothesis memory。
9. 历史 artifact 摘要。

上下文预算：

- 章节草稿默认 12000 tokens。
- 局部润色默认 4000 tokens。
- 记忆提取默认 8000 tokens。
- 连续性检查默认 16000 tokens。

## Workflow Runtime

### 标准步骤

```text
ValidateInput
BuildContextPackage
CreateModelCall
CallModel
ParseStructuredOutput
ReviewAndValidate
PersistArtifact
ExtractMemoryCandidates
WaitForUserDecision
ApplyAcceptedChanges
EmitDomainEvents
ScheduleProjection
```

### 工作流状态

- `queued`
- `running`
- `waiting_user`
- `completed`
- `failed`
- `canceled`

### AI 输出类型

AI 只允许产生：

- `Artifact`
- `PatchProposal`
- `MemoryCandidate`
- `ReviewIssue`
- `NextAction`

## API/RPC 协议

### Envelope

Request：

```json
{
  "id": "req_01",
  "command": "chapter.generateDraft",
  "payload": {}
}
```

Success：

```json
{
  "id": "req_01",
  "ok": true,
  "data": {}
}
```

Failure：

```json
{
  "id": "req_01",
  "ok": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "请求参数不合法",
    "details": {}
  }
}
```

### MVP 命令

项目：

- `project.create`
- `project.listRecent`
- `project.open`
- `project.getOverview`
- `project.backup`

工作台：

- `workbench.getSnapshot`
- `workbench.getBoard`

章节：

- `chapter.list`
- `chapter.get`
- `chapter.create`
- `chapter.saveContent`
- `chapter.listVersions`
- `chapter.restoreVersion`
- `chapter.generateDraft`
- `chapter.reviewContinuity`

人物和世界：

- `character.list`
- `character.create`
- `character.update`
- `character.generateNames`
- `worldRule.list`
- `worldRule.create`
- `worldRule.update`

剧情和伏笔：

- `plotline.list`
- `plotline.create`
- `plotline.updateNode`
- `storyEvent.list`
- `storyEvent.create`
- `foreshadowing.list`
- `foreshadowing.create`
- `foreshadowing.plan`

AI 和工作流：

- `workOrder.list`
- `workOrder.get`
- `workflow.run`
- `workflow.cancel`
- `workflow.retry`
- `artifact.get`
- `artifact.apply`
- `artifact.reject`

记忆和图谱：

- `memory.listCandidates`
- `memory.confirm`
- `memory.reject`
- `memory.merge`
- `memory.search`
- `graph.getNeighborhood`
- `graph.findContradictions`
- `graph.rebuild`

## 前端 Ant Design 组件化设计

## 页面结构

```text
App
  AppProviders
    Antd ConfigProvider
    RouterProvider
    RpcClientProvider
    WorkspaceStateProvider
  ShellLayout
    ProjectSidebar
    MainWorkspace
    ProjectBoardDrawer
    AiTaskDrawer
    CommandPalette
```

## AntD 组件使用

| 场景 | AntD 组件 |
| --- | --- |
| 主布局 | `Layout`, `Sider`, `Content` |
| 顶部和工具区 | `Flex`, `Space`, `Button`, `Segmented`, `Dropdown` |
| 表单 | `Form`, `Input`, `InputNumber`, `Select`, `Radio`, `Checkbox`, `Switch` |
| 列表和表格 | `Tree`, `Table`, `List`, `Tag`, `Badge` |
| 看板和抽屉 | `Drawer`, `Tabs`, `Descriptions`, `Timeline` |
| 反馈 | `App`, `message`, `notification`, `Modal`, `Progress`, `Spin` |
| 编辑器外围 | `Splitter`, `Card` 少量使用，正文编辑器本体后续独立选型 |

### 组件边界

`features/project`：

- `ProjectSidebar`
- `ProjectCreateModal`
- `RecentProjectList`

`features/workbench`：

- `WorkbenchHome`
- `ProjectMetricsStrip`
- `NextActionPanel`
- `WorkbenchBoard`

`features/chapter`：

- `ChapterTree`
- `ChapterEditorPage`
- `ChapterMetaPanel`
- `ChapterVersionDrawer`
- `ApplyArtifactDiffModal`

`features/character`：

- `CharacterTable`
- `CharacterProfileForm`
- `CharacterRelationPanel`
- `NameGeneratorPopover`

`features/world`：

- `WorldRuleTable`
- `LocationTree`
- `OrganizationTable`
- `ItemTable`

`features/plot`：

- `PlotlineBoard`
- `StoryEventTimeline`
- `ForeshadowingTable`

`features/memory`：

- `MemoryCandidateList`
- `MemoryConfirmDrawer`
- `MemoryConflictPanel`
- `GraphPreviewPanel`

`features/ai`：

- `AiTaskDrawer`
- `WorkflowProgressTimeline`
- `ArtifactPreview`
- `CommandPalette`

## UI 规则

- 工作台是主入口，不提供常驻聊天主界面。
- AI 操作挂在对象和命令面板上。
- 所有 AI 长任务进入 `AiTaskDrawer`。
- 所有待确认记忆进入 `MemoryConfirmDrawer`。
- 正式设定修改必须有用户动作。
- 页面不直接拼 RPC 字符串，统一调用 `contracts` 中的 command helper。

## 测试用例

## 后端单元测试

| 用例 | 断言 |
| --- | --- |
| `resolveMemoryCandidateDecision("accept_as_canon")` | 返回 `memoryStatus = canon` |
| `resolveMemoryCandidateDecision("keep_as_hypothesis")` | 返回 `memoryStatus = hypothesis` |
| locked chapter 应用 artifact | 返回 `CHAPTER_VERSION_CONFLICT` 或 forbidden |
| AI draft workflow 完成 | artifact created，chapter 未被直接修改 |
| memory confirm | candidate accepted，memory canon，domain event created |

## 数据库测试

| 用例 | 断言 |
| --- | --- |
| 创建空项目库 | 所有 MVP 表存在 |
| migration 重复执行 | schema version 不重复写入 |
| 保存章节正文 | `chapters.version` 增加，`chapter_versions` 增加 |
| 应用 AI artifact | 事务内写版本、章节和 domain event |
| migration 失败 | 原库可恢复 |

## 图谱测试

| 用例 | 断言 |
| --- | --- |
| 创建人物 | Kuzu 有 `Character` 节点 |
| 确认人物关系 | Kuzu 有对应关系边 |
| 创建章节和场景 | 图谱有 `CONTAINS` 边 |
| 伏笔埋设 | 图谱有 `SEEDED_IN` 边 |
| 图谱重建 | 重建后关键查询结果一致 |

## AI 工作流测试

| 用例 | 断言 |
| --- | --- |
| fake provider 生成章节草稿 | 创建 artifact 和 memory candidates |
| 模型返回非法 JSON | workflow failed，保留错误 |
| 上下文超预算 | 低优先级内容被裁剪 |
| 用户取消 | work order canceled |
| 用户应用草稿 | chapter version 增加 |

## Prompt 测试

| 用例 | 断言 |
| --- | --- |
| 章节草稿 prompt | 包含 canon 边界、输出 schema、章节目标 |
| 记忆提取 prompt | 要求 source_quote，不允许直接 canon |
| 连续性检查 prompt | 区分 canon 和 hypothesis |
| prompt 版本变更 | `model_calls.prompt_version` 被记录 |

## 前端测试

| 用例 | 断言 |
| --- | --- |
| ShellLayout | 左侧项目区、中间工作台、右侧看板入口存在 |
| ChapterEditorPage | 章节树、编辑区、版本入口存在 |
| AiTaskDrawer | 接收到 workflow event 后显示进度 |
| MemoryConfirmDrawer | 可以接受、拒绝、合并候选 |
| AntD ConfigProvider | 主题 token 生效 |

## 验收标准

MVP 结束时必须满足：

- 用户可以创建本地项目。
- 用户可以维护人物、世界规则、故事线和伏笔。
- 用户可以创建、编辑、保存、恢复章节。
- 用户可以通过 AI 生成章节草稿。
- AI 草稿默认只进入 artifact。
- 用户可以应用 artifact 到章节，并产生版本。
- 系统可以从正文或 artifact 提取 memory candidate。
- 用户可以确认 canon memory。
- canon memory 和关系可以投影到 Kuzu。
- 后续章节生成可以读取 canon 和图谱邻域。
- 所有核心命令有 contracts、后端测试和前端调用封装。

