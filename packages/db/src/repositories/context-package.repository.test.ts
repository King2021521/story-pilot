import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { PROJECT_DATABASE_FILE, createProjectDatabase, runProjectMigrations } from "../index.js";
import { ContextPackageRepository } from "./context-package.repository.js";
import { ProjectRepository } from "./project.repository.js";

describe("ContextPackageRepository", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("persists auditable generation context packages with included and omitted items", async () => {
    const projectDatabase = await createProjectDatabaseWithProject(tempDirs);
    try {
      const repository = new ContextPackageRepository(projectDatabase);

      const created = repository.create({
        contextPackageId: "context_package_1",
        estimatedTokens: 1280,
        items: [
          {
            content: "作品：雪境堡垒，题材：冰雪末世，风格：硬核生存。",
            itemId: "project_1",
            itemType: "project",
            rank: 1,
          },
          {
            content: "第 1 章计划：主角抢占旧堡垒。",
            itemId: "chapter_plan_1",
            itemType: "chapter_plan",
            rank: 2,
          },
        ],
        omittedItems: [
          {
            reason: "超出本次上下文预算，保留摘要即可。",
            sourceId: "chapter_99",
            sourceType: "chapter_full_text",
            tokenEstimate: 9000,
          },
        ],
        projectId: "project_1",
        purpose: "execution_card_generate",
        strategy: "priority_budget_v1",
        targetId: "chapter_plan_1",
        targetType: "chapter_plan",
        tokenBudget: 6000,
        now: 1234,
      });

      expect(created).toMatchObject({
        estimatedTokens: 1280,
        id: "context_package_1",
        projectId: "project_1",
        purpose: "execution_card_generate",
        strategy: "priority_budget_v1",
        targetId: "chapter_plan_1",
        targetType: "chapter_plan",
        tokenBudget: 6000,
      });
      expect(created.items).toEqual([
        expect.objectContaining({
          itemId: "project_1",
          itemType: "project",
          rank: 1,
        }),
        expect.objectContaining({
          itemId: "chapter_plan_1",
          itemType: "chapter_plan",
          rank: 2,
        }),
      ]);
      expect(created.omittedItems).toEqual([
        {
          reason: "超出本次上下文预算，保留摘要即可。",
          sourceId: "chapter_99",
          sourceType: "chapter_full_text",
          tokenEstimate: 9000,
        },
      ]);

      expect(repository.getById("project_1", "context_package_1")).toEqual(created);
      expect(repository.listByTarget("project_1", "chapter_plan", "chapter_plan_1")).toEqual([
        created,
      ]);
    } finally {
      projectDatabase.close();
    }
  });
});

async function createProjectDatabaseWithProject(tempDirs: string[]) {
  const tempDir = mkdtempSync(join(tmpdir(), "story-pilot-context-package-"));
  tempDirs.push(tempDir);
  const projectDatabase = createProjectDatabase(join(tempDir, PROJECT_DATABASE_FILE));
  await runProjectMigrations(projectDatabase);
  new ProjectRepository(projectDatabase).createProject({
    defaultVolumeId: "volume_1",
    genre: "冰雪末世",
    projectId: "project_1",
    rootPath: join(tempDir, "project_1"),
    title: "雪境堡垒",
    workId: "work_1",
  });

  return projectDatabase;
}
