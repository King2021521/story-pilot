# Creative Presets AI Candidates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build selectable creative presets and an AI candidate generation workflow for names, places, organizations, weapons, techniques, and props.

**Architecture:** Presets live in `packages/presets` as shared constants. The sidecar adds generic `element.generateCandidates` and `element.acceptCandidates` commands that use the existing model gateway, world tables, and domain events. The React workbench exposes this as a candidate pool in `CreativeElementsPanel`.

**Tech Stack:** React, TypeScript, Ant Design, NestJS sidecar, Zod contracts, SQLite repositories, existing ModelGateway.

**Spec:** `docs/specs/2026-08-28-creative-presets-ai-candidates-spec.md`

## Global Constraints

- Keep MVP scope focused on system presets, AI candidate generation, and candidate acceptance.
- Do not add a persistent preset management backend in this pass.
- AI generated candidates are not canon until the user accepts them.
- Use Ant Design `Select`, `Checkbox`, and `List` controls for option-oriented UI.
- Use existing SQLite tables: `characters`, `locations`, `organizations`, and `items`.
- Follow TDD: write failing tests before production code for each behavior change.

---

### Task 1: Shared Presets

**Files:**

- Modify: `packages/presets/src/index.ts`
- Test: `packages/presets/src/index.test.ts`

**Interfaces:**

- Produces: `GENRE_PRESETS`, `STYLE_PRESETS`, `ELEMENT_TYPE_PRESETS`, `COUNT_PRESETS`
- Produces types: `GenrePresetValue`, `StylePresetValue`, `ElementTypePresetValue`

- [x] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import { COUNT_PRESETS, ELEMENT_TYPE_PRESETS, GENRE_PRESETS, STYLE_PRESETS } from "./index.js";

describe("creative presets", () => {
  it("exports genre and style presets for selectable project creation", () => {
    expect(GENRE_PRESETS.map((preset) => preset.value)).toContain("悬疑");
    expect(GENRE_PRESETS.map((preset) => preset.value)).toContain("自定义");
    expect(STYLE_PRESETS.map((preset) => preset.value)).toContain("悬疑推理");
    expect(STYLE_PRESETS.map((preset) => preset.value)).toContain("自定义");
  });

  it("exports supported AI element candidate types and counts", () => {
    expect(ELEMENT_TYPE_PRESETS.map((preset) => preset.value)).toEqual([
      "character_name",
      "city",
      "location",
      "organization",
      "weapon",
      "technique",
      "item",
      "place_name",
    ]);
    expect(COUNT_PRESETS.map((preset) => preset.value)).toEqual([5, 10, 20]);
  });
});
```

- [x] **Step 2: Run red test**

Run: `pnpm --filter @story-pilot/presets exec vitest run src/index.test.ts`

Expected: FAIL because constants are missing.

- [x] **Step 3: Implement constants**

Export readonly arrays with `{ label, value }` objects and matching union types.

- [x] **Step 4: Run green test**

Run: `pnpm --filter @story-pilot/presets exec vitest run src/index.test.ts`

Expected: PASS.

### Task 2: Contracts And AI Schema

**Files:**

- Modify: `packages/contracts/src/commands/creative.ts`
- Modify: `packages/contracts/src/commands/index.ts`
- Modify: `packages/contracts/src/commands/command-registry.test.ts`
- Create: `packages/ai/src/structured-output/element-candidate.schema.ts`
- Create: `packages/ai/src/structured-output/element-candidate.schema.test.ts`
- Modify: `packages/ai/src/index.ts`
- Modify: `packages/ai/src/prompts/prompt-registry.ts`
- Create: `packages/ai/src/prompts/element-generate/system.v1.md`
- Modify: `packages/ai/src/capabilities/capability-registry.ts`

**Interfaces:**

- Produces command payloads for `element.generateCandidates` and `element.acceptCandidates`.
- Produces `ElementCandidateOutputSchema`.
- Produces prompt capability `element_generate`.

- [x] **Step 1: Write failing contract/schema tests**

Add tests that parse valid candidate generation and acceptance payloads and reject unsupported counts or empty item arrays.

- [x] **Step 2: Run red tests**

Run: `pnpm --filter @story-pilot/contracts exec vitest run src/commands/command-registry.test.ts && pnpm --filter @story-pilot/ai exec vitest run src/structured-output/element-candidate.schema.test.ts src/prompts/prompt-registry.test.ts`

Expected: FAIL because commands, schema, and prompt are missing.

- [x] **Step 3: Implement command schemas, AI schema, and prompt registration**

Use Zod enums for element type and count. Add prompt capability and export the schema from `packages/ai/src/index.ts`.

- [x] **Step 4: Run green tests**

Run the same command as Step 2.

Expected: PASS.

### Task 3: Repository And Sidecar Service

**Files:**

- Modify: `packages/db/src/repositories/world.repository.ts`
- Modify: `apps/sidecar/src/world/world-rule.service.ts`
- Modify: `apps/sidecar/src/world/world.module.ts`
- Create: `apps/sidecar/src/creative/element-candidate.service.ts`
- Create: `apps/sidecar/src/creative/creative.module.ts`
- Modify: `apps/sidecar/src/app.module.ts`
- Modify: `apps/sidecar/src/rpc/rpc.module.ts`
- Modify: `apps/sidecar/src/rpc/rpc.service.ts`
- Test: `apps/sidecar/src/rpc/rpc.integration.spec.ts`

**Interfaces:**

- Produces `ElementCandidateService.generateCandidates(input)`.
- Produces `ElementCandidateService.acceptCandidates(input)`.
- Produces accepted targets for character, location, organization, and item.

- [x] **Step 1: Write failing sidecar integration test**

Add an integration test that creates a project and world rule, calls `element.generateCandidates`, then accepts one `character_name`, one `city`, one `organization`, and one `weapon`. Verify `character.list`, `worldElement.list` or DB rows reflect accepted records.

- [x] **Step 2: Run red test**

Run: `pnpm --filter @story-pilot/sidecar exec vitest run src/rpc/rpc.integration.spec.ts`

Expected: FAIL because new commands and services are missing.

- [x] **Step 3: Implement repository methods and sidecar service**

Use `ModelGateway.generateObject` with `ElementCandidateOutputSchema`. For fake provider fallback, deterministic names are acceptable. Accept candidates by routing types to `CharacterService`, `WorldRepository.createLocation`, `WorldRepository.createOrganization`, or `WorldRepository.createItem`.

- [x] **Step 4: Run green test**

Run the same command as Step 2.

Expected: PASS.

### Task 4: Frontend API And UI

**Files:**

- Modify: `apps/desktop/src/shared/rpc/story-pilot-api.ts`
- Modify: `apps/desktop/src/shared/rpc/story-pilot-api.test.ts`
- Modify: `apps/desktop/src/app/ShellLayout.tsx`
- Modify: `apps/desktop/src/app/ShellLayout.test.tsx`
- Modify: `apps/desktop/src/features/creative/CreativeElementsPanel.tsx`
- Modify: `apps/desktop/src/features/creative/CreativeElementsPanel.test.tsx`
- Modify: `apps/desktop/src/features/workbench/WorkbenchHome.tsx`
- Modify: `apps/desktop/src/styles.css`
- Modify: `apps/desktop/package.json` if adding the presets package dependency is required.

**Interfaces:**

- Consumes presets from `@story-pilot/presets`.
- Consumes API client methods `generateElementCandidates` and `acceptElementCandidates`.
- `CreativeElementsPanel` accepts `projectGenre`, optional `projectStyle`, `worldRules`, `onGenerateElementCandidates`, and `onAcceptElementCandidates`.

- [x] **Step 1: Write failing frontend tests**

Add tests that confirm project creation has comboboxes for `题材` and `风格`, and creative panel can generate candidates, select candidates, and accept them.

- [x] **Step 2: Run red tests**

Run: `pnpm --filter @story-pilot/desktop exec vitest run src/app/ShellLayout.test.tsx src/features/creative/CreativeElementsPanel.test.tsx src/shared/rpc/story-pilot-api.test.ts`

Expected: FAIL because UI/API methods are missing.

- [x] **Step 3: Implement frontend API and UI**

Use `Select` for option fields. Keep manual object creation forms, but make the AI candidate pool the preferred path for names and world elements.

- [x] **Step 4: Run green tests**

Run the same command as Step 2.

Expected: PASS.

### Task 5: Full Verification

**Files:**

- No new production files expected unless previous tasks reveal missing exports.

**Interfaces:**

- Proves the end-to-end behavior compiles, tests, and packages.

- [x] **Step 1: Run full checks**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

- [x] **Step 2: Run packaged smoke test**

```bash
pnpm --filter @story-pilot/sidecar build
pnpm --filter @story-pilot/desktop tauri:build --bundles dmg --ci
hdiutil verify "apps/desktop/src-tauri/target/release/bundle/dmg/Story Pilot_0.1.0_aarch64.dmg"
```

- [x] **Step 3: Commit and push**

```bash
git add docs packages apps
git commit -m "feat: add creative presets and element candidates"
git push origin feat/mvp-implementation
```
