# P0 运行时、配置与发布基础 Spec

## 目标

把 Story Pilot 从开发环境可运行提升到生产安装包可用：安装后应用可以独立启动 sidecar，自动创建本地目录和配置文件，稳定读写项目数据，提供日志、诊断、备份和恢复能力。

## 当前缺口

- Tauri sidecar runner 仍带有开发期假设，存在依赖源码仓库、全局 Node 或全局 pnpm 的风险。
- `~/.story-pilot` 已有基础目录思路，但缺少完整目录契约、权限检查、损坏恢复和诊断导出。
- 模型配置由环境变量和 setting.json 混合驱动，缺少 UI 可见状态、配置校验和脱敏策略。
- DMG 可打包，但没有形成发布门禁：安装、启动、sidecar health、模型配置、项目创建、数据库写入都需要自动化 smoke test。

## 范围

本阶段必须完成：

- 生产安装包不依赖本地源码仓库。
- sidecar 作为 Tauri 管理的本地进程启动。
- `~/.story-pilot/setting.json` 自动创建、读取、校验和修复。
- 项目数据、SQLite、Kuzu、导出、日志、备份目录标准化。
- 数据库 migration 可重复执行，失败可定位。
- 增加诊断导出和备份恢复命令。
- 建立安装包 smoke test。

本阶段不做：

- 云同步。
- 多用户登录。
- API key Keychain 加密存储。后续可以升级，但当前按用户要求保持 setting.json 简化方案。

## 本地目录契约

```text
~/.story-pilot/
  setting.json
  global.sqlite
  logs/
    app.log
    sidecar.log
    model-call.log
  projects/
    <projectId>/
      project.sqlite
      graph.kuzu/
      exports/
      backups/
      artifacts/
      attachments/
  diagnostics/
  temp/
```

目录创建规则：

- sidecar 启动时调用 `StorageBootstrapService.ensureHome()`。
- 缺失目录自动创建。
- `setting.json` 缺失时写入默认值。
- `setting.json` JSON 损坏时移动到 `setting.invalid.<timestamp>.json`，再创建默认文件。
- SQLite 打不开时不覆盖原文件，先创建诊断事件并提示用户恢复备份。

## `setting.json` 结构

```json
{
  "version": 1,
  "model": {
    "provider": "openai-compatible",
    "baseUrl": "",
    "apiKey": "",
    "model": "gpt-5.5",
    "embeddingModel": "",
    "timeoutMs": 120000,
    "maxRetries": 2
  },
  "storage": {
    "homeDir": "~/.story-pilot",
    "autoBackup": true,
    "backupRetention": 20
  },
  "privacy": {
    "redactApiKeyInLogs": true,
    "allowDiagnosticsExport": true
  }
}
```

配置规则：

- `model.apiKey` 允许为空。为空时 UI 必须显示“未配置真实模型”，生产包不能静默使用 fake provider 完成创作。
- `baseUrl` 为空时真实模型不可用。
- 日志中永远不能出现完整 `apiKey`。
- 测试环境允许显式启用 fake provider：`STORY_PILOT_ALLOW_FAKE_MODEL=true`。

## 后端设计

新增或强化模块：

- `ConfigModule`
  - `RuntimeSettingsService.load()`
  - `RuntimeSettingsService.updatePatch()`
  - `RuntimeSettingsService.validateModelConfig()`
- `StorageModule`
  - `StorageBootstrapService.ensureHome()`
  - `StorageBootstrapService.ensureProject(projectId)`
  - `BackupService.createProjectBackup(projectId)`
  - `BackupService.restoreProjectBackup(projectId, backupId)`
- `DiagnosticsModule`
  - `DiagnosticsService.exportBundle()`
  - `DiagnosticsService.getHealthReport()`
- `AiModule`
  - `createModelGatewayFromSettings(settings, env)`

生产包 sidecar 启动顺序：

```text
Tauri app starts
Rust bridge allocates localhost port and bridge token
Rust bridge starts packaged sidecar
sidecar loads ~/.story-pilot/setting.json
sidecar initializes logs and storage directories
sidecar opens global.sqlite and runs migrations
sidecar exposes /health and /rpc on 127.0.0.1:<port>
Rust bridge verifies /health before UI reports backend ready
```

## IPC/API

新增命令：

```ts
settings.get(): RuntimeSettings

settings.update(input: {
  model?: {
    baseUrl?: string;
    apiKey?: string;
    model?: string;
    embeddingModel?: string;
    timeoutMs?: number;
    maxRetries?: number;
  };
  storage?: {
    autoBackup?: boolean;
    backupRetention?: number;
  };
}): RuntimeSettings

settings.validateModel(input?: {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}): {
  ok: boolean;
  provider: string;
  model: string;
  latencyMs?: number;
  errorCode?: string;
}

diagnostics.getHealth(): {
  sidecar: "ok" | "degraded" | "failed";
  storage: "ok" | "degraded" | "failed";
  model: "configured" | "missing" | "failed";
  appHome: string;
  projectCount: number;
}

diagnostics.export(): {
  path: string;
  redacted: true;
}

backup.createProject(input: { projectId: string }): {
  backupPath: string;
  createdAt: number;
}

backup.restoreProject(input: { projectId: string; backupPath: string }): {
  restoredProjectId: string;
  restoredAt: number;
}
```

## 前端设计

新增设置入口：

- 左下角用户区增加设置按钮。
- 设置页包含“模型配置”“数据与备份”“诊断信息”三个 tab。
- 模型未配置时，创作路径中所有真实 AI 按钮显示可见提示，不允许假装生成成功。
- 诊断页展示 app home、global db、当前项目 db、graph path、sidecar health、最近错误。

## 当前可复用实现

- `apps/desktop/src-tauri/src/lib.rs`：已有 Rust bridge、sidecar token、RPC 转发和重试基础。
- `apps/desktop/src-tauri/build.rs`：已有 sidecar runner 生成逻辑。
- `apps/desktop/src-tauri/tauri.conf.json`：已有 `externalBin` 配置。
- `apps/sidecar/src/config/runtime-settings.ts`：已有运行时配置读取基础。
- `apps/sidecar/src/storage/project-storage.service.ts`：已有 `~/.story-pilot`、global sqlite、project sqlite、graph path 基础。
- `apps/sidecar/src/rpc/rpc.service.ts`：已有统一 RPC 分发入口。
- `apps/sidecar/src/health/health.service.ts`：已有 sidecar health 基础。

## 实施切片

### P0.1 配置和目录引导

产物：

- `RuntimeSettingsService` 统一从 `~/.story-pilot/setting.json` 读取配置。
- `StorageBootstrapService` 在 sidecar 启动时创建完整目录契约。
- `settings.get`、`settings.update`、`settings.validateModel` RPC 可用。

验证：

- setting 缺失、损坏、版本迁移都有测试。
- 未配置模型时 UI 显示阻断态。

### P0.2 生产 sidecar 打包

产物：

- sidecar 可在安装包内独立运行。
- 不依赖源码仓库、全局 `node`、全局 `pnpm`。
- Rust bridge 启动 sidecar 时只注入端口、token、app home。

验证：

- 在移除 `STORY_PILOT_REPO_ROOT` 后安装包仍能启动。
- sidecar stderr 写入日志而不是只输出到终端。

### P0.3 备份、恢复和诊断

产物：

- 项目备份包含 `project.sqlite`、`graph.kuzu`、项目 manifest。
- 恢复前验证 manifest。
- 诊断包脱敏 setting、日志和失败 workflow 摘要。

验证：

- 备份恢复集成测试。
- API key 脱敏快照测试。

### P0.4 安装包 smoke

产物：

- 自动化 smoke 脚本覆盖首次启动、创建项目、重启恢复。
- DMG 验证纳入发布门禁。

验证：

- `hdiutil verify` 通过。
- smoke 输出包含 sidecar health、setting path、project count。

## 测试用例

单元测试：

- `RuntimeSettingsService` 在 setting 缺失时创建默认文件。
- setting JSON 损坏时保留损坏文件并创建默认文件。
- API key 脱敏函数输出 `sk-...abcd` 或空串，不输出完整密钥。
- `createModelGatewayFromSettings` 在未配置模型时返回 production blocked 状态，不返回 fake provider。

集成测试：

- sidecar 启动后创建 `~/.story-pilot` 测试目录结构。
- `settings.update` 写入后重启 sidecar 仍能读取。
- `backup.createProject` 生成包含 `project.sqlite` 和 `graph.kuzu` 的备份。
- `backup.restoreProject` 可以恢复到新项目目录并打开。

E2E/smoke：

```text
1. 安装 DMG。
2. 启动 Story Pilot。
3. 等待 sidecar health 为 ok。
4. 打开设置页，确认 setting.json 路径可见。
5. 创建作品。
6. 保存作品立项。
7. 退出并重启应用。
8. 作品仍存在，项目数据库可打开。
9. 导出诊断包，检查没有完整 apiKey。
```

## 阶段验证清单

完成 P0 时必须保存以下证据：

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
- `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`
- `pnpm --filter @story-pilot/desktop tauri:build --bundles dmg --ci`
- `hdiutil verify "apps/desktop/src-tauri/target/release/bundle/dmg/Story Pilot_0.1.0_aarch64.dmg"`
- 首次启动 smoke test 记录。

## 验收标准

- 在没有源码仓库、没有全局 pnpm 的机器上，安装包能启动应用和 sidecar。
- 未配置模型时，所有 AI 功能给出明确配置提示，不返回 fake 内容。
- 配置真实模型后，`settings.validateModel` 至少完成一次真实请求校验。
- `~/.story-pilot` 下所有目录按契约创建。
- 备份和恢复命令至少覆盖 SQLite 和 Kuzu。
- DMG 构建后必须通过 `hdiutil verify` 和安装启动 smoke test。
