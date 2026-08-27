# 数据库与存储设计

## 总体策略

Story Pilot 的存储采用三层结构：

```text
SQLite source of truth
  │
  ├── Kuzu graph projection
  ├── FTS / vector search index
  └── File store materialization
```

每层职责不同：

| 层级 | 组件 | 职责 | 是否事实源 |
| --- | --- | --- | --- |
| 事务源数据 | SQLite | 项目、章节、设定、版本、工作单、事件、AI 记录 | 是 |
| 图谱读模型 | Kuzu | 关系查询、图遍历、记忆网络、影响分析 | 否 |
| 搜索读模型 | SQLite FTS5 / vector index | 文本召回、语义召回、上下文组装 | 否 |
| 文件存储 | 本地文件系统 | 导入、导出、快照、大模型原文、大附件 | 部分是，需有 DB metadata |

关键原则：

- SQLite 是唯一事务事实源。
- Kuzu、FTS、向量索引都可以从 SQLite 重建。
- 大文件不直接塞进 SQLite，SQLite 保存 metadata、路径、hash 和版本。
- 章节正文可以保存在 SQLite，导出的 Markdown/epub/docx 是产物。
- 所有重要变更写入 `domain_events`，用于审计、恢复和投影。

## 本地目录结构

```text
StoryPilot/
  global.sqlite
  logs/
    app-2026-08-27.log
    sidecar-2026-08-27.log
  projects/
    <projectId>/
      project.sqlite
      graph.kuzu/
      files/
        imports/
        exports/
        attachments/
        model-raw/
        thumbnails/
      snapshots/
        2026-08-27T120000Z/
      backups/
        project-2026-08-27.sqlite.gz
      locks/
        project.lock
```

### `global.sqlite`

保存跨项目数据：

- 应用设置。
- 模型 provider 配置，不包含 API Key 明文。
- 项目索引。
- 最近打开项目。
- 全局预设库。
- 用户自定义预设。
- UI 工作区状态。

### `project.sqlite`

保存单个作品项目的全部事务性业务数据。

优势：

- 项目可独立备份和迁移。
- 大作品不会拖慢全局库。
- 后续云同步可以按项目粒度实现。

### `graph.kuzu/`

保存项目图谱投影：

- 人物关系。
- 事件因果。
- 章节和场景关系。
- 伏笔埋设和回收链路。
- 世界观规则约束。
- 记忆网络。

### `files/`

保存非结构化和大文件：

- 导入的参考资料。
- 导出的作品文件。
- 插图、封面、附件。
- 模型原始请求和响应。
- OCR 或解析后的中间文件。

数据库中必须保存文件 metadata，不允许只有裸文件。

## 全局数据库设计

### `app_settings`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| key | text pk | 配置键 |
| value_json | text | JSON 值 |
| updated_at | integer | 更新时间 |

### `model_providers`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | provider id |
| name | text | 展示名称 |
| provider_type | text | openai, anthropic, local, custom |
| base_url | text nullable | 自定义 endpoint |
| api_key_ref | text nullable | keychain 引用 |
| default_model | text nullable | 默认模型 |
| enabled | integer | 是否启用 |
| config_json | text | 非敏感配置 |
| created_at | integer | 创建时间 |
| updated_at | integer | 更新时间 |

### `project_index`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 项目 id |
| title | text | 作品名 |
| path | text | 项目目录 |
| cover_file_id | text nullable | 封面文件 |
| status | text | active, archived |
| last_opened_at | integer nullable | 最近打开 |
| created_at | integer | 创建时间 |
| updated_at | integer | 更新时间 |

### `preset_library`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 预设 id |
| scope | text | system, user |
| category | text | genre, character, plot, world, style |
| title | text | 名称 |
| payload_json | text | 预设内容 |
| tags_json | text | 标签 |
| version | integer | 版本 |
| created_at | integer | 创建时间 |
| updated_at | integer | 更新时间 |

## 项目数据库核心表

以下是 schema 草案，正式实现时可转换为 Drizzle schema 和 migration。

## 基础项目表

### `projects`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 项目 id |
| title | text | 作品名 |
| subtitle | text nullable | 副标题 |
| genre | text nullable | 主类型 |
| target_audience | text nullable | 目标读者 |
| logline | text nullable | 一句话故事 |
| status | text | planning, drafting, revising, completed, archived |
| word_count_goal | integer nullable | 目标字数 |
| current_word_count | integer | 当前字数 |
| metadata_json | text | 扩展信息 |
| created_at | integer | 创建时间 |
| updated_at | integer | 更新时间 |

### `works`

`works` 用于预留一个项目下多部作品或番外的能力。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 作品 id |
| project_id | text | 项目 id |
| title | text | 作品标题 |
| kind | text | main, side_story, extra |
| status | text | active, archived |
| sort_order | integer | 排序 |
| created_at | integer | 创建时间 |
| updated_at | integer | 更新时间 |

## 章节结构

### `volumes`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 卷 id |
| work_id | text | 作品 id |
| title | text | 卷名 |
| summary | text nullable | 卷摘要 |
| sort_order | integer | 排序 |
| status | text | planned, drafting, done |
| created_at | integer | 创建时间 |
| updated_at | integer | 更新时间 |

### `chapters`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 章节 id |
| volume_id | text | 卷 id |
| title | text | 章节名 |
| summary | text nullable | 摘要 |
| target_word_count | integer nullable | 目标字数 |
| current_word_count | integer | 当前字数 |
| status | text | planned, drafting, reviewing, revised, locked |
| content | text | 当前正文 |
| sort_order | integer | 排序 |
| version | integer | 乐观锁版本 |
| created_at | integer | 创建时间 |
| updated_at | integer | 更新时间 |

### `chapter_versions`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 版本 id |
| chapter_id | text | 章节 id |
| version_no | integer | 版本号 |
| content | text | 正文快照 |
| summary | text nullable | 版本摘要 |
| source | text | user, ai, import, restore |
| created_by | text nullable | 创建者 |
| created_at | integer | 创建时间 |

### `scenes`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 场景 id |
| chapter_id | text | 章节 id |
| title | text | 场景名 |
| summary | text nullable | 场景摘要 |
| pov_character_id | text nullable | 视角人物 |
| location_id | text nullable | 地点 |
| time_label | text nullable | 故事内时间 |
| conflict_type | text nullable | 冲突类型 |
| emotional_turn | text nullable | 情绪转折 |
| sort_order | integer | 排序 |
| metadata_json | text | 扩展 |
| created_at | integer | 创建时间 |
| updated_at | integer | 更新时间 |

## 创作设定表

### `characters`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 人物 id |
| project_id | text | 项目 id |
| name | text | 姓名 |
| aliases_json | text | 别名 |
| role | text | protagonist, antagonist, support, cameo |
| archetype | text nullable | 人物原型 |
| goal | text nullable | 外在目标 |
| need | text nullable | 内在需求 |
| flaw | text nullable | 缺陷 |
| secret | text nullable | 秘密 |
| voice_profile | text nullable | 语言风格 |
| biography | text nullable | 小传 |
| status | text | draft, canon, deprecated |
| created_at | integer | 创建时间 |
| updated_at | integer | 更新时间 |

### `locations`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 地点 id |
| project_id | text | 项目 id |
| name | text | 地点名 |
| kind | text | city, room, realm, planet, other |
| description | text nullable | 描述 |
| parent_location_id | text nullable | 上级地点 |
| status | text | draft, canon, deprecated |
| created_at | integer | 创建时间 |
| updated_at | integer | 更新时间 |

### `organizations`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 组织 id |
| project_id | text | 项目 id |
| name | text | 组织名 |
| kind | text | family, sect, company, kingdom, faction, other |
| description | text nullable | 描述 |
| status | text | draft, canon, deprecated |
| created_at | integer | 创建时间 |
| updated_at | integer | 更新时间 |

### `items`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 物品 id |
| project_id | text | 项目 id |
| name | text | 物品名 |
| kind | text | artifact, weapon, clue, resource, other |
| description | text nullable | 描述 |
| owner_character_id | text nullable | 当前持有者 |
| status | text | draft, canon, deprecated |
| created_at | integer | 创建时间 |
| updated_at | integer | 更新时间 |

### `world_rules`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 世界规则 id |
| project_id | text | 项目 id |
| category | text | magic, tech, society, history, geography, economy |
| title | text | 规则标题 |
| statement | text | 规则正文 |
| constraint_level | text | hard, soft, optional |
| status | text | draft, canon, deprecated |
| created_at | integer | 创建时间 |
| updated_at | integer | 更新时间 |

### `style_guides`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 风格规范 id |
| project_id | text | 项目 id |
| title | text | 名称 |
| narrative_pov | text nullable | 叙事视角 |
| tense | text nullable | 时态 |
| prose_style | text nullable | 文风 |
| dialogue_style | text nullable | 对话风格 |
| forbidden_patterns_json | text | 禁用表达 |
| examples_json | text | 示例 |
| created_at | integer | 创建时间 |
| updated_at | integer | 更新时间 |

## 剧情与伏笔表

### `plotlines`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 故事线 id |
| project_id | text | 项目 id |
| title | text | 故事线名称 |
| kind | text | main, branch, romance, mystery, growth |
| summary | text nullable | 摘要 |
| status | text | planned, active, resolved, abandoned |
| priority | integer | 优先级 |
| created_at | integer | 创建时间 |
| updated_at | integer | 更新时间 |

### `plotline_nodes`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 节点 id |
| plotline_id | text | 故事线 id |
| title | text | 节点标题 |
| description | text nullable | 描述 |
| node_type | text | setup, turn, midpoint, climax, resolution |
| chapter_id | text nullable | 关联章节 |
| scene_id | text nullable | 关联场景 |
| sort_order | integer | 排序 |
| status | text | planned, drafted, done |
| created_at | integer | 创建时间 |
| updated_at | integer | 更新时间 |

### `foreshadowings`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 伏笔 id |
| project_id | text | 项目 id |
| title | text | 伏笔标题 |
| description | text | 伏笔描述 |
| payoff_expectation | text nullable | 回收预期 |
| status | text | planned, seeded, reinforced, paid_off, abandoned |
| importance | integer | 重要程度 |
| created_at | integer | 创建时间 |
| updated_at | integer | 更新时间 |

### `foreshadowing_events`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 事件 id |
| foreshadowing_id | text | 伏笔 id |
| event_type | text | seed, reinforce, misdirect, payoff |
| chapter_id | text nullable | 章节 |
| scene_id | text nullable | 场景 |
| description | text | 事件描述 |
| quote | text nullable | 原文摘录 |
| created_at | integer | 创建时间 |

## AI 与工作流表

### `work_orders`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 工作单 id |
| project_id | text | 项目 id |
| title | text | 工作单标题 |
| kind | text | outline, chapter_draft, rewrite, review, memory_extract |
| target_type | text | project, chapter, character, plotline |
| target_id | text nullable | 目标对象 id |
| status | text | queued, running, waiting_user, completed, failed, canceled |
| priority | integer | 优先级 |
| created_by | text | user, system |
| created_at | integer | 创建时间 |
| updated_at | integer | 更新时间 |

### `workflow_runs`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 运行 id |
| work_order_id | text | 工作单 id |
| workflow_type | text | 工作流类型 |
| status | text | running, waiting_user, completed, failed, canceled |
| input_json | text | 输入参数 |
| output_json | text nullable | 输出摘要 |
| started_at | integer | 开始时间 |
| finished_at | integer nullable | 结束时间 |
| error_json | text nullable | 错误信息 |

### `workflow_steps`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 步骤 id |
| run_id | text | 运行 id |
| step_key | text | 步骤 key |
| status | text | pending, running, completed, failed, skipped |
| input_json | text nullable | 输入 |
| output_json | text nullable | 输出 |
| attempt | integer | 尝试次数 |
| started_at | integer nullable | 开始时间 |
| finished_at | integer nullable | 完成时间 |
| error_json | text nullable | 错误 |

### `model_calls`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 调用 id |
| run_id | text nullable | 关联 workflow run |
| step_id | text nullable | 关联 workflow step |
| provider | text | provider |
| model | text | 模型 |
| purpose | text | draft, review, extract, rewrite |
| request_file_id | text nullable | 原始请求文件 |
| response_file_id | text nullable | 原始响应文件 |
| prompt_hash | text | prompt hash |
| input_tokens | integer nullable | 输入 token |
| output_tokens | integer nullable | 输出 token |
| latency_ms | integer nullable | 耗时 |
| status | text | success, failed, canceled |
| error_json | text nullable | 错误 |
| created_at | integer | 创建时间 |

## 产物和版本表

### `artifacts`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 产物 id |
| project_id | text | 项目 id |
| work_order_id | text nullable | 来源工作单 |
| target_type | text nullable | 目标对象类型 |
| target_id | text nullable | 目标对象 id |
| kind | text | outline, draft, review_report, patch, export |
| title | text | 标题 |
| content | text nullable | 文本内容 |
| file_id | text nullable | 文件产物 |
| status | text | draft, applied, rejected, archived |
| created_at | integer | 创建时间 |
| updated_at | integer | 更新时间 |

### `artifact_versions`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 版本 id |
| artifact_id | text | 产物 id |
| version_no | integer | 版本号 |
| content | text nullable | 内容 |
| file_id | text nullable | 文件 |
| created_at | integer | 创建时间 |

## 记忆与上下文表

### `memories`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 记忆 id |
| project_id | text | 项目 id |
| memory_type | text | character_fact, world_rule, event, relation, style, foreshadowing |
| subject_type | text nullable | 主体类型 |
| subject_id | text nullable | 主体 id |
| predicate | text nullable | 关系或属性 |
| object_type | text nullable | 客体类型 |
| object_id | text nullable | 客体 id |
| statement | text | 可读事实陈述 |
| status | text | candidate, canon, hypothesis, deprecated, rejected |
| confidence | real | 置信度 |
| source_ref_json | text | 来源引用 |
| created_at | integer | 创建时间 |
| updated_at | integer | 更新时间 |

### `memory_candidates`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 候选 id |
| project_id | text | 项目 id |
| work_order_id | text nullable | 来源工作单 |
| candidate_json | text | 候选结构 |
| source_text | text nullable | 来源文本 |
| status | text | pending, accepted, merged, rejected |
| created_at | integer | 创建时间 |
| resolved_at | integer nullable | 处理时间 |

### `context_packages`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 上下文包 id |
| project_id | text | 项目 id |
| work_order_id | text nullable | 工作单 |
| purpose | text | draft, rewrite, review, extract |
| target_type | text nullable | 目标类型 |
| target_id | text nullable | 目标 id |
| budget_tokens | integer | token 预算 |
| summary | text nullable | 上下文摘要 |
| created_at | integer | 创建时间 |

### `context_package_items`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 条目 id |
| package_id | text | 上下文包 |
| source_type | text | memory, chapter, scene, graph, search, preset |
| source_id | text | 来源 id |
| relevance | real | 相关度 |
| content | text | 实际注入内容 |
| token_count | integer | token 数 |
| sort_order | integer | 顺序 |

## 文件表

### `files`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 文件 id |
| project_id | text nullable | 所属项目 |
| path | text | 相对项目目录路径 |
| kind | text | import, export, attachment, model_raw, snapshot |
| mime_type | text nullable | MIME |
| byte_size | integer | 大小 |
| sha256 | text | 内容 hash |
| metadata_json | text | 扩展 metadata |
| created_at | integer | 创建时间 |

## 事件表

### `domain_events`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 事件 id |
| project_id | text | 项目 id |
| event_type | text | 事件类型 |
| aggregate_type | text | 聚合类型 |
| aggregate_id | text | 聚合 id |
| payload_json | text | 事件内容 |
| actor | text | user, ai, system |
| created_at | integer | 创建时间 |

事件用途：

- 形成审计链。
- 驱动 Kuzu 图谱投影。
- 驱动 FTS/embedding 索引更新。
- 支持故障后恢复。
- 支持未来同步和冲突解决。

## 索引建议

高频索引：

- `chapters(volume_id, sort_order)`
- `scenes(chapter_id, sort_order)`
- `characters(project_id, status)`
- `plotlines(project_id, status)`
- `foreshadowings(project_id, status)`
- `work_orders(project_id, status, updated_at)`
- `workflow_runs(work_order_id, status)`
- `memories(project_id, status, memory_type)`
- `domain_events(project_id, created_at)`
- `files(project_id, kind, created_at)`

全文索引：

- 章节正文。
- 人物小传。
- 世界规则。
- 记忆 statement。
- 产物内容。
- 导入参考资料摘要。

## 事务边界

### 应用 AI 草稿

一个事务内完成：

- 校验章节版本。
- 写入 `chapter_versions`。
- 更新 `chapters.content`。
- 更新字数。
- 写入 `artifacts.status = applied`。
- 写入 `domain_events`。

事务外异步执行：

- FTS 重建该章节 chunk。
- embedding 更新。
- Kuzu 图谱投影。

### 确认记忆

一个事务内完成：

- 更新 `memory_candidates.status`。
- 写入或更新 `memories`。
- 写入 `domain_events`。

事务外异步执行：

- 图谱节点和边投影。
- 相关上下文缓存失效。

## 版本和回滚

章节正文是高价值数据，必须支持版本。

推荐规则：

- 每次 AI 应用生成一个 `chapter_versions`。
- 每次用户手动保存可按时间或显著变更生成版本。
- 回滚不删除当前版本，而是创建一个 restore 版本。
- 版本 diff 可以由 UI 动态计算，不必在数据库中永久保存。

设定对象也需要轻量版本：

- MVP 可以先依赖 `domain_events` 追踪变更。
- 后续对 `characters`、`world_rules`、`plotlines` 增加 `_versions` 表。

## 备份和快照

### 自动备份

默认策略：

- 每天首次打开项目时备份一次 `project.sqlite`。
- 应用 AI 大批量变更前创建快照。
- 保留最近 30 个自动备份，用户可改。

### 项目快照

快照内容：

- `project.sqlite`
- `graph.kuzu` 可选，因为可重建
- `files/` 中被引用的附件和导入文件
- 当前导出配置

快照目录：

```text
snapshots/
  2026-08-27T120000Z/
    project.sqlite
    manifest.json
    files/
```

## 数据迁移

迁移要求：

- `global.sqlite` 和 `project.sqlite` 分开迁移。
- migration 必须可重复检测。
- 每次 migration 前做备份。
- migration 失败时阻止打开项目，提示用户恢复备份。
- Kuzu schema 版本不兼容时优先重建图谱，而不是阻塞项目打开。

## 数据清理

需要提供几类清理：

- 清理过期模型原始记录。
- 清理未引用的导出文件。
- 清理被拒绝且超过保留期的 memory candidate。
- 清理失败 workflow 的临时文件。
- 压缩 SQLite 和重建索引。

清理必须先产生日志，并避免删除用户导入原件。

