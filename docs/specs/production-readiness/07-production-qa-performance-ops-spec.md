# P6 生产 QA、性能、观测与发布门禁 Spec

## 目标

建立 Story Pilot 生产发布前必须通过的质量门禁：自动化测试、长篇压测、安装包 smoke test、日志诊断、数据恢复、安全检查和性能预算。

## 当前缺口

- 当前已有 lint/typecheck/test/build/DMG 验证，但没有统一发布门禁文档和自动化脚本。
- 缺少百万字级数据集压测。
- 缺少安装后应用 smoke test。
- 日志、诊断和错误码体系还不完整。
- API key 脱敏、数据备份、崩溃恢复需要明确验收。

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

## 安全与隐私检查

必须检查：

- sidecar 只监听 `127.0.0.1`。
- RPC 必须校验 bridge token。
- 前端不能直接访问 sidecar 端口。
- 诊断包不包含完整 API key。
- 日志不包含完整 API key。
- 文件操作限制在授权目录和 `~/.story-pilot`。
- 恢复备份前验证备份 manifest。

## 验收标准

- 发布前门禁脚本全部通过。
- DMG 安装启动 smoke test 通过。
- 长篇 synthetic project 压测通过性能预算。
- 崩溃、模型失败、数据库损坏都有用户可恢复路径。
- 诊断包可用于定位问题且不泄露密钥和正文全文。
- 生产 release notes 记录已知限制、数据目录、备份策略和模型配置方式。
