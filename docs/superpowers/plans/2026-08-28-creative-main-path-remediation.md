# Creative Main Path Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first executable version of the nine-step novel creation path so a new project starts from structured立项/蓝图/世界观/人物/剧情/大纲 before chapter drafting.

**Architecture:** SQLite remains the transactional source of truth. NestJS sidecar owns stage transitions, structured AI candidates/artifacts, and outline-to-chapter application; React + Ant Design renders the creative path workbench before the existing chapter editor.

**Tech Stack:** pnpm workspaces, TypeScript, NestJS, better-sqlite3, Drizzle schema definitions, React, Ant Design, Vitest.

**Spec:** `docs/specs/2026-08-28-creative-main-path-remediation-spec.md`

## Global Constraints

- New projects default to the creative path workbench, not the empty chapter page.
- The visible path order is `brief -> blueprint -> worldbuilding -> characters -> plot_arcs -> outline -> chapters -> memory_review -> retrospective`.
- `outline` is a standalone stage between plot arcs and chapter production.
- AI generation commands write candidates/artifacts first; `apply` or `confirm` commands write canonical business objects.
- SQLite is the fact source; Kuzu remains a graph read model.
- Typed RPC contracts must be updated before sidecar or frontend code consumes new commands.
- Production code changes must be preceded by failing tests.

---

### Task 1: Database Schema And Repositories

**Files:**

- Modify: `packages/db/src/migrations/project-schema-v1.ts`
- Modify: `packages/db/src/project-database.ts`
- Modify: `packages/db/src/schema/index.ts`
- Create: `packages/db/src/schema/creative-path.ts`
- Create: `packages/db/src/repositories/creative-path.repository.ts`
- Create: `packages/db/src/repositories/outline.repository.ts`
- Modify: `packages/db/src/repositories/index.ts`
- Modify: `packages/db/src/schema/schema.test.ts`
- Modify: `packages/db/src/project-database.test.ts`

**Interfaces:**

- Produces `CreativeStageRecord`, `ProjectBriefRecord`, `StoryBlueprintRecord`, `ChapterOutlineRecord`.
- Produces `CreativePathRepository.initializePath(projectId, now)`.
- Produces `CreativePathRepository.getPath(projectId)`.
- Produces `CreativePathRepository.saveBrief(input)`.
- Produces `CreativePathRepository.confirmBrief(projectId, briefId, now)`.
- Produces `CreativePathRepository.saveBlueprint(input)`.
- Produces `CreativePathRepository.applyBlueprint(projectId, blueprintId, now)`.
- Produces `OutlineRepository.createOutlineWithChapters(input)`.
- Produces `OutlineRepository.approveChapterOutline(projectId, chapterOutlineId, now)`.
- Produces `OutlineRepository.applyChapterOutline(input)`.
- Consumed by Task 3 sidecar services.

- [x] **Step 1: Write failing DB schema tests**

Add assertions to `packages/db/src/schema/schema.test.ts`:

```ts
expect(projectSchema.creativeStages).toBeDefined();
expect(projectSchema.projectBriefs).toBeDefined();
expect(projectSchema.storyBlueprints).toBeDefined();
expect(projectSchema.outlines).toBeDefined();
expect(projectSchema.chapterOutlines).toBeDefined();
expect(projectSchema.reviewIssues).toBeDefined();
```

- [x] **Step 2: Write failing migration compatibility test**

Add a test to `packages/db/src/project-database.test.ts` that creates a project database, runs migrations, and verifies these tables exist:

```ts
const rows = database.client
  .prepare("select name from sqlite_master where type = 'table'")
  .all()
  .map((row) => (row as { name: string }).name);

expect(rows).toEqual(
  expect.arrayContaining([
    "creative_stages",
    "project_briefs",
    "story_blueprints",
    "outlines",
    "chapter_outlines",
    "review_issues",
  ]),
);
```

Run: `pnpm --filter @story-pilot/db test`

Expected: FAIL because the schema and tables do not exist yet.

- [x] **Step 3: Implement Drizzle schema**

Create `packages/db/src/schema/creative-path.ts` with SQLite tables:

```ts
export const creativeStages = sqliteTable("creative_stages", { ... });
export const projectBriefs = sqliteTable("project_briefs", { ... });
export const storyBlueprints = sqliteTable("story_blueprints", { ... });
export const powerSystems = sqliteTable("power_systems", { ... });
export const characterRelations = sqliteTable("character_relations", { ... });
export const characterArcs = sqliteTable("character_arcs", { ... });
export const conflicts = sqliteTable("conflicts", { ... });
export const outlines = sqliteTable("outlines", { ... });
export const volumeOutlines = sqliteTable("volume_outlines", { ... });
export const chapterOutlines = sqliteTable("chapter_outlines", { ... });
export const sceneOutlines = sqliteTable("scene_outlines", { ... });
export const reviewIssues = sqliteTable("review_issues", { ... });
export const retrospectives = sqliteTable("retrospectives", { ... });
```

Use `text` for JSON columns and `integer` for timestamps. Keep column names aligned with the spec.

- [x] **Step 4: Export schema**

Update `packages/db/src/schema/index.ts`:

```ts
import * as creativePathSchema from "./creative-path.js";

export const projectSchema = {
  ...chapterSchema,
  ...characterSchema,
  ...creativePathSchema,
  ...
};

export * from "./creative-path.js";
```

- [x] **Step 5: Add migration SQL and compatibility guard**

Append `create table if not exists` statements and indexes for all new tables in `INITIAL_PROJECT_SCHEMA_SQL`.

Update `ensureProjectSchemaCompatibility` so existing project DBs receive all new tables by executing a new `CREATIVE_PATH_COMPATIBILITY_SQL` block with `create table if not exists`.

- [x] **Step 6: Implement repositories**

`CreativePathRepository` must initialize all nine stage rows with statuses:

```ts
const STAGE_ORDER = [
  "brief",
  "blueprint",
  "worldbuilding",
  "characters",
  "plot_arcs",
  "outline",
  "chapters",
  "memory_review",
  "retrospective",
] as const;
```

Initial status: `brief = "available"`, others `locked`.

`OutlineRepository.applyChapterOutline` must create an empty chapter through raw SQL using the target project default work/volume when no `chapter_id` exists, update `chapter_outlines.status = 'applied'`, and return both records.

- [x] **Step 7: Run DB tests**

Run: `pnpm --filter @story-pilot/db test`

Expected: PASS.

### Task 2: Typed RPC Contracts

**Files:**

- Modify: `packages/contracts/src/commands/creative.ts`
- Modify: `packages/contracts/src/commands/chapter.ts`
- Modify: `packages/contracts/src/commands/index.ts`
- Modify: `packages/contracts/src/commands/command-registry.test.ts`

**Interfaces:**

- Produces command schemas for:
  - `creativeStage.getPath`
  - `brief.save`
  - `brief.confirm`
  - `blueprint.generate`
  - `blueprint.apply`
  - `outline.generate`
  - `outline.approveChapterOutline`
  - `outline.applyChapterOutline`
  - `chapter.generateDraftFromOutline`
- Consumed by sidecar RPC and desktop API client.

- [x] **Step 1: Write failing contract tests**

In `command-registry.test.ts`, extend the command list with the new command names and add parse tests:

```ts
expect(
  parseCommandPayload("brief.save", {
    projectId: "proj_1",
    genre: "玄幻",
    subgenres: ["废柴逆袭"],
    targetAudience: "男频爽文",
    initialIdea: "少年发现旧都遗物。",
  }),
).toMatchObject({
  genre: "玄幻",
  subgenres: ["废柴逆袭"],
});

expect(
  parseCommandPayload("outline.generate", {
    projectId: "proj_1",
    scope: "chapter_batch",
    chapterCount: 10,
  }),
).toMatchObject({
  chapterCount: 10,
  scope: "chapter_batch",
});
```

Run: `pnpm --filter @story-pilot/contracts test`

Expected: FAIL because commands are unknown.

- [x] **Step 2: Add schemas**

Add Zod schemas with exact defaults:

```ts
"creativeStage.getPath": projectIdPayloadSchema,
"brief.save": projectIdPayloadSchema.extend({
  genre: z.string().min(1),
  subgenres: z.array(z.string().min(1)).default([]),
  targetAudience: z.string().min(1).optional(),
  platformProfile: z.string().min(1).optional(),
  lengthProfile: z.string().min(1).optional(),
  narrativePov: z.string().min(1).optional(),
  emotionalRewards: z.array(z.string().min(1)).default([]),
  initialIdea: z.string().optional(),
  forbiddenDirections: z.array(z.string().min(1)).default([]),
}),
"brief.confirm": projectIdPayloadSchema.extend({ briefId: z.string().min(1) }),
"blueprint.generate": projectIdPayloadSchema,
"blueprint.apply": projectIdPayloadSchema.extend({ blueprintId: z.string().min(1) }),
"outline.generate": projectIdPayloadSchema.extend({
  scope: z.enum(["full_book", "volume", "arc", "chapter_batch"]).default("chapter_batch"),
  chapterCount: z.union([z.literal(3), z.literal(5), z.literal(10)]).default(10),
}),
"outline.approveChapterOutline": projectIdPayloadSchema.extend({
  chapterOutlineId: z.string().min(1),
}),
"outline.applyChapterOutline": projectIdPayloadSchema.extend({
  chapterOutlineId: z.string().min(1),
}),
```

In `chapter.ts`, add:

```ts
"chapter.generateDraftFromOutline": projectIdPayloadSchema.extend({
  chapterOutlineId: z.string().min(1),
  instruction: z.string().optional(),
})
```

- [x] **Step 3: Update command registry**

Add the new command names in path order before existing object-level commands.

- [x] **Step 4: Run contract tests**

Run: `pnpm --filter @story-pilot/contracts test`

Expected: PASS.

### Task 3: Sidecar Services And Workbench Board

**Files:**

- Create: `apps/sidecar/src/creative-path/creative-path.module.ts`
- Create: `apps/sidecar/src/creative-path/creative-path.service.ts`
- Create: `apps/sidecar/src/outline/outline.module.ts`
- Create: `apps/sidecar/src/outline/outline.service.ts`
- Modify: `apps/sidecar/src/app.module.ts`
- Modify: `apps/sidecar/src/rpc/rpc.module.ts`
- Modify: `apps/sidecar/src/rpc/rpc.service.ts`
- Modify: `apps/sidecar/src/project/project.service.ts`
- Modify: `apps/sidecar/src/workbench/workbench.service.ts`
- Modify: `apps/sidecar/src/rpc/rpc.integration.spec.ts`
- Create: `apps/sidecar/src/creative-path/creative-path.service.spec.ts`
- Create: `apps/sidecar/src/outline/outline.service.spec.ts`

**Interfaces:**

- Consumes Task 1 repositories and Task 2 command schemas.
- Produces board field `creativePath: { stages, brief, blueprint, outlines, chapterOutlines, reviewIssues }`.
- Produces `ChapterService.generateDraftFromOutline(input)`.

- [x] **Step 1: Write failing sidecar integration test**

Add a test to `rpc.integration.spec.ts`:

```ts
const project = await expectRpcOk(rpcService.handle({ command: "project.create", ... }));
const path = await expectRpcOk(rpcService.handle({
  command: "creativeStage.getPath",
  payload: { projectId: getString(project, "id") },
}));
expect(getRecordArray(path, "stages").map((stage) => getString(stage, "stageKey"))).toEqual([
  "brief", "blueprint", "worldbuilding", "characters", "plot_arcs", "outline",
  "chapters", "memory_review", "retrospective",
]);
```

Run: `pnpm --filter @story-pilot/sidecar test`

Expected: FAIL because command is unsupported.

- [x] **Step 2: Implement creative path service**

`CreativePathService` must:

- initialize path on project creation.
- get path with current brief and blueprint.
- save and confirm brief.
- generate a deterministic blueprint artifact using the project brief.
- apply a blueprint into `story_blueprints`.

Use `DomainEventRepository.append` for `creative_stage.initialized`, `project_brief.saved`, `project_brief.confirmed`, `story_blueprint.generated`, `story_blueprint.applied`.

- [x] **Step 3: Implement outline service**

`OutlineService.generate` must create an outline plus N chapter outlines with deterministic titles when fake model support is not yet present:

```ts
第 1 章：开局钩子
第 2 章：冲突升级
第 3 章：第一次反转
...
```

Each chapter outline must include `chapterGoal`, `conflict`, `informationGain`, `hook`, `targetWordCount`, and status `draft`.

`approveChapterOutline` sets status `approved`.

`applyChapterOutline` creates an empty chapter and records `domain_events.outline.applied`.

- [x] **Step 4: Enforce chapter draft from outline**

Add `ChapterService.generateDraftFromOutline`. It must:

- load the chapter outline.
- reject if the outline is not `approved` or `applied`.
- apply the outline to a chapter if no chapter exists.
- call the existing `generateDraft` with instruction containing the outline goal.
- persist artifact metadata with `chapterOutlineId`.

Use business error text `CHAPTER_OUTLINE_REQUIRED` when no valid outline is available.

- [x] **Step 5: Wire RPC**

Add dispatch cases for the new commands. Keep existing `chapter.generateDraft` behavior unchanged.

- [x] **Step 6: Extend workbench board**

`WorkbenchService.getBoard` returns `creativePath` with stages, latest brief, active blueprint, outlines, chapter outlines and review issues.

- [x] **Step 7: Run sidecar tests**

Run: `pnpm --filter @story-pilot/sidecar test`

Expected: PASS.

### Task 4: Desktop Creative Path Workbench

**Files:**

- Modify: `apps/desktop/src/shared/rpc/story-pilot-api.ts`
- Create: `apps/desktop/src/features/creative-path/CreativePathWorkbench.tsx`
- Create: `apps/desktop/src/features/creative-path/CreativePathWorkbench.test.tsx`
- Modify: `apps/desktop/src/features/workbench/WorkbenchHome.tsx`
- Modify: `apps/desktop/src/app/ShellLayout.tsx`
- Modify: `apps/desktop/src/app/ShellLayout.test.tsx`
- Modify: `apps/desktop/src/styles.css`

**Interfaces:**

- Consumes `creativePath` board payload from Task 3.
- Produces `onSaveBrief`, `onConfirmBrief`, `onGenerateBlueprint`, `onApplyBlueprint`, `onGenerateOutline`, `onApproveChapterOutline`, `onApplyChapterOutline`, `onGenerateDraftFromOutline` callbacks.

- [x] **Step 1: Write failing component test**

Create `CreativePathWorkbench.test.tsx` verifying:

```ts
expect(screen.getByText("作品立项")).toBeInTheDocument();
expect(screen.getByText("大纲设计")).toBeInTheDocument();
expect(screen.queryByText("暂无章节")).not.toBeInTheDocument();
```

Run: `pnpm --filter @story-pilot/desktop test -- CreativePathWorkbench.test.tsx`

Expected: FAIL because component does not exist.

- [x] **Step 2: Implement component**

Build an Ant Design workbench with:

- `Steps` for all nine stages.
- Brief form using `Select`/`Select mode="multiple"` for preset fields.
- Blueprint panel with generate/apply buttons.
- World/person/plot stages reusing the existing `CreativeElementsPanel` entry points by showing a short CTA.
- Outline stage with chapter outline list, approve/apply buttons, and explicit text that正文生成 requires approved章纲.
- Chapter production stage with “基于章纲生成草稿” action.

- [x] **Step 3: Wire API client**

Add methods to `StoryPilotApiClient` for all new commands.

- [x] **Step 4: Make creative path the default workbench**

In `WorkbenchHome`, render `CreativePathWorkbench` as the first tab. The old chapter editor becomes the `章节生产` tab and should be disabled or visibly blocked when no applied chapter outline exists.

- [x] **Step 5: Wire ShellLayout callbacks**

Add callbacks that call typed RPC and refresh the board after save/apply/generate actions.

- [x] **Step 6: Update ShellLayout tests**

Add expectations that a newly opened empty project shows the creative path and can generate/apply outline before entering chapter production.

- [x] **Step 7: Run desktop tests**

Run: `pnpm --filter @story-pilot/desktop test`

Expected: PASS.

### Task 5: End-To-End Main Path Verification

**Files:**

- Modify: `apps/sidecar/src/rpc/rpc.integration.spec.ts`
- Modify: `apps/desktop/src/app/ShellLayout.test.tsx`
- Optionally create: `apps/desktop/src/features/creative-path/e2e-fixtures.ts`

**Interfaces:**

- Consumes all prior tasks.
- Produces test coverage for the user path: empty project to first chapter draft.

- [x] **Step 1: Write sidecar E2E integration test**

Test sequence:

1. `project.create`
2. `creativeStage.getPath`
3. `brief.save`
4. `brief.confirm`
5. `blueprint.generate`
6. `blueprint.apply`
7. `outline.generate`
8. `outline.approveChapterOutline`
9. `outline.applyChapterOutline`
10. `chapter.generateDraftFromOutline`
11. `artifact.apply`
12. `memory.confirm`

Assert stage transitions, chapter version creation, and canon memory.

- [x] **Step 2: Write desktop path test**

Use mocked typed RPC to assert:

- Empty project displays “创作路径” first.
- The nine-stage stepper includes “大纲设计”.
- Clicking “生成前 10 章章纲” calls `outline.generate`.
- Clicking “批准章纲” then “应用为空章节” calls the correct commands.
- “基于章纲生成草稿” calls `chapter.generateDraftFromOutline`.

- [x] **Step 3: Run full verification**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
pnpm --filter @story-pilot/desktop tauri:build --bundles dmg --ci
```

Expected: all commands exit 0. `pnpm format:check` may remain broader than this change because existing docs can fail; touched files must pass Prettier.

- [x] **Step 4: Commit and push**

```bash
git add docs packages apps
git commit -m "feat: add creative path workflow"
git push origin feat/mvp-implementation
```

## Self-Review

- Spec coverage: this plan covers the nine-stage path, independent outline stage, database storage for each stage, typed RPC, sidecar services, frontend workbench, and E2E path tests.
- Deferred depth: full Kuzu projection for every new relationship and advanced retrospective automation remain behind existing graph/event architecture; this plan stores the source data and domain events needed for projection.
- Placeholder scan: no unfinished-work markers or deferred-implementation instructions are present.
- Type consistency: stage keys, command names, and file paths are repeated consistently across tasks.
