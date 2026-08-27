# IPC、API 与事件设计

## 通信原则

Story Pilot 是桌面端应用，不应把本地后端当成公开 Web 服务。推荐通信路径：

```text
Frontend
  │ Tauri invoke / event
  ▼
Rust Bridge
  │ local authenticated bridge
  ▼
TypeScript Sidecar
```

原则：

- 前端不直接访问 sidecar 端口。
- sidecar 只绑定 `127.0.0.1` 随机端口，或使用 stdin/stdout JSON-RPC。
- Rust bridge 启动 sidecar 时生成一次性 token。
- 所有命令 request/response 都走共享 contract schema。
- 长任务通过事件流更新进度。

## 两种可选通信方案

### 方案 A：NestJS 本地 HTTP RPC

```text
Rust Bridge starts sidecar
  │
  ▼
NestJS sidecar binds 127.0.0.1:<random>
  │
  ▼
Rust Bridge stores port and token
  │
  ▼
Frontend invokes Rust command
  │
  ▼
Rust forwards request to sidecar HTTP
```

优点：

- 开发和调试方便。
- 支持 streaming 和健康检查。
- NestJS Module、Controller、Provider 和测试工具适合长期维护。
- HTTP RPC 便于开发调试、健康检查和事件流。
- 后续拆成独立服务成本低。

风险：

- 本地端口需要 token、防 CSRF、防误连。
- 需要处理端口生命周期。

### 方案 B：stdin/stdout JSON-RPC

```text
Rust Bridge starts sidecar
  │
  ▼
Rust sends JSON-RPC over stdin
  │
  ▼
sidecar writes response/events to stdout
```

优点：

- 不暴露端口。
- 安全边界更封闭。

风险：

- streaming、日志分离、调试复杂。
- backpressure 和进程恢复要更谨慎。

### 推荐

MVP 推荐方案 A：NestJS 本地 HTTP RPC，但前端只能通过 Tauri command 调用。

约束：

- 绑定 `127.0.0.1`，禁止 `0.0.0.0`。
- 随机端口。
- 每次启动生成 bridge token。
- token 只在 Rust 和 sidecar 之间传递。
- sidecar 拒绝没有 token 的请求。

## Tauri command 设计

前端统一调用一个或少量命令：

```ts
await invoke("sp_command", {
  command: "chapter.generateDraft",
  payload: {
    projectId,
    chapterId,
    instruction
  }
});
```

Rust command 草案：

```rust
#[tauri::command]
async fn sp_command(
  command: String,
  payload: serde_json::Value,
  state: tauri::State<'_, AppState>
) -> Result<serde_json::Value, AppError> {
  state.sidecar_client.call(command, payload).await
}
```

优势：

- 前端 contract 简单。
- Rust bridge 薄。
- 新增后端命令不需要频繁改 Rust。

需要注意：

- Rust 仍要校验 command 是否在 allowlist 中。
- 高风险命令可以拆成专用 Tauri command，例如选择目录、打开文件。

## Sidecar API

如果采用 NestJS 本地 HTTP RPC，本地 API 可统一为：

```text
POST /rpc
GET  /events
GET  /health
```

### `POST /rpc`

请求：

```json
{
  "id": "req_01",
  "command": "chapter.generateDraft",
  "payload": {
    "projectId": "proj_01",
    "chapterId": "chapter_12"
  }
}
```

响应：

```json
{
  "id": "req_01",
  "ok": true,
  "data": {
    "workOrderId": "wo_01",
    "workflowRunId": "run_01"
  }
}
```

错误：

```json
{
  "id": "req_01",
  "ok": false,
  "error": {
    "code": "CHAPTER_VERSION_CONFLICT",
    "message": "章节已被修改，请刷新后重试。",
    "details": {
      "expectedVersion": 12,
      "currentVersion": 13
    }
  }
}
```

### `GET /events`

用于 Rust bridge 订阅 sidecar 事件，再转发给前端。

事件可以使用 Server-Sent Events，也可以使用 WebSocket。MVP 使用 SSE 足够。

### `GET /health`

返回：

```json
{
  "status": "ok",
  "version": "0.1.0",
  "uptimeMs": 12000,
  "activeProjectId": "proj_01"
}
```

## 命令命名

命令采用领域前缀：

```text
app.*
project.*
workbench.*
chapter.*
scene.*
character.*
world.*
plot.*
foreshadowing.*
memory.*
workflow.*
workOrder.*
artifact.*
search.*
graph.*
export.*
import.*
settings.*
```

## 核心命令草案

### App 和项目

| 命令 | 说明 |
| --- | --- |
| `app.getBootstrapState` | 获取应用启动状态 |
| `project.create` | 创建项目 |
| `project.open` | 打开项目 |
| `project.close` | 关闭项目 |
| `project.listRecent` | 最近项目 |
| `project.getOverview` | 项目概览 |
| `project.backup` | 手动备份 |
| `project.restoreSnapshot` | 从快照恢复 |

### 工作台

| 命令 | 说明 |
| --- | --- |
| `workbench.getSnapshot` | 获取首页聚合数据 |
| `workbench.getBoard` | 获取右侧看板数据 |
| `workbench.updateLayoutState` | 保存布局状态 |

### 章节

| 命令 | 说明 |
| --- | --- |
| `chapter.list` | 章节列表 |
| `chapter.get` | 获取章节 |
| `chapter.create` | 创建章节 |
| `chapter.updateMeta` | 更新章节元信息 |
| `chapter.saveContent` | 保存正文 |
| `chapter.listVersions` | 版本列表 |
| `chapter.restoreVersion` | 恢复版本 |
| `chapter.generateDraft` | 生成草稿 |
| `chapter.reviewContinuity` | 连续性检查 |

### 设定对象

| 命令 | 说明 |
| --- | --- |
| `character.create` | 创建人物 |
| `character.update` | 更新人物 |
| `character.generateNames` | 生成人名 |
| `world.createRule` | 创建世界规则 |
| `world.updateRule` | 更新世界规则 |
| `plot.createLine` | 创建故事线 |
| `plot.updateNode` | 更新故事线节点 |
| `foreshadowing.create` | 创建伏笔 |
| `foreshadowing.plan` | 规划伏笔 |

### AI 工作流

| 命令 | 说明 |
| --- | --- |
| `workOrder.create` | 创建工作单 |
| `workOrder.get` | 获取工作单 |
| `workOrder.list` | 工作单列表 |
| `workflow.run` | 执行工作流 |
| `workflow.cancel` | 取消工作流 |
| `workflow.retry` | 重试工作流 |
| `artifact.get` | 获取产物 |
| `artifact.apply` | 应用产物 |
| `artifact.reject` | 拒绝产物 |

### 记忆和图谱

| 命令 | 说明 |
| --- | --- |
| `memory.listCandidates` | 记忆候选列表 |
| `memory.confirm` | 确认候选 |
| `memory.reject` | 拒绝候选 |
| `memory.merge` | 合并候选 |
| `memory.search` | 记忆搜索 |
| `graph.getNeighborhood` | 获取图谱邻域 |
| `graph.findContradictions` | 查找矛盾 |
| `graph.rebuild` | 重建图谱 |

### 导入导出

| 命令 | 说明 |
| --- | --- |
| `import.file` | 导入文件 |
| `import.extractMemories` | 从导入资料提取记忆 |
| `export.run` | 导出 |
| `export.list` | 导出记录 |

## 事件模型

前端订阅事件，而不是轮询工作流状态。

事件基础结构：

```json
{
  "id": "evt_01",
  "type": "workflow.step.completed",
  "projectId": "proj_01",
  "timestamp": 1787820000000,
  "payload": {}
}
```

## 核心事件

### 工作流事件

| 事件 | 说明 |
| --- | --- |
| `workflow.started` | 工作流开始 |
| `workflow.step.started` | 步骤开始 |
| `workflow.step.completed` | 步骤完成 |
| `workflow.step.failed` | 步骤失败 |
| `workflow.token.delta` | 流式文本片段 |
| `workflow.waiting_user` | 等待用户确认 |
| `workflow.completed` | 工作流完成 |
| `workflow.failed` | 工作流失败 |
| `workflow.canceled` | 工作流取消 |

### 产物事件

| 事件 | 说明 |
| --- | --- |
| `artifact.created` | 创建产物 |
| `artifact.updated` | 更新产物 |
| `artifact.applied` | 应用产物 |
| `artifact.rejected` | 拒绝产物 |

### 记忆事件

| 事件 | 说明 |
| --- | --- |
| `memory.candidate.created` | 记忆候选创建 |
| `memory.candidate.updated` | 记忆候选更新 |
| `memory.confirmed` | 记忆确认 |
| `memory.rejected` | 记忆拒绝 |
| `memory.conflict.detected` | 发现记忆冲突 |

### 看板事件

| 事件 | 说明 |
| --- | --- |
| `board.updated` | 看板数据更新 |
| `project.metrics.updated` | 项目指标更新 |
| `chapter.status.changed` | 章节状态变化 |

### 系统事件

| 事件 | 说明 |
| --- | --- |
| `backend.ready` | sidecar ready |
| `backend.unhealthy` | sidecar 异常 |
| `graph.rebuild.started` | 图谱重建开始 |
| `graph.rebuild.completed` | 图谱重建完成 |
| `search.reindex.completed` | 索引重建完成 |

## 流式输出

章节生成时，模型可能流式返回文本。推荐流程：

```text
ModelGateway receives token
  │
  ▼
WorkflowEngine appends to transient buffer
  │
  ▼
EventPublisher emits workflow.token.delta
  │
  ▼
Frontend renders preview
  │
  ▼
Final output parsed and persisted as artifact
```

注意：

- 流式 token 只是预览，不等于最终 artifact。
- 最终 artifact 必须来自完整输出和结构化解析结果。
- 如果模型中断，预览文本可以保存为失败草稿，但不能自动应用。

## 错误码设计

错误码按领域划分：

```text
APP_*
PROJECT_*
CHAPTER_*
WORKFLOW_*
MODEL_*
MEMORY_*
GRAPH_*
SEARCH_*
FILE_*
VALIDATION_*
SECURITY_*
```

示例：

| 错误码 | 说明 |
| --- | --- |
| `PROJECT_NOT_FOUND` | 项目不存在 |
| `CHAPTER_VERSION_CONFLICT` | 章节版本冲突 |
| `WORKFLOW_ALREADY_RUNNING` | 目标对象已有冲突工作流 |
| `MODEL_PROVIDER_NOT_CONFIGURED` | 模型 provider 未配置 |
| `MODEL_OUTPUT_PARSE_FAILED` | 模型输出解析失败 |
| `MEMORY_CONFLICT_DETECTED` | 记忆冲突 |
| `GRAPH_UNAVAILABLE` | 图谱不可用 |
| `FILE_OUT_OF_SCOPE` | 文件超出允许范围 |

## 权限和安全

### Command allowlist

Rust bridge 中维护允许命令列表：

```text
chapter.generateDraft
artifact.apply
memory.confirm
graph.rebuild
```

未知命令直接拒绝。

### 高风险命令

高风险命令需要额外确认或系统能力：

- 打开外部目录。
- 删除项目。
- 恢复快照。
- 清理模型原文。
- 导出到任意目录。

### 文件范围

前端不传任意绝对路径给 sidecar 直接读写。需要：

- 通过 Tauri 文件选择器获得授权路径。
- Rust bridge 校验路径范围。
- sidecar 只操作授权 token 或项目相对路径。

## Contract 示例

### `chapter.generateDraft`

Request：

```ts
type ChapterGenerateDraftRequest = {
  projectId: string;
  chapterId: string;
  instruction?: string;
  options?: {
    targetWordCount?: number;
    styleGuideId?: string;
    modelAlias?: string;
  };
};
```

Response：

```ts
type ChapterGenerateDraftResponse = {
  workOrderId: string;
  workflowRunId: string;
};
```

### `artifact.apply`

Request：

```ts
type ArtifactApplyRequest = {
  projectId: string;
  artifactId: string;
  targetVersion?: number;
  applyMode: "replace" | "patch" | "append" | "create_version_only";
};
```

Response：

```ts
type ArtifactApplyResponse = {
  applied: boolean;
  targetType: string;
  targetId: string;
  newVersion?: number;
  domainEventIds: string[];
};
```

### `memory.confirm`

Request：

```ts
type MemoryConfirmRequest = {
  projectId: string;
  candidateId: string;
  decision: "canon" | "hypothesis" | "merge" | "reject";
  mergeTargetMemoryId?: string;
  editedStatement?: string;
};
```

Response：

```ts
type MemoryConfirmResponse = {
  memoryId?: string;
  status: "canon" | "hypothesis" | "merged" | "rejected";
  domainEventIds: string[];
};
```

## 性能目标

本地 API 目标：

- 普通读取命令：P95 小于 100ms。
- 工作台 snapshot：P95 小于 300ms。
- 图谱邻域查询：P95 小于 500ms。
- 创建工作单：P95 小于 150ms。
- AI 任务启动到首个进度事件：小于 500ms。

AI 生成耗时由模型决定，但 UI 必须在 500ms 内显示任务已开始。
