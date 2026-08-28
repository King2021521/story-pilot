# P6 生产 QA、性能、观测与发布门禁 Spec

## 目标

建立 Story Pilot 生产发布前必须通过的质量门禁：自动化测试、长篇压测、安装包 smoke test、日志诊断、数据恢复、安全检查和性能预算。

## 当前缺口

- 当前已有 lint/typecheck/test/build/DMG 验证，但没有统一发布门禁文档和自动化脚本。
- 缺少百万字级数据集压测。
- 缺少安装后应用 smoke test。
- 日志、诊断和错误码体系还不完整。
- API key 脱敏、数据备份、崩溃恢复需要明确验收。

## 生产级补强重点

P6 的生产级目标是把发布判断从人工感觉变成可重复验证。只有通过安装、数据、AI、长篇性能和恢复演练的版本，才能交给真实创作者使用。

必须补强：

- 根目录提供统一发布门禁命令，覆盖 lint、typecheck、test、build、Tauri、DMG 和 longform。
- DMG smoke 必须验证首次启动、设置目录创建、sidecar health、创建项目、重启恢复。
- synthetic longform project 必须覆盖 1000 章、10000 记忆、5000 事件、800 伏笔，并包含可检测连续性问题。
- 性能预算必须覆盖打开项目、章节树、记忆检索、图谱查询、context package、章节保存和备份。
- 恢复演练必须覆盖 project.sqlite 损坏、Kuzu 重建、备份恢复、诊断导出和脱敏检查。

不可降级项：

- 没有安装 smoke 的 DMG 不能作为发布候选。
- 没有 longform 压测不能宣称支撑百万字。
- 诊断包不能包含完整正文、完整 prompt、完整模型响应或完整 API key。
- 发布门禁失败时不能通过人工忽略进入正式版本。

## 生产投入补强方案

P6 是发布候选门禁。完成 P6 后，Story Pilot 才能从“阶段功能完成”升级为“可以给真实创作者稳定试用”的版本。

必须补强的闭环：

| 补强项         | 生产标准                                                 | 失败处理                             |
| -------------- | -------------------------------------------------------- | ------------------------------------ |
| 统一验证命令   | `pnpm verify` 覆盖 format、lint、typecheck、test、build  | 任一失败则禁止发布                   |
| 安装包验证     | DMG verify、首次启动、重启恢复、sidecar health、项目创建 | 失败保留日志、截图和版本信息         |
| 长篇 synthetic | 1000 章、10000 记忆、5000 事件、800 伏笔可生成和打开     | 超过性能预算时阻断百万字能力声明     |
| 性能预算       | 启动、打开项目、章节树、检索、图谱查询、保存都有上限     | 输出 JSON 报告并标记失败指标         |
| 恢复演练       | SQLite 损坏、Kuzu 重建、备份恢复、异常退出恢复可验证     | 恢复失败时不能发布候选包             |
| 诊断安全       | 诊断包脱敏且不含完整正文、prompt、response、apiKey       | 快照测试失败阻断发布                 |
| 人工验收       | 真实模型完成从立项到第二章上下文 ready 的闭环            | 人工验收记录缺失时不能标记生产试用版 |

工程落点：

- 根目录脚本统一 `verify`、`verify:package`、`verify:longform`。
- `scripts` 提供 synthetic project 生成、性能预算检查、诊断脱敏检查。
- `apps/desktop` 和 `apps/sidecar` 提供 package smoke 可观测状态。
- CI 或本地 release checklist 必须保存每次候选包的验证输出。

阶段出口：

- 每个发布候选都有自动化验证输出、安装包 smoke 输出、longform 压测输出和人工验收记录。
- 崩溃、模型失败、数据库损坏、图谱投影失败都有用户可理解的恢复路径。
- 生产试用版文档明确已支持能力、已知限制和数据恢复方式。

## 范围

本阶段必须完成：

- 发布门禁脚本。
- E2E 测试矩阵。
- 长篇 synthetic project 生成器。
- 性能预算。
- 错误码和诊断导出。
- 数据恢复演练。
- 安全与隐私检查。

本阶段不做：

- 云端监控。
- 自动崩溃上报到第三方服务。
- 企业级权限体系。

## 发布门禁命令

新增脚本：

```json
{
  "scripts": {
    "verify": "pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm verify:tauri",
    "verify:tauri": "cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml && cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml",
    "verify:package": "pnpm --filter @story-pilot/desktop tauri:build --bundles dmg --ci && pnpm verify:dmg",
    "verify:dmg": "node scripts/verify-dmg.mjs",
    "verify:longform": "pnpm --filter @story-pilot/testing run longform"
  }
}
```

所有发布候选必须通过：

- `pnpm verify`
- `pnpm verify:package`
- `pnpm verify:longform`

## 长篇压测数据集

新增 deterministic synthetic project：

```text
targetWordCount: 3,000,000
volumes: 8
arcs: 80
chapterPlans: 1000
chapters: 1000
characters: 300
worldRules: 300
locations: 200
organizations: 80
items: 500
storyEvents: 5000
foreshadowings: 800
memories: 10000
entityRelations: 3000
```

生成器要求：

- 不调用真实模型。
- 使用 deterministic provider。
- 数据关系必须连通。
- 至少包含 50 个可检测 continuity issue。
- 至少包含 100 个 open foreshadowing。

## 性能预算

| 操作                 | 数据规模           | 目标                   |
| -------------------- | ------------------ | ---------------------- |
| 应用启动到首页可交互 | 常规项目           | < 3s                   |
| 打开百万字项目工作台 | 1000 章            | < 5s                   |
| 章节树渲染           | 1000 章            | < 1s                   |
| 搜索记忆             | 10000 条           | < 800ms                |
| 图谱邻域查询         | 2 跳 10000 nodes   | < 1000ms               |
| 生成 context package | 16000 token budget | < 1500ms，不含模型调用 |
| 保存章节             | 2 万字正文         | < 500ms                |
| 创建项目备份         | 3GB 以下项目目录   | < 60s                  |

## 错误码体系

错误格式：

```ts
interface StoryPilotError {
  code: string;
  message: string;
  severity: "info" | "warning" | "error" | "fatal";
  retryable: boolean;
  userAction?: string;
  diagnostics?: Record<string, string | number | boolean>;
}
```

错误码前缀：

- `CONFIG_*`
- `STORAGE_*`
- `DB_*`
- `GRAPH_*`
- `AI_*`
- `WORKFLOW_*`
- `CREATIVE_GATE_*`
- `CHAPTER_*`
- `BACKUP_*`
- `TAURI_*`

UI 规则：

- 用户看到可执行建议，不看到原始 stack trace。
- 诊断包中保存 stack trace，但要脱敏路径和密钥。
- fatal 错误提供“导出诊断”和“打开数据目录”入口。

## 日志与诊断

日志要求：

- app 启动日志。
- sidecar 启动日志。
- storage bootstrap 日志。
- model call metadata 日志，不记录完整 prompt 和 apiKey。
- workflow 状态变更日志。
- database migration 日志。
- graph projection 日志。

诊断包包含：

- settings redacted。
- 最近 2000 行 app/sidecar 日志。
- health report。
- migration report。
- project manifest。
- 最近失败 workflow 摘要。

诊断包不包含：

- 完整 API key。
- 用户正文全文。
- 完整模型响应。
- 未经用户确认的隐私附件。

## E2E 矩阵

桌面 smoke：

```text
1. 首次启动。
2. 自动创建 ~/.story-pilot。
3. 创建项目。
4. 保存 brief。
5. 退出重启。
6. 项目仍存在。
```

创作主路径：

```text
1. 创建项目。
2. 完成 brief。
3. 生成并应用 blueprint。
4. 补齐 worldbuilding。
5. 补齐 characters。
6. 补齐 plot_arcs。
7. 生成 rolling outline。
8. 生成第 1 章 draft。
9. 应用正文。
10. 确认记忆。
11. 进入第 2 章。
```

恢复路径：

```text
1. 创建项目并写入 3 章正文。
2. 创建备份。
3. 模拟 project.sqlite 损坏。
4. 启动应用看到恢复提示。
5. 恢复备份。
6. 章节、记忆和图谱可打开。
```

模型失败路径：

```text
1. 配置错误 baseUrl。
2. 点击生成正文。
3. workflow 进入 failed。
4. UI 显示可重试错误。
5. 修复 baseUrl。
6. 重新运行同一 work order 成功。
```

## 测试用例

单元测试：

- 错误码序列化符合 `StoryPilotError`。
- diagnostics redactor 能移除完整 API key、正文全文和完整 prompt。
- longform generator 在相同 seed 下输出一致。
- performance budget checker 对超预算结果返回失败。

集成测试：

```text
1. 创建 synthetic project。
2. 运行 verify:longform 子流程。
3. 输出 performance report。
4. 任一关键指标超预算时命令失败。
```

包验证测试：

```text
1. 构建 DMG。
2. 校验 DMG checksum。
3. 启动安装后的 app。
4. 等待 sidecar health ok。
5. 创建项目并重启恢复。
```

## 安全与隐私检查

必须检查：

- sidecar 只监听 `127.0.0.1`。
- RPC 必须校验 bridge token。
- 前端不能直接访问 sidecar 端口。
- 诊断包不包含完整 API key。
- 日志不包含完整 API key。
- 文件操作限制在授权目录和 `~/.story-pilot`。
- 恢复备份前验证备份 manifest。

## 当前可复用实现

- 根 `package.json`：已有 `lint`、`typecheck`、`test`、`build`。
- `apps/desktop/src-tauri/src/lib.rs`：已有 sidecar token、本地转发和重试测试基础。
- `apps/desktop/src/test/sidecar-runner.test.ts`：已有 sidecar runner 测试基础。
- `apps/sidecar/src/rpc/rpc.integration.spec.ts`：已有主链路集成测试基础。
- `packages/testing`：可承载 synthetic project 和长篇压测工具。
- `docs/specs/production-readiness/08-validation-traceability-matrix.md`：定义跨阶段验证证据。

## 实施切片

### P6.1 统一验证脚本

产物：

- 根 package 增加 `verify`、`verify:tauri`、`verify:package`、`verify:longform`。
- CI 或本地发布流程使用同一套命令。

验证：

- `pnpm verify` 在本地通过。

### P6.2 长篇 synthetic project

产物：

- deterministic generator 生成百万字级项目数据。
- 性能测试输出 JSON 报告。
- 至少 50 个 continuity issue 可被检测。

验证：

- `pnpm verify:longform` 通过性能预算。

### P6.3 安装包 smoke 和恢复演练

产物：

- DMG 构建后自动 verify。
- smoke test 覆盖首次启动、创建项目、重启恢复。
- recovery test 覆盖 SQLite 损坏和备份恢复。

验证：

- smoke report 附带 app version、sidecar health、data dir。

### P6.4 安全和诊断门禁

产物：

- 诊断包快照测试。
- API key、正文全文、完整 prompt 脱敏检查。
- 路径访问和 bridge token 测试纳入发布门禁。

验证：

- 安全检查失败时 `verify:package` 失败。

## 阶段验证清单

完成 P6 时必须保存以下证据：

- `pnpm verify`
- `pnpm verify:package`
- `pnpm verify:longform`
- 安装包 smoke report。
- backup recovery report。
- diagnostics redaction snapshot。
- longform performance report。

## 验收标准

- 发布前门禁脚本全部通过。
- DMG 安装启动 smoke test 通过。
- 长篇 synthetic project 压测通过性能预算。
- 崩溃、模型失败、数据库损坏都有用户可恢复路径。
- 诊断包可用于定位问题且不泄露密钥和正文全文。
- 生产 release notes 记录已知限制、数据目录、备份策略和模型配置方式。
