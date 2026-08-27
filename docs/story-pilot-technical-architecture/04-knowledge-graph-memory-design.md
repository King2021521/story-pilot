# 知识图谱与记忆设计

## 设计目标

长篇创作最难的是连续性和关系维护。Story Pilot 的记忆系统需要解决：

- 人物关系不断变化。
- 伏笔埋设、强化、误导、回收跨越多个章节。
- 世界观规则会约束后续情节。
- 事件有时间顺序和因果链。
- AI 生成时需要知道哪些内容是正式设定，哪些只是草稿或猜测。

因此记忆系统不能只做向量数据库。向量检索适合召回文本，但不擅长稳定表达“谁和谁是什么关系”“哪个伏笔在哪章回收”“哪条规则约束某个事件”。这类关系应交给知识图谱。

## 存储分工

```text
SQLite memories / domain tables / domain_events
  │
  │ projection
  ▼
Kuzu property graph
  │
  ├── graph neighborhood retrieval
  ├── relationship reasoning
  ├── continuity checking
  └── foreshadowing tracking
```

SQLite 保存事实源，Kuzu 保存图谱投影。

这意味着：

- Kuzu 查询结果不直接代表最终事实。
- 所有图谱节点和边都必须能追溯到 SQLite 的 source row 或 domain event。
- 图谱可以被删除并重建。

## 记忆状态机

```text
candidate
  │
  ├── accepted -> canon
  ├── accepted_as_hypothesis -> hypothesis
  ├── merged -> canon 或 hypothesis
  └── rejected

canon
  │
  ├── deprecated
  └── updated -> canon

hypothesis
  │
  ├── confirmed -> canon
  ├── rejected
  └── deprecated
```

状态含义：

| 状态 | 含义 | 是否进入默认上下文 |
| --- | --- | --- |
| candidate | AI 或系统提取的候选记忆，未确认 | 否 |
| canon | 已确认正式设定 | 是 |
| hypothesis | 暂时可参考，但尚未正式确认 | 视任务而定 |
| deprecated | 曾经有效但已废弃 | 否，除非做历史追踪 |
| rejected | 明确拒绝 | 否 |

关键规则：

- AI 生成不会直接创建 canon。
- 用户确认、显式导入、规则化表单保存可以创建 canon。
- 系统自动提取只能创建 candidate。
- hypothesis 需要在上下文中标记为“不确定”。

## 图谱模型

### 节点类型

| 节点 | 来源 | 说明 |
| --- | --- | --- |
| `Project` | projects | 项目 |
| `Work` | works | 作品 |
| `Volume` | volumes | 卷 |
| `Chapter` | chapters | 章节 |
| `Scene` | scenes | 场景 |
| `Character` | characters | 人物 |
| `Location` | locations | 地点 |
| `Organization` | organizations | 组织 |
| `Item` | items | 物品 |
| `WorldRule` | world_rules | 世界规则 |
| `Plotline` | plotlines | 故事线 |
| `PlotNode` | plotline_nodes | 故事线节点 |
| `Foreshadowing` | foreshadowings | 伏笔 |
| `ForeshadowingEvent` | foreshadowing_events | 伏笔事件 |
| `StoryEvent` | memories 或 scenes | 剧情事实事件 |
| `Memory` | memories | 记忆事实 |
| `Artifact` | artifacts | AI 或用户产物 |
| `WorkOrder` | work_orders | 工作单 |

### 边类型

| 边 | 起点 | 终点 | 含义 |
| --- | --- | --- | --- |
| `CONTAINS` | Work/Volume/Chapter | Volume/Chapter/Scene | 层级包含 |
| `APPEARS_IN` | Character/Item/Location | Chapter/Scene | 出现于 |
| `PARTICIPATES_IN` | Character | StoryEvent | 参与事件 |
| `OCCURS_IN` | StoryEvent | Chapter/Scene | 事件发生位置 |
| `OCCURS_BEFORE` | StoryEvent | StoryEvent | 故事时间先后 |
| `CAUSES` | StoryEvent | StoryEvent | 因果 |
| `KNOWS` | Character | Character | 认识 |
| `ALLIED_WITH` | Character/Organization | Character/Organization | 同盟 |
| `OPPOSES` | Character/Organization | Character/Organization | 对立 |
| `HIDES_FROM` | Character | Character | 隐瞒 |
| `BELONGS_TO` | Character | Organization | 所属 |
| `LOCATED_IN` | Location | Location | 地点从属 |
| `OWNS` | Character/Organization | Item | 拥有 |
| `CONSTRAINS` | WorldRule | StoryEvent/Character/Item | 规则约束 |
| `SEEDED_IN` | Foreshadowing | Chapter/Scene | 埋设 |
| `REINFORCED_IN` | Foreshadowing | Chapter/Scene | 强化 |
| `PAID_OFF_IN` | Foreshadowing | Chapter/Scene | 回收 |
| `CONTRADICTS` | Memory/WorldRule | Memory/WorldRule | 矛盾 |
| `SUPPORTED_BY` | Memory | Chapter/Scene/Artifact | 来源支撑 |
| `GENERATED` | WorkOrder | Artifact/Memory | 工作单生成 |
| `AFFECTS` | Plotline/PlotNode | Character/Chapter/Scene | 影响 |

### 节点通用属性

```text
id: string
project_id: string
source_table: string
source_id: string
title: string
status: string
created_at: int64
updated_at: int64
```

### 边通用属性

```text
id: string
project_id: string
source_event_id: string
confidence: double
status: string
created_at: int64
```

## 图谱 schema 草案

示例 Cypher-like 定义：

```sql
CREATE NODE TABLE Character(
  id STRING,
  project_id STRING,
  name STRING,
  role STRING,
  status STRING,
  source_id STRING,
  created_at INT64,
  updated_at INT64,
  PRIMARY KEY (id)
);

CREATE NODE TABLE Chapter(
  id STRING,
  project_id STRING,
  title STRING,
  status STRING,
  sort_order INT64,
  source_id STRING,
  created_at INT64,
  updated_at INT64,
  PRIMARY KEY (id)
);

CREATE REL TABLE APPEARS_IN(
  FROM Character TO Chapter,
  source_event_id STRING,
  confidence DOUBLE,
  status STRING,
  created_at INT64
);
```

正式实现时，schema 应按节点和边类型分别维护，并提供版本号。

## 投影流程

```text
SQLite transaction commits domain_events
  │
  ▼
GraphProjector 获取未处理事件
  │
  ▼
根据 event_type 转换为 graph mutation
  │
  ▼
写入 Kuzu 节点和边
  │
  ▼
记录 projection_checkpoint
```

### `projection_checkpoint`

在 SQLite 中保存：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| projector | text pk | projector 名称 |
| last_event_id | text nullable | 最后事件 |
| last_event_time | integer nullable | 最后事件时间 |
| schema_version | integer | 图 schema 版本 |
| status | text | ok, rebuilding, failed |
| error_json | text nullable | 最近错误 |
| updated_at | integer | 更新时间 |

## 事件到图谱的映射

| 事件 | 图谱动作 |
| --- | --- |
| `character.created` | upsert `Character` |
| `character.updated` | update `Character` properties |
| `chapter.created` | upsert `Chapter`, link `Volume CONTAINS Chapter` |
| `scene.created` | upsert `Scene`, link `Chapter CONTAINS Scene` |
| `memory.confirmed.character_relation` | upsert relation edge |
| `memory.confirmed.world_rule` | upsert `WorldRule`, link constraints |
| `foreshadowing.seeded` | upsert `SEEDED_IN` |
| `foreshadowing.paid_off` | upsert `PAID_OFF_IN` |
| `artifact.applied.chapter` | update chapter, create support edges |
| `memory.deprecated` | mark node or edge status deprecated |

## 记忆类型

### 人物事实

示例：

```json
{
  "memory_type": "character_fact",
  "subject_type": "character",
  "subject_id": "char_linyue",
  "predicate": "has_secret",
  "statement": "林越隐瞒了自己曾在旧都火灾现场出现过。",
  "status": "canon"
}
```

图谱动作：

- 创建 `Memory` 节点。
- `Memory SUPPORTED_BY Chapter/Scene`。
- `Memory AFFECTS Character`。

### 人物关系

示例：

```json
{
  "memory_type": "relation",
  "subject_type": "character",
  "subject_id": "char_linyue",
  "predicate": "hides_from",
  "object_type": "character",
  "object_id": "char_shenqi",
  "statement": "林越向沈祁隐瞒旧都火灾相关线索。",
  "status": "canon"
}
```

图谱动作：

- 创建 `HIDES_FROM` 边。
- 创建 `Memory` 节点。
- `Memory SUPPORTED_BY` 来源章节。

### 事件记忆

事件记忆应包含：

- 事件主体。
- 发生地点。
- 故事内时间。
- 涉及人物。
- 结果。
- 因果来源。

它是连续性检查最重要的输入。

### 伏笔记忆

伏笔记忆应区分：

- setup：埋设。
- reinforce：强化。
- misdirect：误导。
- payoff：回收。

图谱可以快速回答：

- 哪些伏笔已埋未收。
- 哪些伏笔长期未强化。
- 哪些回收缺少前文支撑。
- 某章节应该回收哪些线索。

## 检索策略

生成或审阅时，上下文不应只靠相似度。推荐顺序：

```text
1. 结构化必选上下文
2. canon memory
3. 图谱邻域
4. 全文搜索
5. 语义向量
6. 历史 artifact 摘要
```

### 结构化必选上下文

例如生成某一章，必选：

- 项目 brief。
- 本卷概要。
- 本章目标。
- 已确认世界规则。
- 相关人物卡。
- 相关故事线节点。
- 本章前后章节摘要。

### 图谱邻域

以目标对象为中心扩展：

- 当前章节关联人物。
- 人物之间一到两跳关系。
- 相关伏笔。
- 相关世界规则。
- 最近发生并影响该人物的事件。

### 混合检索

全文和语义召回用于补充：

- 类似表达。
- 被遗忘但文本相关的旧章节。
- 用户导入的参考资料。
- 风格示例。

最终上下文包需要去重、排序、压缩和标记来源。

## 连续性检查

连续性检查可以基于图谱做几类规则：

### 人物状态

- 人物是否在当前时间线已经死亡、失踪、离场。
- 人物是否知道某个秘密。
- 人物是否拥有某个物品。
- 人物关系是否和当前剧情矛盾。

### 世界规则

- 当前情节是否违反硬规则。
- 新设定是否和已确认规则冲突。
- 新能力、新道具是否缺少代价或边界。

### 情节因果

- 事件是否缺少前置原因。
- 结果是否已被前文支持。
- 某角色动机是否足够。

### 伏笔

- 新回收是否缺少埋设。
- 已埋伏笔是否长期没有推进。
- 多条伏笔是否冲突。

## 用户确认体验对技术的要求

记忆候选需要展示：

- 候选事实。
- 来源段落或章节。
- 影响对象。
- 可能创建的图谱关系。
- 和已有记忆的冲突或重复。
- 建议状态：canon、hypothesis、reject、merge。

后端需要提供：

- 候选合并接口。
- 冲突检测接口。
- 图谱预览接口。
- 确认后落库和投影接口。

## 图谱重建

重建流程：

```text
关闭图查询写入
  │
  ▼
备份旧 graph.kuzu
  │
  ▼
创建新 graph.kuzu
  │
  ▼
按 schema version 建表
  │
  ▼
读取 SQLite source tables 创建基础节点
  │
  ▼
读取 canon/hypothesis memories 创建记忆节点和边
  │
  ▼
读取 domain_events 补充事件边
  │
  ▼
运行一致性校验
  │
  ▼
切换 projection_checkpoint 为 ok
```

## 为什么 MVP 推荐 Kuzu 而不是 Neo4j

Neo4j 是成熟的图数据库，但它更适合作为服务运行。桌面端 MVP 引入 Neo4j 会带来：

- 用户安装和进程管理复杂度。
- 数据目录和端口管理复杂度。
- 发布包体积和运维成本。
- 本地离线启动稳定性挑战。

Kuzu 是嵌入式 property graph 数据库，更符合桌面端本地优先的约束。未来如果 Story Pilot 做团队版或云版，可以在服务端重新评估 Neo4j、Memgraph 或云图数据库。

## 风险和控制

| 风险 | 表现 | 控制方式 |
| --- | --- | --- |
| 图谱和 SQLite 不一致 | 查询结果遗漏或过期 | projection checkpoint、重建能力、事件审计 |
| AI 提取错误记忆 | 错误事实进入后续生成 | candidate 状态、用户确认、来源引用 |
| 图谱过密 | 检索噪声高 | 边类型分级、状态过滤、深度限制 |
| 记忆过旧 | 旧设定干扰新设定 | deprecated 状态、版本、时间衰减 |
| 用户确认成本高 | 候选堆积 | 自动分组、重复合并、低置信度降权 |

