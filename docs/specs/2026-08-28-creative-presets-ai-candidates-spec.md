# 创作预设与 AI 要素候选 Spec

## 目标

把创作工作台从“用户手填表单”推进到“系统预设选择 + AI 批量生成候选 + 用户确认采纳”的工作流，降低用户在题材、风格、人物名、地名、道具名等高频字段上的输入负担。

## 范围

本次交付覆盖 MVP 闭环：

- 项目创建中的 `题材` 和 `风格` 使用系统预设下拉。
- 创作要素页提供 AI 批量生成候选能力。
- 支持候选类型：人物名称、城市、地点、组织/势力、武器、功法、道具、地名。
- 用户可以勾选候选并采纳。
- 人物候选采纳到 `characters`。
- 城市、地点、地名采纳到 `locations`。
- 组织/势力采纳到 `organizations`。
- 武器、功法、道具采纳到 `items`。
- AI 输出只进入候选区，不直接写入 canon；用户采纳才入库。

不做：

- 不做完整预设管理后台。
- 不做用户自定义预设持久化。
- 不做复杂去重合并 UI。
- 不做图谱可视化重构。

## 用户体验

### 项目创建

字段：

- 作品名称：输入框。
- 题材：下拉选择，默认 `悬疑`。
- 风格：下拉选择，默认 `悬疑推理`。
- 一句话简介：文本域，可选。

题材和风格允许选择 `自定义`，但 MVP 不展开二级编辑器；用户仍可通过后续设定和世界规则补充差异化信息。

### 创作要素页

新增“AI 候选生成”区域：

- 元素类型：下拉。
- 数量：下拉，支持 5、10、20。
- 风格：下拉，默认继承项目风格或 `通用`。
- 世界观约束：多选，从当前世界规则中选择。
- 生成按钮：调用 AI。

生成结果以列表展示：

- 名称。
- 类型。
- 描述。
- 创作理由。
- 标签。
- 采纳勾选框。

用户点击“采纳选中”后，系统按类型写入对应对象表并刷新工作台看板。

## 预设数据

系统预设放在 `packages/presets`，先作为代码常量导出给前端使用。

### 题材

- 玄幻
- 奇幻
- 科幻
- 都市
- 悬疑
- 仙侠
- 武侠
- 历史
- 现实
- 轻小说
- 自定义

### 风格

- 通用
- 悬疑推理
- 爽文
- 群像
- 成长
- 黑暗
- 轻松
- 史诗
- 现实主义
- 热血
- 赛博朋克
- 古典志怪
- 自定义

### 元素类型

- 人物名称：`character_name`
- 城市：`city`
- 地点：`location`
- 组织/势力：`organization`
- 武器：`weapon`
- 功法：`technique`
- 道具：`item`
- 地名：`place_name`

## 后端接口

### `element.generateCandidates`

输入：

```ts
{
  projectId: string;
  elementType: "character_name" | "city" | "location" | "organization" | "weapon" | "technique" | "item" | "place_name";
  count: 5 | 10 | 20;
  genre?: string;
  style?: string;
  worldRuleIds?: string[];
  constraints?: string[];
}
```

输出：

```ts
{
  items: Array<{
    name: string;
    type: string;
    description: string;
    rationale: string;
    tags: string[];
  }>;
}
```

### `element.acceptCandidates`

输入：

```ts
{
  projectId: string;
  items: Array<{
    name: string;
    type: string;
    description?: string;
    rationale?: string;
    tags?: string[];
  }>;
}
```

输出：

```ts
{
  accepted: Array<{
    id: string;
    name: string;
    type: string;
    target: "character" | "location" | "organization" | "item";
  }>;
}
```

## AI 行为

新增结构化输出 schema：`ElementCandidateOutputSchema`。

新增 prompt：`element-generate/system.v1.md`。

系统提示词要求：

- 只输出符合 schema 的 JSON。
- 根据题材、风格、已有世界规则生成候选。
- 避免同质化命名。
- 避免时代感、文化感、科技层级错位。
- 名称要能直接用于小说正文。
- 描述要说明该元素在故事中的可用性。
- 理由要解释为什么符合当前作品。
- 不要直接声明候选已成为正式设定。

## 数据落点

已有表可复用：

- `characters`
- `locations`
- `organizations`
- `items`

需要在 `WorldRepository` 增加创建与列表方法：

- `createLocation`
- `listLocations`
- `createOrganization`
- `listOrganizations`
- `createItem`
- `listItems`

采纳时记录 `domain_events`：

- `character.created`
- `location.created`
- `organization.created`
- `item.created`

## 前端组件

新增或修改：

- `packages/presets/src/index.ts`：导出题材、风格、元素类型预设。
- `ShellLayout.tsx`：项目创建 modal 使用题材/风格下拉。
- `CreativeElementsPanel.tsx`：增加 AI 候选生成和采纳区。
- `story-pilot-api.ts`：增加 `generateElementCandidates` 和 `acceptElementCandidates`。

## 验收标准

- 用户新建作品时，题材和风格是下拉选择，不再默认手填。
- 创作要素页能选择元素类型和数量生成候选。
- AI 候选返回后用户可以选择采纳。
- 采纳人物名称会创建人物。
- 采纳城市/地点/地名会创建 location。
- 采纳组织/势力会创建 organization。
- 采纳武器/功法/道具会创建 item。
- 刷新后看板能展示已采纳的人物和世界要素。
- 所有新增接口有 contract/schema 测试。
- AI 输出 schema 有测试。
- sidecar 集成测试覆盖生成和采纳。
- 前端测试覆盖下拉预设、候选生成和采纳。
