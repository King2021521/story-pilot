# Story Pilot MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first executable Story Pilot MVP slice from local project creation to chapter drafting, artifact application, memory confirmation, and graph-backed recall.

**Architecture:** The desktop app uses Tauri v2 with React and Ant Design. The backend runs as a local NestJS TypeScript sidecar, exposes a normalized RPC endpoint through the Tauri bridge, stores transactional source data in SQLite, projects relationship data into Kuzu, and executes AI workflows through a ModelGateway and versioned PromptRegistry.

**Tech Stack:** Tauri v2, React, Ant Design, TypeScript, NestJS, SQLite, Drizzle ORM, Kuzu, Vitest, Testing Library, Playwright later for UI E2E.

**Spec:** `docs/specs/2026-08-27-story-pilot-mvp-executable-spec.md`

## Global Constraints

- Backend TypeScript project must use NestJS.
- MVP must not include Fastify as an explicit dependency or architecture component.
- Frontend must use Ant Design as the component system.
- AI cannot directly mutate canon memory or official chapter content.
- SQLite is the transactional source of truth.
- Kuzu graph data is a projection and must be rebuildable.
- All cross-process commands must use shared contracts.
- All AI calls must go through ModelGateway.
- Prompt templates must be versioned and tested.
- Implementation must keep Tauri Rust bridge thin.

---

## Milestone 0: Framework Alignment

### Task 0.1: Migrate Sidecar Skeleton From Fastify To NestJS

**Files:**

- Modify: `apps/sidecar/package.json`
- Create: `apps/sidecar/src/app.module.ts`
- Create: `apps/sidecar/src/health/health.controller.ts`
- Create: `apps/sidecar/src/health/health.module.ts`
- Create: `apps/sidecar/src/health/health.service.ts`
- Create: `apps/sidecar/src/rpc/rpc.controller.ts`
- Create: `apps/sidecar/src/rpc/rpc.module.ts`
- Create: `apps/sidecar/src/rpc/rpc.service.ts`
- Modify: `apps/sidecar/src/main.ts`
- Remove: `apps/sidecar/src/server.ts`
- Replace: `apps/sidecar/src/server.test.ts` with NestJS tests

**Interfaces:**

- Produces: `HealthService.getHealth(): SidecarHealth`
- Produces: `RpcService.handle(request: RpcRequest): Promise<RpcResponse>`
- Produces: `POST /rpc`
- Produces: `GET /health`

**Steps:**

- [ ] Install NestJS dependencies.

```bash
pnpm --filter @story-pilot/sidecar remove fastify
pnpm --filter @story-pilot/sidecar add @nestjs/common @nestjs/core @nestjs/platform-express reflect-metadata rxjs @story-pilot/contracts@workspace:*
pnpm --filter @story-pilot/sidecar add -D @nestjs/testing supertest @types/supertest
```

- [ ] Write `health.controller.spec.ts`.

```ts
import { Test } from "@nestjs/testing";
import { HealthController } from "./health.controller.js";
import { HealthService } from "./health.service.js";

describe("HealthController", () => {
  it("returns sidecar health", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService],
    }).compile();

    const controller = moduleRef.get(HealthController);

    expect(controller.getHealth()).toMatchObject({
      service: "story-pilot-sidecar",
      status: "ok",
    });
  });
});
```

- [ ] Write `rpc.controller.spec.ts`.

```ts
import { Test } from "@nestjs/testing";
import { RpcController } from "./rpc.controller.js";
import { RpcService } from "./rpc.service.js";
import { HealthService } from "../health/health.service.js";

describe("RpcController", () => {
  it("handles app.health through the RPC envelope", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [RpcController],
      providers: [RpcService, HealthService],
    }).compile();

    const controller = moduleRef.get(RpcController);

    await expect(
      controller.handle({
        id: "req_1",
        command: "app.health",
        payload: { source: "test" },
      }),
    ).resolves.toMatchObject({
      id: "req_1",
      ok: true,
      data: {
        service: "story-pilot-sidecar",
        status: "ok",
      },
    });
  });
});
```

- [ ] Run tests and verify failure before implementation.

```bash
pnpm --filter @story-pilot/sidecar test
```

Expected failure: missing NestJS controllers or providers.

- [ ] Implement minimal NestJS modules and bootstrap.

```ts
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

const host = process.env.STORY_PILOT_SIDECAR_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.STORY_PILOT_SIDECAR_PORT ?? "0", 10);

const app = await NestFactory.create(AppModule, { logger: ["error", "warn", "log"] });
await app.listen(port, host);
```

- [ ] Run verification.

```bash
pnpm --filter @story-pilot/sidecar test
pnpm --filter @story-pilot/sidecar typecheck
pnpm --filter @story-pilot/sidecar build
```

- [ ] Commit.

```bash
git add apps/sidecar package.json pnpm-lock.yaml
git commit -m "chore: migrate sidecar to nestjs"
```

## Milestone 1: Contracts And Command Registry

### Task 1.1: Define RPC Commands And Error Contracts

**Files:**

- Modify: `packages/contracts/src/rpc.ts`
- Modify: `packages/contracts/src/errors.ts`
- Create: `packages/contracts/src/commands/project.ts`
- Create: `packages/contracts/src/commands/chapter.ts`
- Create: `packages/contracts/src/commands/memory.ts`
- Create: `packages/contracts/src/commands/workflow.ts`
- Create: `packages/contracts/src/commands/index.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/contracts/src/commands/command-registry.test.ts`

**Interfaces:**

- Produces: `CommandName`
- Produces: `commandSchemas`
- Produces: `parseCommandPayload(command, payload)`
- Produces: strongly typed request/response types for MVP commands

**Steps:**

- [ ] Write failing tests for command schema parsing.

```ts
import { describe, expect, it } from "vitest";
import { parseCommandPayload } from "./index.js";

describe("command registry", () => {
  it("parses project.create payloads", () => {
    expect(
      parseCommandPayload("project.create", {
        title: "长夜序章",
        genre: "悬疑",
      }),
    ).toEqual({
      title: "长夜序章",
      genre: "悬疑",
    });
  });

  it("rejects unknown commands", () => {
    expect(() => parseCommandPayload("unknown.command", {})).toThrow("UNKNOWN_COMMAND");
  });
});
```

- [ ] Run red test.

```bash
pnpm --filter @story-pilot/contracts test
```

- [ ] Implement command registry with Zod schemas.

Command set:

- `project.create`
- `project.listRecent`
- `project.open`
- `workbench.getSnapshot`
- `chapter.list`
- `chapter.get`
- `chapter.create`
- `chapter.saveContent`
- `chapter.listVersions`
- `chapter.generateDraft`
- `artifact.apply`
- `memory.listCandidates`
- `memory.confirm`
- `memory.reject`
- `graph.getNeighborhood`
- `workflow.cancel`

- [ ] Verify.

```bash
pnpm --filter @story-pilot/contracts test
pnpm --filter @story-pilot/contracts typecheck
```

- [ ] Commit.

```bash
git add packages/contracts
git commit -m "feat: define mvp rpc contracts"
```

## Milestone 2: SQLite Source Of Truth

### Task 2.1: Add Drizzle SQLite Schema V1

**Files:**

- Modify: `packages/db/package.json`
- Create: `packages/db/src/schema/project.ts`
- Create: `packages/db/src/schema/chapter.ts`
- Create: `packages/db/src/schema/character.ts`
- Create: `packages/db/src/schema/world.ts`
- Create: `packages/db/src/schema/plot.ts`
- Create: `packages/db/src/schema/memory.ts`
- Create: `packages/db/src/schema/workflow.ts`
- Create: `packages/db/src/schema/events.ts`
- Create: `packages/db/src/schema/index.ts`
- Create: `packages/db/src/schema/schema.test.ts`

**Interfaces:**

- Produces: Drizzle table definitions for MVP source tables.
- Produces: `createProjectDatabase(path: string): ProjectDatabase`
- Produces: `runProjectMigrations(db: ProjectDatabase): Promise<void>`

**Steps:**

- [ ] Install DB dependencies.

```bash
pnpm --filter @story-pilot/db add drizzle-orm better-sqlite3
pnpm --filter @story-pilot/db add -D drizzle-kit @types/better-sqlite3
```

- [ ] Write schema test.

```ts
import { describe, expect, it } from "vitest";
import { schemaTableNames } from "./index.js";

describe("project schema", () => {
  it("contains the MVP source tables", () => {
    expect(schemaTableNames).toEqual(
      expect.arrayContaining([
        "projects",
        "works",
        "volumes",
        "chapters",
        "chapter_versions",
        "characters",
        "character_traits",
        "entity_relations",
        "world_rules",
        "story_events",
        "foreshadowings",
        "work_orders",
        "workflow_runs",
        "artifacts",
        "memory_candidates",
        "memories",
        "domain_events",
      ]),
    );
  });
});
```

- [ ] Implement schema and migrations.
- [ ] Verify.

```bash
pnpm --filter @story-pilot/db test
pnpm --filter @story-pilot/db typecheck
pnpm --filter @story-pilot/db build
```

- [ ] Commit.

```bash
git add packages/db pnpm-lock.yaml
git commit -m "feat: add sqlite schema v1"
```

### Task 2.2: Add Project Storage Service

**Files:**

- Create: `packages/db/src/project-database.ts`
- Create: `packages/db/src/repositories/project.repository.ts`
- Create: `packages/db/src/repositories/chapter.repository.ts`
- Create: `packages/db/src/repositories/memory.repository.ts`
- Create: `apps/sidecar/src/storage/storage.module.ts`
- Create: `apps/sidecar/src/storage/project-storage.service.ts`
- Create: `apps/sidecar/src/project/project.service.ts`
- Create: `apps/sidecar/src/project/project.module.ts`
- Create: `apps/sidecar/src/project/project.service.spec.ts`

**Interfaces:**

- Produces: `ProjectService.createProject(input): Promise<ProjectOverview>`
- Produces: project directory layout with `project.sqlite`, `graph.kuzu`, `files`, `snapshots`, `backups`

**Steps:**

- [ ] Write failing test for local project creation.

```ts
it("creates a project directory and initial database records", async () => {
  const project = await service.createProject({
    title: "长夜序章",
    genre: "悬疑",
  });

  expect(project.title).toBe("长夜序章");
  expect(project.status).toBe("planning");
  expect(await storage.exists(project.id, "project.sqlite")).toBe(true);
});
```

- [ ] Implement storage root resolution and project creation.
- [ ] Verify repository and sidecar tests.
- [ ] Commit.

```bash
git add packages/db apps/sidecar
git commit -m "feat: create local story projects"
```

## Milestone 3: Chapter Editing Vertical Slice

### Task 3.1: Implement Chapters, Versions, And Artifact Application

**Files:**

- Create: `apps/sidecar/src/chapter/chapter.module.ts`
- Create: `apps/sidecar/src/chapter/chapter.service.ts`
- Create: `apps/sidecar/src/chapter/chapter.service.spec.ts`
- Create: `apps/sidecar/src/artifact/artifact.module.ts`
- Create: `apps/sidecar/src/artifact/artifact.service.ts`
- Create: `packages/domain/src/chapter-version.ts`
- Create: `packages/domain/src/chapter-version.test.ts`

**Interfaces:**

- Produces: `ChapterService.createChapter(input)`
- Produces: `ChapterService.saveContent(input)`
- Produces: `ArtifactService.applyArtifact(input)`
- Produces: `createNextChapterVersion(previousVersion: number): number`

**Steps:**

- [ ] Write failing tests for version increments.

```ts
expect(createNextChapterVersion(0)).toBe(1);
expect(createNextChapterVersion(7)).toBe(8);
```

- [ ] Write failing service test for applying an AI draft artifact.

```ts
await artifactService.applyArtifact({
  projectId,
  artifactId,
  targetType: "chapter",
  targetId: chapterId,
  applyMode: "replace",
  targetVersion: 1,
});

const chapter = await chapterRepository.getById(chapterId);
expect(chapter.version).toBe(2);
expect(chapter.content).toContain("雨夜来信");
```

- [ ] Implement chapter repositories and services.
- [ ] Verify.
- [ ] Commit.

```bash
git add packages/domain packages/db apps/sidecar
git commit -m "feat: add chapter editing version flow"
```

## Milestone 4: Creative Object Model

### Task 4.1: Implement Characters, Traits, Relations, World Rules, Plotlines, Events, And Foreshadowings

**Files:**

- Create: `apps/sidecar/src/character/character.module.ts`
- Create: `apps/sidecar/src/character/character.service.ts`
- Create: `apps/sidecar/src/world/world.module.ts`
- Create: `apps/sidecar/src/world/world-rule.service.ts`
- Create: `apps/sidecar/src/plot/plot.module.ts`
- Create: `apps/sidecar/src/plot/plotline.service.ts`
- Create: `apps/sidecar/src/plot/story-event.service.ts`
- Create: `apps/sidecar/src/plot/foreshadowing.service.ts`
- Create: tests beside each service

**Interfaces:**

- Produces: CRUD methods for creative objects.
- Produces: `entity_relations` records for relationship facts.
- Produces: `domain_events` for each canon-changing write.

**Steps:**

- [ ] Write tests for character creation with traits.
- [ ] Write tests for creating `entity_relations` between characters.
- [ ] Write tests for creating story events with participants.
- [ ] Write tests for creating foreshadowing seed and payoff events.
- [ ] Implement repositories and services.
- [ ] Verify.
- [ ] Commit.

```bash
git add packages/db apps/sidecar
git commit -m "feat: add creative object services"
```

## Milestone 5: Knowledge Graph Projection

### Task 5.1: Implement Kuzu Graph Schema And Projector

**Files:**

- Modify: `packages/graph/package.json`
- Create: `packages/graph/src/schema.ts`
- Create: `packages/graph/src/graph-store.ts`
- Create: `packages/graph/src/projector/graph-projector.ts`
- Create: `packages/graph/src/queries/neighborhood.ts`
- Create: `packages/graph/src/graph-projector.test.ts`
- Create: `apps/sidecar/src/graph/graph.module.ts`
- Create: `apps/sidecar/src/graph/graph.service.ts`

**Interfaces:**

- Produces: `GraphProjector.project(event): Promise<void>`
- Produces: `GraphService.getNeighborhood(input): Promise<GraphNeighborhood>`
- Produces: `GraphService.rebuild(projectId): Promise<GraphRebuildResult>`

**Steps:**

- [ ] Install Kuzu Node dependency after verifying package compatibility.
- [ ] Write projection tests for `character.created`, `entity_relation.confirmed`, `foreshadowing.seeded`.
- [ ] Implement graph schema creation.
- [ ] Implement event projector.
- [ ] Implement neighborhood query.
- [ ] Verify graph tests.
- [ ] Commit.

```bash
git add packages/graph apps/sidecar pnpm-lock.yaml
git commit -m "feat: add graph projection layer"
```

## Milestone 6: AI Foundation

### Task 6.1: Implement ModelGateway And Fake Provider

**Files:**

- Create: `packages/ai/src/model-gateway/types.ts`
- Create: `packages/ai/src/model-gateway/model-gateway.ts`
- Create: `packages/ai/src/providers/fake-model-provider.ts`
- Create: `packages/ai/src/providers/openai-compatible-provider.ts`
- Create: `packages/ai/src/model-gateway/model-gateway.test.ts`
- Create: `apps/sidecar/src/ai/ai.module.ts`
- Create: `apps/sidecar/src/ai/model-gateway.provider.ts`

**Interfaces:**

- Produces: `ModelGateway.generateObject<T>()`
- Produces: `ModelGateway.streamText()`
- Produces: `ModelGateway.embed()`
- Produces: fake provider for tests

**Steps:**

- [ ] Write failing test for fake provider object generation.

```ts
const result = await gateway.generateObject({
  purpose: "chapter_draft",
  schemaName: "ChapterDraftOutput",
  messages: [{ role: "user", content: "生成第一章" }],
});

expect(result.object).toMatchObject({
  draft: expect.any(Object),
});
```

- [ ] Implement provider interface and fake provider.
- [ ] Implement model call metadata object without DB persistence first.
- [ ] Verify.
- [ ] Commit.

```bash
git add packages/ai apps/sidecar
git commit -m "feat: add model gateway foundation"
```

### Task 6.2: Implement PromptRegistry And Prompt Golden Tests

**Files:**

- Create: `packages/ai/src/prompts/shared/global-writer-system.v1.md`
- Create: `packages/ai/src/prompts/shared/canon-boundary.v1.md`
- Create: `packages/ai/src/prompts/chapter-draft/system.v1.md`
- Create: `packages/ai/src/prompts/memory-extract/system.v1.md`
- Create: `packages/ai/src/prompts/continuity-review/system.v1.md`
- Create: `packages/ai/src/prompts/prompt-registry.ts`
- Create: `packages/ai/src/prompts/prompt-registry.test.ts`

**Interfaces:**

- Produces: `PromptRegistry.getPrompt(capability, version)`
- Produces: `buildPromptMessages(input)`

**Steps:**

- [ ] Write golden tests that assert chapter draft prompt includes canon boundary, output contract, and task constraints.
- [ ] Write golden tests that memory extraction prompt says all extracted memories are candidates.
- [ ] Implement prompt loading and composition.
- [ ] Verify.
- [ ] Commit.

```bash
git add packages/ai
git commit -m "feat: add versioned ai prompts"
```

## Milestone 7: Workflow Runtime

### Task 7.1: Implement Work Orders And Workflow Engine

**Files:**

- Create: `packages/workflow-runtime/src/engine/workflow-engine.ts`
- Create: `packages/workflow-runtime/src/engine/workflow-registry.ts`
- Create: `packages/workflow-runtime/src/engine/workflow-engine.test.ts`
- Create: `packages/workflow-runtime/src/work-orders/work-order-state.ts`
- Create: `apps/sidecar/src/workflow/workflow.module.ts`
- Create: `apps/sidecar/src/workflow/work-order.service.ts`
- Create: `apps/sidecar/src/workflow/workflow.service.ts`

**Interfaces:**

- Produces: `WorkflowEngine.run(input): Promise<WorkflowRunResult>`
- Produces: `WorkflowEngine.cancel(runId): Promise<void>`
- Produces: `WorkOrderService.create(input)`

**Steps:**

- [ ] Write tests for queued -> running -> waiting_user -> completed.
- [ ] Write tests for cancellation.
- [ ] Implement workflow registry and engine.
- [ ] Persist workflow run and step state.
- [ ] Verify.
- [ ] Commit.

```bash
git add packages/workflow-runtime apps/sidecar
git commit -m "feat: add workflow runtime"
```

## Milestone 8: AI Chapter Draft And Memory Confirmation

### Task 8.1: Implement Chapter Draft Workflow

**Files:**

- Create: `packages/ai/src/context-builder/context-builder.ts`
- Create: `packages/ai/src/structured-output/chapter-draft.schema.ts`
- Create: `packages/workflow-runtime/src/workflows/chapter-draft.workflow.ts`
- Create: tests for context and workflow
- Modify: `apps/sidecar/src/chapter/chapter.service.ts`
- Modify: `apps/sidecar/src/workflow/workflow.service.ts`

**Interfaces:**

- Produces: `chapter.generateDraft` RPC command.
- Produces: artifact with `kind = chapter_draft`.
- Produces: memory candidates with `status = pending`.

**Steps:**

- [ ] Write failing workflow test with fake provider.
- [ ] Implement context package builder.
- [ ] Implement structured output parser.
- [ ] Persist artifact and memory candidates.
- [ ] Verify that chapter content is not modified.
- [ ] Commit.

```bash
git add packages/ai packages/workflow-runtime apps/sidecar
git commit -m "feat: generate chapter draft artifacts"
```

### Task 8.2: Implement Memory Candidate Confirmation

**Files:**

- Create: `apps/sidecar/src/memory/memory.module.ts`
- Create: `apps/sidecar/src/memory/memory.service.ts`
- Create: `apps/sidecar/src/memory/memory.service.spec.ts`
- Modify: `packages/domain/src/memory-state.ts`
- Modify: `packages/db/src/repositories/memory.repository.ts`
- Modify: `packages/graph/src/projector/graph-projector.ts`

**Interfaces:**

- Produces: `memory.confirm`
- Produces: `memory.reject`
- Produces: `memory.merge`

**Steps:**

- [ ] Write failing test for accepting a candidate as canon.
- [ ] Write failing test for rejecting a candidate.
- [ ] Write failing test for merging a candidate into existing memory.
- [ ] Implement memory service.
- [ ] Emit domain events.
- [ ] Trigger graph projection.
- [ ] Verify.
- [ ] Commit.

```bash
git add apps/sidecar packages/domain packages/db packages/graph
git commit -m "feat: confirm extracted memories"
```

## Milestone 9: Ant Design Frontend

### Task 9.1: Introduce AntD App Shell And Providers

**Files:**

- Modify: `apps/desktop/package.json`
- Create: `apps/desktop/src/app/AppProviders.tsx`
- Create: `apps/desktop/src/app/ShellLayout.tsx`
- Create: `apps/desktop/src/app/theme.ts`
- Create: `apps/desktop/src/features/project/ProjectSidebar.tsx`
- Create: `apps/desktop/src/features/workbench/WorkbenchHome.tsx`
- Create: `apps/desktop/src/features/ai/AiTaskDrawer.tsx`
- Modify: `apps/desktop/src/App.tsx`
- Modify: `apps/desktop/src/styles.css`
- Create: component tests

**Interfaces:**

- Produces: AntD-based shell layout.
- Produces: `RpcClientProvider`.
- Produces: workbench page slots for project, chapter, memory and AI task drawers.

**Steps:**

- [ ] Install AntD.

```bash
pnpm --filter @story-pilot/desktop add antd @ant-design/icons
```

- [ ] Write failing test for shell layout rendering project sidebar, workbench, board drawer button, AI task drawer button.
- [ ] Implement `ConfigProvider` theme.
- [ ] Implement shell with AntD `Layout`, `Sider`, `Content`, `Drawer`, `Button`, `Tree`, `Tabs`.
- [ ] Verify.
- [ ] Commit.

```bash
git add apps/desktop pnpm-lock.yaml
git commit -m "feat: add antd desktop shell"
```

### Task 9.2: Implement Chapter Editor And Memory Review UI Slice

**Files:**

- Create: `apps/desktop/src/features/chapter/ChapterEditorPage.tsx`
- Create: `apps/desktop/src/features/chapter/ChapterTree.tsx`
- Create: `apps/desktop/src/features/chapter/ChapterVersionDrawer.tsx`
- Create: `apps/desktop/src/features/memory/MemoryCandidateList.tsx`
- Create: `apps/desktop/src/features/memory/MemoryConfirmDrawer.tsx`
- Create: `apps/desktop/src/shared/rpc/rpc-client.ts`
- Create: tests for each interactive component

**Interfaces:**

- Produces: chapter save UI calling `chapter.saveContent`.
- Produces: generate draft action calling `chapter.generateDraft`.
- Produces: memory confirmation UI calling `memory.confirm` and `memory.reject`.

**Steps:**

- [ ] Write failing tests for chapter editor rendering and save callback.
- [ ] Write failing tests for memory candidate accept/reject callbacks.
- [ ] Implement RPC client abstraction.
- [ ] Implement components using AntD `Form`, `Input`, `Tree`, `Drawer`, `List`, `Button`, `Tag`.
- [ ] Verify.
- [ ] Commit.

```bash
git add apps/desktop
git commit -m "feat: add chapter and memory review ui"
```

## Milestone 10: End To End MVP Closure

### Task 10.1: Wire RPC Commands To Services

**Files:**

- Modify: `apps/sidecar/src/rpc/rpc.service.ts`
- Modify: sidecar module imports
- Add integration tests for RPC commands

**Interfaces:**

- Produces working commands from contracts through NestJS services.

**Steps:**

- [ ] Write integration test for create project -> create chapter -> save content.
- [ ] Write integration test for generate draft with fake provider -> artifact -> apply artifact.
- [ ] Write integration test for memory candidate -> confirm canon -> graph projection scheduled.
- [ ] Implement command dispatch.
- [ ] Verify.
- [ ] Commit.

```bash
git add apps/sidecar packages/contracts
git commit -m "feat: wire mvp rpc commands"
```

### Task 10.2: Final Verification

**Files:**

- Modify only files needed to fix final verification failures.

**Steps:**

- [ ] Run TypeScript typecheck.

```bash
pnpm typecheck
```

- [ ] Run tests.

```bash
pnpm test
```

- [ ] Run build.

```bash
pnpm build
```

- [ ] Run lint.

```bash
pnpm lint
```

- [ ] Run Tauri Rust check.

```bash
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

- [ ] Launch frontend locally and inspect primary screens.

```bash
pnpm --filter @story-pilot/desktop dev:web
```

- [ ] Commit final fixes.

```bash
git add .
git commit -m "chore: stabilize mvp implementation"
```

## Execution Order

1. Milestone 0: NestJS alignment.
2. Milestone 1: contracts.
3. Milestone 2: SQLite source of truth.
4. Milestone 3: chapter editing vertical slice.
5. Milestone 4: creative object model.
6. Milestone 5: Kuzu graph projection.
7. Milestone 6: AI foundation and prompts.
8. Milestone 7: workflow runtime.
9. Milestone 8: chapter draft and memory confirmation.
10. Milestone 9: AntD frontend.
11. Milestone 10: end to end closure.

## Review Gates

- Do not start Milestone 2 until NestJS migration and contracts pass.
- Do not start AI workflow work until chapter versioning and artifact application are implemented.
- Do not let AI generated text modify chapters without artifact application tests.
- Do not enable graph-backed retrieval until graph rebuild tests pass.
- Do not start larger UI work until RPC client contract tests pass.

## Acceptance Checklist

- [ ] Sidecar is NestJS-based and has no direct Fastify dependency.
- [ ] Frontend uses Ant Design providers and components.
- [ ] Project and chapter flows persist to SQLite.
- [ ] Chapter versions protect user edits from AI overwrites.
- [ ] AI chapter draft produces artifact, not direct chapter mutation.
- [ ] Memory extraction produces candidates only.
- [ ] User confirmation creates canon memory.
- [ ] Canon memory projects into Kuzu.
- [ ] ContextBuilder reads canon memory and graph neighborhood.
- [ ] Tests cover contracts, DB, graph, AI workflow, prompts and core UI.
