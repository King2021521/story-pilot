# P2 AI 工作流、提示词与评测体系 Spec

## 目标

把当前单次生成能力升级为可生产使用的 AI 创作工作流：每项 AI 能力都有版本化提示词、结构化输出、上下文包、质量审阅、连续性审阅、失败重试、产物审计和评测集。

## 当前缺口

- 已有 `ModelGateway`、prompt registry 和少量 schema，但大纲、蓝图、世界观、人物、剧情等核心生成能力还不完整。
- 当前 `outline.generate` 是固定模板，不是真实 LLM 规划。
- prompt 仍偏短，缺少网络小说方法论、长篇节奏、题材差异化、平台读者预期等约束。
- 没有离线评测集和质量基准，无法判断 prompt 改动是变好还是变差。
- 未配置模型时会走 fake provider；生产态必须显式阻断。

## 范围

本阶段必须完成：

- AI 能力注册表升级。
- 真实 LLM 工作流覆盖九步创作路径。
- 系统提示词分层。
- 每个工作流输出 artifact/candidate/review。
- 模型调用审计和失败恢复。
- Prompt eval 测试集。

本阶段不做：

- 多模型路由市场。
- 自动微调。
- 多 Agent 自治聊天。

## AI 能力清单

必须新增或强化以下 capability：

| Capability               | 输入                                              | 输出                                       | 是否写 canon |
| ------------------------ | ------------------------------------------------- | ------------------------------------------ | ------------ |
| `brief_refine`           | 用户初始想法、题材、读者                          | 立项建议 artifact                          | 否           |
| `blueprint_generate`     | brief、题材方法论                                 | blueprint draft                            | 否           |
| `worldbuilding_generate` | blueprint、题材、约束                             | world candidates                           | 否           |
| `character_generate`     | blueprint、世界观、角色需求                       | character candidates                       | 否           |
| `relationship_generate`  | characters、冲突需求                              | relationship candidates                    | 否           |
| `plot_arc_generate`      | blueprint、characters、world                      | plotline/conflict/foreshadowing candidates | 否           |
| `outline_generate`       | plot arcs、characters、world、目标字数            | full/volume/chapter outline draft          | 否           |
| `chapter_draft`          | chapter outline、context package                  | chapter draft artifact                     | 否           |
| `chapter_rewrite`        | selected text、rewrite instruction、canon context | patch artifact                             | 否           |
| `continuity_review`      | scope、canon memory、graph                        | review report                              | 否           |
| `memory_extract`         | accepted text/artifact                            | memory candidates                          | 否           |
| `retrospective_generate` | batch result、open issues                         | retrospective artifact                     | 否           |

## 提示词分层

每次模型调用都由以下层拼装：

```text
Global Writer System
Canon Boundary
Capability System Prompt
Genre Method Pack
Project Style Pack
Context Package
User Instruction
Output Schema Contract
```

### Global Writer System

职责：

- 保持长篇连载意识。
- 优先维护读者承诺、因果、人物动机和情绪回报。
- 不替用户确认 canon。
- 不绕开 schema。

### Canon Boundary

规则：

- confirmed/canon 是硬约束。
- hypothesis 是风险提示，不是事实。
- candidate 只能作为候选，不得当成已生效设定。
- 与 canon 冲突时必须输出 review issue，不得自行改 canon。

### Genre Method Pack

每个主流题材至少维护一份方法包：

- 玄幻/仙侠：力量体系、升级节奏、资源冲突、宗门/王朝/秘境结构。
- 都市：身份差、职业场景、关系压力、现实锚点。
- 悬疑：线索公平性、误导、反转、真相层级。
- 科幻：科技边界、社会影响、硬设定一致性。
- 历史：时代约束、权力结构、人物行为边界。
- 轻小说：角色魅力、日常节奏、单元事件和情绪回报。

## 工作流模板

所有 AI 工作流使用统一状态机：

```text
created
preparing_context
calling_model
validating_schema
reviewing_quality
reviewing_continuity
persisting_artifact
extracting_memory_candidates
waiting_user
completed
failed
cancelled
```

失败策略：

- schema 解析失败：最多重试 1 次，并附加上一轮校验错误。
- HTTP 失败：按 setting `maxRetries` 重试。
- 模型超时：工作流进入 `failed`，保留 context package 和 request metadata。
- 用户取消：进入 `cancelled`，不写 artifact。

## 数据模型

新增或强化表：

```ts
ai_capabilities(
  key text primary key,
  display_name text not null,
  status text not null,
  default_prompt_version text not null,
  output_schema_name text not null
)

prompt_versions(
  id text primary key,
  capability_key text not null,
  version text not null,
  prompt_hash text not null,
  content text not null,
  status text not null,
  created_at integer not null
)

quality_reports(
  id text primary key,
  project_id text not null,
  target_type text not null,
  target_id text not null,
  score integer not null,
  dimensions_json text not null,
  issues_json text not null,
  model_call_id text,
  created_at integer not null
)

ai_eval_runs(
  id text primary key,
  capability_key text not null,
  prompt_version text not null,
  fixture_id text not null,
  score integer not null,
  result_json text not null,
  created_at integer not null
)
```

已有 `model_calls` 必须保留：

- provider
- model
- purpose
- promptVersion
- request
- response
- usage
- latency
- status
- workflowRunId

## API

```ts
ai.generate(input: {
  projectId: string;
  capability: AiCapabilityKey;
  targetType?: string;
  targetId?: string;
  instruction?: string;
  options?: {
    temperature?: number;
    maxOutputTokens?: number;
  };
}): {
  workOrderId: string;
  workflowRunId: string;
}

ai.getRun(input: {
  projectId: string;
  workflowRunId: string;
}): WorkflowRunRecord

ai.cancelRun(input: {
  projectId: string;
  workflowRunId: string;
}): WorkflowRunRecord

ai.listArtifacts(input: {
  projectId: string;
  targetType?: string;
  targetId?: string;
  kind?: string;
}): ArtifactRecord[]
```

## 当前可复用实现

- `packages/ai/src/model-gateway/model-gateway.ts`：已有 `generateObject`、`streamText`、`embed` 网关。
- `packages/ai/src/prompts/prompt-registry.ts`：已有 prompt registry 基础。
- `packages/ai/src/structured-output/*`：已有 chapter draft、memory、continuity、foreshadowing、element schema。
- `packages/workflow-runtime/src`：已有 workflow engine 和 registry。
- `apps/sidecar/src/ai/model-gateway.provider.ts`：已有 OpenAI-compatible provider 接线和 fake provider。
- `packages/db/src/schema/workflow.ts`：已有 work order、workflow run、model call 基础。
- `apps/sidecar/src/chapter/chapter.service.ts`：已有章节草稿 workflow 示例。

## 实施切片

### P2.1 生产态模型配置边界

产物：

- `ModelGatewayFactory` 根据 settings 创建真实 provider。
- 未配置模型时返回 `AI_MODEL_NOT_CONFIGURED`，不走 fake provider。
- fake provider 只允许测试环境显式启用。

验证：

- provider factory 单元测试覆盖 production/test 两种模式。
- UI AI 按钮在未配置模型时显示设置入口。

### P2.2 Capability Registry 和 Prompt Packs

产物：

- `AiCapabilityKey` 覆盖 brief、blueprint、world、character、relationship、plot、outline、chapter、rewrite、review、memory、retrospective。
- 每个 capability 有 system prompt、output schema、default prompt version。
- Genre method pack 可按题材选择。

验证：

- registry 测试确保每个 capability 能加载 prompt 和 schema。
- prompt hash 变化会写入 prompt version。

### P2.3 统一 AI Workflow

产物：

- `AiWorkflowService.generate()` 统一创建 work order、context package、model call、artifact。
- schema 失败、HTTP 失败、取消、重试都有状态记录。
- 所有正式 AI 入口改为调用统一 workflow。

验证：

- RPC 集成测试覆盖成功、schema retry、HTTP retry、cancel。
- model_calls 记录包含 prompt version 和 contextPackageId。

### P2.4 Prompt Eval

产物：

- 离线 deterministic eval runner。
- 真实模型人工评审 fixture。
- 分题材 fixture 覆盖玄幻、悬疑、都市。

验证：

- `pnpm --filter @story-pilot/ai test` 包含 eval runner 单元测试。
- 手动 eval 输出保存为 `ai_eval_runs` 或发布材料。

## Prompt Eval

建立 `packages/ai-evals` 或 `packages/ai/src/evals`：

测试夹具按题材组织：

```text
fixtures/
  xuanhuan-longform/
    brief.json
    canon.json
    expected-qualities.json
  suspense-case/
  urban-career/
```

评测维度：

- schema validity。
- canon compliance。
- novelty。
- genre fit。
- chapter usability。
- conflict clarity。
- hook strength。
- memory extract quality。

最低分：

- 结构化输出合法率：100%。
- canon 硬冲突：0。
- 可直接采纳率：内测人工评审不低于 70%。
- 章节草稿平均评分不低于 75/100。

## 测试用例

单元测试：

- PromptRegistry 可以按 capability/version 加载提示词。
- 缺失 prompt version 抛出明确错误。
- schema validation 失败时返回可重试错误。
- fake provider 只能在测试或显式开发环境使用。

集成测试：

```text
1. 配置 mock OpenAI-compatible provider。
2. 调用 blueprint_generate。
3. 记录 model_calls。
4. 生成 artifact，不写 canon。
5. 用户 apply artifact 后才写 story_blueprints。
```

E2E：

```text
1. 设置真实或 mock 模型。
2. 从 brief 生成 blueprint。
3. 生成世界观候选。
4. 采纳部分候选。
5. 生成人物候选。
6. 生成剧情弧线候选。
7. 生成 10 章章纲。
8. 生成第 1 章正文 artifact。
9. artifact 页面可查看 prompt version、context package 和 review notes。
```

## 阶段验证清单

完成 P2 时必须保存以下证据：

- `pnpm --filter @story-pilot/ai test`
- `pnpm --filter @story-pilot/workflow-runtime test`
- `pnpm --filter @story-pilot/sidecar test`
- `pnpm --filter @story-pilot/desktop test`
- mock OpenAI-compatible provider 集成测试输出。
- 至少一轮真实模型人工评审记录。

## 验收标准

- 所有 AI 生成都通过统一 workflow 状态机。
- 每次模型调用都能追溯到 prompt version、context package、schema 和 artifact。
- 生产态未配置模型时 AI 按钮不能返回 fake 内容。
- 大纲生成不再使用固定模板作为正式能力。
- prompt eval 成为 CI 可运行的离线测试，真实模型评测作为手动发布门禁。
