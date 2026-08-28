# P1 创作门禁与阶段数据完整性 Spec

## 目标

把九步创作路径从“可点击状态流转”升级为“由真实数据完整度驱动的创作门禁”。每个阶段必须有明确数据产物、最低完成标准、缺口报告和下游影响判断。

## 当前缺口

- `creative_stages` 已存在，但 readiness 和 gate report 还没有真正承担决策。
- 阶段完成可以手动推进，缺少基于数据完整性的验证。
- 世界观、人物、剧情弧线、大纲之间缺少强约束关系。
- 上游设定变更后，下游内容不会自动标记 `needs_revision`。

## 生产级补强重点

P1 的生产级目标是让用户不会在创作路径中迷路，也不会在数据不完整时继续往下写。它直接解决“创作蓝图完成后世界观阶段没有入口”“大纲前缺剧情结构”的流程断裂。

必须补强：

- 九步路径固定为：作品立项、创作蓝图、世界观与要素、人物与关系网、剧情弧线、大纲设计、章节生产、记忆与图谱校验、阶段复盘。
- 每个阶段必须有可计算的 readiness、blocking issues、warnings、required items 和下一步动作。
- 阶段页必须提供补齐入口，例如生成世界观要素、采纳人物候选、补剧情线、生成章纲。
- `advance(strict)` 只能在 gate pass 后推进，`advance(force)` 必须有 reason 和审计记录。
- 上游核心对象变更时，下游阶段按影响范围标记 `needs_revision`，并显示受影响原因。

不可降级项：

- 不能只靠前端按钮控制阶段状态，后端必须根据数据库事实计算 gate。
- 不能把自然语言备注等同于结构化完成，关键数据必须落表。
- 不能让任何阶段处于“可见但无操作入口”的状态。

## 生产投入补强方案

P1 的目标是消灭“流程卡住”和“阶段假完成”。完成 P1 后，新用户从空作品进入时，应清楚知道当前该做什么、为什么不能进入下一步、缺口在哪里补齐。

必须补强的闭环：

| 补强项       | 生产标准                                             | 失败处理                                 |
| ------------ | ---------------------------------------------------- | ---------------------------------------- |
| 九步路径     | brief 到 retrospective 全部由后端 gate report 驱动   | 当前阶段缺口必须显示可点击补齐入口       |
| 阶段完整度   | 每阶段 readiness 来自数据库对象数量和关键字段质量    | 缺少必填对象时 strict advance 返回错误码 |
| 阶段推进     | strict、force、skip、reopen 都有审计事件             | force、skip 需要记录原因                 |
| 上游变更影响 | 立项、蓝图、世界规则、核心人物变更会标记下游修订状态 | 看板显示影响范围和重新确认入口           |
| UI 入口      | 每个 locked、available、needs_revision 状态都有解释  | 没有入口的阶段视为 P1 验收失败           |
| E2E 主链路   | 空作品可以走到世界观阶段并继续进入人物阶段           | 任一步无法进入下一步则阻断发布           |

工程落点：

- `CreativeStageGateEvaluator` 只读取数据库事实，返回统一 `GateReport`。
- `CreativeStageService` 负责推进、跳过、重开、影响标记和 domain event。
- 前端 `CreativePathWorkbench` 只渲染后端报告，不自行推断阶段完成。
- 右侧看板消费 `GateReport` 中的缺口、风险、建议操作和跳转 target。

阶段出口：

- 用户不会停在“世界观要素没有后续入口”的状态。
- 每一步都有明确主按钮、补齐列表、完成条件和下一步入口。
- 改动上游核心数据后，下游阶段不会继续显示为无风险 completed。

## 范围

本阶段必须完成：

- 阶段门禁引擎。
- 每个阶段的必填数据项和最低质量规则。
- 阶段评估报告落库。
- 阶段推进、跳过、重开、回退的统一命令。
- 看板可跳转到缺口项。
- 上游变更影响下游阶段状态。

本阶段不做：

- 高级文学质量评分。
- 复杂图谱推理。
- 批量正文生成。

## 阶段门禁模型

复用 `creative_stages.gate_report_json`，并新增标准结构：

```ts
interface CreativeStageGateReport {
  stageKey: CreativeStageKey;
  readinessScore: number;
  pass: boolean;
  blockingIssues: GateIssue[];
  warnings: GateIssue[];
  requiredItems: GateRequiredItem[];
  downstreamImpacts: DownstreamImpact[];
  evaluatedAt: number;
}

interface GateIssue {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  targetType:
    | "brief"
    | "blueprint"
    | "world_rule"
    | "character"
    | "relationship"
    | "plotline"
    | "outline"
    | "chapter_outline"
    | "memory"
    | "graph";
  targetId?: string;
  action: "create" | "edit" | "confirm" | "review" | "generate" | "accept";
}

interface GateRequiredItem {
  key: string;
  label: string;
  requiredCount: number;
  actualCount: number;
  satisfied: boolean;
}

interface DownstreamImpact {
  stageKey: CreativeStageKey;
  reason: string;
  markAs: "available" | "needs_revision" | "locked";
}
```

## 阶段完成标准

### 1. 作品立项 `brief`

通过条件：

- `genre` 已确认。
- `targetAudience` 已确认。
- `lengthProfile` 已确认。
- `narrativePov` 已确认。
- 至少 1 个 `emotionalReward`。
- `initialIdea` 或 `logline` 至少存在一个。

失败示例：

- `BRIEF_GENRE_REQUIRED`
- `BRIEF_AUDIENCE_REQUIRED`
- `BRIEF_PROMISE_TOO_WEAK`

### 2. 创作蓝图 `blueprint`

通过条件：

- 已有 confirmed `story_blueprint`。
- `corePromise` 不为空。
- `mainConflict` 不为空。
- 至少 2 个 differentiator。
- 至少 1 个 risk，并有规避建议。

完成后解锁 `worldbuilding`。

### 3. 世界观与要素 `worldbuilding`

通过条件：

- 至少 3 条 canon `world_rules`，其中必须包含 `核心规则` 和 `限制/代价`。
- 至少 2 个 location。
- 至少 1 个 organization 或 social force。
- 对玄幻、仙侠、科幻、奇幻等题材，至少 1 个 `power_system`。
- 至少 1 个 item/weapon/technique 可用于早期冲突。

完成后解锁 `characters`。

### 4. 人物与关系网 `characters`

通过条件：

- 至少 1 个 protagonist。
- 至少 1 个 antagonist 或 opposing force。
- 至少 2 个 support characters。
- 主角具备 motivation、desire、weakness 或 false belief 中至少 2 项。
- 至少 3 条 entity relation 或 character relation。
- 关键人物至少绑定 1 条 world rule、location、organization 或 plotline。

完成后解锁 `plot_arcs`。

### 5. 剧情弧线 `plot_arcs`

通过条件：

- 至少 1 条 main plotline。
- 至少 2 条 subplot 或 character arc。
- 主线至少 5 个 plotline nodes。
- 至少 3 个 conflict。
- 至少 3 个 foreshadowing，其中每个有 seed plan 或 payoff plan。
- 至少 5 个 story_events，且包含因果关系或顺序关系。

完成后解锁 `outline`。

### 6. 大纲设计 `outline`

通过条件：

- 至少 1 个 full_book outline。
- 至少 1 个 volume outline。
- 下一批至少 10 个 chapter outline。
- 每个 chapter outline 具备 chapterGoal、conflict、informationGain、hook。
- 至少 80% chapter outline 绑定 plotline 或 character arc。

完成后解锁 `chapters`。

### 7. 章节生产 `chapters`

通过条件：

- 至少 1 个 chapter outline 已应用为 chapter。
- 至少 1 个 chapter draft artifact。
- 已应用或保存正文内容。
- 章节摘要存在。
- 章节生成后产生 memory candidates 或明确无新增记忆报告。

完成后解锁 `memory_review`。

### 8. 记忆与图谱校验 `memory_review`

通过条件：

- pending memory candidates 数量低于当前批次阈值，默认 0。
- graph projection checkpoint 是最新 domain event。
- continuity review 没有 `error` 级问题。
- warning 级问题必须被用户确认、修复或记录为已知风险。

完成后解锁 `retrospective`。

### 9. 阶段复盘 `retrospective`

通过条件：

- 记录本阶段目标达成情况。
- 记录下一批章节目标。
- 记录未回收伏笔、未解决冲突、待强化人物。
- 生成下一轮创作建议 artifact。

完成后回到 `outline` 或 `chapters`，进入下一批次迭代。

## 后端 API

新增命令：

```ts
creativeStage.evaluateGate(input: {
  projectId: string;
  stageKey: CreativeStageKey;
}): CreativeStageGateReport

creativeStage.advance(input: {
  projectId: string;
  stageKey: CreativeStageKey;
  mode: "strict" | "force";
  reason?: string;
}): {
  stage: CreativeStageRecord;
  nextStage?: CreativeStageRecord;
  gateReport: CreativeStageGateReport;
}

creativeStage.reopen(input: {
  projectId: string;
  stageKey: CreativeStageKey;
  reason: string;
}): CreativeStageRecord

creativeStage.skip(input: {
  projectId: string;
  stageKey: CreativeStageKey;
  reason: string;
}): CreativeStageRecord
```

规则：

- `strict` 模式下，`gateReport.pass=false` 时不能完成阶段。
- `force` 模式允许推进，但必须写入 `gate_report_json.forced=true` 和 reason。
- 任意上游核心对象被修改时，调用 `CreativeStageImpactService.markDownstreamNeedsRevision()`。

## 前端设计

创作路径页每个阶段增加：

- 完整度分数。
- 缺口列表。
- “生成候选”“补充数据”“重新评估”“进入下一阶段”按钮。
- 阻塞项点击后跳转到对应 tab 或抽屉。

右侧看板增加：

- 阶段门禁报告。
- 下游受影响阶段。
- 未确认 AI 产物。
- 一键重新评估。

## 当前可复用实现

- `packages/db/src/schema/creative-path.ts`：已有 `creative_stages`、brief、blueprint、outline 相关表。
- `packages/db/src/repositories/creative-path.repository.ts`：已有阶段初始化、蓝图应用、阶段完成基础。
- `apps/sidecar/src/creative-path/creative-path.service.ts`：已有 `getPath`、brief、blueprint、stage complete 能力。
- `apps/desktop/src/features/creative-path/CreativePathWorkbench.tsx`：已有九步路径 UI 和中间阶段入口。
- `apps/desktop/src/features/workbench/WorkbenchHome.tsx`：已有工作台 tab 承载。
- `apps/desktop/src/app/ShellLayout.tsx`：已有阶段回调接线。

## 实施切片

### P1.1 Gate 类型和协议

产物：

- `CreativeStageGateReport`、`GateIssue`、`GateRequiredItem`、`DownstreamImpact` 放入 contracts。
- `creativeStage.evaluateGate`、`creativeStage.advance`、`creativeStage.reopen`、`creativeStage.skip` 完成 Zod schema。

验证：

- command registry 测试覆盖全部新命令。
- 非法 stageKey、非法 mode、缺 reason 时 schema 拒绝。

### P1.2 Gate Evaluator

产物：

- `CreativeStageGateEvaluator` 对九个阶段逐一计算 readiness。
- 每个阶段阻塞项有 `code`、`targetType`、`action`。
- readiness 算法 deterministic，不调用 LLM。

验证：

- 每个阶段至少 1 个失败测试和 1 个通过测试。
- 玄幻项目缺少 `power_system` 时 worldbuilding 不通过。

### P1.3 阶段推进和影响分析

产物：

- `advance(strict)` 只允许 gate pass 后推进。
- `advance(force)` 需要 reason 并写 domain event。
- 上游对象更新后，下游阶段标记 `needs_revision`。

验证：

- RPC 集成测试覆盖 strict、force、reopen、skip。
- 修改 blueprint 后 outline 和 chapters 被标记需修订。

### P1.4 工作台门禁 UI

产物：

- 创作路径阶段卡展示 blocking issues 和 warnings。
- 看板项可跳转到对应处理入口。
- 下一阶段按钮根据 gate 状态启用或禁用。

验证：

- React 测试覆盖缺口渲染、跳转、重新评估、严格推进失败提示。

## 测试用例

单元测试：

- 空项目评估 `brief` 返回 `pass=false`。
- brief 完整后 `evaluateGate(brief)` 返回 `pass=true`。
- worldbuilding 缺少 power_system 时，玄幻项目返回 blocking issue。
- 修改 `story_blueprint.mainConflict` 后，`plot_arcs` 和 `outline` 标记为 `needs_revision`。

集成测试：

```text
1. 创建项目。
2. 保存并确认 brief。
3. evaluateGate(brief) pass。
4. advance(brief, strict) 后 blueprint available。
5. 未生成 blueprint 时 advance(blueprint, strict) 失败。
6. 创建世界观要素不足时 worldbuilding gate 不通过。
7. 补足规则、地点、组织、功法后 worldbuilding gate 通过。
```

E2E：

```text
1. 新建作品进入创作路径。
2. 填完作品立项。
3. 点击进入下一阶段。
4. 创作蓝图未确认时看到阻塞提示。
5. 应用蓝图后，世界观阶段出现缺口卡片。
6. 使用 AI 候选生成并采纳要素。
7. 重新评估后进入人物阶段。
```

## 阶段验证清单

完成 P1 时必须保存以下证据：

- `pnpm --filter @story-pilot/contracts test`
- `pnpm --filter @story-pilot/db test`
- `pnpm --filter @story-pilot/sidecar test`
- `pnpm --filter @story-pilot/desktop test`
- `pnpm typecheck`
- 创作路径 E2E：空项目到 worldbuilding gate pass。

## 验收标准

- 每个阶段都有可解释的 readiness score。
- 阶段推进不再只依赖按钮点击，必须经过 gate report。
- 所有 blocking issue 都有 target 和 action。
- 看板项可以跳转到处理入口。
- force skip 有审计记录，后续看板持续显示风险。
