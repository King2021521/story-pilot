# 工程结构设计

## 工程目标

工程结构需要支持三件事：

- 桌面端产品快速迭代。
- 后端业务逻辑和 AI 工作流可测试、可复用。
- 未来可以平滑拆出云同步、插件和团队协作能力。

推荐采用 pnpm workspace 管理多包工程。

## 推荐目录

```text
story-pilot/
  apps/
    desktop/
      src/
        app/
        components/
        features/
        routes/
        stores/
        styles/
      src-tauri/
        src/
          main.rs
          commands.rs
          sidecar.rs
          security.rs
          events.rs
        tauri.conf.json
        capabilities/
    sidecar/
      src/
        main.ts
        app.module.ts
        common/
        rpc/
        health/
        project/
        workbench/
        chapter/
        character/
        world/
        plot/
        memory/
        workflow/
        ai/
        storage/
        graph/
        search/
  packages/
    contracts/
      src/
        commands/
        events/
        schemas/
        errors.ts
    domain/
      src/
        work/
        chapter/
        character/
        world/
        plot/
        memory/
        workflow/
    db/
      src/
        schema/
        migrations/
        repositories/
        unit-of-work.ts
    graph/
      src/
        schema/
        projector/
        queries/
        graph-service.ts
    workflow-runtime/
      src/
        engine/
        step/
        scheduler/
        recovery/
        work-orders/
    ai/
      src/
        model-gateway/
        providers/
        prompts/
        structured-output/
        context-builder/
        review/
    search/
      src/
        fts/
        embeddings/
        chunking/
        retrieval/
    presets/
      src/
        genres/
        worldbuilding/
        characters/
        plot-patterns/
    export/
      src/
        markdown/
        epub/
        docx/
    testing/
      src/
        fixtures/
        fake-model-provider.ts
        db-test-utils.ts
  docs/
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
```

## 包职责

### `apps/desktop`

桌面 UI 和 Tauri 壳。

职责：

- 工作台 UI、章节编辑器、设定管理、看板和任务抽屉。
- 调用 Tauri command，不直接调用 sidecar HTTP。
- 订阅 Tauri event，渲染 AI 工作流进度。
- 只保存 UI 临时状态。

### `apps/sidecar`

基于 NestJS 的本地业务后端进程。

职责：

- 启动 NestJS 本地 HTTP RPC 服务。
- 初始化用户数据目录和项目目录。
- 连接 SQLite、Kuzu、索引和文件存储。
- 执行业务 service 和 workflow runtime。
- 向 Rust bridge 输出事件。

模块组织：

- `HealthModule`: sidecar 健康检查。
- `RpcModule`: 统一 RPC envelope 和 command dispatch。
- `ProjectModule`: 项目创建、打开、索引和备份。
- `ChapterModule`: 卷、章节、正文和版本。
- `CharacterModule`: 人物库和关系维护。
- `WorldModule`: 世界规则、地点、组织、物品。
- `PlotModule`: 故事线、剧情节点、伏笔。
- `MemoryModule`: 候选记忆、正式记忆和确认流。
- `WorkflowModule`: 工作单和 AI 工作流运行时。
- `AiModule`: 模型网关、提示词、结构化输出和审阅。
- `StorageModule`: 项目目录、文件存储、快照。
- `GraphModule`: Kuzu 图谱投影和查询。
- `SearchModule`: FTS、向量索引和上下文召回。

### `packages/contracts`

前后端共享协议。

内容：

- 命令 request/response schema。
- 事件 schema。
- 错误码。
- 分页、排序、过滤、权限上下文等通用类型。

要求：

- 所有 IPC/API 必须从这里导出类型。
- 使用 schema 做运行时校验，避免 UI 和 sidecar 类型漂移。

### `packages/domain`

纯领域模型。

内容：

- 作品、卷、章节、场景、人物、地点、组织、物品、世界规则。
- 剧情线、伏笔、冲突、事件。
- 记忆状态机。
- 工作单和工作流状态。

规则：

- 不能 import `db`、`ai`、`graph`、`search`、`desktop`。
- 只能表达确定性的业务规则。
- 适合做大量单元测试。

### `packages/db`

SQLite schema、migration 和 repository。

职责：

- 用 Drizzle 管理 schema 和迁移。
- 封装事务和 repository。
- 维护 `domain_events`。
- 维护版本表和乐观锁。

### `packages/graph`

Kuzu 图数据库封装。

职责：

- 定义图节点和边 schema。
- 根据 `domain_events` 做投影。
- 提供图查询能力，例如角色关系、伏笔链路、冲突网络、章节影响范围。
- 提供图谱重建和一致性校验。

### `packages/workflow-runtime`

AI 工作流运行时。

职责：

- 管理 workflow definition。
- 创建和推进 work order。
- 执行 step、暂停、恢复、取消、重试。
- 写入 workflow run 和 step 状态。
- 向前端发布进度事件。

### `packages/ai`

AI 能力层。

职责：

- 模型 provider 抽象。
- prompt template 和 prompt assembly。
- structured output 解析和校验。
- context builder。
- review engine。
- memory extractor。

关键约束：

- AI 层不直接写正式业务表。
- AI 层返回结构化结果，由 application service 决定如何持久化。

### `packages/search`

检索能力。

职责：

- 文本 chunking。
- SQLite FTS5 索引。
- embedding 生成和缓存。
- 混合检索。
- context package 组装支持。

### `packages/presets`

系统预设库。

内容：

- 题材、风格、叙事视角、节奏模板。
- 世界观设定模板。
- 人物 archetype。
- 冲突模式、剧情结构、伏笔模板。
- 名称生成词库和规则。

### `packages/export`

导出能力。

职责：

- Markdown、txt、epub、docx 导出。
- 分卷、章节、设定集、人物小传导出。
- 导出快照和发布包。

### `packages/testing`

测试工具。

内容：

- fake model provider。
- 固定模型输出 fixture。
- 临时项目库。
- migration 测试工具。
- workflow replay 工具。

## 依赖方向

```text
contracts
  ▲
  │
domain
  ▲
  │
db      graph      search      ai
  ▲        ▲          ▲         ▲
  └────────┴──────────┴─────────┘
              ▲
              │
        workflow-runtime
              ▲
              │
        apps/sidecar
              ▲
              │
        apps/desktop
```

更精确的规则：

- `domain` 可以依赖 `contracts` 中的基础类型，但不要反向依赖 UI 或 IO。
- `db`、`graph`、`search`、`ai` 可以依赖 `domain` 和 `contracts`。
- `workflow-runtime` 可以依赖 `domain`、`db`、`graph`、`search`、`ai`。
- `apps/sidecar` 负责组合依赖。
- `apps/desktop` 只依赖 `contracts` 和 UI 层自己的代码。

## 后端启动流程

```text
Tauri app 启动
  │
  ▼
Rust bridge 读取 app 配置
  │
  ▼
检查 sidecar binary 是否存在
  │
  ▼
启动 TypeScript sidecar
  │
  ▼
sidecar 初始化日志、配置、数据目录
  │
  ▼
执行 global.sqlite migration
  │
  ▼
打开最近项目或等待用户选择项目
  │
  ▼
执行 project.sqlite migration
  │
  ▼
打开 graph.kuzu 并校验 projection checkpoint
  │
  ▼
启动 API router、workflow scheduler、event bridge
  │
  ▼
Rust bridge 标记 backend ready
  │
  ▼
Frontend 加载 workbench snapshot
```

## 运行模式

### 开发模式

- Frontend 使用 Vite dev server。
- Sidecar 使用 tsx 或 ts-node-dev 启动。
- Tauri 指向本地 dev server。
- SQLite/Kuzu 使用开发数据目录。
- 模型 provider 可以切换为 fake provider。

### 桌面发布模式

- Frontend 静态资源打包进 Tauri。
- Sidecar 编译为可执行文件并作为 Tauri sidecar 分发。
- 数据保存在用户应用数据目录。
- 密钥通过系统 keychain 管理。
- 本地 API 绑定 `127.0.0.1` 随机端口，并使用启动令牌。

### 测试模式

- 使用临时数据目录。
- 使用 fake model provider。
- 使用固定时间和固定随机种子。
- 每个测试独立创建 SQLite/Kuzu 实例。

## 配置设计

全局配置分三类：

- 安全配置：模型 provider 密钥、sidecar token、文件访问范围。
- 用户偏好：默认模型、界面布局、自动保存、导出偏好。
- 工程配置：数据目录、日志级别、实验功能开关。

敏感信息不进入 SQLite 明文：

- API Key 放系统 keychain。
- SQLite 只保存 provider 名称、模型别名、是否启用、非敏感参数。
- 日志和模型调用记录默认做密钥和隐私字段脱敏。

## 代码生成和类型策略

推荐使用 schema-first 的 contract 方式：

```text
contracts command schema
  │
  ├── frontend request type
  ├── sidecar runtime validation
  └── test fixture builder
```

收益：

- IPC/API 变更可以被类型检查发现。
- 用户输入和 AI 输出都能走同一套 schema 校验。
- workflow fixture 可以直接复用 contract，减少测试样板。

## 日志与可观测性

本地桌面应用也需要完整追踪：

- app log：启动、窗口、sidecar 生命周期。
- api log：命令、耗时、错误码。
- workflow log：工作单、步骤、状态变化。
- model call log：模型、token、耗时、错误、输出引用。
- data log：migration、graph projection、backup。

日志默认按天切分并限制保留天数。模型原始输入输出默认只保存到项目内 `files/model-raw/`，由用户可配置关闭。
