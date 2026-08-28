# 生产化测试验证与追踪矩阵

## 目标

本文档把 P0-P6 的生产化要求映射到可执行验证证据。后续任何阶段开发完成后，都必须能在这里找到对应测试、命令或人工验收路径。

## 验证分层

| 层级        | 目的                   | 必须覆盖                                            |
| ----------- | ---------------------- | --------------------------------------------------- |
| Static      | 保证代码和文档基础质量 | format、lint、typecheck、链接、未完成标记扫描       |
| Unit        | 验证小模块规则         | gate evaluator、prompt registry、schema、repository |
| Integration | 验证服务协作           | RPC、SQLite、Kuzu、workflow、model provider         |
| E2E         | 验证用户主路径         | 创建项目、创作路径、AI 产物、章节生产、记忆确认     |
| Package     | 验证桌面发布           | sidecar、DMG、安装、首次启动、重启恢复              |
| Longform    | 验证百万字能力         | 1000 章、10000 记忆、图谱、检索、性能预算           |

## 当前文档验证命令

文档类变更必须通过：

```bash
pnpm exec prettier --check docs/specs/production-readiness docs/specs/README.md
pnpm verify:specs
git diff --check
```

Markdown 本地链接验证规则：

- `./*.md` 必须指向存在文件。
- `../*.md` 必须指向存在文件。
- 不检查外部 URL 的可达性。
- 图片和二进制链接由对应产物验证处理。

## 发布候选验证命令

发布候选必须通过：

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
pnpm --filter @story-pilot/desktop tauri:build --bundles dmg --ci
hdiutil verify "apps/desktop/src-tauri/target/release/bundle/dmg/Story Pilot_0.1.0_aarch64.dmg"
```

P6 完成后应收敛为：

```bash
pnpm verify
pnpm verify:package
pnpm verify:longform
```

## P0 追踪矩阵

| Requirement                                | Evidence                                          |
| ------------------------------------------ | ------------------------------------------------- |
| 安装包不依赖源码仓库、全局 Node、全局 pnpm | Package smoke 在干净机器启动并通过 sidecar health |
| `~/.story-pilot` 自动创建                  | `StorageBootstrapService` 单元测试和首次启动 E2E  |
| setting 缺失自动创建                       | `RuntimeSettingsService` 单元测试                 |
| setting 损坏可恢复                         | JSON 损坏集成测试                                 |
| API key 日志脱敏                           | diagnostics export 测试和日志快照测试             |
| 备份恢复可用                               | backup create/restore 集成测试                    |
| sidecar 只监听本地                         | Rust/Tauri 单元测试和 runtime health 检查         |

## P1 追踪矩阵

| Requirement                   | Evidence                               |
| ----------------------------- | -------------------------------------- |
| 每阶段 readiness 由数据计算   | `CreativeStageGateEvaluator` 单元测试  |
| strict advance 阻止不合格阶段 | RPC 集成测试                           |
| force advance 留审计          | domain event 测试                      |
| 上游变更影响下游              | impact service 单元测试                |
| 看板缺口可跳转                | desktop E2E                            |
| 九步创作路径完整              | ShellLayout/CreativePathWorkbench 测试 |

## P2 追踪矩阵

| Requirement                       | Evidence                                                |
| --------------------------------- | ------------------------------------------------------- |
| 生产态禁止 fake provider          | `createModelGatewayFromSettings` 单元测试               |
| 所有 AI 调用记录 prompt version   | model_calls 集成测试                                    |
| schema 失败可重试                 | workflow runtime 测试                                   |
| 大纲生成使用 LLM workflow         | `outline_generate` 集成测试，不允许固定模板作为正式结果 |
| Prompt eval 可运行                | eval runner 测试                                        |
| Artifact/candidate 不直接写 canon | AI workflow 集成测试                                    |

## P3 追踪矩阵

| Requirement                  | Evidence                  |
| ---------------------------- | ------------------------- |
| 全书/分卷/弧线/章节/场景分层 | repository 和 schema 测试 |
| 章纲绑定剧情线或人物弧线     | gate evaluator 测试       |
| 滚动生成 10-20 章            | outline workflow 集成测试 |
| 大纲变更影响分析             | impact analyzer 单元测试  |
| 1000 章查询性能              | longform synthetic 压测   |

## P4 追踪矩阵

| Requirement                    | Evidence                              |
| ------------------------------ | ------------------------------------- |
| 记忆有来源、范围、有效期和证据 | memory repository 测试                |
| 图谱增量投影                   | graph.projectSinceCheckpoint 集成测试 |
| 连续性规则覆盖硬冲突           | continuity rule 单元测试              |
| 混合检索生成上下文包           | ContextRetrievalService 测试          |
| 10000 记忆可检索               | longform synthetic 压测               |

## P5 追踪矩阵

| Requirement                      | Evidence                 |
| -------------------------------- | ------------------------ |
| 正文生成必须从 chapter plan 进入 | chapter service 集成测试 |
| AI 草稿不直接覆盖正文            | artifact apply 测试      |
| 应用 draft/patch 生成版本        | chapter version 测试     |
| 生成后抽取记忆并投影图谱         | chapter production E2E   |
| 连续 10 章闭环                   | writing batch E2E        |

## P6 追踪矩阵

| Requirement               | Evidence                              |
| ------------------------- | ------------------------------------- |
| 发布门禁脚本存在并通过    | `pnpm verify` 输出                    |
| DMG 可安装启动            | package smoke 输出和截图              |
| 百万字 synthetic 压测通过 | `pnpm verify:longform` 输出           |
| 恢复演练通过              | backup recovery E2E                   |
| 诊断包脱敏                | diagnostics snapshot 测试             |
| 安全边界通过              | sidecar token、本地监听、路径限制测试 |

## 人工验收脚本

生产候选版本需要人工跑一遍真实创作路径：

```text
1. 安装 DMG。
2. 首次启动，确认设置页显示 ~/.story-pilot。
3. 配置真实模型 baseUrl、apiKey、model。
4. 创建一部玄幻长篇作品。
5. 完成立项并生成蓝图。
6. 生成并采纳世界观要素。
7. 生成并采纳人物和关系。
8. 生成剧情弧线和伏笔。
9. 生成全书规划和未来 10 章章纲。
10. 生成第 1 章正文。
11. 执行质量审阅和连续性审阅。
12. 局部改写一段正文。
13. 应用正文并保存版本。
14. 确认记忆候选。
15. 进入第 2 章，确认上下文已引用第 1 章摘要和记忆。
16. 重启应用，确认项目完整恢复。
17. 导出诊断包，确认不包含完整 API key 和正文全文。
```

## 完成判定

P0-P6 只有在以下条件全部满足时才算生产化规格闭环：

- 每份 spec 都有目标、当前缺口、范围、数据模型、API、AI 或流程设计、测试用例和验收标准。
- README 链接到所有阶段 spec 和路线图。
- 本追踪矩阵覆盖 P0-P6 的核心 requirement。
- 文档格式、未完成标记扫描和链接检查通过。
- 实施阶段可以直接从 spec 推导实施计划和测试任务。
