# 安全、测试、运维和路线图

## 安全目标

Story Pilot 是本地创作工具，默认承载用户的未公开作品、设定和商业创意。安全设计需要覆盖：

- 本地文件访问边界。
- 模型 API Key 保护。
- 本地 sidecar 通信保护。
- AI 请求出站可见性。
- 日志和模型记录脱敏。
- 备份和恢复。
- 防止 AI 自动污染正式设定。

## 桌面安全边界

### Tauri capability

原则：

- 只开启必要 capability。
- 文件系统只授权项目目录和用户显式选择的路径。
- 高风险操作必须由 Rust bridge 处理。
- 前端不能获得任意文件读写能力。

高风险能力：

- 读取任意本地目录。
- 删除项目目录。
- 导出到外部目录。
- 打开外部链接。
- 启动外部进程。

处理方式：

- 文件选择走 Tauri dialog。
- 路径经过 Rust bridge 校验。
- sidecar 只接收项目相对路径或授权后的路径 token。

### Sidecar token

如果采用 Fastify 本地 HTTP：

- sidecar 只监听 `127.0.0.1`。
- 端口随机分配。
- Rust bridge 启动 sidecar 时生成随机 token。
- 所有 sidecar 请求必须带 token。
- token 不暴露给 WebView。
- sidecar 关闭时 token 失效。

### Command allowlist

Rust bridge 维护 command allowlist：

- 未登记命令拒绝。
- 高风险命令要求额外确认。
- debug 命令不进入 release build。

### Secret 管理

模型 API Key：

- 存系统 keychain。
- `global.sqlite` 只保存 `api_key_ref`。
- 日志和模型调用记录必须脱敏。
- 导出项目时默认不包含密钥。

## 数据隐私

### 模型出站提示

每次 AI 调用可能发送用户作品内容到模型 provider。产品需要提供：

- provider 配置页。
- 当前任务将发送哪些上下文的摘要。
- 是否保存模型原始请求和响应的开关。
- 清理模型原始记录的入口。

### 最小上下文原则

ContextBuilder 不应把整本书粗暴塞给模型。

策略：

- 目标对象必选。
- canon memory 优先。
- 图谱邻域限制深度。
- 全文和语义召回限制条数。
- token budget 约束。
- 用户敏感资料可标记为禁止发送到外部模型。

## AI 安全和创作安全

### Canon 边界

安全规则：

- AI 输出默认是草稿或候选。
- AI 不能直接写 canon memory。
- AI 不能直接覆盖章节正文。
- 用户确认或明确自动化规则是正式变更入口。

### 自动化规则

允许低风险自动化：

- 标点修正。
- 格式整理。
- 错别字建议。
- 章节摘要更新草稿。

不允许默认自动化：

- 修改人物关系。
- 修改世界观硬规则。
- 创建重大剧情事实。
- 删除章节正文。
- 标记伏笔已回收。

## 测试设计

## 测试分层

```text
Unit Tests
  │
  ▼
Repository / Migration Tests
  │
  ▼
Workflow Fixture Tests
  │
  ▼
Graph Projection Tests
  │
  ▼
IPC Contract Tests
  │
  ▼
Desktop E2E Tests
```

### 单元测试

覆盖：

- 领域状态机。
- 章节版本规则。
- 记忆状态流转。
- 工作单状态流转。
- prompt input 构造规则。
- patch 应用规则。

重点用例：

- AI 草稿不能直接进入正式章节。
- candidate 不能被检索为 canon。
- locked chapter 不允许被普通工作流覆盖。
- hypothesis 在上下文中必须带不确定标记。

### Repository 和 migration 测试

覆盖：

- 新建项目库 migration。
- 从旧版本升级。
- migration 失败回滚。
- 事务失败不产生半写入。
- `domain_events` 与业务表一致。

测试方式：

- 每个测试创建临时 SQLite。
- migration 从空库执行。
- 关键 schema 用快照检查。

### 图谱投影测试

覆盖：

- 人物创建投影到 Kuzu。
- 章节创建后 CONTAINS 边正确。
- 确认人物关系后生成对应边。
- deprecated memory 后边状态更新。
- projection 中断后从 checkpoint 继续。
- graph rebuild 后查询结果一致。

### AI 工作流 fixture 测试

使用 fake model provider。

覆盖：

- 正常章节草稿生成。
- 模型返回非法 JSON。
- 模型返回缺字段 JSON。
- 模型输出包含不存在人物。
- 模型调用超时。
- 用户取消。
- 重试成功。

断言：

- work order 状态正确。
- workflow steps 记录完整。
- model_calls 记录完整。
- artifact 被创建。
- 正式章节未自动改写。
- memory_candidates 被创建但未 canon。

### Context package golden tests

上下文包是 AI 质量关键，需要固定测试：

- 给定项目、章节和图谱，生成的上下文条目顺序稳定。
- canon memory 优先于 semantic recall。
- 超预算时低优先级内容被裁剪。
- hypothesis 有明确标记。
- rejected memory 不进入上下文。

### IPC contract tests

覆盖：

- request schema 校验。
- response schema 校验。
- 错误码格式。
- Rust allowlist 与 contracts 对齐。
- sidecar 未授权请求被拒绝。

### Desktop E2E

后续 UI 稳定后再做：

- 新建项目。
- 生成故事圣经。
- 创建人物。
- 生成章节草稿。
- 应用草稿。
- 确认记忆。
- 导出 Markdown。

## 运维和诊断

虽然是桌面应用，也需要本地运维能力。

### 健康检查

检查项：

- sidecar 是否存活。
- SQLite 是否可读写。
- Kuzu 是否可查询。
- projection checkpoint 是否落后。
- 索引是否过期。
- 最近备份时间。
- 模型 provider 是否可用。

### 诊断包

用户反馈问题时，可以导出诊断包。

默认包含：

- app 版本。
- OS 信息。
- 日志摘要。
- 错误堆栈。
- migration 版本。
- workflow 状态。

默认不包含：

- 作品正文。
- 模型 API Key。
- 模型原始请求和响应。
- 用户导入资料。

需要用户明确勾选才包含项目数据。

### 日志策略

日志等级：

- error。
- warn。
- info。
- debug。

保留策略：

- 默认保留 14 天。
- 单文件最大 10 MB。
- 超限滚动。

脱敏：

- API Key。
- Authorization header。
- 用户自定义敏感字段。
- 模型请求中的明确秘密标记内容。

## 备份恢复

### 自动备份时机

- 每天首次打开项目。
- migration 前。
- 应用 AI 批量变更前。
- 用户手动创建快照。

### 恢复类型

| 类型 | 范围 | 说明 |
| --- | --- | --- |
| 章节版本恢复 | 单章 | 从 `chapter_versions` 恢复 |
| 项目备份恢复 | 整个项目 DB | 恢复 `project.sqlite` |
| 项目快照恢复 | DB + 文件 | 恢复完整项目状态 |
| 图谱重建 | 读模型 | 从 SQLite 重新构建 Kuzu |
| 索引重建 | 读模型 | 重建 FTS 和 embedding |

### 恢复原则

- 恢复前先创建当前状态备份。
- 恢复后校验数据库 schema。
- 图谱和索引恢复失败不应导致项目不可打开。

## 性能设计

### 数据规模假设

MVP 目标：

- 单项目 1 到 5 部作品。
- 单作品 100 到 1000 章。
- 单章 2000 到 8000 字。
- 人物 50 到 500 个。
- 记忆 1000 到 50000 条。
- 伏笔 50 到 1000 条。

### 性能目标

| 操作 | 目标 |
| --- | --- |
| 打开项目 | 小于 2 秒 |
| 工作台 snapshot | P95 小于 300ms |
| 章节打开 | P95 小于 200ms |
| 搜索 | P95 小于 500ms |
| 图谱邻域查询 | P95 小于 500ms |
| 创建工作单 | P95 小于 150ms |
| AI 首个进度事件 | 小于 500ms |

### 性能策略

- 工作台 snapshot 使用聚合查询和缓存。
- 章节正文按需加载。
- 图谱查询限制深度和返回数。
- 搜索索引异步更新。
- embedding 异步批处理。
- 大模型原始记录放文件系统。

## 发布和版本

### 桌面构建

构建产物：

- Tauri app。
- sidecar executable。
- frontend static assets。
- migration 文件。
- system presets。

发布检查：

- sidecar 能随 app 启动。
- release build 不包含 debug token。
- migration 从上一版本通过。
- 新建项目和打开旧项目通过。
- 基础 AI workflow fake provider 测试通过。

### 数据版本

需要维护：

- app version。
- global schema version。
- project schema version。
- graph schema version。
- preset library version。
- prompt version。

## 技术路线图

### Phase 0：工程骨架

目标：

- 建立 monorepo。
- Tauri app 启动。
- sidecar 启动和 health check。
- contracts 包。
- SQLite migration 基础设施。
- fake model provider。

验收：

- 桌面端可以启动 sidecar。
- 前端可以通过 Tauri command 调用 sidecar。
- 新建空项目成功。

### Phase 1：本地创作工作台

目标：

- 项目管理。
- 作品、卷、章节管理。
- 章节编辑和版本。
- 人物、地点、世界规则基础管理。
- 本地导出 Markdown/txt。

验收：

- 无 AI 配置也能完整创建和管理作品。
- 章节版本可恢复。

### Phase 2：AI 工作流 MVP

目标：

- 工作单系统。
- ModelGateway。
- ContextBuilder。
- 章节草稿生成。
- 局部润色。
- 连续性检查初版。
- model_calls 审计。

验收：

- AI 草稿进入 artifact，不直接覆盖正文。
- 用户可应用或拒绝。
- workflow 失败可重试。

### Phase 3：知识图谱记忆

目标：

- Kuzu schema。
- GraphProjector。
- memory candidate。
- 用户确认 canon。
- 图谱邻域检索。
- 伏笔关系追踪。

验收：

- 确认人物关系后可在图谱查询。
- 生成章节时能注入相关 canon memory。
- 图谱可重建。

### Phase 4：创作闭环强化

目标：

- 故事圣经生成。
- 大纲生成。
- 伏笔规划。
- 批量记忆确认。
- 更细的连续性检查。
- 上下文包质量评估。

验收：

- 从新建项目到多章生成形成闭环。
- 看板能显示未完成工作、未确认记忆、伏笔风险。

### Phase 5：高级能力

目标：

- epub/docx 导出。
- 本地模型支持。
- 项目压缩归档。
- 可选云同步。
- 插件和自定义工作流。
- 多 provider 调度。

## 主要风险

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| AI 质量不稳定 | 用户不信任生成 | 工作流审阅、上下文包、版本和人工确认 |
| 记忆候选太多 | 用户处理成本高 | 分组、去重、置信度、批量处理 |
| 图谱复杂度过高 | 查询噪声和维护成本 | MVP 限制节点/边类型，保留重建能力 |
| Sidecar 发布复杂 | 桌面安装失败 | Phase 0 先打通 sidecar 打包 |
| 大作品性能下降 | 编辑和检索卡顿 | 按需加载、索引、异步 projection |
| 用户数据丢失 | 严重信任问题 | 自动备份、快照、版本恢复 |

## MVP 验收清单

- 可以创建和打开本地项目。
- 可以创建卷、章节、人物、世界规则。
- 章节正文有版本和恢复。
- 可以配置模型 provider。
- 可以生成章节草稿并保存为 artifact。
- 草稿不会自动覆盖正文。
- 可以应用草稿并生成章节版本。
- 可以提取记忆候选。
- 用户确认后记忆进入 canon。
- canon memory 可以进入后续上下文。
- Kuzu 图谱可以查询人物关系。
- 图谱可以重建。
- 可以导出 Markdown 或 txt。
- 可以创建项目备份。

