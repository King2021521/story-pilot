# AI 工作流运行时设计

## 设计目标

Story Pilot 的 AI 能力不是一个常驻聊天机器人，而是一组被产品动作触发的工作流。运行时需要做到：

- 可审计：每一步做了什么、用了什么上下文、调用了哪个模型都可查。
- 可恢复：应用关闭、断网、模型失败后可以恢复或重试。
- 可控：AI 只能生成建议、草稿、候选和报告，不能绕过用户确认写入正式设定。
- 可扩展：后续可以增加新工作流，例如角色弧光分析、市场风格改写、出版审校。
- 可测试：用 fake model provider 和 fixture 重放核心流程。

## 总体结构

```text
WorkOrder
  │
  ▼
WorkflowRun
  │
  ├── Step 1: ValidateInput
  ├── Step 2: BuildContextPackage
  ├── Step 3: CallModel
  ├── Step 4: ParseStructuredOutput
  ├── Step 5: ReviewAndValidate
  ├── Step 6: PersistArtifact
  ├── Step 7: ExtractMemoryCandidates
  └── Step 8: AwaitUserConfirmation
```

运行时核心模块：

| 模块                     | 职责                         |
| ------------------------ | ---------------------------- |
| `WorkflowRegistry`       | 注册工作流定义               |
| `WorkflowEngine`         | 创建、推进、恢复和取消工作流 |
| `StepExecutor`           | 执行单个步骤                 |
| `WorkOrderService`       | 管理工作单生命周期           |
| `ContextBuilder`         | 构建 LLM 上下文包            |
| `ModelGateway`           | 模型调用统一入口             |
| `StructuredOutputParser` | 解析结构化输出               |
| `ReviewEngine`           | 连续性、格式、事实冲突检查   |
| `ArtifactService`        | 写入草稿、报告和补丁         |
| `MemoryExtractor`        | 提取记忆候选                 |
| `EventPublisher`         | 向前端发送进度事件           |

## 工作单模型

工作单是用户视角的 AI 任务。

示例：

- 生成新项目故事圣经。
- 生成第一卷大纲。
- 生成第 12 章草稿。
- 润色当前选中文本。
- 检查人物关系矛盾。
- 提取本章记忆候选。
- 规划伏笔埋设和回收。

工作单状态：

```text
queued
  │
  ▼
running
  │
  ├── waiting_user
  ├── completed
  ├── failed
  └── canceled
```

状态说明：

| 状态         | 含义                         |
| ------------ | ---------------------------- |
| queued       | 已创建，等待执行             |
| running      | 正在执行                     |
| waiting_user | 需要用户确认、选择或补充输入 |
| completed    | 已完成                       |
| failed       | 执行失败，可重试             |
| canceled     | 用户取消                     |

## 工作流定义

每个工作流建议定义为纯配置加 step 函数：

```ts
export const ChapterDraftWorkflow = defineWorkflow({
  type: "chapter_draft",
  inputSchema: ChapterDraftInputSchema,
  steps: [
    validateChapterTarget,
    buildChapterContext,
    generateChapterDraft,
    parseChapterDraft,
    reviewChapterDraft,
    persistDraftArtifact,
    extractDraftMemoryCandidates,
    waitForUserDecision,
  ],
});
```

要求：

- `inputSchema` 必须运行时校验。
- 每个 step 必须幂等或具备幂等 key。
- 每个 step 的输入输出必须可序列化。
- 长耗时 step 必须支持 cancel signal。
- 模型调用 step 必须写入 `model_calls`。

## 标准工作流生命周期

```text
1. Trigger
2. Create work_order
3. Create workflow_run
4. Validate input
5. Build context package
6. Execute model call
7. Parse structured output
8. Review output
9. Persist artifact
10. Extract memory candidates
11. Publish completion event
12. Await user confirmation
13. Apply accepted changes
14. Emit domain events
15. Update graph/search projections
```

### 触发方式

- 用户点击对象上的 AI 操作。
- Cmd+K 命令面板选择 AI 指令。
- 工作台阶段推进触发建议。
- 用户导入资料后触发解析和提取。
- 定时或后台检查触发连续性审阅。

### 上下文包

上下文包是一次 AI 调用的输入证据集合。

内容：

- 目标对象，例如章节、人物、故事线。
- 任务说明。
- 必选 canon memory。
- 图谱邻域结果。
- 全文和语义召回结果。
- 风格规范。
- 用户当前选中文本。
- 输出 schema。
- 禁止事项。

上下文包必须持久化，便于追踪“AI 当时看到了什么”。

### 结构化输出

模型输出不应只是一段自由文本。每类任务都要定义 schema。

章节草稿输出：

```json
{
  "draft": {
    "title": "string",
    "content": "string",
    "summary": "string",
    "word_count_estimate": 3500
  },
  "changes": [
    {
      "target_type": "chapter",
      "target_id": "chapter_12",
      "change_type": "replace_content",
      "description": "生成章节正文"
    }
  ],
  "memory_candidates": [
    {
      "memory_type": "event",
      "statement": "主角在第十二章第一次意识到旧都火灾和父亲有关。",
      "source_quote": "..."
    }
  ],
  "review_notes": [
    {
      "severity": "warning",
      "message": "本章结尾引入新地点，需要补充地点设定。"
    }
  ]
}
```

## AI 不能直接提交正式变更

运行时只允许 AI 写入这些中间对象：

- `artifacts`
- `artifact_versions`
- `memory_candidates`
- `review_issues`
- `work_order` 输出
- `model_calls`

正式对象写入必须由 application service 处理，并满足以下条件之一：

- 用户点击应用。
- 用户确认记忆。
- 用户启用明确的自动化规则，例如“低风险标点修正自动应用”。

## 模型网关

`ModelGateway` 是所有 LLM 调用的唯一入口。

职责：

- provider 抽象。
- 模型配置和别名。
- stream/non-stream 调用。
- structured output。
- token 预算。
- 重试和超时。
- 成本估算。
- 敏感信息脱敏。
- request/response 存档。
- cancellation。

接口草案：

```ts
interface ModelGateway {
  generateText(input: GenerateTextInput): Promise<GenerateTextResult>;
  generateObject<T>(input: GenerateObjectInput<T>): Promise<GenerateObjectResult<T>>;
  streamText(input: StreamTextInput): AsyncIterable<ModelStreamEvent>;
  embed(input: EmbedInput): Promise<EmbedResult>;
}
```

### provider 选择

MVP 支持：

- OpenAI compatible provider。
- 自定义 base URL。
- fake provider，用于测试。

后续支持：

- 本地模型。
- 多 provider fallback。
- 针对任务类型的模型路由。

## 上下文构造器

`ContextBuilder` 输入：

- 任务类型。
- 目标对象。
- token budget。
- 用户额外要求。
- 输出 schema。

构造过程：

```text
读取目标对象
  │
  ▼
加入结构化必选上下文
  │
  ▼
查询 canon memory
  │
  ▼
查询 Kuzu 图谱邻域
  │
  ▼
执行 FTS/semantic recall
  │
  ▼
去重、压缩、排序
  │
  ▼
写入 context_packages
```

### 排序规则

优先级从高到低：

1. 用户当前显式选择或正在编辑的内容。
2. 目标章节和相邻章节。
3. canon memory。
4. 当前人物和当前故事线相关图谱邻域。
5. 世界规则和风格规范。
6. 全文/语义召回。
7. hypothesis memory。
8. 历史 artifact 摘要。

## Review Engine

评审器不是单一模型调用，而是一组规则和 AI 审阅混合能力。

### 规则检查

- 输出 JSON schema 是否合法。
- 章节目标字数是否严重偏离。
- 是否缺失标题、摘要、正文。
- 是否引用不存在的人物或地点。
- 是否对 locked 章节提出直接修改。

### 图谱检查

- 人物关系是否矛盾。
- 事件时间线是否冲突。
- 世界规则是否被违反。
- 伏笔回收是否缺少埋设。

### AI 审阅

适合处理：

- 文风是否一致。
- 情绪推进是否自然。
- 对话是否符合人物声线。
- 节奏是否拖沓。
- 冲突是否有效。

AI 审阅输出也必须结构化。

## 核心工作流

### `ProjectBriefWorkflow`

目标：从用户选择的题材、风格、目标读者、核心卖点中生成项目 brief。

步骤：

```text
validate input
build preset context
generate logline and concept
generate alternative directions
persist artifact
await user selection
apply selected brief
```

输出：

- 故事概念候选。
- 一句话故事。
- 目标读者。
- 核心爽点或文学表达目标。
- 风格方向。

### `StoryBibleDraftWorkflow`

目标：生成故事圣经草案。

步骤：

```text
read project brief
build genre and worldbuilding presets
generate world rules
generate core characters
generate core conflicts
generate plot skeleton
persist artifacts and memory candidates
await user confirmation
```

输出：

- 世界观草案。
- 主角和关键人物草案。
- 主线冲突。
- 关键设定。
- 初始 canon memory 候选。

### `OutlineGenerationWorkflow`

目标：生成卷纲、章纲、剧情节点。

步骤：

```text
load story bible
load plotline graph
generate volume outline
generate chapter beats
check pacing and causality
persist outline artifact
create plotline node candidates
await user apply
```

输出：

- 卷结构。
- 章节目标。
- 剧情转折。
- 高潮和回收点。
- 伏笔计划建议。

### `ChapterDraftWorkflow`

目标：生成章节正文草稿。

步骤：

```text
validate chapter status
build chapter context package
stream chapter draft
parse draft output
review continuity
persist draft artifact
extract memory candidates
await user apply
```

输出：

- 章节正文草稿。
- 本章摘要。
- 场景拆分建议。
- 新记忆候选。
- 连续性风险。

### `RewriteSelectionWorkflow`

目标：对选中文本做润色、扩写、压缩、改视角或改风格。

步骤：

```text
capture selection
load local context
apply rewrite instruction
return patch proposal
review tone consistency
await user apply
```

输出：

- patch proposal。
- 修改说明。
- 可能影响的设定或记忆候选。

### `ContinuityReviewWorkflow`

目标：检查章节、卷或全书的前后矛盾。

步骤：

```text
select scope
load graph neighborhood
load canon memories
run rule checks
run model review
merge issues
persist review report
```

输出：

- 矛盾列表。
- 严重程度。
- 来源引用。
- 修复建议。

### `MemoryExtractionWorkflow`

目标：从章节正文、导入资料或 AI 草稿中提取记忆候选。

步骤：

```text
chunk source text
extract facts and relations
deduplicate candidates
detect conflicts
persist memory_candidates
await user confirmation
```

输出：

- 人物事实候选。
- 事件候选。
- 世界规则候选。
- 关系候选。
- 伏笔候选。

### `ForeshadowingPlanWorkflow`

目标：根据大纲和现有伏笔规划埋设、强化和回收。

步骤：

```text
load plotlines
load unresolved foreshadowings
load chapter plan
generate foreshadowing actions
validate payoff support
persist plan artifact
await user apply
```

输出：

- 新伏笔建议。
- 伏笔事件计划。
- 回收章节建议。
- 风险提示。

### `ElementGenerationWorkflow`

目标：生成人名、地名、组织名、物品、能力、招式等元素。

步骤：

```text
read genre and culture settings
read naming constraints
generate candidates
filter duplicate names
rank by fit
return selectable options
```

输出：

- 候选列表。
- 风格解释。
- 重名冲突。
- 可直接创建的对象 payload。

## 工作流恢复

恢复策略：

| 中断点                 | 恢复方式                    |
| ---------------------- | --------------------------- |
| 创建 work_order 后中断 | 标记 queued，可重新执行     |
| 构建上下文后中断       | 复用 context package 或重建 |
| 模型调用中断           | 标记 failed，可重新调用     |
| 产物已写入但未确认     | 恢复 waiting_user           |
| 用户应用中断           | 事务回滚或版本校验后重试    |

## 并发控制

限制：

- 同一章节同时只能有一个会写入正文的工作流。
- 同一项目可以并行运行多个只读审阅任务。
- 图谱投影可以异步串行处理。
- 模型调用并发需要按 provider 配额限制。

锁策略：

- 章节编辑使用 `version` 乐观锁。
- 工作单使用状态 CAS。
- 图谱投影使用单 projector lock。

## 成本和预算

每个工作流都应有预算：

- token budget。
- 最大模型调用次数。
- 最大重试次数。
- 最大执行时间。

超预算时：

- 工作流暂停。
- 保存已完成产物。
- 前端提示用户继续、降级或取消。

## Prompt 管理

Prompt 需要版本化：

```text
prompts/
  chapter-draft/
    v1.system.md
    v1.user.md
    schema.json
  memory-extract/
    v1.system.md
    v1.user.md
    schema.json
```

要求：

- prompt version 写入 `model_calls`。
- prompt 不直接拼接未清洗的用户输入。
- prompt 中明确 canon、hypothesis、candidate 的含义。
- prompt 中要求输出来源引用。

## 测试策略

AI 工作流必须可以在无真实模型的环境下测试：

- fake provider 返回固定输出。
- fixture 覆盖正常输出、JSON 破损、内容冲突、超长输出。
- golden test 校验 context package。
- replay test 从 `workflow_steps` 重放。

最低测试集：

- 章节草稿生成成功。
- 章节草稿生成后不直接修改正式章节。
- 用户应用草稿后生成章节版本。
- 记忆候选确认后进入 canon。
- 图谱投影失败不影响 SQLite 事务。
