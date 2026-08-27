# 参考资料

以下资料用于确认框架能力和技术选型边界。正式开发前应根据实际版本再次核对 API 细节。

## Tauri

- [Tauri v2 sidecar Node.js 文档](https://github.com/tauri-apps/tauri-docs/blob/v2/src/content/docs/learn/sidecar-nodejs.mdx)
- [Tauri v2 Rust command 文档](https://github.com/tauri-apps/tauri-docs/blob/v2/src/content/docs/develop/calling-rust.mdx)

本设计采用 Tauri 作为桌面壳和安全边界，并使用 sidecar 承载 TypeScript 后端。

## Fastify

- [Fastify TypeScript server 示例](https://github.com/fastify/fastify/blob/main/examples/typescript-server.ts)

本设计将 Fastify 作为本地 sidecar API 的推荐方案。若后续更强调封闭通信，也可以替换为 stdin/stdout JSON-RPC。

## Drizzle ORM

- [Drizzle SQLite migrations 文档](https://github.com/drizzle-team/drizzle-orm-docs/blob/main/src/content/docs/sqlite/migrations.mdx)

本设计建议使用 Drizzle 管理 SQLite schema 和 migration。

## Kuzu

- [Kuzu 官方文档仓库](https://github.com/kuzudb/docs)

本设计建议使用 Kuzu 作为嵌入式 property graph 数据库，用于项目内知识图谱和长期记忆关系查询。

## Neo4j

- [Neo4j JavaScript Driver 文档](https://github.com/neo4j/docs-drivers)

Neo4j 是成熟图数据库，但对桌面 MVP 而言更偏服务化部署。本设计把它作为未来云端或团队版候选，而不是本地 MVP 默认方案。

## 内部前置文档

- [小说创作平台需求分析](../novel-creation-agent-requirements/README.md)
- [Story Pilot 桌面端产品设计](../story-pilot-desktop-product-design/README.md)

