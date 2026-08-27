# Story Pilot

Story Pilot is a desktop-first AI writing workbench for long-form fiction. The current repository is initialized as a pnpm monorepo with a Tauri desktop shell, React frontend, TypeScript sidecar backend, and shared domain packages.

## Workspace Layout

```text
apps/
  desktop/        React + Vite + Tauri v2 desktop app
  sidecar/        TypeScript sidecar backend powered by NestJS
packages/
  contracts/      Shared RPC, event, and error contracts
  domain/         Pure domain rules and state transitions
  db/             SQLite database package skeleton
  graph/          Kuzu graph package skeleton
  ai/             AI gateway and workflow support skeleton
  workflow-runtime/
  search/
  presets/
  export/
  testing/
docs/
  novel-creation-agent-requirements/
  story-pilot-desktop-product-design/
  story-pilot-technical-architecture/
```

## Commands

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm lint
pnpm build
pnpm dev:sidecar
pnpm dev:desktop
```

Desktop frontend only:

```bash
pnpm --filter @story-pilot/desktop dev:web
```

Tauri Rust check:

```bash
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

## Architecture Direction

- Tauri owns desktop capabilities, windowing, filesystem boundaries, and the future sidecar lifecycle.
- React owns the workbench UI and talks through Tauri commands.
- The TypeScript sidecar owns local backend services and should use NestJS for module, controller, and provider structure.
- Shared contracts live in `packages/contracts` and are built before cross-package checks.
- AI and storage packages are scaffolded as explicit boundaries before implementation begins.
