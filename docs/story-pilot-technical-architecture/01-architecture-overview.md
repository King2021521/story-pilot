# 总体架构

## 目标

Story Pilot 是一个面向长篇文学创作的桌面端 AI 创作工作台。技术架构需要同时满足三类要求：

- 创作管理：作品、卷、章节、场景、人物、世界观、剧情线、伏笔、风格规范都能被结构化管理。
- AI 生成闭环：AI 能参与构思、规划、撰写、润色、校正、连续性检查和记忆提取，但所有关键变更都可审阅、可回滚。
- 长期记忆：系统能跨章节、跨卷、跨创作阶段追踪设定、关系、事件和伏笔，降低长篇创作中的遗忘和前后矛盾。

## 推荐架构

```text
┌─────────────────────────────────────────────────────────────┐
│ Tauri Desktop App                                            │
│                                                             │
│  ┌────────────────────┐      ┌───────────────────────────┐  │
│  │ WebView Frontend   │      │ Rust Desktop Bridge        │  │
│  │ Workbench UI       │◄────►│ IPC / capabilities / fs    │  │
│  └────────────────────┘      └────────────┬──────────────┘  │
│                                            │                 │
│                                            │ managed sidecar │
│                                            ▼                 │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ NestJS TypeScript Sidecar Runtime                      │  │
│  │                                                        │  │
│  │  Controllers  App Services  Workflow Runtime  AI Layer │  │
│  │      │            │              │              │       │  │
│  │      ▼            ▼              ▼              ▼       │  │
│  │  SQLite      Kuzu Graph      File Store      LLM APIs   │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 进程模型

### WebView Frontend

职责：

- 呈现工作台、编辑器、看板、任务抽屉、设定库、人物库和图谱视图。
- 发起用户命令，例如生成大纲、补全章节、确认记忆、应用补丁、导出作品。
- 订阅工作流事件，展示进度、流式文本、错误、待确认项和完成状态。

不承担：

- 不直接访问数据库。
- 不直接持有模型 API Key。
- 不直接调用外部 LLM API。
- 不直接改写项目文件。

### Rust Desktop Bridge

职责：

- 作为桌面安全边界，管理 Tauri capability、文件访问范围、窗口、菜单、系统通知和快捷键。
- 管理 TypeScript sidecar 的启动、健康检查、关闭和异常恢复。
- 将前端 IPC 调用转发给 sidecar，并将 sidecar 事件转发给前端。
- 管理本地敏感信息访问，例如调用系统 keychain 获取模型密钥。

不承担：

- 不实现复杂业务规则。
- 不实现 AI 编排逻辑。
- 不直接写业务数据库，除非是启动、迁移、诊断等极少数桥接场景。

### NestJS TypeScript Sidecar Runtime

职责：

- 承载后端业务逻辑。
- 提供本地内部 HTTP RPC 服务。
- 执行数据库读写、图谱投影、搜索索引、文件存储、导入导出。
- 承载 AI 工作流运行时、上下文组装、模型网关、结构化输出解析和任务恢复。

选择 TypeScript 的原因：

- 和前端类型系统可以共享 contract。
- LLM SDK、文本处理、结构化 schema、workflow 生态更顺手。
- 更适合快速迭代 AI 产品逻辑。
- NestJS 提供模块化、依赖注入、Controller/Provider 分层和测试工具。
- Rust 保持薄桥接，降低桌面层复杂度。

## 组件分层

```text
UI Command
  │
  ▼
Tauri IPC
  │
  ▼
NestJS Controller
  │
  ▼
Application Service
  │
  ├── Domain Model
  ├── Workflow Runtime
  ├── Repository
  ├── Graph Service
  ├── Search Service
  ├── File Store
  └── Model Gateway
```

关键规则：

- `Application Service` 负责一个完整用例，例如“生成章节草稿”。
- `Domain Model` 只表达创作领域规则，不依赖数据库、LLM SDK 或 UI。
- `Workflow Runtime` 管理 AI 任务的步骤、状态、重试、取消和恢复。
- `Repository` 封装 SQLite 持久化。
- `Graph Service` 封装 Kuzu 图查询和投影。
- `Model Gateway` 统一模型提供商、流式输出、结构化输出、预算、重试和审计。

## 本地优先架构

Story Pilot 的数据默认落在本机：

```text
~/.story-pilot/
  setting.json
  global.sqlite
  diagnostics/
  logs/
  temp/
  projects/
    <projectId>/
      project.sqlite
      graph.kuzu/
      exports/
      artifacts/
      attachments/
      backups/
```

这种形态有几个优势：

- 每个作品是一个相对独立的创作空间，易备份、迁移、归档。
- SQLite 提供稳定事务和版本记录。
- Kuzu 作为嵌入式图数据库，无需用户安装 Neo4j 这类外部服务。
- 图谱、全文索引、向量索引都可以作为可重建读模型处理。

## 为什么不用主聊天 Agent 架构

主聊天入口不适合作为创作平台的唯一中枢：

- 小说创作对象复杂，聊天上下文容易丢失结构边界。
- 长篇创作需要版本、引用、确认、记忆、依赖关系和回滚。
- 用户真正关心的是“这章是否写完”“伏笔是否回收”“人物关系是否矛盾”，而不是一段对话是否顺畅。
- AI 应该服务于对象和流程，而不是让用户把所有工作都翻译成聊天指令。

更合理的设计是：

- 工作台承载结构化对象。
- AI 能力封装成对象动作。
- 复杂任务进入工作单。
- AI 输出进入草稿、候选和建议。
- 用户确认后才进入正式作品和记忆。

## 核心数据流

### 生成章节草稿

```text
用户点击“生成本章草稿”
  │
  ▼
Frontend 创建命令
  │
  ▼
Tauri Bridge 转发
  │
  ▼
Sidecar 创建 work_order 和 workflow_run
  │
  ▼
Context Builder 组装上下文包
  │
  ▼
Model Gateway 调用 LLM
  │
  ▼
Structured Parser 解析章节草稿、变更建议、记忆候选
  │
  ▼
Review Engine 做连续性和格式校验
  │
  ▼
写入 artifact 和候选项
  │
  ▼
Frontend 展示草稿、问题、待确认记忆
  │
  ▼
用户应用或调整
  │
  ▼
SQLite 更新正式章节，Graph Projector 更新 Kuzu
```

### 确认记忆

```text
AI 提取候选记忆
  │
  ▼
用户审阅候选项
  │
  ├── 确认为 canon
  ├── 标为 hypothesis
  ├── 合并到已有记忆
  └── 拒绝
  │
  ▼
SQLite 写入 memory 和 domain_event
  │
  ▼
Graph Projector 根据事件更新 Kuzu
  │
  ▼
后续上下文检索优先读取 canon memory
```

## 模块边界

| 模块              | 主要职责                                               | 不应承担                           |
| ----------------- | ------------------------------------------------------ | ---------------------------------- |
| Frontend          | UI、交互、状态呈现、用户命令                           | 数据库直连、LLM 密钥、复杂业务规则 |
| Rust Bridge       | Tauri 能力、sidecar 生命周期、安全边界                 | AI 编排、业务服务、复杂查询        |
| NestJS Sidecar    | Controller、Module、Provider、权限校验、请求响应和事件 | 直接拼 prompt                      |
| App Services      | 用户用例编排和事务边界                                 | 具体模型 provider 细节             |
| Domain            | 创作对象、规则、状态机                                 | 任何外部 IO                        |
| Workflow Runtime  | AI 任务步骤、暂停、恢复、取消、审计                    | UI 呈现                            |
| Model Gateway     | provider 抽象、调用日志、流式、重试                    | 业务对象最终落库                   |
| SQLite Repository | 事务性源数据                                           | 图遍历优化                         |
| Kuzu Graph        | 关系查询、图谱检索                                     | 唯一事实源                         |
| File Store        | 大文件、导入导出、快照                                 | 业务规则判断                       |

## 关键技术选型

| 层级           | 推荐方案                                     | 理由                                                             |
| -------------- | -------------------------------------------- | ---------------------------------------------------------------- |
| 桌面框架       | Tauri v2                                     | 轻量、安全能力强、适合本地应用                                   |
| 桌面桥接       | Rust commands + sidecar                      | Rust 控制桌面能力，业务逻辑放 TS                                 |
| Sidecar 运行时 | NestJS + Node.js + TypeScript                | 模块化、依赖注入、测试工具和工程规范更适合复杂后端               |
| 内部 API       | NestJS HTTP RPC                              | 保留本地 HTTP 调试和事件流能力，前端仍只能通过 Tauri bridge 调用 |
| 关系数据库     | SQLite + Drizzle ORM                         | 嵌入式、事务稳定、迁移简单                                       |
| 图数据库       | Kuzu embedded                                | 本地嵌入式 property graph，适合桌面端关系检索                    |
| 全文搜索       | SQLite FTS5                                  | MVP 足够，部署成本低                                             |
| 向量检索       | SQLite 向量扩展或 Kuzu vector extension      | 先本地化，后续可替换                                             |
| 测试           | Vitest + migration tests + workflow fixtures | 适合 TS 后端和 AI 流程回归                                       |

## 重要约束

### AI 不能直接写 canon

AI 只能产生以下结果：

- `Artifact`: 草稿、方案、分析报告。
- `PatchProposal`: 对已有对象的修改建议。
- `MemoryCandidate`: 记忆候选。
- `ReviewIssue`: 检查发现的问题。
- `NextAction`: 建议用户下一步操作。

进入正式作品或正式记忆必须通过用户动作或明确的自动化规则。

### 图谱可重建

Kuzu 中的数据来自 SQLite 源数据和 `domain_events`。任何时候如果图谱损坏、版本不兼容或 projection 失败，都应可以执行：

```text
清空 graph.kuzu
读取 SQLite source tables 和 domain_events
重建节点、边、索引
校验 projection_checkpoint
```

### 工作单可恢复

AI 工作流可能因为断网、模型失败、应用退出或用户取消而中断。每个 workflow step 都必须持久化：

- 输入摘要
- 上下文包引用
- 状态
- 重试次数
- 模型调用记录
- 输出 artifact
- 错误信息
- 下一步恢复策略

## MVP 架构边界

MVP 应优先完成：

- 单机本地项目
- SQLite 项目库
- Kuzu 图谱投影
- 作品管理、设定库、人物库、章节编辑
- AI 生成大纲、人物、世界观、章节草稿、润色和连续性检查
- 记忆候选确认
- 工作单和任务抽屉
- 本地备份和导出

MVP 暂缓：

- 多人实时协作
- 云端同步冲突解决
- 插件市场
- 自动商业化发布
- 多模型成本优化调度
- 复杂 Agent 对话编排
