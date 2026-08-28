# Story Pilot 生产化补强 Specs

## 定位

本目录定义 Story Pilot 从当前 MVP 走向生产可用的分阶段补强方案。

生产可用在本阶段不等于商业化 SaaS，也不等于多人协同平台。这里的目标是：单机本地优先、真实 LLM 可接入、数据可恢复、工作流可追踪、能支撑创作者持续规划和生产百万字级长篇小说。

## 生产级定义

Story Pilot 只有同时满足以下条件，才可以被定义为生产投入使用：

- 安装包可独立启动，不依赖本地源码仓库、全局 Node、全局 pnpm 或开发环境。
- 用户配置、项目数据库、图数据库、作品正文、日志、备份都稳定落在 `~/.story-pilot`。
- 所有 AI 输出都经过 artifact/candidate/review 机制，不能直接污染 canon。
- 创作阶段推进由门禁报告驱动，而不是只靠按钮状态。
- 全书、分卷、剧情弧线、章节大纲、正文、记忆和图谱形成闭环。
- 百万字级项目在 1000 章量级下仍能打开、检索、校验和继续生成。
- 关键创作对象具备版本、来源、状态、引用关系和变更影响范围。
- 模型调用、提示词版本、上下文包、生成产物、用户采纳决策可审计。
- 失败可恢复：模型失败、sidecar 崩溃、数据库损坏、应用异常退出后不丢关键数据。

## 阶段拆分

| 阶段 | Spec                                                                        | 目标                                                  |
| ---- | --------------------------------------------------------------------------- | ----------------------------------------------------- |
| 总览 | [生产化补强总路线图](./00-production-readiness-roadmap.md)                  | 串联 P0-P6 的依赖、里程碑、完成定义和风险控制         |
| P0   | [运行时、配置与发布基础](./01-runtime-config-release-spec.md)               | 让桌面端和 sidecar 达到可安装、可启动、可诊断、可恢复 |
| P1   | [创作门禁与阶段数据完整性](./02-creative-gates-data-integrity-spec.md)      | 让九步创作路径由真实数据完整度驱动                    |
| P2   | [AI 工作流、提示词与评测体系](./03-ai-workflow-prompt-evaluation-spec.md)   | 建立真实 LLM 创作能力、提示词版本和质量评测闭环       |
| P3   | [长篇大纲与剧情引擎](./04-longform-outline-plot-engine-spec.md)             | 支撑百万字长篇的分层规划、剧情弧线和伏笔计划          |
| P4   | [长期记忆与知识图谱一致性](./05-memory-knowledge-graph-continuity-spec.md)  | 让人物、事件、设定、关系和时间线可长期追踪和校验      |
| P5   | [正文生产与创作者编辑工作台](./06-chapter-production-editor-spec.md)        | 让用户能稳定从章纲生产、审稿、改写、入库和继续下一章  |
| P6   | [生产 QA、性能、观测与发布门禁](./07-production-qa-performance-ops-spec.md) | 建立发布前必须通过的质量标准和长篇压测体系            |
| 验证 | [生产化测试验证与追踪矩阵](./08-validation-traceability-matrix.md)          | 把 P0-P6 要求映射到测试、命令、E2E 和人工验收证据     |
| 补强 | [生产级优化补强方案](./09-production-reinforcement-plan.md)                 | 汇总当前生产级差距、阶段补强重点和不可降级项          |

## 执行顺序

必须按 P0 到 P6 顺序执行。P2 和 P3 可以局部并行调研，但进入开发时仍建议先完成 P0/P1，因为 AI 工作流和长篇规划都依赖稳定的数据目录、阶段门禁和可审计存储。

最低可投产版本建议完成 P0-P5，并通过 P6 的发布门禁。若只完成 P0-P3，可以作为内测版；若只完成 P0-P1，只能作为流程样机。

具体优化补强口径见 [生产级优化补强方案](./09-production-reinforcement-plan.md)。该文档用于约束阶段优先级和验收底线；每个阶段的工程实现仍以对应 P0-P6 spec 为准。

## 统一约束

- 桌面端：Tauri v2。
- 前端：React + TypeScript + Ant Design。
- 后端：NestJS + TypeScript sidecar。
- 事务存储：SQLite。
- 图数据库：Kuzu。
- AI 接入：OpenAI-compatible API，通过 `ModelGateway` 封装。
- 本地目录：统一使用 `~/.story-pilot`。
- 当前简化策略：模型 API key 继续允许放在 `~/.story-pilot/setting.json`，但日志、诊断包和导出文件必须脱敏。
- AI 产物原则：生成结果先进入 artifact、candidate、review 或 work order，经用户确认后才进入 canon。
- UI 原则：生产态默认是工作台，不是聊天窗口；Agent 能力通过显式工作流和任务抽屉体现。

## 文档验证

每次修改本目录 spec 后必须执行：

```bash
pnpm exec prettier --check docs/specs/production-readiness docs/specs/README.md
pnpm verify:specs
git diff --check
```

如果新增 Markdown 链接，必须确认本地相对链接指向真实文件。发布候选版本还必须按 [生产化测试验证与追踪矩阵](./08-validation-traceability-matrix.md) 执行完整验证。
