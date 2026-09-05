# Longform Serial Control System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 500 万字长篇连载控制系统 defined in the spec, starting from prompt/context infrastructure and ending with verifiable frontend workflows and E2E coverage.

**Architecture:** SQLite remains the canonical store. The sidecar owns orchestration, context package construction, AI artifact creation, and canon writes; the frontend presents list-first workflows, modal editing, and a collapsible Inspector without making AI output canonical until the user adopts it. Prompt text and variables live in `packages/ai/src/prompts/**`, while business services pass structured variables into template builders.

**Tech Stack:** pnpm workspaces, TypeScript, NestJS sidecar, SQLite repositories, React + Ant Design desktop app, Vitest, Playwright E2E, Tauri packaging.

**Spec:** `docs/specs/2026-09-05-longform-serial-control-system-spec.md`

## Global Constraints

- Keep the existing 9-step creative path and the tree sidebar.
- AI outputs must land in artifacts or candidate results first; user adoption writes canon.
- Long text forms are single-column.
- List objects are list-first; create and edit actions use dialogs.
- The right Inspector is auxiliary and collapsible; it must not squeeze the main work area into unusable columns.
- Prompt templates must be registered in `PromptTemplateRegistry`; core prompts should not be hand-built inside business services.
- Each AI call must carry an explicit prompt version and model policy.
- Production behavior changes must be preceded by failing tests.

---

### Task 1: Prompt Template Registry Migration

**Files:**

- Modify: `packages/ai/src/prompts/prompt-template-registry.ts`
- Modify: `packages/ai/src/prompts/prompt-template-registry.test.ts`
- Create: `packages/ai/src/structured-output/chapter-execution-card.schema.ts`
- Create: `packages/ai/src/structured-output/chapter-execution-card.schema.test.ts`
- Create: `packages/ai/src/structured-output/chapter-review.schema.ts`
- Create: `packages/ai/src/structured-output/chapter-review.schema.test.ts`
- Create: `packages/ai/src/structured-output/story-state-delta.schema.ts`
- Create: `packages/ai/src/structured-output/story-state-delta.schema.test.ts`
- Create: `packages/ai/src/structured-output/serial-review.schema.ts`
- Create: `packages/ai/src/structured-output/serial-review.schema.test.ts`
- Modify: `packages/ai/src/index.ts`

**Interfaces:**

- Produces template IDs `book-plan.generate`, `rolling-chapter-plan.generate`, `chapter-execution-card.generate`, `chapter-draft.generate`, `chapter-review.generate`, `story-state-delta.extract`, `plot-debt.update`, `serial-review.generate`, and `element-candidate.generate`.
- Produces schema exports consumed by sidecar services in later tasks.

- [ ] **Step 1: Write failing prompt registry tests**

Add tests that require every new template ID to render shared system, canon boundary, declared variables, and default instructions. The test should fail if any ID is missing from `PromptTemplateRegistry`.

Run: `pnpm --filter @story-pilot/ai test -- prompt-template-registry.test.ts`

Expected: FAIL with missing template metadata for the newly asserted IDs.

- [ ] **Step 2: Write failing schema tests**

Add schema tests with hand-written valid and invalid fixtures for execution cards, chapter reviews, state deltas, and serial reviews. Mutations that remove reader reward, allow an invalid review dimension, omit storyDelta, or omit nextActions must fail.

Run: `pnpm --filter @story-pilot/ai test -- chapter-execution-card.schema.test.ts chapter-review.schema.test.ts story-state-delta.schema.test.ts serial-review.schema.test.ts`

Expected: FAIL because schema modules do not exist.

- [ ] **Step 3: Implement template metadata**

Extend `PROMPT_TEMPLATE_IDS` and `promptTemplateMetadata`. Use existing prompt capabilities where available:

- `book-plan.generate` -> `book_plan_generate`
- `rolling-chapter-plan.generate` -> `rolling_chapter_plan_generate`
- `chapter-draft.generate` -> `chapter_draft`
- `element-candidate.generate` -> `element_generate`
- `serial-review.generate` -> `retrospective_generate`

Add new prompt capabilities and prompt files only where the existing registry has no matching capability:

- `chapter_execution_card_generate`
- `chapter_review`
- `story_state_delta_extract`
- `plot_debt_update`

- [ ] **Step 4: Implement schemas and exports**

Create zod schemas matching the spec names and JSON field casing. Export them from `packages/ai/src/index.ts`.

- [ ] **Step 5: Run AI package verification**

Run: `pnpm --filter @story-pilot/ai test`

Expected: PASS.

### Task 2: Context Package Persistence And Service

**Files:**

- Modify: `packages/db/src/migrations/project-schema-v1.ts`
- Create: `packages/db/src/repositories/context-package.repository.ts`
- Modify: `packages/db/src/repositories/index.ts`
- Modify: `packages/db/src/project-database.test.ts`
- Create: `packages/db/src/repositories/context-package.repository.test.ts`
- Modify: `packages/contracts/src/commands/creative.ts`
- Modify: `packages/contracts/src/commands/index.ts`
- Modify: `packages/contracts/src/commands/command-registry.test.ts`
- Create: `apps/sidecar/src/context-package/context-package.service.ts`
- Create: `apps/sidecar/src/context-package/context-package.service.spec.ts`
- Modify: `apps/sidecar/src/rpc/rpc.service.ts`
- Modify: `apps/sidecar/src/rpc/rpc.integration.spec.ts`

**Interfaces:**

- Produces command `context.buildPackage`.
- Produces `GenerationContextPackageRecord` with `itemsJson`, `omittedItemsJson`, token budget, and estimated token count.
- Consumed by execution card, chapter draft, review, state extraction, and serial review services.

- [ ] **Step 1: Write failing DB tests**

Assert `generation_context_packages` exists after migration and repository can create and read a package for `targetType: "chapter_plan"` and `purpose: "execution_card_generate"`.

Run: `pnpm --filter @story-pilot/db test -- context-package.repository.test.ts project-database.test.ts`

Expected: FAIL until migration and repository are implemented.

- [ ] **Step 2: Write failing contract and sidecar tests**

Add parser tests for `context.buildPackage` and a sidecar service test that builds a package containing project, brief, worldbuilding summary, blueprint summary, related characters, plotlines, plot debts, and recent chapter summaries. Assert full text chapters are not included.

Run: `pnpm --filter @story-pilot/contracts test -- command-registry.test.ts && pnpm --filter @story-pilot/sidecar test -- context-package.service.spec.ts`

Expected: FAIL until command and service exist.

- [ ] **Step 3: Implement DB repository and migration**

Add `generation_context_packages` to the project schema compatibility SQL. Repository methods:

- `create(input)`
- `getById(projectId, id)`
- `listByTarget(projectId, targetType, targetId)`

- [ ] **Step 4: Implement RPC command and service**

Build context packages from existing repositories with deterministic priority ordering from the spec. Use a simple token estimator of `Math.ceil(text.length / 2)` and store omitted items when the package exceeds budget.

- [ ] **Step 5: Run package verification**

Run: `pnpm --filter @story-pilot/db test && pnpm --filter @story-pilot/contracts test && pnpm --filter @story-pilot/sidecar test -- context-package.service.spec.ts rpc.integration.spec.ts`

Expected: PASS for the touched paths.

### Task 3: Chapter Execution Cards

**Files:**

- Modify: `packages/db/src/migrations/project-schema-v1.ts`
- Create: `packages/db/src/repositories/chapter-execution-card.repository.ts`
- Create: `packages/db/src/repositories/chapter-execution-card.repository.test.ts`
- Modify: `packages/contracts/src/commands/chapter.ts`
- Modify: `packages/contracts/src/commands/index.ts`
- Create: `apps/sidecar/src/chapter/chapter-execution-card.service.ts`
- Create: `apps/sidecar/src/chapter/chapter-execution-card.service.spec.ts`
- Modify: `apps/sidecar/src/rpc/rpc.service.ts`
- Modify: `apps/desktop/src/shared/rpc/story-pilot-api.ts`
- Modify: `apps/desktop/src/features/creative-path/CreativePathWorkbench.tsx`
- Modify: `apps/desktop/e2e/book-outline.spec.ts`

**Interfaces:**

- Produces commands `chapterExecutionCard.generate`, `chapterExecutionCard.apply`, and `chapterExecutionCard.save`.
- AI generation returns an artifact; apply writes `chapter_execution_cards`.

- [ ] **Step 1: Write failing repository and command tests**

Assert saving an execution card preserves narrativeGoal, readerReward, hook, relatedPlotDebtIds, sceneBriefs, and sourceArtifactId.

- [ ] **Step 2: Write failing sidecar service tests**

Assert `generate` calls `context.buildPackage`, renders `chapter-execution-card.generate`, stores an artifact, and does not write canon until `apply`.

- [ ] **Step 3: Implement migration, repository, command, and service**

Use JSON text columns for arrays and scene briefs. Increment `version` on edits to an existing card.

- [ ] **Step 4: Add frontend entry**

In chapter planning, add list-first execution card status, “生成执行卡” dialog, artifact preview, and adopt action. Keep the page usable with Inspector open and closed.

- [ ] **Step 5: Run verification**

Run: `pnpm --filter @story-pilot/db test -- chapter-execution-card.repository.test.ts && pnpm --filter @story-pilot/sidecar test -- chapter-execution-card.service.spec.ts && pnpm --filter @story-pilot/desktop test -- CreativePathWorkbench.test.tsx && pnpm test:e2e -- apps/desktop/e2e/book-outline.spec.ts`

Expected: PASS.

### Task 4: Story State, Character State, And Plot Debts

**Files:**

- Modify: `packages/db/src/migrations/project-schema-v1.ts`
- Create: `packages/db/src/repositories/serial-state.repository.ts`
- Create: `packages/db/src/repositories/serial-state.repository.test.ts`
- Modify: `packages/contracts/src/commands/creative.ts`
- Modify: `packages/contracts/src/commands/index.ts`
- Create: `apps/sidecar/src/serial-state/serial-state.service.ts`
- Create: `apps/sidecar/src/serial-state/serial-state.service.spec.ts`
- Modify: `apps/sidecar/src/rpc/rpc.service.ts`
- Modify: `apps/desktop/src/features/creative/CreativeElementsPanel.tsx`
- Modify: `apps/desktop/e2e/plot-nodes.spec.ts`

**Interfaces:**

- Produces commands `plotDebt.list`, `plotDebt.save`, `storyState.extractDelta`, and `storyState.applyDelta`.
- Produces tables `story_state_snapshots`, `character_state_snapshots`, and `plot_debts`.

- [ ] **Step 1: Write failing DB and contract tests**

Test create/list/update for plot debts, story snapshots, and character snapshots. Validate enum payloads and JSON array fields.

- [ ] **Step 2: Write failing state extraction service test**

Fake provider returns a state delta artifact; `applyDelta` creates snapshots and plot debt changes only after user adoption.

- [ ] **Step 3: Implement repository, RPC, and service**

Make the latest state query deterministic by highest `chapterIndex`, then newest `createdAt`.

- [ ] **Step 4: Add frontend plot debt and state views**

In剧情节点, add tabs/filters for events, foreshadowings, and plot debts. In角色设计, add a state timeline dialog.

- [ ] **Step 5: Run verification**

Run: `pnpm --filter @story-pilot/db test -- serial-state.repository.test.ts && pnpm --filter @story-pilot/sidecar test -- serial-state.service.spec.ts && pnpm test:e2e -- apps/desktop/e2e/plot-nodes.spec.ts`

Expected: PASS.

### Task 5: Chapter Review And Serial Review

**Files:**

- Modify: `packages/db/src/migrations/project-schema-v1.ts`
- Create: `packages/db/src/repositories/serial-review.repository.ts`
- Create: `packages/db/src/repositories/serial-review.repository.test.ts`
- Modify: `packages/contracts/src/commands/chapter.ts`
- Modify: `packages/contracts/src/commands/creative.ts`
- Create: `apps/sidecar/src/review/chapter-review.service.ts`
- Create: `apps/sidecar/src/review/serial-review.service.ts`
- Create: `apps/sidecar/src/review/chapter-review.service.spec.ts`
- Create: `apps/sidecar/src/review/serial-review.service.spec.ts`
- Modify: `apps/sidecar/src/rpc/rpc.service.ts`

**Interfaces:**

- Produces `chapter.reviewDraft`, `serialReview.generate`, and `serialReview.apply`.
- Produces table `serial_reviews`.

- [ ] **Step 1: Write failing repository and command tests**

Assert serial reviews store promiseDelivery, rhythmReport, repetitionRisks, characterStagnation, plotDebtRisks, nextActions, status, and sourceArtifactId.

- [ ] **Step 2: Write failing review service tests**

Assert chapter review uses execution card, chapter draft artifact or chapter version, and context package. Assert serial review uses summaries and state snapshots rather than full manuscript text.

- [ ] **Step 3: Implement review repositories and services**

Persist AI review reports as artifacts. `serialReview.apply` writes `serial_reviews`.

- [ ] **Step 4: Run verification**

Run: `pnpm --filter @story-pilot/db test -- serial-review.repository.test.ts && pnpm --filter @story-pilot/sidecar test -- chapter-review.service.spec.ts serial-review.service.spec.ts`

Expected: PASS.

### Task 6: Frontend Longform Control UX

**Files:**

- Modify: `apps/desktop/src/features/workbench/WorkbenchHome.tsx`
- Modify: `apps/desktop/src/features/creative-path/CreativePathWorkbench.tsx`
- Modify: `apps/desktop/src/app/ShellLayout.tsx`
- Modify: `apps/desktop/src/styles.css`
- Modify: `apps/desktop/src/shared/rpc/story-pilot-api.ts`
- Modify: `apps/desktop/src/app/ShellLayout.test.tsx`
- Modify: `apps/desktop/src/features/creative-path/CreativePathWorkbench.test.tsx`
- Modify: `apps/desktop/e2e/shell-layout.spec.ts`

**Interfaces:**

- Consumes all new commands.
- Produces Inspector panels for status, plot debts, AI artifacts, and toolbox.
- Produces list-first modal interactions for角色、故事线、全书大纲、剧情节点、章节规划.

- [ ] **Step 1: Write failing component and E2E tests**

Test that main content stays readable with left and right panels expanded, dialogs fit inside viewport, long text fields are single-column, and Inspector can collapse without hiding primary actions.

- [ ] **Step 2: Implement frontend API client methods**

Add typed client methods for context packages, execution cards, plot debts, state delta, chapter review, and serial review.

- [ ] **Step 3: Implement UI flows**

Keep card usage to repeated list rows and summaries. Main editing happens in dialogs or single-column detail panels.

- [ ] **Step 4: Run verification**

Run: `pnpm --filter @story-pilot/desktop test && pnpm test:e2e -- apps/desktop/e2e/shell-layout.spec.ts apps/desktop/e2e/book-outline.spec.ts apps/desktop/e2e/plot-nodes.spec.ts`

Expected: PASS.

### Task 7: Full E2E And Packaging

**Files:**

- Create: `apps/desktop/e2e/longform-first-chapter-flow.spec.ts`
- Create: `apps/desktop/e2e/longform-performance.spec.ts`
- Modify: `package.json`
- Modify: version files touched by the release process

**Interfaces:**

- Produces the full flow test from “冰雪末世，打造安全屋，500 万字” to first chapter execution card and then to draft review/state extraction before正文撰写前后 gates.

- [ ] **Step 1: Write full-flow E2E**

Use deterministic fake provider responses. Assert worldbuilding, core story, characters, plotlines, book plans, chapter plans, execution card, draft artifact, review artifact, state snapshots, and plot debt changes exist.

- [ ] **Step 2: Write longform performance E2E**

Seed 10 volumes, 200 arcs, 1500 chapters, 4500 scenes, 120 characters, 10000 state/memory records, and 1000 plot debts. Assert dashboard under 2 seconds, chapter filtering under 1 second, context package under 3 seconds.

- [ ] **Step 3: Run full verification**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm verify:specs
```

Expected: all commands exit 0.

- [ ] **Step 4: Rebuild sidecar, bump version, and package**

Run the repository's established sidecar build and Tauri packaging scripts. Verify the generated app launches and the longform E2E still passes against the packaged runtime.

## Self-Review

- Spec coverage: Tasks 1-7 cover prompt abstraction, context packages, execution cards, state snapshots, plot debts, reviews, frontend interaction, E2E, performance, and packaging.
- Current implementation continuity: The plan reuses existing project brief, worldbuilding, story blueprint, character, plotline, longform plan, artifact, model call, workflow, and review issue infrastructure.
- Type consistency: Command names and table names match `docs/specs/2026-09-05-longform-serial-control-system-spec.md`.
- Placeholder scan: no TODO, TBD, or deferred placeholder is used as an implementation step.
