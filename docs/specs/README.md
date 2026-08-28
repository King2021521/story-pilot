# Specs

This directory contains executable product and engineering specs for Story Pilot.

- [Story Pilot MVP 可执行规格](./2026-08-27-story-pilot-mvp-executable-spec.md)
- [Story Pilot MVP Implementation Plan](./2026-08-27-story-pilot-mvp-implementation-plan.md)
- [小说创作主路径整改 Spec](./2026-08-28-creative-main-path-remediation-spec.md)
- [创作预设与 AI 要素候选 Spec](./2026-08-28-creative-presets-ai-candidates-spec.md)

Current MVP decisions:

- Desktop: Tauri v2.
- Frontend: React + TypeScript + Ant Design.
- Backend sidecar: NestJS + TypeScript.
- Transactional storage: SQLite.
- Knowledge graph projection: Kuzu.
- AI execution: ModelGateway + versioned prompts + workflow runtime.
